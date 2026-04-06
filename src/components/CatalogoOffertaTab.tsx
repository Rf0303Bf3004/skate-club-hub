import React, { useState, useEffect, useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase, get_current_club_id } from "@/lib/supabase";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from "@/hooks/use-toast";
import { Loader2 } from "lucide-react";

// ── Constants ──
const LIVELLI_ORDINE = [
  "pulcini", "stellina1", "stellina2", "stellina3", "stellina4",
  "Interbronzo", "Bronzo", "Interargento", "Argento", "Interoro", "Oro",
] as const;

const LIVELLI_COLORI: Record<string, string> = {
  pulcini: "#C53030",
  stellina1: "#276749",
  stellina2: "#2B6CB0",
  stellina3: "#B7791F",
  stellina4: "#6B46C1",
  Interbronzo: "#C53030",
  Bronzo: "#276749",
  Interargento: "#2B6CB0",
  Argento: "#B7791F",
  Interoro: "#6B46C1",
  Oro: "#C53030",
};

const LIVELLI_LABELS: Record<string, string> = {
  pulcini: "Pulcini",
  stellina1: "Stellina 1",
  stellina2: "Stellina 2",
  stellina3: "Stellina 3",
  stellina4: "Stellina 4",
  Interbronzo: "Interbronzo",
  Bronzo: "Bronzo",
  Interargento: "Interargento",
  Argento: "Argento",
  Interoro: "Interoro",
  Oro: "Oro",
};

interface LivelloRow {
  id?: string;
  livello: string;
  iscritti_attuali: number;
  max_atleti_pista: number;
  max_per_monitrice: number;
  lezioni_per_settimana: number;
  durata_minuti: number;
  costo_annuale: number;
  tipo_sessione_default: string;
  atleti_per_area: number;
  usa_corsie: boolean;
  [key: string]: any;
}

interface PacchettoRow {
  id?: string;
  nome: string;
  durata_minuti: number;
  costo_1_sessione: number;
  costo_2_sessioni: number;
  sconto_combinato_perc: number;
  iscritti_1_sessione: number;
  iscritti_2_sessioni: number;
  attivo: boolean;
  [key: string]: any;
}

// ── Hooks ──
function use_catalogo_livelli(club_id: string | null) {
  return useQuery({
    queryKey: ["catalogo_livelli", club_id],
    enabled: !!club_id,
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("catalogo_livelli")
        .select("*")
        .eq("club_id", club_id);
      if (error) throw error;
      return (data ?? []) as LivelloRow[];
    },
  });
}

function use_catalogo_pacchetti(club_id: string | null) {
  return useQuery({
    queryKey: ["catalogo_pacchetti_opzionali", club_id],
    enabled: !!club_id,
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("catalogo_pacchetti_opzionali")
        .select("*")
        .eq("club_id", club_id);
      if (error) throw error;
      return (data ?? []) as PacchettoRow[];
    },
  });
}

// ── Component ──
interface Props {
  club_id?: string | null;
  stagione_id: string | null;
}

