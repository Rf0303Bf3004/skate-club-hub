CREATE OR REPLACE FUNCTION public.griglia_valida_disponibilita_ghiaccio()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_giorno text;
  v_tipo_risorsa text;
  v_ospite boolean;
  v_ok boolean;
  v_fasce int;
BEGIN
  -- Forzatura motivata: nessun blocco
  IF COALESCE(NEW.fuori_disponibilita, false) THEN
    RETURN NEW;
  END IF;

  -- Eventi dei campi: gestiti altrove
  IF NEW.evento_campo_id IS NOT NULL THEN
    RETURN NEW;
  END IF;

  IF NEW.risorsa_id IS NOT NULL THEN
    SELECT r.tipo, COALESCE(r.is_ospite, false) INTO v_tipo_risorsa, v_ospite
    FROM public.risorse_strutture r WHERE r.id = NEW.risorsa_id;
    -- Solo il ghiaccio ha fasce dichiarate; le trasferte non sono vincolate
    IF v_tipo_risorsa IS DISTINCT FROM 'ghiaccio' OR COALESCE(v_ospite, false) THEN
      RETURN NEW;
    END IF;
  END IF;

  v_giorno := (ARRAY['Domenica','Lunedì','Martedì','Mercoledì','Giovedì','Venerdì','Sabato'])[EXTRACT(DOW FROM NEW.data)::int + 1];

  SELECT count(*) INTO v_fasce
  FROM public.disponibilita_ghiaccio d
  WHERE d.club_id = NEW.club_id
    AND d.tipo = 'ghiaccio'
    AND lower(translate(d.giorno, 'ìàèéù', 'iaeeu')) = lower(translate(v_giorno, 'ìàèéù', 'iaeeu'))
    AND (d.risorsa_id IS NULL OR NEW.risorsa_id IS NULL OR d.risorsa_id = NEW.risorsa_id);

  IF v_fasce = 0 THEN
    RAISE EXCEPTION 'Nessuna disponibilità di ghiaccio dichiarata per % : indica un motivo per forzare il blocco.', v_giorno
      USING ERRCODE = '23514';
  END IF;

  SELECT EXISTS (
    SELECT 1
    FROM public.disponibilita_ghiaccio d
    WHERE d.club_id = NEW.club_id
      AND d.tipo = 'ghiaccio'
      AND lower(translate(d.giorno, 'ìàèéù', 'iaeeu')) = lower(translate(v_giorno, 'ìàèéù', 'iaeeu'))
      AND (d.risorsa_id IS NULL OR NEW.risorsa_id IS NULL OR d.risorsa_id = NEW.risorsa_id)
      AND d.ora_inizio <= NEW.ora_inizio
      AND d.ora_fine >= NEW.ora_fine
  ) INTO v_ok;

  IF NOT v_ok THEN
    RAISE EXCEPTION 'Orario % - % fuori dalle fasce di ghiaccio disponibili di %: indica un motivo per forzare il blocco.',
      to_char(NEW.ora_inizio, 'HH24:MI'), to_char(NEW.ora_fine, 'HH24:MI'), v_giorno
      USING ERRCODE = '23514';
  END IF;

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.griglia_valida_disponibilita_ghiaccio() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_griglia_valida_disponibilita_ghiaccio ON public.griglia_blocchi;
CREATE TRIGGER trg_griglia_valida_disponibilita_ghiaccio
BEFORE INSERT OR UPDATE OF data, ora_inizio, ora_fine, risorsa_id, fuori_disponibilita
ON public.griglia_blocchi
FOR EACH ROW
EXECUTE FUNCTION public.griglia_valida_disponibilita_ghiaccio();