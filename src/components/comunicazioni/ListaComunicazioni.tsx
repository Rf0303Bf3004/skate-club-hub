import React, { useMemo, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Search, Archive, ArchiveRestore, MessageSquare, AlertTriangle, X, ChevronDown, ChevronRight, Users } from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { segnala_errore } from "@/lib/errori";
import {
  raggruppa_comunicazioni,
  etichetta_destinatari_gruppo,
  type GruppoComunicazioni,
} from '@/lib/raggruppa-comunicazioni';

const PAGE_SIZE = 20;

type Props = {
  items: any[];
  mode: 'attive' | 'archivio';
  highlight_unread?: boolean;
  get_destinatari_label: (c: any) => string;
  get_data_label: (c: any) => string;
  on_open?: (c: any) => void;
  empty_text: string;
  stagioni?: any[];
  can_manage?: boolean;
  /** Nome leggibile dell'atleta destinatario della singola riga. */
  nome_atleta?: (id: string | null) => string;
};

function get_ts(c: any) {
  const iso = (c.stato === 'inviata' && c.inviata_at) ? c.inviata_at : (c.created_at || (c.data ? `${c.data}T00:00:00` : null));
  return iso ? new Date(iso).getTime() : 0;
}

function ora_label(c: any) {
  const iso = (c.stato === 'inviata' && c.inviata_at) ? c.inviata_at : c.created_at;
  if (!iso) return '';
  return new Date(iso).toLocaleTimeString('de-CH', { hour: '2-digit', minute: '2-digit' });
}

function bucket_of(ts: number) {
  const now = new Date();
  const start_today = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const start_week = start_today - 6 * 86400000;
  const start_month = new Date(now.getFullYear(), now.getMonth(), 1).getTime();
  if (ts >= start_today) return 'Oggi';
  if (ts >= start_week) return 'Questa settimana';
  if (ts >= start_month) return 'Questo mese';
  return 'Precedenti';
}

const BUCKET_ORDER = ['Oggi', 'Questa settimana', 'Questo mese', 'Precedenti'];

/** Elenco destinatari di un invio, con stato di lettura e risposta. */
const ElencoDestinatari: React.FC<{
  gruppo: GruppoComunicazioni;
  nome_atleta?: (id: string | null) => string;
}> = ({ gruppo, nome_atleta }) => {
  const { data: risposte = {} } = useQuery({
    queryKey: ['comunicazioni_risposte', gruppo.key],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('comunicazioni_destinatari')
        .select('comunicazione_id, atleta_id, rsvp_risposta')
        .in('comunicazione_id', gruppo.ids);
      if (error) throw error;
      const mappa: Record<string, string> = {};
      (data ?? []).forEach((d: any) => {
        if (d.rsvp_risposta) mappa[`${d.comunicazione_id}`] = d.rsvp_risposta;
      });
      return mappa;
    },
  });

  const righe = useMemo(
    () =>
      gruppo.righe
        .map((c: any) => ({
          id: c.id,
          nome: nome_atleta?.(c.atleta_id) || (c.atleta_id ? c.atleta_id.slice(0, 8) : 'Destinatario'),
          letta: !!c.letta,
          risposta: risposte[c.id] ?? null,
        }))
        .sort((a, b) => a.nome.localeCompare(b.nome, 'it')),
    [gruppo, nome_atleta, risposte],
  );

  return (
    <div className="border-t border-border bg-muted/20 px-4 py-3 max-h-80 overflow-y-auto space-y-1">
      <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">
        Destinatari ({righe.length})
      </p>
      {righe.map((r) => (
        <div key={r.id} className="flex items-center justify-between gap-3 text-sm py-1 border-b border-border/40 last:border-0">
          <span className="text-foreground truncate">{r.nome}</span>
          <span className="text-xs shrink-0">
            {r.risposta ? (
              <span className="text-success">ha risposto</span>
            ) : r.letta ? (
              <span className="text-muted-foreground">letto</span>
            ) : (
              <span className="text-warning">non letto</span>
            )}
          </span>
        </div>
      ))}
    </div>
  );
};

