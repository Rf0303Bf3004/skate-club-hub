
-- 1) TABELLA livelli_catalogo (la legacy 'livelli' resta per i test)
CREATE TABLE IF NOT EXISTS public.livelli_catalogo (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  paese text NOT NULL DEFAULT 'CH',
  categoria text NOT NULL CHECK (categoria IN ('pulcini','amatori','artistica')),
  nome text NOT NULL,
  ordine integer NOT NULL,
  attivo boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (paese, categoria, nome)
);
CREATE INDEX IF NOT EXISTS idx_livelli_catalogo_paese_cat ON public.livelli_catalogo (paese, categoria, ordine);

ALTER TABLE public.livelli_catalogo ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS livelli_catalogo_read_all ON public.livelli_catalogo;
CREATE POLICY livelli_catalogo_read_all ON public.livelli_catalogo FOR SELECT USING (true);
DROP POLICY IF EXISTS livelli_catalogo_admin_write ON public.livelli_catalogo;
CREATE POLICY livelli_catalogo_admin_write ON public.livelli_catalogo FOR ALL
  USING (public.user_is_admin_like())
  WITH CHECK (public.user_is_admin_like());

INSERT INTO public.livelli_catalogo (paese, categoria, nome, ordine) VALUES
('CH','pulcini','Pulcini',1),
('CH','amatori','Stellina 1',1),
('CH','amatori','Stellina 2',2),
('CH','amatori','Stellina 3',3),
('CH','artistica','Stellina 4',1),
('CH','artistica','Interbronzo',2),
('CH','artistica','Bronzo',3),
('CH','artistica','Interargento',4),
('CH','artistica','Argento',5),
('CH','artistica','Interoro',6),
('CH','artistica','Oro',7)
ON CONFLICT (paese, categoria, nome) DO NOTHING;

-- 2) TABELLA percorsi_atleta
CREATE TABLE IF NOT EXISTS public.percorsi_atleta (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  atleta_id uuid NOT NULL REFERENCES public.atleti(id) ON DELETE CASCADE,
  percorso text NOT NULL CHECK (percorso IN ('pulcini','amatori','artistica','stile')),
  livello_attuale_id uuid NULL REFERENCES public.livelli_catalogo(id),
  livello_in_preparazione_id uuid NULL REFERENCES public.livelli_catalogo(id),
  livelli_extra_autorizzati_ids uuid[] NOT NULL DEFAULT '{}',
  attivo boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (atleta_id, percorso)
);
CREATE INDEX IF NOT EXISTS idx_percorsi_atleta ON public.percorsi_atleta (atleta_id);

ALTER TABLE public.percorsi_atleta ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS percorsi_atleta_self ON public.percorsi_atleta;
CREATE POLICY percorsi_atleta_self ON public.percorsi_atleta FOR SELECT
  USING (atleta_id = NULLIF((auth.jwt() -> 'app_metadata' ->> 'atleta_id'),'')::uuid);
DROP POLICY IF EXISTS percorsi_atleta_staff_read ON public.percorsi_atleta;
CREATE POLICY percorsi_atleta_staff_read ON public.percorsi_atleta FOR SELECT
  USING (
    public.user_is_admin_like()
    OR EXISTS (
      SELECT 1 FROM public.atleti a
      WHERE a.id = percorsi_atleta.atleta_id
        AND a.club_id = public.user_club_id()
    )
  );
DROP POLICY IF EXISTS percorsi_atleta_staff_write ON public.percorsi_atleta;
CREATE POLICY percorsi_atleta_staff_write ON public.percorsi_atleta FOR ALL
  USING (
    public.user_is_admin_like()
    OR EXISTS (
      SELECT 1 FROM public.atleti a
      WHERE a.id = percorsi_atleta.atleta_id
        AND a.club_id = public.user_club_id()
    )
  )
  WITH CHECK (
    public.user_is_admin_like()
    OR EXISTS (
      SELECT 1 FROM public.atleti a
      WHERE a.id = percorsi_atleta.atleta_id
        AND a.club_id = public.user_club_id()
    )
  );

DROP TRIGGER IF EXISTS trg_percorsi_atleta_updated_at ON public.percorsi_atleta;
CREATE TRIGGER trg_percorsi_atleta_updated_at
  BEFORE UPDATE ON public.percorsi_atleta
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 3) corsi.livello_id
ALTER TABLE public.corsi ADD COLUMN IF NOT EXISTS livello_id uuid REFERENCES public.livelli_catalogo(id);
CREATE INDEX IF NOT EXISTS idx_corsi_livello_id ON public.corsi (livello_id);

-- 4) Funzione di migrazione per singolo atleta
CREATE OR REPLACE FUNCTION public.migra_atleta_livello(p_atleta_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_liv text;
  v_categoria text;
  v_percorso text;
  v_attuale_id uuid;
  v_prep_id uuid;
BEGIN
  SELECT COALESCE(NULLIF(trim(livello_attuale),''), 'Pulcini') INTO v_liv
    FROM public.atleti WHERE id = p_atleta_id;
  IF v_liv IS NULL THEN v_liv := 'Pulcini'; END IF;

  IF v_liv = 'Pulcini' THEN
    v_percorso := 'pulcini'; v_categoria := 'pulcini';
  ELSIF v_liv IN ('Stellina 1','Stellina 2','Stellina 3') THEN
    v_percorso := 'amatori'; v_categoria := 'amatori';
  ELSIF v_liv IN ('Stellina 4','Interbronzo','Bronzo','Interargento','Argento','Interoro','Oro') THEN
    v_percorso := 'artistica'; v_categoria := 'artistica';
  ELSE
    RETURN;
  END IF;

  SELECT id INTO v_attuale_id FROM public.livelli_catalogo
    WHERE paese='CH' AND categoria = v_categoria AND nome = v_liv;

  IF v_liv = 'Pulcini' THEN
    SELECT id INTO v_prep_id FROM public.livelli_catalogo WHERE paese='CH' AND categoria='amatori' AND nome='Stellina 1';
  ELSIF v_liv = 'Stellina 3' THEN
    SELECT id INTO v_prep_id FROM public.livelli_catalogo WHERE paese='CH' AND categoria='artistica' AND nome='Stellina 4';
  ELSIF v_liv = 'Oro' THEN
    v_prep_id := NULL;
  ELSE
    SELECT id INTO v_prep_id FROM public.livelli_catalogo
      WHERE paese='CH' AND categoria=v_categoria
        AND ordine = (SELECT ordine+1 FROM public.livelli_catalogo
                       WHERE paese='CH' AND categoria=v_categoria AND nome=v_liv);
  END IF;

  INSERT INTO public.percorsi_atleta (atleta_id, percorso, livello_attuale_id, livello_in_preparazione_id, attivo)
  VALUES (p_atleta_id, v_percorso, v_attuale_id, v_prep_id, true)
  ON CONFLICT (atleta_id, percorso) DO UPDATE
    SET livello_attuale_id = EXCLUDED.livello_attuale_id,
        livello_in_preparazione_id = EXCLUDED.livello_in_preparazione_id,
        attivo = true,
        updated_at = now();
END $$;

-- 5) Backfill atleti
DO $$
DECLARE r record;
BEGIN
  FOR r IN SELECT id FROM public.atleti LOOP
    PERFORM public.migra_atleta_livello(r.id);
  END LOOP;
END $$;

-- 6) Backfill corsi.livello_id (match per nome del corso == nome del livello)
UPDATE public.corsi c
SET livello_id = l.id
FROM public.livelli_catalogo l
WHERE l.paese='CH' AND l.nome = c.nome AND c.livello_id IS NULL;
