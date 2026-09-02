REVOKE EXECUTE ON FUNCTION public.puo_gestire_sportivo() FROM anon;
REVOKE EXECUTE ON FUNCTION public.puo_comunicare() FROM anon;
REVOKE EXECUTE ON FUNCTION public.puo_configurare_club() FROM anon;
REVOKE EXECUTE ON FUNCTION public.puo_pianificare() FROM anon;
REVOKE EXECUTE ON FUNCTION public.puo_gestire_fatture(uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.ruolo_in(text[]) FROM anon;