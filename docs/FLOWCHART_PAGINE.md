# FLOWCHART PAGINE — Ice Arena Manager

> Diagrammi Mermaid per le pagine principali. Per ogni pagina: load, tab, salva/elimina, trigger DB, toast/redirect.
> I diagrammi mostrano il flusso UI→React Query→Supabase, evidenziando i trigger DB attivi.

---

## /atleti — Lista atleti

```mermaid
flowchart TD
  A[/atleti] --> B[useAtleti: SELECT * FROM atleti WHERE club_id=?]
  B --> C[useAdesioniAtleta: SELECT iscrizioni_corsi attive]
  C --> D[Sort per livello hierarchy + cognome]
  D --> E{Azione}
  E -->|Click row| F[/atleti/id]
  E -->|+ Nuovo atleta| G[Apre AtletaDetail vuoto]
  E -->|Importa| H[/import-atleti]
  E -->|Filtra| I[Stato locale, no DB call]
```

## /atleti/{id} — Scheda atleta

```mermaid
flowchart TD
  A[/atleti/id] --> B[SELECT atleti WHERE id=?]
  B --> C[Render AtletaDetail con 10 tab]
  C --> D{Tab attiva}
  D -->|Anagrafica| E[Form 25+ campi]
  D -->|Livello| F[Form livello_*]
  D -->|Corsi| G[SELECT iscrizioni_corsi WHERE atleta_id]
  D -->|Gare| H[SELECT iscrizioni_gare]
  D -->|Medagliere| I[Aggregato iscrizioni_gare.medaglia]
  D -->|Genitori| J[Campi genitore1_*/genitore2_*]
  D -->|Fatture| K[SELECT fatture WHERE atleta_id]
  D -->|Lezioni| L[SELECT lezioni_private_atlete]
  D -->|Calendario| M[Calcolo corsi+lezioni future]
  D -->|Storico Test| N[SELECT test_livello_atleti]

  E --> SAVE[Click Salva]
  F --> SAVE
  J --> SAVE
  SAVE --> M1[UPDATE atleti SET ...]
  M1 --> T1{Trigger atleti_valida_eta_monitrice BEFORE}
  T1 -->|età<12 e flag monitrice| ERR[RAISE EXCEPTION → toast errore]
  T1 -->|ok| T2[Trigger atleti_sync_staff AFTER]
  T2 --> T3{e_monitrice o e_aiuto_monitrice cambiato?}
  T3 -->|attivato| T4[INSERT/UPDATE istruttori riga collegata]
  T3 -->|disattivato| T5[UPDATE istruttori SET stato_staff=sospeso]
  T2 --> OK[Toast verde + invalidate query atleti]

  E -->|Click flag Monitrice| MOD[Apri CompensoStaffModal]
  MOD --> MS[Save → UPDATE istruttori compenso]
  MOD --> MC[Annulla → rollback flag]
```

## /campi-eventi

```mermaid
flowchart TD
  A[/campi-eventi] --> B[SELECT eventi_campi WHERE club_id]
  B --> C[Lista card]
  C --> D{Azione}
  D -->|+ Nuovo| E[FormDialog 9 campi]
  D -->|Edit| E
  D -->|Iscrivi atleti| F[Multi-select atleti]
  E --> G[INSERT/UPDATE eventi_campi]
  F --> H[INSERT iscrizioni_eventi_campi]
  G --> OK[Toast + invalidate]
  H --> OK
```

## /comunicazioni

```mermaid
flowchart TD
  A[/comunicazioni] --> B[SELECT comunicazioni + destinatari]
  B --> C{Tab}
  C -->|Tutte/Iscrizioni| D[Lista filtrata]
  C -->|Nuova| E[ComunicazioneFormSection]
  E --> F[Compose: tipo_destinatari, titolo, testo, urgente, RSVP]
  F --> G[INSERT comunicazioni]
  G --> T1[Trigger trg_popola_destinatari AFTER INSERT]
  T1 --> T2[Trigger trg_popola_destinatari_comunicazione AFTER INSERT ⚠️ duplicato]
  T2 --> H{tipo_destinatari?}
  H -->|staff| I[INSERT comunicazioni_destinatari_staff per ogni utente]
  H -->|atleti/corsi/livelli| J[INSERT comunicazioni_destinatari per ogni atleta]
  H -->|planning_corso_id| K[get_atleti_impattati_da_planning → INSERT]
  J --> OK[Toast verde]
  D -->|Click| L[Apri dettaglio + marca letta]
```

