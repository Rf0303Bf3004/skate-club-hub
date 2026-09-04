-- ============ HELPER FUNCTIONS ============
create or replace function public.puo_gestire_denaro()
returns boolean language sql stable security definer set search_path = public as $$
  select public.ruolo_in(array['superadmin','presidente','segreteria'])
$$;

create or replace function public.istruttore_corrente()
returns uuid language sql stable security definer set search_path = public as $$
  select i.id from public.istruttori i
   where i.user_id = auth.uid()
   order by i.created_at asc
   limit 1
$$;

create or replace function public.insegna_riferimento(p_tipo text, p_rif uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select case
    when p_rif is null or p_tipo is null then false
    when p_tipo = 'corso' then exists (
      select 1 from public.corsi_istruttori ci
       where ci.corso_id = p_rif and ci.istruttore_id = public.istruttore_corrente())
    when p_tipo = 'planning_corso' then exists (
      select 1 from public.planning_corsi_settimana p
       where p.id = p_rif
         and (p.istruttore_id = public.istruttore_corrente()
              or exists (select 1 from public.corsi_istruttori ci
                          where ci.corso_id = p.corso_id
                            and ci.istruttore_id = public.istruttore_corrente())))
    when p_tipo in ('griglia_sessione','sessione_griglia') then exists (
      select 1 from public.griglia_sessioni_istruttori g
       where g.sessione_id = p_rif and g.istruttore_id = public.istruttore_corrente())
    when p_tipo in ('lezione_privata','lezione') then exists (
      select 1 from public.lezioni_private l
       where l.id = p_rif and l.istruttore_id = public.istruttore_corrente())
    else false
  end
$$;

revoke all on function public.puo_gestire_denaro() from public, anon;
revoke all on function public.istruttore_corrente() from public, anon;
revoke all on function public.insegna_riferimento(text, uuid) from public, anon;
grant execute on function public.puo_gestire_denaro() to authenticated, service_role;
grant execute on function public.istruttore_corrente() to authenticated, service_role;
grant execute on function public.insegna_riferimento(text, uuid) to authenticated, service_role;

-- ============ 1) DENARO ============
drop policy if exists f6_finance_only on public.cassa_movimenti;
create policy cassa_select on public.cassa_movimenti for select to authenticated
  using (public.user_is_admin_like() or (club_id = public.user_club_id() and public.user_can_see_finance()));
create policy cassa_write on public.cassa_movimenti for all to authenticated
  using (public.user_is_admin_like() or (club_id = public.user_club_id() and public.puo_gestire_denaro()))
  with check (public.user_is_admin_like() or (club_id = public.user_club_id() and public.puo_gestire_denaro()));

drop policy if exists f6_finance_only on public.costi_istruttori;
create policy costi_select on public.costi_istruttori for select to authenticated
  using (public.user_is_admin_like() or (club_id = public.user_club_id() and public.user_can_see_finance()));
create policy costi_write on public.costi_istruttori for all to authenticated
  using (public.user_is_admin_like() or (club_id = public.user_club_id() and public.puo_gestire_denaro()))
  with check (public.user_is_admin_like() or (club_id = public.user_club_id() and public.puo_gestire_denaro()));

drop policy if exists f6_finance_only on public.ore_lavorate_istruttori;
create policy ore_select on public.ore_lavorate_istruttori for select to authenticated
  using (public.user_is_admin_like()
         or (club_id = public.user_club_id()
             and (public.user_can_see_finance() or istruttore_id = public.istruttore_corrente())));
create policy ore_write on public.ore_lavorate_istruttori for all to authenticated
  using (public.user_is_admin_like() or (club_id = public.user_club_id() and public.puo_gestire_denaro()))
  with check (public.user_is_admin_like() or (club_id = public.user_club_id() and public.puo_gestire_denaro()));

drop policy if exists f6_finance_only on public.ore_lavorate_dettaglio;
create policy ore_dett_select on public.ore_lavorate_dettaglio for select to authenticated
  using (public.user_is_admin_like()
         or (club_id = public.user_club_id()
             and (public.user_can_see_finance() or istruttore_id = public.istruttore_corrente())));
create policy ore_dett_write on public.ore_lavorate_dettaglio for all to authenticated
  using (public.user_is_admin_like() or (club_id = public.user_club_id() and public.puo_gestire_denaro()))
  with check (public.user_is_admin_like() or (club_id = public.user_club_id() and public.puo_gestire_denaro()));

