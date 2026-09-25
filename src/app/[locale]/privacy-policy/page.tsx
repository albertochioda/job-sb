import type { Metadata } from "next";
import { SUPPORT_EMAIL } from "@/lib/support-contact";
import { SITE_URL } from "@/lib/site-url";
import Logo from "@/components/logo";

const CONTENT: Record<"it" | "en", { title: string; description: string }> = {
  it: {
    title: "Privacy Policy — Job Search Bridge",
    description: "Come Job Search Bridge raccoglie, utilizza e protegge i tuoi dati personali, in conformità al GDPR (Regolamento UE 2016/679).",
  },
  en: {
    title: "Privacy Policy — Job Search Bridge",
    description: "How Job Search Bridge collects, uses and protects your personal data, in compliance with the EU GDPR (Regulation 2016/679).",
  },
};

// Metadata dedicati (prima ereditava titolo/descrizione generici dalla
// home — problema emerso solo ora che la pagina è indicizzabile, vedi
// src/app/robots.ts). Il contenuto della pagina resta in italiano per
// entrambe le lingue (nessuna traduzione EN del testo legale, invariato
// da prima di questo fix) — qui si localizzano solo title/description,
// non tramite next-intl: questa pagina non usa quel sistema per il corpo.
export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const { title, description } = CONTENT[locale as "it" | "en"] ?? CONTENT.it;
  const url = `${SITE_URL}/${locale}/privacy-policy`;

  return {
    title,
    description,
    robots: { index: true, follow: true },
    alternates: {
      canonical: url,
      languages: {
        it: `${SITE_URL}/it/privacy-policy`,
        en: `${SITE_URL}/en/privacy-policy`,
      },
    },
    openGraph: {
      title,
      description,
      type: "website",
      locale: locale === "it" ? "it_IT" : "en_US",
      url,
      siteName: "Job Search Bridge",
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
    },
  };
}

