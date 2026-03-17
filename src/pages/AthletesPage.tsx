import React, { useState } from 'react';
import { useI18n } from '@/lib/i18n';
import { use_atleti } from '@/hooks/use-supabase-data';
import { calculate_age } from '@/lib/mock-data';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Plus, Search, Shield } from 'lucide-react';
import AtletaDetail from '@/components/AtletaDetail';

const AthletesPage: React.FC = () => {
  const { t } = useI18n();
  const { data: atleti = [], isLoading } = use_atleti();
  const [search, set_search] = useState('');
  const [level_filter, set_level_filter] = useState('tutti');
  const [selected_id, set_selected_id] = useState<string | null>(null);

  const levels = ['tutti', 'pulcini', 'stellina_1', 'stellina_2', 'stellina_3', 'stellina_4'];

  const filtered = atleti.filter((a: any) => {
    const name_match = `${a.nome} ${a.cognome}`.toLowerCase().includes(search.toLowerCase());
    const level_match = level_filter === 'tutti' || a.livello_amatori === level_filter;
    return name_match && level_match;
  });

  if (selected_id) {
    const atleta = atleti.find((a: any) => a.id === selected_id);
    if (atleta) return <AtletaDetail atleta={atleta} on_back={() => set_selected_id(null)} />;
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <h1 className="text-xl font-bold tracking-tight text-foreground">{t('atleti')}</h1>
        <Button className="bg-primary hover:bg-primary/90">
          <Plus className="w-4 h-4 mr-2" /> {t('nuovo_atleta')}
        </Button>
      </div>

      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input placeholder={t('cerca')} value={search} onChange={e => set_search(e.target.value)} className="pl-9" />
        </div>
        <Select value={level_filter} onValueChange={set_level_filter}>
          <SelectTrigger className="w-48">
            <SelectValue placeholder={t('livello')} />
          </SelectTrigger>
          <SelectContent>
            {levels.map(l => (
              <SelectItem key={l} value={l}>{t(l)}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="bg-card rounded-xl shadow-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border">
                <th className="text-left px-4 py-3 text-xs font-bold text-muted-foreground uppercase tracking-wider">{t('nome')}</th>
                <th className="text-left px-4 py-3 text-xs font-bold text-muted-foreground uppercase tracking-wider hidden sm:table-cell">{t('eta')}</th>
                <th className="text-left px-4 py-3 text-xs font-bold text-muted-foreground uppercase tracking-wider">{t('livello')}</th>
                <th className="text-left px-4 py-3 text-xs font-bold text-muted-foreground uppercase tracking-wider hidden md:table-cell">{t('carriera')}</th>
                <th className="text-right px-4 py-3 text-xs font-bold text-muted-foreground uppercase tracking-wider hidden lg:table-cell">{t('ore_pista')}</th>
                <th className="text-center px-4 py-3 text-xs font-bold text-muted-foreground uppercase tracking-wider hidden lg:table-cell">{t('stato')}</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((a: any) => (
                <tr
                  key={a.id}
                  onClick={() => set_selected_id(a.id)}
                  className="border-b border-border/50 hover:bg-muted/30 cursor-pointer transition-colors"
                >
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-accent/10 flex items-center justify-center text-accent text-xs font-bold shrink-0">
                        {a.nome[0]}{a.cognome[0]}
                      </div>
                      <div>
                        <p className="font-medium text-foreground">{a.nome} {a.cognome}</p>
                        {a.atleta_federazione && (
                          <div className="flex items-center gap-1 mt-0.5">
                            <Shield className="w-3 h-3 text-accent" />
                            <span className="text-xs text-accent">{t('atleta_federazione')}</span>
                          </div>
                        )}
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3 tabular-nums text-muted-foreground hidden sm:table-cell">{calculate_age(a.data_nascita)}</td>
                  <td className="px-4 py-3">
                    <Badge variant="secondary" className="text-xs">{t(a.livello_amatori)}</Badge>
                  </td>
                  <td className="px-4 py-3 text-muted-foreground hidden md:table-cell">
                    {a.carriera_artistica ? t(a.carriera_artistica) : '—'}
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums text-muted-foreground hidden lg:table-cell">{a.ore_pista_stagione}h</td>
                  <td className="px-4 py-3 text-center hidden lg:table-cell">
                    <span className={`inline-block w-2 h-2 rounded-full ${a.stato === 'attivo' ? 'bg-success' : 'bg-muted-foreground'}`} />
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

export default AthletesPage;
