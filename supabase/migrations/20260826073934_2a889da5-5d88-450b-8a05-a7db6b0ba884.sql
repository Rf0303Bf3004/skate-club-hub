-- 1) convenzioni_scansioni: lo staff del club può leggere le scansioni del proprio club
CREATE POLICY scan_select_club ON public.convenzioni_scansioni
  FOR SELECT TO authenticated
  USING (club_id = public.user_club_id());

-- 2) gare_calendario: nascondi le colonne di costo ai ruoli non finanziari
REVOKE SELECT ON public.gare_calendario FROM authenticated;
GRANT SELECT (id, club_id, nome, data, ora, luogo, indirizzo, club_ospitante, carriera, livello_minimo, stagione_id, note, archiviata, created_at)
  ON public.gare_calendario TO authenticated;

CREATE OR REPLACE FUNCTION public.get_gare_costi(p_club_id uuid)
RETURNS TABLE(id uuid, costo_iscrizione numeric, costo_accompagnamento numeric)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $$
  SELECT g.id, g.costo_iscrizione, g.costo_accompagnamento
  FROM public.gare_calendario g
  WHERE g.club_id = p_club_id
    AND (
      public.user_is_admin_like()
      OR (public.user_can_see_finance() AND p_club_id = public.user_club_id())
    );
$$;
REVOKE ALL ON FUNCTION public.get_gare_costi(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_gare_costi(uuid) TO authenticated;

-- 3) iscrizioni_corsi: escludi esplicitamente i genitori mobile dalla policy staff
DROP POLICY f6_soft_all ON public.iscrizioni_corsi;
CREATE POLICY f6_soft_all ON public.iscrizioni_corsi
  FOR ALL TO authenticated
  USING (
    NOT public.is_mobile_parent()
    AND (
      public.user_is_admin_like()
      OR EXISTS (
        SELECT 1 FROM public.atleti a
        WHERE a.id = iscrizioni_corsi.atleta_id
          AND a.club_id = public.user_club_id()
      )
    )
  )
  WITH CHECK (
    NOT public.is_mobile_parent()
    AND (
      public.user_is_admin_like()
      OR EXISTS (
        SELECT 1 FROM public.atleti a
        WHERE a.id = iscrizioni_corsi.atleta_id
          AND a.club_id = public.user_club_id()
      )
    )
  );

-- 4) istruttori: nascondi email/telefono ai ruoli non autorizzati
REVOKE SELECT (email, telefono) ON public.istruttori FROM authenticated;

CREATE OR REPLACE FUNCTION public.get_istruttori_contatti(p_club_id uuid)
RETURNS TABLE(id uuid, email text, telefono text)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $$
  SELECT i.id, i.email, i.telefono
  FROM public.istruttori i
  WHERE i.club_id = p_club_id
    AND (
      public.user_is_admin_like()
      OR (public.user_can_see_finance() AND p_club_id = public.user_club_id())
      OR i.user_id = auth.uid()
    );
$$;
REVOKE ALL ON FUNCTION public.get_istruttori_contatti(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_istruttori_contatti(uuid) TO authenticated;