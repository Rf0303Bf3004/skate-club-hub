ALTER TABLE public.risorse_strutture
  ADD COLUMN IF NOT EXISTS is_ospite boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS nome_struttura_ospitante text,
  ADD COLUMN IF NOT EXISTS indirizzo_ospitante text,
  ADD COLUMN IF NOT EXISTS evento_campo_id uuid REFERENCES public.eventi_campi(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_risorse_strutture_evento_campo ON public.risorse_strutture(evento_campo_id);