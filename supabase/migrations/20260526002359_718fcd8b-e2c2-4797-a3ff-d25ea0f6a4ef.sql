
-- Harden RLS: restrict to authenticated role and use SECURITY DEFINER helper for mobile JWT claims

-- letture_comunicazioni: scope to authenticated + use mobile_atleta_id() helper
DROP POLICY IF EXISTS atleta_self_select ON public.letture_comunicazioni;
DROP POLICY IF EXISTS atleta_self_insert ON public.letture_comunicazioni;
DROP POLICY IF EXISTS atleta_self_update ON public.letture_comunicazioni;
DROP POLICY IF EXISTS atleta_self_delete ON public.letture_comunicazioni;

CREATE POLICY atleta_self_select ON public.letture_comunicazioni
  FOR SELECT TO authenticated
  USING (atleta_id = public.mobile_atleta_id());
CREATE POLICY atleta_self_insert ON public.letture_comunicazioni
  FOR INSERT TO authenticated
  WITH CHECK (atleta_id = public.mobile_atleta_id());
CREATE POLICY atleta_self_update ON public.letture_comunicazioni
  FOR UPDATE TO authenticated
  USING (atleta_id = public.mobile_atleta_id())
  WITH CHECK (atleta_id = public.mobile_atleta_id());
CREATE POLICY atleta_self_delete ON public.letture_comunicazioni
  FOR DELETE TO authenticated
  USING (atleta_id = public.mobile_atleta_id());

-- percorsi_atleta: scope to authenticated
DROP POLICY IF EXISTS percorsi_atleta_self ON public.percorsi_atleta;
DROP POLICY IF EXISTS percorsi_atleta_staff_read ON public.percorsi_atleta;
DROP POLICY IF EXISTS percorsi_atleta_staff_write ON public.percorsi_atleta;

CREATE POLICY percorsi_atleta_self ON public.percorsi_atleta
  FOR SELECT TO authenticated
  USING (atleta_id = public.mobile_atleta_id());

CREATE POLICY percorsi_atleta_staff_read ON public.percorsi_atleta
  FOR SELECT TO authenticated
  USING (
    public.user_is_admin_like() OR EXISTS (
      SELECT 1 FROM public.atleti a
      WHERE a.id = percorsi_atleta.atleta_id AND a.club_id = public.user_club_id()
    )
  );

CREATE POLICY percorsi_atleta_staff_write ON public.percorsi_atleta
  FOR ALL TO authenticated
  USING (
    public.user_is_admin_like() OR EXISTS (
      SELECT 1 FROM public.atleti a
      WHERE a.id = percorsi_atleta.atleta_id AND a.club_id = public.user_club_id()
    )
  )
  WITH CHECK (
    public.user_is_admin_like() OR EXISTS (
      SELECT 1 FROM public.atleti a
      WHERE a.id = percorsi_atleta.atleta_id AND a.club_id = public.user_club_id()
    )
  );

-- eventi_calendario: scope to authenticated + use mobile_atleta_id() helper
DROP POLICY IF EXISTS eventi_calendario_atleta_self ON public.eventi_calendario;
DROP POLICY IF EXISTS eventi_calendario_staff_all ON public.eventi_calendario;

CREATE POLICY eventi_calendario_atleta_self ON public.eventi_calendario
  FOR SELECT TO authenticated
  USING (atleta_id = public.mobile_atleta_id());

CREATE POLICY eventi_calendario_staff_all ON public.eventi_calendario
  FOR ALL TO authenticated
  USING (
    public.user_is_admin_like() OR EXISTS (
      SELECT 1 FROM public.utenti_club
      WHERE utenti_club.user_id = auth.uid()
        AND utenti_club.club_id = eventi_calendario.club_id
        AND COALESCE(utenti_club.attivo, true) = true
    )
  )
  WITH CHECK (
    public.user_is_admin_like() OR EXISTS (
      SELECT 1 FROM public.utenti_club
      WHERE utenti_club.user_id = auth.uid()
        AND utenti_club.club_id = eventi_calendario.club_id
        AND COALESCE(utenti_club.attivo, true) = true
    )
  );
