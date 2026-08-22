# I18N TODO — Estrazione stringhe rimanenti

Stato attuale: Step 1 + Step 1.5a parziale.
- Step 1: architettura `react-i18next` + 11 namespace IT/FR/DE/EN.
- Step 1.5a (questo turno): Dashboard admin (visibile a `/`) + sidebar `MainLayout`.

Lo shim `useI18n()` / `t()` in `src/lib/i18n.tsx` continua a funzionare per i file legacy.

## File coperti finora (Step 1 + 1.5a)

### Step 1
- `src/pages/LoginPage.tsx` → `onboarding.login.*`
- `src/pages/RegisterClubPage.tsx` → `onboarding.register.*`
- `src/components/forms/FormDialog.tsx` → `common.actions.*`
- `src/components/sponsor/PitchTextEditorDialog.tsx` (parziale)
- `src/components/MainLayout.tsx` (selettore lingua)

### Step 1.5a (turno corrente)
- `src/components/MainLayout.tsx` (sidebar legacy + nuovi ruoli + superadmin + voci "Gestione Avanzata", "Gestione Ruoli", "Utenti", "Setup", "Relazione", "Cerca", tooltip "Prossimamente") → `common.menu.*`, `common.search*`, `common.coming_soon`, `common.relazione`, `common.setup`
- `src/pages/DashboardPage.tsx` (admin dashboard `/`): header "presenti in pista", 4 KPI cards, banner compleanni, banner fine stagione, header agenda + tab "Corsi & Appello"/"Istruttori", empty state agenda, "Lezioni private oggi", "Lezione privata", widget Compleanni, widget Fatture, widget Prossime gare, widget Comunicazioni, BoxComunicazione (template/destinatari/titolo/messaggio/urgente/save), tutti i toast → `dashboard.*`

### Chiavi nuove aggiunte
- `src/locales/it/common.json`: +~40 chiavi (`menu.*`, `search`, `search_aria`, `coming_soon`, `soon`, `setup`, `relazione`, `pending_requests_tooltip_one/_other`)
- `src/locales/it/dashboard.json`: ~80 chiavi totali (kpi, agenda, presenti_in_pista plurale, course_status, course_row, quick_comm.*, birthday_banner, season_banner, widgets, toast)

**IMPORTANTE**: le traduzioni FR/DE/EN per queste nuove chiavi NON sono state aggiunte. Il fallback i18next va automaticamente su IT. Roberto le tradurrà offline in fase 1.5b prima di Step 3.

## File ancora hard-coded (priorità ALTA)

### Pagine principali
- [x] `src/pages/AthletesPage.tsx` → `atleti.*`
- [x] `src/pages/InvoicesPage.tsx` → `fatture.invoices_page.*`
- [x] `src/pages/CommunicationsPage.tsx` → `communications.*`
- [x] `src/pages/CompetitionsPage.tsx` → `events.competitions.*`
- [x] `src/pages/CoursesPage.tsx` → `corsi.*` (nuovo namespace)
- [ ] `src/pages/PrivateLessonsPage.tsx`
- [ ] `src/pages/EventiPage.tsx`
- [ ] `src/pages/TestLivelloPage.tsx`
- [ ] `src/pages/TrainingCampsPage.tsx`
- [ ] `src/pages/InstructorsPage.tsx`
- [ ] `src/pages/SeasonsPage.tsx`
- [ ] `src/pages/ClubSetupPage.tsx`
- [ ] `src/pages/RuoliPermessiPage.tsx`
- [ ] `src/pages/UtentiPage.tsx`
- [ ] `src/pages/OnboardingPage.tsx`
- [ ] `src/pages/PortaleAtletaPage.tsx`
- [ ] `src/pages/RichiesteIscrizionePage.tsx`
- [ ] `src/pages/PlanningPage.tsx`
- [ ] `src/pages/NuovaStagionePage.tsx`
- [ ] `src/pages/MedagliereePage.tsx`
- [ ] `src/pages/CampiEventiPage.tsx`

### Dashboard presidente (componente XXL — ~2500 righe, da spezzare in più turni)
- [ ] `src/components/dashboard/PresidentDashboard.tsx`

