CREATE POLICY "f6_child_soft" ON public.iscrizioni_pacchetti
FOR ALL TO authenticated
USING (
  public.user_is_admin_like()
  OR EXISTS (SELECT 1 FROM public.atleti a WHERE a.id = iscrizioni_pacchetti.atleta_id AND a.club_id = public.user_club_id())
)
WITH CHECK (
  public.user_is_admin_like()
  OR EXISTS (SELECT 1 FROM public.atleti a WHERE a.id = iscrizioni_pacchetti.atleta_id AND a.club_id = public.user_club_id())
);