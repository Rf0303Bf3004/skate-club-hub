CREATE OR REPLACE FUNCTION public.griglia_valida_disponibilita_istruttore()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_data date;
  v_inizio time;
  v_fine time;
  v_giorno text;
  v_forzata boolean;
  v_ok boolean;
BEGIN
  SELECT b.data, s.ora_inizio, s.ora_fine, COALESCE(s.fuori_disponibilita, false)
    INTO v_data, v_inizio, v_fine, v_forzata
  FROM public.griglia_sessioni s
  JOIN public.griglia_blocchi b ON b.id = s.blocco_id
  WHERE s.id = NEW.sessione_id;

  IF v_data IS NULL THEN
    RETURN NEW;
  END IF;

  IF v_forzata THEN
    RETURN NEW;
  END IF;

  v_giorno := (ARRAY['Domenica','Lunedì','Martedì','Mercoledì','Giovedì','Venerdì','Sabato'])[EXTRACT(DOW FROM v_data)::int + 1];

  SELECT EXISTS (
    SELECT 1
    FROM public.disponibilita_istruttori d
    WHERE d.istruttore_id = NEW.istruttore_id
      AND lower(translate(d.giorno, 'ìàèéù', 'iaeeu')) = lower(translate(v_giorno, 'ìàèéù', 'iaeeu'))
      AND d.ora_inizio <= v_inizio
      AND d.ora_fine >= v_fine
  ) INTO v_ok;

  IF NOT v_ok THEN
    RAISE EXCEPTION 'Istruttore fuori disponibilità: % %-% non rientra in nessuna fascia dichiarata.', v_giorno, to_char(v_inizio, 'HH24:MI'), to_char(v_fine, 'HH24:MI')
      USING ERRCODE = '23514';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_griglia_valida_disponibilita_istruttore ON public.griglia_sessioni_istruttori;
CREATE TRIGGER trg_griglia_valida_disponibilita_istruttore
BEFORE INSERT OR UPDATE ON public.griglia_sessioni_istruttori
FOR EACH ROW EXECUTE FUNCTION public.griglia_valida_disponibilita_istruttore();