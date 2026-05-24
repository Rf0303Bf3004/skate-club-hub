## Piano: Portale Web Atleta + Estensione Superadmin

Due aree separate, entrambe da costruire ex novo. Sotto i dettagli operativi.

---

### TASK 1 — Portale Web Atleta (`/portale/*`)

**Routing pubblico (fuori MainLayout admin)**
- `/portale` → `PortaleLoginPage` (campo codice `AT-XXXX-XXXX`, chiama edge `mobile-auth-login`, salva sessione).
- `/portale/*` → `PortaleLayout` (header + sidebar) con guard che verifica `app_metadata.role === 'mobile_parent'`; altrimenti redirect a `/portale`.
- Sub-route: `home`, `calendario`, `eventi`, `notizie`, `profilo`, `profilo/atleta`, `profilo/corsi`, `profilo/fatture`, `profilo/convenzioni`.
- Link "Accesso Atleti" aggiunto in `LoginPage` admin.

**File nuovi**
```
src/pages/portale/PortaleLoginPage.tsx
src/pages/portale/PortaleLayout.tsx           (header + sidebar + Outlet)
src/pages/portale/PortaleHomePage.tsx
src/pages/portale/PortaleCalendarioPage.tsx
src/pages/portale/PortaleEventiPage.tsx
src/pages/portale/PortaleNotiziePage.tsx
src/pages/portale/PortaleProfiloPage.tsx      (hub)
src/pages/portale/profilo/AtletaTab.tsx
src/pages/portale/profilo/CorsiTab.tsx
src/pages/portale/profilo/FattureTab.tsx
src/pages/portale/profilo/ConvenzioniTab.tsx
src/lib/portale-auth.ts                       (login/logout/session helper su mobile-auth-login)
src/locales/it/portale.json
```

**Sicurezza**: tutte le query usano il client Supabase autenticato. RLS già attive (`mobile_atleta_id()`, `mobile_club_id()`). Nessuna funzione admin importata.

**Stile**: palette identica all'app mobile (tokens locali a `index.css` come variabili semantiche per non sporcare il design system admin: `--portale-accent`, `--portale-purple`, ecc.). Card `rounded-2xl`, shadow soft.

---

### TASK 2 — Estensione Superadmin

**Nuova pagina `/superadmin/utenti`**
- File: `src/pages/SuperAdminUtentiPage.tsx`.
- Lista da `utenti_club` joinata con `auth.users` (via edge function dedicata `superadmin-utenti` per accedere a `auth.users` con service role).
- Filtri ruolo + club, colonne: email, nome cognome, ruolo, club, attivo, ultimo accesso.
- Azioni riga: Reset password, Disattiva, Cambia ruolo.
- Bottone "Nuovo superadmin" → modal con email/nome/cognome + password autogenerata copiabile.

**Edge function `superadmin-utenti`**
- Verifica JWT chiamante abbia ruolo `superadmin` (query `utenti_club`).
- Azioni: `list`, `reset_password` (genera + `admin.updateUserById`), `set_disattivo`, `cambia_ruolo`, `crea_superadmin`.

**Self-recovery**
- Pagina pubblica `/portale-recovery` → `supabase.auth.resetPasswordForEmail(email, { redirectTo: `${origin}/reset-password` })`.
- Pagina `/reset-password` (pubblica) per impostare nuova password.
- Link "Password dimenticata?" nella `LoginPage` admin.

**Sidebar**: aggiungo "Utenti" alle sub-voci Superadmin.

**i18n**: estendo `src/locales/it/superadmin.json` con `utenti.*` e `recovery.*`.

---

### Verifica
- `bunx tsc --noEmit` → 0 errori.
- Test login portale con `AT-ZPG4-U3K2` via `supabase--curl_edge_functions`.
- Conferma che `robertofalco@bluewin.ch` (ruolo superadmin) vede la sezione, admin di Stella no (già coperto da check `is_superadmin` esistente in `MainLayout`).
