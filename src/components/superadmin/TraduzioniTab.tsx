import { useEffect, useMemo, useState } from "react";
import { Globe, RefreshCw, Search, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "@/hooks/use-toast";
import { supabase } from "@/lib/supabase";
import { applica_riga_i18n, type RigaTraduzione } from "@/i18n/db-loader";

const LINGUE = ["it", "de", "fr", "rm", "en"] as const;
type Lingua = (typeof LINGUE)[number];

interface Riga extends RigaTraduzione {
  id: string;
}

function is_incompleta(r: Riga) {
  return (["de", "fr", "rm", "en"] as Lingua[]).some((l) => !((r[l] ?? "").toString().trim()));
}

interface Props {
  on_log?: (msg: string) => void;
}

export default function TraduzioniTab({ on_log }: Props) {
  const [righe, set_righe] = useState<Riga[]>([]);
  const [loading, set_loading] = useState(true);
  const [namespace_sel, set_namespace_sel] = useState<string>("");
  const [ricerca, set_ricerca] = useState("");
  const [solo_incomplete, set_solo_incomplete] = useState(false);
  const [salvate, set_salvate] = useState<Record<string, number>>({});
  const [modificate, set_modificate] = useState<Record<string, boolean>>({});

  const carica = async () => {
    set_loading(true);
    try {
      const acc: Riga[] = [];
      const page = 1000;
      for (let from = 0; ; from += page) {
        const { data, error } = await supabase
          .from("traduzioni_ui")
          .select("id,namespace,chiave,it,de,fr,rm,en")
          .order("namespace")
          .order("chiave")
          .range(from, from + page - 1);
        if (error) throw error;
        const batch = (data ?? []) as Riga[];
        acc.push(...batch);
        if (batch.length < page) break;
      }
      set_righe(acc);
      if (!namespace_sel && acc.length) set_namespace_sel(acc[0].namespace);
    } catch (err: any) {
      toast({ title: "Errore caricamento traduzioni", description: err?.message, variant: "destructive" });
    } finally {
      set_loading(false);
    }
  };

  useEffect(() => {
    carica();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const namespaces = useMemo(() => {
    const map = new Map<string, number>();
    for (const r of righe) {
      map.set(r.namespace, (map.get(r.namespace) ?? 0) + (is_incompleta(r) ? 1 : 0));
    }
    return Array.from(map.entries()).sort((a, b) => a[0].localeCompare(b[0]));
  }, [righe]);

  const filtrate = useMemo(() => {
    const q = ricerca.trim().toLowerCase();
    return righe.filter((r) => {
      if (namespace_sel && r.namespace !== namespace_sel) return false;
      if (solo_incomplete && !is_incompleta(r)) return false;
      if (!q) return true;
      if (r.chiave.toLowerCase().includes(q)) return true;
      return LINGUE.some((l) => ((r[l] ?? "") as string).toLowerCase().includes(q));
    });
  }, [righe, namespace_sel, ricerca, solo_incomplete]);

  const aggiorna_locale = (id: string, lingua: Lingua, valore: string) => {
    set_righe((prev) => prev.map((r) => (r.id === id ? { ...r, [lingua]: valore } : r)));
    set_modificate((prev) => ({ ...prev, [`${id}:${lingua}`]: true }));
  };

  const salva_cella = async (riga: Riga, lingua: Lingua) => {
    if (!modificate[`${riga.id}:${lingua}`]) return;
    const valore = ((riga[lingua] ?? "") as string).trim();
    try {
      const { error } = await supabase
        .from("traduzioni_ui")
        .update({ [lingua]: valore || null, aggiornato_il: new Date().toISOString() })
        .eq("id", riga.id);
      if (error) throw error;
      applica_riga_i18n({ ...riga, [lingua]: valore });
      set_modificate((prev) => {
        const next = { ...prev };
        delete next[`${riga.id}:${lingua}`];
        return next;
      });
      set_salvate((prev) => ({ ...prev, [`${riga.id}:${lingua}`]: Date.now() }));
      on_log?.(`💾 Traduzione ${riga.namespace}.${riga.chiave} [${lingua}] salvata`);
    } catch (err: any) {
      toast({ title: "Errore salvataggio", description: err?.message, variant: "destructive" });
    }
  };

  const incomplete_totali = righe.filter(is_incompleta).length;

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <RefreshCw className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <Globe className="w-5 h-5 text-primary" />
          <h2 className="text-lg font-semibold">Traduzioni interfaccia</h2>
          <Badge variant="outline">{righe.length} chiavi</Badge>
          <Badge variant={incomplete_totali ? "destructive" : "secondary"}>
            {incomplete_totali} incomplete
          </Badge>
        </div>
        <Button variant="outline" size="sm" onClick={carica} className="gap-2">
          <RefreshCw className="w-4 h-4" /> Ricarica
        </Button>
      </div>

      <div className="flex flex-wrap gap-2">
        {namespaces.map(([ns, mancanti]) => (
          <button
            key={ns}
            onClick={() => set_namespace_sel(ns)}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium border transition-all flex items-center gap-2
              ${namespace_sel === ns ? "bg-primary text-primary-foreground border-primary" : "bg-card hover:bg-muted border-border"}`}
          >
            {ns}
            {mancanti > 0 && (
              <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-destructive/20 text-destructive font-semibold">
                {mancanti}
              </span>
            )}
          </button>
        ))}
      </div>

      <div className="flex flex-wrap items-center gap-4">
        <div className="relative flex-1 min-w-[240px]">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={ricerca}
            onChange={(e) => set_ricerca(e.target.value)}
            placeholder="Cerca nella chiave o in un testo qualsiasi..."
            className="pl-9"
          />
        </div>
        <div className="flex items-center gap-2">
          <Switch id="solo_incomplete" checked={solo_incomplete} onCheckedChange={set_solo_incomplete} />
          <Label htmlFor="solo_incomplete" className="cursor-pointer">Solo incomplete</Label>
        </div>
        <span className="text-sm text-muted-foreground">{filtrate.length} righe</span>
      </div>

      <div className="border rounded-xl overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-muted/50">
            <tr>
              <th className="text-left p-2 w-[220px]">Chiave</th>
              {LINGUE.map((l) => (
                <th key={l} className="text-left p-2 uppercase">{l}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtrate.map((r) => (
              <tr key={r.id} className="border-t align-top">
                <td className="p-2 font-mono text-xs text-muted-foreground break-all">{r.chiave}</td>
                {LINGUE.map((l) => {
                  const k = `${r.id}:${l}`;
                  return (
                    <td key={l} className="p-1 min-w-[160px]">
                      <div className="relative">
                        <Textarea
                          rows={1}
                          value={(r[l] ?? "") as string}
                          onChange={(e) => aggiorna_locale(r.id, l, e.target.value)}
                          onBlur={() => salva_cella(r, l)}
                          className={`text-xs min-h-[36px] resize-y ${modificate[k] ? "border-amber-500" : ""}`}
                        />
                        {salvate[k] && !modificate[k] && (
                          <Check className="w-3 h-3 text-emerald-600 absolute right-1 top-1" />
                        )}
                      </div>
                    </td>
                  );
                })}
              </tr>
            ))}
            {filtrate.length === 0 && (
              <tr>
                <td colSpan={6} className="p-6 text-center text-muted-foreground">
                  Nessuna chiave corrisponde ai filtri.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
