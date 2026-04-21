-- Backfill: assegna un portal_token agli atleti esistenti che ne sono privi
UPDATE public.atleti
SET portal_token = gen_random_uuid()::text
WHERE portal_token IS NULL OR portal_token = '';

-- Indice univoco sul portal_token (consente NULL multipli ma evita duplicati)
CREATE UNIQUE INDEX IF NOT EXISTS atleti_portal_token_unique
  ON public.atleti (portal_token)
  WHERE portal_token IS NOT NULL;

-- Funzione trigger: assegna un UUID a portal_token se NULL/vuoto in INSERT
CREATE OR REPLACE FUNCTION public.set_atleta_portal_token()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.portal_token IS NULL OR NEW.portal_token = '' THEN
    NEW.portal_token := gen_random_uuid()::text;
  END IF;
  RETURN NEW;
END;
$$;

-- Trigger BEFORE INSERT
DROP TRIGGER IF EXISTS trg_atleti_set_portal_token ON public.atleti;
CREATE TRIGGER trg_atleti_set_portal_token
BEFORE INSERT ON public.atleti
FOR EACH ROW
EXECUTE FUNCTION public.set_atleta_portal_token();