# Planning unificato: risorse fisiche + Griglia generalizzata (Ghiaccio / Off-Ice)

## Stato attuale verificato (dati reali)

- `griglia_blocchi`: `club_id, data, ora_inizio, ora_fine, titolo, stato, creato_da, pubblicato_at` — **nessun riferimento a una pista/risorsa**.
- `griglia_sessioni`: `blocco_id, ordine, ora_inizio, ora_fine, specialita_id, specialita_testo_libero, note, pista (text), messaggio_atleti`. La durata di 20' non è un vincolo DB: `ora_inizio`/`ora_fine` sono già libere, il taglio a 20' è convenzione della UI. `pista` è oggi solo testo libero.
- `corsi`: template settimanale (`giorno, ora_inizio, ora_fine, usa_ghiaccio, costo_mensile/annuale, capienza_max, livello_id, stagione_id`). **Non esiste la colonna `corsi.istruttori_ids`**: gli istruttori stanno solo in `corsi_istruttori` (10 righe). La doppia fonte di verità temuta non è a livello DB — semmai solo in stato locale della UI.
- `planning_corsi_settimana` (80 righe) con `sostituisce_id`, `annullato`, `is_evento_extra`: è già il modello "occorrenza con eccezioni" corretto.
- Volumi produzione: 8 corsi (tutti su ghiaccio, 0 off-ice), 21 iscrizioni, 20 settimane, 80 occorrenze, 1 blocco griglia con 2 sessioni.
- Disponibilità: `disponibilita_istruttori` (32 righe, per giorno-della-settimana) e `disponibilita_ghiaccio` (43 righe, per giorno-della-settimana, con `tipo`) — nessuna delle due è legata a una risorsa fisica.

Conseguenza pratica: la griglia è quasi vergine (1 blocco), il planning è pieno. La migrazione va fatta *verso* la griglia, non viceversa.

## a) Modello dati risorse fisiche

Nuova tabella `risorse_strutture`:

| campo | note |
|---|---|
| `id`, `club_id`, `created_at`, `updated_at` | standard |
| `nome` | es. "Pista Olimpica", "Palestra A" |
| `tipo` | `'ghiaccio' \| 'palestra'` (text + check, estendibile) |
| `ordine`, `attiva` | ordinamento e dismissione senza cancellare storico |
| `colore` | opzionale, per le viste calendario |
| `capienza_max` | opzionale, override di `configurazione_ghiaccio.max_atleti_contemporanei` |

Seed automatico per ogni club esistente: una risorsa `ghiaccio` chiamata come il club (o "Pista principale"), così nulla resta orfano.

Collegamenti:
- `griglia_blocchi.risorsa_id` (nullable in fase 1, poi NOT NULL) → tutte le righe esistenti puntate alla risorsa seed.
- `disponibilita_ghiaccio.risorsa_id` → la disponibilità diventa "di quella pista/palestra", non del club. Le 43 righe attuali vanno sulla risorsa seed.
- `corsi.risorsa_id` (nullable) → sostituisce a termine il booleano `usa_ghiaccio`, che resta come colonna derivata finché il vecchio Planning è vivo.
- `planning_corsi_settimana` eredita la risorsa dal corso; si aggiunge `risorsa_id` solo se serve spostare una singola occorrenza su un'altra pista.

Il campo testuale `griglia_sessioni.pista` viene conservato come nota libera (settore della pista, es. "metà campo"), non promosso a risorsa.

## b) Generalizzare la Griglia invece di duplicarla

Raccomandazione: **una sola famiglia di tabelle**, niente tabelle parallele off-ice. Il tipo lo determina la risorsa collegata.

- `griglia_blocchi` + `risorsa_id` → un blocco = una risorsa, un giorno, una finestra oraria. Due piste nello stesso giorno = due blocchi. Un blocco palestra = blocco su risorsa `palestra`.
- `griglia_sessioni` resta com'è: `ora_inizio`/`ora_fine` sono già libere. Va tolto il vincolo *della UI* sui 20' e sostituito con: durata predefinita configurabile + selettore a 5' già esistente (`OrarioSelect`), più un `durata_minuti` calcolato lato client.
- `ordine` resta per il layout a tab, ma l'ordinamento reale passa a `ora_inizio`.
- Le specialità (`griglia_specialita`) prendono un campo `ambito` (`ghiaccio` / `palestra` / `entrambi`) per filtrare la tassonomia in base al tipo di risorsa.
- `griglia_sessioni_atleti` / `_istruttori`: invariate.

