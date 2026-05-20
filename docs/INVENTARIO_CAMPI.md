# INVENTARIO CAMPI — Ice Arena Manager

> Inventario sistematico dei campi presenti nelle pagine principali dell'app.
> Mapping UI label → tabella/colonna Supabase + tipo + required + validazione.
> Le pagine sono in ordine alfabetico. I tab per ogni pagina sono ricavati dai `<TabsTrigger>` nel codice React.
> "Required FE" = required nel form React; "Required BE" = NOT NULL in DB o validato in mutation.

Legenda:
- `req FE/BE` = Y / N / —
- Tipo: text, num, sel, chk, date, time, area (textarea), file, multi (multi-select)

---

## /atleti — Lista atleti (`AthletesPage.tsx`)

Filtri visualizzazione, nessun campo persistito:
| Campo | Tipo | Tabella DB | Colonna DB | req FE | req BE | Note |
|------|-----|-----------|------------|--------|--------|------|
| Ricerca testo (nome/cognome/email) | text | — | — | N | — | Filtro locale |
| Filtro categoria | sel | — | — | N | — | pulcini/agonista/amatori |
| Filtro livello (3 sezioni: Base/Artistica/Stile) | multi | — | — | N | — | Vedi mem `filtri-livello` |
| Filtro stato (attivo/inattivo) | sel | atleti | attivo | N | — | — |
| Solo agonisti | chk | atleti | agonista | N | — | — |
| Solo monitrici/aiuto | chk | atleti | e_monitrice / e_aiuto_monitrice | N | — | — |

## /atleti/{id} — Scheda Atleta (`AtletaDetail.tsx`)

### Tab "Anagrafica"
| Campo | Tipo | Tabella | Colonna | FE | BE | Validazione |
|------|-----|---------|---------|----|----|-------------|
| Codice atleta | text (auto) | atleti | codice_atleta | N | N | Auto da `genera_codice_atleta()` |
| Nome | text | atleti | nome | Y | Y(NOT NULL) | — |
| Cognome | text | atleti | cognome | Y | Y | — |
| Sesso | sel (M/F) | atleti | sesso | N | N | — |
| Data nascita | date | atleti | data_nascita | N | N | Trigger: ≥12 anni se monitrice |
| Categoria | sel | atleti | categoria | Y | Y | default `pulcini` |
| Codice fiscale | text | atleti | codice_fiscale | N | N | — |
| Indirizzo | text | atleti | indirizzo | N | N | — |
| Telefono | text | atleti | telefono | N | N | — |
| Foto | file | atleti | foto_url | N | N | Bucket `foto-atleti` |
| Tag NFC | text | atleti | tag_nfc | N | N | — |
| Disco musicale | file | atleti | disco_url | N | N | Bucket `dischi-musicali` |
| Disco in preparazione | text | atleti | disco_in_preparazione | N | N | — |
| Note | area | atleti | note | N | N | — |
| Licenza SIS — Numero | text | atleti | licenza_sis_numero | N | N | — |
| Licenza SIS — Categoria | text | atleti | licenza_sis_categoria | N | N | — |
| Licenza SIS — Disciplina | text | atleti | licenza_sis_disciplina | N | N | — |
| Licenza SIS — Valida fino a | date | atleti | licenza_sis_validita_a | N | N | — |
| Atleta federazione | chk | atleti | atleta_federazione | N | N | — |
| Agonista | chk | atleti | agonista | N | Y(NOT NULL) | — |
| Stato (attivo) | chk | atleti | attivo | N | N | derivato anche da iscrizioni_corsi |
| Verificato | chk | atleti | verificato | N | Y | — |
| Aiuto monitrice (≥12 anni) | chk | atleti | e_aiuto_monitrice | N | Y | Trigger validazione età; mutuamente esclusivo con `e_monitrice`; apre `CompensoStaffModal` |
| Monitrice (≥12 anni) | chk | atleti | e_monitrice | N | Y | Idem |
| Ruolo pista | sel | atleti | ruolo_pista | N | N | atleta/monitore/aiuto_monitore (legacy) |
| Genitore 1 nome/cognome/tel/email | text | atleti | genitore1_* | N | N | 4 campi |
| Genitore 2 nome/cognome/tel/email | text | atleti | genitore2_* | N | N | 4 campi opzionali |

