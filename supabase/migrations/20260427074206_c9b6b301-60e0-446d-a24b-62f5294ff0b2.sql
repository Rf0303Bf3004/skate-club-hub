DO $$
DECLARE
  v_sql text;
  v_pairs text[][] := ARRAY[
    -- table, constraint, column, ref_table, ref_col, on_delete
    ['iscrizioni_gare','iscrizioni_gare_gara_id_fkey','gara_id','gare_calendario','id','CASCADE'],
    ['iscrizioni_gare','iscrizioni_gare_atleta_id_fkey','atleta_id','atleti','id','CASCADE'],
    ['risultati_gara','risultati_gara_gara_id_fkey','gara_id','gare_calendario','id','CASCADE'],
    ['risultati_gara','risultati_gara_atleta_id_fkey','atleta_id','atleti','id','SET NULL'],
    ['elementi_gara','elementi_gara_risultato_id_fkey','risultato_id','risultati_gara','id','CASCADE'],
    ['gare_calendario','gare_calendario_club_id_fkey','club_id','clubs','id','CASCADE'],
    ['gare_calendario','gare_calendario_stagione_id_fkey','stagione_id','stagioni','id','SET NULL'],
    ['atleti','atleti_club_id_fkey','club_id','clubs','id','CASCADE'],
    ['iscrizioni_corsi','iscrizioni_corsi_atleta_id_fkey','atleta_id','atleti','id','CASCADE'],
    ['iscrizioni_corsi','iscrizioni_corsi_corso_id_fkey','corso_id','corsi','id','CASCADE'],
    ['corsi','corsi_club_id_fkey','club_id','clubs','id','CASCADE'],
    ['corsi','corsi_stagione_id_fkey','stagione_id','stagioni','id','SET NULL'],
    ['corsi_istruttori','corsi_istruttori_corso_id_fkey','corso_id','corsi','id','CASCADE'],
    ['corsi_istruttori','corsi_istruttori_istruttore_id_fkey','istruttore_id','istruttori','id','CASCADE'],
    ['istruttori','istruttori_club_id_fkey','club_id','clubs','id','CASCADE'],
    ['adesioni_atleta','adesioni_atleta_atleta_id_fkey','atleta_id','atleti','id','CASCADE'],
    ['adesioni_atleta','adesioni_atleta_club_id_fkey','club_id','clubs','id','CASCADE'],
    ['adesioni_atleta','adesioni_atleta_stagione_id_fkey','stagione_id','stagioni','id','SET NULL'],
    ['fatture','fatture_club_id_fkey','club_id','clubs','id','CASCADE'],
    ['fatture','fatture_atleta_id_fkey','atleta_id','atleti','id','SET NULL'],
    ['test_livello','test_livello_club_id_fkey','club_id','clubs','id','CASCADE'],
    ['test_livello','test_livello_stagione_id_fkey','stagione_id','stagioni','id','SET NULL'],
    ['test_livello','test_livello_gara_id_fkey','gara_id','gare_calendario','id','SET NULL'],
    ['test_livello_atleti','test_livello_atleti_test_id_fkey','test_id','test_livello','id','CASCADE'],
    ['test_livello_atleti','test_livello_atleti_atleta_id_fkey','atleta_id','atleti','id','CASCADE'],
    ['comunicazioni','comunicazioni_club_id_fkey','club_id','clubs','id','CASCADE'],
    ['comunicazioni','comunicazioni_atleta_id_fkey','atleta_id','atleti','id','SET NULL'],
    ['comunicazioni','comunicazioni_corso_id_fkey','corso_id','corsi','id','SET NULL'],
    ['comunicazioni_destinatari','comunicazioni_destinatari_comunicazione_id_fkey','comunicazione_id','comunicazioni','id','CASCADE'],
    ['comunicazioni_destinatari','comunicazioni_destinatari_atleta_id_fkey','atleta_id','atleti','id','CASCADE'],
    ['lezioni_private','lezioni_private_club_id_fkey','club_id','clubs','id','CASCADE'],
    ['lezioni_private','lezioni_private_istruttore_id_fkey','istruttore_id','istruttori','id','SET NULL'],
    ['lezioni_private_atlete','lezioni_private_atlete_lezione_id_fkey','lezione_id','lezioni_private','id','CASCADE'],
    ['lezioni_private_atlete','lezioni_private_atlete_atleta_id_fkey','atleta_id','atleti','id','CASCADE'],
    ['iscrizioni_eventi_esterni','iscrizioni_eventi_esterni_atleta_id_fkey','atleta_id','atleti','id','CASCADE'],
    ['iscrizioni_eventi_esterni','iscrizioni_eventi_esterni_evento_esterno_id_fkey','evento_esterno_id','eventi_esterni','id','CASCADE'],
    ['storico_livelli_atleta','storico_livelli_atleta_atleta_id_fkey','atleta_id','atleti','id','CASCADE']
  ];
  i int;
  t text; cn text; col text; rt text; rc text; od text;
  is_nullable boolean;
BEGIN
  FOR i IN 1 .. array_upper(v_pairs, 1) LOOP
    t := v_pairs[i][1]; cn := v_pairs[i][2]; col := v_pairs[i][3];
    rt := v_pairs[i][4]; rc := v_pairs[i][5]; od := v_pairs[i][6];

    -- Skip se già presente
    IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = cn AND connamespace = 'public'::regnamespace) THEN
      RAISE NOTICE 'SKIP % già presente', cn;
      CONTINUE;
    END IF;

    -- Determina se la colonna è nullable
    SELECT (a.attnotnull = false) INTO is_nullable
    FROM pg_attribute a
    WHERE a.attrelid = ('public.'||t)::regclass AND a.attname = col AND a.attnum > 0;

    -- Pulizia orfani
    IF is_nullable AND od = 'SET NULL' THEN
      v_sql := format('UPDATE public.%I SET %I = NULL WHERE %I IS NOT NULL AND %I NOT IN (SELECT id FROM public.%I)',
                       t, col, col, col, rt);
    ELSE
      v_sql := format('DELETE FROM public.%I WHERE %I IS NOT NULL AND %I NOT IN (SELECT id FROM public.%I)',
                       t, col, col, rt);
    END IF;
    EXECUTE v_sql;

    -- Aggiungi FK
    v_sql := format('ALTER TABLE public.%I ADD CONSTRAINT %I FOREIGN KEY (%I) REFERENCES public.%I(%I) ON DELETE %s',
                     t, cn, col, rt, rc, od);
    EXECUTE v_sql;
    RAISE NOTICE 'ADDED %', cn;
  END LOOP;
END $$;

NOTIFY pgrst, 'reload schema';