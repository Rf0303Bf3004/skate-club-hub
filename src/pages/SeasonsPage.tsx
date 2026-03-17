import React from 'react';
import { useI18n } from '@/lib/i18n';
import { mock_stagioni } from '@/lib/mock-data';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Plus } from 'lucide-react';

const SeasonsPage: React.FC = () => {
  const { t } = useI18n();

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold tracking-tight text-foreground">{t('stagioni')}</h1>
        <Button className="bg-primary hover:bg-primary/90"><Plus className="w-4 h-4 mr-2" /> {t('nuova_stagione')}</Button>
      </div>
      <div className="bg-card rounded-xl shadow-card overflow-hidden">
        <table className="w-full text-sm">
          <thead><tr className="border-b border-border">
            <th className="text-left px-4 py-3 text-xs font-bold text-muted-foreground uppercase tracking-wider">{t('nome')}</th>
            <th className="text-left px-4 py-3 text-xs font-bold text-muted-foreground uppercase tracking-wider">{t('tipo')}</th>
            <th className="text-left px-4 py-3 text-xs font-bold text-muted-foreground uppercase tracking-wider hidden sm:table-cell">{t('data_inizio')}</th>
            <th className="text-left px-4 py-3 text-xs font-bold text-muted-foreground uppercase tracking-wider hidden sm:table-cell">{t('data_fine')}</th>
            <th className="text-center px-4 py-3 text-xs font-bold text-muted-foreground uppercase tracking-wider">{t('stato')}</th>
          </tr></thead>
          <tbody>
            {mock_stagioni.map(s => (
              <tr key={s.id} className="border-b border-border/50 hover:bg-muted/30 transition-colors">
                <td className="px-4 py-3 font-medium text-foreground">{s.nome}</td>
                <td className="px-4 py-3"><Badge variant="secondary" className="text-xs">{t(s.tipo)}</Badge></td>
                <td className="px-4 py-3 tabular-nums text-muted-foreground hidden sm:table-cell">{new Date(s.data_inizio).toLocaleDateString('it-CH')}</td>
                <td className="px-4 py-3 tabular-nums text-muted-foreground hidden sm:table-cell">{new Date(s.data_fine).toLocaleDateString('it-CH')}</td>
                <td className="px-4 py-3 text-center">
                  <Badge variant={s.attiva ? 'default' : 'secondary'} className="text-xs">{s.attiva ? t('attivo') : t('inattivo')}</Badge>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default SeasonsPage;
