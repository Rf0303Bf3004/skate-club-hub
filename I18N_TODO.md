# I18N TODO — Estrazione stringhe rimanenti

Step 1 ha portato l'architettura `react-i18next` con 11 namespace IT in `src/locales/it/`.
Lo shim `useI18n()` / `t()` in `src/lib/i18n.tsx` continua a funzionare per i 20 file
pre-esistenti che usavano l'API legacy: **nessuna stringa visibile è cambiata**.

I file qui sotto contengono ancora stringhe italiane hard-coded da estrarre in turni successivi.
Ogni file va aperto, importato `useTranslation('<namespace>')` e le stringhe spostate nel
JSON appropriato sotto `src/locales/it/`.

## File già migrati a Step 1
- `src/pages/LoginPage.tsx` → `onboarding.login.*`
- `src/pages/RegisterClubPage.tsx` → `onboarding.register.*`
- `src/components/forms/FormDialog.tsx` → `common.actions.*`, `common.confirm_delete_title`
- `src/components/sponsor/PitchTextEditorDialog.tsx` (parziale) → `common.actions.*`
- `src/components/MainLayout.tsx` (selettore lingua) → mostra solo IT

## File che usano già lo shim legacy `useI18n()` (NESSUNA azione richiesta — funzionano via shim)
Coprono tutti gli usi di `t('salva')`, `t('atleti')`, ecc. Mappati al namespace `common`.
Refactor "soft" futuro: migrare a `useTranslation('common')` e usare le chiavi gerarchiche
`common.actions.save` invece di `t('salva')`. Bassa priorità.

## File da rifattorizzare — pagine (priorità ALTA)

### Pagine principali (utente-visibili, alto traffico)
- [ ] `src/pages/DashboardPage.tsx` → namespace `dashboard`
- [ ] `src/pages/AthletesPage.tsx` → namespace `atleti` (parte già usa shim)
- [ ] `src/pages/InvoicesPage.tsx` → namespace `fatture` (parte già usa shim)
- [ ] `src/pages/CommunicationsPage.tsx` → namespace `communications`
- [ ] `src/pages/CompetitionsPage.tsx` → namespace `events.competitions`
- [ ] `src/pages/CoursesPage.tsx` → namespace `common` + nuovo `corsi`
- [ ] `src/pages/PrivateLessonsPage.tsx` → namespace nuovo `lezioni`
- [ ] `src/pages/EventiPage.tsx` → namespace `events.events`
- [ ] `src/pages/TestLivelloPage.tsx` → namespace `events.level_tests`
- [ ] `src/pages/TrainingCampsPage.tsx` → namespace `events.training_camps`
- [ ] `src/pages/InstructorsPage.tsx` → namespace nuovo `istruttori`
- [ ] `src/pages/SeasonsPage.tsx` → namespace `settings.seasons`
- [ ] `src/pages/ClubSetupPage.tsx` → namespace `settings.club`
- [ ] `src/pages/RuoliPermessiPage.tsx` → namespace `settings.roles`
- [ ] `src/pages/UtentiPage.tsx` → namespace `settings.users`
- [ ] `src/pages/OnboardingPage.tsx` → namespace `onboarding.wizard`
- [ ] `src/pages/PortaleAtletaPage.tsx` → namespace `mobile`
- [ ] `src/pages/RichiesteIscrizionePage.tsx` → namespace nuovo `iscrizioni`
- [ ] `src/pages/PlanningPage.tsx` → namespace nuovo `planning`
- [ ] `src/pages/NuovaStagionePage.tsx` → namespace `settings.seasons`
- [ ] `src/pages/MedagliereePage.tsx` → namespace `events.competitions`
- [ ] `src/pages/CampiEventiPage.tsx` → namespace `events.training_camps`

### Pagine secondarie / superadmin (priorità MEDIA)
- [ ] `src/pages/AdvancedManagementPage.tsx`
- [ ] `src/pages/SuperAdminPage.tsx`
- [ ] `src/pages/SuperAdminClubPage.tsx`
- [ ] `src/pages/SuperAdminManutenzione.tsx`
- [ ] `src/pages/SuperAdminManutenzioneStr.tsx`
- [ ] `src/pages/ImportAtletiPage.tsx`
- [ ] `src/pages/PacchettiSponsorPage.tsx` → namespace nuovo `sponsor`
- [ ] `src/pages/PresidentRelazione.tsx` → namespace nuovo `relazione`
- [ ] `src/pages/PresidentRelazioneGestione.tsx` → namespace nuovo `relazione`
- [ ] `src/pages/LegalPlaceholderPage.tsx`
- [ ] `src/pages/NotFound.tsx` → namespace `errors`
- [ ] `src/pages/TestMobileAuthPage.tsx` (pagina debug, bassa priorità)

