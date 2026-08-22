-- 1) Riporta gli atleti dei duplicati sulla riga "vincente" (la più vecchia)
WITH ranked AS (
  SELECT id,
         first_value(id) OVER (
           PARTITION BY sessione_id, gruppo_livello, gruppo_scope,
                        coalesce(gruppo_ragione_sociale_id, '00000000-0000-0000-0000-000000000000'::uuid)
           ORDER BY created_at NULLS LAST, id
         ) AS keep_id
  FROM public.griglia_sessioni_gruppi
)
UPDATE public.griglia_sessioni_atleti a
SET gruppo_sessione_id = r.keep_id
FROM ranked r
WHERE a.gruppo_sessione_id = r.id
  AND r.id <> r.keep_id
  AND NOT EXISTS (
    SELECT 1 FROM public.griglia_sessioni_atleti b
    WHERE b.sessione_id = a.sessione_id AND b.atleta_id = a.atleta_id AND b.id <> a.id
      AND b.gruppo_sessione_id = r.keep_id
  );

-- 2) Elimina le righe gruppo duplicate
WITH ranked AS (
  SELECT id,
         first_value(id) OVER (
           PARTITION BY sessione_id, gruppo_livello, gruppo_scope,
                        coalesce(gruppo_ragione_sociale_id, '00000000-0000-0000-0000-000000000000'::uuid)
           ORDER BY created_at NULLS LAST, id
         ) AS keep_id
  FROM public.griglia_sessioni_gruppi
)
DELETE FROM public.griglia_sessioni_gruppi g
USING ranked r
WHERE g.id = r.id AND r.id <> r.keep_id;

-- 3) Indice UNIQUE anti-duplicati
CREATE UNIQUE INDEX IF NOT EXISTS griglia_sessioni_gruppi_uniq
ON public.griglia_sessioni_gruppi (
  sessione_id, gruppo_livello, gruppo_scope,
  coalesce(gruppo_ragione_sociale_id, '00000000-0000-0000-0000-000000000000'::uuid)
);