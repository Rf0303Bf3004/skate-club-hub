DROP TABLE IF EXISTS public.atleti_backup_20260606;
DROP TABLE IF EXISTS public.atleti_bk_compleanni_20260606;
DROP TABLE IF EXISTS public.clubs_backup_20260606;
DROP TABLE IF EXISTS public.corsi_bk_demoseed_20260606;
DROP TABLE IF EXISTS public.corsi_bk_seed_20260606;

ALTER VIEW public.atleti_con_completezza SET (security_invoker = true);