### Widget dashboard (visibili nella colonna destra)
- [x] `src/components/dashboard/RichiesteIscrizioneWidget.tsx` → `dashboard.widget_richieste.*`, `widget_iscrizioni.*`, `widget_lezioni_private.*`, `relative_time.*`
- [x] `src/components/dashboard/IstruttoriDisponibiliWidget.tsx` → `dashboard.widget_istruttori.*`
- [x] `src/components/MedagliereWidget.tsx` → `dashboard.widget_medagliere.*`

### Pagine secondarie / superadmin
- [ ] `src/pages/AdvancedManagementPage.tsx`
- [ ] `src/pages/SuperAdminPage.tsx`
- [ ] `src/pages/SuperAdminClubPage.tsx`
- [ ] `src/pages/SuperAdminManutenzione.tsx`
- [ ] `src/pages/SuperAdminManutenzioneStr.tsx`
- [ ] `src/pages/ImportAtletiPage.tsx`
- [ ] `src/pages/PacchettiSponsorPage.tsx`
- [ ] `src/pages/PresidentRelazione.tsx`
- [ ] `src/pages/PresidentRelazioneGestione.tsx`
- [ ] `src/pages/LegalPlaceholderPage.tsx`
- [ ] `src/pages/NotFound.tsx`

### Componenti atleti
- [ ] `src/components/AtletaDetail.tsx` (~50 chiavi)
- [ ] `src/components/AthleteBadges.tsx`
- [ ] `src/components/SchedaAnagrafica.tsx`
- [ ] `src/components/CodiceAtletaCard.tsx`
- [ ] `src/components/CalendarioAtletaInterattivo.tsx`
- [ ] `src/components/StoricoTestAtleta.tsx`

### Componenti dashboard / shared
- [ ] `src/components/common/GlobalSearchPalette.tsx`
- [ ] `src/components/common/SearchableListLayout.tsx`
- [ ] `src/components/NavLink.tsx`
- [ ] `src/components/FatturazioneTab.tsx`
- [ ] `src/components/CatalogoOffertaTab.tsx`
- [ ] `src/components/CompensoStaffModal.tsx`
- [ ] `src/components/SessioniCampoEstivo.tsx`
- [ ] `src/components/ImportGaraPdf.tsx`
- [ ] `src/components/forms/DateInput.tsx`

### Componenti comunicazioni
- [ ] `src/components/comunicazioni/ComunicazioneFormSection.tsx`
- [ ] `src/components/comunicazioni/ConversazioniTab.tsx`
- [ ] `src/components/comunicazioni/IscrizioniAtletiNotifiche.tsx`
- [ ] `src/components/comunicazioni/MieiReminderStaffTab.tsx`
- [ ] `src/components/comunicazioni/RegoleComunicazioniSection.tsx`

### Componenti corsi / planning
- [ ] `src/components/corsi/CorsoWizard.tsx`
- [ ] `src/components/planning/AnnullaCorsoDialog.tsx`
- [ ] `src/components/planning/AvvisaAtletiDialog.tsx`
- [ ] `src/components/planning/MeseView.tsx`
- [ ] `src/components/planning/SpostaCorsoDialog.tsx`

### Componenti relazione (~15 file)
- [ ] `src/components/relazione/*.tsx`

### Componenti sponsor / ruoli
- [ ] `src/components/sponsor/PacchettoFormDialog.tsx`
- [ ] `src/components/sponsor/PitchPDFPreview.tsx`
- [ ] `src/components/ruoli-permessi/DashboardCardsPermessi.tsx`

## File esclusi (NON tradurre)
- `src/components/ui/*` (primitive shadcn)
- User content (DB-driven: clubs.mission, comunicazioni.titolo/testo, corsi.descrizione, ecc.)
- Codici tecnici (UUID, enum DB 'pulcini'/'artistica', codice_atleta AT-XXXX-XXXX)

## Procedura per Step 1.5b (traduzioni manuali Roberto)

Roberto:
1. Dump dei nuovi file IT modificati in questo turno:
   - `src/locales/it/common.json` (chiavi aggiunte: `menu.*`, `search`, `search_aria`, `coming_soon`, `soon`, `setup`, `relazione`, `pending_requests_tooltip_one/_other`)
   - `src/locales/it/dashboard.json` (~80 chiavi)
