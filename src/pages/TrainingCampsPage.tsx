import React, { useState } from 'react';
import { useI18n } from '@/lib/i18n';
import { use_campi, use_atleti, get_atleta_name_from_list } from '@/hooks/use-supabase-data';
import { use_upsert_campo, use_iscrivi_atleta_campo } from '@/hooks/use-supabase-mutations';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Plus, MapPin, Calendar } from 'lucide-react';
import FormDialog, { FormField } from '@/components/forms/FormDialog';

const TrainingCampsPage: React.FC = () => {
  const { t } = useI18n();
  const { data: campi = [], isLoading } = use_campi();
  const { data: atleti = [] } = use_atleti();
  const upsert = use_upsert_campo();
  const iscrivi = use_iscrivi_atleta_campo();
  const [form_open, set_form_open] = useState(false);
  const [form_data, set_form_data] = useState<Record<string, any>>({});
  const [isc_open, set_isc_open] = useState(false);
  const [isc_data, set_isc_data] = useState<Record<string, any>>({});

  const campo_fields: FormField[] = [
    { key: 'nome', label: t('nome'), required: true },
    { key: 'data_inizio', label: t('data_inizio'), type: 'date', required: true },
    { key: 'data_fine', label: t('data_fine'), type: 'date', required: true },
    { key: 'luogo', label: t('luogo') },
    { key: 'club_ospitante', label: t('club_ospitante') },
    { key: 'costo_diurno', label: t('costo_diurno'), type: 'number' },
    { key: 'costo_completo', label: t('costo_completo'), type: 'number' },
    { key: 'note', label: t('note'), type: 'textarea' },
  ];

  const isc_fields: FormField[] = [
    { key: 'atleta_id', label: t('seleziona_atleta'), type: 'select', options: atleti.map((a: any) => ({ value: a.id, label: `${a.nome} ${a.cognome}` })), required: true },
    { key: 'tipo', label: t('tipo'), type: 'select', options: [{ value: 'diurno', label: t('diurno') }, { value: 'completo', label: t('completo') }] },
    { key: 'costo_totale', label: t('importo'), type: 'number' },
  ];

  const open_new = () => { set_form_data({}); set_form_open(true); };
  const handle_submit = async () => { await upsert.mutateAsync(form_data); set_form_open(false); };
  const open_iscrizione = (campo_id: string) => { set_isc_data({ campo_id, tipo: 'diurno' }); set_isc_open(true); };
  const handle_iscrizione = async () => { await iscrivi.mutateAsync(isc_data as any); set_isc_open(false); };

  if (isLoading) return <div className="flex items-center justify-center h-64"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" /></div>;

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold tracking-tight text-foreground">{t('campi')}</h1>
        <Button className="bg-primary hover:bg-primary/90" onClick={open_new}><Plus className="w-4 h-4 mr-2" /> {t('nuovo_campo')}</Button>
      </div>

      {campi.map((camp: any) => (
        <div key={camp.id} className="bg-card rounded-xl shadow-card p-6 space-y-5">
          <div>
            <h2 className="text-lg font-bold text-foreground">{camp.nome}</h2>
            <div className="flex items-center gap-4 mt-1 text-sm text-muted-foreground">
              <span className="flex items-center gap-1"><Calendar className="w-3.5 h-3.5" /> {new Date(camp.data_inizio).toLocaleDateString('it-CH')} — {new Date(camp.data_fine).toLocaleDateString('it-CH')}</span>
              <span className="flex items-center gap-1"><MapPin className="w-3.5 h-3.5" /> {camp.luogo}</span>
            </div>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-sm">
            <div><span className="text-muted-foreground">{t('club_ospitante')}</span><p className="font-medium text-foreground">{camp.club_ospitante}</p></div>
            <div><span className="text-muted-foreground">{t('costo_diurno')}</span><p className="font-medium text-foreground tabular-nums">CHF {camp.costo_diurno}</p></div>
            <div><span className="text-muted-foreground">{t('costo_completo')}</span><p className="font-medium text-foreground tabular-nums">CHF {camp.costo_completo}</p></div>
            <div><span className="text-muted-foreground">{t('iscrizioni')}</span><p className="font-medium text-foreground tabular-nums">{camp.iscrizioni.length}</p></div>
          </div>
          <div>
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-xs font-bold text-muted-foreground uppercase tracking-widest">{t('iscrizioni')}</h3>
              <Button size="sm" variant="outline" onClick={() => open_iscrizione(camp.id)}><Plus className="w-3 h-3 mr-1" /> Iscrivi</Button>
            </div>
            <div className="space-y-2">
              {camp.iscrizioni.map((isc: any) => (
                <div key={isc.atleta_id} className="flex items-center justify-between p-2 rounded-lg bg-muted/30">
                  <span className="text-sm font-medium text-foreground">{get_atleta_name_from_list(atleti, isc.atleta_id)}</span>
                  <Badge variant="secondary" className="text-xs">{t(isc.tipo)}</Badge>
                </div>
              ))}
            </div>
          </div>
        </div>
      ))}

      <FormDialog open={form_open} on_close={() => set_form_open(false)} title={t('nuovo_campo')} fields={campo_fields} values={form_data} on_change={(k, v) => set_form_data(p => ({ ...p, [k]: v }))} on_submit={handle_submit} loading={upsert.isPending} />
      <FormDialog open={isc_open} on_close={() => set_isc_open(false)} title="Iscrivi Atleta" fields={isc_fields} values={isc_data} on_change={(k, v) => set_isc_data(p => ({ ...p, [k]: v }))} on_submit={handle_iscrizione} loading={iscrivi.isPending} />
    </div>
  );
};

export default TrainingCampsPage;
