-- 1. ENUMs
DO $$ BEGIN
  CREATE TYPE public.livello_istruttore_enum AS ENUM ('istruttore', 'monitrice', 'aiuto_monitrice');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.stato_staff_enum AS ENUM ('attivo', 'sospeso');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- 2. ISTRUTTORI: nuove colonne
ALTER TABLE public.istruttori
  ADD COLUMN IF NOT EXISTS livello_istruttore public.livello_istruttore_enum NOT NULL DEFAULT 'istruttore',
  ADD COLUMN IF NOT EXISTS linked_atleta_id uuid REFERENCES public.atleti(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS stato_staff public.stato_staff_enum NOT NULL DEFAULT 'attivo';

CREATE INDEX IF NOT EXISTS idx_istruttori_linked_atleta_id
  ON public.istruttori(linked_atleta_id) WHERE linked_atleta_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS uq_istruttori_linked_atleta_id
  ON public.istruttori(linked_atleta_id) WHERE linked_atleta_id IS NOT NULL;

-- 3. ATLETI: nuovi flag mutuamente esclusivi
ALTER TABLE public.atleti
  ADD COLUMN IF NOT EXISTS e_aiuto_monitrice boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS e_monitrice boolean NOT NULL DEFAULT false;

ALTER TABLE public.atleti
  DROP CONSTRAINT IF EXISTS chk_atleti_ruolo_pista_excl;
ALTER TABLE public.atleti
  ADD CONSTRAINT chk_atleti_ruolo_pista_excl
  CHECK (NOT (e_aiuto_monitrice = true AND e_monitrice = true));

-- 4. Trigger BEFORE INSERT/UPDATE: validazione età >= 12
CREATE OR REPLACE FUNCTION public.atleti_valida_eta_monitrice()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_eta integer;
BEGIN
  IF (NEW.e_aiuto_monitrice = true OR NEW.e_monitrice = true) THEN
    IF NEW.data_nascita IS NULL THEN
      RAISE EXCEPTION 'Data di nascita mancante: impossibile assegnare ruolo di monitrice/aiuto-monitrice';
    END IF;
    v_eta := EXTRACT(YEAR FROM AGE(NEW.data_nascita))::int;
    IF v_eta < 12 THEN
      RAISE EXCEPTION 'L''atleta deve avere almeno 12 anni per essere monitrice o aiuto-monitrice. Età attuale: %', v_eta;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_atleti_valida_eta_monitrice ON public.atleti;
CREATE TRIGGER trg_atleti_valida_eta_monitrice
  BEFORE INSERT OR UPDATE OF e_aiuto_monitrice, e_monitrice, data_nascita ON public.atleti
  FOR EACH ROW
  EXECUTE FUNCTION public.atleti_valida_eta_monitrice();

-- 5. Funzione di sync atleta -> istruttori
CREATE OR REPLACE FUNCTION public.sync_atleta_to_staff(p_atleta_id uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_atleta atleti%ROWTYPE;
  v_istr_id uuid;
  v_livello public.livello_istruttore_enum;
BEGIN
  SELECT * INTO v_atleta FROM public.atleti WHERE id = p_atleta_id;
  IF NOT FOUND THEN RETURN NULL; END IF;

  SELECT id INTO v_istr_id FROM public.istruttori WHERE linked_atleta_id = p_atleta_id LIMIT 1;

  IF v_atleta.e_monitrice = true THEN
    v_livello := 'monitrice';
  ELSIF v_atleta.e_aiuto_monitrice = true THEN
    v_livello := 'aiuto_monitrice';
  ELSE
    v_livello := NULL;
  END IF;

  IF v_livello IS NOT NULL THEN
    IF v_istr_id IS NULL THEN
      INSERT INTO public.istruttori (
        club_id, nome, cognome, email, telefono,
        livello_istruttore, linked_atleta_id, stato_staff,
        costo_minuto_lezione_privata, attivo
      ) VALUES (
        v_atleta.club_id,
        v_atleta.nome,
        v_atleta.cognome,
        COALESCE(v_atleta.genitore1_email, ''),
        COALESCE(v_atleta.telefono, ''),
        v_livello, p_atleta_id, 'attivo',
        0, true
      )
      RETURNING id INTO v_istr_id;
    ELSE
      UPDATE public.istruttori
        SET livello_istruttore = v_livello,
            stato_staff = 'attivo'
      WHERE id = v_istr_id;
    END IF;
  ELSE
    IF v_istr_id IS NOT NULL THEN
      UPDATE public.istruttori SET stato_staff = 'sospeso' WHERE id = v_istr_id;
    END IF;
  END IF;

  RETURN v_istr_id;
END;
$$;

-- 6. Trigger AFTER INSERT/UPDATE: sync quando i flag cambiano
CREATE OR REPLACE FUNCTION public.atleti_sync_staff_trigger()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NEW.e_aiuto_monitrice = true OR NEW.e_monitrice = true THEN
      PERFORM public.sync_atleta_to_staff(NEW.id);
    END IF;
  ELSIF TG_OP = 'UPDATE' THEN
    IF (NEW.e_aiuto_monitrice IS DISTINCT FROM OLD.e_aiuto_monitrice)
       OR (NEW.e_monitrice IS DISTINCT FROM OLD.e_monitrice) THEN
      PERFORM public.sync_atleta_to_staff(NEW.id);
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_atleti_sync_staff ON public.atleti;
CREATE TRIGGER trg_atleti_sync_staff
  AFTER INSERT OR UPDATE OF e_aiuto_monitrice, e_monitrice ON public.atleti
  FOR EACH ROW
  EXECUTE FUNCTION public.atleti_sync_staff_trigger();