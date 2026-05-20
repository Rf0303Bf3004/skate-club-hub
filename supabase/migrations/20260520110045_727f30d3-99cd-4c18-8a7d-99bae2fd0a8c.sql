ALTER TABLE public.utenti_club DROP CONSTRAINT IF EXISTS utenti_club_ruolo_check;

UPDATE public.utenti_club
SET ruolo = CASE
  WHEN ruolo IN ('superadmin','admin','staff') THEN ruolo
  ELSE 'staff'
END
WHERE ruolo NOT IN ('superadmin','admin','staff');

ALTER TABLE public.utenti_club ADD CONSTRAINT utenti_club_ruolo_check
  CHECK (ruolo IN ('superadmin','admin','staff'));