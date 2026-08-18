
-- 1) clubs: remove broad mobile parent row access, expose safe columns via view
DROP POLICY IF EXISTS mobile_parent_select_clubs ON public.clubs;

CREATE OR REPLACE VIEW public.clubs_mobile_public AS
SELECT c.id, c.nome, c.sigla, c.citta, c.cantone, c.paese, c.indirizzo, c.cap,
       c.email, c.telefono, c.sito_web, c.logo_url, c.colore_primario, c.descrizione
FROM public.clubs c
WHERE public.is_mobile_parent() AND c.id = public.mobile_club_id();

GRANT SELECT ON public.clubs_mobile_public TO authenticated;

-- 2) explicit role check on athlete-scoped mobile policies
DROP POLICY IF EXISTS eventi_calendario_atleta_self ON public.eventi_calendario;
CREATE POLICY eventi_calendario_atleta_self ON public.eventi_calendario
  FOR SELECT TO authenticated
  USING (public.is_mobile_parent() AND atleta_id IS NOT NULL AND atleta_id = public.mobile_atleta_id());

DROP POLICY IF EXISTS percorsi_atleta_self ON public.percorsi_atleta;
CREATE POLICY percorsi_atleta_self ON public.percorsi_atleta
  FOR SELECT TO authenticated
  USING (public.is_mobile_parent() AND atleta_id IS NOT NULL AND atleta_id = public.mobile_atleta_id());

-- 3) istruttori: hide compensation columns from generic staff reads
REVOKE SELECT ON public.istruttori FROM authenticated, anon;
GRANT SELECT (
  id, club_id, nome, cognome, email, telefono, colore, attivo, created_at,
  linked_atleta_id, livello_istruttore, stato_staff, note, tipo_contratto, specialita
) ON public.istruttori TO authenticated;
