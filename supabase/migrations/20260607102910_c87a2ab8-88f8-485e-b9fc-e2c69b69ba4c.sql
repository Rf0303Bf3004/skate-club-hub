CREATE POLICY "Mobile parents can create own subscription requests" ON public.richieste_iscrizione
FOR INSERT TO authenticated
WITH CHECK (
  public.is_mobile_parent() 
  AND atleta_id = public.mobile_atleta_id()
);