/**
 * BOZZA — NON PUBBLICATA — richiede revisione di un legale prima di
 * qualunque pubblicazione.
 *
 * Costruita a partire da docs/drafts/termini-di-servizio-draft-abbonamento.tsx
 * (salvata il 2026-07-27 prima del revert dei commit 5907aa7/658d5ba,
 * aggiornata l'2026-08-05 in 8f95049) — quel testo resta corretto ed è
 * preservato invariato per la maggior parte. Questa versione la aggiorna su
 * 3 punti, tutti verificati contro il comportamento REALE del codice in
 * produzione al 2026-09-02, non contro ipotesi:
 *
 * 1. ART. 7.2 (finestra di rimborso) — CAMBIATA rispetto alla bozza
 *    precedente. La bozza precedente calcolava i 14gg dalla REGISTRAZIONE
 *    (inizio trial). Il codice realmente shippato (webhooks/stripe/route.ts,
 *    account/delete/request+confirm/route.ts) calcola i 14gg dal
 *    PRIMO PAGAMENTO (subscriptions.first_payment_at), e la finestra si
 *    rinnova ad ogni nuovo abbonamento (anche una riattivazione dopo una
 *    cancellazione precedente) — vedi commento in
 *    webhooks/stripe/route.ts:82-87. Ho aggiornato il testo per riflettere
 *    QUESTO comportamento, non quello della bozza precedente. Effetto
 *    positivo collaterale: risolve da solo il caso limite "conversione
 *    tardiva" che la bozza precedente segnalava come rischio legale (con
 *    "dal pagamento" nessun utente pagante si trova mai senza una finestra
 *    di recesso, indipendentemente da quando converte).
 *
 * 2. ART. 7.1 (checkbox di consenso a esecuzione immediata) — la bozza
 *    precedente descrive una casella di consenso esplicito da spuntare al
 *    checkout. VERIFICATO navigando la vera pagina di Checkout Stripe in
 *    produzione (modalità test, stessi parametri dell'app reale): quella
 *    casella NON esiste nel checkout attuale — la pagina mostra solo
 *    email, metodo di pagamento e il testo standard di Stripe sul rinnovo
 *    automatico. Il testo sotto descrive ancora il meccanismo (è una scelta
 *    legale, non mia, se serva davvero) ma è marcato esplicitamente come
 *    NON ANCORA IMPLEMENTATO — va deciso con il legale se è necessario, e
 *    se sì va costruito prima di pubblicare questo articolo così com'è.
 *
 * 3. NUOVO ART. 8 (cancellazione dell'account) — non esisteva nella bozza
 *    precedente perché la funzione non era stata ancora costruita. Descrive
 *    la cancellazione account reale (self-service, doppia conferma via
 *    email, cancellazione Stripe immediata, dati eliminati subito).
 *    Inserito DOPO l'Art. 7 (non dentro il 6) apposta: così i riferimenti
 *    "Art. 6 ToS" e "Art. 7.2 ToS" già hardcoded nei commenti del codice
 *    restano corretti senza dover toccare quel codice.
 *
 * Tutto il resto (Art. 1-6, 9-16) è la bozza precedente, INVARIATA nella
 * sostanza — solo rinumerata da 8 in poi per fare spazio al nuovo Art. 8, e
 * con l'email di contatto in 7.2 corretta da albertochioda@gmail.com
 * (personale, bozza pre-2026-08-05) a SUPPORT_EMAIL, coerente con la pulizia
 * già fatta sul resto del sito il 2026-08-07 (commit cedbda6) che questa
 * bozza, vivendo fuori da src/app, non aveva ricevuto.
 *
 * Il testo precedente (versione "1.0-beta", 24 giugno 2026, quella
 * realmente accettata da ogni utente esistente) resta archiviato e
 * invariato in docs/archivio-legale/termini-di-servizio-v1.0-beta-2026-06-24.md
 * — non toccarlo mai.
 */
import { SUPPORT_EMAIL } from "@/lib/support-contact";