### Tab "Livello"
| Campo | Tipo | Tabella | Colonna | FE | BE | Validazione |
|------|-----|---------|---------|----|----|-------------|
| Livello attuale | sel | atleti | livello_attuale | Y | N | enum livelli (no traduzione) |
| Livello in preparazione | sel | atleti | livello_in_preparazione | N | N | — |
| Livello amatori | sel (Stellina 1..4 o NULL) | atleti | livello_amatori | N | N | **CHECK constraint** `livello_amatori IN (NULL, 'Stellina 1'..'Stellina 4')` |
| Livello artistica (corrente) | sel | atleti | livello_artistica | N | N | — |
| Livello artistica (in preparazione) | sel | atleti | livello_artistica_in_preparazione | N | N | — |
| Livello stile (corrente) | sel | atleti | livello_stile | N | N | — |
| Livello stile (in preparazione) | sel | atleti | livello_stile_in_preparazione | N | N | — |
| Carriera artistica | sel | atleti | carriera_artistica | N | N | — |
| Carriera stile | sel | atleti | carriera_stile | N | N | — |
| Ore pista stagione (sola lettura) | num | atleti | ore_pista_stagione | N | N | Aggiornato da presenze |

### Tab "Corsi"
Sola lettura: lista iscrizioni attive (da `iscrizioni_corsi`); mostra anche flag `salto_livello`. Bottoni: + Iscrivi, Disiscrivi (mutation INSERT/UPDATE su `iscrizioni_corsi`).

### Tab "Gare"
Sola lettura: lista da `iscrizioni_gare WHERE atleta_id=?`. Bottoni: Iscrivi a gara.

### Tab "Medagliere"
Sola lettura: aggregato medaglie da `iscrizioni_gare.medaglia` filtrato per atleta.

### Tab "Genitori"
Stessi campi `genitore1_*` / `genitore2_*` dell'anagrafica + bottone "Invita genitore" → crea riga in `inviti_genitori` (token permanente).

### Tab "Fatture"
Sola lettura: `SELECT * FROM fatture WHERE atleta_id=?`. Bottone "Crea fattura" → vedi /fatture.

### Tab "Lezioni"
Sola lettura: lezioni private associate via `lezioni_private_atlete`.

### Tab "Calendario"
View interattiva `CalendarioAtletaInterattivo` — aggrega corsi schedulati + lezioni private future. Nessun salvataggio.

### Tab "Storico Test"
Sola lettura: `StoricoTestAtleta` → query su `test_livello_atleti WHERE atleta_id=?`.

---

## /campi-eventi (`CampiEventiPage.tsx`)

| Campo | Tipo | Tabella | Colonna | FE | BE | Note |
|------|-----|---------|---------|----|----|------|
| Nome | text | eventi_campi | nome | Y | Y | — |
| Modalità (interno/esterno) | sel | eventi_campi | modalita | Y | Y | default `interno` |
| Data inizio | date | eventi_campi | data_inizio | N | N | — |
| Data fine | date | eventi_campi | data_fine | N | N | — |
| Luogo | text | eventi_campi | luogo | N | N | — |
| Costo | num | eventi_campi | costo | N | N | CHF |
| Descrizione | area | eventi_campi | descrizione | N | N | — |
| Contatti | text | eventi_campi | contatti | N | N | — |
| Note | area | eventi_campi | note | N | N | — |
| Iscrizioni atleti (M:M) | multi | iscrizioni_eventi_campi | atleta_id | — | — | sub-table |

---

