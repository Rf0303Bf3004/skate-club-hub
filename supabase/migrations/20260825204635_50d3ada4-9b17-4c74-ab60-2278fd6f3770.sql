CREATE OR REPLACE FUNCTION public.lezione_privata_appartiene_al_club(_lezione_id uuid, _club_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.lezioni_private lp
    WHERE lp.id = _lezione_id
      AND lp.club_id = _club_id
  );
$$;

REVOKE ALL ON FUNCTION public.lezione_privata_appartiene_al_club(uuid, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.lezione_privata_appartiene_al_club(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.lezione_privata_appartiene_al_club(uuid, uuid) TO service_role;

DROP POLICY IF EXISTS "f6_child_soft" ON public.lezioni_private_atlete;
CREATE POLICY "f6_child_soft"
ON public.lezioni_private_atlete
AS PERMISSIVE
FOR ALL
TO authenticated
USING (
  public.user_is_admin_like()
  OR public.lezione_privata_appartiene_al_club(lezione_id, public.user_club_id())
)
WITH CHECK (
  public.user_is_admin_like()
  OR public.lezione_privata_appartiene_al_club(lezione_id, public.user_club_id())
);

DROP POLICY IF EXISTS "f6_child_soft" ON public.planning_private_settimana;
CREATE POLICY "f6_child_soft"
ON public.planning_private_settimana
AS PERMISSIVE
FOR ALL
TO authenticated
USING (
  public.user_is_admin_like()
  OR public.lezione_privata_appartiene_al_club(lezione_privata_id, public.user_club_id())
)
WITH CHECK (
  public.user_is_admin_like()
  OR public.lezione_privata_appartiene_al_club(lezione_privata_id, public.user_club_id())
);