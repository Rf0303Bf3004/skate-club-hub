import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { use_fornitore_pubblico } from "@/hooks/use-fornitore-piattaforma";

export default function TerminiPage() {
  const { fornitore } = use_fornitore_pubblico();
  const indirizzo_fornitore = [
    fornitore.indirizzo,
    [fornitore.cap, fornitore.citta].filter(Boolean).join(" "),
    fornitore.paese,
  ].filter(Boolean).join(", ");
  return (
    <div className="min-h-mobile bg-background py-8 px-4 sm:px-6 lg:px-8">
      <Card className="mx-auto w-full max-w-3xl shadow-sm">
        <CardHeader className="space-y-2">
          <CardTitle className="text-2xl font-semibold tracking-tight">
            Condizioni di servizio — Ice Arena
          </CardTitle>
          <p className="text-sm text-muted-foreground">
            Ultimo aggiornamento: 24 settembre 2026
          </p>
        </CardHeader>
        <CardContent className="space-y-8 text-sm leading-relaxed text-foreground">
          <p>
            Queste condizioni regolano l'uso di Ice Arena. Sono scritte per essere lette. Se qualcosa non è chiaro, scrivici prima di accettare.
          </p>

          <section className="space-y-3">
            <h2 className="text-lg font-semibold">1. Chi siamo e chi sono le parti</h2>
            <p>
              Il servizio è fornito da <strong>{fornitore.nome}</strong>, {indirizzo_fornitore}{fornitore.ide ? `, IDE ${fornitore.ide}` : ""} («il fornitore»).
            </p>
            <p>Ci sono tre soggetti e non vanno confusi:</p>
            <ul className="list-disc space-y-2 pl-5">
              <li><strong>Il fornitore</strong> mette a disposizione il programma e l'infrastruttura.</li>
              <li><strong>Il club</strong> è il cliente e paga. È anche il titolare dei dati dei suoi atleti.</li>
              <li><strong>La famiglia</strong> usa l'app e il portale gratuitamente. Non paga nulla al fornitore.</li>
            </ul>
            <p>
              Le famiglie non sono clienti del fornitore: il loro rapporto è con il club.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-lg font-semibold">2. Che cos'è il servizio</h2>
            <p>
              Un programma per la gestione di un club di pattinaggio: anagrafica atleti, corsi, planning del ghiaccio, presenze, comunicazioni, gare, lezioni private, fatturazione alle famiglie, portale e app per le famiglie.
            </p>
            <p>
              Il servizio è fornito via internet. Non viene installato nulla sui computer del club.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-lg font-semibold">3. Che cosa deve fare il club</h2>
            <ul className="list-disc space-y-2 pl-5">
              <li>Fornire dati esatti e aggiornati, in particolare l'anagrafica di fatturazione e i contatti delle famiglie.</li>
              <li>Raccogliere dalle famiglie le informative e i consensi richiesti dalla legge, come titolare del trattamento.</li>
              <li>Custodire le proprie credenziali e quelle del suo staff, e revocarle quando una persona lascia il club.</li>
              <li>Non usare il servizio per finalità diverse dall'attività del club, e non cederne l'accesso a terzi.</li>
            </ul>
          </section>

          <section className="space-y-3">
            <h2 className="text-lg font-semibold">4. Che cosa fa il fornitore</h2>
            <ul className="list-disc space-y-2 pl-5">
              <li>Mantiene il servizio disponibile e ne cura la manutenzione.</li>
              <li>Separa i dati di ogni club: nessun club vede i dati di un altro. La separazione è imposta dalla banca dati, non solo dal programma.</li>
              <li>Conserva i dati su infrastruttura europea (vedi <a className="text-primary underline" href="/privacy">informativa privacy</a>).</li>
              <li>Esegue copie di sicurezza periodiche.</li>
              <li>Non usa i dati dei club per finalità proprie, non li vende e non li usa per addestrare sistemi di intelligenza artificiale.</li>
            </ul>
            <p>
              Il fornitore può aggiornare e migliorare il programma. Se un aggiornamento toglie una funzione che il club sta usando, lo comunica prima.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-lg font-semibold">5. Prezzo e fatturazione</h2>
            <p>
              Il canone è mensile ed è composto da: una quota fissa mensile; un importo per atleta attivo nel mese; e, se indicata nel contratto del club, una quota di avvio una tantum.
            </p>
            <p>
              Gli importi sono quelli concordati con il club e indicati nel suo contratto. Sono espressi in franchi svizzeri.
            </p>
            <p>
              Il conteggio degli atleti è quello registrato nel sistema alla chiusura del mese. La fattura riporta il numero di atleti su cui è calcolata: il club può verificarlo.
            </p>
            <p>Pagamento a 30 giorni dalla data di emissione.</p>
            <p>
              <strong>Revisione del canone.</strong> Gli importi possono essere rivisti una volta all'anno, con effetto dalla stagione successiva e preavviso di almeno 90 giorni prima del suo inizio. Il canone non cambia a stagione in corso. Se il club non accetta la revisione, può disdire con effetto dalla stessa data, senza penali.
            </p>
            <p>
              In caso di mancato pagamento il fornitore sollecita il club. La sospensione del servizio è l'ultima misura, è comunicata con almeno 15 giorni di preavviso, e non comporta la cancellazione dei dati.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-lg font-semibold">6. Durata e disdetta</h2>
            <p>
              Il contratto è a tempo indeterminato e segue la stagione sportiva.
            </p>
            <p>
              La disdetta è possibile per entrambe le parti con effetto dalla fine della stagione in corso, da comunicare per iscritto almeno 90 giorni prima della fine della stagione. Nessuna penale.
            </p>
            <p>
              <strong>All'uscita, i dati restano del club.</strong> Prima della chiusura, e per almeno 30 giorni dopo, il club può scaricare l'esportazione completa dei propri dati in un formato leggibile da altri programmi. Trascorso quel termine i dati vengono cancellati, salvo quanto il fornitore deve conservare per legge.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-lg font-semibold">7. Disponibilità e responsabilità</h2>
            <p>
              Il fornitore si impegna a mantenere il servizio disponibile, ma non garantisce un funzionamento ininterrotto: possono esserci interruzioni per manutenzione, guasti o cause esterne. Gli interventi di manutenzione programmata vengono annunciati in anticipo.
            </p>
            <p>
              La responsabilità del fornitore è limitata ai danni diretti e, nel massimo, a quanto il club ha pagato nei dodici mesi precedenti. Restano esclusi i danni indiretti, il mancato guadagno e la perdita di dati imputabile al club.
            </p>
            <p>
              Il fornitore non è responsabile dei contenuti inseriti dal club né delle decisioni che il club prende sulla base dei dati.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-lg font-semibold">8. Dati personali</h2>
            <p>
              Il trattamento dei dati personali è descritto nell'<a className="text-primary underline" href="/privacy">informativa sulla privacy</a>, che è parte integrante di queste condizioni.
            </p>
            <p>
              In sintesi: il club è il titolare, il fornitore è il responsabile del trattamento e agisce solo su istruzione del club.
            </p>
            <p>
              Al momento dell'attivazione, club e fornitore sottoscrivono un contratto di trattamento dei dati che precisa le istruzioni del titolare, le misure di sicurezza, i sub-responsabili e la loro eventuale sostituzione.
            </p>
            <p>
              La maggior parte degli atleti è minorenne: il club garantisce di aver raccolto i dati dal genitore o da chi esercita l'autorità parentale.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-lg font-semibold">9. Modifiche alle condizioni</h2>
            <p>
              Il fornitore può modificare queste condizioni. Le modifiche rilevanti sono comunicate con almeno 30 giorni di preavviso. Se il club non le accetta, può disdire senza penali entro quel termine.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-lg font-semibold">10. Cessione</h2>
            <p>
              Il fornitore può cedere il contratto a un'altra società in caso di fusione, acquisizione o cessione di ramo d'azienda. In tal caso lo comunica ai club, che possono disdire senza penali entro 30 giorni.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-lg font-semibold">11. Diritto applicabile e foro</h2>
            <p>
              Si applica il diritto svizzero. Foro competente: Bellinzona, salvo fori imperativi di legge.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-lg font-semibold">12. Contatti</h2>
            <p>
              {fornitore.nome} — {indirizzo_fornitore} ·{" "}
              <a className="text-primary underline" href={`mailto:${fornitore.email_info}`}>
                {fornitore.email_info}
              </a>
            </p>
          </section>
        </CardContent>
      </Card>
    </div>
  );
}
