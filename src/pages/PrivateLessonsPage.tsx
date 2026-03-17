import React from 'react';
import { useI18n } from '@/lib/i18n';
import { use_lezioni_private, use_istruttori, use_atleti, get_istruttore_name_from_list, get_atleta_name_from_list } from '@/hooks/use-supabase-data';
import { Button } from '@/components/ui/button';
import { Plus } from 'lucide-react';

const HOURS = Array.from({ length: 11 }, (_, i) => `${(8 + i).toString().padStart(2, '0')}:00`);
const DAYS = ['lunedi', 'martedi', 'mercoledi', 'giovedi', 'venerdi', 'sabato'];

const PrivateLessonsPage: React.FC = () => {
  const { t } = useI18n();
  const { data: lezioni = [], isLoading } = use_lezioni_private();
  const { data: istruttori = [] } = use_istruttori();
  const { data: atleti = [] } = use_atleti();

  const get_cell_status = (day: string, hour: string) => {
    const lesson = lezioni.find((l: any) => {
      const lesson_day = new Date(l.data).getDay();
      const day_map: Record<string, number> = { lunedi: 1, martedi: 2, mercoledi: 3, giovedi: 4, venerdi: 5, sabato: 6 };
      return day_map[day] === lesson_day && l.ora_inizio === hour;
    });
    if (lesson) return { status: 'occupato' as const, lesson };

    const available = istruttori.some((i: any) =>
      i.disponibilita[day]?.some((s: any) => s.ora_inizio <= hour && s.ora_fine > hour)
    );
    return { status: available ? 'libero' as const : 'non_disponibile' as const, lesson: null };
  };

  if (isLoading) {
    return <div className="flex items-center justify-center h-64"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" /></div>;
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold tracking-tight text-foreground">{t('lezioni_private')}</h1>
        <Button className="bg-primary hover:bg-primary/90"><Plus className="w-4 h-4 mr-2" /> {t('prenota_lezione')}</Button>
      </div>

      <div className="bg-card rounded-xl shadow-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border">
                <th className="text-left px-3 py-3 text-xs font-bold text-muted-foreground uppercase tracking-wider w-20"></th>
                {DAYS.map(d => (
                  <th key={d} className="text-center px-2 py-3 text-xs font-bold text-muted-foreground uppercase tracking-wider">{t(d).slice(0, 3)}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {HOURS.map(h => (
                <tr key={h} className="border-b border-border/30">
                  <td className="px-3 py-1 text-xs tabular-nums text-muted-foreground font-medium">{h}</td>
                  {DAYS.map(d => {
                    const { status, lesson } = get_cell_status(d, h);
                    const colors = {
                      libero: 'bg-success/10 hover:bg-success/20 cursor-pointer',
                      occupato: 'bg-accent/10',
                      non_disponibile: 'bg-muted/50',
                    };
                    return (
                      <td key={d} className="px-1 py-1">
                        <div className={`rounded-md h-10 flex items-center justify-center text-xs transition-colors ${colors[status]}`}>
                          {status === 'occupato' && lesson && (
                            <span className="text-accent font-medium truncate px-1">{get_istruttore_name_from_list(istruttori, lesson.istruttore_id).split(' ')[0]}</span>
                          )}
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
                  <td className="px-4 py-3 text-right tabular-nums font-medium text-foreground">€{l.costo}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default PrivateLessonsPage;
