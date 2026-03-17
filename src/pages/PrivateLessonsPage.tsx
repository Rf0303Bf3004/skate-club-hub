import React, { useState, useMemo } from 'react';
import { useI18n } from '@/lib/i18n';
import { use_lezioni_private, use_istruttori, use_atleti, use_corsi, get_atleta_name_from_list } from '@/hooks/use-supabase-data';
import { use_crea_lezione_privata, use_annulla_lezione } from '@/hooks/use-supabase-mutations';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ChevronLeft, ChevronRight, X } from 'lucide-react';
import FormDialog, { FormField } from '@/components/forms/FormDialog';

const GIORNI_SETTIMANA = ['Lunedì', 'Martedì', 'Mercoledì', 'Giovedì', 'Venerdì', 'Sabato', 'Domenica'];

function get_week_start(d: Date): Date {
  const day = d.getDay();
  const diff = (day === 0 ? -6 : 1) - day;
  const mon = new Date(d);
  mon.setDate(d.getDate() + diff);
  mon.setHours(0, 0, 0, 0);
  return mon;
}

function format_date(d: Date): string {
  return d.toISOString().split('T')[0];
}

function time_to_minutes(t: string): number {
  const [h, m] = t.split(':').map(Number);
  return h * 60 + (m || 0);
}

function minutes_to_time(m: number): string {
  return `${Math.floor(m / 60).toString().padStart(2, '0')}:${(m % 60).toString().padStart(2, '0')}`;
}

/** Subtract intervals b from intervals a, returning remaining intervals */
function subtract_intervals(
  avail: { start: number; end: number }[],
  busy: { start: number; end: number }[]
): { start: number; end: number }[] {
  let result = [...avail];
  for (const b of busy) {
    const next: { start: number; end: number }[] = [];
    for (const a of result) {
      if (b.end <= a.start || b.start >= a.end) {
        next.push(a); // no overlap
      } else {
        if (a.start < b.start) next.push({ start: a.start, end: b.start });
        if (a.end > b.end) next.push({ start: b.end, end: a.end });
      }
    }
    result = next;
  }
  return result;
}

