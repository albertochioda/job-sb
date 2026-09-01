import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendEmail, escapeHtml } from "@/lib/email";
import { generateDeletionToken, hashDeletionToken, ACCOUNT_DELETION_TOKEN_TTL_MS } from "@/lib/account-deletion-token";
import { SITE_URL } from "@/lib/site-url";

const REFUND_WINDOW_MS = 14 * 24 * 60 * 60 * 1000; // Art. 7.2 ToS

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user || !user.email) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { confirmation_email, locale } = await request.json();
  if (typeof confirmation_email !== "string" || confirmation_email.trim().toLowerCase() !== user.email.toLowerCase()) {
    return NextResponse.json({ error: "l'email digitata non corrisponde al tuo account" }, { status: 400 });
  }
  const safeLocale = locale === "en" ? "en" : "it";

  const admin = createAdminClient();

  // Un utente non deve poter accumulare più link validi contemporaneamente
  // (es. richieste ripetute per errore): solo l'ultima email inviata deve
  // funzionare.
  await admin
    .from("account_deletion_requests")
    .update({ used_at: new Date().toISOString() })
    .eq("user_id", user.id)
    .is("used_at", null);

  const rawToken = generateDeletionToken();
  const expiresAt = new Date(Date.now() + ACCOUNT_DELETION_TOKEN_TTL_MS).toISOString();

  const { error: insertError } = await admin.from("account_deletion_requests").insert({
    user_id: user.id,
    token_hash: hashDeletionToken(rawToken),
    expires_at: expiresAt,
  });
  if (insertError) {
    console.error("[account/delete/request] errore salvataggio token:", insertError.message);
    return NextResponse.json({ error: "Si è verificato un errore, riprova più tardi" }, { status: 500 });
  }

  // Anteprima rimborso nell'email — solo informativa, il calcolo reale
  // (fonte di verità) avviene al momento della conferma, non qui: lo stato
  // potrebbe cambiare nella finestra di validità del link.
  const { data: sub } = await admin
    .from("subscriptions")
    .select("stripe_subscription_id, first_payment_at")
    .eq("user_id", user.id)
    .single();

  const withinRefundWindow =
    !!sub?.stripe_subscription_id &&
    !!sub?.first_payment_at &&
    Date.now() - new Date(sub.first_payment_at).getTime() <= REFUND_WINDOW_MS;

  const confirmUrl = `${SITE_URL}/${safeLocale}/account/delete/confirm?token=${rawToken}`;

  const html = `
    <p>Hai richiesto la cancellazione definitiva del tuo account Job Search Bridge (${escapeHtml(user.email)}).</p>
    <p><strong>Questa azione è irreversibile</strong>: verranno eliminati CV, lettere generate, cronologia ricerche e candidature, e ogni altro dato collegato al tuo account.</p>
    ${sub?.stripe_subscription_id ? `<p>Il tuo abbonamento attivo verrà cancellato immediatamente${withinRefundWindow ? ", con rimborso automatico della quota non goduta (sei ancora entro i 14 giorni dal primo pagamento)" : " (senza rimborso: sono trascorsi più di 14 giorni dal primo pagamento)"}.</p>` : ""}
    <p>Per confermare, clicca sul link qui sotto entro <strong>1 ora</strong> — dopo quel termine il link scade e dovrai ripetere la richiesta dal tuo profilo:</p>
    <p><a href="${confirmUrl}">${confirmUrl}</a></p>
    <p>Se non sei stato tu a richiederlo, ignora semplicemente questa email: nessuna azione verrà eseguita senza il click di conferma.</p>
  `;

  const emailResult = await sendEmail({
    to: user.email,
    subject: "Conferma cancellazione account Job Search Bridge",
    html,
  });
  if (!emailResult.success) {
    console.error("[account/delete/request] invio email fallito:", emailResult.error);
    return NextResponse.json({ error: "Non siamo riusciti a inviare l'email di conferma, riprova più tardi" }, { status: 502 });
  }

  return NextResponse.json({ success: true });
}
