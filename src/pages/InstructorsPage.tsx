import React from 'react';
import { useI18n } from '@/lib/i18n';
import { mock_istruttori } from '@/lib/mock-data';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Plus } from 'lucide-react';

const InstructorsPage: React.FC = () => {
  const { t } = useI18n();
  const days = ['lunedi', 'martedi', 'mercoledi', 'giovedi', 'venerdi', 'sabato', 'domenica'];

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold tracking-tight text-foreground">{t('istruttori')}</h1>
        <Button className="bg-primary hover:bg-primary/90"><Plus className="w-4 h-4 mr-2" /> {t('nuovo_istruttore')}</Button>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {mock_istruttori.map(i => (
          <div key={i.id} className="bg-card rounded-xl shadow-card p-5 hover:shadow-card-hover transition-shadow">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-11 h-11 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold">
                {i.nome[0]}{i.cognome[0]}
              </div>
              <div>
                <p className="font-semibold text-foreground">{i.nome} {i.cognome}</p>
                <p className="text-xs text-muted-foreground">{i.email}</p>
              </div>
              <span className={`ml-auto inline-block w-2 h-2 rounded-full ${i.stato === 'attivo' ? 'bg-success' : 'bg-muted-foreground'}`} />
            </div>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between"><span className="text-muted-foreground">{t('telefono')}</span><span className="text-foreground">{i.telefono}</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">{t('costo_minuto')}</span><span className="text-foreground tabular-nums">€{i.costo_minuto.toFixed(2)}</span></div>
            </div>
            <div className="mt-4">
              <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-2">{t('disponibilita')}</p>
              <div className="flex flex-wrap gap-1">
                {days.map(d => (
                  <Badge key={d} variant={i.disponibilita[d] ? 'default' : 'secondary'} className="text-[10px] px-1.5">
                    {t(d).slice(0, 3)}
                  </Badge>
                ))}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default InstructorsPage;
