/**
 * PUBBLICATO il 7 settembre 2026 (versione "2.0-2026-09-07", vedi
 * src/lib/terms-version.ts, stesso numero di versione del ToS — un'unica
 * versione copre entrambi i documenti nel flusso di ri-accettazione) in
 * src/app/[locale]/privacy-policy/page.tsx SENZA revisione legale
 * formale — stessa scelta consapevole del Titolare già presa per il ToS
 * v2 (decisione del 2026-09-04, riconfermata il 2026-09-07): la revisione
 * professionale è rimandata a dopo i primi incassi.
 *
 * I due placeholder "DA CONFERMARE MANUALMENTE" dell'Art. 5 sono stati
 * risolti alla pubblicazione: regione Supabase confermata manualmente da
 * Alberto nelle impostazioni del progetto (eu-west-1, Irlanda) e riportata
 * nel testo pubblicato; per Vercel nessun valore è stato confermato — la
 * frase è stata generalizzata nel testo pubblicato invece di affermare una
 * regione non verificata.
 *
 * Salvata prima del revert del commit 658d5ba (Privacy Policy). Base
 * originale: aggiunta Stripe come sub-responsabile pagamenti (dati carta,
 * finalità fatturazione, trasferimento USA) — segnalata esplicitamente
 * come "meno rifinita" della bozza ToS quando creata, e non aveva mai
 * ricevuto una verifica sistematica contro il codice reale fino ad oggi
 * (2026-09-07).
 *
 * Verifica completa 2026-09-07, stesso rigore già applicato alla bozza
 * ToS v2 nei giorni precedenti — 12 discrepanze trovate, tutte corrette
 * in questo giro (nessuna richiedeva giudizio legale, solo accuratezza
 * fattuale su cosa viene raccolto, per cosa, e chi lo tratta):
 *
 * 1. ART. 2.1 (dati di registrazione) — aggiunto "nome completo",
 *    raccolto da register-form.tsx (campo full_name) e salvato in
 *    profiles.full_name, prima assente dall'elenco pur essendo il primo
 *    campo del form di registrazione.
 *
 * 2. ART. 2.1 (profilo professionale) — precisato che oltre al testo
 *    estratto del CV viene conservato anche il file originale (Supabase
 *    Storage, bucket cvs). Aggiunta una nuova voce per i contenuti
 *    generati dall'IA a partire dal profilo (CV adattati per singola
 *    offerta — tabella adapted_cvs — e lettere di motivazione generate —
 *    tabella generated_letters), prima non menzionati come categoria di
 *    dati a sé, pur essendo dati personali derivati.
 *
 * 3. ART. 2.1 (dati di configurazione) — elenco parametri di ricerca
 *    completato: mancavano radius_km, sectors, contract_types, languages,
 *    work_schedule, country — tutte colonne reali di search_configs non
 *    nominate nella versione precedente.
 *
 * 4. ART. 2.1 (nuova voce) — aggiunte "Candidature" (tabella
 *    applications: offerta salvata, stato, note personali dell'utente) e
 *    "Comunicazioni con il Titolare" (cronologia chat di supporto —
 *    support_chat_log —, segnalazioni bug/idee — support_reports —,
 *    motivo di cancellazione abbonamento — cancellation_feedback —,
 *    consenso marketing — profiles.marketing_consent). Nessuna di queste
 *    categorie era menzionata, pur essendo tutte tabelle reali con dati
 *    personali riconducibili a un utente.
 *
 * 5. ART. 2.2 (indirizzo IP) — corretta un'imprecisione: verificato
 *    (nessun uso di x-forwarded-for o simili in tutto src/) che
 *    l'applicazione non raccoglie né salva mai l'IP in alcuna tabella.
 *    Il testo precedente lasciava intendere una raccolta attiva
 *    inesistente — ora chiarito che un IP può comparire solo
 *    incidentalmente nei log infrastrutturali di Vercel/Supabase, fuori
 *    dal controllo diretto del codice applicativo.
 *
 * 6. ART. 2.2 (Vercel Analytics) — aggiunta come voce distinta, dati
 *    raccolti e finalità: mancava del tutto. @vercel/analytics è attivo
 *    in produzione (implementato pochi giorni fa) — traccia pageview più
 *    7 eventi custom lungo il funnel (signup_completato,
 *    onboarding_completato, prima_ricerca_avviata, risultati_visualizzati,
 *    paywall_visualizzato, checkout_iniziato, pagamento_completato).
 *    Precisato che i parametri degli eventi non includono mai dati
 *    identificativi (verificato nel codice: solo tier/conteggi/etichette).
 *
 * 7. ART. 3 (finalità) — aggiunta "Assistenza clienti" come finalità
 *    esplicita: prima implicitamente coperta da "erogazione del
 *    Servizio", ma coinvolge un trattamento IA distinto (Art. 4) che
 *    merita una finalità propria.
 *
 * 8. ART. 4 (trattamento IA) — riscritto per riflettere l'uso reale
 *    completo, verificato nel codice. Il testo precedente menzionava solo
 *    "elaborare il CV e generare contenuti adattati". Mancava di gran
 *    lunga l'uso più frequente: lo SCORING di compatibilità, eseguito da
 *    Claude per OGNI offerta trovata (verificato in scorer.py del worker
 *    Python) — un'elaborazione automatica continua, non on-demand come
 *    l'adattamento CV. Mancavano anche la generazione delle lettere di
 *    motivazione (che comporta una ricerca web condotta dall'IA
 *    sull'azienda destinataria — verificato in generate/cover-letter/
 *    route.ts, tool web_search_20250305) e l'assistente di supporto
 *    (Claude Haiku, elabora il testo scritto dall'utente in chat —
 *    verificato in support-chat/route.ts).
 *
 * 9. ART. 5 (sub-responsabili) — aggiunti Render.com, Upstash e Resend,
 *    verificati come reali destinatari di dati personali e prima assenti
 *    dall'elenco:
 *    - Render.com: ospita il worker Python (job-sb-worker), che riceve
 *      testo del CV, URL firmati del CV, user_id e contenuti generati via
 *      chiamate HTTP dirette (verificato in adapt/cv/route.ts) — è
 *      l'infrastruttura che fa concretamente scoring e adattamento CV.
 *    - Upstash: la coda Redis tra l'app e il worker trasporta cv_text,
 *      user_id e l'intera configurazione di ricerca (verificato in
 *      search/start/route.ts).
 *    - Resend: invia le email transazionali, tratta quindi l'indirizzo
 *      email di ogni utente (verificato in lib/email.ts e in ogni route
 *      che lo usa).
 *    IPRoyal (proxy usato dal worker per lo scraping LinkedIn) è stato
 *    verificato e correttamente ESCLUSO: tratta solo richieste in uscita
 *    verso annunci pubblici, mai dati personali di un utente
 *    dell'applicazione (verificato in proxy_config.py del worker).
 *
 * 10. ART. 5 (regione Supabase/Vercel) — la dicitura "Supabase (UE)" e
 *     l'assenza di una regione esplicita per le funzioni Vercel non sono
 *     verificabili dal codice applicativo (nessuna config region trovata
 *     in vercel.json/next.config, nessun modo di leggere la region del
 *     progetto Supabase dalle chiavi API) — lasciata una nota "DA
 *     CONFERMARE MANUALMENTE" invece di affermare un fatto non verificato,
 *     stesso principio già seguito per punti equivalenti nella bozza ToS.
 *
 * 11. ART. 6 (conservazione dati) — stessa correzione già fatta per il
 *     ToS Art. 8: il testo diceva "i dati dell'account vengono eliminati
 *     entro 30 giorni dalla richiesta di cancellazione" — verificato
 *     (stesso codice già controllato per il ToS, account/delete/confirm/
 *     route.ts) che l'eliminazione è immediata e sincrona nella stessa
 *     richiesta, nessuna coda o job a 30 giorni.
 *
 * 12. ART. 7 (diritti dell'interessato) — aggiunta una frase che rimanda
 *     al flusso di cancellazione self-service reale già esistente
 *     in-app (descritto nel dettaglio nel ToS Art. 8), prima assente:
 *     il diritto di cancellazione era descritto solo come richiesta via
 *     email, quando esiste già un percorso autonomo e immediato dal
 *     profilo.
 *
 * Da ripubblicare in src/app/[locale]/privacy-policy/page.tsx quando sarà
 * pronto il flusso di ri-accettazione basato su terms_version (stesso
 * meccanismo già predisposto per il ToS — vedi src/lib/terms-version.ts).
 */
