ALTER TABLE public.disponibilita_ghiaccio
  ADD COLUMN IF NOT EXISTS risorsa_id uuid REFERENCES public.risorse_strutture(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS idx_disponibilita_ghiaccio_risorsa ON public.disponibilita_ghiaccio(risorsa_id);

WITH prima_risorsa AS (
  SELECT DISTINCT ON (club_id) club_id, id
  FROM public.risorse_strutture
  WHERE tipo = 'ghiaccio'
  ORDER BY club_id, ordine NULLS LAST, created_at
)
UPDATE public.disponibilita_ghiaccio d
SET risorsa_id = p.id
FROM prima_risorsa p
WHERE d.club_id = p.club_id AND d.risorsa_id IS NULL;