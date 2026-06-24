export default function PrivacyPolicy() {
  return (
    <main className="min-h-screen bg-white text-gray-900 px-6 py-12">
      <div className="max-w-3xl mx-auto space-y-8">
        <div className="text-center space-y-1">
          <p className="text-xl font-bold tracking-tight">Job SB</p>
          <h1 className="text-2xl font-bold">Informativa sul Trattamento dei Dati Personali</h1>
          <p className="text-sm text-gray-500">ai sensi dell&apos;art. 13 del Regolamento UE 2016/679 (GDPR) — 24 giugno 2026</p>
        </div>

        <section className="space-y-3">
          <h2 className="text-lg font-semibold">1. Titolare del Trattamento</h2>
          <p className="text-sm leading-relaxed">Titolare del trattamento è Alberto Chioda, con sede in Lodi (LO), Italia. Contatto: <a href="mailto:albertochioda@gmail.com" className="underline">albertochioda@gmail.com</a>.</p>
        </section>

        <section className="space-y-3">
          <h2 className="text-lg font-semibold">2. Dati Personali Raccolti</h2>
          <p className="text-sm font-medium">2.1 Dati forniti direttamente dall'utente</p>
          <ul className="text-sm leading-relaxed list-disc pl-5 space-y-1">
            <li>Dati di registrazione: indirizzo email, password (in forma criptata)</li>
            <li>Dati del profilo professionale: curriculum vitae, esperienze lavorative, competenze, formazione</li>
            <li>Dati di configurazione: ruoli cercati, città di preferenza, RAL minima desiderata, modalità di lavoro preferita</li>
            <li>Foto profilo (opzionale)</li>
          </ul>
          <p className="text-sm font-medium">2.2 Dati raccolti automaticamente</p>
          <ul className="text-sm leading-relaxed list-disc pl-5 space-y-1">
            <li>Dati di utilizzo: numero di ricerche effettuate, CV adattati, offerte visualizzate</li>
            <li>Dati tecnici: indirizzo IP, tipo di browser, sistema operativo, date e orari di accesso</li>
            <li>Log di sistema: attività svolte sulla piattaforma</li>
          </ul>
        </section>

        <section className="space-y-3">
          <h2 className="text-lg font-semibold">3. Finalità e Base Giuridica del Trattamento</h2>
          <ul className="text-sm leading-relaxed list-disc pl-5 space-y-1">
            <li>Erogazione del Servizio (base giuridica: esecuzione del contratto — art. 6.1.b GDPR)</li>
            <li>Ricerca e presentazione di offerte di lavoro compatibili con il profilo (base giuridica: esecuzione del contratto)</li>
            <li>Adattamento del curriculum vitae tramite intelligenza artificiale (base giuridica: esecuzione del contratto)</li>
            <li>Miglioramento del Servizio e analisi statistica in forma aggregata e anonima (base giuridica: legittimo interesse — art. 6.1.f GDPR)</li>
            <li>Adempimento di obblighi legali (base giuridica: obbligo legale — art. 6.1.c GDPR)</li>
          </ul>
        </section>

        <section className="space-y-3">
          <h2 className="text-lg font-semibold">4. Trattamento tramite Intelligenza Artificiale</h2>
          <p className="text-sm leading-relaxed">Il Servizio utilizza API di Anthropic PBC (Claude AI) per elaborare il curriculum vitae dell'utente e generare contenuti adattati. I dati trasmessi ad Anthropic sono trattati nel rispetto dei termini di servizio di Anthropic. I dati non vengono utilizzati da Anthropic per addestrare i propri modelli nell'ambito dei contratti API business.</p>
        </section>

        <section className="space-y-3">
          <h2 className="text-lg font-semibold">5. Trasferimento dei Dati</h2>
          <p className="text-sm leading-relaxed">I dati sono conservati su server Supabase (UE) e Vercel. L'utilizzo delle API Anthropic comporta il trasferimento di dati verso gli USA, garantito da adeguate garanzie contrattuali (Standard Contractual Clauses).</p>
        </section>

        <section className="space-y-3">
          <h2 className="text-lg font-semibold">6. Conservazione dei Dati</h2>
          <p className="text-sm leading-relaxed">I dati sono conservati per tutta la durata del rapporto contrattuale e successivamente per il periodo necessario ad adempiere agli obblighi legali. I dati dell'account vengono eliminati entro 30 giorni dalla richiesta di cancellazione.</p>
        </section>

        <section className="space-y-3">
          <h2 className="text-lg font-semibold">7. Diritti dell'Interessato</h2>
          <p className="text-sm leading-relaxed">L'utente ha il diritto di:</p>
          <ul className="text-sm leading-relaxed list-disc pl-5 space-y-1">
            <li>Accedere ai propri dati personali (art. 15 GDPR)</li>
            <li>Richiedere la rettifica di dati inesatti (art. 16 GDPR)</li>
            <li>Richiedere la cancellazione dei dati (art. 17 GDPR)</li>
            <li>Richiedere la limitazione del trattamento (art. 18 GDPR)</li>
            <li>Ricevere i dati in formato strutturato — portabilità (art. 20 GDPR)</li>
            <li>Opporsi al trattamento (art. 21 GDPR)</li>
          </ul>
          <p className="text-sm leading-relaxed">Per esercitare i propri diritti: <a href="mailto:albertochioda@gmail.com" className="underline">albertochioda@gmail.com</a>. L'utente ha inoltre il diritto di proporre reclamo all'Autorità Garante per la Protezione dei Dati Personali (<a href="https://www.garanteprivacy.it" target="_blank" rel="noopener noreferrer" className="underline">www.garanteprivacy.it</a>).</p>
        </section>

        <section className="space-y-3">
          <h2 className="text-lg font-semibold">8. Sicurezza</h2>
          <p className="text-sm leading-relaxed">Il Titolare adotta misure tecniche e organizzative adeguate a proteggere i dati personali da accessi non autorizzati, perdita, distruzione o divulgazione, incluse la cifratura delle password e la trasmissione dati in HTTPS.</p>
        </section>

        <section className="space-y-3">
          <h2 className="text-lg font-semibold">9. Modifiche alla Privacy Policy</h2>
          <p className="text-sm leading-relaxed">Il Titolare si riserva il diritto di modificare la presente Informativa. Le modifiche saranno comunicate via email.</p>
        </section>
      </div>
    </main>
  );
}
