# Calendario pubblico mensile a griglia

## Obiettivo
Trasformare la vista pubblica da elenco di giorni a calendario mensile riconoscibile, mantenendo invariati caricamento dati, navigazione, intestazioni ed errori.

## Modifiche
- Sostituire l’elenco completo con una griglia lunedì–domenica che includa tutti i giorni del mese e le celle di riempimento iniziali e finali.
- Rendere ogni giorno una cella quadrata e toccabile, distinguendo oggi, giorno selezionato e giorni senza attività.
- Mostrare nelle celle al massimo due indicatori di attività e un contatore `+n` per le restanti.
- Costruire i colori dagli identificativi distinti presenti nel campo `pista`, senza riconoscere o scrivere nomi di strutture nel codice.
- Selezionare automaticamente il primo giorno con attività quando cambia mese; al tocco mostrare sotto la griglia il dettaglio del giorno, compreso lo stato vuoto reale.
- Aggiungere in fondo una legenda generata dai valori `pista` presenti nel mese.
- Aggiungere soltanto le nuove etichette necessarie nei file calendario italiano, inglese, francese e tedesco.

## Dettagli tecnici
- Conservare le RPC, la gestione del codice, gli stati di caricamento/errore e le frecce esistenti.
- Calcolare localmente solo la struttura visuale del mese e il raggruppamento delle righe già restituite; nessuna regola di dominio o nuova lettura.
- Usare i componenti pulsante esistenti e classi responsive con sette colonne stabili, celle quadrate e larghezza minima effettiva superiore a 40 px a 360 px.
- Usare ruoli e descrizioni accessibili tradotte per ogni giorno e per gli indicatori.

## Verifiche
- Controllo tipi con `bunx tsc --noEmit`.
- Finestra anonima su `/calendario/stella`: settembre 2026 completo, selezione iniziale del primo giorno attivo e dettaglio corretto.
- Tocco di un giorno attivo e di uno vuoto, verificando che il secondo mostri un vuoto reale e non un errore.
- Controllo a 360 px: nessuno scorrimento orizzontale e celle almeno 40 px.
- Conferma che non siano state create migrazioni e che nessun altro file sia stato modificato.
