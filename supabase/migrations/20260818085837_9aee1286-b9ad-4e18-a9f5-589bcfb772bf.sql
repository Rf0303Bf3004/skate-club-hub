-- 1) SECURITY DEFINER view -> security_invoker view over a controlled function
CREATE OR REPLACE FUNCTION public.mobile_iscrizioni_gare()
RETURNS TABLE (
  id uuid,
  gara_id uuid,
  atleta_id uuid,
  carriera text,
  livello_atleta text,
  disciplina text,
  punteggio numeric,
  punteggio_tecnico numeric,
  punteggio_artistico numeric,
  posizione integer,
  medaglia text,
  voto_giudici text,
  note text,
  created_at timestamptz
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT ig.id, ig.gara_id, ig.atleta_id, ig.carriera, ig.livello_atleta, ig.disciplina,
         ig.punteggio, ig.punteggio_tecnico, ig.punteggio_artistico, ig.posizione,
         ig.medaglia, ig.voto_giudici, ig.note, ig.created_at
  FROM public.iscrizioni_gare ig
  WHERE public.is_mobile_parent() AND ig.atleta_id = public.mobile_atleta_id();
$$;

REVOKE ALL ON FUNCTION public.mobile_iscrizioni_gare() FROM public;
GRANT EXECUTE ON FUNCTION public.mobile_iscrizioni_gare() TO authenticated;

DROP VIEW IF EXISTS public.iscrizioni_gare_mobile;
CREATE VIEW public.iscrizioni_gare_mobile
WITH (security_invoker = true) AS
  SELECT * FROM public.mobile_iscrizioni_gare();

GRANT SELECT ON public.iscrizioni_gare_mobile TO authenticated;

-- 2) Restrict columns a mobile parent may update on atleti
CREATE OR REPLACE FUNCTION public.atleti_mobile_parent_column_guard()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  allowed text[] := ARRAY[
    'telefono','indirizzo','cap','citta','cantone','paese_iso','regione','provincia','foto_url',
    'genitore1_nome','genitore1_cognome','genitore1_telefono','genitore1_email','genitore1_indirizzo',
    'genitore1_cap','genitore1_citta','genitore1_cantone','genitore1_paese_iso','genitore1_regione','genitore1_provincia',
    'genitore2_nome','genitore2_cognome','genitore2_telefono','genitore2_email','genitore2_indirizzo',
    'genitore2_cap','genitore2_citta','genitore2_cantone','genitore2_paese_iso','genitore2_regione','genitore2_provincia',
    'consenso_foto_video','consenso_privacy','consenso_dati_medici','note_genitori'
  ];
  col text;
  old_json jsonb := to_jsonb(OLD);
  new_json jsonb := to_jsonb(NEW);
BEGIN
  IF NOT public.is_mobile_parent() THEN
    RETURN NEW;
  END IF;

  FOR col IN SELECT jsonb_object_keys(new_json) LOOP
    IF (new_json -> col) IS DISTINCT FROM (old_json -> col)
       AND NOT (col = ANY (allowed)) THEN
      RAISE EXCEPTION 'Campo % non modificabile dal portale genitori', col
        USING ERRCODE = '42501';
    END IF;
  END LOOP;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_atleti_mobile_parent_column_guard ON public.atleti;
CREATE TRIGGER trg_atleti_mobile_parent_column_guard
  BEFORE UPDATE ON public.atleti
  FOR EACH ROW EXECUTE FUNCTION public.atleti_mobile_parent_column_guard();

-- 3) Inactive convenzioni must not be publicly readable
DROP POLICY IF EXISTS conv_select_all ON public.convenzioni;
DROP POLICY IF EXISTS convenzioni_public_select_attive ON public.convenzioni;

CREATE POLICY conv_select_attive_anon ON public.convenzioni
  FOR SELECT TO anon
  USING (stato = 'attiva');

CREATE POLICY conv_select_attive_auth ON public.convenzioni
  FOR SELECT TO authenticated
  USING (stato = 'attiva' OR public.is_superadmin());
