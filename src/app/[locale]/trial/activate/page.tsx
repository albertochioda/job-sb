import Logo from "@/components/logo";
import TrialActivateForm from "./trial-activate-form";

// Primo accesso dopo il pagamento del Trial (2026-09-24) — pagina NUOVA e
// SEPARATA, non condivide nulla con /reset-password (né pagina, né route,
// né componente): quella resta per "password dimenticata", invariata.
//
// Perché serve una pagina dedicata invece di riusare un meccanismo
// esistente: il magic link generato da admin.generateLink() nel webhook
// (api/webhooks/stripe/route.ts, ramo trial_signup) porta i token della
// sessione nel FRAMMENTO dell'URL (#access_token=...), non in una query
// string ?code=. Un frammento non viene MAI inviato al server da nessun
// browser — nessuna route server-side (Route Handler o Server Component)
// può leggerlo. È strutturale: un link generato lato server (nessun
// browser coinvolto al momento della generazione) non può usare il
// meccanismo PKCE con ?code= che invece funziona per "password
// dimenticata" (lì è il browser stesso, in forgot-password-form.tsx, a
// generare il code_verifier PRIMA di chiedere il link).
//
// Per questo questa pagina è quasi interamente un Client Component
// (trial-activate-form.tsx): solo il JavaScript nel browser può leggere
// window.location.hash e stabilire la sessione da lì.
export default async function TrialActivatePage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;

  return (
    <main className="min-h-screen flex items-center justify-center px-4">
      <div className="w-full max-w-sm space-y-6">
        <div className="flex justify-center">
          <Logo className="h-[60px] w-auto" stacked />
        </div>
        <div className="text-center space-y-1">
          <h1 className="text-2xl font-bold">Attiva il tuo Trial</h1>
          <p className="text-sm text-muted-foreground">Imposta una password per accedere al tuo account.</p>
        </div>
        <TrialActivateForm locale={locale} />
      </div>
    </main>
  );
}