## /comunicazioni (`CommunicationsPage.tsx`)

### Tab "Tutte" / "Iscrizioni"
Visualizzazione lista. Filtri: tipo, stato, urgente.

### Form composizione comunicazione
| Campo | Tipo | Tabella | Colonna | FE | BE | Note |
|------|-----|---------|---------|----|----|------|
| Tipo destinatari | sel | comunicazioni | tipo_destinatari | Y | Y | tutti/livelli/corsi/atleti/staff |
| Atleti destinatari | multi | comunicazioni | atleti_ids[] | N | N | Trigger `popola_destinatari` |
| Corsi destinatari | multi | comunicazioni | corsi_ids[] | N | N | — |
| Livelli destinatari | multi | comunicazioni | livelli[] | N | N | — |
| Atleta singolo | sel | comunicazioni | atleta_id | N | N | — |
| Corso singolo | sel | comunicazioni | corso_id | N | N | — |
| Planning corso (per avviso variazione) | sel | comunicazioni | planning_corso_id | N | N | — |
| Evento straordinario | sel | comunicazioni | evento_straordinario_id | N | N | — |
| Gara | sel | comunicazioni | gara_id | N | N | — |
| Test livello | sel | comunicazioni | test_livello_id | N | N | — |
| Titolo | text | comunicazioni | titolo | Y | Y | — |
| Testo (breve) | area | comunicazioni | testo | Y | Y | — |
| Corpo (esteso) | area | comunicazioni | corpo | N | N | — |
| Urgente | chk | comunicazioni | urgente | N | Y | default false |
| Richiede RSVP | chk | comunicazioni | richiede_rsvp | N | Y | default false |
| RSVP scadenza | date+time | comunicazioni | rsvp_scadenza | N | N | — |
| Programmata per | date+time | comunicazioni | programmata_per | N | N | — |
| Deep link | text | comunicazioni | deep_link | N | N | — |
| Tipo | sel | comunicazioni | tipo | Y | Y | default `generica` |

⚠️ Trigger duplicato su INSERT (`trg_popola_destinatari` ×2) → potenziale doppia popolazione `comunicazioni_destinatari`.

---

## /corsi (`CoursesPage.tsx`)

### Lista
Filtri: stato, tipo, livello, percorso. Mini-planning preview (mem `mini-planning-preview`).

### Form/scheda corso — Tab "Informazioni"
| Campo | Tipo | Tabella | Colonna | FE | BE | Note |
|------|-----|---------|---------|----|----|------|
| Nome | text | corsi | nome | Y | Y | — |
| Tipo | sel | corsi | tipo | N | N | ghiaccio/off-ice/altro |
| Categoria | sel | corsi | categoria | N | N | — |
| Percorso | sel | corsi | percorso | N | N | artistica/stile/null |
| Livello richiesto | sel | corsi | livello_richiesto | N | N | default `tutti` |
| Giorno | sel | corsi | giorno | N | N | Lunedì..Domenica (italiano!) |
| Ora inizio | time | corsi | ora_inizio | N | N | — |
| Ora fine | time | corsi | ora_fine | N | N | — |
| Usa ghiaccio | chk | corsi | usa_ghiaccio | N | Y | default true |
| Costo mensile | num | corsi | costo_mensile | N | N | CHF |
| Costo annuale | num | corsi | costo_annuale | N | N | CHF |
| Stagione | sel | corsi | stagione_id | N | N | — |
| Attivo | chk | corsi | attivo | N | N | default true |
| Richiede approvazione | chk | corsi | richiede_approvazione | N | Y | — |
| Note | area | corsi | note | N | N | — |
| Capacità max | num | capacita_corsi | capacita_max | N | N | — |
| Ore settimanali dedicate | num | capacita_corsi | ore_settimanali_dedicate | N | N | — |

### Tab "Iscrizioni" (richiede corso completo)
- M:M `iscrizioni_corsi` (atleta_id, corso_id, attiva, salto_livello, note_salto_livello)

