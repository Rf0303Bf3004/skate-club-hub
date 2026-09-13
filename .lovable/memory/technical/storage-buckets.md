---
name: Storage buckets
description: Bucket Storage del progetto — foto-atleti e loghi-club pubblici, dischi-musicali PRIVATO (15 MB, solo audio, policy per percorso club/atleta)
type: reference
---
Il DB Cloud espone questi bucket Storage:
- **foto-atleti** (pubblico): foto profilo atleti, riferite via `atleti.foto_url` / `foto_path`. Path convention: `{club_id}/{timestamp}.{ext}`.
- **loghi-club** (pubblico): logo del club caricabile da /setup-club, riferito via `clubs.logo_url`.
- **dischi-musicali** (**PRIVATO**): file audio dei programmi delle atlete.
  - Limite 15 MB per file, solo tipi audio.
  - Percorso obbligatorio `{club_id}/{atleta_id}/{nomefile}.{est}`; le policy sono basate su quel percorso.
  - L'ascolto avviene **solo** con `createSignedUrl(path, 300)`. **Mai `getPublicUrl`.**
  - Scrittura riservata ai ruoli di `puo_gestire_musica()`: superadmin, admin, presidente, dt, istruttore.

RLS: i bucket pubblici hanno lettura aperta e scrittura per utenti `authenticated`. Per `dischi-musicali` lettura e scrittura passano dalle policy per percorso.
