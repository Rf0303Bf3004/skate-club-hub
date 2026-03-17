import React from 'react';
import { useI18n } from '@/lib/i18n';
import { mock_corsi, get_istruttore_name } from '@/lib/mock-data';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Plus } from 'lucide-react';

const CoursesPage: React.FC = () => {
  const { t } = useI18n();

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold tracking-tight text-foreground">{t('corsi')}</h1>
        <Button className="bg-primary hover:bg-primary/90"><Plus className="w-4 h-4 mr-2" /> {t('nuovo_corso')}</Button>
      </div>
      <div className="bg-card rounded-xl shadow-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border">
                <th className="text-left px-4 py-3 text-xs font-bold text-muted-foreground uppercase tracking-wider">{t('nome')}</th>
                <th className="text-left px-4 py-3 text-xs font-bold text-muted-foreground uppercase tracking-wider">{t('tipo')}</th>
                <th className="text-left px-4 py-3 text-xs font-bold text-muted-foreground uppercase tracking-wider hidden sm:table-cell">{t('giorno')}</th>
                <th className="text-left px-4 py-3 text-xs font-bold text-muted-foreground uppercase tracking-wider hidden sm:table-cell">{t('ora_inizio')}</th>
                <th className="text-left px-4 py-3 text-xs font-bold text-muted-foreground uppercase tracking-wider hidden md:table-cell">{t('istruttori')}</th>
                <th className="text-center px-4 py-3 text-xs font-bold text-muted-foreground uppercase tracking-wider">{t('iscritti')}</th>
                <th className="text-right px-4 py-3 text-xs font-bold text-muted-foreground uppercase tracking-wider hidden lg:table-cell">{t('costo_mensile')}</th>
                <th className="text-center px-4 py-3 text-xs font-bold text-muted-foreground uppercase tracking-wider">{t('stato')}</th>
              </tr>
            </thead>
            <tbody>
              {mock_corsi.map(c => (
                <tr key={c.id} className="border-b border-border/50 hover:bg-muted/30 transition-colors">
                  <td className="px-4 py-3 font-medium text-foreground">{c.nome}</td>
                  <td className="px-4 py-3"><Badge variant="secondary" className="text-xs capitalize">{c.tipo.replace('_', ' ')}</Badge></td>
                  <td className="px-4 py-3 text-muted-foreground hidden sm:table-cell">{t(c.giorno)}</td>
                  <td className="px-4 py-3 tabular-nums text-muted-foreground hidden sm:table-cell">{c.ora_inizio} - {c.ora_fine}</td>
                  <td className="px-4 py-3 text-muted-foreground hidden md:table-cell">{c.istruttori_ids.map(id => get_istruttore_name(id)).join(', ')}</td>
                  <td className="px-4 py-3 text-center tabular-nums font-medium text-foreground">{c.atleti_ids.length}</td>
                  <td className="px-4 py-3 text-right tabular-nums text-muted-foreground hidden lg:table-cell">€{c.costo_mensile}</td>
                  <td className="px-4 py-3 text-center"><span className={`inline-block w-2 h-2 rounded-full ${c.stato === 'attivo' ? 'bg-success' : 'bg-muted-foreground'}`} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default CoursesPage;
