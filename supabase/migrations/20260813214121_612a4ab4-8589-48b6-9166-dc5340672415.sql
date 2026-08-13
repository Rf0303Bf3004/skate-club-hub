CREATE OR REPLACE VIEW public.iscrizioni_gare_mobile
WITH (security_invoker = false) AS
SELECT id, gara_id, atleta_id, carriera, livello_atleta, disciplina,
       punteggio, punteggio_tecnico, punteggio_artistico, posizione, medaglia,
       voto_giudici, note, created_at
FROM public.iscrizioni_gare
WHERE public.is_mobile_parent() AND atleta_id = public.mobile_atleta_id();

GRANT SELECT ON public.iscrizioni_gare_mobile TO authenticated;

DROP POLICY IF EXISTS "mobile_parent_select_iscrizioni_gare" ON public.iscrizioni_gare;