## /corsi

```mermaid
flowchart TD
  A[/corsi] --> B[SELECT corsi + corsi_istruttori + iscrizioni_corsi + corsi_monitori]
  B --> C[Lista con mini-planning preview]
  C --> D{Azione}
  D -->|+ Nuovo corso| E[CorsoWizard step-by-step]
  D -->|Click corso| F[Tab info/iscrizioni/monitori/presenze]
  E --> G[INSERT corsi]
  G --> H[INSERT corsi_istruttori M:M delete-then-insert]
  H --> I[INSERT capacita_corsi]
  I --> OK[Toast]
  F -->|Tab iscrizioni| J[INSERT/UPDATE iscrizioni_corsi]
  F -->|Tab monitori| K[INSERT/UPDATE corsi_monitori]
  F -->|Tab presenze| L[INSERT presenze_corso per data+corso]
  J --> AS{Auto-sync planning?}
  AS -->|sì| M[Genera planning_corsi_settimana per settimane future]
```

## Dashboard

```mermaid
flowchart TD
  A[/] --> B[Multi-query in parallelo]
  B --> C1[useAtleti]
  B --> C2[useCorsi]
  B --> C3[useFatture]
  B --> C4[useRichiesteIscrizione]
  B --> C5[useComunicazioni]
  B --> C6[useIstruttori]
  C1 --> D[Render card per ruolo via dashboard_card_permessi]
  D --> E{Click card}
  E -->|KPI atleti| F[/atleti]
  E -->|Agenda corsi| G[/planning]
  E -->|Richieste| H[/richieste-iscrizione]
  E -->|Comunicazione rapida| I[Inline form → INSERT comunicazioni]
  I --> T1[Trigger popola_destinatari]
```

## /fatture

```mermaid
flowchart TD
  A[/fatture] --> B[SELECT fatture WHERE club_id ORDER BY data_scadenza]
  B --> C[Lista con badge stato]
  C --> D{Azione}
  D -->|+ Nuova| E[Form 14 campi]
  D -->|Genera QR| F[qrserver.com con dati SPC 0200]
  D -->|Marca pagata| G[UPDATE fatture SET pagata=true, data_pagamento=now]
  D -->|Invia email| H[Edge fn → UPDATE email_inviata_at]
  E --> I[INSERT fatture con numero auto]
  I --> OK[Toast + invalidate]
```

## /gare

```mermaid
flowchart TD
  A[/gare] --> B{Tab}
  B -->|Elenco| C[SELECT gare_calendario + iscrizioni_gare + risultati_gara]
  B -->|Medagliere| D[Aggregato iscrizioni_gare.medaglia per stagione]
  C --> E{Azione}
  E -->|+ Nuova gara| F[Form 13 campi]
  E -->|Click gara| G[Tab atleti/risultati/dettagli]
  F --> H[INSERT gare_calendario]
  G -->|Iscrivi atleta| I[INSERT iscrizioni_gare con disciplina, livello]
  G -->|Import PDF| J[Edge fn parse-gara-pdf → INSERT risultati_gara + elementi_gara]
  G -->|Manuale risultato| K[INSERT/UPDATE risultati_gara]
  J --> OK[Toast verde]
  K --> OK
```

## /gestione-avanzata

