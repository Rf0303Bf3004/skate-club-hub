
-- ============================================================
-- Security hardening: tenant isolation for storage + drop
-- overly-permissive RLS + restrict PII on public clubs
-- ============================================================

-- 1) Drop redundant permissive policies that override f6_soft_all
DROP POLICY IF EXISTS "allow_all_auth" ON public.pacchetti_sponsor;
DROP POLICY IF EXISTS "allow_all_auth" ON public.pitch_template_overrides;

-- 2) Storage: replace bucket_id-only policies with path-based club isolation.
--    Convention used in all upload sites: `${club_id}/...`
--    -> (storage.foldername(name))[1] = user_club_id()::text

-- foto-atleti (public read kept; mobile_parent policies preserved)
DROP POLICY IF EXISTS "Authenticated upload foto-atleti" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated update foto-atleti" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated delete foto-atleti" ON storage.objects;

CREATE POLICY "club_insert_foto_atleti" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'foto-atleti'
    AND (public.user_is_admin_like()
         OR (storage.foldername(name))[1] = public.user_club_id()::text)
  );
CREATE POLICY "club_update_foto_atleti" ON storage.objects
  FOR UPDATE TO authenticated
  USING (
    bucket_id = 'foto-atleti'
    AND (public.user_is_admin_like()
         OR (storage.foldername(name))[1] = public.user_club_id()::text)
  )
  WITH CHECK (
    bucket_id = 'foto-atleti'
    AND (public.user_is_admin_like()
         OR (storage.foldername(name))[1] = public.user_club_id()::text)
  );
CREATE POLICY "club_delete_foto_atleti" ON storage.objects
  FOR DELETE TO authenticated
  USING (
    bucket_id = 'foto-atleti'
    AND (public.user_is_admin_like()
         OR (storage.foldername(name))[1] = public.user_club_id()::text)
  );

-- loghi-club (public read kept)
DROP POLICY IF EXISTS "Authenticated upload loghi-club" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated update loghi-club" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated delete loghi-club" ON storage.objects;

CREATE POLICY "club_insert_loghi_club" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'loghi-club'
    AND (public.user_is_admin_like()
         OR (storage.foldername(name))[1] = public.user_club_id()::text)
  );
CREATE POLICY "club_update_loghi_club" ON storage.objects
  FOR UPDATE TO authenticated
  USING (
    bucket_id = 'loghi-club'
    AND (public.user_is_admin_like()
         OR (storage.foldername(name))[1] = public.user_club_id()::text)
  )
  WITH CHECK (
    bucket_id = 'loghi-club'
    AND (public.user_is_admin_like()
         OR (storage.foldername(name))[1] = public.user_club_id()::text)
  );
CREATE POLICY "club_delete_loghi_club" ON storage.objects
  FOR DELETE TO authenticated
  USING (
    bucket_id = 'loghi-club'
    AND (public.user_is_admin_like()
         OR (storage.foldername(name))[1] = public.user_club_id()::text)
  );

-- dischi-musicali (public read kept)
DROP POLICY IF EXISTS "Authenticated upload dischi-musicali" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated update dischi-musicali" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated delete dischi-musicali" ON storage.objects;

CREATE POLICY "club_insert_dischi_musicali" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'dischi-musicali'
    AND (public.user_is_admin_like()
         OR (storage.foldername(name))[1] = public.user_club_id()::text)
  );
CREATE POLICY "club_update_dischi_musicali" ON storage.objects
  FOR UPDATE TO authenticated
  USING (
    bucket_id = 'dischi-musicali'
    AND (public.user_is_admin_like()
         OR (storage.foldername(name))[1] = public.user_club_id()::text)
  )
  WITH CHECK (
    bucket_id = 'dischi-musicali'
    AND (public.user_is_admin_like()
         OR (storage.foldername(name))[1] = public.user_club_id()::text)
  );
CREATE POLICY "club_delete_dischi_musicali" ON storage.objects
  FOR DELETE TO authenticated
  USING (
    bucket_id = 'dischi-musicali'
    AND (public.user_is_admin_like()
         OR (storage.foldername(name))[1] = public.user_club_id()::text)
  );

-- relazioni-allegati (PRIVATE bucket: also restrict SELECT)
DROP POLICY IF EXISTS "Auth read relazioni-allegati" ON storage.objects;
DROP POLICY IF EXISTS "Auth insert relazioni-allegati" ON storage.objects;
DROP POLICY IF EXISTS "Auth update relazioni-allegati" ON storage.objects;
DROP POLICY IF EXISTS "Auth delete relazioni-allegati" ON storage.objects;

CREATE POLICY "club_select_relazioni_allegati" ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'relazioni-allegati'
    AND (public.user_is_admin_like()
         OR (storage.foldername(name))[1] = public.user_club_id()::text)
  );
CREATE POLICY "club_insert_relazioni_allegati" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'relazioni-allegati'
    AND (public.user_is_admin_like()
         OR (storage.foldername(name))[1] = public.user_club_id()::text)
  );
CREATE POLICY "club_update_relazioni_allegati" ON storage.objects
  FOR UPDATE TO authenticated
  USING (
    bucket_id = 'relazioni-allegati'
    AND (public.user_is_admin_like()
         OR (storage.foldername(name))[1] = public.user_club_id()::text)
  )
  WITH CHECK (
    bucket_id = 'relazioni-allegati'
    AND (public.user_is_admin_like()
         OR (storage.foldername(name))[1] = public.user_club_id()::text)
  );
CREATE POLICY "club_delete_relazioni_allegati" ON storage.objects
  FOR DELETE TO authenticated
  USING (
    bucket_id = 'relazioni-allegati'
    AND (public.user_is_admin_like()
         OR (storage.foldername(name))[1] = public.user_club_id()::text)
  );

-- 3) clubs PII: revoke email + telefono from anon (column-level privilege).
--    Public read of non-PII club fields is intentional for landing/register;
--    authenticated users still see full row via existing policies.
REVOKE SELECT (email, telefono) ON public.clubs FROM anon;
