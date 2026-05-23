
DROP FUNCTION IF EXISTS public.get_atleta_portal_token(uuid);
DROP TRIGGER IF EXISTS trg_atleti_set_portal_token ON public.atleti;
DROP FUNCTION IF EXISTS public.set_atleta_portal_token() CASCADE;
DROP INDEX IF EXISTS public.atleti_portal_token_unique;
ALTER TABLE public.atleti DROP COLUMN IF EXISTS portal_token;
