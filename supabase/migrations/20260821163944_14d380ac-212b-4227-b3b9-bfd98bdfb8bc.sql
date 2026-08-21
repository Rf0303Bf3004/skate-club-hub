ALTER TABLE public.setup_club
  ADD COLUMN IF NOT EXISTS fattura_mostra_logo boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS fattura_colore_accento text,
  ADD COLUMN IF NOT EXISTS fattura_mostra_iban boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS fattura_note_legali text,
  ADD COLUMN IF NOT EXISTS fattura_footer_testo text,
  ADD COLUMN IF NOT EXISTS fattura_prefisso_numero text NOT NULL DEFAULT 'F-';