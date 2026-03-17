import React, { useState } from 'react';
import { useI18n } from '@/lib/i18n';
import { use_comunicazioni, use_corsi } from '@/hooks/use-supabase-data';
import { use_crea_comunicazione } from '@/hooks/use-supabase-mutations';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Plus, MessageSquare } from 'lucide-react';
import FormDialog, { FormField } from '@/components/forms/FormDialog';

const CommunicationsPage: React.FC = () => {
  const { t } = useI18n();
  const { data: comunicazioni = [], isLoading } = use_comunicazioni();
  const { data: corsi = [] } = use_corsi();
  const crea = use_crea_comunicazione();
  const [form_open, set_form_open] = useState(false);
  const [form_data, set_form_data] = useState<Record<string, any>>({});

  const fields: FormField[] = [
    { key: 'titolo', label: t('titolo'), required: true },
    { key: 'testo', label: t('testo'), type: 'textarea', required: true },
    { key: 'tipo_destinatari', label: t('destinatari'), type: 'select', options: [
      { value: 'tutti', label: t('tutti') },
      { value: 'per_corso', label: t('per_corso') },
      { value: 'solo_istruttori', label: t('solo_istruttori') },
    ]},
    ...(form_data.tipo_destinatari === 'per_corso' ? [{
      key: 'corso_id', label: t('corsi'), type: 'select' as const, options: corsi.map((c: any) => ({ value: c.id, label: c.nome })),
    }] : []),
  ];

  const get_destinatari_label = (c: any) => {
    if (c.tipo_destinatari === 'tutti') return t('tutti');
    if (c.tipo_destinatari === 'solo_istruttori') return t('solo_istruttori');
    if (c.tipo_destinatari === 'per_corso') {
      const corso = corsi.find((co: any) => co.id === c.corso_id);
      return corso ? corso.nome : t('per_corso');
    }
    return t('per_atleta');
  };

  const open_new = () => { set_form_data({ tipo_destinatari: 'tutti' }); set_form_open(true); };
  const handle_submit = async () => { await crea.mutateAsync(form_data); set_form_open(false); };

  if (isLoading) return <div className="flex items-center justify-center h-64"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" /></div>;

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold tracking-tight text-foreground">{t('comunicazioni')}</h1>
        <Button className="bg-primary hover:bg-primary/90" onClick={open_new}><Plus className="w-4 h-4 mr-2" /> {t('nuova_comunicazione')}</Button>
      </div>
      <div className="space-y-4">
        {comunicazioni.map((c: any) => (
          <div key={c.id} className="bg-card rounded-xl shadow-card p-5 hover:shadow-card-hover transition-shadow">
            <div className="flex items-start justify-between gap-4">
              <div className="flex gap-3">
                <MessageSquare className="w-5 h-5 text-accent shrink-0 mt-0.5" />
                <div>
                  <h3 className="font-semibold text-foreground">{c.titolo}</h3>
                  <p className="text-sm text-muted-foreground mt-1 line-clamp-2">{c.testo}</p>
                </div>
              </div>
              <div className="text-right shrink-0">
                <p className="text-xs tabular-nums text-muted-foreground">{c.data ? new Date(c.data + 'T00:00:00').toLocaleDateString('it-CH') : ''}</p>
                <Badge variant="secondary" className="text-xs mt-1">{get_destinatari_label(c)}</Badge>
              </div>
            </div>
          </div>
        ))}
      </div>
      <FormDialog open={form_open} on_close={() => set_form_open(false)} title={t('nuova_comunicazione')} fields={fields} values={form_data} on_change={(k, v) => set_form_data(p => ({ ...p, [k]: v }))} on_submit={handle_submit} loading={crea.isPending} />
    </div>
  );
};

export default CommunicationsPage;
