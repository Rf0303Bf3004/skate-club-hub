
ALTER TABLE public.atleti ADD COLUMN IF NOT EXISTS portal_token text;

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

DROP TRIGGER IF EXISTS trg_atleti_set_portal_token ON public.atleti;
CREATE TRIGGER trg_atleti_set_portal_token
BEFORE INSERT ON public.atleti
FOR EACH ROW EXECUTE FUNCTION public.set_atleta_portal_token();

-- backfill
UPDATE public.atleti
SET portal_token = gen_random_uuid()::text
WHERE portal_token IS NULL OR portal_token = '';

-- Hide from regular API; edge function (service role) and the RPC below still work
REVOKE SELECT (portal_token) ON public.atleti FROM authenticated, anon, PUBLIC;

CREATE OR REPLACE FUNCTION public.get_atleta_portal_token(p_atleta_id uuid)
RETURNS text
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT a.portal_token
  FROM public.atleti a
  WHERE a.id = p_atleta_id
    AND a.club_id = public.user_club_id()
    AND public.user_is_admin_like();
$$;
GRANT EXECUTE ON FUNCTION public.get_atleta_portal_token(uuid) TO authenticated;
