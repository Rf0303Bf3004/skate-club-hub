-- Fix infinite recursion between RLS policies on comunicazioni <-> comunicazioni_destinatari.
-- The mobile_parent SELECT policy on comunicazioni did EXISTS on comunicazioni_destinatari,
-- whose own f6_child_soft policy did EXISTS back on comunicazioni → 42P17 recursion,
-- which made every authenticated SELECT on comunicazioni fail (counters 0/0/0).

CREATE OR REPLACE FUNCTION public.mobile_can_see_comunicazione(p_com_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.comunicazioni_destinatari cd
    WHERE cd.comunicazione_id = p_com_id
      AND cd.atleta_id = public.mobile_atleta_id()
  );
$$;

DROP POLICY IF EXISTS "mobile_parent_select_comunicazioni" ON public.comunicazioni;
CREATE POLICY "mobile_parent_select_comunicazioni"
  ON public.comunicazioni
  FOR SELECT
  TO authenticated
  USING (
    public.is_mobile_parent()
    AND club_id = public.mobile_club_id()
    AND public.mobile_can_see_comunicazione(id)
  );