### Tab "Monitori"
- M:M `corsi_monitori` (corso_id, persona_id, tipo) — `tipo` ∈ {monitore, aiuto_monitore}
- M:M `corsi_istruttori` (corso_id, istruttore_id)

### Tab "Presenze"
- INSERT/UPDATE in `presenze_corso` (corso_id, atleta_id, data, presente, note)

---

## /dashboard (`DashboardPage.tsx`)

Widget di sola lettura; alcune card editabili tramite redirect. Nessun form persistente diretto. Cards:
- KPI Hero (atleti/corsi/fatture/incassi)
- Agenda corsi giornaliera (auto-archivia passati)
- Comunicazione rapida → redirect a /comunicazioni
- Richieste iscrizione pending
- Istruttori disponibili
- Compleanni (edge fn `birthday-greetings`)

---

## /fatture (`InvoicesPage.tsx`)

| Campo | Tipo | Tabella | Colonna | FE | BE | Note |
|------|-----|---------|---------|----|----|------|
| Numero | text (auto) | fatture | numero | N | N | — |
| Atleta | sel | fatture | atleta_id | Y | N | — |
| Tipo | sel | fatture | tipo | N | N | default `Generica` |
| Periodo | text | fatture | periodo | N | N | es. "2025-09" |
| Descrizione | area | fatture | descrizione | N | N | — |
| Importo | num | fatture | importo | Y | N | CHF |
| Data emissione | date | fatture | data_emissione | N | N | default CURRENT_DATE |
| Data scadenza | date | fatture | data_scadenza | Y | N | — |
| Data pagamento | date | fatture | data_pagamento | N | N | — |
| Pagata | chk | fatture | pagata | N | N | default false |
| Stato | sel | fatture | stato | N | N | — |
| Riferimento (corso/lezione/...) | sel | fatture | riferimento_id | N | N | — |
| Note | area | fatture | note | N | N | — |
| Email inviata at | (auto) | fatture | email_inviata_at | — | — | Set da edge fn |

Bottoni: "Genera QR Swiss" (vedi mem `qr-payment`), "Marca pagata", "Invia email".

---

## /gare (`CompetitionsPage.tsx`)

### Tab "Elenco gare"
| Campo | Tipo | Tabella | Colonna | FE | BE | Note |
|------|-----|---------|---------|----|----|------|
| Nome gara | text | gare_calendario | nome | Y | Y | — |
| Data | date | gare_calendario | data | N | N | — |
| Ora | time | gare_calendario | ora | N | N | — |
| Luogo | text | gare_calendario | luogo | N | N | UI usa `localita` come alias |
| Indirizzo | text | gare_calendario | indirizzo | N | N | — |
| Club ospitante | text | gare_calendario | club_ospitante | N | N | — |
| Livello minimo | sel | gare_calendario | livello_minimo | N | N | — |
| Carriera | sel | gare_calendario | carriera | N | N | Artistica/Stile/Entrambe |
| Costo iscrizione | num | gare_calendario | costo_iscrizione | N | N | — |
| Costo accompagnamento | num | gare_calendario | costo_accompagnamento | N | N | — |
| Stagione | sel | gare_calendario | stagione_id | N | N | — |
| Archiviata | chk | gare_calendario | archiviata | N | N | — |
| Note | area | gare_calendario | note | N | N | — |

### Tab "Atleti iscritti" (modal/dettaglio)
M:M via `iscrizioni_gare` con campi: disciplina, carriera, livello_atleta, costo_iscrizione, costo_accompagnamento, note.

### Tab "Risultati"
INSERT/UPDATE su `risultati_gara` e `elementi_gara` (importati da PDF tramite edge fn `parse-gara-pdf`).

### Tab "Dettagli"
Sola lettura riepilogo.

### Tab "Medagliere"
Aggregato da `iscrizioni_gare.medaglia`.

