
DROP VIEW IF EXISTS public.clubs_mobile_public;

CREATE OR REPLACE FUNCTION public.mobile_club_info()
RETURNS TABLE (
  id uuid, nome text, sigla text, citta text, cantone text, paese text,
  indirizzo text, cap text, email text, telefono text, sito_web text,
  logo_url text, colore_primario text, descrizione text
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT c.id, c.nome, c.sigla, c.citta, c.cantone, c.paese, c.indirizzo, c.cap,
         c.email, c.telefono, c.sito_web, c.logo_url, c.colore_primario, c.descrizione
  FROM public.clubs c
  WHERE public.is_mobile_parent() AND c.id = public.mobile_club_id();
$$;

REVOKE ALL ON FUNCTION public.mobile_club_info() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.mobile_club_info() TO authenticated;
