---
name: Campi ed Eventi
description: Modulo a 2 tab — Campo Interno (mini-stagione con planning, sessioni, iscrizioni) e Campo Esterno (scheda info + comunicazione famiglie). Pre/Post Season rimossi: gli eventi presso club terzi vanno modellati come "eventi esterni unificati" tramite tabelle eventi_esterni / iscrizioni_eventi_esterni
type: feature
---
La pagina /campi-eventi ha 2 tab:
- **Campo Interno**: tabelle `eventi_campi` (modalita='interno') + `sessioni_campo` per planning dedicato + `iscrizioni_eventi_campi`.
- **Campo Esterno**: scheda informativa (modalita='esterno') con bottone "Invia comunicazione famiglie" che crea record in `comunicazioni`.

Le ex tab Pre Season e Post Season sono state rimosse perché modellavano impropriamente la partecipazione ad eventi presso club terzi come fossero campi interni con planning ghiaccio. La nuova architettura prevede:
- Tabella `eventi_esterni` (campo `tipo`: pre_season | post_season | stage | raduno | altro), con dati struttura ospitante (nome, città, contatti), date e disciplina. Niente planning/sessioni locali.
- Tabella `iscrizioni_eventi_esterni` (atleta_id, evento_esterno_id, quota_atleta, quota_club, stato_pagamento).
- Le rotte legacy `/pre-season` e `/post-season` reindirizzano a `/campi-eventi`.
- La tabella `post_season_atlete` è stata droppata (era seed vuoto).
