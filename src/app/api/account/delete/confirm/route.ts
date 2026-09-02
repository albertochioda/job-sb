import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendEmail } from "@/lib/email";
import { releaseScheduleIfPresent } from "@/lib/billing/stripe-schedule";
import { hashDeletionToken } from "@/lib/account-deletion-token";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);
const ALERT_EMAIL_TO = process.env.ALERT_EMAIL_TO || "alberto.chioda@orvendecision.com";
const REFUND_WINDOW_MS = 14 * 24 * 60 * 60 * 1000; // Art. 7.2 ToS

// Tabelle con user_id ma SENZA foreign key verso auth.users (verificato via
// information_schema — vedi scripts/sql-account-deletion.sql per il
// contesto): il CASCADE di deleteUser() non le tocca, vanno svuotate qui
// esplicitamente. Includerne una che in realtà avesse già CASCADE non fa
// danno: diventa solo un DELETE ridondante di 0 righe.
//
// Ordine significativo: scored_offers.last_matched_search_id referenzia
// searches.id (FK confermata da un test end-to-end reale — cancellare
// searches PRIMA di scored_offers fallisce con violazione di foreign key,
// finché scored_offers non viene svuotata a sua volta). scored_offers deve
// quindi precedere searches in questa lista.
const TABLES_WITHOUT_CASCADE = [
  "cancellation_feedback",
  "generated_letters",
  "scored_offers",
  "searches",
  "support_reports",
  "support_chat_log",
] as const;

