import React from 'react';
import { useI18n } from '@/lib/i18n';
import { use_club, use_setup_club, use_stagioni } from '@/hooks/use-supabase-data';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';

const ClubSetupPage: React.FC = () => {
  const { t } = useI18n();
  const { data: club, isLoading: loading_club } = use_club();
  const { data: setup } = use_setup_club();
  const { data: stagioni = [] } = use_stagioni();

  const stagione_attiva = stagioni.find((s: any) => s.attiva);

  if (loading_club) {
    return <div className="flex items-center justify-center h-64"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" /></div>;
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <h1 className="text-xl font-bold tracking-tight text-foreground">{t('setup_club')}</h1>

      <div className="bg-card rounded-xl shadow-card p-6 space-y-8 max-w-2xl">
        <section className="space-y-4">
          <h2 className="text-sm font-bold text-muted-foreground uppercase tracking-widest">{t('dati_club')}</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Field label={t('nome')} value={club?.nome || ''} />
            <Field label={t('citta')} value={club?.citta || ''} />
            <Field label={t('paese')} value={club?.paese || ''} />
            <Field label={t('email')} value={club?.email || ''} />
            <Field label={t('telefono')} value={club?.telefono || ''} />
          </div>
        </section>

        <Separator />

        <section className="space-y-4">
          <h2 className="text-sm font-bold text-muted-foreground uppercase tracking-widest">{t('parametri_stagione')}</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Field label={t('nome_stagione')} value={stagione_attiva?.nome || ''} />
            <Field label={t('data_inizio')} value={stagione_attiva?.data_inizio || ''} />
            <Field label={t('data_fine')} value={stagione_attiva?.data_fine || ''} />
          </div>
        </section>

        <Separator />

        <section className="space-y-4">
          <h2 className="text-sm font-bold text-muted-foreground uppercase tracking-widest">{t('parametri_lezioni')}</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <Label className="text-xs text-muted-foreground">{t('max_lezioni')}</Label>
              <Input defaultValue={setup?.max_lezioni_private_contemporanee ?? ''} placeholder={t('illimitato')} className="mt-1" />
            </div>
            <div>
              <Label className="text-xs text-muted-foreground">{t('max_atlete')}</Label>
              <Input defaultValue={setup?.max_atlete_lezione_condivisa ?? ''} placeholder={t('illimitato')} className="mt-1" />
            </div>
            <div>
              <Label className="text-xs text-muted-foreground">{t('durata_slot')}</Label>
              <Input defaultValue={setup?.slot_lezione_privata_minuti ?? 20} className="mt-1" />
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
