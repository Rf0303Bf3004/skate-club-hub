# Convenzioni — Dashboard Superadmin (UI parte 1)

## Scope
Nuova pagina **/superadmin/convenzioni**, visibile solo al superadmin, con due tab: gestione convenzioni e gestione aree di mercato. Nessuna vista soci / nessuna pagina QR (passi successivi).

## File nuovi
1. `src/pages/SuperAdminConvenzioniPage.tsx` — pagina con `<Tabs>` shadcn, due sotto-componenti interni:
   - `TabConvenzioni`: lista + filtri + modale nuovo/modifica.
   - `TabAree`: lista + inline edit + toggle attiva.
2. (Nessun nuovo hook globale: tutte le query in pagina con `useQuery`/`useMutation` da `@/lib/supabase`, coerente con altre pagine superadmin tipo `SuperAdminListinoPage`.)

## File modificati
- `src/App.tsx`: import e rotta `/superadmin/convenzioni` dentro `<ProtectedSuperAdmin>`.
- `src/components/MainLayout.tsx`: nuova `NavLink` nella sezione superadmin (icona `Gift` o `BadgePercent` di lucide), inserita prima di Manutenzione.
- `src/locales/it/superadmin.json`: chiavi `menu.convenzioni` e blocco `convenzioni.*` (titoli, label form, toast).

## Storage
Per logo e immagine uso un bucket pubblico **`convenzioni`** (creato via `storage_create_bucket`, public=true). Path: `logos/{convenzione_id_o_uuid}.{ext}` e `immagini/{...}`. Policy storage.objects: SELECT public, INSERT/UPDATE/DELETE solo superadmin (via `public.is_superadmin()` già esistente). Upload con `supabase.storage.from('convenzioni').upload(...)` + `getPublicUrl`. Anteprime: logo 80x80 `object-contain` bg-slate-50, immagine banner `aspect-video object-cover`.

## Tab A — Gestione convenzioni
**Query**: `convenzioni` + join `convenzioni_aree(nome,icona)` ordinato per `in_evidenza desc, created_at desc`. In parallelo `convenzioni_scansioni` raggruppata per `convenzione_id` (semplice `select convenzione_id` + reduce client, dataset piccolo) → mappa conteggi.

**Lista** = card grid responsive (1/2/3 col) con:
- Logo 64x64 a sinistra (placeholder iniziale azienda se assente).
- Azienda (titolo bold) + titolo offerta (sottotitolo).
- Riga chip: area (icona lucide dinamica + nome), `geo_citta — geo_cantone`, badge stato (verde attiva / giallo sospesa / grigio scaduta), badge "★ In evidenza" se attiva.
- Validità `dd/MM/yyyy → dd/MM/yyyy` con `format-data.ts`.
- Contatore scansioni con icona `ScanLine`.
- Bottoni Modifica, Cambia stato (dropdown), Elimina (conferma con typing "ELIMINA").

**Filtri** (top bar): search azienda/titolo, select area (tutte + lista aree attive), select stato (tutti/attiva/sospesa/scaduta), toggle "Solo in evidenza".

**Modale Nuova/Modifica** (`Dialog` shadcn):
- Campi: azienda*, area_id (Select aree attive)*, titolo*, descrizione (Textarea), upload logo (input file + anteprima 80x80 + bottone rimuovi), upload immagine banner opzionale, indirizzo, geo_cantone (Select cantoni CH già definiti in `src/lib/territori.ts` se esiste, altrimenti input), geo_citta, validita_da/validita_a (DateInput), codice_sconto, Switch in_evidenza, Select stato (default attiva).
- Salvataggio: upload file → insert/update riga. `qr_token` lasciato al default DB.

## Tab B — Gestione aree
- Tabella `convenzioni_aree` ordinata per `ordine`.
- Colonne: drag-handle visiva (no riordino in MVP, modificabile via campo numerico `ordine`), nome (input inline), icona (input testo + preview icona lucide dinamica), ordine (number), attiva (Switch).
- Bottone "Nuova area" in alto (riga vuota in modale piccolo).
- Salvataggio singola riga su blur / Switch toggle.

## Icone lucide dinamiche
Helper `get_lucide_icon(name: string)` interno alla pagina: mappa stringa kebab → componente da `lucide-react` per le 8 aree del seed (dumbbell, car, utensils, heart-pulse, shirt, home, ticket, plane) + fallback `Tag`. Permette di aggiungere altre icone semplicemente importandole.

## Conferme richieste
Nessuna: il piano usa pattern già consolidati (ProtectedSuperAdmin, Dialog shadcn, useQuery/useMutation), il bucket viene creato come parte dell'implementazione.

Procedo con l'implementazione?
