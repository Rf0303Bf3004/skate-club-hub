CREATE OR REPLACE FUNCTION public.is_mobile_parent()
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$ SELECT COALESCE((auth.jwt() -> 'app_metadata' ->> 'role') = 'mobile_parent', false); $function$;

CREATE OR REPLACE FUNCTION public.atleti_mobile_parent_column_guard()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  allowed text[] := ARRAY[
    'telefono','indirizzo','cap','citta','cantone','paese_iso','regione','provincia','foto_url',
    'genitore1_nome','genitore1_cognome','genitore1_telefono','genitore1_email','genitore1_indirizzo',
    'genitore1_cap','genitore1_citta','genitore1_cantone','genitore1_paese_iso','genitore1_regione','genitore1_provincia',
    'genitore2_nome','genitore2_cognome','genitore2_telefono','genitore2_email','genitore2_indirizzo',
    'genitore2_cap','genitore2_citta','genitore2_cantone','genitore2_paese_iso','genitore2_regione','genitore2_provincia',
    'consenso_foto_video','consenso_privacy','consenso_dati_medici','note_genitori','updated_at'
  ];
  col text;
  old_json jsonb := to_jsonb(OLD);
  new_json jsonb := to_jsonb(NEW);
BEGIN
  -- Applica la guardia SOLO alle sessioni genitore mobile reali.
  IF COALESCE(public.is_mobile_parent(), false) IS NOT TRUE THEN
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
$function$;