Il `GrigliaBuilder` diventa parametrico su `risorsa`: cambia solo il pool di specialità, l'etichetta e le regole di capienza. Zero fork del componente.

### b-bis) Due modalità di popolamento dei pool sorgente

La sorgente dei pool non è più unica. Chi programma la giornata sceglie, **per singola sessione** (non per pagina, non per club), come vuole vedere gli atleti:

| Modalità | Contenitori di primo livello | Gruppi interni | Uso |
|---|---|---|---|
| **Per livello anagrafico** (esistente) | ragione sociale / academy / Esterni | livello letto dalla scheda atleta | piani di personalizzazione: gruppi eterogenei (mix Stellina 2 + 3) non legati a un pacchetto fatturabile |
| **Per proposta/pacchetto** (nuova) | la singola occorrenza di proposta, es. "Stellina 2 — giovedì 17:00-18:00" | opzionale: livello, per orientarsi dentro proposte numerose | programmazione ordinaria: si trascina il pacchetto e arrivano esattamente i suoi iscritti |

Implicazioni tecniche:
- Nessuna colonna nuova sulle tabelle griglia per la modalità in sé: è uno stato della UI. Si salva però su `griglia_sessioni.origine_pool` (`'livello' | 'proposta'`) + `griglia_sessioni.corso_id` — utile per sapere, a posteriori, se quella sessione nasce da un pacchetto o da una composizione manuale, e per i messaggi automatici.
- In modalità "per proposta" il drag del contenitore intero inserisce in `griglia_sessioni_atleti` gli atleti con `iscrizioni_corsi.attiva = true` per **quella specifica riga `corsi`**, non per tutte le occorrenze omonime.
- Il singolo atleta resta sempre trascinabile individualmente in entrambe le modalità: la modalità cambia solo il raggruppamento della sorgente, non le regole di rilascio.
- Il toggle vive nell'header di ogni tab-sessione del `GrigliaBuilder`; le due modalità possono convivere nello stesso giorno su sessioni diverse.

## c) "Ripeti per tutta la stagione" — il ponte verso la fatturazione

Riuso integrale di `corsi` + `iscrizioni_corsi`: la fatturazione non viene toccata.

