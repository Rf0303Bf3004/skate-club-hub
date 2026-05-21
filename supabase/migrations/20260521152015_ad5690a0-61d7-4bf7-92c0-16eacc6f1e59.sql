
-- =========================================================
-- F7-B: Pitch Sponsor — schema + seed + permessi + KPI view
-- =========================================================

-- 1) pacchetti_sponsor
CREATE TABLE IF NOT EXISTS public.pacchetti_sponsor (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  club_id uuid NOT NULL,
  livello text NOT NULL,
  nome_visualizzato text NOT NULL,
  prezzo_annuo numeric NOT NULL DEFAULT 0,
  ordine integer NOT NULL DEFAULT 0,
  colore_brand text NOT NULL DEFAULT '#FFD700',
  benefits jsonb NOT NULL DEFAULT '[]'::jsonb,
  max_sponsor_disponibili integer NULL,
  attivo boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_pacchetti_sponsor_club ON public.pacchetti_sponsor(club_id);

ALTER TABLE public.pacchetti_sponsor ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS f6_soft_all ON public.pacchetti_sponsor;
CREATE POLICY f6_soft_all ON public.pacchetti_sponsor
  FOR ALL TO public
  USING ( auth.uid() IS NULL OR user_is_admin_like() OR club_id = user_club_id() )
  WITH CHECK ( auth.uid() IS NULL OR user_is_admin_like() OR club_id = user_club_id() );

DROP POLICY IF EXISTS allow_all_auth ON public.pacchetti_sponsor;
CREATE POLICY allow_all_auth ON public.pacchetti_sponsor
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

DROP TRIGGER IF EXISTS trg_pacchetti_sponsor_updated_at ON public.pacchetti_sponsor;
CREATE TRIGGER trg_pacchetti_sponsor_updated_at
  BEFORE UPDATE ON public.pacchetti_sponsor
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 2) pitch_template_overrides
CREATE TABLE IF NOT EXISTS public.pitch_template_overrides (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  club_id uuid NOT NULL,
  sezione text NOT NULL,
  testo text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (club_id, sezione)
);
CREATE INDEX IF NOT EXISTS idx_pitch_overrides_club ON public.pitch_template_overrides(club_id);

ALTER TABLE public.pitch_template_overrides ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS f6_soft_all ON public.pitch_template_overrides;
CREATE POLICY f6_soft_all ON public.pitch_template_overrides
  FOR ALL TO public
  USING ( auth.uid() IS NULL OR user_is_admin_like() OR club_id = user_club_id() )
  WITH CHECK ( auth.uid() IS NULL OR user_is_admin_like() OR club_id = user_club_id() );

DROP POLICY IF EXISTS allow_all_auth ON public.pitch_template_overrides;
CREATE POLICY allow_all_auth ON public.pitch_template_overrides
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

DROP TRIGGER IF EXISTS trg_pitch_overrides_updated_at ON public.pitch_template_overrides;
CREATE TRIGGER trg_pitch_overrides_updated_at
  BEFORE UPDATE ON public.pitch_template_overrides
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 3) sponsor.pacchetto_id (FK lazy)
ALTER TABLE public.sponsor ADD COLUMN IF NOT EXISTS pacchetto_id uuid NULL;
CREATE INDEX IF NOT EXISTS idx_sponsor_pacchetto ON public.sponsor(pacchetto_id);

-- 4) Seed funzione + trigger su clubs
CREATE OR REPLACE FUNCTION public.seed_pacchetti_sponsor_default(p_club_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF EXISTS (SELECT 1 FROM public.pacchetti_sponsor WHERE club_id = p_club_id) THEN
    RETURN;
  END IF;
  INSERT INTO public.pacchetti_sponsor (club_id, livello, nome_visualizzato, prezzo_annuo, ordine, colore_brand, benefits, max_sponsor_disponibili) VALUES
  (p_club_id, 'gold', 'Sponsor Gold', 5000, 1, '#FFD700',
   '["Logo su maglie gara","Banner principale a bordo pista","Mention social media mensile","Pagina dedicata sul sito web","Pacchetto premium al Gala di stagione"]'::jsonb, 1),
  (p_club_id, 'silver', 'Sponsor Silver', 2500, 2, '#C0C0C0',
   '["Logo su materiali eventi","Banner a bordo pista","Mention social trimestrale","Logo sul sito web","Inviti al Gala di stagione"]'::jsonb, 3),
  (p_club_id, 'bronze', 'Sponsor Bronze', 1000, 3, '#CD7F32',
   '["Logo sul sito web","Mention social annuale","Ringraziamento al Gala di stagione"]'::jsonb, NULL);
END;
$$;

-- Seed per club esistenti
DO $$
DECLARE r record;
BEGIN
  FOR r IN SELECT id FROM public.clubs LOOP
    PERFORM public.seed_pacchetti_sponsor_default(r.id);
  END LOOP;
END $$;

-- Trigger per club futuri
CREATE OR REPLACE FUNCTION public.trg_seed_pacchetti_sponsor_on_club()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM public.seed_pacchetti_sponsor_default(NEW.id);
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_clubs_seed_pacchetti_sponsor ON public.clubs;
CREATE TRIGGER trg_clubs_seed_pacchetti_sponsor
  AFTER INSERT ON public.clubs
  FOR EACH ROW EXECUTE FUNCTION public.trg_seed_pacchetti_sponsor_on_club();

-- 5) Permessi sezioni
-- Default: SI per admin/superadmin/presidente; NO per dt/segreteria/istruttore/aiuto_monitore
DO $$
DECLARE r record; v_ruolo text; v_codice text; v_visibile boolean;
  ruoli_si  text[] := ARRAY['admin','superadmin','presidente'];
  ruoli_no  text[] := ARRAY['dt','segreteria','istruttore','aiuto_monitore'];
  codici    text[] := ARRAY['pacchetti_sponsor','pitch_pdf_generation'];
