CREATE OR REPLACE FUNCTION public.trg_seed_new_club()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  perform public.seed_pacchetti_sponsor_default(new.id);
  perform public.seed_permessi_default(new.id);
  perform public.seed_permessi_integrazioni(new.id);
  perform public.seed_dashboard_cards_default(new.id);
  insert into public.club_identity (club_id, citta, email_contatto)
  values (new.id, new.citta, new.email)
  on conflict do nothing;
  -- La Griglia attività è l'unico posto da cui si creano i corsi: un club nuovo nasce con la griglia accesa.
  insert into public.moduli_gestione_club (club_id, area, modalita)
  values (new.id, 'ghiaccio', 'griglia_giornaliera')
  on conflict (club_id, area) do nothing;
  return new;
end $function$;