DROP POLICY IF EXISTS "scan_insert_any" ON public.convenzioni_scansioni;

CREATE POLICY "scan_insert_anon_valid"
ON public.convenzioni_scansioni
FOR INSERT
TO anon
WITH CHECK (
  club_id IS NULL
  AND atleta_id IS NULL
  AND EXISTS (
    SELECT 1 FROM public.convenzioni c
    WHERE c.id = convenzioni_scansioni.convenzione_id
      AND c.stato = 'attiva'
  )
);

CREATE POLICY "scan_insert_auth_valid"
ON public.convenzioni_scansioni
FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.convenzioni c
    WHERE c.id = convenzioni_scansioni.convenzione_id
      AND c.stato = 'attiva'
  )
  AND (
    club_id IS NULL
    OR club_id = public.user_club_id()
    OR club_id = public.mobile_club_id()
  )
  AND (
    atleta_id IS NULL
    OR atleta_id = public.mobile_atleta_id()
  )
);