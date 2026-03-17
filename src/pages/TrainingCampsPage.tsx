import React from 'react';
import { useI18n } from '@/lib/i18n';
import { mock_campi, get_atleta_name } from '@/lib/mock-data';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Plus, MapPin, Calendar } from 'lucide-react';

const TrainingCampsPage: React.FC = () => {
  const { t } = useI18n();

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold tracking-tight text-foreground">{t('campi')}</h1>
        <Button className="bg-primary hover:bg-primary/90"><Plus className="w-4 h-4 mr-2" /> {t('nuovo_campo')}</Button>
      </div>

      {mock_campi.map(camp => (
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
            <div><span className="text-muted-foreground">{t('costo_diurno')}</span><p className="font-medium text-foreground tabular-nums">€{camp.costo_diurno}</p></div>
            <div><span className="text-muted-foreground">{t('costo_completo')}</span><p className="font-medium text-foreground tabular-nums">€{camp.costo_completo}</p></div>
            <div><span className="text-muted-foreground">{t('iscrizioni')}</span><p className="font-medium text-foreground tabular-nums">{camp.iscrizioni.length}</p></div>
          </div>
          {camp.iscrizioni.length > 0 && (
            <div>
              <h3 className="text-xs font-bold text-muted-foreground uppercase tracking-widest mb-3">{t('iscrizioni')}</h3>
              <div className="space-y-2">
                {camp.iscrizioni.map(isc => (
                  <div key={isc.atleta_id} className="flex items-center justify-between p-2 rounded-lg bg-muted/30">
                    <span className="text-sm font-medium text-foreground">{get_atleta_name(isc.atleta_id)}</span>
                    <Badge variant="secondary" className="text-xs">{t(isc.tipo)}</Badge>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      ))}
    </div>
  );
};

export default TrainingCampsPage;