---

## /gestione-avanzata (`AdvancedManagementPage.tsx`)

Azioni distruttive (richiedono typing "ELIMINA" o "CONFERMA"). Nessun campo form, solo bottoni:
- Eliminazione massiva atleti per filtro
- Cancellazione ricorrenze planning
- Reset cassa stagione
- Purge comunicazioni archiviate (>90gg) — `cleanup_archived_communications()`

---

## /gestione-ruoli (`RuoliPermessiPage.tsx`)

| Campo | Tipo | Tabella | Colonna | FE | BE |
|------|-----|---------|---------|----|----|
| Ruolo | sel | ruoli_permessi_sezioni | ruolo | Y | Y |
| Sezione | sel | ruoli_permessi_sezioni | sezione | Y | Y |
| Visibile | chk | ruoli_permessi_sezioni | visibile | N | Y |
| Card dashboard | chk | dashboard_card_permessi | visibile | N | N |
| Ordine card | num | dashboard_card_permessi | ordine | N | N |

---

## /istruttori (`InstructorsPage.tsx`)

### Lista — Tab "Istruttori" / "Aiuto monitrici" / "Monitrici"
Filtri per `livello_istruttore` enum + `stato_staff` enum.

### Scheda — Tab "Informazioni"
| Campo | Tipo | Tabella | Colonna | FE | BE | Note |
|------|-----|---------|---------|----|----|------|
| Nome | text | istruttori | nome | Y | Y | — |
| Cognome | text | istruttori | cognome | Y | Y | — |
| Email | text | istruttori | email | N | N | — |
| Telefono | text | istruttori | telefono | N | N | — |
| Livello istruttore | sel | istruttori | livello_istruttore | Y | Y | enum {istruttore, monitrice, aiuto_monitrice} |
| Stato staff | sel | istruttori | stato_staff | N | Y | enum {attivo, sospeso, ...} |
| Specialità | text | istruttori | specialita | N | N | — |
| Colore | text (hex) | istruttori | colore | N | N | Per planning |
| Linked atleta | sel | istruttori | linked_atleta_id | N | N | Auto se da atleta |
| Note | area | istruttori | note | N | N | — |
| Attivo | chk | istruttori | attivo | N | N | default true |

### Tab "💶 Compenso" (modale `CompensoStaffModal`)
| Campo | Tipo | Tabella | Colonna | FE | BE | Note |
|------|-----|---------|---------|----|----|------|
| Tipo contratto | sel | istruttori | tipo_contratto | Y | Y | orario/fisso_mensile/fisso_corsi/misto |
| Prezzo vendita CHF/min | num | istruttori | costo_minuto_lezione_privata | condizionale | N (nullable) | **opzionale per aiuto_monitrice** (fix F4b-FIX3) |
| Costo orario corsi (CHF/h) | num | istruttori | costo_orario_corsi | condizionale | N | required se modalità prevede |
| Costo orario lezioni (CHF/h) | num | istruttori | costo_orario_lezioni | condizionale | N | — |
| Compenso fisso mensile | num | istruttori | compenso_fisso_mensile | condizionale | N | — |
| Compenso fisso corsi | (auto NULL) | istruttori | compenso_fisso_corsi | — | N | Sempre null in UI attuale |

### Tab "⏱️ Ore Lavoro"
- Visualizzazione + INSERT su `ore_lavorate_istruttori` (data, ore, tipo, note).

### Tab "Disponibilità"
- M:M `disponibilita_istruttori` (giorno, ora_inizio, ora_fine) — multi-slot per giorno, no overlap.

---

## /lezioni-private (`PrivateLessonsPage.tsx`)