import { SUPPORT_EMAIL } from "@/lib/support-contact";

export default function PrivacyPolicy() {
  return (
    <main className="min-h-screen bg-white text-gray-900 px-6 py-12">
      <div className="max-w-3xl mx-auto space-y-8">
        <div className="text-center space-y-1">
          <p className="text-xl font-bold tracking-tight">Job Search Bridge</p>
          <h1 className="text-2xl font-bold">Informativa sul Trattamento dei Dati Personali</h1>
          <p className="text-sm text-gray-500">ai sensi dell&apos;art. 13 del Regolamento UE 2016/679 (GDPR) — 24 giugno 2026</p>
        </div>

        <section className="space-y-3">
          <h2 className="text-lg font-semibold">1. Titolare del Trattamento</h2>
          <p className="text-sm leading-relaxed">Titolare del trattamento è Alberto Chioda, con sede in Lodi (LO), Italia. Contatto: <a href={`mailto:${SUPPORT_EMAIL}`} className="underline">{SUPPORT_EMAIL}</a>.</p>
        </section>

        <section className="space-y-3">
          <h2 className="text-lg font-semibold">2. Dati Personali Raccolti</h2>
          <p className="text-sm font-medium">2.1 Dati forniti direttamente dall'utente</p>
          <ul className="text-sm leading-relaxed list-disc pl-5 space-y-1">
            <li>Dati di registrazione: nome completo, indirizzo email, password (in forma criptata)</li>
            <li>Dati del profilo professionale: curriculum vitae (testo estratto e file originale), esperienze lavorative, competenze, formazione</li>
            <li>Contenuti generati dall'intelligenza artificiale a partire dal profilo: curriculum vitae adattati alle singole offerte, lettere di motivazione, breve biografia facoltativa usata per personalizzare le lettere</li>
            <li>Dati di configurazione della ricerca: ruoli cercati, città e raggio di ricerca, settori, RAL minima desiderata, modalità di lavoro preferita, regime orario, tipologia contrattuale, lingue e paese di riferimento</li>
            <li>Foto profilo (opzionale)</li>
            <li>Candidature: offerte salvate, stato della candidatura, eventuali note personali inserite dall'utente</li>
            <li>Comunicazioni con il Titolare: messaggi scambiati con l'assistente di supporto, segnalazioni di problemi o idee, motivo indicato in caso di cancellazione dell'abbonamento, consenso facoltativo a ricevere comunicazioni promozionali</li>
            <li>Dati di pagamento: per gli abbonamenti a pagamento, i dati della carta e delle transazioni sono raccolti ed elaborati direttamente da Stripe Inc., nostro fornitore di servizi di pagamento — Job Search Bridge non memorizza né ha accesso ai dati completi della carta</li>
          </ul>
          <p className="text-sm font-medium">2.2 Dati raccolti automaticamente</p>
          <ul className="text-sm leading-relaxed list-disc pl-5 space-y-1">
            <li>Dati di utilizzo: numero di ricerche effettuate, CV adattati e lettere generate, offerte visualizzate</li>
            <li>Dati di analisi statistica: tramite Vercel Analytics raccogliamo le visualizzazioni di pagina e alcuni eventi lungo il percorso dell'utente (es. registrazione completata, onboarding completato, prima ricerca avviata, risultati visualizzati, checkout avviato) — i parametri di questi eventi non includono mai email, nome o altri dati identificativi, solo etichette non personali come il piano scelto o un conteggio</li>
            <li>Dati tecnici: tipo di browser, sistema operativo, date e orari di accesso. L'indirizzo IP non viene raccolto né conservato dall'applicazione stessa; può comparire incidentalmente nei log tecnici standard dei fornitori di infrastruttura (Vercel, Supabase), secondo le rispettive policy di questi ultimi</li>
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
            <li>Assistenza clienti tramite l'assistente virtuale e gestione di segnalazioni e richieste di supporto (base giuridica: esecuzione del contratto / legittimo interesse)</li>
            <li>Miglioramento del Servizio e analisi statistica in forma aggregata e anonima (base giuridica: legittimo interesse — art. 6.1.f GDPR)</li>
            <li>Adempimento di obblighi legali (base giuridica: obbligo legale — art. 6.1.c GDPR)</li>
          </ul>
        </section>

        <section className="space-y-3">
          <h2 className="text-lg font-semibold">4. Trattamento tramite Intelligenza Artificiale</h2>
          <p className="text-sm leading-relaxed">Il Servizio utilizza le API di Anthropic PBC (Claude AI) in più punti del suo funzionamento: per valutare automaticamente la compatibilità tra il profilo dell'utente e ciascuna offerta di lavoro individuata (un calcolo eseguito per ogni singola offerta trovata), per adattare il curriculum vitae alle offerte selezionate, per generare lettere di motivazione — operazione che può comportare una ricerca informativa sul web relativa all'azienda destinataria, condotta autonomamente dall'intelligenza artificiale — e per rispondere alle richieste rivolte all'assistente virtuale di supporto. I dati trasmessi ad Anthropic sono trattati nel rispetto dei termini di servizio di Anthropic. I dati non vengono utilizzati da Anthropic per addestrare i propri modelli nell'ambito dei contratti API business.</p>
        </section>

        <section className="space-y-3">
          <h2 className="text-lg font-semibold">5. Trasferimento dei Dati</h2>
          <p className="text-sm leading-relaxed">I dati sono trattati, per le finalità indicate, dai seguenti fornitori terzi (responsabili del trattamento, salvo Stripe che agisce come titolare autonomo per le finalità di pagamento):</p>
          <ul className="text-sm leading-relaxed list-disc pl-5 space-y-1">
            <li>Supabase — database e autenticazione [DA CONFERMARE MANUALMENTE: regione del progetto]</li>
            <li>Vercel — hosting dell'applicazione web [DA CONFERMARE MANUALMENTE: regione delle funzioni server]</li>
            <li>Render.com (USA) — ospita il componente che effettua la ricerca delle offerte, calcola il punteggio di compatibilità e adatta il curriculum vitae; riceve a questo scopo il testo del curriculum e i contenuti generati</li>
            <li>Upstash (USA) — coda dati temporanea tra i componenti del Servizio, usata per trasmettere il testo del curriculum, l'identificativo dell'account e i parametri di ricerca durante l'elaborazione di una ricerca</li>
            <li>Anthropic PBC (USA) — elaborazione tramite intelligenza artificiale, vedi Art. 4</li>
            <li>Stripe Inc. (USA) — gestione dei pagamenti, vedi Art. 2.1</li>
            <li>Resend (USA) — invio delle email transazionali relative all'account (conferme, notifiche, comunicazioni di servizio)</li>
          </ul>
          <p className="text-sm leading-relaxed">Il trasferimento di dati verso paesi extra-UE (in particolare Stati Uniti) è garantito da adeguate garanzie contrattuali previste dai rispettivi fornitori (Standard Contractual Clauses).</p>
        </section>

        <section className="space-y-3">
          <h2 className="text-lg font-semibold">6. Conservazione dei Dati</h2>
          <p className="text-sm leading-relaxed">I dati sono conservati per tutta la durata del rapporto contrattuale e successivamente per il periodo necessario ad adempiere agli obblighi legali. In caso di richiesta di cancellazione dell'account, l'eliminazione di tutti i dati personali collegati (curriculum, lettere generate, cronologia delle ricerche e delle candidature, e ogni altro dato dell'account) è immediata e definitiva, non differita nel tempo — vedi la procedura di cancellazione descritta nei Termini di Servizio.</p>
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
          <p className="text-sm leading-relaxed">Il diritto di cancellazione può inoltre essere esercitato in autonomia e con effetto immediato dalla sezione Account del proprio profilo, senza necessità di contattare il Titolare — vedi i Termini di Servizio per i dettagli della procedura. Per gli altri diritti elencati sopra, o per qualsiasi domanda: <a href={`mailto:${SUPPORT_EMAIL}`} className="underline">{SUPPORT_EMAIL}</a>. L'utente ha inoltre il diritto di proporre reclamo all'Autorità Garante per la Protezione dei Dati Personali (<a href="https://www.garanteprivacy.it" target="_blank" rel="noopener noreferrer" className="underline">www.garanteprivacy.it</a>).</p>
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