const PrivateLessonsPage: React.FC = () => {
  const { t } = useI18n();
  const { data: lezioni = [], isLoading } = use_lezioni_private();
  const { data: istruttori = [] } = use_istruttori();
  const { data: atleti = [] } = use_atleti();
  const { data: corsi = [] } = use_corsi();
  const crea = use_crea_lezione_privata();
  const annulla = use_annulla_lezione();
  const [selected_istruttore, set_selected_istruttore] = useState<string>('');
  const [week_offset, set_week_offset] = useState(0);
  const [form_open, set_form_open] = useState(false);
  const [form_data, set_form_data] = useState<Record<string, any>>({});

  const week_start = useMemo(() => {
    const d = get_week_start(new Date());
    d.setDate(d.getDate() + week_offset * 7);
    return d;
  }, [week_offset]);

  const week_dates = useMemo(() => {
    return GIORNI_SETTIMANA.map((_, i) => {
      const d = new Date(week_start);
      d.setDate(d.getDate() + i);
      return d;
    });
  }, [week_start]);

  const istruttore = istruttori.find((i: any) => i.id === selected_istruttore);

  React.useEffect(() => {
    if (!selected_istruttore && istruttori.length > 0) {
      set_selected_istruttore(istruttori[0].id);
    }
  }, [istruttori, selected_istruttore]);

  // Get course hours for the selected instructor per day of week
  const corso_busy_by_day = useMemo(() => {
    if (!selected_istruttore) return {};
    const result: Record<string, { start: number; end: number }[]> = {};
    for (const c of corsi) {
      if (!c.istruttori_ids?.includes(selected_istruttore)) continue;
      if (c.stato !== 'attivo') continue;
      const giorno = c.giorno;
      if (!giorno) continue;
      if (!result[giorno]) result[giorno] = [];
      const start = time_to_minutes(c.ora_inizio || '00:00');
      const end = time_to_minutes(c.ora_fine || '00:00');
      if (end > start) result[giorno].push({ start, end });
    }
    return result;
  }, [corsi, selected_istruttore]);

  // Build slots for selected instructor
  const day_slots = useMemo(() => {
    if (!istruttore) return {};
    const result: Record<number, { time: string; end_time: string; date: string; status: 'libero' | 'occupato'; lesson?: any }[]> = {};

    week_dates.forEach((date, dayIdx) => {
      const giorno = GIORNI_SETTIMANA[dayIdx];
      const disp_slots = istruttore.disponibilita?.[giorno] || [];
      const date_str = format_date(date);
      const slots: typeof result[0] = [];

      // Convert disponibilità to intervals
      const avail_intervals = disp_slots.map((ds: any) => ({
        start: time_to_minutes(ds.ora_inizio),
        end: time_to_minutes(ds.ora_fine),
      }));

      // Subtract course hours
      const busy = corso_busy_by_day[giorno] || [];
      const free_intervals = subtract_intervals(avail_intervals, busy);

      // Generate 20-min slots from free intervals
      const free_slot_times = new Set<number>();
      for (const interval of free_intervals) {
        for (let m = interval.start; m + 20 <= interval.end; m += 20) {
          free_slot_times.add(m);
        }
      }

      // Also find booked lessons for this instructor on this date
      const day_lessons = lezioni.filter((l: any) =>
        l.istruttore_id === selected_istruttore &&
        l.data === date_str &&
        !l.annullata
      );

      // Add booked lesson slots
      const all_slot_times = new Set(free_slot_times);
      for (const l of day_lessons) {
        const ls = time_to_minutes(l.ora_inizio);
        all_slot_times.add(ls);
      }

      // Sort and build
      const sorted = Array.from(all_slot_times).sort((a, b) => a - b);
      for (const m of sorted) {
        const time = minutes_to_time(m);
        const lesson = day_lessons.find((l: any) => time_to_minutes(l.ora_inizio) === m);
        slots.push({
          time,
          end_time: minutes_to_time(m + 20),
          date: date_str,
          status: lesson ? 'occupato' : 'libero',
          lesson,
        });
      }

      result[dayIdx] = slots;
    });
    return result;
  }, [istruttore, week_dates, lezioni, selected_istruttore, corso_busy_by_day]);

  const fields: FormField[] = [
    { key: 'atleti_ids', label: t('seleziona_atleta'), type: 'multi-select', options: atleti.map((a: any) => ({ value: a.id, label: `${a.nome} ${a.cognome}` })) },
    { key: 'ricorrente', label: t('ricorrente'), type: 'checkbox' },
    { key: 'note', label: t('note'), type: 'textarea' },
  ];

  const open_slot = (date: string, time: string) => {
    const end_min = time_to_minutes(time) + 20;
    set_form_data({
      istruttore_id: selected_istruttore,
      data: date,
      ora_inizio: time,
      ora_fine: minutes_to_time(end_min),
      durata_minuti: 20,
      atleti_ids: [],
      ricorrente: false,
      costo_totale: (istruttore?.costo_minuto || 0) * 20,
    });
    set_form_open(true);
  };

  const handle_submit = async () => {
    try {
      await crea.mutateAsync(form_data);
      set_form_open(false);
    } catch (error) {
      console.error('Errore salvataggio lezione privata', error);
    }
  };

  const week_lessons = useMemo(() => {
    const start_str = format_date(week_start);
    const end = new Date(week_start);
    end.setDate(end.getDate() + 6);
    const end_str = format_date(end);
    return lezioni.filter((l: any) =>
      l.istruttore_id === selected_istruttore &&
      l.data >= start_str &&
      l.data <= end_str &&
      !l.annullata
    );
  }, [lezioni, selected_istruttore, week_start]);

  if (isLoading) return <div className="flex items-center justify-center h-64"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" /></div>;

  const week_label = `${week_dates[0].toLocaleDateString('it-CH', { day: 'numeric', month: 'short' })} — ${week_dates[6].toLocaleDateString('it-CH', { day: 'numeric', month: 'short', year: 'numeric' })}`;

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold tracking-tight text-foreground">{t('lezioni_private')}</h1>
      </div>

      <div className="flex flex-wrap items-center gap-4">
        <div className="w-64">
          <Select value={selected_istruttore} onValueChange={set_selected_istruttore}>
            <SelectTrigger><SelectValue placeholder="Seleziona istruttore" /></SelectTrigger>
            <SelectContent>
              {istruttori.filter((i: any) => i.stato === 'attivo').map((i: any) => (
                <SelectItem key={i.id} value={i.id}>{i.nome} {i.cognome}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="icon" onClick={() => set_week_offset(w => w - 1)}><ChevronLeft className="w-4 h-4" /></Button>
          <span className="text-sm font-medium text-foreground min-w-[200px] text-center">{week_label}</span>
          <Button variant="outline" size="icon" onClick={() => set_week_offset(w => w + 1)}><ChevronRight className="w-4 h-4" /></Button>
          <Button variant="ghost" size="sm" onClick={() => set_week_offset(0)}>Oggi</Button>
        </div>
      </div>

      {istruttore ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-7 gap-3">
          {GIORNI_SETTIMANA.map((giorno, dayIdx) => {
            const slots = day_slots[dayIdx] || [];
            const date = week_dates[dayIdx];
            const is_today = format_date(date) === format_date(new Date());
            return (
              <div key={giorno} className={`bg-card rounded-xl shadow-card overflow-hidden ${is_today ? 'ring-2 ring-primary' : ''}`}>
                <div className="px-3 py-2 border-b border-border bg-muted/30">
                  <p className="text-xs font-bold text-muted-foreground uppercase">{giorno.slice(0, 3)}</p>
                  <p className="text-sm font-medium text-foreground">{date.getDate()}/{date.getMonth() + 1}</p>
                </div>
                <div className="p-1.5 space-y-1">
                  {slots.length === 0 && <p className="text-[10px] text-muted-foreground p-2 text-center">Non disponibile</p>}
                  {slots.map((slot, i) => (
                    <div
                      key={i}
                      onClick={() => slot.status === 'libero' && open_slot(slot.date, slot.time)}
                      className={`rounded-md px-2 py-1.5 text-xs transition-colors ${
                        slot.status === 'libero'
                          ? 'bg-success/10 hover:bg-success/20 cursor-pointer text-success'
                          : 'bg-accent/10 text-accent'
                      }`}
                    >
                      <span className="font-medium tabular-nums">{slot.time}</span>
                      {slot.status === 'occupato' && slot.lesson && (
                        <span className="ml-1 text-accent font-medium truncate">
                          {slot.lesson.atleti_ids?.map((id: string) => get_atleta_name_from_list(atleti, id).split(' ')[0]).join(', ') || '•'}
                        </span>
                      )}
                      {slot.status === 'libero' && <span className="ml-1">+</span>}
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="bg-card rounded-xl shadow-card p-8 text-center text-muted-foreground">Seleziona un istruttore</div>
      )}

      <div className="flex items-center gap-6 text-xs text-muted-foreground">
        <div className="flex items-center gap-2"><div className="w-3 h-3 rounded-sm bg-success/20" /> Libero</div>
        <div className="flex items-center gap-2"><div className="w-3 h-3 rounded-sm bg-accent/20" /> Occupato</div>
      </div>

      {week_lessons.length > 0 && (
        <div>
          <h2 className="text-sm font-bold text-muted-foreground uppercase tracking-widest mb-4">{t('lezioni')} della settimana</h2>
          <div className="bg-card rounded-xl shadow-card overflow-hidden">
            <table className="w-full text-sm">
              <thead><tr className="border-b border-border">
                <th className="text-left px-4 py-3 text-xs font-bold text-muted-foreground uppercase tracking-wider">{t('data')}</th>
                <th className="text-left px-4 py-3 text-xs font-bold text-muted-foreground uppercase tracking-wider">{t('ora_inizio')}</th>
                <th className="text-left px-4 py-3 text-xs font-bold text-muted-foreground uppercase tracking-wider hidden sm:table-cell">{t('atleti')}</th>
                <th className="text-right px-4 py-3 text-xs font-bold text-muted-foreground uppercase tracking-wider">CHF</th>
                <th className="text-center px-4 py-3 text-xs font-bold text-muted-foreground uppercase tracking-wider">{t('azioni')}</th>
              </tr></thead>
              <tbody>
                {week_lessons.map((l: any) => (
                  <tr key={l.id} className="border-b border-border/50">
                    <td className="px-4 py-3 text-muted-foreground">{new Date(l.data).toLocaleDateString('it-CH')}</td>
                    <td className="px-4 py-3 tabular-nums text-muted-foreground">{l.ora_inizio?.slice(0,5)}–{l.ora_fine?.slice(0,5)}</td>
                    <td className="px-4 py-3 text-muted-foreground hidden sm:table-cell">{l.atleti_ids?.map((id: string) => get_atleta_name_from_list(atleti, id)).join(', ') || '—'}</td>
                    <td className="px-4 py-3 text-right tabular-nums font-medium text-foreground">CHF {l.costo}</td>
                    <td className="px-4 py-3 text-center">
                      <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-destructive" onClick={() => annulla.mutateAsync(l.id)}>
                        <X className="w-3.5 h-3.5" />
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <FormDialog
        open={form_open}
        on_close={() => set_form_open(false)}
        title={`Prenota ${form_data.ora_inizio || ''} — ${form_data.data ? new Date(form_data.data).toLocaleDateString('it-CH') : ''}`}
        fields={fields}
        values={form_data}
        on_change={(k, v) => set_form_data(p => ({ ...p, [k]: v }))}
        on_submit={handle_submit}
        loading={crea.isPending}
      />
    </div>
  );
};

export default PrivateLessonsPage;
