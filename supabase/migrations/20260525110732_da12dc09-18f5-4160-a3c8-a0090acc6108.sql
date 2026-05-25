-- Anagrafica completa atleti
ALTER TABLE public.atleti ADD COLUMN IF NOT EXISTS cap text;
ALTER TABLE public.atleti ADD COLUMN IF NOT EXISTS citta text;
ALTER TABLE public.atleti ADD COLUMN IF NOT EXISTS cantone text;
ALTER TABLE public.atleti ADD COLUMN IF NOT EXISTS genitore1_indirizzo text;
ALTER TABLE public.atleti ADD COLUMN IF NOT EXISTS genitore1_cap text;
ALTER TABLE public.atleti ADD COLUMN IF NOT EXISTS genitore1_citta text;
ALTER TABLE public.atleti ADD COLUMN IF NOT EXISTS genitore1_cantone text;
ALTER TABLE public.atleti ADD COLUMN IF NOT EXISTS genitore2_indirizzo text;
ALTER TABLE public.atleti ADD COLUMN IF NOT EXISTS genitore2_cap text;
ALTER TABLE public.atleti ADD COLUMN IF NOT EXISTS genitore2_citta text;
ALTER TABLE public.atleti ADD COLUMN IF NOT EXISTS genitore2_cantone text;

-- Anagrafica club per fatturazione
ALTER TABLE public.clubs ADD COLUMN IF NOT EXISTS partita_iva text;
ALTER TABLE public.clubs ADD COLUMN IF NOT EXISTS numero_iva_chf text;
ALTER TABLE public.clubs ADD COLUMN IF NOT EXISTS iban text;
ALTER TABLE public.clubs ADD COLUMN IF NOT EXISTS intestatario_iban text;
ALTER TABLE public.clubs ADD COLUMN IF NOT EXISTS twint_qr_url text;