-- Refactor modello dati livelli atleti
ALTER TABLE public.atleti
  ADD COLUMN IF NOT EXISTS categoria text NOT NULL DEFAULT 'pulcini',
  ADD COLUMN IF NOT EXISTS livello_amatori text,
  ADD COLUMN IF NOT EXISTS livello_artistica text,
  ADD COLUMN IF NOT EXISTS livello_artistica_in_preparazione text,
  ADD COLUMN IF NOT EXISTS livello_stile text,
  ADD COLUMN IF NOT EXISTS livello_stile_in_preparazione text;

-- Vincoli di dominio (validati via CHECK statici, immutabili)
ALTER TABLE public.atleti
  DROP CONSTRAINT IF EXISTS atleti_categoria_check;
ALTER TABLE public.atleti
  ADD CONSTRAINT atleti_categoria_check
  CHECK (categoria IN ('pulcini','amatori','artistica'));

ALTER TABLE public.atleti
  DROP CONSTRAINT IF EXISTS atleti_livello_amatori_check;
ALTER TABLE public.atleti
  ADD CONSTRAINT atleti_livello_amatori_check
  CHECK (livello_amatori IS NULL OR livello_amatori IN ('Stellina 1','Stellina 2','Stellina 3','Stellina 4'));

ALTER TABLE public.atleti
  DROP CONSTRAINT IF EXISTS atleti_livello_artistica_check;
ALTER TABLE public.atleti
  ADD CONSTRAINT atleti_livello_artistica_check
  CHECK (livello_artistica IS NULL OR livello_artistica IN ('Interbronzo','Bronzo','Interargento','Argento','Interoro','Oro'));

ALTER TABLE public.atleti
  DROP CONSTRAINT IF EXISTS atleti_livello_artistica_prep_check;
ALTER TABLE public.atleti
  ADD CONSTRAINT atleti_livello_artistica_prep_check
  CHECK (livello_artistica_in_preparazione IS NULL OR livello_artistica_in_preparazione IN ('Interbronzo','Bronzo','Interargento','Argento','Interoro','Oro'));

ALTER TABLE public.atleti
  DROP CONSTRAINT IF EXISTS atleti_livello_stile_check;
ALTER TABLE public.atleti
  ADD CONSTRAINT atleti_livello_stile_check
  CHECK (livello_stile IS NULL OR livello_stile IN ('Interbronzo','Bronzo','Interargento','Argento','Interoro','Oro'));

ALTER TABLE public.atleti
  DROP CONSTRAINT IF EXISTS atleti_livello_stile_prep_check;
ALTER TABLE public.atleti
  ADD CONSTRAINT atleti_livello_stile_prep_check
  CHECK (livello_stile_in_preparazione IS NULL OR livello_stile_in_preparazione IN ('Interbronzo','Bronzo','Interargento','Argento','Interoro','Oro'));

-- Marca le colonne legacy come deprecate
COMMENT ON COLUMN public.atleti.livello_attuale IS 'DEPRECATED: usare categoria + livello_amatori/livello_artistica/livello_stile. Mantenuto come fallback testuale per backward compat.';
COMMENT ON COLUMN public.atleti.carriera_artistica IS 'DEPRECATED: usare livello_artistica. Mantenuto per backward compat.';
COMMENT ON COLUMN public.atleti.carriera_stile IS 'DEPRECATED: usare livello_stile. Mantenuto per backward compat.';