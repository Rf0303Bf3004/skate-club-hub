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
- [ ] `src/pages/AthletesPage.tsx` (parte già usa shim)
- [ ] `src/pages/InvoicesPage.tsx` (parte già usa shim)
- [ ] `src/pages/CommunicationsPage.tsx`
- [ ] `src/pages/CompetitionsPage.tsx`
- [ ] `src/pages/CoursesPage.tsx`
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
