# SCHEMA DB — Ice Arena Manager

> Snapshot generato da analisi del database Supabase pubblico (`public` schema).
> Le tabelle elencate corrispondono allo stato corrente del progetto.
> Nessuna FOREIGN KEY dichiarata a livello DB: l'integrità referenziale è gestita
> a livello applicativo (vedi `lib/supabase.ts` e mutation in `use-supabase-mutations.ts`).
> Multi-tenancy: la quasi totalità delle tabelle ha colonna `club_id` (NOT NULL) usata come filtro applicativo.

## Indice tabelle (77 tabelle)

| # | Tabella | Colonne | Righe (snapshot) | Trigger | RLS principali | Note |
|--:|---------|--------:|-----------------:|---------|----------------|------|
| 1  | adesioni_atleta                 | 10 | — | — | Allow all auth, mobile_parent SELECT | **DEPRECATED**: superseduta da `iscrizioni_corsi.attiva` (vedi `use_adesioni_atleta` in use-supabase-data.ts) |
| 2  | atleti                          | 52 | 147 | `trg_atleti_set_portal_token` BEFORE INSERT, `trg_atleti_sync_staff` AFTER INSERT/UPDATE, `trg_atleti_valida_eta_monitrice` BEFORE INSERT/UPDATE | Allow all auth, mobile_parent SELECT/UPDATE su `id=mobile_atleta_id()` | Tabella centrale. Trigger sync su flag `e_monitrice` / `e_aiuto_monitrice` crea/aggiorna riga in `istruttori` |
| 3  | atleti_storici_stagioni         | 10 | — | — | Allow all auth | Snapshot per stagione (alimentata da Nuova Stagione Wizard) |
| 4  | bilancio_stagione               |  9 | — | — | Allow all auth | Cassa iniziale/finale, totale entrate/uscite |
| 5  | campi_allenamento               |  9 | — | — | Allow all auth | Sostituita logicamente da `eventi_campi`? Verificare |
| 6  | capacita_corsi                  |  7 | — | — | Allow all auth | Capacità max + ore settimanali per corso |
| 7  | cassa_movimenti                 |  9 | — | — | Allow all auth | Movimenti cassa (entrate/uscite) |
| 8  | catalogo_pacchetti_opzionali    | 15 | — | — | pacchetti_all_authenticated, public SELECT | Catalogo offerta del club (pacchetti aggiuntivi) |
| 9  | club_identity                   | 11 | — | — | Allow all auth | Identità/contatti/social del club (per relazione presidente) |
| 10 | clubs                           | 14 | — | — | Allow all auth, anon SELECT, mobile_parent SELECT | Multi-tenancy root |
| 11 | comunicazioni                   | 25 | — | `trg_popola_destinatari` AFTER INSERT, `trg_popola_destinatari_comunicazione` AFTER INSERT ⚠️ DUPLICATO | Allow all auth, mobile_parent SELECT | **ANOMALIA**: due trigger AFTER INSERT con stessa funzione → possibile doppio popolamento |
| 12 | comunicazioni_destinatari       | 10 | — | — | Allow all auth, mobile_parent SELECT/UPDATE | Destinatari atleti, RSVP, lettura |
| 13 | comunicazioni_destinatari_staff |  8 | — | — | Allow all auth | Destinatari interni (utenti staff) |
| 14 | comunicazioni_template          |  5 | — | — | Allow all auth | Template testuali riutilizzabili |
| 15 | configurazione_ghiaccio         | 13 | — | — | Allow all auth | Max atleti, durata pulizia, modalità costo |
| 16 | corsi                           | 18 | 4 | — | Allow all auth, anon SELECT, mobile_parent SELECT | — |
| 17 | corsi_istruttori                |  4 | — | — | Allow all auth | M:M corsi ↔ istruttori |
| 18 | corsi_monitori                  |  5 | — | — | Allow all auth | M:M corsi ↔ atleti-monitori, `tipo` ∈ {monitore, aiuto_monitore} |
| 19 | costi_istruttori                |  9 | — | — | Allow all auth | **DUPLICATO POTENZIALE** con `istruttori.compenso_*`. Da consolidare |
| 20 | dashboard_card_permessi         |  8 | — | — | dash_card_* per CRUD | Visibilità card dashboard per ruolo |
| 21 | device_tokens                   |  8 | — | — | owner-only (user_id OR atleta_id) | Push notification tokens |
| 22 | disponibilita_ghiaccio          |  9 | — | — | Allow all auth | Slot ghiaccio per giorno |
| 23 | disponibilita_istruttori        |  7 | — | — | Allow all auth | Slot disponibilità istruttore |
| 24 | elementi_gara                   |  9 | — | — | Allow all auth | Dettaglio elementi tecnici (importati da PDF) |
| 25 | eventi_campi                    | 13 | — | — | Allow all auth | Eventi campo (interni/esterni) |
| 26 | eventi_esterni                  | 16 | — | `trg_eventi_esterni_updated_at` BEFORE UPDATE | Allow all auth, anon SELECT | Stage pre-stagione esterni |
| 27 | eventi_pubblici                 |  9 | — | — | Allow all auth | **DUPLICATO?** rispetto a `eventi_straordinari` |
| 28 | eventi_straordinari             | 12 | — | — | Allow all auth, anon SELECT | Eventi extra in planning |
| 29 | fatture                         | 17 | 10 | — | Allow all auth, mobile_parent SELECT | Periodo, importo, stato, QR Swiss |
| 30 | gare_calendario                 | 16 | 8 | — | Allow all auth, anon SELECT, mobile_parent SELECT | Compat shim: l'UI legge anche `localita` (mappata da `luogo`) |
| 31 | impostazioni_planning           |  7 | — | — | Allow all auth | Durata slot, orari giornata |
| 32 | inviti_genitori                 |  8 | — | — | inviti_genitori_same_club | Token permanente, deep link mobile |
| 33 | iscrizioni_campo                |  6 | — | — | Allow all auth | Iscrizioni vecchio `campi_allenamento` |
| 34 | iscrizioni_corsi                |  7 | — | — | Allow all auth, mobile_parent SELECT | Fonte di verità "atleta attivo" |
| 35 | iscrizioni_eventi               |  6 | — | — | Allow all auth | Iscrizioni `eventi_pubblici` |
| 36 | iscrizioni_eventi_campi         |  6 | — | — | Allow all auth | Iscrizioni `eventi_campi` |
| 37 | iscrizioni_eventi_esterni       |  9 | — | `trg_iscrizioni_eventi_esterni_updated_at` BEFORE UPDATE | Allow all auth | Quota_club/atleta, stato pagamento |
| 38 | iscrizioni_gare                 | 16 | — | — | Allow all auth, mobile_parent SELECT | Disciplina, costi, risultati |
| 39 | iscrizioni_pacchetti            |  7 | — | — | iscr_pack_all_auth | Iscrizioni pacchetti opzionali (correnti) |
| 40 | iscrizioni_pacchetti_storiche   |  8 | — | — | Allow all auth | Snapshot per stagione |
| 41 | istruttori                      | 20 | 5 | — | Allow all auth | `linked_atleta_id` per monitrici interne, `stato_staff` enum |
| 42 | lezioni_private                 | 15 | 5 | — | Allow all auth | Costo totale, ricorrente, condivisa |
| 43 | lezioni_private_atlete          |  5 | — | — | Allow all auth | M:M lezione ↔ atleti |
| 44 | lezioni_private_storiche        |  9 | — | — | Allow all auth | Snapshot per stagione |
| 45 | livelli                         |  6 | — | — | — (default permissive) | Master livelli (Pulcini → Oro) |
| 46 | materiali_promo                 |  7 | — | — | — | Materiali promozionali sponsor |
| 47 | motivi_abbandono_aggregati      |  5 | — | — | — | Statistiche abbandono |
| 48 | ore_lavorate_istruttori         | 10 | — | — | — | **DUPLICATO con `ore_pista_disponibili`?** Da verificare |
| 49 | ore_pista_disponibili           |  8 | — | — | — | Vedi sopra |
| 50 | pacchetti_opzionali             | 10 | — | — | — | **DUPLICATO con `catalogo_pacchetti_opzionali`** — probabile tabella legacy |
| 51 | planning_corsi_settimana        | 18 | — | — | — | Slot corso istanza settimanale |
| 52 | planning_private_settimana      | 10 | — | — | — | Slot lezione privata istanza |
| 53 | planning_settimane              |  9 | — | — | — | Settimane di planning (drafts + reali) |
| 54 | presenze                        | 11 | — | — | — | Presenze giornaliere (pista) |
| 55 | presenze_corso                  |  6 | — | — | — | Presenze specifiche per corso/data |
| 56 | relazione_preferenze            |  9 | — | `update_relazione_preferenze_updated_at` BEFORE UPDATE | — | Preferenze report presidente |
| 57 | relazioni_allegati              | 13 | — | — | — | Allegati relazione presidente |
| 58 | relazioni_blocchi_testo         | 10 | — | `trg_relazioni_blocchi_updated` BEFORE UPDATE | — | Blocchi testo report |
| 59 | relazioni_paragrafi_auto        | 10 | — | `trg_relazioni_paragrafi_auto_updated_at` BEFORE UPDATE | — | Paragrafi auto-generati |
| 60 | ricavi_per_fonte                |  6 | — | — | — | Aggregato cassa |
| 61 | richieste_iscrizione            | 10 | — | — | — | Richieste pending da portale atleta |
| 62 | richieste_iscrizione_storiche   |  9 | — | — | — | Storico richieste evase |
| 63 | risultati_gara                  | 18 | — | — | — | Dettagli punteggio gara |
| 64 | risultati_storici_stagioni      |  7 | — | — | — | Snapshot |
| 65 | ruoli_permessi_sezioni          |  8 | — | `trg_ruoli_permessi_sezioni_updated_at` BEFORE UPDATE | — | Permessi sezione per ruolo |
| 66 | sessioni_campo                  |  9 | — | — | — | Sottosessioni campo estivo |
| 67 | setup_club                      | 21 | 1 | — | — | Configurazione unica del club (upsert) |
| 68 | sponsor                         | 15 | — | — | — | (Sezione menu marcata non_implementato) |
| 69 | sponsor_attivi                  | 10 | — | — | — | Vedi sopra |
| 70 | sponsor_categorie_cercate       |  7 | — | — | — | Vedi sopra |
| 71 | stagioni                        |  9 | 4 | — | — | Range date stagione |
| 72 | storico_livelli_atleta          |  8 | — | — | — | Storico cambi livello |
| 73 | test_livello                    | 15 | — | — | — | Eventi di test livello |
| 74 | test_livello_atleti             | 10 | — | — | — | Iscrizioni e esiti test |
| 75 | test_storici_stagioni           |  6 | — | — | — | Snapshot |
| 76 | tipi_corso                      |  4 | — | — | — | Lookup tipo corso |
| 77 | utenti_club                     |  9 | — | — | — | Mappa user_id ↔ club ↔ ruolo |

