ALTER TABLE public.stagioni ADD COLUMN IF NOT EXISTS stato text DEFAULT 'attiva';
ALTER TABLE public.planning_settimane ADD COLUMN IF NOT EXISTS archiviato boolean DEFAULT false;