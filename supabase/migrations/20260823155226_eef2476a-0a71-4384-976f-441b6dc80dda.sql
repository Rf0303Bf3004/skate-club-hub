ALTER TABLE public.clubs
  ADD COLUMN IF NOT EXISTS disponibilita_tipo_pianificazione text NOT NULL DEFAULT 'stagionale',
  ADD COLUMN IF NOT EXISTS disponibilita_periodo_giorni integer,
  ADD COLUMN IF NOT EXISTS disponibilita_giorni_preavviso integer NOT NULL DEFAULT 5,
  ADD COLUMN IF NOT EXISTS disponibilita_notifica_inviata_per date;

ALTER TABLE public.clubs
  DROP CONSTRAINT IF EXISTS clubs_disponibilita_tipo_pianificazione_check;
ALTER TABLE public.clubs
  ADD CONSTRAINT clubs_disponibilita_tipo_pianificazione_check
  CHECK (disponibilita_tipo_pianificazione IN ('stagionale','periodica'));

CREATE OR REPLACE FUNCTION public.genera_reminder_scadenza_ghiaccio()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_club RECORD;
  v_today date;
  v_total int := 0;
BEGIN
  v_today := (now() AT TIME ZONE 'Europe/Zurich')::date;

  FOR v_club IN
    SELECT id, disponibilita_valida_fino_al, disponibilita_giorni_preavviso
      FROM public.clubs
     WHERE disponibilita_tipo_pianificazione = 'periodica'
       AND disponibilita_valida_fino_al IS NOT NULL
       AND disponibilita_valida_fino_al >= v_today
       AND disponibilita_valida_fino_al <= v_today + COALESCE(disponibilita_giorni_preavviso, 5)
       AND disponibilita_notifica_inviata_per IS DISTINCT FROM disponibilita_valida_fino_al
  LOOP
    INSERT INTO public.comunicazioni
      (club_id, titolo, testo, tipo, sotto_tipo, categoria, stato, data_evento, richiede_rsvp, tipo_destinatari)
    VALUES
      (v_club.id,
       '⏰ Disponibilità ghiaccio in scadenza',
       'La disponibilità ghiaccio/palestre del club scade il '
         || to_char(v_club.disponibilita_valida_fino_al, 'DD/MM/YYYY')
         || '. Vai in Setup Club → Ghiaccio e Planning per rivederla e rinnovarla per il prossimo periodo.',
       'reminder', 'reminder_disponibilita', 'inviata', 'sent',
       v_club.disponibilita_valida_fino_al, false, 'staff');

    UPDATE public.clubs
       SET disponibilita_notifica_inviata_per = v_club.disponibilita_valida_fino_al
     WHERE id = v_club.id;

    v_total := v_total + 1;
  END LOOP;

  RETURN v_total;
END;
$$;

SELECT cron.schedule(
  'genera_reminder_scadenza_ghiaccio',
  '40 6 * * *',
  $$SELECT public.genera_reminder_scadenza_ghiaccio();$$
);