## Trigger DB attivi

| Tabella | Trigger | Quando | Funzione |
|---------|---------|--------|----------|
| atleti | trg_atleti_set_portal_token | BEFORE INSERT | `set_atleta_portal_token()` — genera UUID per accesso mobile |
| atleti | trg_atleti_valida_eta_monitrice | BEFORE INSERT/UPDATE | `atleti_valida_eta_monitrice()` — verifica età ≥12 se monitrice/aiuto |
| atleti | trg_atleti_sync_staff | AFTER INSERT/UPDATE | `atleti_sync_staff_trigger()` → `sync_atleta_to_staff()` crea/aggiorna riga in `istruttori` |
| comunicazioni | trg_popola_destinatari (×2) | AFTER INSERT | `popola_destinatari_comunicazione()` — popola destinatari atleti/staff. **⚠️ Duplicato: due trigger identici** |
| eventi_esterni | trg_eventi_esterni_updated_at | BEFORE UPDATE | `update_updated_at_column()` |
| iscrizioni_eventi_esterni | trg_iscrizioni_eventi_esterni_updated_at | BEFORE UPDATE | `update_updated_at_column()` |
| relazione_preferenze | update_relazione_preferenze_updated_at | BEFORE UPDATE | `update_updated_at_column()` |
| relazioni_blocchi_testo | trg_relazioni_blocchi_updated | BEFORE UPDATE | `update_updated_at_column()` |
| relazioni_paragrafi_auto | trg_relazioni_paragrafi_auto_updated_at | BEFORE UPDATE | `update_updated_at_column()` |
| ruoli_permessi_sezioni | trg_ruoli_permessi_sezioni_updated_at | BEFORE UPDATE | `update_updated_at_column()` |

