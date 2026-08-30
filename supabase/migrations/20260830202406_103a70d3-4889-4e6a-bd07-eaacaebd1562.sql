CREATE POLICY "club_select_fatture_atleti" ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'fatture-atleti' AND (public.user_is_admin_like() OR (storage.foldername(name))[1] = (public.user_club_id())::text));

CREATE POLICY "club_insert_fatture_atleti" ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'fatture-atleti' AND (public.user_is_admin_like() OR (storage.foldername(name))[1] = (public.user_club_id())::text));

CREATE POLICY "club_update_fatture_atleti" ON storage.objects FOR UPDATE TO authenticated
USING (bucket_id = 'fatture-atleti' AND (public.user_is_admin_like() OR (storage.foldername(name))[1] = (public.user_club_id())::text))
WITH CHECK (bucket_id = 'fatture-atleti' AND (public.user_is_admin_like() OR (storage.foldername(name))[1] = (public.user_club_id())::text));

CREATE POLICY "club_delete_fatture_atleti" ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'fatture-atleti' AND (public.user_is_admin_like() OR (storage.foldername(name))[1] = (public.user_club_id())::text));