# Date svizzere nella lingua dell’utente

## Obiettivo
Mantenere il formato svizzero con i punti, ma usare i nomi di giorni e mesi nella lingua scelta nell’applicazione.

## Modifiche
- Sostituire il locale fisso del formattatore centrale con una funzione che legge la lingua corrente ogni volta e restituisce `it-CH`, `de-CH`, `fr-CH`, `en-CH` o `rm-CH`, con ripiego `it-CH`.
- Allineare la mappa dei locali alle stesse cinque varianti svizzere e fare in modo che tutte le funzioni centrali usino questa unica convenzione.
- Sostituire in tutto `src/` le formattazioni locali di date e orari con gli aiutanti centrali, preservando per ciascun punto le opzioni visuali esistenti.
- Impostare `lang="it"` nel documento iniziale e sincronizzare `document.documentElement.lang` quando cambia la lingua dell’applicazione.
- Non modificare database, funzioni delle lezioni private o traduzioni.

## Verifica
- Provare `22.09.2026` in italiano e controllare che il formato breve conservi i punti.
- Verificare che il formato lungo produca “lunedì” e “settembre” in italiano, poi i corrispondenti nomi tedeschi dopo il cambio lingua.
- Ripetere la ricerca completa per confermare che in `src/` non restino locali scritti a mano nella formattazione di date e orari.
- Confermare `lang="it"` e il suo aggiornamento dinamico.
- Eseguire il controllo dei tipi e rileggere integralmente ogni file modificato; nel riepilogo riportare tutti i punti trovati e corretti con file e riga.
