import React from 'react';
import { useI18n } from '@/lib/i18n';
import {
  mock_atleti, mock_corsi, mock_gare, mock_comunicazioni, mock_fatture,
  mock_istruttori, get_istruttore_name, days_until, calculate_age
} from '@/lib/mock-data';
import { Users, BookOpen, Trophy, CreditCard, TrendingUp, Clock, UserCheck, MessageSquare } from 'lucide-react';

const KPICard: React.FC<{ title: string; value: string; icon: React.ReactNode; trend?: string; highlight?: boolean; subtitle?: string }> = 
  ({ title, value, icon, trend, highlight, subtitle }) => (
  <div className={`rounded-xl shadow-card p-5 bg-card transition-shadow hover:shadow-card-hover ${highlight ? 'ring-1 ring-accent/30' : ''}`}>
    <div className="flex items-start justify-between">
      <div className="space-y-1">
        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">{title}</p>
        <p className="text-2xl font-bold tracking-tight tabular-nums text-foreground">{value}</p>
        {subtitle && <p className="text-xs text-muted-foreground">{subtitle}</p>}
      </div>
      <div className="w-10 h-10 rounded-lg bg-primary/5 flex items-center justify-center text-primary">
        {icon}
      </div>
    </div>
    {trend && (
      <div className="mt-3 flex items-center gap-1 text-xs font-medium text-success">
        <TrendingUp className="w-3 h-3" />
        {trend}
      </div>
    )}
  </div>
);