| Campo | Tipo | Tabella | Colonna | FE | BE | Note |
|------|-----|---------|---------|----|----|------|
| Istruttore | sel | lezioni_private | istruttore_id | Y | N | — |
| Data | date | lezioni_private | data | Y | N | slot passati disabilitati |
| Ora inizio | time | lezioni_private | ora_inizio | Y | N | — |
| Ora fine | time | lezioni_private | ora_fine | N | N | — |
| Durata minuti | num | lezioni_private | durata_minuti | N | Y | default 20 |
| Ricorrente | chk | lezioni_private | ricorrente | N | Y | default false |
| Condivisa (max N atleti) | chk | lezioni_private | condivisa | N | Y | — |
| Atleti | multi | lezioni_private_atlete | atleta_id | Y | — | M:M |
| Costo totale | num | lezioni_private | costo_totale | N | Y | calcolato |
| Annullata | chk | lezioni_private | annullata | N | Y | — |
| Data revoca | date | lezioni_private | data_revoca | N | N | — |
| Richiede approvazione | chk | lezioni_private | richiede_approvazione | N | Y | default true |
| Note | area | lezioni_private | note | N | N | — |

---

## /planning-ghiaccio (`PlanningPage.tsx`)

Visualizzazione settimanale 3-colonne (mem `struttura-viste`). Modifiche tramite drag/drop e dialog.

### Slot corso (`planning_corsi_settimana`)
| Campo | Colonna | Note |
|------|---------|------|
| Data | data | derivata da `settimana_id.data_lunedi + giorno` |
| Ora inizio/fine | ora_inizio/ora_fine | — |
| Istruttore | istruttore_id | — |
| Annullato | annullato | trigger AvvisaAtletiDialog |
| Evento extra | is_evento_extra | corso non template |

### Slot lezione privata (`planning_private_settimana`)
Sync bi-direzionale con `lezioni_private` (mem `private-logic`).

### Dialog: Annulla corso / Sposta corso / Avvisa atleti
- AnnullaCorsoDialog → UPDATE `planning_corsi_settimana.annullato=true` + INSERT comunicazione automatica
- SpostaCorsoDialog → UPDATE ora_inizio/ora_fine/data
- AvvisaAtletiDialog → INSERT in `comunicazioni` con `planning_corso_id`

---

## /richieste-iscrizione (`RichiesteIscrizionePage.tsx`)

| Campo | Tipo | Tabella | Colonna | FE | BE | Note |
|------|-----|---------|---------|----|----|------|
| Atleta | sel | richieste_iscrizione | atleta_id | Y | Y | — |
| Corso | sel | richieste_iscrizione | corso_id (o riferimento_id) | Y | Y | — |
| Tipo | sel | richieste_iscrizione | tipo | N | N | default `corso` |
| Stato | sel | richieste_iscrizione | stato | Y | Y | in_attesa/accettata/rifiutata |
| Note richiesta | area | richieste_iscrizione | note_richiesta (alias `note`) | N | N | — |
| Note risposta | area | richieste_iscrizione | note_risposta | N | N | — |

Su accettazione: INSERT in `iscrizioni_corsi` + move record in `richieste_iscrizione_storiche`.

---

## /setup-club (`ClubSetupPage.tsx`)

### Tab "Configurazione"
| Campo | Tipo | Tabella | Colonna |
|------|-----|---------|---------|
| Nome club | text | clubs | nome |
| Città / CAP / Paese | text | clubs | citta/cap/paese |
| Email / Telefono / Sito | text | clubs | email/telefono/sito_web |
| Indirizzo | text | clubs | indirizzo |
| Logo | file | clubs | logo_url |
| Colore primario | text(hex) | clubs | colore_primario |
| Numero tessera federale | text | clubs | numero_tessera_federale |
| Descrizione | area | clubs | descrizione |

