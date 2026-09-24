# Correggere il salvataggio iniziale della pista

## Diagnosi confermata
- La finestra “Nuova risorsa” invia già `tipo: "ghiaccio"` o `"palestra"`, quindi il vincolo sul tipo non è la causa.
- Lo stato impossibile nasce nell’onboarding: il passo disponibilità inserisce direttamente in `disponibilita_ghiaccio` con `risorsa_id` nullo e non tenta mai di creare `risorse_strutture`.

## Implementazione
1. Nel passo pista dell’onboarding, raccogliere anche il nome della pista e validarlo prima di scrivere.
2. Creare prima `risorse_strutture` con il club della sessione e `tipo: "ghiaccio"`; usare l’ID restituito per tutte le fasce.
3. Se la risorsa fallisce, non scrivere fasce e mostrare il motivo reale. Se le fasce falliscono, rimuovere soltanto la risorsa appena creata come compensazione; se anche il ripristino fallisce, dichiarare esplicitamente il risultato parziale.
4. Invalidare risorse, disponibilità e diagnosi dopo qualsiasi scrittura riuscita, anche quando il passo successivo fallisce.
5. Conservare campi e passaggio in caso d’errore; mostrare il messaggio verde solo dopo entrambe le scritture.
6. Aggiungere le etichette necessarie nelle cinque lingue e in `traduzioni_ui`, senza modificare schema, policy o funzioni.

## Verifica
- Controllo tipi, rilettura completa dei file modificati e prova dei tre esiti: risorsa fallita, fasce fallite con compensazione, successo completo.
- Verifica che le query usino sempre il club della sessione e che nessuna disponibilità nuova abbia `risorsa_id` nullo.
- La fascia orfana esistente resterà intatta. Riporterò tabella, ID e comando di rimozione proposto, da eseguire solo dopo conferma.