-- ============ 2) PRESENZE ============
drop policy if exists f6_soft_all on public.presenze;
create policy presenze_select on public.presenze for select to authenticated
  using (
    public.user_is_admin_like()
    or (club_id = public.user_club_id()
        and (public.ruolo_in(array['superadmin','admin','presidente','vicepresidente','dt','segreteria'])
             or (public.ruolo_in(array['istruttore'])
                 and (public.insegna_riferimento(tipo_riferimento, riferimento_id)
                      or (tipo_persona in ('istruttore','staff') and persona_id = public.istruttore_corrente())))))
  );
create policy presenze_write on public.presenze for all to authenticated
  using (
    public.user_is_admin_like()
    or (club_id = public.user_club_id()
        and (public.ruolo_in(array['superadmin','admin','presidente','dt','segreteria'])
             or (public.ruolo_in(array['istruttore'])
                 and public.insegna_riferimento(tipo_riferimento, riferimento_id))))
  )
  with check (
    public.user_is_admin_like()
    or (club_id = public.user_club_id()
        and (public.ruolo_in(array['superadmin','admin','presidente','dt','segreteria'])
             or (public.ruolo_in(array['istruttore'])
                 and public.insegna_riferimento(tipo_riferimento, riferimento_id))))
  );

drop policy if exists f6_child_soft on public.presenze_corso;
create policy presenze_corso_select on public.presenze_corso for select to authenticated
  using (
    public.user_is_admin_like()
    or (exists (select 1 from public.atleti a where a.id = presenze_corso.atleta_id and a.club_id = public.user_club_id())
        and (public.ruolo_in(array['superadmin','admin','presidente','vicepresidente','dt','segreteria'])
             or (public.ruolo_in(array['istruttore'])
                 and public.insegna_riferimento('corso', presenze_corso.corso_id))))
  );
create policy presenze_corso_write on public.presenze_corso for all to authenticated
  using (
    public.user_is_admin_like()
    or (exists (select 1 from public.atleti a where a.id = presenze_corso.atleta_id and a.club_id = public.user_club_id())
        and (public.ruolo_in(array['superadmin','admin','presidente','dt','segreteria'])
             or (public.ruolo_in(array['istruttore'])
                 and public.insegna_riferimento('corso', presenze_corso.corso_id))))
  )
  with check (
    public.user_is_admin_like()
    or (exists (select 1 from public.atleti a where a.id = presenze_corso.atleta_id and a.club_id = public.user_club_id())
        and (public.ruolo_in(array['superadmin','admin','presidente','dt','segreteria'])
             or (public.ruolo_in(array['istruttore'])
                 and public.insegna_riferimento('corso', presenze_corso.corso_id))))
  );

-- ============ 3) GRIGLIA ============
drop policy if exists f6_write on public.griglia_blocchi;
create policy griglia_blocchi_write on public.griglia_blocchi for all to authenticated
  using (public.puo_pianificare() and (public.user_is_admin_like() or club_id = public.user_club_id()))
  with check (public.puo_pianificare() and (public.user_is_admin_like() or club_id = public.user_club_id()));

drop policy if exists f6_write on public.griglia_sessioni;
create policy griglia_sessioni_write on public.griglia_sessioni for all to authenticated
  using (public.puo_pianificare() and (public.user_is_admin_like()
    or exists (select 1 from public.griglia_blocchi b where b.id = griglia_sessioni.blocco_id and b.club_id = public.user_club_id())))
  with check (public.puo_pianificare() and (public.user_is_admin_like()
    or exists (select 1 from public.griglia_blocchi b where b.id = griglia_sessioni.blocco_id and b.club_id = public.user_club_id())));

drop policy if exists f6_select on public.griglia_sessioni;
create policy griglia_sessioni_select on public.griglia_sessioni for select to authenticated
  using (
    public.user_is_admin_like()
    or (exists (select 1 from public.griglia_blocchi b where b.id = griglia_sessioni.blocco_id and b.club_id = public.user_club_id())
        and (not public.ruolo_in(array['istruttore','aiuto_monitore'])
             or exists (select 1 from public.griglia_sessioni_istruttori g
                         where g.sessione_id = griglia_sessioni.id and g.istruttore_id = public.istruttore_corrente())))
  );

