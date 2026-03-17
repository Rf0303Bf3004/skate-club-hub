import React, { useState } from 'react';
import { useI18n } from '@/lib/i18n';
import { use_corsi, use_gare, use_fatture, use_lezioni_private, use_istruttori, get_istruttore_name_from_list } from '@/hooks/use-supabase-data';
import { use_upsert_atleta } from '@/hooks/use-supabase-mutations';
import { calculate_age } from '@/lib/mock-data';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ArrowLeft, Shield, Medal, Save } from 'lucide-react';
import { AnimatePresence, motion } from 'framer-motion';
import { toast } from 'sonner';

interface Props { atleta: any; on_back: () => void; }

const AtletaDetail: React.FC<Props> = ({ atleta: a, on_back }) => {
  const { t } = useI18n();
  const upsert = use_upsert_atleta();
  const [form, set_form] = useState({ ...a, genitore1_nome: a.genitore_1?.nome || '', genitore1_cognome: a.genitore_1?.cognome || '', genitore1_telefono: a.genitore_1?.telefono || '', genitore1_email: a.genitore_1?.email || '', genitore2_nome: a.genitore_2?.nome || '', genitore2_cognome: a.genitore_2?.cognome || '', genitore2_telefono: a.genitore_2?.telefono || '', genitore2_email: a.genitore_2?.email || '' });
  const { data: corsi = [] } = use_corsi();
  const { data: gare = [] } = use_gare();
  const { data: fatture = [] } = use_fatture();
  const { data: lezioni = [] } = use_lezioni_private();
  const { data: istruttori = [] } = use_istruttori();

  const athlete_corsi = corsi.filter((c: any) => c.atleti_ids.includes(a.id));
  const athlete_gare = gare.filter((g: any) => g.atleti_iscritti.some((ai: any) => ai.atleta_id === a.id));
  const athlete_fatture = fatture.filter((f: any) => f.atleta_id === a.id);
  const athlete_lezioni = lezioni.filter((l: any) => l.atleti_ids.includes(a.id));

  const medals = athlete_gare.flatMap((g: any) => g.atleti_iscritti.filter((ai: any) => ai.atleta_id === a.id && ai.medaglia).map((ai: any) => ({ gara: g.nome, medaglia: ai.medaglia, punteggio: ai.punteggio, posizione: ai.posizione })));

  const upd = (k: string, v: any) => set_form((p: any) => ({ ...p, [k]: v }));
  const levels = ['pulcini', 'stellina_1', 'stellina_2', 'stellina_3', 'stellina_4', 'interbronzo', 'bronzo', 'interargento', 'argento', 'interoro', 'oro'];

  const handle_save = async () => {
    await upsert.mutateAsync({ id: a.id, nome: form.nome, cognome: form.cognome, data_nascita: form.data_nascita, percorso_amatori: form.percorso_amatori || form.livello_amatori, carriera_artistica: form.carriera_artistica, carriera_stile: form.carriera_stile, atleta_federazione: form.atleta_federazione, ore_pista_stagione: form.ore_pista_stagione, genitore1_nome: form.genitore1_nome, genitore1_cognome: form.genitore1_cognome, genitore1_telefono: form.genitore1_telefono, genitore1_email: form.genitore1_email, genitore2_nome: form.genitore2_nome, genitore2_cognome: form.genitore2_cognome, genitore2_telefono: form.genitore2_telefono, genitore2_email: form.genitore2_email, attivo: form.attivo !== false, note: form.note, disco_in_preparazione: form.disco_in_preparazione });
    toast.success('Atleta salvato');
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <Button variant="ghost" onClick={on_back} className="text-muted-foreground"><ArrowLeft className="w-4 h-4 mr-2" /> {t('atleti')}</Button>
        <Button onClick={handle_save} disabled={upsert.isPending}><Save className="w-4 h-4 mr-2" /> {upsert.isPending ? '...' : t('salva')}</Button>
      </div>

      <div className="flex items-center gap-4">
        <div className="w-14 h-14 rounded-full bg-accent/10 flex items-center justify-center text-accent text-lg font-bold">{form.nome[0]}{form.cognome[0]}</div>
        <div>
          <h1 className="text-xl font-bold tracking-tight text-foreground">{form.nome} {form.cognome}</h1>
          <div className="flex items-center gap-2 mt-1">
            <Badge variant="secondary">{t(form.livello_amatori)}</Badge>
            {form.atleta_federazione && <Badge variant="outline" className="gap-1"><Shield className="w-3 h-3" /> {t('atleta_federazione')}</Badge>}
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
            <EditRow label={t('nome')} value={form.nome} onChange={v => upd('nome', v)} />
            <EditRow label={t('cognome')} value={form.cognome} onChange={v => upd('cognome', v)} />
            <EditRow label={t('data_nascita')} value={form.data_nascita?.split('T')[0]} onChange={v => upd('data_nascita', v)} type="date" />
            <InfoRow label={t('eta')} value={`${calculate_age(form.data_nascita)}`} />
            <EditRow label={t('ore_pista')} value={form.ore_pista_stagione} onChange={v => upd('ore_pista_stagione', Number(v))} type="number" />
            <div className="space-y-1.5">
              <Label className="text-sm text-muted-foreground">{t('note')}</Label>
              <Textarea value={form.note || ''} onChange={e => upd('note', e.target.value)} />
            </div>
          </div>
        </TabsContent>

        <TabsContent value="livello" className="mt-6">
          <div className="bg-card rounded-xl shadow-card p-6 space-y-5 max-w-lg">
            <div className="space-y-1.5">
              <Label className="text-sm text-muted-foreground">{t('percorso_amatori')}</Label>
              <Select value={form.percorso_amatori || form.livello_amatori} onValueChange={v => upd('percorso_amatori', v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{levels.map(l => <SelectItem key={l} value={l}>{t(l)}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="flex items-center gap-2">
              <Checkbox checked={form.percorso_amatori_completato} onCheckedChange={v => upd('percorso_amatori_completato', !!v)} />
              <label className="text-sm font-medium text-foreground">{t('percorso_completato')}</label>
            </div>
            <AnimatePresence>
              {form.percorso_amatori_completato && (
                <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 10 }} className="space-y-4 pt-2">
                  <EditRow label={t('carriera_artistica')} value={form.carriera_artistica || ''} onChange={v => upd('carriera_artistica', v)} />
                  <EditRow label={t('carriera_stile')} value={form.carriera_stile || ''} onChange={v => upd('carriera_stile', v)} />
                  <div className="flex items-center gap-2">
                    <Checkbox checked={form.atleta_federazione} onCheckedChange={v => upd('atleta_federazione', !!v)} />
                    <label className="text-sm text-foreground">{t('atleta_federazione')}</label>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </TabsContent>

        <TabsContent value="corsi" className="mt-6">
          <div className="bg-card rounded-xl shadow-card overflow-hidden">
            <table className="w-full text-sm">
              <thead><tr className="border-b border-border">
                <th className="text-left px-4 py-3 text-xs font-bold text-muted-foreground uppercase tracking-wider">{t('nome')}</th>
                <th className="text-left px-4 py-3 text-xs font-bold text-muted-foreground uppercase tracking-wider">{t('tipo')}</th>
                <th className="text-left px-4 py-3 text-xs font-bold text-muted-foreground uppercase tracking-wider">{t('giorno')}</th>
                <th className="text-left px-4 py-3 text-xs font-bold text-muted-foreground uppercase tracking-wider">{t('ora_inizio')}</th>
              </tr></thead>
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
              <thead><tr className="border-b border-border">
                <th className="text-left px-4 py-3 text-xs font-bold text-muted-foreground uppercase tracking-wider">{t('nome')}</th>
                <th className="text-left px-4 py-3 text-xs font-bold text-muted-foreground uppercase tracking-wider">{t('data')}</th>
                <th className="text-right px-4 py-3 text-xs font-bold text-muted-foreground uppercase tracking-wider">{t('punteggio')}</th>
                <th className="text-center px-4 py-3 text-xs font-bold text-muted-foreground uppercase tracking-wider">{t('posizione')}</th>
                <th className="text-center px-4 py-3 text-xs font-bold text-muted-foreground uppercase tracking-wider">{t('medaglia')}</th>
              </tr></thead>
              <tbody>
                {athlete_gare.map((g: any) => {
                  const entry = g.atleti_iscritti.find((ai: any) => ai.atleta_id === a.id)!;
                  return (
                    <tr key={g.id} className="border-b border-border/50">
                      <td className="px-4 py-3 font-medium text-foreground">{g.nome}</td>
                      <td className="px-4 py-3 text-muted-foreground">{new Date(g.data + 'T00:00:00').toLocaleDateString('it-CH')}</td>
                      <td className="px-4 py-3 text-right tabular-nums text-muted-foreground">{entry.punteggio ?? '—'}</td>
                      <td className="px-4 py-3 text-center tabular-nums text-muted-foreground">{entry.posizione ?? '—'}</td>
                      <td className="px-4 py-3 text-center">{entry.medaglia ? <MedalBadge tipo={entry.medaglia} /> : '—'}</td>
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
              const colors: Record<string, string> = { oro: 'bg-yellow-100 text-yellow-700 border-yellow-200', argento: 'bg-slate-100 text-slate-600 border-slate-200', bronzo: 'bg-orange-100 text-orange-700 border-orange-200' };
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
            <div className="bg-card rounded-xl shadow-card p-5 space-y-3">
              <h4 className="text-xs font-bold text-muted-foreground uppercase tracking-wider">{t('genitore_1')}</h4>
              <EditRow label={t('nome')} value={form.genitore1_nome} onChange={v => upd('genitore1_nome', v)} />
              <EditRow label={t('cognome')} value={form.genitore1_cognome} onChange={v => upd('genitore1_cognome', v)} />
              <EditRow label={t('telefono')} value={form.genitore1_telefono} onChange={v => upd('genitore1_telefono', v)} />
              <EditRow label={t('email')} value={form.genitore1_email} onChange={v => upd('genitore1_email', v)} type="email" />
            </div>
            <div className="bg-card rounded-xl shadow-card p-5 space-y-3">
              <h4 className="text-xs font-bold text-muted-foreground uppercase tracking-wider">{t('genitore_2')}</h4>
              <EditRow label={t('nome')} value={form.genitore2_nome} onChange={v => upd('genitore2_nome', v)} />
              <EditRow label={t('cognome')} value={form.genitore2_cognome} onChange={v => upd('genitore2_cognome', v)} />
              <EditRow label={t('telefono')} value={form.genitore2_telefono} onChange={v => upd('genitore2_telefono', v)} />
              <EditRow label={t('email')} value={form.genitore2_email} onChange={v => upd('genitore2_email', v)} type="email" />
            </div>
          </div>
        </TabsContent>

        <TabsContent value="fatture" className="mt-6">
          <div className="bg-card rounded-xl shadow-card overflow-hidden">
            <table className="w-full text-sm">
              <thead><tr className="border-b border-border">
                <th className="text-left px-4 py-3 text-xs font-bold text-muted-foreground uppercase tracking-wider">{t('numero_fattura')}</th>
                <th className="text-left px-4 py-3 text-xs font-bold text-muted-foreground uppercase tracking-wider">{t('descrizione')}</th>
                <th className="text-right px-4 py-3 text-xs font-bold text-muted-foreground uppercase tracking-wider">{t('importo')}</th>
                <th className="text-center px-4 py-3 text-xs font-bold text-muted-foreground uppercase tracking-wider">{t('stato')}</th>
              </tr></thead>
              <tbody>
                {athlete_fatture.map((f: any) => (
                  <tr key={f.id} className="border-b border-border/50">
                    <td className="px-4 py-3 font-medium tabular-nums text-foreground">{f.numero}</td>
                    <td className="px-4 py-3 text-muted-foreground">{f.descrizione}</td>
                    <td className="px-4 py-3 text-right tabular-nums font-medium text-foreground">CHF {f.importo}</td>
                    <td className="px-4 py-3 text-center"><Badge variant={f.stato === 'pagata' ? 'default' : 'destructive'} className="text-xs">{t(f.stato)}</Badge></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </TabsContent>

        <TabsContent value="lezioni" className="mt-6">
          <div className="bg-card rounded-xl shadow-card overflow-hidden">
            <table className="w-full text-sm">
              <thead><tr className="border-b border-border">
                <th className="text-left px-4 py-3 text-xs font-bold text-muted-foreground uppercase tracking-wider">{t('data')}</th>
                <th className="text-left px-4 py-3 text-xs font-bold text-muted-foreground uppercase tracking-wider">{t('istruttori')}</th>
                <th className="text-left px-4 py-3 text-xs font-bold text-muted-foreground uppercase tracking-wider">{t('ora_inizio')}</th>
                <th className="text-right px-4 py-3 text-xs font-bold text-muted-foreground uppercase tracking-wider">{t('importo')}</th>
              </tr></thead>
              <tbody>
                {athlete_lezioni.map((l: any) => (
                  <tr key={l.id} className="border-b border-border/50">
                    <td className="px-4 py-3 text-muted-foreground">{new Date(l.data + 'T00:00:00').toLocaleDateString('it-CH')}</td>
                    <td className="px-4 py-3 font-medium text-foreground">{get_istruttore_name_from_list(istruttori, l.istruttore_id)}</td>
                    <td className="px-4 py-3 tabular-nums text-muted-foreground">{l.ora_inizio} - {l.ora_fine}</td>
                    <td className="px-4 py-3 text-right tabular-nums font-medium text-foreground">CHF {l.costo}</td>
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

const EditRow: React.FC<{ label: string; value: any; onChange: (v: string) => void; type?: string }> = ({ label, value, onChange, type }) => (
  <div className="space-y-1.5">
    <Label className="text-sm text-muted-foreground">{label}</Label>
    <Input type={type || 'text'} value={value ?? ''} onChange={e => onChange(e.target.value)} className="h-9" />
  </div>
);

const MedalBadge: React.FC<{ tipo: string }> = ({ tipo }) => {
  const colors: Record<string, string> = { oro: 'bg-yellow-100 text-yellow-700', argento: 'bg-slate-100 text-slate-600', bronzo: 'bg-orange-100 text-orange-700' };
  return <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${colors[tipo] || ''}`}>{tipo}</span>;
};

export default AtletaDetail;
