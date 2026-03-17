import React from 'react';
import { useI18n } from '@/lib/i18n';
import { mock_club } from '@/lib/mock-data';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';

const ClubSetupPage: React.FC = () => {
  const { t } = useI18n();
  const club = mock_club;

  return (
    <div className="space-y-6 animate-fade-in">
      <h1 className="text-xl font-bold tracking-tight text-foreground">{t('setup_club')}</h1>

      <div className="bg-card rounded-xl shadow-card p-6 space-y-8 max-w-2xl">
        {/* Club data */}
        <section className="space-y-4">
          <h2 className="text-sm font-bold text-muted-foreground uppercase tracking-widest">{t('dati_club')}</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Field label={t('nome')} value={club.nome_club} />
            <Field label={t('citta')} value={club.citta} />
            <Field label={t('paese')} value={club.paese} />
            <Field label={t('email')} value={club.email} />
            <Field label={t('telefono')} value={club.telefono} />
          </div>
        </section>

        <Separator />

        {/* Season params */}
        <section className="space-y-4">
          <h2 className="text-sm font-bold text-muted-foreground uppercase tracking-widest">{t('parametri_stagione')}</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Field label={t('nome_stagione')} value={club.stagione_attiva.nome} />
            <Field label={t('data_inizio')} value={club.stagione_attiva.data_inizio} />
            <Field label={t('data_fine')} value={club.stagione_attiva.data_fine} />
          </div>
        </section>

        <Separator />

        {/* Private lesson params */}
        <section className="space-y-4">
          <h2 className="text-sm font-bold text-muted-foreground uppercase tracking-widest">{t('parametri_lezioni')}</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <Label className="text-xs text-muted-foreground">{t('max_lezioni')}</Label>
              <Input defaultValue={club.config_lezioni_private.max_lezioni_contemporanee ?? ''} placeholder={t('illimitato')} className="mt-1" />
            </div>
            <div>
              <Label className="text-xs text-muted-foreground">{t('max_atlete')}</Label>
              <Input defaultValue={club.config_lezioni_private.max_atlete_condivisa ?? ''} placeholder={t('illimitato')} className="mt-1" />
            </div>
            <div>
              <Label className="text-xs text-muted-foreground">{t('durata_slot')}</Label>
              <Input defaultValue={club.config_lezioni_private.durata_slot_minuti} className="mt-1" />
            </div>
          </div>
        </section>

        <Button className="bg-primary hover:bg-primary/90">{t('salva_modifiche')}</Button>
      </div>
    </div>
  );
};

const Field: React.FC<{ label: string; value: string | number }> = ({ label, value }) => (
  <div>
    <Label className="text-xs text-muted-foreground">{label}</Label>
    <Input defaultValue={value} className="mt-1" />
  </div>
);

export default ClubSetupPage;
