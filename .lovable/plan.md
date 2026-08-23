# Fase 5 — rifiniture 1, 3 e 4 (Proposte / Griglia Ghiaccio)

## Cosa ho verificato nel codice reale

- `use-griglia-ghiaccio.ts` ha **già** un motore di conflitti: `_sessioni_sovrapposte(sessione_id)` (tutte le sotto-sessioni dello stesso giorno, su qualunque risorsa, che si sovrappongono nel tempo) + `verifica_conflitto_atleta`, `verifica_conflitto_gruppo`, `verifica_conflitto_istruttore`, con etichetta leggibile (`_etichetta_sessione`).
- Il blocco duro per l'atleta è già attivo: nel drag singolo atleta, nel drag del pool "per proposta" (percorso `individuale`) e nel drag di un pool a livello non definito; inoltre `use_assegna_atleta_sessione` ricontrolla lato mutation (anti race condition).
- **Buco reale**: il drag di un **gruppo dinamico per livello** (`use_assegna_gruppo_sessione`) verifica solo che *lo stesso gruppo* non sia già altrove; gli **atleti** del gruppo vengono inseriti senza controllo individuale, e solo dopo l'inserimento `avvisa_sovrapposizione()` mostra un toast informativo. Quindi oggi un atleta può finire in due sessioni sovrapposte passando dal gruppo per livello. Questo copre gran parte dei punti 1 (parte Griglia) e 3.
- `iscrizioni_corsi` non ha **nessun** controllo di sovrapposizione. Punti di inserimento trovati: `CoursesPage.tsx` (`do_iscrivi`, il flusso principale da scheda corso), `use-supabase-mutations.ts` (approvazione di una `richieste_iscrizione`), `portale/profilo/CorsiTab.tsx` (l'atleta crea solo una *richiesta*, non un'iscrizione).
- Sessione "per proposta": è collegata via `griglia_sessioni.corso_id` (+ `proposta_nome` derivato). Gli atleti trascinati dal pool proposta finiscono in `griglia_sessioni_atleti` **senza** `gruppo_sessione_id` (NULL), esattamente come gli atleti aggiunti a mano: **oggi non c'è modo di distinguere lo snapshot della proposta dagli inserimenti manuali**. È il nodo principale del punto 2.

## Proposta: un solo motore di controllo per i punti 1 e 3

Sì, si unificano. Un'unica funzione `verifica_conflitti_atleti(sessione_id, atleta_ids[])` in `use-griglia-ghiaccio.ts` che riusa `_sessioni_sovrapposte` e ritorna la lista dei conflitti (atleta → sessione in conflitto, orario, etichetta). Nessun secondo meccanismo, nessun concetto separato di "duplicato livello vs proposta": due sessioni sovrapposte con lo stesso atleta sono lo stesso identico problema, qualunque sia la modalità di origine.

### 1a — Blocco duro nella Griglia (completamento)

