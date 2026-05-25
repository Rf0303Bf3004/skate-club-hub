
-- Drop old legacy livelli table (smallint id) and consolidate on livelli_catalogo → livelli
ALTER TABLE public.corsi DROP CONSTRAINT IF EXISTS corsi_livello_richiesto_fkey;
DROP TABLE IF EXISTS public.livelli CASCADE;

-- Rename livelli_catalogo → livelli; rename categoria → fase
ALTER TABLE public.livelli_catalogo RENAME TO livelli;
ALTER TABLE public.livelli RENAME COLUMN categoria TO fase;

-- Ensure paese column + indexes/unique
ALTER TABLE public.livelli ALTER COLUMN paese SET DEFAULT 'CH';
ALTER TABLE public.livelli ALTER COLUMN paese SET NOT NULL;
CREATE INDEX IF NOT EXISTS idx_livelli_paese_fase ON public.livelli (paese, fase, ordine);
ALTER TABLE public.livelli DROP CONSTRAINT IF EXISTS livelli_paese_fase_nome_unique;
ALTER TABLE public.livelli ADD CONSTRAINT livelli_paese_fase_nome_unique UNIQUE (paese, fase, nome);

-- Idempotent seed CH (no-op if already present)
INSERT INTO public.livelli (paese, fase, nome, ordine, attivo) VALUES
 ('CH','pulcini','Pulcini',1,true),
 ('CH','amatori','Stellina 1',1,true),
 ('CH','amatori','Stellina 2',2,true),
 ('CH','amatori','Stellina 3',3,true),
 ('CH','artistica','Stellina 4',1,true),
 ('CH','artistica','Interbronzo',2,true),
 ('CH','artistica','Bronzo',3,true),
 ('CH','artistica','Interargento',4,true),
 ('CH','artistica','Argento',5,true),
 ('CH','artistica','Interoro',6,true),
 ('CH','artistica','Oro',7,true)
ON CONFLICT (paese, fase, nome) DO NOTHING;
