
UPDATE public.test_livello_atleti
SET
  livello_target = CASE livello_accesso
    WHEN 'Pulcini'      THEN 'Stellina 1'
    WHEN 'Stellina 1'   THEN 'Stellina 2'
    WHEN 'Stellina 2'   THEN 'Stellina 3'
    WHEN 'Stellina 3'   THEN 'Stellina 4'
    WHEN 'Stellina 4'   THEN 'Interbronzo'
    WHEN 'Interbronzo'  THEN 'Bronzo'
    WHEN 'Bronzo'       THEN 'Interargento'
    WHEN 'Interargento' THEN 'Argento'
    WHEN 'Argento'      THEN 'Interoro'
    WHEN 'Interoro'     THEN 'Oro'
    ELSE livello_target
  END,
  disciplina = CASE
    WHEN livello_accesso IN ('Pulcini','Stellina 1','Stellina 2','Stellina 3')
      THEN NULL
    WHEN livello_accesso = 'Stellina 4'
      THEN COALESCE(NULLIF(disciplina, ''), 'artistica')
    WHEN livello_accesso IN ('Interbronzo','Bronzo','Interargento','Argento','Interoro')
      THEN COALESCE(NULLIF(disciplina, ''), 'artistica')
    ELSE NULLIF(disciplina, '')
  END
WHERE livello_target IS NULL OR livello_target = '';
