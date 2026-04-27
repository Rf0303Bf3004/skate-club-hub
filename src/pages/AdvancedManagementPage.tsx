import React, { useState, useMemo } from "react";
import { use_lezioni_private, use_istruttori, use_atleti } from "@/hooks/use-supabase-data";
import { use_annulla_ricorrenze } from "@/hooks/use-supabase-mutations";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ShieldAlert, Trash2, AlertTriangle, X, Check, Search, Calendar } from "lucide-react";
import { toast } from "@/hooks/use-toast";

// ─── Helpers ──────────────────────────────────────────────────────────────────
function fmt_date(d: string) {
  const obj = new Date(d + "T00:00:00");
  return obj.toLocaleDateString("de-CH", { weekday: "short", day: "numeric", month: "short", year: "numeric" });
}

function get_day_of_week(d: string) {
  const obj = new Date(d + "T00:00:00");
  return obj.getDay();
}

// ─── Modal conferma eliminazione ──────────────────────────────────────────────
const ConfermaEliminazioneModal: React.FC<{
  ids: string[];
  lezioni: any[];
  atleti: any[];
  istruttori: any[];
  on_confirm: () => void;
  on_close: () => void;
  loading: boolean;
}> = ({ ids, lezioni, atleti, istruttori, on_confirm, on_close, loading }) => {
  const [testo_conferma, set_testo_conferma] = useState("");
  const PAROLA = "ELIMINA";
  const selezionate = lezioni.filter(l => ids.includes(l.id));

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="bg-card border border-border rounded-2xl shadow-xl w-full max-w-lg mx-4 overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b border-border bg-destructive/5">
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-destructive" />
            <h3 className="text-lg font-semibold text-foreground">Conferma eliminazione definitiva</h3>
          </div>
        </div>

        <div className="px-6 py-4 space-y-4 max-h-[60vh] overflow-y-auto">
          <div className="space-y-2">
            <p className="text-sm text-destructive font-medium">
              Stai per eliminare {ids.length} {ids.length === 1 ? 'lezione' : 'lezioni'} in modo definitivo.
            </p>
            <p className="text-xs text-muted-foreground">
              Questa operazione non può essere annullata.
            </p>
          </div>

          <div className="space-y-1.5">
            {selezionate.map(l => {
              const istr = istruttori.find((i: any) => i.id === l.istruttore_id);
              const nomi = (l.atleti_ids || []).map((id: string) => {
                const a = atleti.find((x: any) => x.id === id);
                return a ? `${a.nome} ${a.cognome}` : "—";
              }).join(", ");
              return (
                <div key={l.id} className="flex items-center gap-2 px-3 py-2 rounded-lg bg-destructive/5 text-sm">
                  <Calendar className="h-3.5 w-3.5 text-destructive/70 shrink-0" />
                  <div className="min-w-0">
                    <p className="font-medium truncate">{fmt_date(l.data)} — {l.ora_inizio?.slice(0, 5)}</p>
                    <p className="text-xs text-muted-foreground truncate">{istr ? `${istr.nome} ${istr.cognome}` : "—"} · {nomi || "Nessuna atleta"}</p>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="space-y-2 pt-2">
            <p className="text-sm font-medium text-foreground">
              Scrivi <span className="font-bold text-destructive">{PAROLA}</span> per confermare:
            </p>
            <input
              value={testo_conferma}
              onChange={e => set_testo_conferma(e.target.value.toUpperCase())}
              placeholder={PAROLA}
              className="w-full rounded-lg border-2 border-destructive/30 bg-background px-3 py-2 text-sm font-bold tracking-widest text-center focus:outline-none focus:border-destructive"
            />
          </div>
        </div>

        <div className="flex justify-end gap-2 px-6 py-4 border-t border-border">
          <Button variant="outline" onClick={on_close}>
            Annulla
          </Button>
          <Button variant="destructive" disabled={testo_conferma !== PAROLA || loading} onClick={on_confirm}>
            {loading ? (
              <span className="flex items-center gap-2">
                <span className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
                Elimino...
              </span>
            ) : `🗑️ Elimina ${ids.length} ${ids.length === 1 ? 'lezione' : 'lezioni'}`}
          </Button>
        </div>
      </div>
    </div>
  );
};

// ─── Sezione: Annulla ricorrenze ──────────────────────────────────────────────
const SezioneRicorrenze: React.FC<{
  lezioni: any[];
  istruttori: any[];
  atleti: any[];
}> = ({ lezioni, istruttori, atleti }) => {
  const annulla = use_annulla_ricorrenze();
  const [istruttore_id, set_istruttore_id] = useState("");
  const [lezione_base_id, set_lezione_base_id] = useState("");
  const [modalita, set_modalita] = useState<'solo' | 'future' | 'quante'>('solo');
  const [quante, set_quante] = useState(4);
  const [conferma_open, set_conferma_open] = useState(false);
  const [ids_da_eliminare, set_ids_da_eliminare] = useState<string[]>([]);

  const oggi = new Date().toISOString().split('T')[0];

  const lezioni_istruttore = useMemo(() => {
    if (!istruttore_id) return [];
    return lezioni
      .filter(l => l.istruttore_id === istruttore_id && l.data >= oggi)
      .sort((a, b) => a.data.localeCompare(b.data) || a.ora_inizio.localeCompare(b.ora_inizio));
  }, [lezioni, istruttore_id, oggi]);

  const lezione_base = lezioni.find(l => l.id === lezione_base_id);

  const lezioni_collegate = useMemo(() => {
    if (!lezione_base) return [];
    const dow = get_day_of_week(lezione_base.data);
    const ora = lezione_base.ora_inizio?.slice(0, 5);
    return lezioni
      .filter(l =>
        l.istruttore_id === lezione_base.istruttore_id &&
        get_day_of_week(l.data) === dow &&
        l.ora_inizio?.slice(0, 5) === ora &&
        l.data >= lezione_base.data
      )
      .sort((a, b) => a.data.localeCompare(b.data));
  }, [lezione_base, lezioni]);

  const calcola_ids = (): string[] => {
    if (modalita === 'solo') return [lezione_base_id];
    if (modalita === 'future') return lezioni_collegate.map(l => l.id);
    if (modalita === 'quante') return lezioni_collegate.slice(0, quante).map(l => l.id);
    return [];
  };

  const handle_procedi = () => {
    const ids = calcola_ids();
    if (!ids.length) return;
    set_ids_da_eliminare(ids);
    set_conferma_open(true);
  };

  const handle_confirm = async () => {
    try {
      await annulla.mutateAsync(ids_da_eliminare);
      set_conferma_open(false);
      set_lezione_base_id("");
      set_ids_da_eliminare([]);
      toast({ title: `🗑️ ${ids_da_eliminare.length} ${ids_da_eliminare.length === 1 ? 'lezione eliminata' : 'lezioni eliminate'} correttamente` });
    } catch (err: any) {
      toast({ title: "Errore eliminazione", description: err?.message, variant: "destructive" });
    }
  };

  return (
    <div className="bg-card border border-border rounded-2xl p-6 space-y-6">
      <div className="flex items-start gap-4">
        <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
          <Calendar className="h-5 w-5 text-primary" />
        </div>
        <div>
          <h2 className="text-lg font-semibold text-foreground">Annulla lezioni ricorrenti</h2>
          <p className="text-sm text-muted-foreground">Elimina una lezione e/o le sue ricorrenze future</p>
        </div>
      </div>

      {/* Step 1: Seleziona istruttore */}
      <div className="space-y-2">
        <p className="text-sm font-medium text-foreground">1. Seleziona istruttore</p>
        <Select value={istruttore_id} onValueChange={v => { set_istruttore_id(v); set_lezione_base_id(""); }}>
          <SelectTrigger>
            <SelectValue placeholder="Scegli istruttore..." />
          </SelectTrigger>
          <SelectContent>
            {istruttori.filter((i: any) => i.attivo).map((i: any) => (
              <SelectItem key={i.id} value={i.id}>{i.nome} {i.cognome}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Step 2: Seleziona lezione base */}
      {istruttore_id && (
        <div className="space-y-2">
          <p className="text-sm font-medium text-foreground">2. Seleziona la lezione di partenza</p>
          {lezioni_istruttore.length === 0 ? (
            <p className="text-sm text-muted-foreground italic">Nessuna lezione futura per questo istruttore</p>
          ) : (
            <div className="space-y-1 max-h-60 overflow-y-auto">
              {lezioni_istruttore.map(l => {
                const nomi = (l.atleti_ids || []).map((id: string) => {
                  const a = atleti.find((x: any) => x.id === id);
                  return a ? `${a.nome} ${a.cognome}` : null;
                }).filter(Boolean).join(", ");
                const is_sel = l.id === lezione_base_id;
                return (
                  <div
                    key={l.id}
                    onClick={() => set_lezione_base_id(l.id)}
                    className={`flex items-center gap-3 px-3 py-2 rounded-lg cursor-pointer transition-all text-sm
                      ${is_sel ? "bg-primary/10 border border-primary/30" : "hover:bg-muted/50 border border-transparent"}`}
                  >
                    <div className="h-5 w-5 rounded-full border-2 border-primary/40 flex items-center justify-center shrink-0">
                      {is_sel && <Check className="h-3 w-3 text-primary" />}
                    </div>
                    <div className="min-w-0">
                      <p className="font-medium truncate">{fmt_date(l.data)} · {l.ora_inizio?.slice(0, 5)}</p>
                      <p className="text-xs text-muted-foreground truncate">{nomi || "Nessuna atleta"}</p>
                    </div>
                    {l.condivisa && (
                      <span className="text-xs bg-secondary text-secondary-foreground px-1.5 py-0.5 rounded">Semi</span>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Step 3: Modalità annullamento */}
      {lezione_base_id && (
        <div className="space-y-3">
          <p className="text-sm font-medium text-foreground">3. Cosa vuoi eliminare?</p>

          <div className="space-y-2">
            {[
              { val: 'solo', label: 'Solo questa lezione', desc: '1 lezione eliminata' },
              { val: 'future', label: 'Questa e tutte le future', desc: `${lezioni_collegate.length} lezioni collegate trovate` },
              { val: 'quante', label: 'Questa e le prossime N', desc: 'Scegli quante' },
            ].map(opt => (
              <div
                key={opt.val}
                onClick={() => set_modalita(opt.val as any)}
                className={`flex items-center gap-3 px-4 py-3 rounded-xl border-2 cursor-pointer transition-all
                  ${modalita === opt.val ? "border-primary bg-primary/5" : "border-border hover:border-primary/40"}`}
              >
                <div className="h-5 w-5 rounded-full border-2 border-primary/40 flex items-center justify-center shrink-0">
                  {modalita === opt.val && <div className="h-2.5 w-2.5 rounded-full bg-primary" />}
                </div>
                <div>
                  <p className="text-sm font-medium">{opt.label}</p>
                  <p className="text-xs text-muted-foreground">{opt.desc}</p>
                </div>
              </div>
            ))}
          </div>

          {modalita === 'quante' && (
            <div className="flex items-center gap-2 text-sm">
              <span>Elimina le prossime</span>
              <input
                type="number"
                value={quante}
                onChange={e => set_quante(Math.max(1, parseInt(e.target.value) || 1))}
                className="w-16 rounded-lg border border-border bg-background px-2 py-1 text-sm text-center focus:outline-none focus:ring-2 focus:ring-primary/40"
              />
              <span>lezioni (su {lezioni_collegate.length} totali)</span>
            </div>
          )}

          {/* Anteprima */}
          <div className="bg-muted/30 rounded-lg p-3 space-y-1">
            <p className="text-xs font-medium text-muted-foreground">Anteprima lezioni che verranno eliminate:</p>
            <div className="space-y-0.5">
              {calcola_ids().slice(0, 5).map(id => {
                const l = lezioni.find(x => x.id === id);
                if (!l) return null;
                return (
                  <p key={id} className="text-xs text-foreground">· {fmt_date(l.data)} alle {l.ora_inizio?.slice(0, 5)}</p>
                );
              })}
              {calcola_ids().length > 5 && (
                <p className="text-xs text-muted-foreground">... e altre {calcola_ids().length - 5} lezioni</p>
              )}
            </div>
          </div>

          <Button variant="destructive" onClick={handle_procedi} className="w-full">
            <Trash2 className="h-4 w-4 mr-2" />
            Procedi con l'eliminazione ({calcola_ids().length} {calcola_ids().length === 1 ? 'lezione' : 'lezioni'})
          </Button>
        </div>
      )}

      {conferma_open && (
        <ConfermaEliminazioneModal
          ids={ids_da_eliminare}
          lezioni={lezioni}
          atleti={atleti}
          istruttori={istruttori}
          on_confirm={handle_confirm}
          on_close={() => set_conferma_open(false)}
          loading={annulla.isPending}
        />
      )}
    </div>
  );
};

// ─── Sezione: Selezione multipla ──────────────────────────────────────────────
const SezioneSelezioneMolteplice: React.FC<{
  lezioni: any[];
  istruttori: any[];
  atleti: any[];
}> = ({ lezioni, istruttori, atleti }) => {
  const annulla = use_annulla_ricorrenze();
  const [filtro_istruttore, set_filtro_istruttore] = useState("tutti");
  const [filtro_da, set_filtro_da] = useState("");
  const [filtro_a, set_filtro_a] = useState("");
  const [selezionate, set_selezionate] = useState<Set<string>>(new Set());
  const [conferma_open, set_conferma_open] = useState(false);

  const lezioni_filtrate = useMemo(() => {
    return lezioni
      .filter(l => {
        if (filtro_istruttore !== "tutti" && l.istruttore_id !== filtro_istruttore) return false;
        if (filtro_da && l.data < filtro_da) return false;
        if (filtro_a && l.data > filtro_a) return false;
        return true;
      })
      .sort((a, b) => a.data.localeCompare(b.data) || a.ora_inizio.localeCompare(b.ora_inizio));
  }, [lezioni, filtro_istruttore, filtro_da, filtro_a]);

  const toggle_sel = (id: string) => {
    set_selezionate(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const toggle_tutte = () => {
    if (selezionate.size === lezioni_filtrate.length) {
      set_selezionate(new Set());
    } else {
      set_selezionate(new Set(lezioni_filtrate.map(l => l.id)));
    }
  };

  const handle_confirm = async () => {
    try {
      await annulla.mutateAsync(Array.from(selezionate));
      set_conferma_open(false);
      set_selezionate(new Set());
      toast({ title: `🗑️ ${selezionate.size} ${selezionate.size === 1 ? 'lezione eliminata' : 'lezioni eliminate'} correttamente` });
    } catch (err: any) {
      toast({ title: "Errore eliminazione", description: err?.message, variant: "destructive" });
    }
  };

  return (
    <div className="bg-card border border-border rounded-2xl p-6 space-y-6">
      <div className="flex items-start gap-4">
        <div className="h-10 w-10 rounded-xl bg-destructive/10 flex items-center justify-center shrink-0">
          <Trash2 className="h-5 w-5 text-destructive" />
        </div>
        <div>
          <h2 className="text-lg font-semibold text-foreground">Eliminazione multipla</h2>
          <p className="text-sm text-muted-foreground">Seleziona e elimina più lezioni contemporaneamente</p>
        </div>
      </div>

      {/* Filtri */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="space-y-1">
          <p className="text-xs font-medium text-muted-foreground">Istruttore</p>
          <Select value={filtro_istruttore} onValueChange={set_filtro_istruttore}>
            <SelectTrigger>
              <SelectValue placeholder="Tutti" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="tutti">Tutti</SelectItem>
              {istruttori.filter((i: any) => i.attivo).map((i: any) => (
                <SelectItem key={i.id} value={i.id}>{i.nome} {i.cognome}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1">
          <p className="text-xs font-medium text-muted-foreground">Dal</p>
          <input
            type="date"
            value={filtro_da}
            onChange={e => set_filtro_da(e.target.value)}
            className="w-full h-9 rounded-lg border border-border bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
          />
        </div>
        <div className="space-y-1">
          <p className="text-xs font-medium text-muted-foreground">Al</p>
          <input
            type="date"
            value={filtro_a}
            onChange={e => set_filtro_a(e.target.value)}
            className="w-full h-9 rounded-lg border border-border bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
          />
        </div>
      </div>

      {/* Header lista */}
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">{lezioni_filtrate.length} lezioni trovate · {selezionate.size} selezionate</p>
        {lezioni_filtrate.length > 0 && (
          <Button variant="ghost" size="sm" onClick={toggle_tutte}>
            {selezionate.size === lezioni_filtrate.length ? "Deseleziona tutte" : "Seleziona tutte"}
          </Button>
        )}
      </div>

      {/* Lista lezioni */}
      {lezioni_filtrate.length === 0 ? (
        <div className="text-center py-8 text-muted-foreground">
          <Search className="h-8 w-8 mx-auto mb-2 opacity-40" />
          <p className="text-sm">Nessuna lezione trovata con i filtri applicati</p>
        </div>
      ) : (
        <div className="space-y-1 max-h-80 overflow-y-auto">
          {lezioni_filtrate.map(l => {
            const istr = istruttori.find((i: any) => i.id === l.istruttore_id);
            const nomi = (l.atleti_ids || []).map((id: string) => {
              const a = atleti.find((x: any) => x.id === id);
              return a ? `${a.nome} ${a.cognome}` : null;
            }).filter(Boolean).join(", ");
            const is_sel = selezionate.has(l.id);
            const is_semi = (l.atleti_ids || []).length > 1;
            return (
              <div
                key={l.id}
                onClick={() => toggle_sel(l.id)}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-lg cursor-pointer transition-all
                  ${is_sel ? "bg-destructive/10 border border-destructive/30" : "hover:bg-muted/50 border border-transparent"}`}
              >
                <div className="h-5 w-5 rounded border-2 border-destructive/40 flex items-center justify-center shrink-0">
                  {is_sel && <Check className="h-3 w-3 text-destructive" />}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-medium truncate">{fmt_date(l.data)} · {l.ora_inizio?.slice(0, 5)}</p>
                    {is_semi && <span className="text-xs bg-secondary text-secondary-foreground px-1.5 py-0.5 rounded">Semi</span>}
                  </div>
                  <p className="text-xs text-muted-foreground truncate">
                    {istr ? `${istr.nome} ${istr.cognome}` : "—"} · {nomi || "Nessuna atleta"}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Bottone elimina */}
      {selezionate.size > 0 && (
        <Button variant="destructive" onClick={() => set_conferma_open(true)} className="w-full">
          <Trash2 className="h-4 w-4 mr-2" />
          Elimina {selezionate.size} {selezionate.size === 1 ? 'lezione selezionata' : 'lezioni selezionate'}
        </Button>
      )}

      {conferma_open && (
        <ConfermaEliminazioneModal
          ids={Array.from(selezionate)}
          lezioni={lezioni}
          atleti={atleti}
          istruttori={istruttori}
          on_confirm={handle_confirm}
          on_close={() => set_conferma_open(false)}
          loading={annulla.isPending}
        />
      )}
    </div>
  );
};

// ─── Pagina principale ────────────────────────────────────────────────────────
const AdvancedManagementPage: React.FC = () => {
  const { data: lezioni = [], isLoading } = use_lezioni_private();
  const { data: istruttori = [] } = use_istruttori();
  const { data: atleti = [] } = use_atleti();

  if (isLoading)
    return (
      <div className="flex items-center justify-center h-64">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );

  return (
    <div className="space-y-6 p-4 md:p-6 max-w-4xl mx-auto">
      {/* Header con avviso */}
      <div className="space-y-2">
        <div className="flex items-center gap-3">
          <ShieldAlert className="h-7 w-7 text-destructive" />
          <h1 className="text-2xl font-bold text-foreground">Gestione Avanzata</h1>
        </div>
        <p className="text-sm text-muted-foreground">
          Operazioni irreversibili. Tutte le eliminazioni richiedono conferma esplicita.
        </p>
      </div>

      {/* Banner warning */}
      <div className="flex items-center gap-3 bg-destructive/10 border border-destructive/30 rounded-xl px-4 py-3">
        <AlertTriangle className="h-5 w-5 text-destructive shrink-0" />
        <p className="text-sm text-destructive">
          Le operazioni in questa pagina eliminano dati in modo definitivo e non possono essere annullate.
        </p>
      </div>

      <div className="space-y-6">
        <SezioneRicorrenze lezioni={lezioni} istruttori={istruttori} atleti={atleti} />
        <SezioneSelezioneMolteplice lezioni={lezioni} istruttori={istruttori} atleti={atleti} />
      </div>
    </div>
  );
};

export default AdvancedManagementPage;
