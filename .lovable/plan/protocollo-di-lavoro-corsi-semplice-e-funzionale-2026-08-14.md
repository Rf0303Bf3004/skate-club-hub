# Protocollo di lavoro corsi: semplice e funzionale

Obiettivo: un percorso unico e ripetibile per costruire la stagione, senza dover capire ogni volta se partire dai corsi o dal planning.

## Il protocollo in 4 passi

```text
1. PREPARA        2. DUPLICA           3. COLLOCA            4. CHIUDI
   ghiaccio +   ->  stagione            slot + istruttore  ->  controlli
   istruttori       precedente          (wizard/planning)      finali
```

1. **Prepara la base** — fasce ghiaccio e disponibilità istruttori della nuova stagione. Senza queste, nessun corso può diventare "Completo".
2. **Duplica la stagione precedente** — copia i corsi (nome, tipo, livello, costi, giorno/ora, istruttori) nella nuova stagione. Gli iscritti NON vengono copiati.
3. **Colloca ciò che resta** — i corsi duplicati che non hanno più uno slot valido finiscono in "Da pianificare" e si risolvono col wizard esistente (corso → slot → istruttore).
4. **Chiudi** — un pannello di controllo mostra cosa manca prima di considerare la stagione pronta.

## Cosa costruisco

### A. Duplica stagione (nuovo)
- Pulsante "Duplica da stagione precedente" nella pagina Corsi.
- Dialogo: scegli la stagione sorgente, vedi l'elenco dei corsi con checkbox (tutti selezionati di default), scegli se copiare anche giorno/ora e istruttori.
- Al salvataggio: crea i corsi nella stagione corrente e ricopia le righe `corsi_istruttori`.
- Dopo la copia, ogni corso viene rivalutato: se lo slot non è più dentro una fascia ghiaccio valida o l'istruttore non è più disponibile, il corso resta senza collocazione e va in "Da pianificare".

### B. Barra di avanzamento stagione (nuovo)
In cima alla pagina Corsi, una riga con quattro contatori cliccabili:
- Corsi completi
- Da pianificare (senza giorno/ora)
- Senza istruttore valido
- Fuori fascia ghiaccio

Ogni contatore filtra la lista sotto, così il lavoro diventa "svuota le tre colonne rosse".

### C. Wizard sempre a portata di mano
- Il wizard di posizionamento (già esistente) viene richiamato direttamente dalla card del corso incompleto, precompilato con quel corso.
- Nel passo "slot" resta la proposta automatica del miglior abbinamento (ghiaccio valido + capienza ok + istruttore disponibile) in cima alla lista, evidenziata, ma tutte le opzioni valide restano selezionabili: suggerimento sì, imposizione no.

### D. Creazione dal planning
Click su una fascia ghiaccio libera nel planning → mini-form che crea il corso già ancorato a quel giorno/ora, con la lista dei soli istruttori disponibili in quella fascia.

## Note tecniche
- Nessuna modifica allo schema: si riusano `corsi`, `corsi_istruttori`, `disponibilita_ghiaccio`, `disponibilita_istruttori`, `stagioni`.
- La duplicazione filtra per `club_id` e scrive con lo `stagione_id` corrente.
- La regola di completezza resta quella attuale (`check_corso_completo` in `src/hooks/use-supabase-data.ts`), usata anche per i contatori.
- Il wizard riusa `src/components/planning/PosizionamentoWizard.tsx` senza duplicare logica.

## Ordine di consegna
1. Barra di avanzamento + filtri (feedback immediato su cosa manca)
2. Duplica stagione precedente
3. Wizard richiamabile dalla card corso + proposta automatica evidenziata
4. Creazione corso dal planning
