# TARIFFAZIONE-SUPERADMIN-V2

Lavoro grosso, lo eseguo in 5 step ordinati. Ti chiedo conferma prima di partire perché tocca DB + edge function + PDF + email.

## 1) Schema DB (migration)

**clubs** — aggiungo:
- `mesi_fatturazione_fee` (int2, default 12, 0–12)
- `mesi_fatturazione_atleti` (int2, default 12, 0–12)
- `mese_inizio_fatturazione` (int2, default 1, 1–12)
- `costo_setup_chf` (numeric, default 0)
- `setup_fatturato` (bool, default false)

**fatture_clubs** — aggiungo:
- `importo_atleti_chf` (numeric, default 0)
- `importo_setup_chf` (numeric, default 0)
- `stato` text default `'bozza'` CHECK in (bozza, inviata, pagata, scaduta, annullata)
- `pdf_url` text
- `data_invio` timestamptz

Nota: la colonna `pagata` esistente resta per retrocompatibilità ma `stato` diventa la fonte di verità.

## 2) Cron mensile (`fattura-clubs-mensile`)

Rifaccio la logica con le 3 componenti:
- fee attiva solo se il mese corrente rientra negli N mesi a partire da `mese_inizio_fatturazione`
- stesso per atleti
- setup solo se `setup_fatturato=false` e prima fattura → poi flag a true
- salva 3 componenti separate; `stato='bozza'`

## 3) UI `/superadmin/clubs/{id}` — sezione Tariffazione

3 righe (canone base, prezzo atleta, setup una tantum) con mesi/anno e mese inizio, più card riepilogo dinamica con totale annuale previsto.

## 4) Dettaglio fattura `/superadmin/fatture/{id}` (route nuova)

- Intestatario club completo + mittente Ice Arena Manager Sagl Bellinzona
- Tabella righe (canone, atleti×prezzo, setup)
- 4 bottoni: Anteprima PDF, Modifica (solo bozza), Invia (bozza→inviata + email), Marca pagata
- Form modifica righe + note (campo `note` opzionale, lo aggiungo alla migration)
- PDF con `@react-pdf/renderer` (stesso pattern del Pitch Sponsor): logo header, anagrafica, tabella, totale, IBAN/Twint, scadenza, footer fiscale. Cache in `pdf_url`.

Aggiungo link cliccabile dalle celle del tabellone esistente al dettaglio.

## 5) Edge function `send-fattura-email` + invio massivo

- Edge function: riceve `fattura_id`, valida, recupera dati club + sagl, manda email via **Resend** (connector) al presidente con il PDF in allegato (PDF generato lato client e passato come base64, oppure rigenerato server-side con un template HTML semplice — vedi nota sotto), aggiorna `stato='inviata'`, `data_invio=now()`, `pdf_url`.
- Bottone "Invia tutte le bozze del mese" sul tabellone: modale conferma con count + totale, poi loop sequenziale con progress bar, summary finale.

**Nota tecnica PDF in email**: `@react-pdf/renderer` non gira in Deno. Due opzioni:
- **A (consigliata)**: client genera il PDF, lo carica in storage bucket `fatture_clubs`, passa l'URL all'edge function che lo allega via fetch.
- **B**: template HTML inline nell'email (no allegato PDF, solo link al PDF in storage).

Vado con **A**: creo bucket privato `fatture-clubs` con RLS solo superadmin, client uppa PDF, edge function allega.

## Dipendenze e prerequisiti

- **Resend connector** già configurato? Se no devo chiederti di collegarlo prima di poter inviare email reali. Per la prima iterazione l'edge function può funzionare anche senza Resend (stato passa a inviata, ma email skippata con warning nei log) così puoi testare il flusso. Confermami se hai Resend o vuoi che ti guidi a configurarlo.
- `@react-pdf/renderer` già presente (usato per Pitch Sponsor) — riuso.
- Mittente "Ice Arena Manager Sagl, Bellinzona" hard-coded per ora come placeholder come da prompt, configurabile più avanti.

## File toccati (stima)

- 1 migration SQL (clubs + fatture_clubs + bucket storage + RLS)
- `supabase/functions/fattura-clubs-mensile/index.ts` (riscrittura logica)
- `supabase/functions/send-fattura-email/index.ts` (nuova)
- `supabase/config.toml` (registra nuova function se serve)
- `src/pages/SuperAdminClubDetailPage.tsx` (sezione Tariffazione)
- `src/pages/SuperAdminFatturaDetailPage.tsx` (nuova)
- `src/pages/SuperAdminTabelloneFatturePage.tsx` (cella → link dettaglio, bottone invio massivo)
- `src/lib/fattura-club-pdf.tsx` (nuovo, react-pdf)
- `src/App.tsx` (route nuova)
- `src/locales/it/superadmin.json` (stringhe nuove)

## Domande prima di partire

1. **Resend**: già configurato o devo guidarti? (in caso negativo procedo con email "best effort" e log warning, così puoi testare tutto il resto)
2. Mittente Sagl placeholder: ok "Ice Arena Manager Sagl — Bellinzona, CHE-XXX.XXX.XXX MWST, IBAN CH00 0000 0000 0000 0000 0" da sostituire più avanti?

Appena confermi (o dici "vai senza domande, decidi tu") parto con la migration.