2. Traduzione offline in FR/DE/EN dei soli NUOVI valori (mantenendo le chiavi invariate).
3. Reimport dei JSON nei tre namespace già esistenti `src/locales/{fr,de,en}/{common,dashboard}.json`.

## Procedura per Step 1.5a-bis (prossimo turno Lovable)

Continuare estrazione partendo da:
1. `src/components/dashboard/RichiesteIscrizioneWidget.tsx` + `IstruttoriDisponibiliWidget.tsx` (visibili in dashboard admin)
2. `src/components/dashboard/PresidentDashboard.tsx` (file XXL — fare per sezioni)
3. Pagine principali in ordine `I18N_TODO.md`

## Note finali
- Selettore lingua attivo con IT/FR/DE/EN; le chiavi non tradotte fanno fallback automatico a IT.
- Locale `rm` mantenuto come slot vuoto (fallback IT).
- Shim `src/lib/i18n.tsx` ancora attivo per i file legacy.

## Da estrarre — Banner onboarding
- src/components/dashboard/OnboardingBanner.tsx (titolo, sottotitolo, 3 CTA, toast)


## Step 2 — Traduzioni gestite da DB (superadmin)

- Nuova tabella `public.traduzioni_ui` (namespace, chiave, it/de/fr/rm/en), unique su (namespace, chiave).
  Lettura pubblica (anche anon, serve prima del login), scrittura solo superadmin.
- Seed iniziale: 733 chiavi importate dai JSON `src/locales/{it,fr,de,en}/*.json` (14 namespace).
- Runtime: `src/i18n/db-loader.ts` (`carica_traduzioni_db`) viene invocato in `src/main.tsx` dopo l'init di
  i18next e fa merge sopra le resource statiche via `addResourceBundle`. Se il fetch fallisce, l'app continua
  con i soli JSON bundlati.
- UI: nuova tab "🌐 Traduzioni" in `SuperAdminPage.tsx` → `src/components/superadmin/TraduzioniTab.tsx`
  (filtro namespace con badge di incomplete, ricerca libera, toggle "Solo incomplete", editing inline con
  salvataggio al blur e aggiornamento immediato del bundle i18next in sessione).

**Regola per i prossimi turni**: ogni nuova chiave estratta va aggiunta sia al JSON IT sia a `traduzioni_ui`
(stesso namespace/chiave), altrimenti non compare nella pagina di gestione.

### Stato traduzioni mancanti
Le chiavi dei widget dashboard estratte in questo turno hanno solo il valore IT: DE/FR/RM/EN sono da
completare dalla tab "🌐 Traduzioni" (filtro "Solo incomplete", namespace `dashboard`).

## Regola: chiavi con valori non-stringa (liste/oggetti)

Le chiavi i18n il cui valore NON è una stringa semplice (array o oggetto — tipico di liste
come `mesi_short`, giorni della settimana, ecc.) **non vanno mai inserite in `traduzioni_ui`**:
restano gestite esclusivamente nei file JSON statici in `src/locales/`.
Il seed/estrazione le serializzerebbe come stringa JSON (`'["Gen","Feb",...]'`) corrompendo
il valore a runtime (`t(..., { returnObjects: true })` restituirebbe una stringa e non un array).
La griglia editabile per lingua ha senso solo per testi semplici: `TraduzioniTab.tsx` filtra
e nasconde eventuali righe con valori non semplici.


## Step 1.5c — Estrazione 5 pagine principali (turno corrente)

File completati: `AthletesPage.tsx`, `InvoicesPage.tsx`, `CommunicationsPage.tsx`,
`CompetitionsPage.tsx`, `CoursesPage.tsx`. Tutti migrati a `useTranslation(<ns>)`
(shim `useI18n` rimosso dove non più necessario). Solo il JSON IT è stato aggiornato:
FR/DE/EN vanno sincronizzati da Roberto in `traduzioni_ui`.

**Nuovo namespace**: `corsi` (registrato in `src/i18n/index.ts`, file `src/locales/it/corsi.json`).

### Chiavi nuove per namespace

