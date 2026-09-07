import { SUPPORT_EMAIL } from "@/lib/support-contact";
import Logo from "@/components/logo";

export default function PrivacyPolicy() {
  return (
    <main className="min-h-screen bg-white text-gray-900 px-6 py-12">
      <div className="max-w-3xl mx-auto space-y-8">
        <div className="text-center space-y-1">
          <div className="flex justify-center">
            <Logo />
          </div>
          <h1 className="text-2xl font-bold">Informativa sul Trattamento dei Dati Personali</h1>
          <p className="text-sm text-gray-500">ai sensi dell&apos;art. 13 del Regolamento UE 2016/679 (GDPR) — Versione 2.0 — 7 settembre 2026</p>
        </div>

        <section className="space-y-3">
          <h2 className="text-lg font-semibold">1. Titolare del Trattamento</h2>
          <p className="text-sm leading-relaxed">Titolare del trattamento è Alberto Chioda, con sede in Lodi (LO), Italia. Contatto: <a href={`mailto:${SUPPORT_EMAIL}`} className="underline">{SUPPORT_EMAIL}</a>.</p>
        </section>

        <section className="space-y-3">
          <h2 className="text-lg font-semibold">2. Dati Personali Raccolti</h2>
          <p className="text-sm font-medium">2.1 Dati forniti direttamente dall&apos;utente</p>
          <ul className="text-sm leading-relaxed list-disc pl-5 space-y-1">
            <li>Dati di registrazione: nome completo, indirizzo email, password (in forma criptata)</li>
            <li>Dati del profilo professionale: curriculum vitae (testo estratto e file originale), esperienze lavorative, competenze, formazione</li>
            <li>Contenuti generati dall&apos;intelligenza artificiale a partire dal profilo: curriculum vitae adattati alle singole offerte, lettere di motivazione, breve biografia facoltativa usata per personalizzare le lettere</li>
            <li>Dati di configurazione della ricerca: ruoli cercati, città e raggio di ricerca, settori, RAL minima desiderata, modalità di lavoro preferita, regime orario, tipologia contrattuale, lingue e paese di riferimento</li>
            <li>Foto profilo (opzionale)</li>
            <li>Candidature: offerte salvate, stato della candidatura, eventuali note personali inserite dall&apos;utente</li>
            <li>Comunicazioni con il Titolare: messaggi scambiati con l&apos;assistente di supporto, segnalazioni di problemi o idee, motivo indicato in caso di cancellazione dell&apos;abbonamento, consenso facoltativo a ricevere comunicazioni promozionali</li>
            <li>Dati di pagamento: per gli abbonamenti a pagamento, i dati della carta e delle transazioni sono raccolti ed elaborati direttamente da Stripe Inc., nostro fornitore di servizi di pagamento — Job Search Bridge non memorizza né ha accesso ai dati completi della carta</li>
          </ul>
          <p className="text-sm font-medium">2.2 Dati raccolti automaticamente</p>
          <ul className="text-sm leading-relaxed list-disc pl-5 space-y-1">
            <li>Dati di utilizzo: numero di ricerche effettuate, CV adattati e lettere generate, offerte visualizzate</li>
            <li>Dati di analisi statistica: tramite Vercel Analytics raccogliamo le visualizzazioni di pagina e alcuni eventi lungo il percorso dell&apos;utente (es. registrazione completata, onboarding completato, prima ricerca avviata, risultati visualizzati, checkout avviato) — i parametri di questi eventi non includono mai email, nome o altri dati identificativi, solo etichette non personali come il piano scelto o un conteggio</li>
            <li>Dati tecnici: tipo di browser, sistema operativo, date e orari di accesso. L&apos;indirizzo IP non viene raccolto né conservato dall&apos;applicazione stessa; può comparire incidentalmente nei log tecnici standard dei fornitori di infrastruttura (Vercel, Supabase), secondo le rispettive policy di questi ultimi</li>
            <li>Log di sistema: attività svolte sulla piattaforma</li>
          </ul>
        </section>

        <section className="space-y-3">
          <h2 className="text-lg font-semibold">3. Finalità e Base Giuridica del Trattamento</h2>
          <ul className="text-sm leading-relaxed list-disc pl-5 space-y-1">
            <li>Erogazione del Servizio (base giuridica: esecuzione del contratto — art. 6.1.b GDPR)</li>
            <li>Ricerca e presentazione di offerte di lavoro compatibili con il profilo (base giuridica: esecuzione del contratto)</li>
            <li>Adattamento del curriculum vitae tramite intelligenza artificiale (base giuridica: esecuzione del contratto)</li>
            <li>Gestione dei pagamenti e fatturazione degli abbonamenti (base giuridica: esecuzione del contratto)</li>
            <li>Assistenza clienti tramite l&apos;assistente virtuale e gestione di segnalazioni e richieste di supporto (base giuridica: esecuzione del contratto / legittimo interesse)</li>
            <li>Miglioramento del Servizio e analisi statistica in forma aggregata e anonima (base giuridica: legittimo interesse — art. 6.1.f GDPR)</li>
            <li>Adempimento di obblighi legali (base giuridica: obbligo legale — art. 6.1.c GDPR)</li>
          </ul>
        </section>

        <section className="space-y-3">
          <h2 className="text-lg font-semibold">4. Trattamento tramite Intelligenza Artificiale</h2>
          <p className="text-sm leading-relaxed">Il Servizio utilizza le API di Anthropic PBC (Claude AI) in più punti del suo funzionamento: per valutare automaticamente la compatibilità tra il profilo dell&apos;utente e ciascuna offerta di lavoro individuata (un calcolo eseguito per ogni singola offerta trovata), per adattare il curriculum vitae alle offerte selezionate, per generare lettere di motivazione — operazione che può comportare una ricerca informativa sul web relativa all&apos;azienda destinataria, condotta autonomamente dall&apos;intelligenza artificiale — e per rispondere alle richieste rivolte all&apos;assistente virtuale di supporto. I dati trasmessi ad Anthropic sono trattati nel rispetto dei termini di servizio di Anthropic. I dati non vengono utilizzati da Anthropic per addestrare i propri modelli nell&apos;ambito dei contratti API business.</p>
        </section>

        <section className="space-y-3">
          <h2 className="text-lg font-semibold">5. Trasferimento dei Dati</h2>
          <p className="text-sm leading-relaxed">I dati sono trattati, per le finalità indicate, dai seguenti fornitori terzi (responsabili del trattamento, salvo Stripe che agisce come titolare autonomo per le finalità di pagamento):</p>
          <ul className="text-sm leading-relaxed list-disc pl-5 space-y-1">
            <li>Supabase — database e autenticazione (infrastruttura ospitata nell&apos;Unione Europea, regione eu-west-1 / Irlanda)</li>
            <li>Vercel — hosting dell&apos;applicazione web</li>
            <li>Render.com (USA) — ospita il componente che effettua la ricerca delle offerte, calcola il punteggio di compatibilità e adatta il curriculum vitae; riceve a questo scopo il testo del curriculum e i contenuti generati</li>
            <li>Upstash (USA) — coda dati temporanea tra i componenti del Servizio, usata per trasmettere il testo del curriculum, l&apos;identificativo dell&apos;account e i parametri di ricerca durante l&apos;elaborazione di una ricerca</li>
            <li>Anthropic PBC (USA) — elaborazione tramite intelligenza artificiale, vedi Art. 4</li>
            <li>Stripe Inc. (USA) — gestione dei pagamenti, vedi Art. 2.1</li>
            <li>Resend (USA) — invio delle email transazionali relative all&apos;account (conferme, notifiche, comunicazioni di servizio)</li>
          </ul>
          <p className="text-sm leading-relaxed">Il trasferimento di dati verso paesi extra-UE (in particolare Stati Uniti) è garantito da adeguate garanzie contrattuali previste dai rispettivi fornitori (Standard Contractual Clauses).</p>
        </section>

        <section className="space-y-3">
          <h2 className="text-lg font-semibold">6. Conservazione dei Dati</h2>
          <p className="text-sm leading-relaxed">I dati sono conservati per tutta la durata del rapporto contrattuale e successivamente per il periodo necessario ad adempiere agli obblighi legali. In caso di richiesta di cancellazione dell&apos;account, l&apos;eliminazione di tutti i dati personali collegati (curriculum, lettere generate, cronologia delle ricerche e delle candidature, e ogni altro dato dell&apos;account) è immediata e definitiva, non differita nel tempo — vedi la procedura di cancellazione descritta nei Termini di Servizio.</p>
        </section>

        <section className="space-y-3">
          <h2 className="text-lg font-semibold">7. Diritti dell&apos;Interessato</h2>
          <p className="text-sm leading-relaxed">L&apos;utente ha il diritto di:</p>
          <ul className="text-sm leading-relaxed list-disc pl-5 space-y-1">
            <li>Accedere ai propri dati personali (art. 15 GDPR)</li>
            <li>Richiedere la rettifica di dati inesatti (art. 16 GDPR)</li>
            <li>Richiedere la cancellazione dei dati (art. 17 GDPR)</li>
            <li>Richiedere la limitazione del trattamento (art. 18 GDPR)</li>
            <li>Ricevere i dati in formato strutturato — portabilità (art. 20 GDPR)</li>
            <li>Opporsi al trattamento (art. 21 GDPR)</li>
          </ul>
          <p className="text-sm leading-relaxed">Il diritto di cancellazione può inoltre essere esercitato in autonomia e con effetto immediato dalla sezione Account del proprio profilo, senza necessità di contattare il Titolare — vedi i Termini di Servizio per i dettagli della procedura. Per gli altri diritti elencati sopra, o per qualsiasi domanda: <a href={`mailto:${SUPPORT_EMAIL}`} className="underline">{SUPPORT_EMAIL}</a>. L&apos;utente ha inoltre il diritto di proporre reclamo all&apos;Autorità Garante per la Protezione dei Dati Personali (<a href="https://www.garanteprivacy.it" target="_blank" rel="noopener noreferrer" className="underline">www.garanteprivacy.it</a>).</p>
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
