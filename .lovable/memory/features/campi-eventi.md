---
name: Campi ed Eventi
description: Modulo unificato con 4 tab — Campo Interno (mini-stagione con planning dedicato e iscrizioni), Campo Esterno (scheda info + comunicazione manuale famiglie), Post Season (report PDF club + per atleta), Pre Season (wizard nuova stagione con copia struttura corsi)
type: feature
---
La pagina /campi-eventi raggruppa quattro funzionalità in tab:
- **Campo Interno**: tabelle `eventi_campi` (modalita='interno') + `sessioni_campo` per planning dedicato + `iscrizioni_eventi_campi` per gestire le iscrizioni atleti.
- **Campo Esterno**: scheda informativa (modalita='esterno') con bottone "Invia comunicazione famiglie" che crea record in `comunicazioni` (tipo_destinatari='tutti').
- **Post Season**: KPI stagione + generazione PDF tramite `window.open` (report club + report individuale per ogni atleta).
- **Pre Season**: wizard a 3 step (anagrafica stagione → selezione corsi da copiare dalla stagione origine → conferma) che crea nuova stagione non attiva e duplica i corsi selezionati.

La voce di menu si chiama "Campi ed Eventi" (icona Sparkles), distinta dalla voce legacy "Campi di Allenamento" (/campi).
