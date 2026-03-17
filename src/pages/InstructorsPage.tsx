import React, { useState } from 'react';
import { useI18n } from '@/lib/i18n';
import { use_istruttori } from '@/hooks/use-supabase-data';
import { use_upsert_istruttore } from '@/hooks/use-supabase-mutations';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Plus } from 'lucide-react';
import FormDialog, { FormField } from '@/components/forms/FormDialog';

const InstructorsPage: React.FC = () => {
  const { t } = useI18n();
  const { data: istruttori = [], isLoading } = use_istruttori();
  const upsert = use_upsert_istruttore();
  const days = ['lunedi', 'martedi', 'mercoledi', 'giovedi', 'venerdi', 'sabato', 'domenica'];
  const [form_open, set_form_open] = useState(false);
  const [form_data, set_form_data] = useState<Record<string, any>>({});

  const fields: FormField[] = [
    { key: 'nome', label: t('nome'), required: true },
    { key: 'cognome', label: t('cognome'), required: true },
    { key: 'email', label: t('email'), type: 'email' },
    { key: 'telefono', label: t('telefono') },
    { key: 'costo_minuto_lezione_privata', label: t('costo_minuto'), type: 'number' },
    { key: 'attivo', label: t('attivo'), type: 'checkbox' },
    { key: 'note', label: t('note'), type: 'textarea' },
  ];

  const open_new = () => { set_form_data({ attivo: true }); set_form_open(true); };
  const open_edit = (i: any) => {
    set_form_data({ id: i.id, nome: i.nome, cognome: i.cognome, email: i.email, telefono: i.telefono, costo_minuto_lezione_privata: i.costo_minuto, attivo: i.stato === 'attivo', note: i.note });
    set_form_open(true);
  };
  const handle_submit = async () => { await upsert.mutateAsync(form_data); set_form_open(false); };

  if (isLoading) return <div className="flex items-center justify-center h-64"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" /></div>;

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold tracking-tight text-foreground">{t('istruttori')}</h1>
        <Button className="bg-primary hover:bg-primary/90" onClick={open_new}><Plus className="w-4 h-4 mr-2" /> {t('nuovo_istruttore')}</Button>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {istruttori.map((i: any) => (
          <div key={i.id} onClick={() => open_edit(i)} className="bg-card rounded-xl shadow-card p-5 hover:shadow-card-hover transition-shadow cursor-pointer">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-11 h-11 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold">{i.nome[0]}{i.cognome[0]}</div>
              <div>
                <p className="font-semibold text-foreground">{i.nome} {i.cognome}</p>
                <p className="text-xs text-muted-foreground">{i.email}</p>
              </div>
              <span className={`ml-auto inline-block w-2 h-2 rounded-full ${i.stato === 'attivo' ? 'bg-success' : 'bg-muted-foreground'}`} />
            </div>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between"><span className="text-muted-foreground">{t('telefono')}</span><span className="text-foreground">{i.telefono}</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">{t('costo_minuto')}</span><span className="text-foreground tabular-nums">CHF {i.costo_minuto.toFixed(2)}</span></div>
            </div>
            <div className="mt-4">
              <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-2">{t('disponibilita')}</p>
              <div className="flex flex-wrap gap-1">
                {days.map(d => (
                  <Badge key={d} variant={i.disponibilita[d] ? 'default' : 'secondary'} className="text-[10px] px-1.5">{t(d).slice(0, 3)}</Badge>
                ))}
              </div>
            </div>
          </div>
        ))}
      </div>
      <FormDialog open={form_open} on_close={() => set_form_open(false)} title={form_data.id ? t('modifica') : t('nuovo_istruttore')} fields={fields} values={form_data} on_change={(k, v) => set_form_data(p => ({ ...p, [k]: v }))} on_submit={handle_submit} loading={upsert.isPending} />
    </div>
  );
};

export default InstructorsPage;