BEGIN
  FOR r IN SELECT id FROM public.clubs LOOP
    FOREACH v_codice IN ARRAY codici LOOP
      FOREACH v_ruolo IN ARRAY ruoli_si LOOP
        INSERT INTO public.ruoli_permessi_sezioni (club_id, ruolo, codice_sezione, visibile)
        VALUES (r.id, v_ruolo, v_codice, true)
        ON CONFLICT (club_id, ruolo, codice_sezione) DO NOTHING;
      END LOOP;
      FOREACH v_ruolo IN ARRAY ruoli_no LOOP
        INSERT INTO public.ruoli_permessi_sezioni (club_id, ruolo, codice_sezione, visibile)
        VALUES (r.id, v_ruolo, v_codice, false)
        ON CONFLICT (club_id, ruolo, codice_sezione) DO NOTHING;
      END LOOP;
    END LOOP;
  END LOOP;
END $$;

-- 6) VIEW kpi_pitch_sponsor (un record per club, basato sulla stagione corrente o ultima)
CREATE OR REPLACE VIEW public.kpi_pitch_sponsor AS
WITH stagione_corrente AS (
  SELECT DISTINCT ON (club_id) club_id, id AS stagione_id, data_inizio, data_fine
  FROM public.stagioni
  WHERE CURRENT_DATE BETWEEN data_inizio AND data_fine
  ORDER BY club_id, data_inizio DESC
),
stagione_fallback AS (
  SELECT DISTINCT ON (club_id) club_id, id AS stagione_id, data_inizio, data_fine
  FROM public.stagioni
  ORDER BY club_id, data_inizio DESC
),
stagione AS (
  SELECT c.id AS club_id,
         COALESCE(sc.stagione_id, sf.stagione_id) AS stagione_id,
         COALESCE(sc.data_inizio, sf.data_inizio) AS data_inizio,
         COALESCE(sc.data_fine, sf.data_fine)     AS data_fine
  FROM public.clubs c
  LEFT JOIN stagione_corrente sc ON sc.club_id = c.id
  LEFT JOIN stagione_fallback sf ON sf.club_id = c.id
)
SELECT
  c.id AS club_id,
  s.stagione_id,
  (SELECT COUNT(*)::int FROM public.atleti a WHERE a.club_id = c.id AND a.attivo = true) AS atleti_totali,
  (SELECT COUNT(*)::int FROM public.atleti a WHERE a.club_id = c.id AND a.attivo = true AND a.agonista = true) AS atleti_agonisti,
  (SELECT COUNT(DISTINCT ad.atleta_id)::int
     FROM public.adesioni_atleta ad
     WHERE ad.club_id = c.id
       AND ad.stagione_id = s.stagione_id
       AND NOT EXISTS (
         SELECT 1 FROM public.adesioni_atleta ad2
         WHERE ad2.atleta_id = ad.atleta_id
           AND ad2.club_id = c.id
           AND ad2.data_inizio < COALESCE(s.data_inizio, ad.data_inizio)
       )
  ) AS atleti_nuovi_stagione,
  (SELECT COUNT(*)::int FROM public.corsi co WHERE co.club_id = c.id AND co.attivo = true) AS corsi_attivi,
  (SELECT COALESCE(SUM(EXTRACT(EPOCH FROM (dg.ora_fine - dg.ora_inizio)) / 3600.0), 0)::numeric(10,1)
     FROM public.disponibilita_ghiaccio dg
     WHERE dg.club_id = c.id
       AND dg.tipo = 'ghiaccio'
       AND (dg.stagione_id = s.stagione_id OR dg.stagione_id IS NULL)
  ) AS ore_ghiaccio_settimanali,
  (SELECT COUNT(*)::int FROM public.gare_calendario g
     WHERE g.club_id = c.id
       AND (g.stagione_id = s.stagione_id OR (s.data_inizio IS NOT NULL AND g.data BETWEEN s.data_inizio AND s.data_fine))
  ) AS gare_stagione,
  (SELECT COUNT(*)::int FROM public.istruttori i WHERE i.club_id = c.id AND i.stato_staff = 'attivo') AS staff_totale,
  (SELECT COALESCE(COUNT(*)::numeric / 4.0, 0)::numeric(10,1)
     FROM public.presenze p
     WHERE p.club_id = c.id
       AND p.data >= CURRENT_DATE - INTERVAL '28 days'
       AND p.data < CURRENT_DATE
  ) AS presenza_media_settimanale
FROM public.clubs c
LEFT JOIN stagione s ON s.club_id = c.id;