export async function POST(request: NextRequest) {
  const { token } = await request.json();
  if (typeof token !== "string" || !token) {
    return NextResponse.json({ error: "token mancante" }, { status: 400 });
  }

  const admin = createAdminClient();
  const tokenHash = hashDeletionToken(token);

  const { data: pending } = await admin
    .from("account_deletion_requests")
    .select("id, user_id, expires_at, used_at, requested_at")
    .eq("token_hash", tokenHash)
    .single();

  if (!pending || pending.used_at || new Date(pending.expires_at).getTime() < Date.now()) {
    return NextResponse.json({ error: "Link non valido o scaduto — richiedi di nuovo la cancellazione dal tuo profilo" }, { status: 400 });
  }

  // Marca il token come consumato PRIMA di fare qualunque cosa distruttiva,
  // con una UPDATE condizionale su used_at IS NULL: se due richieste
  // arrivassero in corsa sullo stesso token (doppio click, retry di rete),
  // solo la prima riesce a marcarlo — la seconda vede 0 righe aggiornate e
  // si ferma qui, invece di eseguire la cancellazione due volte.
  const { data: claimed } = await admin
    .from("account_deletion_requests")
    .update({ used_at: new Date().toISOString() })
    .eq("id", pending.id)
    .is("used_at", null)
    .select("id")
    .single();

  if (!claimed) {
    return NextResponse.json({ error: "Questo link è già stato usato" }, { status: 400 });
  }

  const userId = pending.user_id;

  const { data: userData, error: userError } = await admin.auth.admin.getUserById(userId);
  if (userError || !userData?.user) {
    return NextResponse.json({ error: "Account non trovato — potrebbe essere già stato eliminato" }, { status: 404 });
  }
  const userEmail = userData.user.email ?? "";

  const { data: sub } = await admin
    .from("subscriptions")
    .select("stripe_subscription_id, stripe_customer_id, first_payment_at")
    .eq("user_id", userId)
    .single();

  let hadActiveSubscription = false;
  let refundIssued = false;
  let refundAmountCents: number | null = null;

  if (sub?.stripe_subscription_id) {
    hadActiveSubscription = true;
    try {
      const stripeSub = await stripe.subscriptions.retrieve(sub.stripe_subscription_id);
      await releaseScheduleIfPresent(stripe, stripeSub);
      // Periodo di fatturazione corrente, catturato PRIMA della cancellazione
      // — serve per il calcolo del rimborso pro-rata sotto. Va preso dalla
      // subscription (item.current_period_start/end), non dall'invoice: per
      // la prima fattura di un abbonamento appena creato, invoice.period_start
      // e invoice.period_end possono coincidere (nessuna durata), cosa
      // verificata con un test end-to-end reale — usare quei campi avrebbe
      // sempre azzerato il rimborso.
      const currentPeriodStart = stripeSub.items.data[0]?.current_period_start;
      const currentPeriodEnd = stripeSub.items.data[0]?.current_period_end;

      // Cancellazione immediata, non a fine periodo: chi elimina l'account
      // vuole sparire subito, non restare abbonato fino a fine mese — a
      // differenza di /api/billing/cancel-subscription (cancel_at_period_end).
      await stripe.subscriptions.cancel(sub.stripe_subscription_id);

      const withinRefundWindow =
        !!sub.first_payment_at && Date.now() - new Date(sub.first_payment_at).getTime() <= REFUND_WINDOW_MS;

      if (withinRefundWindow) {
        // Rimborso automatico pro-rata SOLO entro i 14gg dal primo
        // pagamento (Art. 7.2 ToS) — best-effort: un fallimento qui NON
        // deve bloccare la cancellazione dell'account (obbligo GDPR), va
        // solo segnalato per gestione manuale.
        try {
          const invoices = await stripe.invoices.list({ subscription: sub.stripe_subscription_id, status: "paid", limit: 1 });
          const invoice = invoices.data[0];
          // L'oggetto Invoice non espone più "charge" direttamente (rimosso
          // dalle versioni recenti dell'API) — il pagamento va cercato via
          // invoicePayments, che referenzia il PaymentIntent; refunds.create
          // accetta payment_intent direttamente, senza dover risalire a un
          // charge id.
          let paymentIntentId: string | undefined;
          if (invoice) {
            const invoicePayments = await stripe.invoicePayments.list({ invoice: invoice.id, status: "paid", limit: 1 });
            const payment = invoicePayments.data[0]?.payment;
            const pi = payment?.type === "payment_intent" ? payment.payment_intent : undefined;
            paymentIntentId = typeof pi === "string" ? pi : pi?.id;
          }
          if (invoice && paymentIntentId && currentPeriodStart && currentPeriodEnd) {
            const periodStartMs = currentPeriodStart * 1000;
            const periodEndMs = currentPeriodEnd * 1000;
            const totalMs = periodEndMs - periodStartMs;
            const unusedMs = Math.max(0, periodEndMs - Date.now());
            const fraction = totalMs > 0 ? Math.min(1, unusedMs / totalMs) : 0;
            const amount = Math.round(invoice.amount_paid * fraction);
            if (amount > 0) {
              await stripe.refunds.create({ payment_intent: paymentIntentId, amount });
              refundIssued = true;
              refundAmountCents = amount;
            }
          }
        } catch (refundError) {
          console.error("[account/delete/confirm] rimborso fallito, richiede gestione manuale:", refundError);
          await sendEmail({
            to: ALERT_EMAIL_TO,
            subject: `⚠️ Rimborso automatico fallito — cancellazione account ${userEmail}`,
            html: `<p>L'abbonamento Stripe di <strong>${userEmail}</strong> (subscription ${sub.stripe_subscription_id}) è stato cancellato correttamente durante la cancellazione dell'account, ma il rimborso pro-rata automatico è fallito.</p><p>Errore: ${refundError instanceof Error ? refundError.message : String(refundError)}</p><p>Verifica ed eventualmente emetti il rimborso manualmente dalla dashboard Stripe.</p>`,
          });
        }
      }
    } catch (stripeError) {
      // Qui invece ABORTIAMO: l'abbonamento non è stato cancellato, quindi
      // non ha senso procedere a cancellare i dati — l'utente può riprovare.
      console.error("[account/delete/confirm] cancellazione Stripe fallita:", stripeError);
      return NextResponse.json({ error: "Errore nella cancellazione dell'abbonamento, riprova o contatta il supporto" }, { status: 502 });
    }
  }

  // Audit trail PRIMA di deleteUser(): questa tabella non è collegata da FK
  // ad auth.users apposta, per sopravvivere alla riga che documenta essere
  // stata cancellata (vedi scripts/sql-account-deletion.sql).
  await admin.from("account_deletions").insert({
    user_id: userId,
    email: userEmail,
    had_active_subscription: hadActiveSubscription,
    stripe_subscription_id: sub?.stripe_subscription_id ?? null,
    stripe_customer_id: sub?.stripe_customer_id ?? null,
    refund_issued: refundIssued,
    refund_amount_cents: refundAmountCents,
    requested_at: pending.requested_at,
  });

  for (const table of TABLES_WITHOUT_CASCADE) {
    const { error } = await admin.from(table).delete().eq("user_id", userId);
    if (error) {
      console.error(`[account/delete/confirm] errore cancellazione ${table}:`, error.message);
    }
  }

  // Storage: nessun CASCADE tocca mai i bucket, vanno svuotati esplicitamente.
  try {
    const { data: cvFiles } = await admin.storage.from("cvs").list(userId);
    if (cvFiles?.length) {
      await admin.storage.from("cvs").remove(cvFiles.map((f) => `${userId}/${f.name}`));
    }
  } catch (storageError) {
    console.error("[account/delete/confirm] errore pulizia storage 'cvs':", storageError);
  }
  await admin.storage.from("photos").remove([
    `${userId}/profile.jpg`,
    `${userId}/profile.png`,
    `${userId}/profile.webp`,
  ]);

  const { error: deleteUserError } = await admin.auth.admin.deleteUser(userId);
  if (deleteUserError) {
    // Stato parzialmente irreversibile: Stripe già cancellato, dati già
    // svuotati, ma la riga auth.users resta — va chiuso a mano, non perso
    // silenziosamente.
    console.error("[account/delete/confirm] deleteUser fallito dopo pulizia dati:", deleteUserError.message);
    await sendEmail({
      to: ALERT_EMAIL_TO,
      subject: `🚨 URGENTE — deleteUser fallito dopo pulizia dati per ${userEmail}`,
      html: `<p>La cancellazione account per <strong>${userEmail}</strong> (user_id ${userId}) ha completato la pulizia dati (Stripe, tabelle esplicite, storage) ma <code>auth.admin.deleteUser()</code> è fallita.</p><p>Errore: ${deleteUserError.message}</p><p>Va completata manualmente da Supabase Studio (Authentication → Users → elimina ${userEmail}).</p>`,
    });
    return NextResponse.json({ error: "Si è verificato un errore, il nostro team è stato avvisato" }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
