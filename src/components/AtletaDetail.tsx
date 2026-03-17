import React, { useState } from 'react';
import { useI18n } from '@/lib/i18n';
import { use_corsi, use_gare, use_fatture, use_lezioni_private, use_istruttori, use_atleti, get_istruttore_name_from_list } from '@/hooks/use-supabase-data';
import { calculate_age } from '@/lib/mock-data';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { ArrowLeft, Shield, Trophy, Medal } from 'lucide-react';
import { AnimatePresence, motion } from 'framer-motion';

interface Props {
  atleta: any;
  on_back: () => void;
}

const AtletaDetail: React.FC<Props> = ({ atleta: a, on_back }) => {
  const { t } = useI18n();
  const [percorso_completato, set_percorso] = useState(a.percorso_amatori_completato);
  const { data: corsi = [] } = use_corsi();
  const { data: gare = [] } = use_gare();
  const { data: fatture = [] } = use_fatture();
  const { data: lezioni = [] } = use_lezioni_private();
  const { data: istruttori = [] } = use_istruttori();

  const athlete_corsi = corsi.filter((c: any) => c.atleti_ids.includes(a.id));
  const athlete_gare = gare.filter((g: any) => g.atleti_iscritti.some((ai: any) => ai.atleta_id === a.id));
  const athlete_fatture = fatture.filter((f: any) => f.atleta_id === a.id);
  const athlete_lezioni = lezioni.filter((l: any) => l.atleti_ids.includes(a.id));

  const medals = athlete_gare.flatMap((g: any) =>
    g.atleti_iscritti.filter((ai: any) => ai.atleta_id === a.id && ai.medaglia).map((ai: any) => ({
      gara: g.nome,
      medaglia: ai.medaglia,
      punteggio: ai.punteggio,
      posizione: ai.posizione,
    }))
  );

  return (
    <div className="space-y-6 animate-fade-in">
      <Button variant="ghost" onClick={on_back} className="text-muted-foreground">
        <ArrowLeft className="w-4 h-4 mr-2" /> {t('atleti')}
      </Button>

      <div className="flex items-center gap-4">
        <div className="w-14 h-14 rounded-full bg-accent/10 flex items-center justify-center text-accent text-lg font-bold">
          {a.nome[0]}{a.cognome[0]}
        </div>
        <div>
          <h1 className="text-xl font-bold tracking-tight text-foreground">{a.nome} {a.cognome}</h1>
          <div className="flex items-center gap-2 mt-1">
            <Badge variant="secondary">{t(a.livello_amatori)}</Badge>
            {a.atleta_federazione && (
              <Badge variant="outline" className="gap-1"><Shield className="w-3 h-3" /> {t('atleta_federazione')}</Badge>
            )}
          </div>
        </div>
      </div>

      <Tabs defaultValue="anagrafica">
        <TabsList className="flex-wrap">
          <TabsTrigger value="anagrafica">{t('anagrafica')}</TabsTrigger>
          <TabsTrigger value="livello">{t('livello')}</TabsTrigger>
          <TabsTrigger value="corsi">{t('corsi')}</TabsTrigger>
          <TabsTrigger value="gare">{t('gare')}</TabsTrigger>
          <TabsTrigger value="medagliere">{t('medagliere')}</TabsTrigger>
          <TabsTrigger value="genitori">{t('genitori')}</TabsTrigger>
          <TabsTrigger value="fatture">{t('fatture')}</TabsTrigger>
          <TabsTrigger value="lezioni">{t('lezioni')}</TabsTrigger>
        </TabsList>

        <TabsContent value="anagrafica" className="mt-6">
          <div className="bg-card rounded-xl shadow-card p-6 space-y-4 max-w-lg">
            <InfoRow label={t('nome')} value={a.nome} />
            <InfoRow label={t('cognome')} value={a.cognome} />
            <InfoRow label={t('data_nascita')} value={new Date(a.data_nascita).toLocaleDateString('it-CH')} />
            <InfoRow label={t('eta')} value={`${calculate_age(a.data_nascita)}`} />
            <InfoRow label={t('ore_pista')} value={`${a.ore_pista_stagione}h`} />
            {a.note && <InfoRow label={t('note')} value={a.note} />}
          </div>
        </TabsContent>

        <TabsContent value="livello" className="mt-6">
          <div className="bg-card rounded-xl shadow-card p-6 space-y-5 max-w-lg">
            <InfoRow label={t('percorso_amatori')} value={t(a.livello_amatori)} />
            <div className="flex items-center gap-2">
              <Checkbox checked={percorso_completato} onCheckedChange={(v) => set_percorso(!!v)} />
              <label className="text-sm font-medium text-foreground">{t('percorso_completato')}</label>
            </div>
            <AnimatePresence>
              {percorso_completato && (
                <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 10 }} className="space-y-4 pt-2">
                  <InfoRow label={t('carriera_artistica')} value={a.carriera_artistica ? t(a.carriera_artistica) : '—'} />
                  <InfoRow label={t('carriera_stile')} value={a.carriera_stile ? t(a.carriera_stile) : '—'} />
                  {(a.carriera_artistica || a.carriera_stile) && (
                    <div className="flex items-center gap-2">
                      <Checkbox checked={a.atleta_federazione} disabled />
                      <label className="text-sm text-foreground">{t('atleta_federazione')}</label>
                    </div>
                  )}
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </TabsContent>

        <TabsContent value="corsi" className="mt-6">
          <div className="bg-card rounded-xl shadow-card overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border">
                  <th className="text-left px-4 py-3 text-xs font-bold text-muted-foreground uppercase tracking-wider">{t('nome')}</th>
                  <th className="text-left px-4 py-3 text-xs font-bold text-muted-foreground uppercase tracking-wider">{t('tipo')}</th>
                  <th className="text-left px-4 py-3 text-xs font-bold text-muted-foreground uppercase tracking-wider">{t('giorno')}</th>
                  <th className="text-left px-4 py-3 text-xs font-bold text-muted-foreground uppercase tracking-wider">{t('ora_inizio')}</th>
                </tr>
              </thead>
              <tbody>
                {athlete_corsi.map((c: any) => (
                  <tr key={c.id} className="border-b border-border/50">
                    <td className="px-4 py-3 font-medium text-foreground">{c.nome}</td>
                    <td className="px-4 py-3 text-muted-foreground">{c.tipo}</td>
                    <td className="px-4 py-3 text-muted-foreground">{t(c.giorno)}</td>
                    <td className="px-4 py-3 tabular-nums text-muted-foreground">{c.ora_inizio} - {c.ora_fine}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </TabsContent>

        <TabsContent value="gare" className="mt-6">
          <div className="bg-card rounded-xl shadow-card overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border">
                  <th className="text-left px-4 py-3 text-xs font-bold text-muted-foreground uppercase tracking-wider">{t('nome')}</th>
                  <th className="text-left px-4 py-3 text-xs font-bold text-muted-foreground uppercase tracking-wider">{t('data')}</th>
                  <th className="text-right px-4 py-3 text-xs font-bold text-muted-foreground uppercase tracking-wider">{t('punteggio')}</th>
                  <th className="text-center px-4 py-3 text-xs font-bold text-muted-foreground uppercase tracking-wider">{t('posizione')}</th>
                  <th className="text-center px-4 py-3 text-xs font-bold text-muted-foreground uppercase tracking-wider">{t('medaglia')}</th>
                </tr>
              </thead>
              <tbody>
                {athlete_gare.map((g: any) => {
                  const entry = g.atleti_iscritti.find((ai: any) => ai.atleta_id === a.id)!;
                  return (
                    <tr key={g.id} className="border-b border-border/50">
                      <td className="px-4 py-3 font-medium text-foreground">{g.nome}</td>
                      <td className="px-4 py-3 text-muted-foreground">{new Date(g.data).toLocaleDateString('it-CH')}</td>
                      <td className="px-4 py-3 text-right tabular-nums text-muted-foreground">{entry.punteggio ?? '—'}</td>
                      <td className="px-4 py-3 text-center tabular-nums text-muted-foreground">{entry.posizione ?? '—'}</td>
                      <td className="px-4 py-3 text-center">
                        {entry.medaglia ? <MedalBadge tipo={entry.medaglia} /> : '—'}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </TabsContent>

        <TabsContent value="medagliere" className="mt-6">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {['oro', 'argento', 'bronzo'].map(tipo => {
              const count = medals.filter((m: any) => m.medaglia === tipo).length;
              const colors: Record<string, string> = {
                oro: 'bg-yellow-100 text-yellow-700 border-yellow-200',
                argento: 'bg-slate-100 text-slate-600 border-slate-200',
                bronzo: 'bg-orange-100 text-orange-700 border-orange-200',
              };
              return (
                <div key={tipo} className={`rounded-xl border p-6 text-center ${colors[tipo]}`}>
                  <Medal className="w-8 h-8 mx-auto mb-2" />
                  <p className="text-3xl font-bold tabular-nums">{count}</p>
                  <p className="text-sm font-medium mt-1">{t(`${tipo}_medal`)}</p>
                </div>
              );
            })}
          </div>
          {medals.length > 0 && (
            <div className="mt-4 bg-card rounded-xl shadow-card p-5 space-y-2">
              {medals.map((m: any, i: number) => (
                <div key={i} className="flex items-center gap-3 text-sm">
                  <MedalBadge tipo={m.medaglia} />
                  <span className="font-medium text-foreground">{m.gara}</span>
                  <span className="text-muted-foreground tabular-nums">— {m.punteggio}pts, #{m.posizione}</span>
                </div>
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="genitori" className="mt-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <ParentCard title={t('genitore_1')} parent={a.genitore_1} />
            {a.genitore_2 && <ParentCard title={t('genitore_2')} parent={a.genitore_2} />}
          </div>
        </TabsContent>

        <TabsContent value="fatture" className="mt-6">
          <div className="bg-card rounded-xl shadow-card overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border">
                  <th className="text-left px-4 py-3 text-xs font-bold text-muted-foreground uppercase tracking-wider">{t('numero_fattura')}</th>
                  <th className="text-left px-4 py-3 text-xs font-bold text-muted-foreground uppercase tracking-wider">{t('descrizione')}</th>
                  <th className="text-right px-4 py-3 text-xs font-bold text-muted-foreground uppercase tracking-wider">{t('importo')}</th>
                  <th className="text-center px-4 py-3 text-xs font-bold text-muted-foreground uppercase tracking-wider">{t('stato')}</th>
                </tr>
              </thead>
              <tbody>
                {athlete_fatture.map((f: any) => (
                  <tr key={f.id} className="border-b border-border/50">
                    <td className="px-4 py-3 font-medium tabular-nums text-foreground">{f.numero}</td>
                    <td className="px-4 py-3 text-muted-foreground">{f.descrizione}</td>
                    <td className="px-4 py-3 text-right tabular-nums font-medium text-foreground">CHF {f.importo}</td>
                    <td className="px-4 py-3 text-center">
                      <Badge variant={f.stato === 'pagata' ? 'default' : 'destructive'} className="text-xs">
                        {t(f.stato)}
                      </Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </TabsContent>

        <TabsContent value="lezioni" className="mt-6">
          <div className="bg-card rounded-xl shadow-card overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border">
                  <th className="text-left px-4 py-3 text-xs font-bold text-muted-foreground uppercase tracking-wider">{t('data')}</th>
                  <th className="text-left px-4 py-3 text-xs font-bold text-muted-foreground uppercase tracking-wider">{t('istruttori')}</th>
                  <th className="text-left px-4 py-3 text-xs font-bold text-muted-foreground uppercase tracking-wider">{t('ora_inizio')}</th>
                  <th className="text-right px-4 py-3 text-xs font-bold text-muted-foreground uppercase tracking-wider">{t('importo')}</th>
                </tr>
              </thead>
              <tbody>
                {athlete_lezioni.map((l: any) => (
                  <tr key={l.id} className="border-b border-border/50">
                    <td className="px-4 py-3 text-muted-foreground">{new Date(l.data).toLocaleDateString('it-CH')}</td>
                    <td className="px-4 py-3 font-medium text-foreground">{get_istruttore_name_from_list(istruttori, l.istruttore_id)}</td>
                    <td className="px-4 py-3 tabular-nums text-muted-foreground">{l.ora_inizio} - {l.ora_fine}</td>
                    <td className="px-4 py-3 text-right tabular-nums font-medium text-foreground">€{l.costo}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
};

const InfoRow: React.FC<{ label: string; value: string }> = ({ label, value }) => (
  <div className="flex justify-between items-center py-1">
    <span className="text-sm text-muted-foreground">{label}</span>
    <span className="text-sm font-medium text-foreground">{value}</span>
  </div>
);

const MedalBadge: React.FC<{ tipo: string }> = ({ tipo }) => {
  const colors: Record<string, string> = {
    oro: 'bg-yellow-100 text-yellow-700',
    argento: 'bg-slate-100 text-slate-600',
    bronzo: 'bg-orange-100 text-orange-700',
  };
  return <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${colors[tipo] || ''}`}>{tipo}</span>;
};

const ParentCard: React.FC<{ title: string; parent: { nome: string; cognome: string; telefono: string; email: string } }> = ({ title, parent }) => {
  const { t } = useI18n();
  return (
    <div className="bg-card rounded-xl shadow-card p-5 space-y-3">
      <h4 className="text-xs font-bold text-muted-foreground uppercase tracking-wider">{title}</h4>
      <InfoRow label={t('nome')} value={parent.nome} />
      <InfoRow label={t('cognome')} value={parent.cognome} />
      <InfoRow label={t('telefono')} value={parent.telefono} />
      <InfoRow label={t('email')} value={parent.email} />
    </div>
  );
};

export default AtletaDetail;