```mermaid
flowchart TD
  A[/gestione-avanzata] --> B[Bottoni azioni distruttive]
  B --> C{Azione scelta}
  C -->|Elimina atleti filtrati| D[Conferma typing ELIMINA]
  C -->|Cancella ricorrenze planning| E[Conferma typing CONFERMA]
  C -->|Purge comunicazioni 90gg| F[RPC cleanup_archived_communications]
  D -->|confermato| G[DELETE atleti WHERE id IN ...]
  E -->|confermato| H[DELETE planning_corsi_settimana ricorrenti]
  F --> I[Toast: N comunicazioni eliminate]
  G --> OK[Toast + invalidate]
  H --> OK
```

## /istruttori

```mermaid
flowchart TD
  A[/istruttori] --> B[SELECT istruttori + disponibilita_istruttori]
  B --> C{Tab filtro}
  C -->|Istruttori| D[livello_istruttore=istruttore]
  C -->|Aiuto monitrici| E[livello_istruttore=aiuto_monitrice]
  C -->|Monitrici| F[livello_istruttore=monitrice]
  D --> G{Click istruttore}
  E --> G
  F --> G
  G --> H[Scheda 4 tab]
  H -->|Informazioni| I[Form anagrafica]
  H -->|Compenso| J[CompensoStaffModal con 4 modalità]
  H -->|Ore lavoro| K[INSERT ore_lavorate_istruttori]
  H -->|Disponibilità| L[CRUD disponibilita_istruttori multi-slot/giorno]
  I --> SAVE[UPDATE istruttori]
  J --> SAVE
  L --> M[Validazione no overlap stesso giorno]
  G -->|Da atleta linkato| N[Link a /atleti/id via linked_atleta_id]
```

## /lezioni-private

```mermaid
flowchart TD
  A[/lezioni-private] --> B[SELECT lezioni_private + lezioni_private_atlete]
  B --> C[Vista calendar/lista]
  C --> D{Azione}
  D -->|+ Nuova| E[Form: istruttore, data, ora, atleti, durata]
  D -->|Annulla| F[UPDATE annullata=true, data_revoca=today]
  E --> G[Slot passati disabilitati]
  G --> H[INSERT lezioni_private]
  H --> I[INSERT lezioni_private_atlete delete-then-insert]
  I --> J{Sync con planning?}
  J -->|sì| K[INSERT planning_private_settimana]
  H --> OK[Toast]
  F --> OK
```

## /planning-ghiaccio

```mermaid
flowchart TD
  A[/planning] --> B[SELECT planning_settimane WHERE club_id+stagione_id]
  B --> C[SELECT planning_corsi_settimana + planning_private_settimana per settimana]
  C --> D[Render 3 colonne lun-mer / gio-sab / domenica]
  D --> E{Azione}
  E -->|Genera settimana| F[RPC genera_settimana_planning settimana_id]
  E -->|Build mode click slot| G[INSERT planning_corsi_settimana o evento extra]
  E -->|Annulla corso| H[AnnullaCorsoDialog]
  E -->|Sposta corso| I[SpostaCorsoDialog]
  E -->|Avvisa atleti| J[AvvisaAtletiDialog]
  H --> K[UPDATE annullato=true]
  K --> L[INSERT comunicazioni con planning_corso_id]
  L --> T1[Trigger popola_destinatari → fan-out atleti]
  I --> M[UPDATE data/ora_inizio/ora_fine]
  J --> L
  F --> N[Crea righe da template corsi]
```

## /richieste-iscrizione

```mermaid
flowchart TD
  A[/richieste-iscrizione] --> B[SELECT richieste_iscrizione WHERE stato=in_attesa]
  B --> C[Lista card]
  C --> D{Azione admin}
  D -->|Accetta| E[INSERT iscrizioni_corsi attiva=true]
  E --> F[UPDATE richiesta stato=accettata]
  F --> G[INSERT richieste_iscrizione_storiche]
  D -->|Rifiuta| H[UPDATE richiesta stato=rifiutata + note_risposta]
  G --> I[Notify genitore via comunicazione/push]
  H --> I
```

## /setup-club

