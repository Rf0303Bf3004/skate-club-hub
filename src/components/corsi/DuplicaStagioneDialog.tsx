import React, { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { X, Copy, Search, Loader2 } from "lucide-react";
import { supabase, get_current_club_id } from "@/lib/supabase";
import { toast } from "@/hooks/use-toast";

type Props = {
  stagioni: any[];
  corsi: any[];
  stagione_corrente_id: string | null;
  on_close: () => void;
  on_done: () => void;
};

const CAMPI_COPIABILI = [
  "nome", "tipo", "categoria", "costo_mensile", "costo_annuale",
  "note", "livello_richiesto", "livello_id", "percorso",
  "richiede_approvazione", "capienza_max", "usa_ghiaccio",
] as const;

export const DuplicaStagioneDialog: React.FC<Props> = ({
  stagioni, corsi, stagione_corrente_id, on_close, on_done,
}) => {
  const stagioni_sorgente = useMemo(
    () => (stagioni || []).filter((s: any) => s.id !== stagione_corrente_id),
    [stagioni, stagione_corrente_id],
  );

  const [sorgente_id, set_sorgente_id] = useState<string>(stagioni_sorgente[0]?.id || "");
  const [copia_orari, set_copia_orari] = useState(true);
  const [copia_istruttori, set_copia_istruttori] = useState(true);
  const [ricerca, set_ricerca] = useState("");
  const [esclusi, set_esclusi] = useState<Set<string>>(new Set());
  const [saving, set_saving] = useState(false);

  const corsi_sorgente = useMemo(
    () => (corsi || []).filter((c: any) => c.stagione_id === sorgente_id),
    [corsi, sorgente_id],
  );

  const corsi_visibili = useMemo(() => {
    const q = ricerca.trim().toLowerCase();
    if (!q) return corsi_sorgente;
    return corsi_sorgente.filter((c: any) => (c.nome || "").toLowerCase().includes(q));
  }, [corsi_sorgente, ricerca]);

  const selezionati = corsi_sorgente.filter((c: any) => !esclusi.has(c.id));

  const toggle = (id: string) => {
    set_esclusi((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const duplica = async () => {
    if (!stagione_corrente_id) {
      toast({ title: "Nessuna stagione attiva", description: "Imposta una stagione attiva prima di duplicare.", variant: "destructive" });
      return;
    }
    if (selezionati.length === 0) return;
    set_saving(true);
    try {
      const club_id = get_current_club_id();
      const payloads = selezionati.map((c: any) => {
        const row: any = { club_id, stagione_id: stagione_corrente_id, attivo: true };
        CAMPI_COPIABILI.forEach((k) => {
          if (c[k] !== undefined) row[k] = c[k];
        });
        row.giorno = copia_orari ? c.giorno ?? null : null;
        row.ora_inizio = copia_orari ? c.ora_inizio ?? null : null;
        row.ora_fine = copia_orari ? c.ora_fine ?? null : null;
        return row;
      });

      const { data: inseriti, error } = await supabase.from("corsi").insert(payloads).select("id");
      if (error) throw error;

      if (copia_istruttori && inseriti) {
        const rows: { corso_id: string; istruttore_id: string }[] = [];
        inseriti.forEach((nuovo: any, idx: number) => {
          (selezionati[idx]?.istruttori_ids || []).forEach((istruttore_id: string) => {
            rows.push({ corso_id: nuovo.id, istruttore_id });
          });
        });
        if (rows.length > 0) {
          const { error: e_istr } = await supabase
            .from("corsi_istruttori")
            .upsert(rows, { onConflict: "corso_id,istruttore_id" });
          if (e_istr) throw e_istr;
        }
      }

      toast({
        title: `✅ ${selezionati.length} corsi duplicati`,
        description: "Gli iscritti non vengono copiati. Controlla la barra di avanzamento per ciò che resta da collocare.",
      });
      on_done();
      on_close();
    } catch (err: any) {
      toast({ title: "Errore duplicazione", description: err?.message, variant: "destructive" });
    } finally {
      set_saving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-end md:items-center justify-center p-0 md:p-6">
      <div className="bg-card w-full md:max-w-2xl md:rounded-2xl rounded-t-2xl shadow-xl max-h-[92vh] flex flex-col">
        <div className="flex items-center justify-between px-5 py-4 border-b border-border">
          <div>
            <h2 className="text-base font-bold text-foreground">Duplica da stagione precedente</h2>
            <p className="text-xs text-muted-foreground">Gli iscritti non vengono copiati.</p>
          </div>
          <button onClick={on_close} className="p-2 rounded-lg hover:bg-muted" aria-label="Chiudi">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-5 space-y-4 overflow-y-auto">
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Stagione sorgente</label>
            <select
              value={sorgente_id}
              onChange={(e) => { set_sorgente_id(e.target.value); set_esclusi(new Set()); }}
              className="w-full rounded-lg border border-border bg-background px-3 py-2.5 text-sm"
            >
              {stagioni_sorgente.length === 0 && <option value="">Nessuna stagione disponibile</option>}
              {stagioni_sorgente.map((s: any) => (
                <option key={s.id} value={s.id}>{s.nome}</option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <label className="flex items-center justify-between gap-3 rounded-lg border border-border px-3 py-2.5">
              <span className="text-sm text-foreground">Copia giorno e orario</span>
              <Switch checked={copia_orari} onCheckedChange={set_copia_orari} />
            </label>
            <label className="flex items-center justify-between gap-3 rounded-lg border border-border px-3 py-2.5">
              <span className="text-sm text-foreground">Copia istruttori</span>
              <Switch checked={copia_istruttori} onCheckedChange={set_copia_istruttori} />
            </label>
          </div>

          <div className="relative">
            <Search className="w-4 h-4 text-muted-foreground absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              value={ricerca}
              onChange={(e) => set_ricerca(e.target.value)}
              placeholder="Cerca corso…"
              className="w-full rounded-lg border border-border bg-background pl-9 pr-9 py-2.5 text-sm"
            />
            {ricerca && (
              <button
                onClick={() => set_ricerca("")}
                className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 rounded hover:bg-muted"
                aria-label="Cancella ricerca"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>{selezionati.length} corsi selezionati su {corsi_sorgente.length}</span>
            <div className="flex gap-2">
              <button className="underline" onClick={() => set_esclusi(new Set())}>Tutti</button>
              <button className="underline" onClick={() => set_esclusi(new Set(corsi_sorgente.map((c: any) => c.id)))}>Nessuno</button>
            </div>
          </div>

          <div className="space-y-1.5">
            {corsi_visibili.length === 0 && (
              <p className="text-sm text-muted-foreground py-6 text-center">Nessun corso in questa stagione.</p>
            )}
            {corsi_visibili.map((c: any) => (
              <label
                key={c.id}
                className="flex items-center gap-3 rounded-lg border border-border/60 px-3 py-2.5 cursor-pointer hover:border-primary/40"
              >
                <input
                  type="checkbox"
                  checked={!esclusi.has(c.id)}
                  onChange={() => toggle(c.id)}
                  className="w-5 h-5 accent-primary"
                />
                <span className="flex-1 text-sm font-medium text-foreground truncate">{c.nome}</span>
                {c.tipo && <Badge variant="secondary" className="text-[10px]">{c.tipo}</Badge>}
                <span className="text-xs text-muted-foreground tabular-nums">
                  {c.giorno ? `${c.giorno} ${c.ora_inizio?.slice(0, 5) ?? ""}` : "—"}
                </span>
              </label>
            ))}
          </div>
        </div>

        <div className="px-5 py-4 border-t border-border flex justify-end gap-2">
          <Button variant="ghost" onClick={on_close}>Annulla</Button>
          <Button onClick={duplica} disabled={saving || selezionati.length === 0 || !sorgente_id}>
            {saving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Copy className="w-4 h-4 mr-2" />}
            Duplica {selezionati.length > 0 ? `(${selezionati.length})` : ""}
          </Button>
        </div>
      </div>
    </div>
  );
};