export const ListaComunicazioni: React.FC<Props> = ({
  items,
  mode,
  highlight_unread,
  get_destinatari_label,
  get_data_label,
  on_open,
  empty_text,
  stagioni = [],
  can_manage = true,
  nome_atleta,
}) => {
  const qc = useQueryClient();
  const [search, set_search] = useState('');
  const [filtro_destinatari, set_filtro_destinatari] = useState('tutti');
  const [solo_urgenti, set_solo_urgenti] = useState(false);
  const [periodo, set_periodo] = useState('tutti');
  const [stagione_id, set_stagione_id] = useState('tutte');
  const [limit, set_limit] = useState(PAGE_SIZE);
  const [selected, set_selected] = useState<string[]>([]);
  const [aperto, set_aperto] = useState<string | null>(null);
  const [busy, set_busy] = useState(false);

  const tipi_destinatari = useMemo(
    () => Array.from(new Set(items.map((c: any) => c.tipo_destinatari).filter(Boolean))),
    [items],
  );

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    const now = Date.now();
    const soglia = periodo === '7' ? now - 7 * 86400000
      : periodo === '30' ? now - 30 * 86400000
      : periodo === '90' ? now - 90 * 86400000
      : null;
    const stagione = stagioni.find((s: any) => s.id === stagione_id);

    return items
      .filter((c: any) => {
        if (q) {
          const hay = `${c.titolo || ''} ${c.testo || ''} ${c.corpo || ''}`.toLowerCase();
          if (!hay.includes(q)) return false;
        }
        if (filtro_destinatari !== 'tutti' && c.tipo_destinatari !== filtro_destinatari) return false;
        if (solo_urgenti && !c.urgente) return false;
        const ts = get_ts(c);
        if (soglia && ts < soglia) return false;
        if (stagione) {
          const da = stagione.data_inizio ? new Date(`${stagione.data_inizio}T00:00:00`).getTime() : 0;
          const a = stagione.data_fine ? new Date(`${stagione.data_fine}T23:59:59`).getTime() : Infinity;
          if (ts < da || ts > a) return false;
        }
        return true;
      })
      .sort((a: any, b: any) => get_ts(b) - get_ts(a));
  }, [items, search, filtro_destinatari, solo_urgenti, periodo, stagione_id, stagioni]);

  // Il raggruppamento avviene su TUTTE le righe filtrate: la paginazione
  // ("Carica altre") lavora poi sui gruppi, così nessun invio resta spezzato.
  const gruppi = useMemo(() => raggruppa_comunicazioni(filtered), [filtered]);
  const visible = gruppi.slice(0, limit);

  const grouped = useMemo(() => {
    const map: Record<string, GruppoComunicazioni[]> = {};
    visible.forEach((g) => {
      const b = bucket_of(get_ts(g.capofila));
      (map[b] ||= []).push(g);
    });
    return BUCKET_ORDER.filter((b) => map[b]?.length).map((b) => ({ bucket: b, rows: map[b] }));
  }, [visible]);

  const toggle_select_gruppo = (g: GruppoComunicazioni) => {
    set_selected((prev) => {
      const tutte = g.ids.every((id) => prev.includes(id));
      if (tutte) return prev.filter((id) => !g.ids.includes(id));
      return Array.from(new Set([...prev, ...g.ids]));
    });
  };

  const apply_archivia = async (ids: string[], archivia: boolean) => {
    if (ids.length === 0) return;
    set_busy(true);
    const { error } = await supabase
      .from('comunicazioni')
      .update({ archiviata: archivia, archiviata_at: archivia ? new Date().toISOString() : null })
      .in('id', ids);
    set_busy(false);
    if (error) {
      await segnala_errore("ListaComunicazioni", archivia ? "Archiviazione comunicazioni" : "Ripristino comunicazioni", error, { ids });
      return;
    }
    set_selected([]);
    qc.invalidateQueries({ queryKey: ['comunicazioni'] });
    toast({
      title: archivia
        ? `${ids.length} comunicazion${ids.length === 1 ? 'e archiviata' : 'i archiviate'}`
        : `${ids.length} comunicazion${ids.length === 1 ? 'e ripristinata' : 'i ripristinate'}`,
    });
  };

  const has_filters = !!search || filtro_destinatari !== 'tutti' || solo_urgenti || periodo !== 'tutti' || stagione_id !== 'tutte';
  const gruppi_selezionati = gruppi.filter((g) => g.ids.some((id) => selected.includes(id))).length;

  return (
    <div className="space-y-4">
      {/* Barra filtri */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => { set_search(e.target.value); set_limit(PAGE_SIZE); }}
            placeholder="Cerca per titolo o testo…"
            className="pl-9 pr-9 h-11"
          />
          {search && (
            <button
              type="button"
              onClick={() => set_search('')}
              className="absolute right-2 top-1/2 -translate-y-1/2 p-1 rounded-full hover:bg-muted"
            >
              <X className="w-4 h-4 text-muted-foreground" />
            </button>
          )}
        </div>

        <Select value={periodo} onValueChange={(v) => { set_periodo(v); set_limit(PAGE_SIZE); }}>
          <SelectTrigger className="w-[150px] h-11"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="tutti">Tutto il periodo</SelectItem>
            <SelectItem value="7">Ultimi 7 giorni</SelectItem>
            <SelectItem value="30">Ultimi 30 giorni</SelectItem>
            <SelectItem value="90">Ultimi 90 giorni</SelectItem>
          </SelectContent>
        </Select>

        {tipi_destinatari.length > 1 && (
          <Select value={filtro_destinatari} onValueChange={(v) => { set_filtro_destinatari(v); set_limit(PAGE_SIZE); }}>
            <SelectTrigger className="w-[170px] h-11"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="tutti">Tutti i destinatari</SelectItem>
              {tipi_destinatari.map((td: any) => (
                <SelectItem key={td} value={td}>{td}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}

        {mode === 'archivio' && stagioni.length > 0 && (
          <Select value={stagione_id} onValueChange={(v) => { set_stagione_id(v); set_limit(PAGE_SIZE); }}>
            <SelectTrigger className="w-[170px] h-11"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="tutte">Tutte le stagioni</SelectItem>
              {stagioni.map((s: any) => (
                <SelectItem key={s.id} value={s.id}>{s.nome}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}

        <Button
          type="button"
          variant={solo_urgenti ? 'default' : 'outline'}
          className="h-11 gap-2"
          onClick={() => { set_solo_urgenti((v) => !v); set_limit(PAGE_SIZE); }}
        >
          <AlertTriangle className="w-4 h-4" /> Urgenti
        </Button>
      </div>

      {/* Azioni multiple */}
      {can_manage && selected.length > 0 && (
        <div className="flex items-center justify-between gap-3 rounded-xl border border-primary/30 bg-primary/5 px-4 py-2">
          <p className="text-sm font-medium">
            {gruppi_selezionati} {gruppi_selezionati === 1 ? 'invio selezionato' : 'invii selezionati'}
            <span className="text-muted-foreground font-normal"> ({selected.length} messaggi)</span>
          </p>
          <div className="flex gap-2">
            <Button variant="ghost" size="sm" onClick={() => set_selected([])}>Annulla</Button>
            <Button
              size="sm"
              disabled={busy}
              onClick={() => apply_archivia(selected, mode === 'attive')}
              className="gap-2"
            >
              {mode === 'attive'
                ? <><Archive className="w-4 h-4" /> Archivia</>
                : <><ArchiveRestore className="w-4 h-4" /> Ripristina</>}
            </Button>
          </div>
        </div>
      )}

      {gruppi.length === 0 ? (
        <div className="bg-card rounded-xl shadow-card p-12 text-center space-y-3">
          <div className="flex justify-center text-muted-foreground/40"><MessageSquare className="w-12 h-12" /></div>
          <p className="text-sm text-muted-foreground">{has_filters ? 'Nessun risultato con questi filtri.' : empty_text}</p>
        </div>
      ) : (
        <div className="space-y-6">
          {grouped.map(({ bucket, rows }) => (
            <div key={bucket} className="space-y-3">
              <p className="text-xs font-bold text-muted-foreground uppercase tracking-widest">
                {bucket} <span className="font-normal">({rows.length})</span>
              </p>
              {rows.map((g) => {
                const c = g.capofila;
                const unread = highlight_unread && g.righe.every((r: any) => !r.letta);
                const is_sel = g.ids.every((id) => selected.includes(id));
                const is_open = aperto === g.key;
                return (
                  <div
                    key={g.key}
                    className={cn(
                      'bg-card rounded-xl shadow-card hover:shadow-card-hover transition-shadow overflow-hidden',
                      unread && 'bg-warning/5 border-l-4 border-l-destructive',
                      is_sel && 'ring-2 ring-primary/40',
                    )}
                  >
                    <div className="p-4 flex gap-3">
                      {can_manage && (
                        <Checkbox
                          checked={is_sel}
                          onCheckedChange={() => toggle_select_gruppo(g)}
                          className="mt-1"
                          aria-label="Seleziona invio"
                        />
                      )}
                      <div
                        className="flex-1 min-w-0 cursor-pointer"
                        onClick={() => {
                          set_aperto(is_open ? null : g.key);
                          on_open?.(c);
                        }}
                      >
                        <div className="flex items-start justify-between gap-4">
                          <div className="min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              {!g.singola && (is_open
                                ? <ChevronDown className="w-4 h-4 text-muted-foreground" />
                                : <ChevronRight className="w-4 h-4 text-muted-foreground" />)}
                              {c.urgente && (
                                <Badge variant="destructive" className="text-[10px] gap-1">
                                  <AlertTriangle className="w-3 h-3" /> URGENTE
                                </Badge>
                              )}
                              {unread && <Badge variant="destructive" className="text-[10px]">NUOVO</Badge>}
                              <h3 className="font-semibold text-foreground">{c.titolo}</h3>
                            </div>
                            <p className="text-sm text-muted-foreground mt-1 line-clamp-2">{c.testo}</p>
                            {g.testo_personalizzato && (
                              <p className="text-[11px] text-muted-foreground/80 mt-1 italic">
                                il testo è personalizzato per ciascun destinatario
                              </p>
                            )}
                          </div>
                          <div className="text-right shrink-0">
                            <p className="text-xs tabular-nums text-muted-foreground">
                              {get_data_label(c)} {ora_label(c)}
                            </p>
                            <Badge variant="secondary" className="text-xs mt-1 gap-1">
                              {g.singola ? (
                                get_destinatari_label(c)
                              ) : (
                                <>
                                  <Users className="w-3 h-3" /> {etichetta_destinatari_gruppo(g)}
                                </>
                              )}
                            </Badge>
                          </div>
                        </div>
                      </div>
                      {can_manage && (
                        <Button
                          variant="ghost"
                          size="icon"
                          disabled={busy}
                          title={mode === 'attive' ? 'Archivia tutto l\'invio' : 'Ripristina tutto l\'invio'}
                          onClick={() => apply_archivia(g.ids, mode === 'attive')}
                        >
                          {mode === 'attive' ? <Archive className="w-4 h-4" /> : <ArchiveRestore className="w-4 h-4" />}
                        </Button>
                      )}
                    </div>
                    {is_open && !g.singola && <ElencoDestinatari gruppo={g} nome_atleta={nome_atleta} />}
                  </div>
                );
              })}
            </div>
          ))}

          {gruppi.length > visible.length && (
            <div className="flex justify-center">
              <Button variant="outline" onClick={() => set_limit((l) => l + PAGE_SIZE)}>
                Carica altre ({gruppi.length - visible.length})
              </Button>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default ListaComunicazioni;