#### `atleti` (src/locales/it/atleti.json)
- `modal.*`: edit_title, new_title, photo, uploading, upload_photo, name, surname, birth_date, current_level, level_in_preparation, none_option, hours_season, nfc_tag, nfc_placeholder, disc_in_preparation, disc_placeholder, disc_file, replace, upload_audio, personal_data, gender, select, female, male, phone, phone_placeholder, phone_placeholder_intl, fiscal_code, residence_address, address, zip, zip_placeholder, city, canton, zip_error, sis_license, license_number, license_placeholder, category, discipline, validity_until, parent1, parent2, email, notes, cancel, saving, save, delete_athlete, delete_confirm, active_check_label, active_check_desc, agonista_check_label, agonista_check_desc, federation_check_label, federation_check_desc, external_check_label, external_check_desc
- `toast.*`: photo_uploaded, photo_upload_error, disc_uploaded, disc_upload_error, athlete_created, athlete_created_desc, athlete_updated, save_error, deleted, delete_error, name_surname_required, level_required, level_required_desc, already_exists, already_exists_desc, created_with_code, created_with_code_desc, create_error
- `quick.*`: title, description, parent_email, parent_phone, initial_level, select_level, in_preparation, optional, full_form_button, cancel, creating, create_print
- `banner.*`: not_enrolled, manage_enrollments
- `header.*`: to_verify_tooltip, to_verify_button, only_to_verify, import_excel
- `cards.*`: pulcini, total, amatori, artistica_art, artistica_sti, in_prep_tooltip, in_prep_label
- `table.*`: level_career, actions, no_athletes_found, to_verify_badge, card_button, enrollment_button, edit_button
- `filters.*`: all_categories, all_levels, path, all_paths, only_artistic, only_style, both, only_scuola, only_agoniste, only_federazione, yes, no, age_5_8, age_9_12, age_13_plus, all_ages, search_placeholder
- `sort.*`: surname_az, level, age_desc, recent_enrollment, athlete_code
- `summary.*`: pulcini, amatori, artistica, stile, in_prep

#### `fatture` (src/locales/it/fatture.json) — tutte sotto `invoices_page.*`
title, to_collect, due_summary_tooltip, overdue_count_one/_other, generate_button, generating,
search_placeholder, filters.{all, overdue, status_label, period_label, period_all, period_month,
period_quarter, period_year}, sort.{date_desc, due_asc, amount_desc}, summary.{total, overdue_amount},
table.{number, name, description, amount, due_date, status}, empty.{title, description},
toast.{generated_title_one/_other, generate_error_title}

#### `communications` (src/locales/it/communications.json)
- `templates.<id>.{nome,titolo,testo}` per: benvenuto, corso_annullato, pista_chiusa, gara, cambio_orario
- `placeholder_labels.*`: anno, data, nome_corso, motivo, nome_gara, luogo, corso, nuovo_orario, vecchio_orario
- `level_labels.*`: pulcini_only, stellina_1_plus, bronzo_plus, argento_plus, oro_plus
- `destinatari.*`: course_label, agonisti, agoniste, solo_staff, per_livello, manuale, per_corsi, per_giorno, per_istruttore, corso_fallback, private_lesson
- `tabs.*`: sent_emoji, received_emoji, unread_count_one/_other, my_reminders_emoji, conversations_emoji, archive_emoji
- `empty.*`: sent, received, archive
- `dialog.*`: athletes_suffix, start_from, custom_communication, fill_fields, urgent, urgent_hint, specific_athletes, by_day_option, courses_selected_count_one/_other, select_courses, select_all, deselect_all, search_course, no_course_found, select_date, instructor, select_instructor, recipient_level, level_pulcini_only, level_filter_hint, search_athlete_placeholder, clear_search, deselect, no_athlete_found, athletes_selected_count_one/_other, recipients_preview_summary, all, none, cancel, send_now, view_recipients, send
- `form.date`
- Riutilizzate: title, new, recipients.*, form.{recipients,title,body,linked_event_type}, event_types.*

#### `events` (src/locales/it/events.json)
- Nuova: `competitions.countdown_header` (+ le ~60 chiavi `competitions.*` aggiunte durante la migrazione della pagina)
- Tutte le altre stringhe riutilizzano chiavi `competitions.*` già esistenti

