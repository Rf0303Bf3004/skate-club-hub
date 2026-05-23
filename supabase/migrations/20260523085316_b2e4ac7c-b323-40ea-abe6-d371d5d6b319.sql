-- 1) Re-apply column-level revoke on clubs PII for anon (and public role)
REVOKE SELECT (email, telefono) ON public.clubs FROM anon;
REVOKE SELECT (email, telefono) ON public.clubs FROM PUBLIC;

-- 2) Restrict inviti_genitori SELECT to admin-like users only.
DROP POLICY IF EXISTS "inviti_genitori_same_club" ON public.inviti_genitori;
DROP POLICY IF EXISTS "f6_soft_all" ON public.inviti_genitori;

-- Admin-only SELECT (tokens are sensitive)
CREATE POLICY "inviti_genitori_admin_select" ON public.inviti_genitori
FOR SELECT TO authenticated
USING (public.user_is_admin_like() AND club_id = public.user_club_id());

-- Admin-only write
CREATE POLICY "inviti_genitori_admin_write" ON public.inviti_genitori
FOR ALL TO authenticated
USING (public.user_is_admin_like() AND club_id = public.user_club_id())
WITH CHECK (public.user_is_admin_like() AND club_id = public.user_club_id());