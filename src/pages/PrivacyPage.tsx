import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { use_fornitore_pubblico } from "@/hooks/use-fornitore-piattaforma";

export default function PrivacyPage() {
  const { fornitore } = use_fornitore_pubblico();
  const indirizzo_fornitore = [
    fornitore.indirizzo,
    [fornitore.cap, fornitore.citta].filter(Boolean).join(" "),
    fornitore.paese,
  ].filter(Boolean).join(", ");
  return (
    <div className="min-h-screen bg-background py-8 px-4 sm:px-6 lg:px-8">
      <Card className="mx-auto w-full max-w-3xl shadow-sm">
        <CardHeader className="space-y-2">
          <CardTitle className="text-2xl font-semibold tracking-tight">
            Informativa sulla privacy — app Ice Arena
          </CardTitle>
          <p className="text-sm text-muted-foreground">
            Ultimo aggiornamento: 7 settembre 2026
          </p>
        </CardHeader>
        <CardContent className="space-y-8 text-sm leading-relaxed text-foreground">
          <p>
            Questa informativa spiega quali dati personali vengono trattati quando usi l'app Ice Arena e il portale collegato, chi li tratta e cosa puoi chiedere in qualsiasi momento. È scritta per essere letta, non per essere archiviata.
          </p>

          <section className="space-y-3">
            <h2 className="text-lg font-semibold">In due righe</h2>
            <p>
              L'app serve alle famiglie per seguire l'attività sportiva di un atleta dentro il proprio club: comunicazioni, corsi, calendario, gare, fatture. I dati che vedi nell'app appartengono al tuo club, che li ha raccolti al momento dell'iscrizione. Ice Arena non li usa per nient'altro, non li vende e non mostra pubblicità.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-lg font-semibold">Chi tratta i tuoi dati</h2>
            <p>
              Il titolare del trattamento è il club sportivo a cui l'atleta è iscritto. È il club che decide quali dati raccogliere e per quali finalità, ed è al club che ti rivolgi per correggere o cancellare qualcosa.
            </p>
            <p>
              Il fornitore della piattaforma è {fornitore.nome}, {indirizzo_fornitore}{fornitore.ide ? ` (IDE ${fornitore.ide})` : ""}. Agisce come responsabile del trattamento: mette a disposizione il software e l'infrastruttura, tratta i dati solo su istruzione del club e non li usa per finalità proprie.
            </p>
            <p>
              Contatto per le questioni privacy:{" "}
              <a className="text-primary underline" href={`mailto:${fornitore.email_info}`}>
                {fornitore.email_info}
              </a>
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-lg font-semibold">Quali dati vengono trattati</h2>
            <ScrollArea className="w-full rounded-md border">
              <table className="min-w-full text-left">
                <thead className="bg-muted">
                  <tr>
                    <th className="px-4 py-2 font-medium">Dato</th>
                    <th className="px-4 py-2 font-medium">Perché</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  <tr>
                    <td className="px-4 py-2">Nome, cognome, data di nascita, sesso dell'atleta</td>
                    <td className="px-4 py-2">identificare l'atleta dentro il club</td>
                  </tr>
                  <tr>
                    <td className="px-4 py-2">Indirizzo, CAP, località, cantone</td>
                    <td className="px-4 py-2">emettere le fatture e le convocazioni</td>
                  </tr>
                  <tr>
                    <td className="px-4 py-2">Nome, cognome, telefono, email dei genitori</td>
                    <td className="px-4 py-2">contattare la famiglia; intestare la fattura</td>
                  </tr>
                  <tr>
                    <td className="px-4 py-2">Contatto di emergenza</td>
                    <td className="px-4 py-2">raggiungere qualcuno durante un allenamento o una gara</td>
                  </tr>
                  <tr>
                    <td className="px-4 py-2">Livello tecnico, corsi frequentati, presenze</td>
                    <td className="px-4 py-2">organizzare i gruppi e gli allenamenti</td>
                  </tr>
                  <tr>
                    <td className="px-4 py-2">Iscrizioni e risultati di gara</td>
                    <td className="px-4 py-2">tenere lo storico sportivo dell'atleta</td>
                  </tr>
                  <tr>
                    <td className="px-4 py-2">Fatture e stato dei pagamenti</td>
                    <td className="px-4 py-2">amministrazione del club</td>
                  </tr>
                  <tr>
                    <td className="px-4 py-2">Fotografia dell'atleta</td>
                    <td className="px-4 py-2">facoltativa, per la scheda personale; caricata solo se la carichi tu</td>
                  </tr>
                  <tr>
                    <td className="px-4 py-2">Codice di accesso all'atleta</td>
                    <td className="px-4 py-2">è la chiave con cui entri nell'app</td>
                  </tr>
                  <tr>
                    <td className="px-4 py-2">Lingua scelta e tipo di dispositivo</td>
                    <td className="px-4 py-2">mostrare l'app e le notifiche nella tua lingua</td>
                  </tr>
                  <tr>
                    <td className="px-4 py-2">Identificativo per le notifiche push</td>
                    <td className="px-4 py-2">recapitare gli avvisi sul telefono</td>
                  </tr>
                  <tr>
                    <td className="px-4 py-2">Tentativi di accesso (in forma non leggibile)</td>
                    <td className="px-4 py-2">difendere l'accesso da tentativi automatici</td>
                  </tr>
                </tbody>
              </table>
            </ScrollArea>
            <p>
              L'app non raccoglie la tua posizione, non accede alla rubrica, non registra audio e non usa strumenti di analisi del comportamento o di pubblicità. Non ci sono SDK di tracciamento di terze parti nel programma.
            </p>
            <p>
              La fotocamera viene usata solo quando inquadri il codice QR per entrare, o quando scegli tu di scattare la foto del profilo. L'accesso alle foto serve solo a scegliere l'immagine del profilo.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-lg font-semibold">Su cosa si basa il trattamento</h2>
            <p>
              Sull'esecuzione del rapporto di iscrizione fra la famiglia e il club, e sugli obblighi contabili e fiscali del club. La fotografia dell'atleta e le comunicazioni non necessarie all'attività si basano invece sul consenso, che puoi revocare in qualsiasi momento senza conseguenze sull'attività sportiva.
            </p>
            <p>
              Si applicano la Legge federale svizzera sulla protezione dei dati (nLPD) e, per gli atleti residenti nell'Unione europea, il Regolamento generale sulla protezione dei dati (GDPR).
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-lg font-semibold">Dati di persone minorenni</h2>
            <p>
              La maggior parte degli atleti è minorenne. I dati vengono forniti da un genitore o da chi esercita l'autorità parentale, che è anche la persona che usa l'app. L'app non ha aree pubbliche, non ha chat aperte, non ha profili visibili all'esterno del club e non permette a un atleta di essere contattato da estranei.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-lg font-semibold">A chi vengono comunicati</h2>
            <p>Solo a chi serve per far funzionare il servizio:</p>
            <ul className="list-disc space-y-2 pl-5">
              <li>
                <strong>Supabase Inc.</strong> — banca dati e archiviazione dei file. I server si trovano a Francoforte sul Meno, Germania (AWS eu-central-1): i dati dell'atleta non escono dallo Spazio economico europeo.
              </li>
              <li>
                <strong>Expo (650 Industries, Inc.), Stati Uniti</strong> — recapito delle notifiche push. Riceve l'identificativo del dispositivo e il testo dell'avviso, non l'anagrafica dell'atleta.
              </li>
              <li>
                <strong>Apple e Google</strong> — recapito finale della notifica al telefono, secondo le rispettive informative.
              </li>
            </ul>
            <p>
              Il trasferimento verso gli Stati Uniti per il solo recapito delle notifiche avviene sulla base delle clausole contrattuali tipo. Se preferisci evitarlo, puoi disattivare le notifiche dalle impostazioni del telefono: l'app continua a funzionare e gli avvisi restano leggibili al suo interno.
            </p>
            <p>
              Non ci sono altri destinatari. I dati non vengono venduti, ceduti a fini commerciali né usati per addestrare sistemi di intelligenza artificiale.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-lg font-semibold">Per quanto tempo</h2>
            <p>
              Finché l'atleta è iscritto al club, e successivamente per il tempo richiesto dagli obblighi contabili svizzeri (dieci anni per i documenti di fatturazione). Le comunicazioni e i dati sportivi vengono cancellati o resi anonimi quando il club chiude la posizione dell'atleta.
            </p>
            <p>
              L'identificativo per le notifiche viene disattivato da solo quando disinstalli l'app.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-lg font-semibold">I tuoi diritti</h2>
            <p>
              Puoi chiedere di sapere quali dati sono trattati, di correggerli, di cancellarli, di riceverli in un formato leggibile da un altro programma, e di opporti a un trattamento. Puoi anche revocare un consenso già dato.
            </p>
            <p>
              La richiesta si fa al club, che è il titolare. Se non ricevi risposta, scrivi a{" "}
              <a className="text-primary underline" href={`mailto:${fornitore.email_info}`}>
                {fornitore.email_info}
              </a>{" "}
              e il fornitore inoltra la richiesta. In Svizzera puoi rivolgerti all'Incaricato federale della protezione dei dati e della trasparenza (IFPDT); nell'Unione europea, all'autorità di controllo del tuo paese.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-lg font-semibold">Cancellazione dell'accesso e dei dati</h2>
            <p>
              Dal menu Profilo dell'app puoi uscire e scollegare il dispositivo: da quel momento l'app non mostra più nulla e l'identificativo per le notifiche viene disattivato.
            </p>
            <p>
              Per la cancellazione dei dati dell'atleta dagli archivi del club, la richiesta va fatta al club oppure a{" "}
              <a className="text-primary underline" href={`mailto:${fornitore.email_info}`}>
                {fornitore.email_info}
              </a>
              . Viene evasa entro trenta giorni, fatti salvi i documenti che il club deve conservare per legge.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-lg font-semibold">Sicurezza</h2>
            <p>
              L'accesso all'app avviene con un codice personale per atleta. Il collegamento fra telefono e server è sempre cifrato. Sul server, ogni club vede solo i propri dati: la separazione è imposta dalla banca dati stessa, non solo dal programma. I tentativi di accesso vengono registrati in forma non leggibile per riconoscere gli attacchi automatici. I dati sono conservati su infrastruttura europea, come indicato sopra.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-lg font-semibold">Modifiche</h2>
            <p>
              Se questa informativa cambia in modo rilevante, la data in alto viene aggiornata e il cambiamento viene comunicato dentro l'app. Le versioni precedenti restano disponibili su richiesta.
            </p>
          </section>

          <Separator />

          <section className="space-y-2">
            <h2 className="text-lg font-semibold">Contatti</h2>
            <p>
              {fornitore.nome} — {indirizzo_fornitore}
            </p>
            <p>
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
