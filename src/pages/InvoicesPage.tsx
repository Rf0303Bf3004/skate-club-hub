import React, { useState } from 'react';
import { useI18n } from '@/lib/i18n';
import { use_fatture, use_atleti, get_atleta_name_from_list } from '@/hooks/use-supabase-data';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { FileText } from 'lucide-react';

const InvoicesPage: React.FC = () => {
  const { t } = useI18n();
  const { data: fatture = [], isLoading } = use_fatture();
  const { data: atleti = [] } = use_atleti();
  const [status_filter, set_status_filter] = useState('tutti');

  const filtered = fatture.filter((f: any) => status_filter === 'tutti' || f.stato === status_filter);

  if (isLoading) {
    return <div className="flex items-center justify-center h-64"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" /></div>;
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <h1 className="text-xl font-bold tracking-tight text-foreground">{t('fatture')}</h1>
        <Button className="bg-primary hover:bg-primary/90"><FileText className="w-4 h-4 mr-2" /> {t('genera_fatture')}</Button>
      </div>

      <Select value={status_filter} onValueChange={set_status_filter}>
        <SelectTrigger className="w-48">
          <SelectValue placeholder={t('stato')} />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="tutti">{t('tutti')}</SelectItem>
          <SelectItem value="pagata">{t('pagata')}</SelectItem>
          <SelectItem value="da_pagare">{t('da_pagare')}</SelectItem>
        </SelectContent>
      </Select>

      <div className="bg-card rounded-xl shadow-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead><tr className="border-b border-border">
              <th className="text-left px-4 py-3 text-xs font-bold text-muted-foreground uppercase tracking-wider">{t('numero_fattura')}</th>
              <th className="text-left px-4 py-3 text-xs font-bold text-muted-foreground uppercase tracking-wider">{t('nome')}</th>
              <th className="text-left px-4 py-3 text-xs font-bold text-muted-foreground uppercase tracking-wider hidden md:table-cell">{t('descrizione')}</th>
              <th className="text-right px-4 py-3 text-xs font-bold text-muted-foreground uppercase tracking-wider">{t('importo')}</th>
              <th className="text-left px-4 py-3 text-xs font-bold text-muted-foreground uppercase tracking-wider hidden sm:table-cell">{t('scadenza')}</th>
              <th className="text-center px-4 py-3 text-xs font-bold text-muted-foreground uppercase tracking-wider">{t('stato')}</th>
            </tr></thead>
            <tbody>
              {filtered.map((f: any) => (
                <tr key={f.id} className="border-b border-border/50 hover:bg-muted/30 transition-colors">
                  <td className="px-4 py-3 font-medium tabular-nums text-foreground">{f.numero}</td>
                  <td className="px-4 py-3 text-foreground">{get_atleta_name_from_list(atleti, f.atleta_id)}</td>
                  <td className="px-4 py-3 text-muted-foreground hidden md:table-cell max-w-xs truncate">{f.descrizione}</td>
                  <td className="px-4 py-3 text-right tabular-nums font-semibold text-foreground">€{f.importo}</td>
                  <td className="px-4 py-3 tabular-nums text-muted-foreground hidden sm:table-cell">{f.scadenza ? new Date(f.scadenza).toLocaleDateString('it-CH') : '—'}</td>
                  <td className="px-4 py-3 text-center">
                    <Badge variant={f.stato === 'pagata' ? 'default' : 'destructive'} className="text-xs">{t(f.stato)}</Badge>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default InvoicesPage;
