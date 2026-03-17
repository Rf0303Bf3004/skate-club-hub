import React, { useState } from 'react';
import { useI18n } from '@/lib/i18n';
import { use_gare, use_atleti, get_atleta_name_from_list } from '@/hooks/use-supabase-data';
import { use_upsert_gara, use_iscrivi_atleta_gara } from '@/hooks/use-supabase-mutations';
import { days_until } from '@/lib/mock-data';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Plus, ArrowLeft, MapPin, Calendar } from 'lucide-react';
import FormDialog, { FormField } from '@/components/forms/FormDialog';

const CompetitionsPage: React.FC = () => {
  const { t } = useI18n();
  const { data: gare = [], isLoading } = use_gare();
  const { data: atleti = [] } = use_atleti();
  const upsert_gara = use_upsert_gara();
  const iscrivi = use_iscrivi_atleta_gara();
  const [selected_id, set_selected_id] = useState<string | null>(null);
  const [form_open, set_form_open] = useState(false);
  const [form_data, set_form_data] = useState<Record<string, any>>({});
  const [isc_open, set_isc_open] = useState(false);
  const [isc_data, set_isc_data] = useState<Record<string, any>>({});

  const levels = ['pulcini', 'stellina_1', 'stellina_2', 'stellina_3', 'stellina_4', 'interbronzo', 'bronzo', 'interargento', 'argento', 'interoro', 'oro'];
  const selected = gare.find((g: any) => g.id === selected_id);

  const gara_fields: FormField[] = [
    { key: 'nome', label: t('nome'), required: true },
    { key: 'data', label: t('data'), type: 'date', required: true },
    { key: 'ora', label: t('ora_inizio'), type: 'time' },
    { key: 'club_ospitante', label: t('club_ospitante') },
    { key: 'indirizzo_club_ospitante', label: 'Indirizzo club ospitante' },
    { key: 'localita', label: t('luogo') },
    { key: 'livello_minimo', label: t('livello_minimo'), type: 'select', options: levels.map(l => ({ value: l, label: t(l) })) },
    { key: 'carriera', label: t('carriera'), type: 'select', options: [{ value: 'Artistica', label: 'Artistica' }, { value: 'Stile', label: 'Stile' }, { value: 'Entrambe', label: 'Entrambe' }] },
    { key: 'costo_iscrizione', label: t('costo_iscrizione'), type: 'number' },
    { key: 'costo_accompagnamento', label: t('costo_accompagnamento'), type: 'number' },
    { key: 'note', label: t('note'), type: 'textarea' },
  ];

  const isc_fields: FormField[] = [
    { key: 'atleta_id', label: t('seleziona_atleta'), type: 'select', options: atleti.map((a: any) => ({ value: a.id, label: `${a.nome} ${a.cognome}` })), required: true },
    { key: 'carriera', label: t('carriera') },
    { key: 'punteggio', label: t('punteggio'), type: 'number' },
    { key: 'voto_giudici', label: 'Voto Giudici', type: 'number' },
    { key: 'posizione', label: t('posizione'), type: 'number' },
    { key: 'medaglia', label: t('medaglia'), type: 'select', options: [{ value: '', label: '—' }, { value: 'oro', label: t('oro') }, { value: 'argento', label: t('argento') }, { value: 'bronzo', label: t('bronzo') }] },
  ];

  const open_new_gara = () => { set_form_data({ livello_minimo: 'pulcini' }); set_form_open(true); };
  const handle_submit_gara = async () => { await upsert_gara.mutateAsync(form_data); set_form_open(false); };
  const open_iscrizione = () => { set_isc_data({ gara_id: selected_id }); set_isc_open(true); };
  const handle_iscrizione = async () => { await iscrivi.mutateAsync(isc_data as any); set_isc_open(false); };

  if (isLoading) return <div className="flex items-center justify-center h-64"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" /></div>;

  if (selected) {
    return (
      <div className="space-y-6 animate-fade-in">
        <Button variant="ghost" onClick={() => set_selected_id(null)} className="text-muted-foreground"><ArrowLeft className="w-4 h-4 mr-2" /> {t('gare')}</Button>
        <div className="flex items-start gap-4">
          <div>
            <h1 className="text-xl font-bold tracking-tight text-foreground">{selected.nome}</h1>
            <div className="flex items-center gap-4 mt-2 text-sm text-muted-foreground">
              <span className="flex items-center gap-1"><Calendar className="w-3.5 h-3.5" /> {new Date(selected.data).toLocaleDateString('it-CH')}</span>
              <span className="flex items-center gap-1"><MapPin className="w-3.5 h-3.5" /> {selected.localita}</span>
            </div>
          </div>
        </div>
        <Tabs defaultValue="dettagli">
          <TabsList>
            <TabsTrigger value="dettagli">{t('dettagli')}</TabsTrigger>
            <TabsTrigger value="atleti">{t('atleti_iscritti')}</TabsTrigger>
          </TabsList>
          <TabsContent value="dettagli" className="mt-6">
            <div className="bg-card rounded-xl shadow-card p-6 space-y-3 max-w-lg">
              <InfoRow label={t('club_ospitante')} value={selected.club_ospitante} />
              <InfoRow label={t('livello_minimo')} value={t(selected.livello_minimo)} />
              <InfoRow label={t('carriera')} value={selected.carriera} />
              <InfoRow label={t('costo_iscrizione')} value={`CHF ${selected.costo_iscrizione}`} />
              <InfoRow label={t('costo_accompagnamento')} value={`CHF ${selected.costo_accompagnamento}`} />
              {selected.note && <InfoRow label={t('note')} value={selected.note} />}
            </div>
          </TabsContent>
          <TabsContent value="atleti" className="mt-6">
            <div className="mb-4">
              <Button onClick={open_iscrizione} className="bg-primary hover:bg-primary/90"><Plus className="w-4 h-4 mr-2" /> Iscrivi Atleta</Button>
            </div>
            <div className="bg-card rounded-xl shadow-card overflow-hidden">
              <table className="w-full text-sm">
                <thead><tr className="border-b border-border">
                  <th className="text-left px-4 py-3 text-xs font-bold text-muted-foreground uppercase tracking-wider">{t('nome')}</th>
                  <th className="text-right px-4 py-3 text-xs font-bold text-muted-foreground uppercase tracking-wider">{t('punteggio')}</th>
                  <th className="text-center px-4 py-3 text-xs font-bold text-muted-foreground uppercase tracking-wider">{t('posizione')}</th>
                  <th className="text-center px-4 py-3 text-xs font-bold text-muted-foreground uppercase tracking-wider">{t('medaglia')}</th>
                </tr></thead>
                <tbody>
                  {selected.atleti_iscritti.map((ai: any) => (
                    <tr key={ai.atleta_id} className="border-b border-border/50">
                      <td className="px-4 py-3 font-medium text-foreground">{get_atleta_name_from_list(atleti, ai.atleta_id)}</td>
                      <td className="px-4 py-3 text-right tabular-nums text-muted-foreground">{ai.punteggio ?? '—'}</td>
                      <td className="px-4 py-3 text-center tabular-nums text-muted-foreground">{ai.posizione ?? '—'}</td>
                      <td className="px-4 py-3 text-center">{ai.medaglia ? <MedalBadge tipo={ai.medaglia} /> : '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </TabsContent>
        </Tabs>
        <FormDialog open={isc_open} on_close={() => set_isc_open(false)} title="Iscrivi Atleta" fields={isc_fields} values={isc_data} on_change={(k, v) => set_isc_data(p => ({ ...p, [k]: v }))} on_submit={handle_iscrizione} loading={iscrivi.isPending} />
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold tracking-tight text-foreground">{t('gare')}</h1>
        <Button className="bg-primary hover:bg-primary/90" onClick={open_new_gara}><Plus className="w-4 h-4 mr-2" /> {t('nuova_gara')}</Button>
      </div>
      <div className="bg-card rounded-xl shadow-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead><tr className="border-b border-border">
              <th className="text-left px-4 py-3 text-xs font-bold text-muted-foreground uppercase tracking-wider">{t('nome')}</th>
              <th className="text-left px-4 py-3 text-xs font-bold text-muted-foreground uppercase tracking-wider">{t('data')}</th>
              <th className="text-left px-4 py-3 text-xs font-bold text-muted-foreground uppercase tracking-wider hidden sm:table-cell">{t('luogo')}</th>
              <th className="text-left px-4 py-3 text-xs font-bold text-muted-foreground uppercase tracking-wider hidden md:table-cell">{t('livello_minimo')}</th>
              <th className="text-center px-4 py-3 text-xs font-bold text-muted-foreground uppercase tracking-wider">{t('iscritti')}</th>
              <th className="text-right px-4 py-3 text-xs font-bold text-muted-foreground uppercase tracking-wider hidden lg:table-cell">{t('costo_iscrizione')}</th>
            </tr></thead>
            <tbody>
              {gare.map((g: any) => {
                const d = days_until(g.data);
                return (
                  <tr key={g.id} onClick={() => set_selected_id(g.id)} className="border-b border-border/50 hover:bg-muted/30 cursor-pointer transition-colors">
                    <td className="px-4 py-3">
                      <p className="font-medium text-foreground">{g.nome}</p>
                      {d > 0 && <p className="text-xs text-accent">{t('countdown_giorni', String(d))}</p>}
                    </td>
                    <td className="px-4 py-3 tabular-nums text-muted-foreground">{new Date(g.data).toLocaleDateString('it-CH')}</td>
                    <td className="px-4 py-3 text-muted-foreground hidden sm:table-cell">{g.localita}</td>
                    <td className="px-4 py-3 hidden md:table-cell"><Badge variant="secondary" className="text-xs">{t(g.livello_minimo)}</Badge></td>
                    <td className="px-4 py-3 text-center tabular-nums font-medium text-foreground">{g.atleti_iscritti.length}</td>
                    <td className="px-4 py-3 text-right tabular-nums text-muted-foreground hidden lg:table-cell">CHF {g.costo_iscrizione}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
      <FormDialog open={form_open} on_close={() => set_form_open(false)} title={t('nuova_gara')} fields={gara_fields} values={form_data} on_change={(k, v) => set_form_data(p => ({ ...p, [k]: v }))} on_submit={handle_submit_gara} loading={upsert_gara.isPending} />
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
  const colors: Record<string, string> = { oro: 'bg-yellow-100 text-yellow-700', argento: 'bg-slate-100 text-slate-600', bronzo: 'bg-orange-100 text-orange-700' };
  return <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${colors[tipo] || ''}`}>{tipo}</span>;
};

export default CompetitionsPage;