```mermaid
flowchart TD
  A[/setup-club] --> B{Tab}
  B -->|Configurazione| C[SELECT clubs + club_identity]
  B -->|Ghiaccio Planning| D[SELECT configurazione_ghiaccio + impostazioni_planning + disponibilita_ghiaccio]
  B -->|Catalogo Offerta| E[SELECT catalogo_pacchetti_opzionali]
  B -->|Fatturazione| F[SELECT setup_club upsert]
  C --> G[UPDATE clubs]
  D --> H[UPSERT configurazione_ghiaccio + CRUD disponibilita_ghiaccio]
  E --> I[CRUD catalogo_pacchetti_opzionali]
  F --> J[UPSERT setup_club WHERE club_id=?]
  G --> OK[Toast]
  H --> OK
  I --> OK
  J --> OK
```

## /stagioni

```mermaid
flowchart TD
  A[/stagioni] --> B[SELECT stagioni ORDER BY data_inizio DESC]
  B --> C{Azione}
  C -->|+ Nuova stagione| D[NuovaStagionePage wizard non-distruttivo]
  C -->|Edit| E[Form nome/date/corrente]
  D --> F[Snapshot atleti_storici, lezioni_storiche, ecc.]
  E --> G[UPDATE stagioni]
  F --> OK[Toast + redirect /]
```

## /test

```mermaid
flowchart TD
  A[/test] --> B[SELECT test_livello + test_livello_atleti]
  B --> C{Azione}
  C -->|+ Nuovo test| D[Form 5 campi]
  C -->|Edit test| D
  C -->|Iscrivi atleti| E[Multi-select]
  C -->|Registra esiti| F[UPDATE test_livello_atleti.esito]
  D --> G[INSERT/UPDATE test_livello]
  E --> H[INSERT test_livello_atleti]
  F --> I{esito=superato?}
  I -->|sì| J[UPDATE atleti.livello_attuale]
  I -->|no| K[Solo update test_livello_atleti]
  J --> OK[Toast + storico aggiornato]
```

## /utenti

```mermaid
flowchart TD
  A[/utenti] --> B[SELECT utenti_club WHERE club_id]
  B --> C[Lista utenti con ruolo]
  C --> D{Azione}
  D -->|+ Invita| E[Form email + ruolo]
  E --> F[Edge fn manage-user: crea auth.users + invio email]
  F --> G[INSERT utenti_club]
  D -->|Cambia ruolo| H[UPDATE utenti_club.ruolo]
  D -->|Disattiva| I[UPDATE utenti_club.attivo=false]
```

## /gestione-ruoli

```mermaid
flowchart TD
  A[/ruoli-permessi] --> B[SELECT ruoli_permessi_sezioni + dashboard_card_permessi]
  B --> C[Matrice ruolo × sezione]
  C --> D{Click checkbox}
  D --> E[UPSERT ruoli_permessi_sezioni visibile=?]
  C --> F[Sub-tab Dashboard cards]
  F --> G[UPDATE dashboard_card_permessi.visibile/ordine]
  E --> OK[Toast + invalidate menu]
  G --> OK
```

## /eventi — Galà ed Eventi

```mermaid
flowchart TD
  A[/eventi] --> B[SELECT eventi_pubblici WHERE club_id]
  B --> C[Lista card]
  C --> D{Azione}
  D -->|+ Nuovo| E[Form: nome, data, tipo, descrizione, partecipanti_stimati]
  D -->|Iscrivi| F[INSERT iscrizioni_eventi]
  E --> G[INSERT eventi_pubblici]
  G --> OK[Toast]
```

---

## Riepilogo

- **21 flowchart** generati (uno per pagina principale)
- Tutti includono: load DB queries, tab attiva, mutation principali, trigger DB rilevanti, esito (toast/redirect)
- Trigger DB più critici evidenziati:
  - `atleti_sync_staff` (sincronizza istruttori da flag atleta)
  - `atleti_valida_eta_monitrice` (vincolo età ≥12)
  - `popola_destinatari_comunicazione` (fan-out destinatari, ⚠️ duplicato)
