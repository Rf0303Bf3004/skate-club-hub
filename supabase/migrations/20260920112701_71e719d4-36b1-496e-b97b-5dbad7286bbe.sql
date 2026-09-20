CREATE TABLE public.assenze_staff_esiti (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  club_id uuid NOT NULL REFERENCES public.clubs(id) ON DELETE CASCADE,
  destinatario_staff_id uuid NOT NULL UNIQUE REFERENCES public.comunicazioni_destinatari_staff(id) ON DELETE CASCADE,
  esito text NOT NULL DEFAULT 'annunciata' CHECK (esito IN ('annunciata','presentata','sostituita','ritirata')),
  sostituto_istruttore_id uuid NULL REFERENCES public.istruttori(id) ON DELETE SET NULL,
  nota text NULL,
  aggiornato_da uuid NULL,
  aggiornato_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX assenze_staff_esiti_club_dest_idx ON public.assenze_staff_esiti (club_id, destinatario_staff_id);

COMMENT ON TABLE public.assenze_staff_esiti IS 'Come è finita ogni assenza annunciata da un membro dello staff: una riga per promemoria di turno rifiutato.';
COMMENT ON COLUMN public.assenze_staff_esiti.id IS 'Identificativo della riga.';
COMMENT ON COLUMN public.assenze_staff_esiti.club_id IS 'Club a cui appartiene l''assenza.';
COMMENT ON COLUMN public.assenze_staff_esiti.destinatario_staff_id IS 'Riga del promemoria di turno (comunicazioni_destinatari_staff) a cui la persona ha risposto "non ci sarò".';
COMMENT ON COLUMN public.assenze_staff_esiti.esito IS 'Esito della gestione: annunciata, presentata, sostituita, ritirata.';
COMMENT ON COLUMN public.assenze_staff_esiti.sostituto_istruttore_id IS 'Istruttore che ha coperto il turno, quando l''esito è "sostituita".';
COMMENT ON COLUMN public.assenze_staff_esiti.nota IS 'Nota libera scritta dal club.';
COMMENT ON COLUMN public.assenze_staff_esiti.aggiornato_da IS 'Utente che ha aggiornato l''esito per ultimo.';
COMMENT ON COLUMN public.assenze_staff_esiti.aggiornato_at IS 'Momento dell''ultimo aggiornamento dell''esito.';

GRANT SELECT, INSERT, UPDATE, DELETE ON public.assenze_staff_esiti TO authenticated;
GRANT ALL ON public.assenze_staff_esiti TO service_role;

ALTER TABLE public.assenze_staff_esiti ENABLE ROW LEVEL SECURITY;

CREATE POLICY assenze_staff_esiti_select ON public.assenze_staff_esiti
  FOR SELECT TO authenticated
  USING (user_is_admin_like() OR (club_id = user_club_id() AND puo_gestire_sportivo()));

CREATE POLICY assenze_staff_esiti_write ON public.assenze_staff_esiti
  FOR ALL TO authenticated
  USING (user_is_admin_like() OR (club_id = user_club_id() AND puo_gestire_sportivo()))
  WITH CHECK (user_is_admin_like() OR (club_id = user_club_id() AND puo_gestire_sportivo()));