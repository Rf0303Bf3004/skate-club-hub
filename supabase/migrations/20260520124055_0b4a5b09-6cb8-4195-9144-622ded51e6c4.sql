-- F5a — Comunicazioni 2.0: categoria, lettura, archiviazione
ALTER TABLE public.comunicazioni
  ADD COLUMN IF NOT EXISTS categoria text NOT NULL DEFAULT 'inviata',
  ADD COLUMN IF NOT EXISTS letta boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS archiviata boolean NOT NULL DEFAULT false;

-- Vincolo categoria
ALTER TABLE public.comunicazioni
  DROP CONSTRAINT IF EXISTS comunicazioni_categoria_check;
ALTER TABLE public.comunicazioni
  ADD CONSTRAINT comunicazioni_categoria_check
  CHECK (categoria IN ('inviata','ricevuta'));

-- Backfill categoria in base al prefisso del titolo
UPDATE public.comunicazioni
SET categoria = 'ricevuta'
WHERE categoria = 'inviata'
  AND (
    titolo LIKE '❌ Rifiuto%' OR
    titolo LIKE '↩️ Annullamento%' OR
    titolo LIKE '✋ Richiesta%' OR
    titolo LIKE '🔔%' OR
    titolo LIKE 'Iscrizione:%' OR
    tipo = 'iscrizione_atleta'
  );

-- Inviate sono di default "lette" (non servono notifiche)
UPDATE public.comunicazioni SET letta = true WHERE categoria = 'inviata';

-- Auto-archivia tutto ciò che ha più di 90 giorni
UPDATE public.comunicazioni
SET archiviata = true
WHERE archiviata = false
  AND created_at < now() - INTERVAL '90 days';

-- Indici di supporto
CREATE INDEX IF NOT EXISTS idx_comunicazioni_cat_arch
  ON public.comunicazioni (club_id, categoria, archiviata, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_comunicazioni_letta
  ON public.comunicazioni (club_id, categoria, letta)
  WHERE categoria = 'ricevuta';

-- Funzione che archivia messaggi vecchi: usata sia manualmente sia dal cron
CREATE OR REPLACE FUNCTION public.archivia_comunicazioni_vecchie()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE n integer;
BEGIN
  UPDATE public.comunicazioni
  SET archiviata = true
  WHERE archiviata = false
    AND created_at < now() - INTERVAL '90 days';
  GET DIAGNOSTICS n = ROW_COUNT;
  RETURN n;
END $$;

-- pg_cron job notturno (3:15 UTC) - solo SQL, niente HTTP
CREATE EXTENSION IF NOT EXISTS pg_cron;

DO $$
BEGIN
  PERFORM cron.unschedule('archivia-comunicazioni-90gg');
EXCEPTION WHEN OTHERS THEN
  NULL;
END $$;

SELECT cron.schedule(
  'archivia-comunicazioni-90gg',
  '15 3 * * *',
  $$ SELECT public.archivia_comunicazioni_vecchie(); $$
);