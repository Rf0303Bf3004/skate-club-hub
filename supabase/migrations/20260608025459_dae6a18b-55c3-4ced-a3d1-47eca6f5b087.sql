
-- RLS storage.objects bucket convenzioni
CREATE POLICY "convenzioni_select_authenticated" ON storage.objects
  FOR SELECT TO authenticated USING (bucket_id = 'convenzioni');
CREATE POLICY "convenzioni_insert_superadmin" ON storage.objects
  FOR INSERT TO authenticated WITH CHECK (bucket_id = 'convenzioni' AND public.is_superadmin());
CREATE POLICY "convenzioni_update_superadmin" ON storage.objects
  FOR UPDATE TO authenticated USING (bucket_id = 'convenzioni' AND public.is_superadmin());
CREATE POLICY "convenzioni_delete_superadmin" ON storage.objects
  FOR DELETE TO authenticated USING (bucket_id = 'convenzioni' AND public.is_superadmin());
