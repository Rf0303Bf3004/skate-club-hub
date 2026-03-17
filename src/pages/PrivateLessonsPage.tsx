import React, { useState } from 'react';
import { useI18n } from '@/lib/i18n';
import { use_lezioni_private, use_istruttori, use_atleti, get_istruttore_name_from_list, get_atleta_name_from_list } from '@/hooks/use-supabase-data';
import { use_crea_lezione_privata } from '@/hooks/use-supabase-mutations';
import { Button } from '@/components/ui/button';
import { Plus } from 'lucide-react';
import FormDialog, { FormField } from '@/components/forms/FormDialog';

const SLOTS = Array.from({ length: 33 }, (_, i) => {
  const total_min = 8 * 60 + i * 20;
  const h = Math.floor(total_min / 60).toString().padStart(2, '0');
  const m = (total_min % 60).toString().padStart(2, '0');
  return `${h}:${m}`;
});
const DAYS = ['lunedi', 'martedi', 'mercoledi', 'giovedi', 'venerdi', 'sabato'];

const PrivateLessonsPage: React.FC = () => {
  const { t } = useI18n();
  const { data: lezioni = [], isLoading } = use_lezioni_private();
  const { data: istruttori = [] } = use_istruttori();
  const { data: atleti = [] } = use_atleti();
  const crea = use_crea_lezione_privata();
  const [form_open, set_form_open] = useState(false);
  const [form_data, set_form_data] = useState<Record<string, any>>({});

  const fields: FormField[] = [
    { key: 'istruttore_id', label: t('seleziona_istruttore'), type: 'select', options: istruttori.filter((i: any) => i.stato === 'attivo').map((i: any) => ({ value: i.id, label: `${i.nome} ${i.cognome}` })), required: true },
    { key: 'atleti_ids', label: t('seleziona_atleta'), type: 'multi-select', options: atleti.map((a: any) => ({ value: a.id, label: `${a.nome} ${a.cognome}` })) },
    { key: 'data', label: t('data'), type: 'date', required: true },
    { key: 'ora_inizio', label: t('ora_inizio'), type: 'time' },
    { key: 'ora_fine', label: t('ora_fine'), type: 'time' },
    { key: 'durata_minuti', label: t('durata'), type: 'number', placeholder: '20' },
    { key: 'costo_totale', label: t('importo'), type: 'number' },
    { key: 'ricorrente', label: t('ricorrente'), type: 'checkbox' },
    { key: 'note', label: t('note'), type: 'textarea' },
  ];

  const day_map: Record<string, number> = { lunedi: 1, martedi: 2, mercoledi: 3, giovedi: 4, venerdi: 5, sabato: 6 };

  const get_cell_status = (day: string, slot: string) => {
    const lesson = lezioni.find((l: any) => {
      const ld = new Date(l.data).getDay();
      return day_map[day] === ld && l.ora_inizio <= slot && l.ora_fine > slot;
    });
    if (lesson) return { status: 'occupato' as const, lesson };
    const available = istruttori.some((i: any) => i.disponibilita[day]?.some((s: any) => s.ora_inizio <= slot && s.ora_fine > slot));
    return { status: available ? 'libero' as const : 'non_disponibile' as const, lesson: null };
  };

  const open_slot = (day: string, slot: string) => {
    const next_date = get_next_date(day);
    const end_min = parseInt(slot.split(':')[0]) * 60 + parseInt(slot.split(':')[1]) + 20;
    const end = `${Math.floor(end_min / 60).toString().padStart(2, '0')}:${(end_min % 60).toString().padStart(2, '0')}`;
    set_form_data({ data: next_date, ora_inizio: slot, ora_fine: end, durata_minuti: 20, atleti_ids: [] });
    set_form_open(true);
  };

  const open_new = () => { set_form_data({ durata_minuti: 20, atleti_ids: [] }); set_form_open(true); };
  const handle_submit = async () => { await crea.mutateAsync(form_data); set_form_open(false); };

  if (isLoading) return <div className="flex items-center justify-center h-64"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" /></div>;

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold tracking-tight text-foreground">{t('lezioni_private')}</h1>
        <Button className="bg-primary hover:bg-primary/90" onClick={open_new}><Plus className="w-4 h-4 mr-2" /> {t('prenota_lezione')}</Button>
      </div>

      <div className="bg-card rounded-xl shadow-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border">
                <th className="text-left px-3 py-3 text-xs font-bold text-muted-foreground uppercase tracking-wider w-20"></th>
                {DAYS.map(d => <th key={d} className="text-center px-2 py-3 text-xs font-bold text-muted-foreground uppercase tracking-wider">{t(d).slice(0, 3)}</th>)}
              </tr>
            </thead>
            <tbody>
              {SLOTS.map(slot => (
                <tr key={slot} className="border-b border-border/30">
                  <td className="px-3 py-0.5 text-[10px] tabular-nums text-muted-foreground font-medium">{slot}</td>
                  {DAYS.map(d => {
                    const { status, lesson } = get_cell_status(d, slot);
                    const colors = {
                      libero: 'bg-success/10 hover:bg-success/20 cursor-pointer',
                      occupato: 'bg-accent/10',
                      non_disponibile: 'bg-muted/50',
                    };
                    return (
                      <td key={d} className="px-1 py-0.5">
                        <div
                          onClick={() => status === 'libero' && open_slot(d, slot)}
                          className={`rounded-md h-7 flex items-center justify-center text-xs transition-colors ${colors[status]}`}
                        >
                          {status === 'occupato' && lesson && <span className="text-accent font-medium truncate px-1">{get_istruttore_name_from_list(istruttori, lesson.istruttore_id).split(' ')[0]}</span>}
                          {status === 'libero' && <span className="text-success/60">+</span>}
                        </div>
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="flex items-center gap-6 text-xs text-muted-foreground">
        <div className="flex items-center gap-2"><div className="w-3 h-3 rounded-sm bg-success/20" /> {t('libero')}</div>
        <div className="flex items-center gap-2"><div className="w-3 h-3 rounded-sm bg-accent/20" /> {t('occupato')}</div>
        <div className="flex items-center gap-2"><div className="w-3 h-3 rounded-sm bg-muted" /> {t('non_disponibile')}</div>
      </div>

      <div>
        <h2 className="text-sm font-bold text-muted-foreground uppercase tracking-widest mb-4">{t('lezioni')}</h2>
        <div className="bg-card rounded-xl shadow-card overflow-hidden">
          <table className="w-full text-sm">
            <thead><tr className="border-b border-border">
              <th className="text-left px-4 py-3 text-xs font-bold text-muted-foreground uppercase tracking-wider">{t('data')}</th>
              <th className="text-left px-4 py-3 text-xs font-bold text-muted-foreground uppercase tracking-wider">{t('istruttori')}</th>
              <th className="text-left px-4 py-3 text-xs font-bold text-muted-foreground uppercase tracking-wider hidden sm:table-cell">{t('atleti')}</th>
              <th className="text-left px-4 py-3 text-xs font-bold text-muted-foreground uppercase tracking-wider">{t('ora_inizio')}</th>
              <th className="text-right px-4 py-3 text-xs font-bold text-muted-foreground uppercase tracking-wider">{t('importo')}</th>
            </tr></thead>
            <tbody>
              {lezioni.map((l: any) => (
                <tr key={l.id} className="border-b border-border/50">
                  <td className="px-4 py-3 text-muted-foreground">{new Date(l.data).toLocaleDateString('it-CH')}</td>
                  <td className="px-4 py-3 font-medium text-foreground">{get_istruttore_name_from_list(istruttori, l.istruttore_id)}</td>
                  <td className="px-4 py-3 text-muted-foreground hidden sm:table-cell">{l.atleti_ids.map((id: string) => get_atleta_name_from_list(atleti, id)).join(', ')}</td>
                  <td className="px-4 py-3 tabular-nums text-muted-foreground">{l.ora_inizio}-{l.ora_fine}</td>
                  <td className="px-4 py-3 text-right tabular-nums font-medium text-foreground">CHF {l.costo}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <FormDialog open={form_open} on_close={() => set_form_open(false)} title={t('prenota_lezione')} fields={fields} values={form_data} on_change={(k, v) => set_form_data(p => ({ ...p, [k]: v }))} on_submit={handle_submit} loading={crea.isPending} />
    </div>
  );
};

function get_next_date(day: string): string {
  const map: Record<string, number> = { lunedi: 1, martedi: 2, mercoledi: 3, giovedi: 4, venerdi: 5, sabato: 6 };
  const target = map[day];
  const d = new Date();
  const diff = (target - d.getDay() + 7) % 7;
  d.setDate(d.getDate() + (diff === 0 ? 7 : diff));
  return d.toISOString().split('T')[0];
}

export default PrivateLessonsPage;
