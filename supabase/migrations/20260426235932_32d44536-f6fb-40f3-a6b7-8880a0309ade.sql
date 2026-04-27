
-- ===== PARTE 1: refactor schema test_livello / test_livello_atleti =====

-- 1) test_livello: nuove colonne
ALTER TABLE public.test_livello
  ADD COLUMN IF NOT EXISTS gara_id uuid NULL,
  ADD COLUMN IF NOT EXISTS club_ospitante text NULL,
  ADD COLUMN IF NOT EXISTS costo_iscrizione numeric NULL;

-- vincolo enum 'base' | 'in_gara' (oltre ai legacy 'artistica'/'stile'/'base' del vecchio modello)
-- Normalizziamo i tipi esistenti: artistica/stile diventano 'base' o 'in_gara' a seconda della presenza di gara_id.
-- Per ora: tutto ciò che non è già 'in_gara' o 'base' diventa 'base' (test interni).
UPDATE public.test_livello
   SET tipo = 'base'
 WHERE tipo IS NULL OR tipo NOT IN ('base','in_gara');

-- aggiungiamo CHECK constraint sul nuovo dominio
DO $$ BEGIN
  ALTER TABLE public.test_livello
    ADD CONSTRAINT test_livello_tipo_check CHECK (tipo IN ('base','in_gara'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- gara_id deve essere valorizzato sse tipo='in_gara'
DO $$ BEGIN
  ALTER TABLE public.test_livello
    ADD CONSTRAINT test_livello_gara_coherence CHECK (
      (tipo = 'in_gara' AND gara_id IS NOT NULL)
      OR (tipo = 'base' AND gara_id IS NULL)
    );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Le colonne livello_accesso / livello_attuale restano ma sono DEPRECATED (il livello è per atleta).
COMMENT ON COLUMN public.test_livello.livello_accesso IS 'DEPRECATED: il livello è ora per convocazione (test_livello_atleti.livello_accesso).';
COMMENT ON COLUMN public.test_livello.livello_attuale IS 'DEPRECATED: il livello è ora per convocazione (test_livello_atleti.livello_target).';

-- 2) test_livello_atleti: nuove colonne (NULL temporanei per migrazione)
ALTER TABLE public.test_livello_atleti
  ADD COLUMN IF NOT EXISTS ordine integer NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS livello_accesso text NULL,
  ADD COLUMN IF NOT EXISTS livello_target text NULL,
  ADD COLUMN IF NOT EXISTS disciplina text NULL;

-- vincolo esito: 4 valori
DO $$ BEGIN
  ALTER TABLE public.test_livello_atleti
    ADD CONSTRAINT test_livello_atleti_esito_check
    CHECK (esito IN ('in_attesa','superato','non_superato','non_sostenuto'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- vincolo disciplina
DO $$ BEGIN
  ALTER TABLE public.test_livello_atleti
    ADD CONSTRAINT test_livello_atleti_disciplina_check
    CHECK (disciplina IS NULL OR disciplina IN ('artistica','stile'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- 3) Migrazione record esistenti: deriva livello_accesso/target dal livello attuale dell'atleta
--    Regole:
--      pulcini                 → Pulcini    → Stellina 1
--      amatori (Stellina N<4)  → Stellina N → Stellina N+1
--      amatori (Stellina 4)    → Stellina 4 → Interbronzo (disciplina null, sceglierà manualmente)
--      artistica               → livello_artistica → next carriera (disciplina='artistica')
WITH atl AS (
  SELECT a.id,
         a.categoria,
         a.livello_amatori,
         a.livello_artistica,
         a.livello_stile,
         CASE
           WHEN a.categoria = 'pulcini' THEN 'Pulcini'
           WHEN a.categoria = 'amatori' THEN COALESCE(a.livello_amatori, 'Stellina 1')
           WHEN a.categoria = 'artistica' THEN COALESCE(a.livello_artistica, a.livello_stile, a.livello_amatori, 'Interbronzo')
           ELSE 'Pulcini'
         END AS lv_acc
  FROM public.atleti a
)
UPDATE public.test_livello_atleti tla
   SET livello_accesso = COALESCE(tla.livello_accesso, atl.lv_acc),
       livello_target  = COALESCE(tla.livello_target,
         CASE atl.lv_acc
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
           ELSE 'Stellina 1'
         END),
       ordine = COALESCE(tla.ordine, 1)
  FROM atl
 WHERE atl.id = tla.atleta_id;

-- Dopo il backfill rendiamo NOT NULL livello_accesso e livello_target
ALTER TABLE public.test_livello_atleti
  ALTER COLUMN livello_accesso SET NOT NULL,
  ALTER COLUMN livello_target SET NOT NULL;

-- Indici utili
CREATE INDEX IF NOT EXISTS idx_tla_test_atleta_ordine
  ON public.test_livello_atleti (test_id, atleta_id, ordine);
