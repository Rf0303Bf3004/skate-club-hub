ALTER TABLE public.griglia_blocchi
  ADD COLUMN IF NOT EXISTS risorsa_id uuid REFERENCES public.risorse_strutture(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_griglia_blocchi_risorsa ON public.griglia_blocchi(risorsa_id);

UPDATE public.griglia_blocchi b
SET risorsa_id = sub.id
FROM (
  SELECT DISTINCT ON (r.club_id) r.club_id, r.id
  FROM public.risorse_strutture r
  WHERE r.tipo = 'ghiaccio' AND r.attiva = true
  ORDER BY r.club_id, r.ordine ASC, r.created_at ASC
) sub
WHERE b.risorsa_id IS NULL AND b.club_id = sub.club_id;