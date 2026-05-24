
DROP POLICY IF EXISTS "mobile_parent_select_comunicazioni" ON public.comunicazioni;
CREATE POLICY "mobile_parent_select_comunicazioni"
  ON public.comunicazioni
  FOR SELECT
  USING (
    is_mobile_parent()
    AND club_id = mobile_club_id()
    AND EXISTS (
      SELECT 1 FROM public.comunicazioni_destinatari cd
      WHERE cd.comunicazione_id = comunicazioni.id
        AND cd.atleta_id = mobile_atleta_id()
    )
  );

DROP POLICY IF EXISTS "mobile_parent_select_gare" ON public.gare_calendario;

CREATE OR REPLACE VIEW public.gare_calendario_mobile
WITH (security_invoker = true) AS
SELECT
  id, club_id, stagione_id, nome, data, ora, luogo, indirizzo,
  club_ospitante, carriera, livello_minimo, archiviata, note, created_at
FROM public.gare_calendario
WHERE is_mobile_parent() AND club_id = mobile_club_id();

GRANT SELECT ON public.gare_calendario_mobile TO authenticated, anon;