export default function TerminiDiServizio() {
  return (
    <main className="min-h-screen bg-white text-gray-900 px-6 py-12">
      <div className="max-w-3xl mx-auto space-y-8">
        <div className="text-center space-y-1">
          <p className="text-xl font-bold tracking-tight">Job Search Bridge</p>
          <h1 className="text-2xl font-bold">Termini e Condizioni di Utilizzo</h1>
          <p className="text-sm text-gray-500">Versione 2.0 — [DATA DA CONFERMARE AL MOMENTO DELLA PUBBLICAZIONE]</p>
        </div>

        <section className="space-y-3">
          <h2 className="text-lg font-semibold">1. Identificazione del Titolare</h2>
          <p className="text-sm leading-relaxed">Il servizio Job Search Bridge (di seguito &quot;Servizio&quot; o &quot;Piattaforma&quot;) è gestito da Alberto Chioda, con sede in Lodi (LO), Italia (di seguito &quot;Titolare&quot;). Per qualsiasi comunicazione: <a href={`mailto:${SUPPORT_EMAIL}`} className="underline">{SUPPORT_EMAIL}</a>.</p>
        </section>

        <section className="space-y-3">
          <h2 className="text-lg font-semibold">2. Oggetto e Natura del Servizio</h2>
          <p className="text-sm leading-relaxed">Job Search Bridge è una piattaforma software in fase di beta testing che assiste i candidati nella ricerca di offerte di lavoro, nell&apos;analisi di compatibilità con il proprio profilo professionale e nell&apos;adattamento del curriculum vitae alle offerte identificate. Il Servizio utilizza tecnologie di intelligenza artificiale di terze parti (Anthropic PBC) per elaborare i dati.</p>
          <p className="text-sm leading-relaxed">Il Servizio è offerto nella versione e con le funzionalità disponibili al momento dell&apos;accesso. Il Titolare si riserva il diritto di introdurre nuove funzionalità, modificare o sospendere temporaneamente il Servizio per finalità di manutenzione, test o miglioramento, con adeguato preavviso quando ragionevolmente possibile.</p>
        </section>

        <section className="space-y-3">
          <h2 className="text-lg font-semibold">3. Accesso al Servizio e Account</h2>
          <p className="text-sm leading-relaxed">Per accedere al Servizio è necessario creare un account fornendo un indirizzo email valido e una password. L&apos;utente è responsabile della riservatezza delle proprie credenziali e di tutte le attività svolte tramite il proprio account. L&apos;utente si impegna a fornire informazioni accurate, complete e aggiornate. Il Titolare si riserva il diritto di sospendere o terminare l&apos;account in caso di violazione dei presenti Termini.</p>
        </section>

        <section className="space-y-3">
          <h2 className="text-lg font-semibold">4. Periodo di Prova Gratuita (Trial)</h2>
          <p className="text-sm leading-relaxed">L&apos;accesso nella fase beta è gratuito per un periodo di prova di 14 (quattordici) giorni dalla data di registrazione. Durante il periodo di prova, l&apos;utente ha accesso a: 3 ricerche di offerte di lavoro, 5 adattamenti del curriculum vitae, 5 lettere di motivazione generate dall&apos;intelligenza artificiale, e a tutti i template CV disponibili.</p>
          <p className="text-sm leading-relaxed">Al termine del periodo di prova, l&apos;Utente può sottoscrivere uno dei piani di abbonamento a pagamento disponibili per continuare ad accedere al Servizio, secondo le modalità descritte all&apos;Art. 5 e seguenti. In assenza di sottoscrizione, l&apos;accesso alle funzionalità a pagamento viene sospeso alla scadenza del periodo di prova. Il Titolare si riserva il diritto di modificare i limiti del piano trial in qualsiasi momento durante la fase beta.</p>
        </section>

        <section className="space-y-3">
          <h2 className="text-lg font-semibold">5. Durata e rinnovo automatico dell&apos;abbonamento</h2>
          <p className="text-sm leading-relaxed">L&apos;Abbonamento a pagamento (piano Individual o Professional) ha durata mensile e si rinnova automaticamente alla scadenza di ciascun periodo, salvo disdetta da parte dell&apos;Utente secondo le modalità descritte all&apos;Art. 6 (&quot;Cancellazione dell&apos;abbonamento&quot;).</p>
          <p className="text-sm leading-relaxed">Al momento della sottoscrizione, l&apos;Utente viene informato in modo chiaro che:</p>
          <ul className="text-sm leading-relaxed list-disc pl-5 space-y-1">
            <li>l&apos;abbonamento si rinnova automaticamente ogni mese;</li>
            <li>l&apos;importo addebitato a ogni rinnovo è quello del piano scelto, salvo eventuali modifiche comunicate secondo l&apos;Art. 9 (&quot;Modifiche al prezzo&quot;);</li>
            <li>l&apos;Utente può disdire in qualsiasi momento, con effetto dal termine del periodo di fatturazione in corso.</li>
          </ul>
        </section>

        <section className="space-y-3">
          <h2 className="text-lg font-semibold">6. Cancellazione dell&apos;abbonamento</h2>
          <p className="text-sm leading-relaxed">L&apos;Utente può disdire l&apos;Abbonamento in qualsiasi momento, in autonomia, dalla sezione Account/Fatturazione della piattaforma.</p>
          <p className="text-sm leading-relaxed">La disdetta ha effetto dal termine del periodo di fatturazione in corso: l&apos;Utente mantiene l&apos;accesso alle funzionalità del piano fino a tale data. Dopo tale data l&apos;account passa automaticamente al piano Trial gratuito (con i relativi limiti d&apos;uso, vedi Art. 4) — l&apos;account e i dati non vengono eliminati né disattivati dalla sola cancellazione dell&apos;abbonamento; per l&apos;eliminazione completa dell&apos;account vedi Art. 8.</p>
          <p className="text-sm leading-relaxed">Non sono previsti rimborsi per la parte di periodo già trascorsa al momento della disdetta, salvo quanto previsto all&apos;Art. 7 (&quot;Diritto di recesso e rimborsi&quot;).</p>
        </section>

        <section className="space-y-3">
          <h2 className="text-lg font-semibold">7. Diritto di recesso e rimborsi</h2>
          <h3 className="text-base font-semibold">7.1 Diritto di recesso (primi 14 giorni)</h3>
          <p className="text-sm leading-relaxed">Ai sensi della normativa a tutela dei consumatori, l&apos;Utente che sottoscrive per la prima volta un Abbonamento a pagamento ha diritto di recedere dal contratto entro 14 (quattordici) giorni dalla data del pagamento, senza fornire alcuna motivazione, ottenendo il rimborso integrale di quanto versato.</p>
          <p className="text-sm leading-relaxed bg-yellow-50 border border-yellow-300 rounded px-3 py-2">
            ⚠️ DA VERIFICARE CON LEGALE — Il paragrafo seguente (checkbox di consenso a esecuzione immediata) descrive un meccanismo standard per i servizi digitali ad esecuzione immediata, ma <strong>non è oggi implementato</strong> nel checkout reale (verificato navigando la pagina Stripe Checkout in produzione il 2026-09-02: mostra solo email, metodo di pagamento e il testo standard di Stripe sul rinnovo — nessuna casella separata di consenso). Va deciso con il legale se, data la politica di rimborso volontaria dell&apos;Art. 7.2 (che di fatto garantisce comunque un rimborso pieno nella stessa finestra, indipendentemente dall&apos;uso), questa casella sia effettivamente necessaria — se sì, va costruita prima di pubblicare questo paragrafo così com&apos;è; se il legale conferma che non serve, il paragrafo va rimosso o riformulato.
          </p>
          <p className="text-sm leading-relaxed">Al momento del checkout, l&apos;Utente è tenuto a esprimere consenso esplicito (tramite apposita casella da selezionare attivamente, non pre-selezionata) con la seguente dichiarazione:</p>
          <p className="text-sm leading-relaxed italic">&quot;Richiedo che l&apos;esecuzione del Servizio abbia inizio immediatamente, anche prima della scadenza del termine di 14 giorni per l&apos;esercizio del diritto di recesso, e sono consapevole che, qualora inizi a utilizzare il Servizio durante tale periodo, perderò il diritto di recesso e al connesso rimborso.&quot;</p>
          <p className="text-sm leading-relaxed">In pratica: se l&apos;Utente utilizza il Servizio (es. avvia una ricerca, genera un CV o una lettera) entro i 14 giorni dal pagamento, il diritto di recesso di legge si considera esercitato tramite consenso a esecuzione immediata e non è previsto rimborso automatico per legge in quel caso specifico. Tuttavia, Job Search Bridge adotta — per ora, come politica commerciale volontaria e non come obbligo di legge — un rimborso integrale su richiesta, per qualunque motivo, entro la stessa finestra di 14 giorni, indipendentemente dall&apos;uso effettivo del Servizio. Vedi Art. 7.2.</p>

          <h3 className="text-base font-semibold">7.2 Politica di rimborso di Job Search Bridge (fase attuale)</h3>
          <p className="text-sm leading-relaxed">Indipendentemente da quanto previsto per legge all&apos;Art. 7.1, Job Search Bridge si impegna volontariamente a:</p>
          <ul className="text-sm leading-relaxed list-disc pl-5 space-y-1">
            <li>Rimborso integrale su richiesta, per qualunque motivo, se richiesto entro 14 (quattordici) giorni dalla data dell&apos;ultimo pagamento (non dalla registrazione né dall&apos;inizio del periodo di prova) — indipendentemente dall&apos;uso effettivo del Servizio in quel periodo.</li>
            <li>Questa finestra di 14 giorni riparte ad ogni nuovo pagamento che dà inizio a un nuovo ciclo di abbonamento (ad esempio una riattivazione dopo una precedente cancellazione): non è legata a un unico evento &quot;primo pagamento in assoluto&quot;, ma al pagamento più recente che ha attivato l&apos;abbonamento attualmente in corso.</li>
            <li>Rinnovi automatici successivi all&apos;interno dello stesso ciclo di abbonamento: nessun rimborso automatico per periodi parziali o non utilizzati. La cancellazione evita futuri addebiti ma non dà diritto al rimborso del periodo già in corso, salvo quanto sopra per un pagamento avvenuto negli ultimi 14 giorni.</li>
            <li>Addebiti errati o doppi addebiti: rimborso integrale sempre garantito, indipendentemente dalla finestra di 14 giorni sopra descritta, verificato caso per caso contattando <a href={`mailto:${SUPPORT_EMAIL}`} className="underline">{SUPPORT_EMAIL}</a>.</li>
            <li>La richiesta di eliminazione completa dell&apos;account (Art. 8) applica automaticamente questa stessa politica di rimborso alla cancellazione immediata dell&apos;abbonamento eventualmente attivo.</li>
          </ul>
          <p className="text-sm leading-relaxed">Questa politica potrà essere rivista in futuro; eventuali modifiche verranno comunicate con adeguato preavviso e non si applicheranno retroattivamente ad abbonamenti già in corso al momento della modifica.</p>
        </section>

        <section className="space-y-3">
          <h2 className="text-lg font-semibold">8. Cancellazione dell&apos;account</h2>
          <p className="text-sm leading-relaxed">Oltre alla cancellazione del solo abbonamento (Art. 6), l&apos;Utente può richiedere in qualsiasi momento l&apos;eliminazione definitiva e completa del proprio account e di tutti i dati ad esso collegati (curriculum, lettere generate, cronologia delle ricerche e delle candidature), in autonomia dalla sezione Account del proprio profilo.</p>
          <p className="text-sm leading-relaxed">La richiesta richiede una doppia conferma: dopo aver digitato la propria email a conferma dell&apos;intenzione, l&apos;Utente riceve un&apos;email con un link di conferma valido per un&apos;ora — l&apos;eliminazione avviene solo dopo il click su tale link, e non prima.</p>
          <p className="text-sm leading-relaxed">Al momento della conferma:</p>
          <ul className="text-sm leading-relaxed list-disc pl-5 space-y-1">
            <li>un eventuale abbonamento attivo viene cancellato immediatamente (non a fine periodo, a differenza dell&apos;Art. 6), con applicazione della politica di rimborso dell&apos;Art. 7.2 se il pagamento più recente rientra nella finestra dei 14 giorni;</li>
            <li>tutti i dati dell&apos;account (CV, lettere generate, cronologia ricerche e candidature, e ogni altro dato personale collegato) vengono eliminati in modo permanente e irreversibile;</li>
            <li>l&apos;account stesso e le credenziali di accesso cessano di esistere: non è possibile effettuare nuovamente l&apos;accesso con le stesse credenziali, né recuperare i dati eliminati.</li>
          </ul>
          <p className="text-sm leading-relaxed">L&apos;eliminazione è immediata e non richiede attesa: eventuali riferimenti altrove nei documenti legali del Titolare a un termine massimo per l&apos;eliminazione dei dati (es. l&apos;Informativa Privacy) si intendono come limite massimo, non come tempistica effettiva — l&apos;eliminazione tramite questa funzione avviene sempre nell&apos;immediato.</p>
        </section>

        <section className="space-y-3">
          <h2 className="text-lg font-semibold">9. Modifiche al prezzo e alle condizioni dell&apos;abbonamento</h2>
          <p className="text-sm leading-relaxed">Job Search Bridge si riserva il diritto di modificare, in futuro, il prezzo o le condizioni dei piani di abbonamento, per una o più delle seguenti ragioni:</p>
          <ul className="text-sm leading-relaxed list-disc pl-5 space-y-1">
            <li>variazione dei costi di fornitura del Servizio (inclusi, a titolo esemplificativo, costi di infrastruttura tecnologica e servizi di intelligenza artificiale di terze parti);</li>
            <li>introduzione di nuove funzionalità o significativa evoluzione del Servizio;</li>
            <li>adeguamenti richiesti da modifiche normative o fiscali;</li>
            <li>allineamento a condizioni di mercato.</li>
          </ul>
          <p className="text-sm leading-relaxed">Qualsiasi modifica al prezzo sarà comunicata all&apos;Utente con un preavviso di almeno 30 giorni rispetto alla data di decorrenza, tramite email all&apos;indirizzo associato all&apos;account. La modifica avrà effetto a partire dal primo rinnovo successivo alla comunicazione.</p>
          <p className="text-sm leading-relaxed">L&apos;Utente che non intenda accettare la modifica può disdire l&apos;Abbonamento prima della data di decorrenza, senza penali, secondo le modalità di cui all&apos;Art. 6.</p>
        </section>

        <section className="space-y-3">
          <h2 className="text-lg font-semibold">10. Limitazioni d&apos;Uso</h2>
          <p className="text-sm leading-relaxed">L&apos;utente si impegna a utilizzare il Servizio esclusivamente per:</p>
          <ul className="text-sm leading-relaxed list-disc pl-5 space-y-1">
            <li>Ricerca personale di opportunità lavorative</li>
            <li>Analisi di compatibilità del proprio profilo con offerte di lavoro</li>
            <li>Adattamento del proprio curriculum vitae ad offerte specifiche</li>
          </ul>
          <p className="text-sm leading-relaxed">È espressamente vietato:</p>
          <ul className="text-sm leading-relaxed list-disc pl-5 space-y-1">
            <li>Utilizzare il Servizio per conto di terzi senza autorizzazione scritta del Titolare</li>
            <li>Effettuare attività di scraping, reverse engineering o analisi del codice sorgente</li>
            <li>Tentare di aggirare i limiti di utilizzo o le misure di sicurezza</li>
            <li>Utilizzare il Servizio per scopi illegali o contrari all&apos;ordine pubblico</li>
            <li>Condividere le credenziali di accesso con terzi</li>
          </ul>
        </section>

        <section className="space-y-3">
          <h2 className="text-lg font-semibold">11. Proprietà Intellettuale</h2>
          <p className="text-sm leading-relaxed">Tutti i diritti di proprietà intellettuale relativi al Servizio, inclusi ma non limitati a codice sorgente, algoritmi, interfaccia grafica, loghi e metodologie, sono di esclusiva proprietà del Titolare o dei suoi licenziatari. I feedback, suggerimenti e segnalazioni di bug forniti durante il beta test diventano di proprietà del Titolare.</p>
        </section>

        <section className="space-y-3">
          <h2 className="text-lg font-semibold">12. Esclusione di Garanzie</h2>
          <p className="text-sm leading-relaxed">Il Servizio è fornito &quot;così com&apos;è&quot; e &quot;come disponibile&quot;, senza garanzie di alcun tipo. Essendo in fase beta, il Servizio potrebbe contenere bug, errori o interruzioni. Il Titolare non garantisce il raggiungimento di risultati specifici nella ricerca di lavoro.</p>
        </section>

        <section className="space-y-3">
          <h2 className="text-lg font-semibold">13. Limitazione di Responsabilità</h2>
          <p className="text-sm leading-relaxed">Nei limiti consentiti dalla legge applicabile, il Titolare non sarà responsabile per danni diretti, indiretti, incidentali, speciali o consequenziali derivanti dall&apos;utilizzo o dall&apos;impossibilità di utilizzo del Servizio.</p>
        </section>

        <section className="space-y-3">
          <h2 className="text-lg font-semibold">14. Modifica dei Termini</h2>
          <p className="text-sm leading-relaxed">Il Titolare si riserva il diritto di modificare i presenti Termini in qualsiasi momento. Le modifiche saranno comunicate via email. L&apos;utilizzo continuato del Servizio costituisce accettazione delle modifiche.</p>
        </section>

        <section className="space-y-3">
          <h2 className="text-lg font-semibold">15. Legge Applicabile e Foro Competente</h2>
          <p className="text-sm leading-relaxed">I presenti Termini sono regolati dalla legge italiana. Per qualsiasi controversia sarà competente in via esclusiva il Foro di Lodi.</p>
        </section>

        <section className="space-y-3">
          <h2 className="text-lg font-semibold">16. Contatti</h2>
          <p className="text-sm leading-relaxed"><a href={`mailto:${SUPPORT_EMAIL}`} className="underline">{SUPPORT_EMAIL}</a></p>
        </section>
      </div>
    </main>
  );
}
