
ALTER TABLE public.fatture
  ADD COLUMN IF NOT EXISTS numero text,
  ADD COLUMN IF NOT EXISTS data_emissione date DEFAULT CURRENT_DATE,
  ADD COLUMN IF NOT EXISTS data_pagamento date,
  ADD COLUMN IF NOT EXISTS tipo text DEFAULT 'Generica',
  ADD COLUMN IF NOT EXISTS riferimento_id uuid,
  ADD COLUMN IF NOT EXISTS stato text GENERATED ALWAYS AS (CASE WHEN pagata THEN 'pagata' ELSE 'da_pagare' END) STORED,
  ADD COLUMN IF NOT EXISTS note text DEFAULT '',
  ADD COLUMN IF NOT EXISTS email_inviata_at timestamptz,
  ADD COLUMN IF NOT EXISTS periodo text;

ALTER TABLE public.setup_club
  ADD COLUMN IF NOT EXISTS fatturazione_giorno_mese integer DEFAULT 1 CHECK (fatturazione_giorno_mese BETWEEN 1 AND 28),
  ADD COLUMN IF NOT EXISTS fatturazione_invio_email_auto boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS fatturazione_costo_test numeric DEFAULT 0;
