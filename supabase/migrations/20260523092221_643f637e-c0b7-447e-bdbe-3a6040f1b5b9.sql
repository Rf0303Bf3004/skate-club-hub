
-- Remove broad anonymous read access on tables that don't need it
DROP POLICY IF EXISTS "Public read clubs" ON public.clubs;
DROP POLICY IF EXISTS "Public read eventi_esterni" ON public.eventi_esterni;
DROP POLICY IF EXISTS "Public read eventi_straordinari" ON public.eventi_straordinari;

-- Tighten utenti_club: restrict broad same-club visibility so that
-- non-admin same-club members can only see name fields (not phone).
-- Implementation: replace the broad select policy with self-or-admin,
-- and expose a SECURITY DEFINER helper for fetching just the display name.
DROP POLICY IF EXISTS "utenti_club_select" ON public.utenti_club;

CREATE POLICY "utenti_club_select"
ON public.utenti_club
FOR SELECT
TO authenticated
USING (
  auth.uid() = user_id
  OR public.user_is_admin_like()
);

-- Helper for showing "verified by <name>" without exposing telefono/email.
CREATE OR REPLACE FUNCTION public.get_utente_club_display_name(_user_id uuid)
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT trim(coalesce(uc.nome,'') || ' ' || coalesce(uc.cognome,''))
  FROM public.utenti_club uc
  WHERE uc.user_id = _user_id
    AND uc.club_id = public.user_club_id()
  LIMIT 1;
$$;

GRANT EXECUTE ON FUNCTION public.get_utente_club_display_name(uuid) TO authenticated;
