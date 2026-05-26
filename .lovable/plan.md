## MULTIPAESE-ANAGRAFICA — piano di esecuzione

Adatto i form anagrafici (club, atleta, persona) e le fatture al paese selezionato (CH default, IT). Dato l'ampio impatto su DB, costanti, form e PDF, propongo questo piano prima di applicare.

---

### 1) Costanti territoriali — `src/lib/territori.ts` (nuovo)

Esporto:
- `PAESI = [{code:'CH',label:'Svizzera'},{code:'IT',label:'Italia'}]`
- `CANTONI_CH` (26 voci con sigla: AG, AR, AI, BL, BS, BE, FR, GE, GL, GR, JU, LU, NE, NW, OW, SG, SH, SO, SZ, TI, TG, UR, VS, VD, ZG, ZH)
- `REGIONI_IT` (20)
- `PROVINCE_IT` (110, ognuna `{sigla, nome, regione}`) + helper `getProvinceByRegione(regione)`
- Regex/validatori: `isValidCAP(paese, cap)`, `isValidPartitaIVA(paese, value)`, `isValidIBAN(paese, value)`, `isValidCodiceFiscaleIT(value)`
- Placeholder helpers: `getTelefonoPlaceholder`, `getCAPPlaceholder`, `getPartitaIVAPlaceholder`, `getIBANPlaceholder`

### 2) Migrazione DB

```sql
ALTER TABLE public.clubs
  ADD COLUMN IF NOT EXISTS paese_iso text NOT NULL DEFAULT 'CH',
  ADD COLUMN IF NOT EXISTS regione text,
  ADD COLUMN IF NOT EXISTS provincia text,
  ADD COLUMN IF NOT EXISTS codice_fiscale text;

ALTER TABLE public.atleti
  ADD COLUMN IF NOT EXISTS paese_iso text NOT NULL DEFAULT 'CH',
  ADD COLUMN IF NOT EXISTS regione text,
  ADD COLUMN IF NOT EXISTS provincia text,
  ADD COLUMN IF NOT EXISTS genitore1_paese_iso text,
  ADD COLUMN IF NOT EXISTS genitore1_regione text,
  ADD COLUMN IF NOT EXISTS genitore1_provincia text,
  ADD COLUMN IF NOT EXISTS genitore2_paese_iso text,
  ADD COLUMN IF NOT EXISTS genitore2_regione text,
  ADD COLUMN IF NOT EXISTS genitore2_provincia text;

ALTER TABLE public.fatture
  ADD COLUMN IF NOT EXISTS intestatario_paese_iso text,
  ADD COLUMN IF NOT EXISTS intestatario_regione text,
  ADD COLUMN IF NOT EXISTS intestatario_provincia text;

ALTER TABLE public.fatture_clubs
  ADD COLUMN IF NOT EXISTS intestatario_paese_iso text DEFAULT 'CH',
  ADD COLUMN IF NOT EXISTS intestatario_regione text,
  ADD COLUMN IF NOT EXISTS intestatario_provincia text;
```

Nessun check constraint a livello DB (validazione applicativa, come da prompt "flessibile"). Default CH retro-compatibile con dati esistenti.

### 3) UI adattiva — componente riusabile

Nuovo componente `src/components/AnagraficaTerritoriale.tsx` con props `{ paese, onPaeseChange, valori, onChange, prefisso? }`. Renderizza:
- Select Paese (CH/IT) in alto
- Se CH → select Cantone, CAP 4 cifre
- Se IT → select Regione + select Provincia dipendente, CAP 5 cifre
- Helper per IBAN/P.IVA/telefono con placeholder dinamici

Lo applico nei form esistenti:
- `SuperAdminNewClubPage.tsx` — sezione anagrafica club
- `SuperAdminClubDetailPage` / dove si modifica il club (cerco il file esistente)
- `AtletaDetail.tsx` — sezione anagrafica atleta + Genitore 1 + Genitore 2
- Eventuale form persone staff (se esiste; verifico)

### 4) PDF fatture

- `src/lib/fattura-club-pdf.tsx`: riga indirizzo mostra `CAP Citta (Cantone)` se CH, `CAP Citta (Provincia) - Regione` se IT. P.IVA formattata col label coerente.
- PDF fatture atleta (cerco file): stesso pattern usando snapshot `intestatario_*`.

### 5) Snapshot intestatario

- `fattura-clubs-mensile/index.ts`: copia anche `paese_iso/regione/provincia` da `clubs`.
- `use-supabase-mutations.ts` (build_fatture_mese): copia anche `paese_iso/regione/provincia` da `atleti.genitore1_*`.

### 6) Backfill

`UPDATE clubs SET paese_iso='CH' WHERE paese_iso IS NULL;` (idem atleti). Già coperto dal DEFAULT, nessun ulteriore backfill necessario.

### 7) Verifica

- `bunx tsc --noEmit` → 0 errori
- Smoke manuale: creo club IT con regione/provincia/PIVA 11 cifre/IBAN IT, verifico salvataggio e PDF.

---

### Domande di scoping rapide

1. **Province IT**: ok elenco completo 110 province con sigla? (peso ~3KB nel bundle)
2. **Validazione DB**: confermi nessun CHECK constraint (solo frontend)?
3. **Form persona/staff**: vuoi che adatti anche il form utenti staff o per ora solo club + atleta + genitori?

Procedo appena confermi (o dimmi varianti).
