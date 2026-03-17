import React from 'react';
import { useI18n } from '@/lib/i18n';
import { mock_comunicazioni, mock_corsi } from '@/lib/mock-data';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Plus, MessageSquare } from 'lucide-react';

const CommunicationsPage: React.FC = () => {
  const { t } = useI18n();

  const get_destinatari_label = (c: typeof mock_comunicazioni[0]) => {
    if (c.tipo_destinatari === 'tutti') return t('tutti');
    if (c.tipo_destinatari === 'solo_istruttori') return t('solo_istruttori');
    if (c.tipo_destinatari === 'per_corso') {
      const corso = mock_corsi.find(co => co.id === c.corso_id);
      return corso ? corso.nome : t('per_corso');
    }
    return t('per_atleta');
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold tracking-tight text-foreground">{t('comunicazioni')}</h1>
        <Button className="bg-primary hover:bg-primary/90"><Plus className="w-4 h-4 mr-2" /> {t('nuova_comunicazione')}</Button>
      </div>

      <div className="space-y-4">
        {mock_comunicazioni.map(c => (
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
                <p className="text-xs tabular-nums text-muted-foreground">{new Date(c.data).toLocaleDateString('it-CH')}</p>
                <Badge variant="secondary" className="text-xs mt-1">{get_destinatari_label(c)}</Badge>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default CommunicationsPage;