- Nel drag del **gruppo per livello**: prima di `assegna_gruppo.mutateAsync`, risolvere i membri e chiamare `verifica_conflitti_atleti`. Se ci sono conflitti → `AlertDialog` bloccante che elenca **chi** e **con quale sessione/orario** (stesso stile di `set_conflitto_atleta` già esistente), con due scelte: *Annulla* oppure *Aggiungi solo i non in conflitto* (N su M). Nessuna scrittura parziale silenziosa.
- Nel drag del **pool proposta**: oggi il primo conflitto interrompe tutto il ciclo lasciando eventuali atleti già inseriti; passare allo stesso controllo preventivo in blocco (verifica tutti → poi scrivi), così l'operazione è atomica dal punto di vista dell'utente.
- Guardia lato mutation invariata (`use_assegna_atleta_sessione` continua a rilanciare l'errore).

### 1b — Avviso soft nell'iscrizione a un corso

- Nuovo helper `src/lib/conflitti-iscrizioni.ts`: dato `atleta_id` e il corso di destinazione (giorno + ora_inizio/ora_fine), cerca le altre `iscrizioni_corsi` attive dell'atleta su `corsi` con **stesso `giorno`** e orario sovrapposto, e restituisce l'elenco.
- Uso in `CoursesPage.tsx → do_iscrivi`: se ci sono sovrapposizioni, **non bloccare**; mostrare un dialog di conferma "Sovrapposizione oraria" con l'elenco dei corsi in conflitto e i pulsanti *Annulla* / *Iscrivi comunque*. In alternativa, se preferisci zero attrito, solo un toast warning dopo l'iscrizione — vedi domanda D3.
- Stesso avviso, in forma di badge/riga informativa, nel widget di approvazione di una richiesta di iscrizione (l'operatore vede il conflitto prima di approvare).
- Corsi senza `giorno`/orario ("da pianificare") sono esclusi dal controllo.

### 3 — Vincolo lato dati

Il controllo applicativo sopra copre il caso d'uso; un vincolo DB davvero equivalente (nessun atleta in due sessioni **sovrapposte**) richiede un trigger, perché un semplice UNIQUE non può esprimere l'overlap. Proposta: trigger `BEFORE INSERT ON griglia_sessioni_atleti` che rifiuta l'inserimento se l'atleta è già in una sessione sovrapposta dello stesso giorno e la sessione di destinazione non è marcata come forzata. È l'unica parte che richiede una migrazione. Da confermare (D5): se preferisci restare application-side per ora, si può rimandare senza perdere funzionalità visibile.

## 2 — Indicatore di disallineamento proposta ↔ sessione

Serve prima poter distinguere lo snapshot della proposta dagli atleti aggiunti a mano. Due strade:

- **A (consigliata, richiede migrazione minima)**: colonna `origine text` (o `da_corso_id uuid`) su `griglia_sessioni_atleti`, valorizzata quando l'atleta arriva dal pool proposta. Il confronto snapshot ↔ `iscrizioni_corsi` diventa esatto e la risincronizzazione non tocca mai gli atleti aggiunti a mano.
- **B (zero migrazioni)**: confronto puramente derivato — per una sessione con `corso_id`, "nuovi iscritti" = iscritti attivi del corso non presenti in sessione; "rimossi" = atleti in sessione non più iscritti al corso. Semplice, ma non distingue un atleta aggiunto a mano di proposito da un "residuo" da rimuovere: la risincronizzazione rischierebbe di cancellarlo.

Con A o B, la UI è la stessa:
- Badge sulla `SessioneBox` quando c'è divergenza: `+N nuovi` / `-M rimossi` (colore attenzione, non errore).
- Popover al click con l'elenco nominativo diviso in due sezioni e un pulsante **"Risincronizza"** esplicito; opzionalmente checkbox per applicare solo alcune voci. Mai automatico, mai silenzioso.
- La risincronizzazione applica anche il controllo di conflitto del punto 1 (un nuovo iscritto già presente altrove viene segnalato e non inserito).

## Domande aperte da confermare con il cliente

- **D1 — Overlap o intera giornata?** Il motore attuale blocca solo le sovrapposizioni *orarie*. Il punto 3 parla di "stesso atleta nella stessa giornata". Confermo l'interpretazione "sovrapposizione oraria" (un atleta può legittimamente avere ghiaccio la mattina e palestra la sera)?
- **D2 — Override per staff.** Vuoi un override sul modello già esistente per gli istruttori / per la disponibilità ghiaccio (Presidente/DT possono forzare indicando un motivo, con audit trail `forzato_da`/`forzato_at`)? Oggi per gli atleti il blocco è assoluto, senza scampo. Il caso "l'atleta ha un buon motivo per essere in due posti" (arriva a metà, fa mezz'ora in un gruppo e mezz'ora in un altro) è reale? Se sì, l'override è necessario e vale la pena registrare il motivo.
- **D3 — Iscrizione a corso: dialog di conferma o solo toast?** Il primo interrompe il flusso ma si fa notare; il secondo non rallenta ma si può ignorare.
- **D4 — Punto 2, opzione A o B?** Cioè: accettiamo una piccola migrazione su `griglia_sessioni_atleti` per distinguere in modo affidabile lo snapshot dagli inserimenti manuali, o restiamo su un confronto derivato con il rischio descritto?
- **D5 — Vincolo DB (trigger) sì o no?** Serve davvero una barriera lato database, o la doppia guardia applicativa (UI + mutation) è sufficiente per questo giro?
- **D6 — Fratelli/sorelle.** Non ho trovato in `atleti` alcun campo di raggruppamento familiare, quindi tecnicamente non è un caso da escludere: due fratelli sono due `atleta_id` distinti e non generano alcun conflitto. Confermi che il caso citato non richiede nulla?

## Perimetro e rischio

| Voce | Stima | Rischio |
|---|---|---|
| Motore unificato conflitti atleti (batch) | bassa | basso — riusa codice esistente |
| Blocco duro su drag gruppo per livello + proposta | media | basso |
| Avviso soft in iscrizione corso | bassa/media | basso |
| Indicatore disallineamento + risincronizzazione | media | medio (dipende da D4) |
| Trigger DB anti-overlap | bassa | medio — può bloccare flussi legittimi se D2 non è risolta prima |

Non tocco: Planning classico, vista Giorno esistente, viste Fase 6, fatturazione, regole di forzatura disponibilità ghiaccio.