export default function PrivacyPolicy() {
  return (
    <main className="min-h-screen bg-white text-gray-900 px-6 py-12">
      <div className="max-w-3xl mx-auto space-y-8">
        <div className="text-center space-y-1">
          <div className="flex justify-center">
            <Logo />
          </div>
          <h1 className="text-2xl font-bold">Informativa sul trattamento dei dati personali</h1>
          <p className="text-sm text-gray-500">ai sensi dell&apos;art. 13 del Regolamento (UE) 2016/679 (GDPR) — Versione 3.0 — 25 settembre 2026</p>
        </div>

        <section className="space-y-3">
          <h2 className="text-lg font-semibold">1. Titolare del trattamento</h2>
          <p className="text-sm leading-relaxed">Il Titolare del trattamento è Alberto Chioda, con sede in Lodi (LO), Italia. Per richieste relative alla presente Informativa o all&apos;esercizio dei diritti privacy: <a href={`mailto:${SUPPORT_EMAIL}`} className="underline">{SUPPORT_EMAIL}</a>.</p>
        </section>

        <section className="space-y-3">
          <h2 className="text-lg font-semibold">2. Ambito dell&apos;Informativa</h2>
          <p className="text-sm leading-relaxed">La presente Informativa descrive il trattamento dei dati personali effettuato tramite Job Search Bridge (&quot;JSB&quot; o &quot;Servizio&quot;), piattaforma che supporta l&apos;utente nella ricerca di opportunità lavorative, nell&apos;analisi della compatibilità tra profilo professionale e offerte, nell&apos;adattamento del curriculum vitae, nella generazione di lettere di presentazione e nella gestione personale delle candidature.</p>
        </section>

        <section className="space-y-3">
          <h2 className="text-lg font-semibold">3. Categorie di dati trattati</h2>
          <p className="text-sm font-medium">3.1 Dati forniti dall&apos;utente</p>
          <ul className="text-sm leading-relaxed list-disc pl-5 space-y-1">
            <li>Nome e cognome, indirizzo email e dati necessari alla creazione e gestione dell&apos;account.</li>
            <li>Curriculum vitae originale e relativo testo estratto, incluse le informazioni professionali e personali contenute nel documento (ad esempio esperienze, formazione, competenze, lingue e, se presenti nel CV, recapiti, data di nascita, nazionalità e località).</li>
            <li>Foto profilo, se caricata volontariamente.</li>
            <li>Preferenze di ricerca e di lavoro, quali ruoli, località e raggio, retribuzione minima desiderata, modalità di lavoro, regime e tipologia contrattuale.</li>
            <li>Bio o indicazioni facoltative utilizzate per personalizzare le lettere di presentazione.</li>
            <li>Note, stato e cronologia delle candidature salvate dall&apos;utente.</li>
            <li>Messaggi inviati all&apos;assistente di supporto, segnalazioni e feedback.</li>
            <li>Motivo di cancellazione dell&apos;abbonamento, se fornito volontariamente.</li>
            <li>Consenso marketing, ove espresso. Alla data della presente Informativa non è attivo un invio di newsletter o comunicazioni promozionali basato su tale consenso.</li>
          </ul>
          <p className="text-sm font-medium">3.2 Dati generati durante l&apos;utilizzo del Servizio</p>
          <ul className="text-sm leading-relaxed list-disc pl-5 space-y-1">
            <li>Risultati delle ricerche, offerte associate al profilo e informazioni di utilizzo del Servizio.</li>
            <li>Punteggi e spiegazioni di compatibilità, incluse le componenti relative alla compatibilità professionale e alle preferenze dell&apos;utente.</li>
            <li>Curriculum vitae adattati e lettere di presentazione generate tramite sistemi di intelligenza artificiale.</li>
            <li>Log tecnici e diagnostici necessari al funzionamento, alla sicurezza e alla risoluzione di problemi. JSB ha configurato i log applicativi per evitare la registrazione non necessaria del contenuto dei CV e di altri dati personali.</li>
          </ul>
          <p className="text-sm font-medium">3.3 Dati relativi ai pagamenti</p>
          <p className="text-sm leading-relaxed">I pagamenti sono gestiti tramite Stripe. JSB non riceve né memorizza i dati completi della carta di pagamento. Può ricevere e conservare identificativi tecnici della relazione di pagamento e dell&apos;abbonamento, stato del pagamento, piano, cadenza, importi e informazioni necessarie alla gestione amministrativa e contrattuale.</p>
          <p className="text-sm font-medium">3.4 Dati tecnici e analytics</p>
          <p className="text-sm leading-relaxed">JSB utilizza Vercel Analytics per statistiche di utilizzo. Gli eventi personalizzati configurati dal Servizio non includono nome, email, user ID, contenuto del CV o titolo dell&apos;offerta. Il Servizio utilizza inoltre cookie o tecnologie strettamente necessarie alla sessione e all&apos;autenticazione e local storage per preferenze e stato tecnico dell&apos;applicazione. L&apos;infrastruttura dei fornitori può trattare dati tecnici, incluso l&apos;indirizzo IP, secondo le rispettive funzioni e informative.</p>
        </section>

        <section className="space-y-3">
          <h2 className="text-lg font-semibold">4. Finalità e basi giuridiche</h2>
          <ul className="text-sm leading-relaxed list-disc pl-5 space-y-1">
            <li>Erogazione del Servizio, gestione dell&apos;account, ricerca delle offerte, scoring, adattamento CV, generazione lettere e gestione delle candidature: esecuzione del contratto o di misure precontrattuali (art. 6, par. 1, lett. b GDPR).</li>
            <li>Gestione dei pagamenti, abbonamenti, rinnovi, cancellazioni e assistenza contrattuale: esecuzione del contratto (art. 6, par. 1, lett. b GDPR) e, ove applicabile, adempimento di obblighi legali (art. 6, par. 1, lett. c GDPR).</li>
            <li>Sicurezza, prevenzione degli abusi, diagnostica tecnica e miglioramento del funzionamento del Servizio: legittimo interesse del Titolare (art. 6, par. 1, lett. f GDPR), nel rispetto dei principi di necessità e minimizzazione.</li>
            <li>Statistiche aggregate o anonimizzate sul funzionamento e sull&apos;utilizzo del Servizio: legittimo interesse del Titolare; quando i dati sono effettivamente anonimizzati, non costituiscono più dati personali.</li>
            <li>Gestione di richieste, reclami e difesa di diritti: esecuzione del contratto, obbligo legale o legittimo interesse, a seconda del caso.</li>
            <li>Comunicazioni promozionali: consenso (art. 6, par. 1, lett. a GDPR), qualora tale funzione venga attivata. Il consenso può essere revocato in qualsiasi momento.</li>
          </ul>
        </section>

        <section className="space-y-3">
          <h2 className="text-lg font-semibold">5. Utilizzo di sistemi di intelligenza artificiale</h2>
          <p className="text-sm font-medium">5.1 Google Gemini</p>
          <p className="text-sm leading-relaxed">JSB utilizza Google Gemini API come motore attivo per l&apos;analisi della compatibilità tra curriculum e offerta. Al servizio possono essere trasmessi il testo del CV, le preferenze di ricerca e il testo dell&apos;offerta. Gemini produce elementi di valutazione della compatibilità professionale ed estrae informazioni fattuali dall&apos;offerta; ulteriori componenti del punteggio e il risultato complessivo sono calcolati dal software JSB mediante regole deterministiche. JSB utilizza il livello a pagamento della Gemini API e non utilizza, per questo flusso, Google Search Grounding, URL Context, file upload o caching esplicito.</p>
          <p className="text-sm font-medium">5.2 Anthropic Claude</p>
          <p className="text-sm leading-relaxed">JSB utilizza Anthropic Claude API per funzioni quali suggerimento di ruoli a partire dal CV, adattamento e traduzione del curriculum, estrazione delle informazioni necessarie alla costruzione dei documenti, generazione delle lettere di presentazione e assistenza automatizzata. Per la generazione di alcune lettere può essere effettuata una ricerca web sull&apos;azienda tramite lo strumento di ricerca di Anthropic: la ricerca utilizza il nome dell&apos;azienda e il ruolo, senza includere nella query dati personali dell&apos;utente.</p>
          <p className="text-sm font-medium">5.3 Natura degli output AI</p>
          <p className="text-sm leading-relaxed">Gli output generati dall&apos;intelligenza artificiale possono contenere inesattezze, omissioni o interpretazioni non corrette. L&apos;utente è invitato a verificare CV, lettere, punteggi e spiegazioni prima di utilizzarli. JSB non prende decisioni di assunzione per conto di datori di lavoro e non invia automaticamente candidature per conto dell&apos;utente.</p>
        </section>

        <section className="space-y-3">
          <h2 className="text-lg font-semibold">6. Principali fornitori e destinatari</h2>
          <p className="text-sm leading-relaxed">Per erogare il Servizio, i dati possono essere trattati dai seguenti fornitori, nei limiti necessari alle rispettive funzioni:</p>
          <ul className="text-sm leading-relaxed list-disc pl-5 space-y-1">
            <li>Supabase — database PostgreSQL, autenticazione e storage; il progetto JSB è configurato nella regione eu-west-1 (Irlanda).</li>
            <li>Google — Gemini API per analisi e scoring.</li>
            <li>Anthropic — Claude API per elaborazione CV, lettere e assistenza.</li>
            <li>Stripe — pagamenti, abbonamenti, portale di fatturazione e rimborsi.</li>
            <li>Resend — invio di email transazionali e comunicazioni di servizio.</li>
            <li>Vercel — hosting dell&apos;applicazione web e Web Analytics.</li>
            <li>Render — hosting ed esecuzione del worker applicativo.</li>
            <li>Upstash — Redis gestito utilizzato per la coda delle ricerche.</li>
            <li>IPRoyal / DataImpulse — infrastruttura proxy utilizzata dal sistema per l&apos;accesso alle fonti di offerte di lavoro; non è previsto l&apos;invio intenzionale del CV a tali fornitori.</li>
            <li>OpenStreetMap / Nominatim — geocodifica e gestione delle località.</li>
          </ul>
        </section>

        <section className="space-y-3">
          <h2 className="text-lg font-semibold">7. Trasferimenti di dati fuori dallo Spazio Economico Europeo</h2>
          <p className="text-sm leading-relaxed">Alcuni fornitori possono trattare dati negli Stati Uniti o in altri Paesi al di fuori dello Spazio Economico Europeo. Quando richiesto dal GDPR, i trasferimenti sono effettuati sulla base di un meccanismo riconosciuto dalla normativa applicabile, quale una decisione di adeguatezza o le Clausole Contrattuali Standard approvate dalla Commissione europea, integrate ove necessario da ulteriori misure. La localizzazione primaria del database, dell&apos;autenticazione e dello storage Supabase di JSB è in Irlanda.</p>
        </section>

        <section className="space-y-3">
          <h2 className="text-lg font-semibold">8. Conservazione dei dati</h2>
          <p className="text-sm leading-relaxed">JSB conserva i dati personali per il tempo necessario alle finalità per cui sono trattati e, successivamente, per il periodo necessario ad adempiere a obblighi legali, amministrativi, fiscali, contabili o a tutelare diritti del Titolare. I periodi non sono applicati indistintamente a tutte le categorie di dati.</p>
          <ul className="text-sm leading-relaxed list-disc pl-5 space-y-1">
            <li>I dati operativi dell&apos;account, inclusi CV, documenti generati, preferenze, candidature e cronologia collegata, vengono eliminati dai sistemi applicativi quando l&apos;utente completa la procedura di cancellazione dell&apos;account, salvo le eccezioni indicate di seguito.</li>
            <li>I log diagnostici dedicati ai parametri di ricerca sono soggetti a retention di 30 giorni e vengono inoltre eliminati per l&apos;utente in caso di cancellazione dell&apos;account.</li>
            <li>I task della coda di ricerca contengono temporaneamente il testo del CV; i task che vengono prelevati dal worker oltre due ore dall&apos;inserimento sono scartati e non elaborati. In caso di indisponibilità prolungata del worker, la cancellazione fisica dalla coda può avvenire solo alla successiva elaborazione/gestione della coda.</li>
            <li>Per l&apos;invio delle comunicazioni transazionali JSB utilizza Resend. Nei piani standard, email e log operativi sono conservati per 30 giorni durante l&apos;utilizzo del servizio; in caso di cessazione dell&apos;account del titolare presso Resend, gli eventuali dati residui vengono eliminati entro 90 giorni. I backup possono permanere fino a 7 giorni.</li>
            <li>Gli input e output inviati ad Anthropic API sono, secondo la configurazione standard del servizio commerciale, cancellati dal backend del fornitore entro 30 giorni, salvo eccezioni per sicurezza, violazioni delle policy, obblighi di legge o accordi differenti.</li>
            <li>Per Gemini API a pagamento, Google non utilizza prompt e risposte per migliorare i propri prodotti. Per finalità di rilevazione e prevenzione degli abusi, Google conserva prompt, informazioni contestuali e output per 55 giorni. Se vengono abilitati i log API del progetto, la relativa retention può essere configurata secondo le opzioni messe a disposizione dal fornitore. JSB non utilizza Grounding con Google Search nel flusso di scoring.</li>
            <li>I dati e documenti che Stripe deve conservare per finalità di pagamento, contabili, fiscali, antifrode o per obblighi di legge possono permanere presso Stripe anche dopo la cancellazione dell&apos;account JSB.</li>
            <li>JSB conserva un record minimo relativo alla cancellazione dell&apos;account e agli identificativi amministrativi necessari a documentare l&apos;operazione e gestire eventuali obblighi o contestazioni. Tale record è soggetto a revisione e minimizzazione periodica in funzione della finalità e degli obblighi applicabili.</li>
            <li>Copie residue possono permanere temporaneamente nei backup e nei log infrastrutturali dei fornitori secondo i rispettivi cicli tecnici di retention, senza essere utilizzate per l&apos;ordinaria erogazione del Servizio.</li>
          </ul>
        </section>

        <section className="space-y-3">
          <h2 className="text-lg font-semibold">9. Cancellazione dell&apos;account</h2>
          <p className="text-sm leading-relaxed">L&apos;utente può avviare la cancellazione dell&apos;account dalla piattaforma. La procedura richiede una conferma tramite email. Una volta completata, JSB elimina l&apos;account e i dati operativi collegati, inclusi CV originali, CV adattati, lettere, ricerche, punteggi, candidature, note e dati di supporto, secondo il flusso tecnico previsto. Restano esclusivamente i dati che devono o possono essere conservati per obblighi legali, amministrativi, fiscali, sicurezza, tutela di diritti o per le retention tecniche dei fornitori descritte nella presente Informativa.</p>
        </section>

        <section className="space-y-3">
          <h2 className="text-lg font-semibold">10. Diritti dell&apos;interessato</h2>
          <p className="text-sm leading-relaxed">Nei casi previsti dal GDPR, l&apos;utente può esercitare i diritti di accesso, rettifica, cancellazione, limitazione del trattamento, portabilità dei dati, opposizione e revoca del consenso. La revoca non pregiudica la liceità del trattamento effettuato prima della revoca.</p>
          <p className="text-sm leading-relaxed">Le richieste possono essere inviate a <a href={`mailto:${SUPPORT_EMAIL}`} className="underline">{SUPPORT_EMAIL}</a>. L&apos;utente ha inoltre diritto di proporre reclamo al Garante per la protezione dei dati personali o all&apos;autorità di controllo competente (<a href="https://www.garanteprivacy.it" target="_blank" rel="noopener noreferrer" className="underline">www.garanteprivacy.it</a>).</p>
        </section>

        <section className="space-y-3">
          <h2 className="text-lg font-semibold">11. Sicurezza</h2>
          <p className="text-sm leading-relaxed">JSB adotta misure tecniche e organizzative volte a ridurre i rischi di accesso non autorizzato, perdita, alterazione o divulgazione dei dati. Tra le misure applicative verificate rientrano autenticazione gestita tramite Supabase Auth, segregazione dei dati per utente, gestione dei secret tramite variabili d&apos;ambiente, verifica della firma dei webhook Stripe, token monouso per la cancellazione dell&apos;account e limitazioni su tipo e dimensione dei file caricati. Le credenziali di autenticazione sono gestite dal servizio Supabase Auth; JSB non implementa un proprio sistema di memorizzazione delle password.</p>
        </section>

        <section className="space-y-3">
          <h2 className="text-lg font-semibold">12. Dati relativi a terzi presenti nelle offerte</h2>
          <p className="text-sm leading-relaxed">Le offerte di lavoro possono contenere, nel testo pubblicato dalla fonte originaria, nomi o recapiti di recruiter o altri soggetti. Tali informazioni possono essere trattate incidentalmente come parte del testo dell&apos;offerta. JSB non prevede campi dedicati alla raccolta di dati di contatto dei recruiter.</p>
        </section>

        <section className="space-y-3">
          <h2 className="text-lg font-semibold">13. Modifiche alla presente Informativa</h2>
          <p className="text-sm leading-relaxed">La presente Informativa può essere aggiornata per riflettere modifiche normative, tecniche o del Servizio. In caso di modifiche sostanziali, JSB informerà gli utenti con modalità appropriate, anche tramite email o avviso nella piattaforma.</p>
        </section>

        <section className="space-y-3">
          <h2 className="text-lg font-semibold">14. Contatti</h2>
          <p className="text-sm leading-relaxed">Per informazioni o richieste relative alla privacy: <a href={`mailto:${SUPPORT_EMAIL}`} className="underline">{SUPPORT_EMAIL}</a>.</p>
        </section>
      </div>
    </main>
  );
}