const CatalogoOffertaTab: React.FC<Props> = ({ club_id, stagione_id }) => {
  const resolved_club_id = club_id || get_current_club_id() || null;
  const queryClient = useQueryClient();
  const { data: livelli_raw = [], isLoading: loading_livelli } = use_catalogo_livelli(resolved_club_id, stagione_id);
  const { data: pacchetti_raw = [], isLoading: loading_pacchetti } = use_catalogo_pacchetti(resolved_club_id, stagione_id);

  const [livelli, set_livelli] = useState<LivelloRow[]>([]);
  const [pacchetti, set_pacchetti] = useState<PacchettoRow[]>([]);
  const [saving_livelli, set_saving_livelli] = useState(false);
  const [saving_pacchetti, set_saving_pacchetti] = useState(false);

  useEffect(() => {
    console.log("CatalogoOfferta debug:", {
      club_id: get_current_club_id(),
      stagione_id,
      effective_club_id: resolved_club_id,
    });
  }, [resolved_club_id, stagione_id]);

  // Sync from DB, ordered by LIVELLI_ORDINE
  useEffect(() => {
    if (livelli_raw.length > 0) {
      const sorted = [...livelli_raw].sort((a, b) => {
        const ia = LIVELLI_ORDINE.indexOf(a.livello as any);
        const ib = LIVELLI_ORDINE.indexOf(b.livello as any);
        return (ia === -1 ? 99 : ia) - (ib === -1 ? 99 : ib);
      });
      set_livelli(sorted);
    } else {
      set_livelli([]);
    }
  }, [livelli_raw]);

  useEffect(() => {
    if (pacchetti_raw.length > 0) set_pacchetti([...pacchetti_raw]);
    else set_pacchetti([]);
  }, [pacchetti_raw]);

  // ── Livelli helpers ──
  const update_livello = (idx: number, field: string, value: any) => {
    set_livelli((prev) => prev.map((r, i) => {
      if (i !== idx) return r;
      const updated = { ...r, [field]: value };
      // auto-set usa_corsie
      if (field === "tipo_sessione_default") {
        updated.usa_corsie = value === "aree_pista";
      }
      return updated;
    }));
  };

  const calc_gruppi = (r: LivelloRow) => {
    if (!r.max_per_monitrice || r.max_per_monitrice <= 0) return 0;
    return Math.ceil((r.iscritti_attuali || 0) / r.max_per_monitrice);
  };

  const calc_ore_sett = (r: LivelloRow) => {
    const gruppi = calc_gruppi(r);
    return (gruppi * (r.lezioni_per_settimana || 0) * (r.durata_minuti || 0) / 60);
  };

  const gruppi_color = (g: number) => {
    if (g <= 3) return "text-green-600";
    if (g <= 6) return "text-orange-500";
    return "text-red-600";
  };

  // ── Summary ──
  const summary = useMemo(() => {
    const tot_iscritti = livelli.reduce((s, r) => s + (r.iscritti_attuali || 0), 0);
    const tot_slot = livelli.reduce((s, r) => s + calc_gruppi(r) * (r.lezioni_per_settimana || 0), 0);
    const tot_ore = livelli.reduce((s, r) => s + calc_ore_sett(r), 0);
    const ore_disponibili = 17.5;
    const surplus = ore_disponibili - tot_ore;
    return { tot_iscritti, tot_slot, tot_ore, ore_disponibili, surplus };
  }, [livelli]);

  // ── Save livelli ──
  const save_livelli = async () => {
    set_saving_livelli(true);
    try {
      const promises = livelli.filter((r) => r.id).map((r) => {
        const { id, ...rest } = r;
        return (supabase as any).from("catalogo_livelli").update({
          iscritti_attuali: r.iscritti_attuali || 0,
          max_atleti_pista: r.max_atleti_pista || 1,
          max_per_monitrice: r.max_per_monitrice || 1,
          lezioni_per_settimana: r.lezioni_per_settimana || 1,
          durata_minuti: r.durata_minuti || 15,
          costo_annuale: r.costo_annuale || 0,
          tipo_sessione_default: r.tipo_sessione_default || "standard",
          atleti_per_area: r.atleti_per_area || 0,
          usa_corsie: r.tipo_sessione_default === "aree_pista",
        }).eq("id", id);
      });
      const results = await Promise.all(promises);
      const err = results.find((r: any) => r.error);
      if (err?.error) throw err.error;
      toast({ title: "✅ Parametri per livello salvati" });
      queryClient.invalidateQueries({ queryKey: ["catalogo_livelli"] });
    } catch (e: any) {
      toast({ title: "Errore salvataggio", description: e?.message, variant: "destructive" });
    } finally {
      set_saving_livelli(false);
    }
  };

  // ── Save pacchetti ──
  const save_pacchetti = async () => {
    set_saving_pacchetti(true);
    try {
      const promises = pacchetti.filter((r) => r.id).map((r) => {
        return (supabase as any).from("catalogo_pacchetti_opzionali").update({
          durata_minuti: r.durata_minuti || 0,
          costo_1_sessione: r.costo_1_sessione || 0,
          costo_2_sessioni: r.costo_2_sessioni || 0,
          sconto_combinato_perc: r.sconto_combinato_perc || 0,
          iscritti_1_sessione: r.iscritti_1_sessione || 0,
          iscritti_2_sessioni: r.iscritti_2_sessioni || 0,
          attivo: r.attivo ?? true,
        }).eq("id", r.id);
      });
      const results = await Promise.all(promises);
      const err = results.find((r: any) => r.error);
      if (err?.error) throw err.error;
      toast({ title: "✅ Pacchetti opzionali salvati" });
      queryClient.invalidateQueries({ queryKey: ["catalogo_pacchetti_opzionali"] });
    } catch (e: any) {
      toast({ title: "Errore salvataggio", description: e?.message, variant: "destructive" });
    } finally {
      set_saving_pacchetti(false);
    }
  };

  // ── Pacchetti helpers ──
  const update_pacchetto = (idx: number, field: string, value: any) => {
    set_pacchetti((prev) => prev.map((r, i) => (i === idx ? { ...r, [field]: value } : r)));
  };

  if (loading_livelli || loading_pacchetti) {
    return (
      <div className="flex items-center justify-center h-40">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* ═══ Sezione 1 — Parametri per livello ═══ */}
      <div className="bg-card rounded-xl shadow-card p-6 space-y-6">
        <h2 className="text-lg font-bold text-foreground">📊 Parametri per livello</h2>

        {livelli.length === 0 ? (
          <p className="text-sm text-muted-foreground italic">Nessun livello configurato</p>
        ) : (
          <>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="min-w-[120px]">Livello</TableHead>
                    <TableHead className="w-[70px]">Iscritti</TableHead>
                    <TableHead className="w-[80px]">Max pista</TableHead>
                    <TableHead className="w-[85px]">Max/monitr.</TableHead>
                    <TableHead className="w-[70px]">Lez/sett</TableHead>
                    <TableHead className="w-[80px]">Durata (min)</TableHead>
                    <TableHead className="w-[100px]">Costo annuo</TableHead>
                    <TableHead className="w-[120px]">Tipo sessione</TableHead>
                    <TableHead className="w-[80px]">Atl/area</TableHead>
                    <TableHead className="w-[60px]">Gruppi</TableHead>
                    <TableHead className="w-[70px]">Ore/sett</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {livelli.map((r, idx) => {
                    const gruppi = calc_gruppi(r);
                    const ore = calc_ore_sett(r);
                    return (
                      <TableRow key={r.id || idx}>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <span
                              className="w-3 h-3 rounded-full flex-shrink-0"
                              style={{ backgroundColor: LIVELLI_COLORI[r.livello] || "#999" }}
                            />
                            <span className="text-sm font-medium text-foreground">
                              {LIVELLI_LABELS[r.livello] || r.livello}
                            </span>
                          </div>
                        </TableCell>
                        <TableCell>
                          <Input
                            type="number"
                            min={0}
                            value={r.iscritti_attuali ?? 0}
                            onChange={(e) => update_livello(idx, "iscritti_attuali", parseInt(e.target.value) || 0)}
                            className="h-8 w-16 text-xs"
                          />
                        </TableCell>
                        <TableCell>
                          <Input
                            type="number"
                            min={1}
                            value={r.max_atleti_pista ?? 1}
                            onChange={(e) => update_livello(idx, "max_atleti_pista", parseInt(e.target.value) || 1)}
                            className="h-8 w-16 text-xs"
                          />
                        </TableCell>
                        <TableCell>
                          <Input
                            type="number"
                            min={1}
                            value={r.max_per_monitrice ?? 1}
                            onChange={(e) => update_livello(idx, "max_per_monitrice", parseInt(e.target.value) || 1)}
                            className="h-8 w-16 text-xs"
                          />
                        </TableCell>
                        <TableCell>
                          <Input
                            type="number"
                            min={1}
                            max={7}
                            value={r.lezioni_per_settimana ?? 1}
                            onChange={(e) => update_livello(idx, "lezioni_per_settimana", Math.min(7, parseInt(e.target.value) || 1))}
                            className="h-8 w-14 text-xs"
                          />
                        </TableCell>
                        <TableCell>
                          <Input
                            type="number"
                            min={15}
                            step={5}
                            value={r.durata_minuti ?? 15}
                            onChange={(e) => update_livello(idx, "durata_minuti", parseInt(e.target.value) || 15)}
                            className="h-8 w-16 text-xs"
                          />
                        </TableCell>
                        <TableCell>
                          <Input
                            type="number"
                            min={0}
                            value={r.costo_annuale ?? 0}
                            onChange={(e) => update_livello(idx, "costo_annuale", parseFloat(e.target.value) || 0)}
                            className="h-8 w-20 text-xs"
                          />
                        </TableCell>
                        <TableCell>
                          <Select
                            value={r.tipo_sessione_default || "standard"}
                            onValueChange={(v) => update_livello(idx, "tipo_sessione_default", v)}
                          >
                            <SelectTrigger className="h-8 text-xs w-[110px]">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="standard">Standard</SelectItem>
                              <SelectItem value="aree_pista">Aree pista</SelectItem>
                              <SelectItem value="officestripe">Officestripe</SelectItem>
                            </SelectContent>
                          </Select>
                        </TableCell>
                        <TableCell>
                          {r.tipo_sessione_default === "aree_pista" ? (
                            <Input
                              type="number"
                              min={1}
                              value={r.atleti_per_area ?? 0}
                              onChange={(e) => update_livello(idx, "atleti_per_area", parseInt(e.target.value) || 0)}
                              className="h-8 w-14 text-xs"
                            />
                          ) : (
                            <span className="text-muted-foreground text-xs">—</span>
                          )}
                        </TableCell>
                        <TableCell>
                          <span className={`text-sm font-bold ${gruppi_color(gruppi)}`}>{gruppi}</span>
                        </TableCell>
                        <TableCell>
                          <span className="text-sm text-foreground">{ore.toFixed(1)}h</span>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>

            {/* Riepilogo */}
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 mt-4">
              <SummaryCard label="Totale iscritti" value={String(summary.tot_iscritti)} />
              <SummaryCard label="Slot ghiaccio/sett" value={String(summary.tot_slot)} />
              <SummaryCard label="Ore necessarie" value={`${summary.tot_ore.toFixed(1)}h`} />
              <SummaryCard label="Ore disponibili" value={`${summary.ore_disponibili}h`} />
              <SummaryCard
                label="Surplus/deficit"
                value={`${summary.surplus >= 0 ? "+" : ""}${summary.surplus.toFixed(1)}h`}
                color={summary.surplus >= 0 ? "text-green-600" : "text-red-600"}
              />
            </div>

            <div className="flex justify-end">
              <Button onClick={save_livelli} disabled={saving_livelli}>
                {saving_livelli ? <><Loader2 className="w-4 h-4 animate-spin mr-2" /> Salvataggio...</> : "Salva tutto"}
              </Button>
            </div>
          </>
        )}
      </div>

      {/* ═══ Sezione 2 — Pacchetti opzionali ═══ */}
      <div className="bg-card rounded-xl shadow-card p-6 space-y-6">
        <h2 className="text-lg font-bold text-foreground">📦 Pacchetti opzionali</h2>

        {pacchetti.length === 0 ? (
          <p className="text-sm text-muted-foreground italic">Nessun pacchetto configurato</p>
        ) : (
          <>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="min-w-[120px]">Nome</TableHead>
                    <TableHead className="w-[80px]">Durata (min)</TableHead>
                    <TableHead className="w-[110px]">1 sess. (CHF/m)</TableHead>
                    <TableHead className="w-[110px]">2 sess. (CHF/m)</TableHead>
                    <TableHead className="w-[90px]">Sconto %</TableHead>
                    <TableHead className="w-[80px]">Iscritti 1s</TableHead>
                    <TableHead className="w-[80px]">Iscritti 2s</TableHead>
                    <TableHead className="w-[60px]">Attivo</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {pacchetti.map((r, idx) => (
                    <TableRow key={r.id || idx}>
                      <TableCell>
                        <span className="text-sm font-medium text-foreground">{r.nome}</span>
                      </TableCell>
                      <TableCell>
                        <Input
                          type="number"
                          min={0}
                          value={r.durata_minuti ?? 0}
                          onChange={(e) => update_pacchetto(idx, "durata_minuti", parseInt(e.target.value) || 0)}
                          className="h-8 w-16 text-xs"
                        />
                      </TableCell>
                      <TableCell>
                        <Input
                          type="number"
                          min={0}
                          value={r.costo_1_sessione ?? 0}
                          onChange={(e) => update_pacchetto(idx, "costo_1_sessione", parseFloat(e.target.value) || 0)}
                          className="h-8 w-20 text-xs"
                        />
                      </TableCell>
                      <TableCell>
                        <Input
                          type="number"
                          min={0}
                          value={r.costo_2_sessioni ?? 0}
                          onChange={(e) => update_pacchetto(idx, "costo_2_sessioni", parseFloat(e.target.value) || 0)}
                          className="h-8 w-20 text-xs"
                        />
                      </TableCell>
                      <TableCell>
                        <Input
                          type="number"
                          min={0}
                          max={100}
                          value={r.sconto_combinato_perc ?? 0}
                          onChange={(e) => update_pacchetto(idx, "sconto_combinato_perc", parseFloat(e.target.value) || 0)}
                          className="h-8 w-16 text-xs"
                        />
                      </TableCell>
                      <TableCell>
                        <Input
                          type="number"
                          min={0}
                          value={r.iscritti_1_sessione ?? 0}
                          onChange={(e) => update_pacchetto(idx, "iscritti_1_sessione", parseInt(e.target.value) || 0)}
                          className="h-8 w-16 text-xs"
                        />
                      </TableCell>
                      <TableCell>
                        <Input
                          type="number"
                          min={0}
                          value={r.iscritti_2_sessioni ?? 0}
                          onChange={(e) => update_pacchetto(idx, "iscritti_2_sessioni", parseInt(e.target.value) || 0)}
                          className="h-8 w-16 text-xs"
                        />
                      </TableCell>
                      <TableCell>
                        <Switch
                          checked={r.attivo ?? true}
                          onCheckedChange={(v) => update_pacchetto(idx, "attivo", v)}
                        />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>

            <div className="flex justify-end">
              <Button onClick={save_pacchetti} disabled={saving_pacchetti}>
                {saving_pacchetti ? <><Loader2 className="w-4 h-4 animate-spin mr-2" /> Salvataggio...</> : "Salva tutto"}
              </Button>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

const SummaryCard: React.FC<{ label: string; value: string; color?: string }> = ({ label, value, color }) => (
  <div className="bg-muted/50 rounded-lg p-3 text-center">
    <p className="text-xs text-muted-foreground">{label}</p>
    <p className={`text-lg font-bold ${color || "text-foreground"}`}>{value}</p>
  </div>
);

export default CatalogoOffertaTab;
