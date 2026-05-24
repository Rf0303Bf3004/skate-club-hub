
ALTER TABLE public.clubs
  ADD COLUMN IF NOT EXISTS prezzo_per_atleta_chf numeric(6,2) NOT NULL DEFAULT 5.00;

CREATE TABLE IF NOT EXISTS public.fatture_clubs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  club_id uuid NOT NULL REFERENCES public.clubs(id) ON DELETE CASCADE,
  periodo text NOT NULL,
  n_atleti integer NOT NULL,
  prezzo_per_atleta_chf numeric(6,2) NOT NULL,
  importo_chf numeric(10,2) NOT NULL,
  data_emissione date NOT NULL DEFAULT CURRENT_DATE,
  data_scadenza date NOT NULL,
  pagata boolean NOT NULL DEFAULT false,
  data_pagamento date NULL,
  note text NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT fatture_clubs_periodo_chk CHECK (periodo ~ '^[0-9]{4}-(0[1-9]|1[0-2])$'),
  CONSTRAINT fatture_clubs_unique UNIQUE (club_id, periodo)
);

CREATE INDEX IF NOT EXISTS idx_fatture_clubs_club ON public.fatture_clubs(club_id);
CREATE INDEX IF NOT EXISTS idx_fatture_clubs_periodo ON public.fatture_clubs(periodo);

ALTER TABLE public.fatture_clubs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "fatture_clubs_superadmin_all" ON public.fatture_clubs;
CREATE POLICY "fatture_clubs_superadmin_all"
  ON public.fatture_clubs
  FOR ALL
  TO authenticated
  USING (public.user_has_ruolo('superadmin'))
  WITH CHECK (public.user_has_ruolo('superadmin'));