drop policy if exists f6_write on public.griglia_sessioni_atleti;
create policy griglia_sess_atleti_write on public.griglia_sessioni_atleti for all to authenticated
  using (public.puo_pianificare() and (public.user_is_admin_like()
    or exists (select 1 from public.griglia_sessioni s join public.griglia_blocchi b on b.id = s.blocco_id
                where s.id = griglia_sessioni_atleti.sessione_id and b.club_id = public.user_club_id())))
  with check (public.puo_pianificare() and (public.user_is_admin_like()
    or exists (select 1 from public.griglia_sessioni s join public.griglia_blocchi b on b.id = s.blocco_id
                where s.id = griglia_sessioni_atleti.sessione_id and b.club_id = public.user_club_id())));

drop policy if exists f6_select on public.griglia_sessioni_atleti;
create policy griglia_sess_atleti_select on public.griglia_sessioni_atleti for select to authenticated
  using (
    public.user_is_admin_like()
    or (exists (select 1 from public.griglia_sessioni s join public.griglia_blocchi b on b.id = s.blocco_id
                 where s.id = griglia_sessioni_atleti.sessione_id and b.club_id = public.user_club_id())
        and (not public.ruolo_in(array['istruttore','aiuto_monitore'])
             or exists (select 1 from public.griglia_sessioni_istruttori g
                         where g.sessione_id = griglia_sessioni_atleti.sessione_id
                           and g.istruttore_id = public.istruttore_corrente())))
  );

drop policy if exists f6_write on public.griglia_sessioni_istruttori;
create policy griglia_sess_istr_write on public.griglia_sessioni_istruttori for all to authenticated
  using (public.puo_pianificare() and (public.user_is_admin_like()
    or exists (select 1 from public.griglia_sessioni s join public.griglia_blocchi b on b.id = s.blocco_id
                where s.id = griglia_sessioni_istruttori.sessione_id and b.club_id = public.user_club_id())))
  with check (public.puo_pianificare() and (public.user_is_admin_like()
    or exists (select 1 from public.griglia_sessioni s join public.griglia_blocchi b on b.id = s.blocco_id
                where s.id = griglia_sessioni_istruttori.sessione_id and b.club_id = public.user_club_id())));

-- ============ 4) SPONSOR ============
drop policy if exists f6_soft_all on public.sponsor;
create policy sponsor_select on public.sponsor for select to authenticated
  using (public.user_is_admin_like() or club_id = public.user_club_id());
create policy sponsor_write on public.sponsor for all to authenticated
  using (public.user_is_admin_like() or (club_id = public.user_club_id() and public.puo_configurare_club()))
  with check (public.user_is_admin_like() or (club_id = public.user_club_id() and public.puo_configurare_club()));

drop policy if exists f6_soft_all on public.pacchetti_sponsor;
create policy pacchetti_sponsor_select on public.pacchetti_sponsor for select to authenticated
  using (public.user_is_admin_like() or club_id = public.user_club_id());
create policy pacchetti_sponsor_write on public.pacchetti_sponsor for all to authenticated
  using (public.user_is_admin_like() or (club_id = public.user_club_id() and public.puo_configurare_club()))
  with check (public.user_is_admin_like() or (club_id = public.user_club_id() and public.puo_configurare_club()));

-- ============ 5) RICHIESTE ISCRIZIONE ============
drop policy if exists f6_insert on public.richieste_iscrizione;
create policy richieste_insert on public.richieste_iscrizione for insert to authenticated
  with check (public.user_is_admin_like() or (club_id = public.user_club_id() and public.puo_gestire_sportivo()));

drop policy if exists f6_update_restricted on public.richieste_iscrizione;
create policy richieste_update on public.richieste_iscrizione for update to authenticated
  using (public.user_is_admin_like() or (club_id = public.user_club_id() and public.puo_gestire_sportivo()))
  with check (public.user_is_admin_like() or (club_id = public.user_club_id() and public.puo_gestire_sportivo()));

drop policy if exists f6_delete_restricted on public.richieste_iscrizione;
create policy richieste_delete on public.richieste_iscrizione for delete to authenticated
  using (public.user_is_admin_like() or (club_id = public.user_club_id() and public.puo_gestire_sportivo()));