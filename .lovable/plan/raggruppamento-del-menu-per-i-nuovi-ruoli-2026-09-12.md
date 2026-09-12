# Raggruppamento del menu per i nuovi ruoli

## Intervento
- Riorganizzare la configurazione delle voci in quattro gruppi ordinati, mantenendo Dashboard e Comunicazioni al primo livello.
- Aggiornare esclusivamente il menu dei nuovi ruoli con gruppi collassabili, filtro permessi invariato, apertura automatica sulla rotta attiva e stato memorizzato localmente.
- Inserire Tabellone Fatture, Utenti, Convenzioni e Relazione nei gruppi richiesti, conservando esattamente le condizioni di visibilità attuali.
- Aggiungere le etichette mancanti in italiano, inglese, francese e tedesco.

## Vincoli preservati
- Menu legacy admin, funzione `render_group` e blocco SuperAdmin resteranno invariati.
- Nessun intervento su rotte, permessi, database o dipendenze.

## Verifica
- Eseguire il controllo TypeScript richiesto.
- Rileggere il blocco modificato e confrontare le aree legacy/SuperAdmin per confermarne l'integrità.
- Verificare quali gruppi risultano visibili per il ruolo istruttore con i permessi indicati.
