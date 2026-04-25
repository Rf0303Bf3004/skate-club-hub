ALTER TABLE public.gare_calendario
  ADD COLUMN IF NOT EXISTS ora time without time zone,
  ADD COLUMN IF NOT EXISTS indirizzo text DEFAULT '',
  ADD COLUMN IF NOT EXISTS club_ospitante text DEFAULT '',
  ADD COLUMN IF NOT EXISTS carriera text DEFAULT 'Entrambe',
  ADD COLUMN IF NOT EXISTS costo_iscrizione numeric DEFAULT 0,
  ADD COLUMN IF NOT EXISTS costo_accompagnamento numeric DEFAULT 0,
  ADD COLUMN IF NOT EXISTS archiviata boolean DEFAULT false;