const DashboardPage: React.FC = () => {
  const { t } = useI18n();

  const active_atleti = mock_atleti.filter(a => a.stato === 'attivo').length;
  const active_corsi = mock_corsi.filter(c => c.stato === 'attivo').length;
  const upcoming_gare = mock_gare.filter(g => days_until(g.data) > 0);
  const next_gara = upcoming_gare.sort((a, b) => days_until(a.data) - days_until(b.data))[0];
  const fatture_da_pagare = mock_fatture.filter(f => f.stato === 'da_pagare');
  const totale_fatture = fatture_da_pagare.reduce((s, f) => s + f.importo, 0);

  const today_day_keys = ['domenica', 'lunedi', 'martedi', 'mercoledi', 'giovedi', 'venerdi', 'sabato'];
  const today_key = today_day_keys[new Date().getDay()];
  const today_corsi = mock_corsi.filter(c => c.giorno === today_key && c.stato === 'attivo');

  const today_istruttori = mock_istruttori.filter(i => 
    i.stato === 'attivo' && i.disponibilita[today_key]?.length > 0
  );

  const recent_atleti = [...mock_atleti]
    .sort((a, b) => new Date(b.data_aggiunta).getTime() - new Date(a.data_aggiunta).getTime())
    .slice(0, 5);

  const recent_comms = [...mock_comunicazioni]
    .sort((a, b) => new Date(b.data).getTime() - new Date(a.data).getTime())
    .slice(0, 3);

  return (
    <div className="space-y-8 animate-fade-in">
      {/* KPI Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 lg:gap-6">
        <KPICard title={t('atleti_attivi')} value={String(active_atleti)} icon={<Users className="w-5 h-5" />} trend="+12%" />
        <KPICard title={t('corsi_settimana')} value={String(active_corsi)} icon={<BookOpen className="w-5 h-5" />} />
        <KPICard
          title={t('prossime_gare')}
          value={String(upcoming_gare.length)}
          icon={<Trophy className="w-5 h-5" />}
          subtitle={next_gara ? t('countdown_giorni', String(days_until(next_gara.data))) : undefined}
        />
        <KPICard title={t('fatture_scadenza')} value={`€${totale_fatture.toLocaleString()}`} icon={<CreditCard className="w-5 h-5" />} highlight />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 lg:gap-8">
        {/* Today on ice */}
        <section className="lg:col-span-2 bg-card rounded-xl shadow-card p-6">
          <h3 className="text-xs font-bold text-muted-foreground uppercase tracking-widest mb-5">{t('oggi_in_pista')}</h3>
          {today_corsi.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4">{t('nessun_risultato')}</p>
          ) : (
            <div className="space-y-3">
              {today_corsi.map(corso => (
                <div key={corso.id} className="flex gap-4 items-start group">
                  <span className="text-xs font-medium tabular-nums text-muted-foreground pt-1.5 w-12">{corso.ora_inizio}</span>
                  <div className="flex-1 p-3 rounded-lg bg-muted/50 group-hover:bg-accent/5 transition-colors cursor-pointer">
                    <p className="text-sm font-semibold text-foreground">{corso.nome}</p>
                    <p className="text-xs text-muted-foreground">
                      {corso.istruttori_ids.map(id => get_istruttore_name(id)).join(', ')} • {corso.atleti_ids.length} {t('atleti')}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Upcoming competitions */}
          <h3 className="text-xs font-bold text-muted-foreground uppercase tracking-widest mt-8 mb-5">{t('prossimi_eventi')}</h3>
          <div className="space-y-3">
            {upcoming_gare.slice(0, 3).map(gara => (
              <div key={gara.id} className="flex gap-4 items-start">
                <div className="w-12 text-center">
                  <span className="text-xs font-medium tabular-nums text-muted-foreground">
                    {new Date(gara.data).toLocaleDateString('it-CH', { day: '2-digit', month: 'short' })}
                  </span>
                </div>
                <div className="flex-1 p-3 rounded-lg bg-muted/50">
                  <p className="text-sm font-semibold text-foreground">{gara.nome}</p>
                  <p className="text-xs text-muted-foreground">{gara.localita} • {gara.atleti_iscritti.length} {t('atleti')}</p>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Right sidebar */}
        <aside className="space-y-6">
          {/* Recent athletes */}
          <div className="bg-card rounded-xl shadow-card p-5">
            <h3 className="text-xs font-bold text-muted-foreground uppercase tracking-widest mb-4">{t('ultimi_atleti')}</h3>
            <div className="space-y-3">
              {recent_atleti.map(a => (
                <div key={a.id} className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-accent/10 flex items-center justify-center text-accent text-xs font-bold shrink-0">
                    {a.nome[0]}{a.cognome[0]}
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-foreground truncate">{a.nome} {a.cognome}</p>
                    <p className="text-xs text-muted-foreground">{t(a.livello_amatori)} • {calculate_age(a.data_nascita)} {t('eta')}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Available instructors */}
          <div className="bg-card rounded-xl shadow-card p-5">
            <h3 className="text-xs font-bold text-muted-foreground uppercase tracking-widest mb-4">{t('istruttori_disponibili')}</h3>
            <div className="space-y-3">
              {today_istruttori.length === 0 ? (
                <p className="text-xs text-muted-foreground">{t('nessun_risultato')}</p>
              ) : (
                today_istruttori.map(i => (
                  <div key={i.id} className="flex items-center gap-3">
                    <UserCheck className="w-4 h-4 text-success shrink-0" />
                    <div>
                      <p className="text-sm font-medium text-foreground">{i.nome} {i.cognome}</p>
                      <p className="text-xs text-muted-foreground">
                        {i.disponibilita[today_key]?.map(s => `${s.ora_inizio}-${s.ora_fine}`).join(', ')}
                      </p>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Recent communications */}
          <div className="bg-card rounded-xl shadow-card p-5">
            <h3 className="text-xs font-bold text-muted-foreground uppercase tracking-widest mb-4">{t('ultime_comunicazioni')}</h3>
            <div className="space-y-3">
              {recent_comms.map(c => (
                <div key={c.id} className="space-y-1">
                  <div className="flex items-center gap-2">
                    <MessageSquare className="w-3 h-3 text-muted-foreground shrink-0" />
                    <p className="text-sm font-medium text-foreground truncate">{c.titolo}</p>
                  </div>
                  <p className="text-xs text-muted-foreground pl-5">{c.data}</p>
                </div>
              ))}
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
};

export default DashboardPage;
