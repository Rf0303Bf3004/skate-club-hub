
-- PARTE 2: normalize_label
CREATE OR REPLACE FUNCTION public.normalize_label(input text) RETURNS text LANGUAGE sql IMMUTABLE AS $$
  SELECT lower(
    translate(input,
      'àáâãäåèéêëìíîïòóôõöùúûüÀÁÂÃÄÅÈÉÊËÌÍÎÏÒÓÔÕÖÙÚÛÜ',
      'aaaaaaeeeeiiiiooooouuuuAAAAAAEEEEIIIIOOOOOUUUU'
    )
  )
$$;

-- PARTE 1: tabella eventi_calendario
CREATE TABLE IF NOT EXISTS public.eventi_calendario (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  atleta_id uuid NOT NULL,
  club_id uuid NOT NULL,
  tipo text NOT NULL CHECK (tipo IN ('corso','lezione_privata','gara','campo','gala','pacchetto_pre','pacchetto_post','evento_straordinario')),
  riferimento_id uuid NULL,
  data date NOT NULL,
  ora_inizio time NOT NULL,
  ora_fine time NULL,
  luogo text NULL,
  nome_evento text NULL,
  stato text NOT NULL DEFAULT 'confermato' CHECK (stato IN ('confermato','in_attesa','annullato')),
  note text NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (atleta_id, tipo, riferimento_id, data, ora_inizio)
);

CREATE INDEX IF NOT EXISTS idx_eventi_atleta_data ON public.eventi_calendario (atleta_id, data DESC);
CREATE INDEX IF NOT EXISTS idx_eventi_club_data ON public.eventi_calendario (club_id, data DESC);
CREATE INDEX IF NOT EXISTS idx_eventi_riferimento ON public.eventi_calendario (riferimento_id);

ALTER TABLE public.eventi_calendario ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS eventi_calendario_atleta_self ON public.eventi_calendario;
CREATE POLICY eventi_calendario_atleta_self ON public.eventi_calendario FOR SELECT
  USING (atleta_id = NULLIF((auth.jwt() -> 'app_metadata' ->> 'atleta_id'), '')::uuid);

DROP POLICY IF EXISTS eventi_calendario_staff_all ON public.eventi_calendario;
CREATE POLICY eventi_calendario_staff_all ON public.eventi_calendario FOR ALL
  USING (public.user_is_admin_like() OR EXISTS (
    SELECT 1 FROM public.utenti_club WHERE user_id = auth.uid() AND club_id = eventi_calendario.club_id AND COALESCE(attivo, true) = true
  ));

-- PARTE 2: trigger normalizzazione giorno
CREATE OR REPLACE FUNCTION public.trg_normalize_corso_giorno() RETURNS trigger LANGUAGE plpgsql SET search_path TO 'public' AS $$
BEGIN
  IF NEW.giorno IS NOT NULL THEN
    NEW.giorno := public.normalize_label(NEW.giorno);
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS corsi_normalize_giorno ON public.corsi;
CREATE TRIGGER corsi_normalize_giorno BEFORE INSERT OR UPDATE ON public.corsi
  FOR EACH ROW EXECUTE FUNCTION public.trg_normalize_corso_giorno();

-- Backfill normalizzazione
UPDATE public.corsi SET giorno = public.normalize_label(giorno) WHERE giorno IS NOT NULL;

-- PARTE 3: spawn_corso_atleta
CREATE OR REPLACE FUNCTION public.spawn_corso_atleta(p_corso_id uuid, p_atleta_id uuid) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE
  v_corso record;
  v_club_id uuid;
  v_giorno_idx int;
  v_data_inizio date;
  v_data_fine date;
  v_cur date;