#### `corsi` (src/locales/it/corsi.json — NUOVO namespace, da creare in `traduzioni_ui`)
- `tipo_corso.*`: none, add_new, new_name_placeholder, add
- `iscrizioni.*`: filter_by_name, no_athlete_found, no_compatible_athlete, all_enrolled, enroll, enroll_with_level_jump, level_jump_title_short, search_athlete, no_athlete_available, enrolled_count, no_enrolled
- `monitori.*`: toast_error, assigned, monitors_count, assistants_count, no_monitors, no_monitors_hint
- `presenze.*`: toast_error, status_confirmed, status_absent, status_substituted, status_waiting, lesson_date, no_monitors_assigned, no_monitors_hint, attendance_for, toast_all_confirmed, role_monitor, role_assistant, remind_all, whatsapp, substitute, remove, assign_substitute, select_substitute
- `griglia.*`: no_ice_slot, course_duration, min, custom_min, suggested_slots, courses_on_ice, duration_not_fit, already_on_ice, selected_time, available_instructors, occupied_in, occupied, in, outside_availability_tooltip, outside_availability, select_slot_hint
- `modal.*`: new_course, edit_course, configure_ice_first, select_slot_first, ice_warning_cleaning_overlap, toast_name_required, ice_error_uncovered_time, ice_error_select_slot, ice_error_no_availability, toast_ice_check_error, toast_invalid_path_title, toast_invalid_path_desc, redefine_tooltip, redefine_course, fix_time, fix, proceed_anyway, availability_issues_title, save_anyway, tab_info, tab_enrollments, tab_monitors, tab_attendance, incomplete_course, enrollments_disabled, capacity_exceeded, capacity_exceeded_detail, name, name_placeholder, type, type_ice, type_off_ice, type_not_set, change, required_level, open_to_all_levels, path, path_common, path_artistica, path_stile, path_invalid_hint, place_in_planning_now, will_be_placed_later, day, instructors, active_course, notes, notes_placeholder, cancel, checking, save, delete_course, delete_permanently, change_type_title, change_type_warning, category, category_placeholder, category_suggestions, save_plain, other_course, instructor_conflict
- `card.*`: to_be_scheduled, price_not_set, enrolled_count, manage_enrollments
- `filters.*`: all_types, all_instructors, reset
- `page.*`: duplicate_season, new_course, by_day, by_instructor, search_placeholder, clear_search, no_courses_filtered, no_courses_empty, to_be_scheduled_header, no_instructor, toast_type_added, toast_course_updated, toast_course_created, toast_planning_updated, toast_course_saved_planning_error, toast_save_error, toast_no_valid_season, toast_no_valid_season_desc, error_create_week, error_no_slot, error_insert_planning, error_not_in_planning, toast_course_deleted, toast_course_deleted_short, toast_delete_error, incomplete, fix_action, confirm_delete_title, confirm_delete_desc, delete_course_title

## Step 1.5d — Estrazione 5 pagine (PrivateLessons, Eventi, TestLivello, TrainingCamps, Instructors)

File completati e migrati a `useTranslation(<ns>)` (solo JSON IT aggiornato; FR/DE/EN da sincronizzare in `traduzioni_ui`):

- [x] `src/pages/PrivateLessonsPage.tsx` → `corsi.lezioni_private.*`
- [x] `src/pages/EventiPage.tsx` → `events.events.*`
- [x] `src/pages/TestLivelloPage.tsx` → `events.level_tests.*`
- [x] `src/pages/TrainingCampsPage.tsx` → `events.training_camps.*`
- [x] `src/pages/InstructorsPage.tsx` → `istruttori.*` (NUOVO namespace, registrato in `src/i18n/index.ts`)

### Chiavi nuove per namespace

#### `corsi` (+79 chiavi, tutte sotto `lezioni_private.`)
`title`, `slot_button`, `select_istruttore_placeholder`, `select_istruttore_empty`,
`legenda.*` (libero, prenotato, libero_ghiaccio, fuori_ghiaccio, privata, semiprivata),
`slot_status.*` (off_ice, prenota, semi, dettagli, occupato, fuori_ghiaccio_label),
`no_slots.*` (title, subtitle), `atleta_search.*` (placeholder, nessun_atleta_trovato),
`slot_modal.*`, `aggiungi_atleta_modal.*`, `slot_detail_modal.*`, `cambio_durata_modal.*`,
`toast.*`, `confirm.annulla_lezione`

