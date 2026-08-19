CREATE OR REPLACE FUNCTION public.user_can_manage_griglia()
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT EXISTS(SELECT 1 FROM public.utenti_club WHERE user_id = auth.uid() AND ruolo IN ('superadmin','admin','vicepresidente','presidente','dt'));
$function$;