BEGIN
  SELECT c.*, a.club_id AS a_club_id INTO v_corso FROM corsi c JOIN atleti a ON a.id = p_atleta_id WHERE c.id = p_corso_id;
  IF NOT FOUND OR COALESCE(v_corso.attivo, true) = false THEN RETURN; END IF;
  v_club_id := v_corso.a_club_id;

  v_giorno_idx := CASE public.normalize_label(v_corso.giorno)
    WHEN 'lunedi' THEN 1 WHEN 'martedi' THEN 2 WHEN 'mercoledi' THEN 3
    WHEN 'giovedi' THEN 4 WHEN 'venerdi' THEN 5 WHEN 'sabato' THEN 6
    WHEN 'domenica' THEN 7 ELSE NULL
  END;
  IF v_giorno_idx IS NULL OR v_corso.ora_inizio IS NULL THEN RETURN; END IF;

  v_data_inizio := CURRENT_DATE;
  v_data_fine := CASE
    WHEN CURRENT_DATE > make_date(EXTRACT(YEAR FROM CURRENT_DATE)::int, 6, 30)
      THEN make_date(EXTRACT(YEAR FROM CURRENT_DATE)::int + 1, 6, 30)
    ELSE make_date(EXTRACT(YEAR FROM CURRENT_DATE)::int, 6, 30)
  END;

  v_cur := v_data_inizio + ((v_giorno_idx - EXTRACT(ISODOW FROM v_data_inizio)::int + 7) % 7);
  WHILE v_cur <= v_data_fine LOOP
    INSERT INTO public.eventi_calendario (atleta_id, club_id, tipo, riferimento_id, data, ora_inizio, ora_fine, nome_evento, stato)
    VALUES (p_atleta_id, v_club_id, 'corso', p_corso_id, v_cur, v_corso.ora_inizio, v_corso.ora_fine, v_corso.nome, 'confermato')
    ON CONFLICT (atleta_id, tipo, riferimento_id, data, ora_inizio) DO NOTHING;
    v_cur := v_cur + INTERVAL '7 days';
  END LOOP;
END $$;

CREATE OR REPLACE FUNCTION public.cancel_corso_atleta(p_corso_id uuid, p_atleta_id uuid) RETURNS void LANGUAGE sql SECURITY DEFINER SET search_path TO 'public' AS $$
  UPDATE public.eventi_calendario SET stato = 'annullato', updated_at = now()
  WHERE riferimento_id = p_corso_id AND atleta_id = p_atleta_id AND tipo = 'corso' AND data >= CURRENT_DATE AND stato <> 'annullato';
$$;

CREATE OR REPLACE FUNCTION public.trg_iscrizione_corso_to_eventi() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
BEGIN
  IF (TG_OP = 'INSERT' AND COALESCE(NEW.attiva, true) = true) THEN
    PERFORM public.spawn_corso_atleta(NEW.corso_id, NEW.atleta_id);
  ELSIF (TG_OP = 'UPDATE' AND COALESCE(NEW.attiva, true) = true AND COALESCE(OLD.attiva, true) = false) THEN
    PERFORM public.spawn_corso_atleta(NEW.corso_id, NEW.atleta_id);
  ELSIF (TG_OP = 'UPDATE' AND COALESCE(NEW.attiva, true) = false AND COALESCE(OLD.attiva, true) = true) THEN
    PERFORM public.cancel_corso_atleta(NEW.corso_id, NEW.atleta_id);
  ELSIF (TG_OP = 'DELETE') THEN
    PERFORM public.cancel_corso_atleta(OLD.corso_id, OLD.atleta_id);
  END IF;
  RETURN COALESCE(NEW, OLD);
END $$;

DROP TRIGGER IF EXISTS iscrizione_corso_eventi ON public.iscrizioni_corsi;
CREATE TRIGGER iscrizione_corso_eventi AFTER INSERT OR UPDATE OR DELETE ON public.iscrizioni_corsi
  FOR EACH ROW EXECUTE FUNCTION public.trg_iscrizione_corso_to_eventi();

-- PARTE 4: backfill
DO $$ DECLARE r record; BEGIN
  FOR r IN SELECT corso_id, atleta_id FROM public.iscrizioni_corsi WHERE COALESCE(attiva, true) = true LOOP
    PERFORM public.spawn_corso_atleta(r.corso_id, r.atleta_id);
  END LOOP;
END $$;
