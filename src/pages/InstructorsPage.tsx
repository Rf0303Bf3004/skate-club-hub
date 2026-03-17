import React, { useState } from 'react';
import { useI18n } from '@/lib/i18n';
import { use_istruttori } from '@/hooks/use-supabase-data';
import { use_upsert_istruttore, use_save_disponibilita } from '@/hooks/use-supabase-mutations';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Plus, Trash2, ArrowLeft } from 'lucide-react';
import FormDialog, { FormField } from '@/components/forms/FormDialog';

const GIORNI = ['Lunedì', 'Martedì', 'Mercoledì', 'Giovedì', 'Venerdì', 'Sabato', 'Domenica'];

const InstructorsPage: React.FC = () => {
  const { t } = useI18n();
  const { data: istruttori = [], isLoading } = use_istruttori();
  const upsert = use_upsert_istruttore();
  const save_disp = use_save_disponibilita();
  const [form_open, set_form_open] = useState(false);
  const [form_data, set_form_data] = useState<Record<string, any>>({});
  const [selected_id, set_selected_id] = useState<string | null>(null);
  const [disp_local, set_disp_local] = useState<Record<string, { ora_inizio: string; ora_fine: string }[]>>({});

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

  const open_detail = (i: any) => {
    set_selected_id(i.id);
    set_disp_local(JSON.parse(JSON.stringify(i.disponibilita || {})));
  };

  const add_slot = (giorno: string) => {
    set_disp_local(prev => ({
      ...prev,
      [giorno]: [...(prev[giorno] || []), { ora_inizio: '14:00', ora_fine: '18:00' }],
    }));
  };

  const remove_slot = (giorno: string, idx: number) => {
    set_disp_local(prev => ({
      ...prev,
      [giorno]: (prev[giorno] || []).filter((_, i) => i !== idx),
    }));
  };

  const update_slot = (giorno: string, idx: number, field: 'ora_inizio' | 'ora_fine', value: string) => {
    set_disp_local(prev => ({
      ...prev,
      [giorno]: (prev[giorno] || []).map((s, i) => i === idx ? { ...s, [field]: value } : s),
    }));
  };

  const save_disponibilita = async () => {
    if (!selected_id) return;
    // Deduplicate slots per day
    const deduped: Record<string, { ora_inizio: string; ora_fine: string }[]> = {};
    for (const [giorno, slots] of Object.entries(disp_local)) {
      const seen = new Set<string>();
      deduped[giorno] = [];
      for (const s of slots) {
        const key = `${s.ora_inizio}-${s.ora_fine}`;
        if (seen.has(key)) continue;
        seen.add(key);
        deduped[giorno].push(s);
      }
    }
    set_disp_local(deduped);
    await save_disp.mutateAsync({ istruttore_id: selected_id, disponibilita: deduped });
  };

  const selected = istruttori.find((i: any) => i.id === selected_id);

  if (isLoading) return <div className="flex items-center justify-center h-64"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" /></div>;

  if (selected) {
    return (
      <div className="space-y-6 animate-fade-in">
        <div className="flex items-center gap-4">
          <Button variant="ghost" onClick={() => set_selected_id(null)}><ArrowLeft className="w-4 h-4 mr-2" /> {t('istruttori')}</Button>
          <h1 className="text-xl font-bold text-foreground">{selected.nome} {selected.cognome}</h1>
          <Button variant="outline" size="sm" onClick={() => open_edit(selected)}>{t('modifica')}</Button>
        </div>

        <div className="bg-card rounded-xl shadow-card p-6 space-y-3 max-w-lg">
          <div className="flex justify-between text-sm"><span className="text-muted-foreground">{t('email')}</span><span className="text-foreground">{selected.email}</span></div>
          <div className="flex justify-between text-sm"><span className="text-muted-foreground">{t('telefono')}</span><span className="text-foreground">{selected.telefono}</span></div>
          <div className="flex justify-between text-sm"><span className="text-muted-foreground">{t('costo_minuto')}</span><span className="text-foreground tabular-nums">CHF {selected.costo_minuto.toFixed(2)}</span></div>
          <div className="flex justify-between text-sm"><span className="text-muted-foreground">{t('stato')}</span><span className={`inline-block w-2 h-2 rounded-full ${selected.stato === 'attivo' ? 'bg-success' : 'bg-muted-foreground'}`} /></div>
        </div>

        <div className="bg-card rounded-xl shadow-card p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-bold text-muted-foreground uppercase tracking-widest">{t('disponibilita')}</h2>
            <Button size="sm" onClick={save_disponibilita} disabled={save_disp.isPending}>{save_disp.isPending ? '...' : t('salva')}</Button>
          </div>
          <div className="space-y-4">
            {GIORNI.map(giorno => {
              const slots = disp_local[giorno] || [];
              return (
                <div key={giorno} className="border border-border/50 rounded-lg p-3">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-medium text-foreground">{giorno}</span>
                    <Button variant="ghost" size="sm" onClick={() => add_slot(giorno)} className="h-7 text-xs"><Plus className="w-3 h-3 mr-1" /> Slot</Button>
                  </div>
                  {slots.length === 0 && <p className="text-xs text-muted-foreground">Nessuno slot</p>}
                  {slots.map((s, idx) => (
                    <div key={idx} className="flex items-center gap-2 mb-1">
                      <Input type="time" value={s.ora_inizio} onChange={e => update_slot(giorno, idx, 'ora_inizio', e.target.value)} className="w-28 h-8 text-xs" />
                      <span className="text-muted-foreground text-xs">—</span>
                      <Input type="time" value={s.ora_fine} onChange={e => update_slot(giorno, idx, 'ora_fine', e.target.value)} className="w-28 h-8 text-xs" />
                      <Button variant="ghost" size="sm" onClick={() => remove_slot(giorno, idx)} className="h-7 w-7 p-0 text-destructive"><Trash2 className="w-3 h-3" /></Button>
                    </div>
                  ))}
                </div>
              );
            })}
          </div>
        </div>

        <FormDialog open={form_open} on_close={() => set_form_open(false)} title={form_data.id ? t('modifica') : t('nuovo_istruttore')} fields={fields} values={form_data} on_change={(k, v) => set_form_data(p => ({ ...p, [k]: v }))} on_submit={handle_submit} loading={upsert.isPending} />
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold tracking-tight text-foreground">{t('istruttori')}</h1>
        <Button className="bg-primary hover:bg-primary/90" onClick={open_new}><Plus className="w-4 h-4 mr-2" /> {t('nuovo_istruttore')}</Button>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {istruttori.map((i: any) => (
          <div key={i.id} onClick={() => open_detail(i)} className="bg-card rounded-xl shadow-card p-5 hover:shadow-card-hover transition-shadow cursor-pointer">
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
                {GIORNI.map(d => (
                  <Badge key={d} variant={i.disponibilita[d]?.length > 0 ? 'default' : 'secondary'} className="text-[10px] px-1.5">{d.slice(0, 3)}</Badge>
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
