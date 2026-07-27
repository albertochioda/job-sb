/**
 * BOZZA — NON PUBBLICATA
 * Salvata prima del revert dei commit 5907aa7 (ToS) e 658d5ba (Privacy Policy).
 * Contiene: integrazione clausole abbonamento (Art. 5-8: rinnovo, cancellazione,
 * recesso, rimborsi, modifiche prezzo) + fix dei 2 conflitti Art. 2 e Art. 4.
 * Da ripubblicare in src/app/[locale]/termini-di-servizio/page.tsx quando sarà
 * pronto il flusso di ri-accettazione basato su terms_version.
 */
export default function TerminiDiServizio() {
  return (
    <main className="min-h-screen bg-white text-gray-900 px-6 py-12">
      <div className="max-w-3xl mx-auto space-y-8">
        <div className="text-center space-y-1">
          <p className="text-xl font-bold tracking-tight">Job SB</p>
          <h1 className="text-2xl font-bold">Termini e Condizioni di Utilizzo</h1>
          <p className="text-sm text-gray-500">Versione Beta — 24 giugno 2026</p>
        </div>

        <section className="space-y-3">
          <h2 className="text-lg font-semibold">1. Identificazione del Titolare</h2>
          <p className="text-sm leading-relaxed">Il servizio Job SB (di seguito "Servizio" o "Piattaforma") è gestito da Alberto Chioda, con sede in Lodi (LO), Italia (di seguito "Titolare"). Per qualsiasi comunicazione: <a href="mailto:albertochioda@gmail.com" className="underline">albertochioda@gmail.com</a>.</p>
        </section>

        <section className="space-y-3">
          <h2 className="text-lg font-semibold">2. Oggetto e Natura del Servizio</h2>
          <p className="text-sm leading-relaxed">Job SB è una piattaforma software in fase di beta testing che assiste i candidati nella ricerca di offerte di lavoro, nell'analisi di compatibilità con il proprio profilo professionale e nell'adattamento del curriculum vitae alle offerte identificate. Il Servizio utilizza tecnologie di intelligenza artificiale di terze parti (Anthropic PBC) per elaborare i dati.</p>
          <p className="text-sm leading-relaxed">Il Servizio è offerto nella versione e con le funzionalità disponibili al momento dell'accesso. Il Titolare si riserva il diritto di introdurre nuove funzionalità, modificare o sospendere temporaneamente il Servizio per finalità di manutenzione, test o miglioramento, con adeguato preavviso quando ragionevolmente possibile.</p>
        </section>

        <section className="space-y-3">
          <h2 className="text-lg font-semibold">3. Accesso al Servizio e Account</h2>
          <p className="text-sm leading-relaxed">Per accedere al Servizio è necessario creare un account fornendo un indirizzo email valido e una password. L'utente è responsabile della riservatezza delle proprie credenziali e di tutte le attività svolte tramite il proprio account. L'utente si impegna a fornire informazioni accurate, complete e aggiornate. Il Titolare si riserva il diritto di sospendere o terminare l'account in caso di violazione dei presenti Termini.</p>
        </section>

        <section className="space-y-3">
          <h2 className="text-lg font-semibold">4. Periodo di Prova Gratuita (Trial)</h2>
          <p className="text-sm leading-relaxed">L'accesso nella fase beta è gratuito per un periodo di prova di 14 (quattordici) giorni dalla data di registrazione. Durante il periodo di prova, l'utente ha accesso alle funzionalità del piano Professional, inclusi:</p>
          <ul className="text-sm leading-relaxed list-disc pl-5 space-y-1">
            <li>20 ricerche di offerte di lavoro al mese</li>
            <li>30 adattamenti del curriculum vitae al mese</li>
            <li>Accesso a tutti i template CV disponibili</li>
          </ul>
          <p className="text-sm leading-relaxed">Al termine del periodo di prova, l'Utente può sottoscrivere uno dei piani di abbonamento a pagamento disponibili per continuare ad accedere al Servizio, secondo le modalità descritte all'Art. 5 e seguenti. In assenza di sottoscrizione, l'accesso alle funzionalità a pagamento viene sospeso alla scadenza del periodo di prova. Il Titolare si riserva il diritto di modificare i limiti del piano trial in qualsiasi momento durante la fase beta.</p>
        </section>

        <section className="space-y-3">
          <h2 className="text-lg font-semibold">5. Durata e rinnovo automatico dell'abbonamento</h2>
          <p className="text-sm leading-relaxed">L'Abbonamento a pagamento (piano Individual o Professional) ha durata mensile e si rinnova automaticamente alla scadenza di ciascun periodo, salvo disdetta da parte dell'Utente secondo le modalità descritte all'Art. 6 ("Cancellazione").</p>
          <p className="text-sm leading-relaxed">Al momento della sottoscrizione, l'Utente viene informato in modo chiaro che:</p>
          <ul className="text-sm leading-relaxed list-disc pl-5 space-y-1">
            <li>l'abbonamento si rinnova automaticamente ogni mese;</li>
            <li>l'importo addebitato a ogni rinnovo è quello del piano scelto, salvo eventuali modifiche comunicate secondo l'Art. 8 ("Modifiche al prezzo");</li>
            <li>l'Utente può disdire in qualsiasi momento, con effetto dal termine del periodo di fatturazione in corso.</li>
          </ul>
        </section>

        <section className="space-y-3">
          <h2 className="text-lg font-semibold">6. Cancellazione</h2>
          <p className="text-sm leading-relaxed">L'Utente può disdire l'Abbonamento in qualsiasi momento, in autonomia, dalla sezione Account/Fatturazione della piattaforma (gestita tramite Stripe Customer Portal).</p>
          <p className="text-sm leading-relaxed">La disdetta ha effetto dal termine del periodo di fatturazione in corso: l'Utente mantiene l'accesso alle funzionalità del piano fino a tale data, dopo la quale l'account passa automaticamente al piano Trial (se il periodo di prova non è già stato utilizzato) o viene disattivato.</p>
          <p className="text-sm leading-relaxed">Non sono previsti rimborsi per la parte di periodo già trascorsa al momento della disdetta, salvo quanto previsto all'Art. 7 ("Diritto di recesso e rimborsi").</p>
        </section>

        <section className="space-y-3">
          <h2 className="text-lg font-semibold">7. Diritto di recesso e rimborsi</h2>
          <h3 className="text-base font-semibold">7.1 Diritto di recesso (primi 14 giorni)</h3>
          <p className="text-sm leading-relaxed">Ai sensi della normativa a tutela dei consumatori, l'Utente che sottoscrive per la prima volta un Abbonamento a pagamento ha diritto di recedere dal contratto entro 14 (quattordici) giorni dalla data del primo pagamento, senza fornire alcuna motivazione, ottenendo il rimborso integrale di quanto versato.</p>
          <p className="text-sm leading-relaxed">Al momento del checkout, l'Utente è tenuto a esprimere consenso esplicito (tramite apposita casella da selezionare attivamente, non pre-selezionata) con la seguente dichiarazione:</p>
          <p className="text-sm leading-relaxed italic">"Richiedo che l'esecuzione del Servizio abbia inizio immediatamente, anche prima della scadenza del termine di 14 giorni per l'esercizio del diritto di recesso, e sono consapevole che, qualora inizi a utilizzare il Servizio durante tale periodo, perderò il diritto di recesso e al connesso rimborso."</p>
          <p className="text-sm leading-relaxed">In assenza di tale consenso, il Servizio non viene attivato prima dello scadere dei 14 giorni.</p>
          <p className="text-sm leading-relaxed">In pratica: se l'Utente utilizza il Servizio (es. avvia una ricerca, genera un CV o una lettera) entro i 14 giorni dal primo pagamento, il diritto di recesso si considera esercitato tramite consenso a esecuzione immediata e non è previsto rimborso automatico per legge. Tuttavia, Job SB adotta — per ora, come politica commerciale volontaria e non come obbligo di legge — un rimborso integrale su richiesta, per qualunque motivo, entro 14 giorni dal primo pagamento, indipendentemente dall'uso effettivo del Servizio. Vedi Art. 7.2.</p>

          <h3 className="text-base font-semibold">7.2 Politica di rimborso di Job SB (fase attuale)</h3>
          <p className="text-sm leading-relaxed">Indipendentemente da quanto previsto per legge all'Art. 7.1, Job SB si impegna volontariamente a:</p>
          <ul className="text-sm leading-relaxed list-disc pl-5 space-y-1">
            <li>Primo pagamento: rimborso integrale su richiesta, entro 14 giorni dalla data del primo addebito, qualunque sia il motivo, anche in caso di utilizzo del Servizio.</li>
            <li>Rinnovi successivi: nessun rimborso automatico per periodi parziali o non utilizzati. La cancellazione evita futuri addebiti ma non dà diritto al rimborso del periodo già in corso.</li>
            <li>Addebiti errati o non autorizzati: rimborso integrale, verificato caso per caso, contattando <a href="mailto:albertochioda@gmail.com" className="underline">albertochioda@gmail.com</a>.</li>
          </ul>
          <p className="text-sm leading-relaxed">Questa politica potrà essere rivista in futuro; eventuali modifiche verranno comunicate con adeguato preavviso e non si applicheranno retroattivamente ad abbonamenti già in corso al momento della modifica.</p>
        </section>

        <section className="space-y-3">
          <h2 className="text-lg font-semibold">8. Modifiche al prezzo e alle condizioni dell'abbonamento</h2>
          <p className="text-sm leading-relaxed">Job SB si riserva il diritto di modificare, in futuro, il prezzo o le condizioni dei piani di abbonamento, per una o più delle seguenti ragioni:</p>
          <ul className="text-sm leading-relaxed list-disc pl-5 space-y-1">
            <li>variazione dei costi di fornitura del Servizio (inclusi, a titolo esemplificativo, costi di infrastruttura tecnologica e servizi di intelligenza artificiale di terze parti);</li>
            <li>introduzione di nuove funzionalità o significativa evoluzione del Servizio;</li>
            <li>adeguamenti richiesti da modifiche normative o fiscali;</li>
            <li>allineamento a condizioni di mercato.</li>
          </ul>
          <p className="text-sm leading-relaxed">Qualsiasi modifica al prezzo sarà comunicata all'Utente con un preavviso di almeno 30 giorni rispetto alla data di decorrenza, tramite email all'indirizzo associato all'account. La modifica avrà effetto a partire dal primo rinnovo successivo alla comunicazione.</p>
          <p className="text-sm leading-relaxed">L'Utente che non intenda accettare la modifica può disdire l'Abbonamento prima della data di decorrenza, senza penali, secondo le modalità di cui all'Art. 6.</p>
        </section>

        <section className="space-y-3">
          <h2 className="text-lg font-semibold">9. Limitazioni d'Uso</h2>
          <p className="text-sm leading-relaxed">L'utente si impegna a utilizzare il Servizio esclusivamente per:</p>
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
            <li>Utilizzare il Servizio per scopi illegali o contrari all'ordine pubblico</li>
            <li>Condividere le credenziali di accesso con terzi</li>
          </ul>
        </section>

        <section className="space-y-3">
          <h2 className="text-lg font-semibold">10. Proprietà Intellettuale</h2>
          <p className="text-sm leading-relaxed">Tutti i diritti di proprietà intellettuale relativi al Servizio, inclusi ma non limitati a codice sorgente, algoritmi, interfaccia grafica, loghi e metodologie, sono di esclusiva proprietà del Titolare o dei suoi licenziatari. I feedback, suggerimenti e segnalazioni di bug forniti durante il beta test diventano di proprietà del Titolare.</p>
        </section>

        <section className="space-y-3">
          <h2 className="text-lg font-semibold">11. Esclusione di Garanzie</h2>
          <p className="text-sm leading-relaxed">Il Servizio è fornito "così com'è" e "come disponibile", senza garanzie di alcun tipo. Essendo in fase beta, il Servizio potrebbe contenere bug, errori o interruzioni. Il Titolare non garantisce il raggiungimento di risultati specifici nella ricerca di lavoro.</p>
        </section>

        <section className="space-y-3">
          <h2 className="text-lg font-semibold">12. Limitazione di Responsabilità</h2>
          <p className="text-sm leading-relaxed">Nei limiti consentiti dalla legge applicabile, il Titolare non sarà responsabile per danni diretti, indiretti, incidentali, speciali o consequenziali derivanti dall'utilizzo o dall'impossibilità di utilizzo del Servizio.</p>
        </section>

        <section className="space-y-3">
          <h2 className="text-lg font-semibold">13. Modifica dei Termini</h2>
          <p className="text-sm leading-relaxed">Il Titolare si riserva il diritto di modificare i presenti Termini in qualsiasi momento. Le modifiche saranno comunicate via email. L'utilizzo continuato del Servizio costituisce accettazione delle modifiche.</p>
        </section>

        <section className="space-y-3">
          <h2 className="text-lg font-semibold">14. Legge Applicabile e Foro Competente</h2>
          <p className="text-sm leading-relaxed">I presenti Termini sono regolati dalla legge italiana. Per qualsiasi controversia sarà competente in via esclusiva il Foro di Lodi.</p>
        </section>

        <section className="space-y-3">
          <h2 className="text-lg font-semibold">15. Contatti</h2>
          <p className="text-sm leading-relaxed"><a href="mailto:albertochioda@gmail.com" className="underline">albertochioda@gmail.com</a></p>
        </section>
      </div>
    </main>
  );
}
