
ALTER TABLE public.fatture_clubs
  ADD COLUMN IF NOT EXISTS intestatario_nome text,
  ADD COLUMN IF NOT EXISTS intestatario_indirizzo text,
  ADD COLUMN IF NOT EXISTS intestatario_cap text,
  ADD COLUMN IF NOT EXISTS intestatario_citta text,
  ADD COLUMN IF NOT EXISTS intestatario_cantone text,
  ADD COLUMN IF NOT EXISTS intestatario_partita_iva text,
  ADD COLUMN IF NOT EXISTS intestatario_numero_iva_chf text,
  ADD COLUMN IF NOT EXISTS intestatario_iban text;

UPDATE public.fatture_clubs fc
SET
  intestatario_nome = COALESCE(fc.intestatario_nome, c.nome),
  intestatario_indirizzo = COALESCE(fc.intestatario_indirizzo, c.indirizzo),
  intestatario_cap = COALESCE(fc.intestatario_cap, c.cap),
  intestatario_citta = COALESCE(fc.intestatario_citta, c.citta),
  intestatario_cantone = COALESCE(fc.intestatario_cantone, c.cantone),
  intestatario_partita_iva = COALESCE(fc.intestatario_partita_iva, c.partita_iva),
  intestatario_numero_iva_chf = COALESCE(fc.intestatario_numero_iva_chf, c.numero_iva_chf),
  intestatario_iban = COALESCE(fc.intestatario_iban, c.iban)
FROM public.clubs c
WHERE fc.club_id = c.id
  AND fc.intestatario_nome IS NULL;

UPDATE public.fatture f
SET
  intestatario_nome = COALESCE(f.intestatario_nome, a.genitore1_nome),
  intestatario_cognome = COALESCE(f.intestatario_cognome, a.genitore1_cognome),
  intestatario_indirizzo = COALESCE(f.intestatario_indirizzo, a.genitore1_indirizzo),
  intestatario_cap = COALESCE(f.intestatario_cap, a.genitore1_cap),
  intestatario_citta = COALESCE(f.intestatario_citta, a.genitore1_citta),
  intestatario_cantone = COALESCE(f.intestatario_cantone, a.genitore1_cantone),
  intestatario_email = COALESCE(f.intestatario_email, a.genitore1_email)
FROM public.atleti a
WHERE f.atleta_id = a.id
  AND f.intestatario_nome IS NULL;
