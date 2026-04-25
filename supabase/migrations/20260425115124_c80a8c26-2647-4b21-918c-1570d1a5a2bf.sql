-- Tabella utenti_club: collega auth.users a un club con un ruolo
CREATE TABLE IF NOT EXISTS public.utenti_club (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  club_id uuid NULL REFERENCES public.clubs(id) ON DELETE SET NULL,
  ruolo text NOT NULL DEFAULT 'staff' CHECK (ruolo IN ('superadmin','admin','staff')),
  nome text NOT NULL DEFAULT '',
  cognome text NOT NULL DEFAULT '',
  attivo boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.utenti_club ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own membership"
  ON public.utenti_club FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Authenticated can read all memberships"
  ON public.utenti_club FOR SELECT
  TO authenticated
  USING (true);