Azione su una sessione di griglia → dialog "Ripeti ogni <giorno> per tutta la stagione":
1. Crea una riga `corsi` (nome, `giorno` derivato dalla data, `ora_inizio`/`ora_fine`, `risorsa_id`, `stagione_id`, `livello_id`, costi/listino chiesti nel dialog — gli stessi campi del `CorsoWizard` di oggi, ridotti al minimo).
2. Copia gli atleti della sessione in `iscrizioni_corsi` (con `ragione_sociale_id`/`listino` ereditati dall'atleta, come già fa oggi la riga fatturazione per iscrizione).
3. Copia gli istruttori in `corsi_istruttori`.
4. Aggiunge `griglia_sessioni.corso_id` (nuova colonna nullable): la sessione originaria resta "l'occorrenza di partenza" ed è ora tracciata come istanza di quel corso.
5. Genera le occorrenze successive. Due opzioni sul dove:
   - **Scelta consigliata**: generare direttamente *sessioni di griglia* nei giorni futuri (creando i blocchi mancanti), e usare `planning_corsi_settimana` solo in sola lettura durante la transizione. Una sola fonte di verità operativa.
   - Alternativa più conservativa: continuare a generare `planning_corsi_settimana` e far leggere alla griglia anche quelle righe. Meno rotture, ma due fonti da tenere allineate — da evitare oltre la fase transitoria.

Eccezioni per singolo giorno: già ottenibili con la griglia stessa (si modifica/cancella la sessione di quel giorno senza toccare il corso). Serve solo un flag `modificata_manualmente` sulla sessione, per non farla sovrascrivere da una ri-generazione.

### c-bis) La proposta/pacchetto nasce PRIMA della programmazione

Il bottone "Ripeti per tutta la stagione" resta, ma non è più l'unico modo in cui nasce un pacchetto. I due percorsi convivono:

- **Bottom-up** (già descritto sopra): compongo la giornata a mano, poi la promuovo a pacchetto ricorrente.
- **Top-down** (necessario per la modalità "per proposta"): creo prima la proposta commerciale con orari e prezzo, raccolgo le adesioni, e poi la trascino sulla Griglia già piena di iscritti.

Modello dati: **una occorrenza di proposta = una riga `corsi`** (con `giorno`, `ora_inizio`, `ora_fine`, `risorsa_id`, costi, `capienza_max`) + le sue `iscrizioni_corsi`. Nessuna tabella nuova per il pacchetto. L'unica aggiunta è il raggruppamento commerciale:

- `corsi.proposta_nome` (text) oppure, più pulito, `corsi.proposta_id` → tabella leggera `proposte` (`club_id`, `stagione_id`, `nome`, `descrizione`, `livello_id`, `attiva`). Preferibile la seconda: permette di rinominare la proposta senza toccare le occorrenze e di elencare "Stellina 2" con le sue 3 occorrenze settimanali come un'unica voce commerciale.
- Ogni occorrenza mantiene iscrizioni proprie: un atleta aderisce a **una** occorrenza specifica, e viene fatturato per quella (o per la somma delle occorrenze/proposte a cui ha aderito). Questa è esattamente la semantica attuale di `iscrizioni_corsi`: nulla cambia in fatturazione.
- Nella Griglia, il pool "per proposta" elenca le occorrenze `corsi` della stagione compatibili col giorno programmato (di default quelle con `giorno` = giorno della data; con opzione "mostra tutte" per casi eccezionali come recuperi).

Interfaccia di gestione: **estendere `CoursesPage.tsx`, non creare una pagina nuova.** Serve:
- raggruppamento visivo delle righe `corsi` per proposta (oggi sono un elenco piatto);
- azione "Aggiungi occorrenza" su una proposta esistente (duplica giorno/orario/prezzo, iscrizioni vuote);
- la gestione adesioni è già lì (`iscrizioni_corsi` + `FatturazioneIscrizioneRow`) e resta invariata.

Quindi il punto (c) da solo non basta: la fase 5 va sdoppiata in "creazione proposte + adesioni" (top-down) e "promozione a ricorrente" (bottom-up).

## d) Dati storici del club reale

Nessuna cancellazione. Migrazione in due passi, entrambi reversibili:

1. Seed `risorse_strutture` + backfill `risorsa_id` su `griglia_blocchi`, `disponibilita_ghiaccio`, `corsi` (tutti gli 8 corsi sono ghiaccio → tutti sulla pista seed).
2. Backfill opzionale on-demand: uno script che, per una settimana scelta, converte le righe `planning_corsi_settimana` non annullate in blocchi/sessioni di griglia (atleti da `iscrizioni_corsi.attiva`, istruttori da `corsi_istruttori`). Si lancia prima sulla settimana corrente per collaudo, poi eventualmente sullo storico.

Le 80 occorrenze passate restano dove sono e continuano a servire lo storico/le presenze: non è necessario convertirle per far partire il nuovo sistema.

## e) Rilascio a fasi

| Fase | Contenuto | Rischio |
|---|---|---|
| 1 | `risorse_strutture` + backfill + CRUD risorse in Setup Club. Nessun cambio di comportamento. | Nullo |
| 2 | `griglia_blocchi.risorsa_id`, selettore risorsa nella pagina Griglia, durate libere al posto dei 20'. | Basso (1 blocco esistente) |
| 3 | Blocco reale sulla disponibilità istruttori nel drag-and-drop (vedi sotto). | Basso |
| 4 | Griglia su risorse `palestra` (stesso componente) + specialità con `ambito`. | Basso |
| 5a | Proposte/pacchetti: tabella `proposte` + raggruppamento e "aggiungi occorrenza" in `CoursesPage`. Adesioni invariate. | Basso (additivo) |
| 5b | Modalità pool "per proposta" nel `GrigliaBuilder` (toggle per sessione) + `origine_pool`/`corso_id` su `griglia_sessioni`. | Medio |
| 5c | "Ripeti per tutta la stagione" → `corsi`/`iscrizioni_corsi` + generazione occorrenze. Prima su una settimana pilota. | Medio-alto: tocca fatturazione |
| 6 | Viste settimana/mese/stagione sopra le giornate; `MeseView` riadattata a leggere dalla griglia. | Medio |
| 7 | Planning attuale in sola lettura, poi archiviato. | Da decidere con Roberto |

Il Planning attuale resta pienamente funzionante fino alla fase 6 inclusa. La griglia è additiva: finché un club non attiva la modalità, non vede nulla di nuovo — si riusa il meccanismo `moduli_gestione_club` già in produzione (area `ghiaccio`), aggiungendo un'area `planning`.

## f) Rischi e punti aperti

1. **Disponibilità istruttori per giorno-della-settimana, non per data**: `disponibilita_istruttori` ha `giorno` testuale. Il blocco "duro" richiesto funziona su questo modello, ma non gestisce assenze puntuali (malattia il 14 marzo). Serve decidere se aggiungere eccezioni per data prima di rendere il blocco non aggirabile — altrimenti l'utente resta bloccato senza via d'uscita. Proposta: blocco duro + override esplicito riservato a presidente/DT, con motivo registrato.
2. **Doppia fonte di verità istruttori**: a DB non esiste (nessuna colonna `corsi.istruttori_ids`). Va comunque verificato che la UI non tenga un array locale divergente da `corsi_istruttori`.
3. **Nessuna FK dichiarata su gran parte dello schema** (annotato in `docs/SCHEMA_DB.md`): le nuove colonne `risorsa_id` vanno create *con* FK e indici, per non allargare il problema.
4. **Capienza**: `configurazione_ghiaccio` è per club, non per risorsa. Con più piste il limite va spostato sulla risorsa.
5. **Doppio trigger su `comunicazioni`** già segnalato: le convocazioni generate dalla griglia off-ice erediterebbero il problema. Da chiudere prima della fase 4.
6. **Presenze**: `presenze_corso` è legata a `corso_id`+data. Se le occorrenze nascono dalla griglia senza corso (giornate una tantum), le presenze restano scoperte. Serve `presenze` collegabile alla sessione di griglia.
7. **Stagione**: `griglia_blocchi` non ha `stagione_id`. Con l'archiviazione multi-stagione già in uso altrove, va aggiunto (derivabile dalla data, ma meglio esplicito).
8. **Atleta iscritto a proposte con orari sovrapposti**: oggi `iscrizioni_corsi` non ha alcun controllo di conflitto. Trascinando due proposte diverse sullo stesso orario lo stesso atleta finirebbe in due sessioni contemporanee. Serve un controllo in due punti: avviso all'iscrizione in `CoursesPage` (soft, il club può volerlo) e blocco duro nella Griglia (un atleta non può stare in due sessioni sovrapposte della stessa giornata, su qualsiasi risorsa).
9. **Pool "per proposta" vuoto**: legittimo e frequente a inizio stagione. Il contenitore va mostrato comunque, con conteggio "0 iscritti" e scorciatoia "Gestisci adesioni" verso il corso, e non deve essere trascinabile finché è vuoto (altrimenti si crea una sessione fantasma senza atleti).
10. **Doppio inserimento dello stesso atleta**: in modalità mista (una sessione per livello, una per proposta nello stesso giorno) è facile duplicare un atleta. `griglia_sessioni_atleti` deve avere un unique su `(sessione_id, atleta_id)` e la UI deve segnalare l'atleta già collocato altrove nella giornata.
11. **Disallineamento proposta ↔ sessione**: se dopo il drag qualcuno si iscrive o si cancella dal corso, la sessione già creata non si aggiorna. Scelta consigliata: la sessione è uno snapshot, con un indicatore "3 nuovi iscritti non presenti in questa sessione" e un'azione "risincronizza", mai un aggiornamento automatico silenzioso.

## Domanda aperta prima di partire

Sul punto (c) serve una decisione: la generazione stagionale scrive **sessioni di griglia** (fonte unica, più pulita, ma il Planning attuale smette di vedere quei corsi) oppure **`planning_corsi_settimana`** (compatibilità totale, ma due fonti da sincronizzare)? La raccomandazione è la prima, con il Planning in sola lettura dalla fase 5.