#### `events` (+155 chiavi)
- `events.*` (+35): subtitle, back_to_list, not_found, edit, delete, delete_confirm_title/desc,
  date, time, place, registered_count, no_registrations, registrations_short_one/_other,
  form_title_edit/new, field_* (title, type, date, start, end, place, description + placeholder),
  season_label, cancel, save, create, empty_title, empty_desc, toast_created/updated/deleted/error
- `level_tests.*` (+78): titoli, form nuovo test, catena passaggi, esiti, badge, empty state,
  conferme di eliminazione, placeholder e toast
- `training_camps.*` (+42): header, form camp, sessioni, iscrizioni, opzioni partecipazione,
  empty state e toast (riutilizzate `day_only` / `full` già esistenti)

#### `istruttori` (NUOVO, 145 chiavi)
`modal.*` (form istruttore), `ore.*` (tab Ore Lavoro), `compenso.*` (tab Compenso),
`monitore.*` (scheda monitore), `dettaglio.*` (header + tab), `badge.*` (ruoli),
`lista.*` (elenco/filtri/ricerca), `toast.*`

### Note
- Nessuna chiave con valore array/oggetto introdotta in questo turno: tutte sincronizzabili in `traduzioni_ui`.
- Le costanti tecniche (`GIORNI`, `TIPI_CONTRATTO`, enum DB, discipline) NON sono state tradotte.
- Nessuna modifica ai JSON `src/locales/{fr,de,en}/`.

## Step 1.5e — Estrazione 5 pagine Setup (Seasons, ClubSetup, RuoliPermessi, Utenti, Onboarding)

File completati e migrati a `useTranslation(<ns>)` (solo JSON IT aggiornato; FR/DE/EN da sincronizzare in `traduzioni_ui`):

- [x] `src/pages/SeasonsPage.tsx` → `settings.seasons.*`
- [x] `src/pages/ClubSetupPage.tsx` → `settings.club.*`
- [x] `src/pages/RuoliPermessiPage.tsx` → `settings.roles.*`
- [x] `src/pages/UtentiPage.tsx` → `settings.users.*`
- [x] `src/pages/OnboardingPage.tsx` → `onboarding.wizard.*`

### Chiavi nuove per namespace

#### `settings` (src/locales/it/settings.json)

**`seasons.*`**: type_regolare, type_pre_season, type_post_season, type_campo, field_nome, field_tipo, field_data_inizio, field_data_fine, active_checkbox_label, edit_title, new_title, name_placeholder, required_title, required_desc, invalid_dates_title, invalid_dates_desc, updated_toast, created_toast, save_error_title, deleted_toast, delete_error_title, cancel, save, saving, delete_season, delete_confirm, empty_state, status_active, status_inactive

**`club.*`**: `toast.*` (9), `stats.*` (4), `tabs.*` (4), `sezioni.*` (15), `fields.*` (~33), `testi.*` (12), `stato.*` (2), `opzioni.*` (9), `azioni.*` (11)

**`roles.*`**: role_presidente, role_segreteria, role_dt, role_istruttore, role_aiuto_monitore, permesso_ore_lavorate, permesso_costi_istruttori, page_title, page_subtitle, save_permissions, saving, column_section, group_main_menu, group_setup, group_sensitive, toast_saved_title, toast_saved_description, toast_save_error_title, note_label, note_text

**`users.*`**: title, subtitle, new_user, search_placeholder, all_roles, only_active, none_found, `table.*` (8), `status.*` (2), `tooltip.*` (4), `relative_time.*` (4), `role.*` (8), `modal.*` (15), `confirm.*` (9), `password_dialog.*` (3), `toast.*` (9)

#### `onboarding` (src/locales/it/onboarding.json)

**`wizard.*`**: `days.*` (7), logo_max_size, logo_uploaded, availability_error, slots_configured, onboarding_completed, `done.*` (9), welcome_title, step_of, `step1.*` (15), `step2.*` (4), `step3.*` (6), back_button, next_button, complete_button

### Note
- Nessuna chiave con valore array/oggetto introdotta: tutte sincronizzabili in `traduzioni_ui`.
- Le label di ruoli/permessi in `RuoliPermessiPage` (array a livello di modulo) sono state convertite in `label_key` risolte con `t()` nel render.
- Enum DB, codici tecnici e contenuti generati dall'utente non sono stati tradotti.
- Nessuna modifica ai JSON `src/locales/{fr,de,en}/`.
