import type { Metadata } from "next";
import { SUPPORT_EMAIL } from "@/lib/support-contact";
import { SITE_URL } from "@/lib/site-url";
import Logo from "@/components/logo";

const CONTENT: Record<"it" | "en", { title: string; description: string }> = {
  it: {
    title: "Termini di Servizio — Job Search Bridge",
    description: "Termini e condizioni per l'utilizzo della piattaforma Job Search Bridge: accesso al servizio, abbonamenti, cancellazione dell'account.",
  },
  en: {
    title: "Terms of Service — Job Search Bridge",
    description: "Terms and conditions for using the Job Search Bridge platform: service access, subscriptions, account cancellation.",
  },
};

// Metadata dedicati — stesso fix gemello di privacy-policy/page.tsx,
// stesso motivo (vedi commento lì per il dettaglio).
export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const { title, description } = CONTENT[locale as "it" | "en"] ?? CONTENT.it;
  const url = `${SITE_URL}/${locale}/termini-di-servizio`;

  return {
    title,
    description,
    robots: { index: true, follow: true },
    alternates: {
      canonical: url,
      languages: {
        it: `${SITE_URL}/it/termini-di-servizio`,
        en: `${SITE_URL}/en/termini-di-servizio`,
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

export default function TerminiDiServizio() {
  return (
    <main className="min-h-screen bg-white text-gray-900 px-6 py-12">
      <div className="max-w-3xl mx-auto space-y-8">
        <div className="text-center space-y-1">
          <div className="flex justify-center">
            <Logo />
          </div>
          <h1 className="text-2xl font-bold">Termini e Condizioni di Utilizzo</h1>
          <p className="text-sm text-gray-500">Versione 3.0 — 25 settembre 2026</p>
        </div>

        <section className="space-y-3">
          <h2 className="text-lg font-semibold">1. Identificazione del Titolare</h2>
          <p className="text-sm leading-relaxed">Il servizio Job Search Bridge (&quot;JSB&quot;, &quot;Servizio&quot; o &quot;Piattaforma&quot;) è gestito da Alberto Chioda, con sede in Lodi (LO), Italia (&quot;Titolare&quot;). Contatto: <a href={`mailto:${SUPPORT_EMAIL}`} className="underline">{SUPPORT_EMAIL}</a>.</p>
        </section>

        <section className="space-y-3">
          <h2 className="text-lg font-semibold">2. Oggetto e natura del Servizio</h2>
          <p className="text-sm leading-relaxed">Job Search Bridge è una piattaforma software che assiste l&apos;utente nella ricerca di opportunità lavorative, nell&apos;analisi della compatibilità tra il proprio profilo professionale e le offerte, nell&apos;adattamento del curriculum vitae, nella generazione di lettere di presentazione e nella gestione personale delle candidature.</p>
          <p className="text-sm leading-relaxed">Il Servizio utilizza sistemi di intelligenza artificiale di terze parti. Alla data dei presenti Termini, Google Gemini è utilizzato nel flusso di analisi/scoring e Anthropic Claude è utilizzato, tra l&apos;altro, per l&apos;elaborazione di CV, lettere di presentazione e assistenza. Le modalità di trattamento dei dati sono descritte nell&apos;Informativa Privacy.</p>
          <p className="text-sm leading-relaxed">Il Servizio può evolvere nel tempo. JSB può introdurre, modificare o rimuovere funzionalità, purché ciò non privi l&apos;utente di prestazioni essenziali già acquistate senza una soluzione conforme alla normativa applicabile.</p>
        </section>

        <section className="space-y-3">
          <h2 className="text-lg font-semibold">3. Requisiti di accesso e account</h2>
          <p className="text-sm leading-relaxed">Per utilizzare le funzionalità riservate è necessario disporre di un account. L&apos;utente deve fornire informazioni corrette e mantenere riservate le proprie credenziali. L&apos;account è personale e non può essere condiviso o ceduto.</p>
          <p className="text-sm leading-relaxed">JSB può sospendere o limitare l&apos;account quando ciò sia necessario per sicurezza, prevenzione di abusi, mancato pagamento o violazioni sostanziali dei presenti Termini, informando l&apos;utente quando ragionevolmente possibile e salvo i casi che richiedano intervento immediato.</p>
        </section>

        <section className="space-y-3">
          <h2 className="text-lg font-semibold">4. Trial</h2>
          <p className="text-sm leading-relaxed">JSB può offrire un Trial a pagamento. Alla data dei presenti Termini il Trial ha un costo una tantum di € 3,49, non costituisce un abbonamento e non si rinnova automaticamente.</p>
          <p className="text-sm leading-relaxed">Il Trial termina al raggiungimento del primo tra il limite temporale e il limite di utilizzo indicati nella pagina Prezzi e nel checkout. Alla data dei presenti Termini, il limite temporale è di 14 giorni e il limite principale di ricerca è di 3 ricerche. Gli ulteriori limiti di CV adattati, lettere e altre funzionalità sono indicati prima dell&apos;acquisto.</p>
          <p className="text-sm leading-relaxed">Alla fine del Trial non viene effettuato alcun addebito automatico. Per continuare a utilizzare le funzionalità a pagamento, l&apos;utente deve scegliere e sottoscrivere espressamente un piano Individual o Professional.</p>
        </section>

        <section className="space-y-3">
          <h2 className="text-lg font-semibold">5. Piani, prezzi e pagamento</h2>
          <p className="text-sm leading-relaxed">I piani e i prezzi applicabili sono quelli mostrati nella pagina Prezzi e nel checkout al momento dell&apos;acquisto. Gli abbonamenti possono essere offerti con cadenza mensile, trimestrale o annuale.</p>
          <p className="text-sm leading-relaxed">I pagamenti sono elaborati tramite Stripe. JSB non riceve né memorizza i dati completi della carta. L&apos;utente autorizza l&apos;addebito dell&apos;importo indicato nel checkout e, per gli abbonamenti ricorrenti, i successivi addebiti previsti dalla cadenza scelta, salvo disdetta.</p>
          <p className="text-sm leading-relaxed">In caso di pagamento non riuscito, l&apos;abbonamento può assumere lo stato di pagamento scaduto e l&apos;utente può essere invitato ad aggiornare il metodo di pagamento. JSB può limitare o sospendere l&apos;accesso alle funzionalità a pagamento qualora il pagamento resti insoluto, nel rispetto della normativa applicabile.</p>
        </section>

        <section className="space-y-3">
          <h2 className="text-lg font-semibold">6. Rinnovo automatico</h2>
          <p className="text-sm leading-relaxed">Gli abbonamenti Individual e Professional si rinnovano automaticamente per la medesima cadenza scelta dall&apos;utente, salvo disdetta prima della scadenza del periodo in corso.</p>
          <p className="text-sm leading-relaxed">Prima della sottoscrizione, JSB informa l&apos;utente della periodicità, del prezzo, del carattere ricorrente dell&apos;addebito e delle modalità di disdetta.</p>
          <p className="text-sm leading-relaxed">Per i contratti ai quali si applica l&apos;art. 65-bis del Codice del Consumo, JSB invia l&apos;avviso di rinnovo automatico nei termini previsti dalla legge, indicando la data entro cui l&apos;utente può inviare la disdetta. Per le cadenze per le quali l&apos;applicazione pratica del termine legale richieda specifici adeguamenti, prevalgono in ogni caso i diritti riconosciuti al consumatore dalla normativa vigente.</p>
          <p className="text-sm leading-relaxed">La mancata ricezione di un avviso dovuto per legge non limita i diritti attribuiti al consumatore dalla normativa applicabile.</p>
        </section>

        <section className="space-y-3">
          <h2 className="text-lg font-semibold">7. Disdetta dell&apos;abbonamento</h2>
          <p className="text-sm leading-relaxed">L&apos;utente può disdire l&apos;abbonamento in qualsiasi momento tramite la funzione disponibile nell&apos;account. La disdetta impedisce il rinnovo successivo e, salvo diversa previsione di legge, l&apos;utente mantiene l&apos;accesso alle funzionalità del piano fino alla fine del periodo già pagato.</p>
          <p className="text-sm leading-relaxed">La disdetta del solo abbonamento non elimina l&apos;account, il CV, i documenti generati o gli altri dati dell&apos;utente. Per eliminare l&apos;account è necessario utilizzare la procedura descritta all&apos;Art. 9.</p>
        </section>

        <section className="space-y-3">
          <h2 className="text-lg font-semibold">8. Diritto di recesso e rimborsi</h2>
          <p className="text-sm leading-relaxed">Se l&apos;utente agisce in qualità di consumatore, trova applicazione il diritto di recesso previsto dal Codice del Consumo, nei casi e nei termini stabiliti dalla legge. In generale, per i contratti a distanza il termine è di 14 giorni dalla conclusione del contratto, fatte salve le eccezioni previste dalla normativa.</p>
          <p className="text-sm leading-relaxed">Poiché il Servizio viene normalmente attivato subito dopo l&apos;acquisto, l&apos;utente può richiedere che l&apos;esecuzione inizi durante il periodo di recesso. In tal caso, le conseguenze economiche dell&apos;eventuale recesso sono determinate dalla normativa applicabile, incluso, ove previsto, il pagamento proporzionale per quanto già fornito. JSB non limita né esclude i diritti inderogabili del consumatore.</p>
          <p className="text-sm leading-relaxed">Le richieste di recesso o rimborso possono essere inviate a <a href={`mailto:${SUPPORT_EMAIL}`} className="underline">{SUPPORT_EMAIL}</a>. Eventuali addebiti duplicati o effettuati per errore vengono rimborsati dopo le necessarie verifiche.</p>
          <p className="text-sm leading-relaxed">L&apos;eventuale rimborso automatico previsto da specifiche funzioni della piattaforma costituisce una modalità tecnica di gestione e non limita ulteriori diritti riconosciuti dalla legge.</p>
        </section>

        <section className="space-y-3">
          <h2 className="text-lg font-semibold">9. Cancellazione dell&apos;account</h2>
          <p className="text-sm leading-relaxed">L&apos;utente può richiedere in qualsiasi momento la cancellazione dell&apos;account dalla sezione dedicata. La procedura richiede una conferma tramite email con link temporaneo.</p>
          <p className="text-sm leading-relaxed">Quando la cancellazione viene confermata, un eventuale abbonamento attivo viene terminato, l&apos;account di autenticazione viene eliminato e JSB cancella i dati operativi collegati all&apos;account, inclusi CV, CV adattati, lettere, ricerche, punteggi, candidature, note e dati di supporto, secondo quanto descritto nell&apos;Informativa Privacy.</p>
          <p className="text-sm leading-relaxed">Alcuni dati possono essere conservati quando necessario per obblighi legali, fiscali, amministrativi, antifrode, sicurezza o tutela di diritti, oppure in base ai cicli tecnici di backup e retention dei fornitori. La cancellazione dell&apos;account JSB non comporta necessariamente l&apos;eliminazione dei dati che Stripe o altri soggetti devono conservare autonomamente per obblighi propri.</p>
        </section>

        <section className="space-y-3">
          <h2 className="text-lg font-semibold">10. Intelligenza artificiale e risultati del Servizio</h2>
          <p className="text-sm leading-relaxed">Punteggi, spiegazioni, CV adattati, lettere e altri contenuti prodotti tramite sistemi di intelligenza artificiale sono strumenti di supporto. Possono contenere errori, omissioni o interpretazioni non corrette e devono essere verificati dall&apos;utente prima dell&apos;utilizzo.</p>
          <p className="text-sm leading-relaxed">I punteggi di compatibilità non costituiscono una valutazione professionale definitiva, una garanzia di idoneità, un giudizio del datore di lavoro o una previsione circa l&apos;esito di una candidatura. JSB non prende decisioni di assunzione per conto di datori di lavoro.</p>
          <p className="text-sm leading-relaxed">JSB non garantisce che una determinata offerta sia ancora disponibile, completa o priva di errori e non garantisce il conseguimento di colloqui, offerte di lavoro o altri risultati professionali.</p>
          <p className="text-sm leading-relaxed">JSB non invia automaticamente candidature per conto dell&apos;utente. L&apos;utente mantiene il controllo sulla decisione di candidarsi e sui documenti da utilizzare.</p>
        </section>

        <section className="space-y-3">
          <h2 className="text-lg font-semibold">11. Offerte di lavoro e fonti esterne</h2>
          <p className="text-sm leading-relaxed">Le informazioni relative alle offerte possono provenire da fonti esterne e possono cambiare, essere rimosse o contenere inesattezze. L&apos;utente deve verificare le condizioni essenziali dell&apos;offerta presso la fonte originaria prima di candidarsi o assumere decisioni.</p>
          <p className="text-sm leading-relaxed">La presenza di un&apos;offerta su JSB non implica un rapporto di partnership, approvazione o affiliazione con il datore di lavoro, salvo che ciò sia espressamente indicato.</p>
        </section>

        <section className="space-y-3">
          <h2 className="text-lg font-semibold">12. Uso consentito e divieti</h2>
          <p className="text-sm leading-relaxed">Il Servizio è destinato all&apos;uso personale dell&apos;utente per la ricerca di lavoro e la gestione della propria candidatura.</p>
          <ul className="text-sm leading-relaxed list-disc pl-5 space-y-1">
            <li>È vietato utilizzare l&apos;account per conto di terzi senza autorizzazione del Titolare.</li>
            <li>È vietato condividere le credenziali o aggirare limiti di utilizzo, controlli di sicurezza o sistemi di pagamento.</li>
            <li>È vietato utilizzare il Servizio per attività illecite, fraudolente o lesive dei diritti di terzi.</li>
            <li>È vietato tentare di ottenere accesso non autorizzato a sistemi, dati, API o infrastrutture del Servizio.</li>
            <li>Restano fermi i diritti inderogabili dell&apos;utente previsti dalla legge, inclusi quelli che non possono essere esclusi contrattualmente in materia di interoperabilità, sicurezza, studio o analisi del software.</li>
          </ul>
        </section>

        <section className="space-y-3">
          <h2 className="text-lg font-semibold">13. Proprietà intellettuale</h2>
          <p className="text-sm leading-relaxed">Il software, il codice, la struttura della piattaforma, il design, i marchi, i loghi e gli altri elementi originali del Servizio sono protetti dalla normativa applicabile e appartengono al Titolare o ai rispettivi licenzianti.</p>
          <p className="text-sm leading-relaxed">L&apos;utente conserva i diritti sui contenuti e sui dati che fornisce a JSB. L&apos;utente concede al Titolare, per la durata necessaria all&apos;erogazione del Servizio, il diritto di trattare tali contenuti esclusivamente nella misura necessaria a fornire le funzionalità richieste.</p>
          <p className="text-sm leading-relaxed">I documenti generati per l&apos;utente possono essere utilizzati dall&apos;utente per la propria ricerca di lavoro, fermo restando che eventuali elementi di terzi incorporati nei documenti restano soggetti ai relativi diritti.</p>
          <p className="text-sm leading-relaxed">Feedback e suggerimenti possono essere utilizzati da JSB per migliorare il Servizio senza obbligo di compenso, senza che ciò comporti trasferimento a JSB della titolarità dei dati personali o dei contenuti dell&apos;utente.</p>
        </section>

        <section className="space-y-3">
          <h2 className="text-lg font-semibold">14. Disponibilità, manutenzione e assistenza</h2>
          <p className="text-sm leading-relaxed">JSB mira a mantenere il Servizio disponibile, ma non garantisce un funzionamento ininterrotto o privo di errori. Possono verificarsi manutenzioni, aggiornamenti, indisponibilità dei fornitori o problemi tecnici.</p>
          <p className="text-sm leading-relaxed">L&apos;assistenza è disponibile tramite i canali indicati nella piattaforma e all&apos;indirizzo <a href={`mailto:${SUPPORT_EMAIL}`} className="underline">{SUPPORT_EMAIL}</a>. Le richieste vengono normalmente prese in carico entro 2 giorni lavorativi; tale indicazione è orientativa e non costituisce un livello di servizio garantito.</p>
        </section>

        <section className="space-y-3">
          <h2 className="text-lg font-semibold">15. Responsabilità</h2>
          <p className="text-sm leading-relaxed">JSB risponde secondo le regole previste dalla legge applicabile. Nessuna disposizione dei presenti Termini esclude o limita responsabilità che non possa essere esclusa o limitata nei confronti di un consumatore.</p>
          <p className="text-sm leading-relaxed">Nei limiti consentiti dalla legge, JSB non è responsabile per decisioni assunte esclusivamente sulla base di output AI non verificati dall&apos;utente, per contenuti inesatti provenienti da fonti esterne o per indisponibilità imputabili a servizi di terzi fuori dal ragionevole controllo del Titolare.</p>
          <p className="text-sm leading-relaxed">Restano impregiudicati i rimedi e le garanzie inderogabili previsti dal Codice del Consumo per i servizi e contenuti digitali.</p>
        </section>

        <section className="space-y-3">
          <h2 className="text-lg font-semibold">16. Modifiche ai prezzi e ai piani</h2>
          <p className="text-sm leading-relaxed">JSB può modificare prezzi, caratteristiche e limiti dei piani per ragioni economiche, tecniche, normative o di evoluzione del Servizio. Le modifiche che incidono su un abbonamento già in corso vengono comunicate con un preavviso ragionevole e, quando previsto, almeno 30 giorni prima della loro applicazione.</p>
          <p className="text-sm leading-relaxed">Le modifiche di prezzo si applicano ai rinnovi successivi alla loro entrata in vigore. Se l&apos;utente non intende accettarle, può disdire l&apos;abbonamento prima del rinnovo interessato, senza penali.</p>
        </section>

        <section className="space-y-3">
          <h2 className="text-lg font-semibold">17. Modifiche ai Termini</h2>
          <p className="text-sm leading-relaxed">JSB può aggiornare i presenti Termini per modifiche normative, tecniche, di sicurezza o del Servizio. Le modifiche sostanziali saranno comunicate con modalità adeguate prima della loro efficacia. Quando la legge richiede un nuovo consenso o un&apos;accettazione espressa, JSB la richiederà.</p>
          <p className="text-sm leading-relaxed">Il semplice utilizzo continuato del Servizio non sostituisce un consenso espresso quando quest&apos;ultimo sia richiesto dalla legge.</p>
        </section>

        <section className="space-y-3">
          <h2 className="text-lg font-semibold">18. Legge applicabile e foro competente</h2>
          <p className="text-sm leading-relaxed">I presenti Termini sono regolati dalla legge italiana, fatto salvo il diritto del consumatore di beneficiare delle norme imperative eventualmente applicabili nel proprio Paese di residenza.</p>
          <p className="text-sm leading-relaxed">Se l&apos;utente è un consumatore residente o domiciliato in Italia, per le controversie per le quali il Codice del Consumo prevede un foro inderogabile è competente il giudice del luogo di residenza o domicilio del consumatore. Negli altri casi, la competenza è determinata secondo la normativa applicabile.</p>
        </section>

        <section className="space-y-3">
          <h2 className="text-lg font-semibold">19. Comunicazioni</h2>
          <p className="text-sm leading-relaxed">Le comunicazioni contrattuali possono essere inviate all&apos;indirizzo email associato all&apos;account. L&apos;utente è tenuto a mantenerlo aggiornato.</p>
          <p className="text-sm leading-relaxed">Per assistenza, recesso, contestazioni o altre comunicazioni: <a href={`mailto:${SUPPORT_EMAIL}`} className="underline">{SUPPORT_EMAIL}</a>.</p>
        </section>
      </div>
    </main>
  );
}
