---
name: Storage buckets
description: Bucket Storage del progetto (foto-atleti, loghi-club, dischi-musicali) — tutti pubblici, lettura aperta, scrittura per utenti autenticati
type: reference
---
Il DB Cloud espone 3 bucket Storage pubblici:
- **foto-atleti**: foto profilo atleti, riferite via `atleti.foto_url`. Path convention: `{club_id}/{timestamp}.{ext}`.
- **loghi-club**: logo del club caricabile da /setup-club, riferito via `clubs.logo_url`.
- **dischi-musicali**: file audio per i programmi delle atlete, riferito via `atleti.disco_url`. (NB: il vecchio nome `dischi-audio` non esiste — usare sempre `dischi-musicali`.)

RLS: lettura pubblica (i bucket sono `public=true`), upload/update/delete riservati a utenti `authenticated`. La logica di ownership fine (es. genitore può caricare solo la foto del proprio figlio) è gestita a livello applicativo.
