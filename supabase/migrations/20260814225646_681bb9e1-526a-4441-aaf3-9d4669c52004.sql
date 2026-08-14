ALTER TABLE public.comunicazioni ADD COLUMN IF NOT EXISTS archiviata_at timestamptz;

CREATE INDEX IF NOT EXISTS idx_comunicazioni_club_archiviata_created
  ON public.comunicazioni (club_id, archiviata, created_at DESC);

CREATE OR REPLACE FUNCTION public.archivia_comunicazioni_vecchie()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE n integer;
BEGIN
  UPDATE public.comunicazioni
     SET archiviata = true,
         archiviata_at = now()
   WHERE COALESCE(archiviata, false) = false
     -- mai archiviare una comunicazione ricevuta e non ancora letta
     AND NOT (categoria = 'ricevuta' AND COALESCE(letta, false) = false)
     AND (
       (data_evento IS NOT NULL AND data_evento < CURRENT_DATE)
       OR (data_evento IS NULL AND COALESCE(inviata_at, created_at) < now() - INTERVAL '49 days')
     );
  GET DIAGNOSTICS n = ROW_COUNT;
  RETURN n;
END $function$;

GRANT EXECUTE ON FUNCTION public.archivia_comunicazioni_vecchie() TO authenticated;