### Tab "Ghiaccio e Planning"
| Campo | Tabella | Colonna |
|------|---------|---------|
| Ora apertura/chiusura default | configurazione_ghiaccio | ora_apertura_default / ora_chiusura_default |
| Durata pulizia (min) | configurazione_ghiaccio | durata_pulizia_minuti |
| Max atleti contemporanei | configurazione_ghiaccio | max_atleti_contemporanei |
| Max atleti per istruttore | configurazione_ghiaccio | max_atleti_per_istruttore |
| Max atleti lezione privata | configurazione_ghiaccio | max_atleti_lezione_privata |
| Min atleti attivazione corso | configurazione_ghiaccio | min_atleti_attivazione_corso |
| Modalità costo privata | configurazione_ghiaccio | modalita_costo_privata |
| Durata slot (min) | impostazioni_planning | durata_slot_minuti |
| Slot ghiaccio settimanali | disponibilita_ghiaccio | giorno, ora_inizio, ora_fine |

### Tab "Catalogo Offerta" (`CatalogoOffertaTab.tsx`)
| Campo | Tabella | Colonna |
|------|---------|---------|
| Nome pacchetto | catalogo_pacchetti_opzionali | nome |
| Tipo | catalogo_pacchetti_opzionali | tipo (default `altro`) |
| Costo annuale | catalogo_pacchetti_opzionali | costo_annuale |
| Costo mensile | catalogo_pacchetti_opzionali | costo_mensile |
| Costo 1/2 sessioni | catalogo_pacchetti_opzionali | costo_1_sessione / costo_2_sessioni |
| Durata (min) | catalogo_pacchetti_opzionali | durata_minuti |
| Richiede approvazione | catalogo_pacchetti_opzionali | richiede_approvazione |
| Attivo | catalogo_pacchetti_opzionali | attivo |
| Note | catalogo_pacchetti_opzionali | note |

### Tab "Fatturazione" (`FatturazioneTab.tsx`)
- Setup IBAN, intestatario, sede, dati emittente — tabella `setup_club` (record unico per club_id, upsert).

---

## /stagioni (`SeasonsPage.tsx`)

| Campo | Tabella | Colonna |
|------|---------|---------|
| Nome | stagioni | nome |
| Data inizio | stagioni | data_inizio |
| Data fine | stagioni | data_fine |
| Corrente | stagioni | corrente |

---

## /test (`TestLivelloPage.tsx`)

### Test livello (sessione)
| Campo | Tabella | Colonna |
|------|---------|---------|
| Nome | test_livello | nome |
| Data | test_livello | data |
| Sede | test_livello | sede |
| Livello target | test_livello | livello |
| Note | test_livello | note |

### Atleti al test
| Campo | Tabella | Colonna |
|------|---------|---------|
| Atleta | test_livello_atleti | atleta_id |
| Esito | test_livello_atleti | esito (superato/non superato) |
| Note | test_livello_atleti | note |

Su esito superato → UPDATE `atleti.livello_attuale`.

---

## /utenti (`UtentiPage.tsx`)

| Campo | Tabella | Colonna |
|------|---------|---------|
| Email | (auth.users via edge fn `manage-user`) | email |
| Ruolo | utenti_club | ruolo |
| Club | utenti_club | club_id |
| Attivo | utenti_club | attivo |

---

## /eventi (`EventiPage.tsx`) — Galà & Eventi

| Campo | Tabella | Colonna |
|------|---------|---------|
| Nome | eventi_pubblici | nome_evento |
| Data | eventi_pubblici | data_evento |
| Tipo | eventi_pubblici | tipo (default `evento`) |
| Partecipanti stimati | eventi_pubblici | partecipanti_stimati |
| Descrizione | eventi_pubblici | descrizione |

⚠️ Possibile sovrapposizione con `eventi_straordinari`.

---

## Riepilogo inventario

- **22 pagine** documentate (escluse `LoginPage`, `NotFound`, `PortaleAtletaPage`, `TestMobileAuthPage`, `Index`, `SuperAdmin*`, `PresidentRelazione*` che hanno UI dedicate fuori scope generale)
- **~230 campi** inventariati su 23 tabelle principali
- Vedi `SCHEMA_DB.md` per dettagli tabelle e anomalie