## File da rifattorizzare — componenti (priorità ALTA)

### Componenti atleti
- [ ] `src/components/AtletaDetail.tsx` (~50 chiavi)
- [ ] `src/components/AthleteBadges.tsx`
- [ ] `src/components/SchedaAnagrafica.tsx`
- [ ] `src/components/CodiceAtletaCard.tsx`
- [ ] `src/components/CalendarioAtletaInterattivo.tsx`
- [ ] `src/components/MedagliereWidget.tsx`
- [ ] `src/components/StoricoTestAtleta.tsx`

### Componenti dashboard / search / shared
- [ ] `src/components/dashboard/PresidentDashboard.tsx`
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

### Componenti relazione (area presidente)
- [ ] `src/components/relazione/*.tsx` (15 file) → namespace nuovo `relazione`

### Componenti sponsor / ruoli
- [ ] `src/components/sponsor/PacchettoFormDialog.tsx`
- [ ] `src/components/sponsor/PitchPDFPreview.tsx`
- [ ] `src/components/ruoli-permessi/DashboardCardsPermessi.tsx`

## File esclusi (NON tradurre)

### `src/components/ui/*` (51 file)
Sono primitive shadcn/ui. Non contengono testo italiano da tradurre — solo wrapper Radix.
Saltare integralmente.

### User content (DB-driven, gestito dal cliente, NON tradurre)
- `clubs.mission`, `clubs.nome`, `clubs.descrizione`
- `comunicazioni.titolo`, `comunicazioni.testo`
- `comunicazioni_template.titolo`, `comunicazioni_template.testo`
- `corsi.descrizione`, `corsi.nome`
- `eventi.descrizione`, `eventi.note`
- `gare.note`, `gare.luogo`
- `relazione.blocchi.testo`
- `pacchetti_sponsor.descrizione`

Saranno mantenuti come testo libero del cliente. Se in futuro un club vorrà la propria
gestione multilingua per questi campi, andrà introdotto uno schema `<table>_translations`
dedicato.

### Codici tecnici (mai estratti)
- UUID, ID, codici fattura, `codice_atleta` (AT-XXXX-XXXX)
- Valori enum DB: `'pulcini'`, `'artistica'`, `'amatori'`, `'agonista'`, `'monitore'`, ecc.
  Le label tradotte vivono già in `get_categoria_label()` / `atleta-livello.ts`.
- Nomi propri (atleti, club, città)
- URL e path
- Date formattate (`Intl.DateTimeFormat` con locale dinamico — già i18n-ready)

## Procedura per Step 2 (traduzione FR/DE/EN)

1. Copia la cartella IT in tre cartelle gemelle:
   ```bash
   cp -r src/locales/it src/locales/fr
   cp -r src/locales/it src/locales/de
   cp -r src/locales/it src/locales/en
   ```
2. Apri ogni file JSON in ciascuna cartella e traduci i **values** (lasciando le **keys** invariate).
   Strumento consigliato: ChatGPT/Claude o traduttore madrelingua.
3. Reimporta i file tradotti nel progetto Lovable.
4. Aggiorna `src/i18n/index.ts` aggiungendo i resource per `fr`, `de`, `en`:
   ```ts
   import fr_common from '@/locales/fr/common.json';
   // ...idem per ogni namespace
   resources.fr = { common: fr_common, atleti: fr_atleti, /* ... */ };
   ```
5. In `src/components/MainLayout.tsx` e `src/pages/LoginPage.tsx` riabilita le opzioni:
   ```tsx
   {(['it','fr','de','en'] as Locale[]).map((l) => (...))}
   ```

## Note finali

- Lo Step 1 mantiene il selettore con sola opzione **Italiano**: cambiare lingua
  ora non avrebbe effetti visibili perché i resource FR/DE/EN sono vuoti.
- Il locale **Romancio (rm)** è mantenuto come slot nel config i18n (fallback automatico a IT)
  per retrocompatibilità con codice eventualmente già scritto, ma NON sarà tradotto per ora.
- Lo shim `src/lib/i18n.tsx` può essere rimosso definitivamente quando tutti i 20 file
  legacy saranno stati migrati a `useTranslation()` diretto.
