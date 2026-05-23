
-- 1) Nuova funzione codice atleta: AT-XXXX-XXXX
CREATE OR REPLACE FUNCTION public.genera_codice_atleta()
RETURNS text
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_alphabet text := 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'; -- 31 chars, no I,O,L,0,1
  v_alen int := length(v_alphabet);
  v_code text;
  v_attempts int := 0;
  v_exists boolean;
  i int;
BEGIN
  LOOP
    v_code := 'AT-';
    FOR i IN 1..4 LOOP
      v_code := v_code || substr(v_alphabet, 1 + floor(random() * v_alen)::int, 1);
    END LOOP;
    v_code := v_code || '-';
    FOR i IN 1..4 LOOP
      v_code := v_code || substr(v_alphabet, 1 + floor(random() * v_alen)::int, 1);
    END LOOP;
    SELECT EXISTS(SELECT 1 FROM public.atleti WHERE codice_atleta = v_code) INTO v_exists;
    EXIT WHEN NOT v_exists;
    v_attempts := v_attempts + 1;
    IF v_attempts > 25 THEN
      RAISE EXCEPTION 'genera_codice_atleta: impossibile generare codice univoco dopo 25 tentativi';
    END IF;
  END LOOP;
  RETURN v_code;
END;
$$;

-- 2) Backfill su atleti privi di codice o con codice in vecchio formato
DO $$
DECLARE r record;
BEGIN
  FOR r IN
    SELECT id FROM public.atleti
    WHERE codice_atleta IS NULL
       OR codice_atleta = ''
       OR codice_atleta !~ '^AT-[A-Z2-9]{4}-[A-Z2-9]{4}$'
  LOOP
    UPDATE public.atleti
      SET codice_atleta = public.genera_codice_atleta()
      WHERE id = r.id;
  END LOOP;
END $$;

-- 3) Indice unico (consente NULL futuri ma in pratica trigger lo riempie sempre)
CREATE UNIQUE INDEX IF NOT EXISTS atleti_codice_atleta_unique
  ON public.atleti (codice_atleta)
  WHERE codice_atleta IS NOT NULL;

-- 4) Trigger BEFORE INSERT: auto-assegna codice se mancante
CREATE OR REPLACE FUNCTION public.set_atleta_codice_atleta()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.codice_atleta IS NULL OR NEW.codice_atleta = '' THEN
    NEW.codice_atleta := public.genera_codice_atleta();
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_atleti_set_codice_atleta ON public.atleti;
CREATE TRIGGER trg_atleti_set_codice_atleta
BEFORE INSERT ON public.atleti
FOR EACH ROW
EXECUTE FUNCTION public.set_atleta_codice_atleta();

-- 5) Drop tabella inviti_genitori (deprecata, solo dati di test)
DROP TABLE IF EXISTS public.inviti_genitori CASCADE;
