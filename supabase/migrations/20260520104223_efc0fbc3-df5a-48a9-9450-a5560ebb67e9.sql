-- 1. CHECK constraint on roles
ALTER TABLE public.utenti_club DROP CONSTRAINT IF EXISTS utenti_club_ruolo_check;
ALTER TABLE public.utenti_club ADD CONSTRAINT utenti_club_ruolo_check
  CHECK (ruolo IN ('superadmin','admin','presidente','dt','segreteria','istruttore','atleta','genitore'));

-- 2. Add missing columns to ore_lavorate_istruttori cache
ALTER TABLE public.ore_lavorate_istruttori
  ADD COLUMN IF NOT EXISTS anno integer,
  ADD COLUMN IF NOT EXISTS mese integer,
  ADD COLUMN IF NOT EXISTS ore_extra numeric DEFAULT 0,
  ADD COLUMN IF NOT EXISTS ore_campi numeric DEFAULT 0,
  ADD COLUMN IF NOT EXISTS ore_gare numeric DEFAULT 0,
  ADD COLUMN IF NOT EXISTS note_extra text DEFAULT '',
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

-- Backfill anno/mese from periodo on legacy rows
UPDATE public.ore_lavorate_istruttori
SET anno = COALESCE(anno, NULLIF(split_part(periodo,'-',1),'')::int),
    mese = COALESCE(mese, NULLIF(split_part(periodo,'-',2),'')::int)
WHERE (anno IS NULL OR mese IS NULL) AND periodo ~ '^\d{4}-\d{2}$';

CREATE UNIQUE INDEX IF NOT EXISTS uq_ore_lavorate_istruttori_anno_mese
  ON public.ore_lavorate_istruttori (istruttore_id, anno, mese)
  WHERE anno IS NOT NULL AND mese IS NOT NULL;

-- 3. New per-slot timesheet table
CREATE TABLE IF NOT EXISTS public.ore_lavorate_dettaglio (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  club_id uuid NOT NULL,
  istruttore_id uuid NOT NULL,
  planning_corso_id uuid,
  data date NOT NULL,
  ora_inizio time,
  ora_fine time,
  ore_calcolate numeric NOT NULL DEFAULT 0,
  tipo text NOT NULL DEFAULT 'presenza_reale'
    CHECK (tipo IN ('presenza_reale','override_manuale','evento','gara','extra')),
  motivo text DEFAULT '',
  confermato_da uuid,
  confermato_at timestamptz,
  source_presenza_id uuid,
  note text DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_ore_dettaglio_istruttore_data
  ON public.ore_lavorate_dettaglio (istruttore_id, data);
CREATE INDEX IF NOT EXISTS idx_ore_dettaglio_planning
  ON public.ore_lavorate_dettaglio (planning_corso_id) WHERE planning_corso_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS uq_ore_dettaglio_planning_istruttore
  ON public.ore_lavorate_dettaglio (planning_corso_id, istruttore_id)
  WHERE planning_corso_id IS NOT NULL;

ALTER TABLE public.ore_lavorate_dettaglio ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow all for authenticated" ON public.ore_lavorate_dettaglio;
CREATE POLICY "Allow all for authenticated" ON public.ore_lavorate_dettaglio
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- 4. Trigger function: recompute monthly cache after dettaglio change
CREATE OR REPLACE FUNCTION public.ricalcola_cache_ore_mensile(
  p_istruttore_id uuid, p_anno int, p_mese int
) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_club_id uuid;
  v_ore_corsi numeric := 0;
BEGIN
  SELECT club_id INTO v_club_id FROM public.istruttori WHERE id = p_istruttore_id;
  IF v_club_id IS NULL THEN RETURN; END IF;

  SELECT COALESCE(SUM(ore_calcolate), 0) INTO v_ore_corsi
  FROM public.ore_lavorate_dettaglio
  WHERE istruttore_id = p_istruttore_id
    AND EXTRACT(YEAR FROM data)::int = p_anno
    AND EXTRACT(MONTH FROM data)::int = p_mese
    AND tipo IN ('presenza_reale','override_manuale');

  INSERT INTO public.ore_lavorate_istruttori
    (club_id, istruttore_id, anno, mese, periodo, ore_corsi, updated_at)
  VALUES
    (v_club_id, p_istruttore_id, p_anno, p_mese,
     p_anno || '-' || lpad(p_mese::text, 2, '0'),
     v_ore_corsi, now())
  ON CONFLICT (istruttore_id, anno, mese)
  WHERE anno IS NOT NULL AND mese IS NOT NULL
  DO UPDATE SET
    ore_corsi = EXCLUDED.ore_corsi,
    updated_at = now();
END $$;

CREATE OR REPLACE FUNCTION public.trg_ore_dettaglio_aggiorna_cache()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_data date;
  v_istr uuid;
BEGIN
  IF TG_OP = 'DELETE' THEN
    v_data := OLD.data; v_istr := OLD.istruttore_id;
  ELSE
    v_data := NEW.data; v_istr := NEW.istruttore_id;
  END IF;
  PERFORM public.ricalcola_cache_ore_mensile(
    v_istr,
    EXTRACT(YEAR FROM v_data)::int,
    EXTRACT(MONTH FROM v_data)::int
  );
  RETURN NULL;
END $$;

DROP TRIGGER IF EXISTS trg_ore_dettaglio_cache ON public.ore_lavorate_dettaglio;
CREATE TRIGGER trg_ore_dettaglio_cache
  AFTER INSERT OR UPDATE OR DELETE ON public.ore_lavorate_dettaglio
  FOR EACH ROW EXECUTE FUNCTION public.trg_ore_dettaglio_aggiorna_cache();

-- Trigger to auto-update updated_at
DROP TRIGGER IF EXISTS trg_ore_dettaglio_updated_at ON public.ore_lavorate_dettaglio;
CREATE TRIGGER trg_ore_dettaglio_updated_at
  BEFORE UPDATE ON public.ore_lavorate_dettaglio
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();