## Function database custom

- `get_atleti_impattati_da_planning(planning_corso_id)` — lookup atleti da uno slot planning
- `sync_atleta_to_staff(atleta_id)` — sincronizza riga `istruttori` da flag atleta
- `atleti_sync_staff_trigger()` — wrapper trigger
- `atleti_valida_eta_monitrice()` — validation età ≥12
- `popola_destinatari_comunicazione()` — fan-out destinatari
- `genera_codice_atleta()` — sequenza globale `IA-NNNNNNN`
- `genera_settimana_planning(settimana_id)` — copia corsi-template nella settimana
- `slot_liberi_istruttore(istruttore_id, da, a)` — slot disponibili in date range
- `corsi_per_atleta(atleta_id)` — corsi visibili da portale atleta
- `cleanup_archived_communications()` — purge >90gg
- `mobile_atleta_id()`, `mobile_club_id()`, `is_mobile_parent()` — JWT helpers
- `set_atleta_portal_token()`, `update_updated_at_column()` — utility

## Anomalie segnalate

1. **Trigger duplicato su `comunicazioni`** — `trg_popola_destinatari` e `trg_popola_destinatari_comunicazione` puntano alla stessa funzione: rischio doppi destinatari su INSERT.
2. **Tabelle duplicate / probabili legacy**:
   - `pacchetti_opzionali` vs `catalogo_pacchetti_opzionali` (UI usa la seconda)
   - `ore_lavorate_istruttori` vs `ore_pista_disponibili`
   - `costi_istruttori` vs colonne compenso su `istruttori` (introdotte da F4b)
   - `eventi_pubblici` vs `eventi_straordinari`
   - `campi_allenamento` + `iscrizioni_campo` vs `eventi_campi` + `iscrizioni_eventi_campi`
3. **`adesioni_atleta` deprecata** — il codice usa `iscrizioni_corsi.attiva` ma la tabella resta nello schema con RLS attiva.
4. **Nessuna FK dichiarata in DB** — l'integrità è solo applicativa, rischio orfani in caso di DELETE diretta.
5. **Policy "Allow all for authenticated"** ovunque — la separazione per `club_id` è solo applicativa, non DB-enforced.
