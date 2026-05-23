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
- [ ] `src/components/dashboard/RichiesteIscrizioneWidget.tsx` (header "RICHIESTE PENDENTI", "Nessuna richiesta in attesa", "ULTIME ISCRIZIONI", template stringa "{atleta} si è iscritto a {corso}")
- [ ] `src/components/dashboard/IstruttoriDisponibiliWidget.tsx`
- [ ] `src/components/MedagliereWidget.tsx`

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
