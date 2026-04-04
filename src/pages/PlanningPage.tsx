import React, { useState, useMemo, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase, get_current_club_id } from "@/lib/supabase";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Settings, Plus, Trash2, ChevronDown, ChevronUp, Info, X } from "lucide-react";
import { toast } from "@/hooks/use-toast";

// ── Constants ──
const GIORNI = ["Lunedì", "Martedì", "Mercoledì", "Giovedì", "Venerdì", "Sabato", "Domenica"] as const;
const TIPO_COLORI: Record<string, string> = {
  pulcini: "bg-green-500 text-white",
  amatori: "bg-blue-500 text-white",
  artistica: "bg-violet-500 text-white",
  stile: "bg-orange-500 text-white",
  danza: "bg-pink-400 text-white",
  "off-ice": "bg-gray-500 text-white",
  adulti: "bg-teal-500 text-white",
  stretching: "bg-yellow-500 text-white",
};
const OFF_ICE_TYPES = ["danza", "off-ice", "stretching"];

function time_to_min(t: string): number {
  const [h, m] = (t || "00:00").split(":").map(Number);
  return h * 60 + (m || 0);
}
function min_to_time(m: number): string {
  return `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;
}

// ── Ice availability config panel ──
function PannelloDisponibilitaGhiaccio({
  club_id,
  ghiaccio,
  on_saved,
}: {
  club_id: string;
  ghiaccio: any[];
  on_saved: () => void;
}) {
  const [open, set_open] = useState(false);
  const [local, set_local] = useState<Record<string, { ora_inizio: string; ora_fine: string; note: string; id?: string }[]>>({});
  const [saving, set_saving] = useState(false);

  // Initialize local state from ghiaccio data
  const init_local = useCallback(() => {
    const grouped: Record<string, any[]> = {};
    GIORNI.forEach((g) => (grouped[g] = []));
    ghiaccio.forEach((g: any) => {
      const giorno = g.giorno;
      if (!grouped[giorno]) grouped[giorno] = [];
      grouped[giorno].push({
        ora_inizio: (g.ora_inizio || "").slice(0, 5),
        ora_fine: (g.ora_fine || "").slice(0, 5),
        note: g.note || "",
        id: g.id,
      });
    });
    // Sort each day by ora_inizio
    Object.keys(grouped).forEach((g) =>
      grouped[g].sort((a, b) => time_to_min(a.ora_inizio) - time_to_min(b.ora_inizio))
    );
    set_local(grouped);
  }, [ghiaccio]);

  const toggle = () => {
    if (!open) init_local();
    set_open(!open);
  };

  const add_slot = (giorno: string) => {
    set_local((prev) => ({
      ...prev,
      [giorno]: [...(prev[giorno] || []), { ora_inizio: "08:00", ora_fine: "09:00", note: "" }],
    }));
  };

  const update_slot = (giorno: string, idx: number, field: string, value: string) => {
    set_local((prev) => {
      const slots = [...(prev[giorno] || [])];
      slots[idx] = { ...slots[idx], [field]: value };
      return { ...prev, [giorno]: slots };
    });
  };

  const remove_slot = (giorno: string, idx: number) => {
    set_local((prev) => {
      const slots = [...(prev[giorno] || [])];
      slots.splice(idx, 1);
      return { ...prev, [giorno]: slots };
    });
  };

  const save = async () => {
    set_saving(true);
    try {
      // Delete all existing slots for this club
      await supabase.from("disponibilita_ghiaccio").delete().eq("club_id", club_id);
      // Insert new ones
      const rows: any[] = [];
      Object.entries(local).forEach(([giorno, slots]) => {
        slots.forEach((s) => {
          if (s.ora_inizio && s.ora_fine) {
            rows.push({ club_id, giorno, ora_inizio: s.ora_inizio, ora_fine: s.ora_fine, note: s.note || "" });
          }
        });
      });
      if (rows.length > 0) {
        const { error } = await supabase.from("disponibilita_ghiaccio").insert(rows);
        if (error) throw error;
      }
      on_saved();
      toast({ title: "Disponibilità ghiaccio salvata" });
    } catch (err: any) {
      toast({ title: "Errore", description: err?.message, variant: "destructive" });
    } finally {
      set_saving(false);
    }
  };

  return (
    <div className="bg-card rounded-xl border border-border shadow-sm">
      <button
        onClick={toggle}
        className="w-full flex items-center justify-between px-5 py-3 text-sm font-semibold text-foreground hover:bg-muted/30 transition-colors rounded-xl"
      >
        <span className="flex items-center gap-2">
          <span className="w-3 h-3 rounded bg-violet-200 border border-violet-300" />
          Configura disponibilità ghiaccio
        </span>
        {open ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
      </button>

      {open && (
        <div className="px-5 pb-5 space-y-4">
          <div className="flex justify-end">
            <Button size="sm" onClick={save} disabled={saving}>
              {saving ? "Salvataggio..." : "💾 Salva"}
            </Button>
          </div>
          <div className="space-y-3">
            {GIORNI.map((giorno) => {
              const slots = local[giorno] || [];
              return (
                <div key={giorno} className="border border-border/50 rounded-lg p-3">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-medium text-foreground">{giorno}</span>
                    <Button variant="ghost" size="sm" onClick={() => add_slot(giorno)} className="h-7 text-xs">
                      <Plus className="w-3 h-3 mr-1" /> Slot
                    </Button>
                  </div>
                  {slots.length === 0 && <p className="text-xs text-muted-foreground">Nessuno slot</p>}
                  {slots.map((s, idx) => (
                    <div key={idx} className="flex items-center gap-2 mb-1">
                      <Input
                        type="time"
                        value={s.ora_inizio}
                        onChange={(e) => update_slot(giorno, idx, "ora_inizio", e.target.value)}
                        className="w-28 h-8 text-xs"
                      />
                      <span className="text-muted-foreground text-xs">—</span>
                      <Input
                        type="time"
                        value={s.ora_fine}
                        onChange={(e) => update_slot(giorno, idx, "ora_fine", e.target.value)}
                        className="w-28 h-8 text-xs"
                      />
                      <Input
                        value={s.note}
                        onChange={(e) => update_slot(giorno, idx, "note", e.target.value)}
                        placeholder="Note..."
                        className="flex-1 h-8 text-xs"
                      />
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => remove_slot(giorno, idx)}
                        className="h-7 w-7 p-0 text-destructive"
                      >
                        <Trash2 className="w-3 h-3" />
                      </Button>
                    </div>
                  ))}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Weekly Planning View ──
function VistaPlanningSettimanale({
  ghiaccio,
  corsi,
  corsi_istruttori_raw,
  istruttori_raw,
  disp_istruttori,
  config,
}: {
  ghiaccio: any[];
  corsi: any[];
  corsi_istruttori_raw: any[];
  istruttori_raw: any[];
  disp_istruttori: any[];
  config: any;
}) {
  const [selected_detail, set_selected_detail] = useState<any>(null);

  const ora_inizio = config?.ora_inizio_giornata?.slice(0, 5) || "06:00";
  const ora_fine = config?.ora_fine_giornata?.slice(0, 5) || "22:30";
  const durata = config?.durata_slot_minuti || 20;

  // Build time columns
  const time_cols = useMemo(() => {
    const cols: string[] = [];
    const s = time_to_min(ora_inizio);
    const e = time_to_min(ora_fine);
    for (let t = s; t < e; t += durata) cols.push(min_to_time(t));
    return cols;
  }, [ora_inizio, ora_fine, durata]);

  // Istruttori map
  const istruttori_map = useMemo(() => {
    const m: Record<string, any> = {};
    istruttori_raw.forEach((ist: any) => {
      m[ist.id] = ist;
    });
    return m;
  }, [istruttori_raw]);

  // Corso → istruttore
  const corso_istruttore = useMemo(() => {
    const m: Record<string, string> = {};
    corsi_istruttori_raw.forEach((ci: any) => {
      m[ci.corso_id] = ci.istruttore_id;
    });
    return m;
  }, [corsi_istruttori_raw]);

  // Check if slot has ice
  const has_ice = useCallback(
    (giorno: string, slot_min: number): boolean => {
      return ghiaccio.some((g: any) => {
        if (g.giorno !== giorno) return false;
        return slot_min >= time_to_min(g.ora_inizio) && slot_min < time_to_min(g.ora_fine);
      });
    },
    [ghiaccio]
  );

  // Ice courses (require ghiaccio)
  const ice_corsi = useMemo(() => corsi.filter((c: any) => !OFF_ICE_TYPES.includes((c.tipo || "").toLowerCase())), [corsi]);
  // Off-ice courses
  const off_ice_corsi = useMemo(() => corsi.filter((c: any) => OFF_ICE_TYPES.includes((c.tipo || "").toLowerCase())), [corsi]);

  // Get course occupying a slot
  const get_corso_at = useCallback(
    (giorno: string, slot_min: number, course_list: any[]) => {
      return course_list.find((c: any) => {
        if (c.giorno !== giorno) return false;
        const ci = time_to_min(c.ora_inizio);
        const cf = time_to_min(c.ora_fine);
        return slot_min >= ci && slot_min < cf;
      });
    },
    []
  );

  // Is start of course
  const is_corso_start = useCallback(
    (giorno: string, slot_min: number, course_list: any[]) => {
      return course_list.find((c: any) => c.giorno === giorno && time_to_min(c.ora_inizio) === slot_min);
    },
    []
  );

  // Corso span in columns
  const get_span = useCallback(
    (corso: any) => {
      const ci = time_to_min(corso.ora_inizio);
      const cf = time_to_min(corso.ora_fine);
      return Math.max(1, Math.round((cf - ci) / durata));
    },
    [durata]
  );

  // Count available instructors in slot
  const count_istruttori_disponibili = useCallback(
    (giorno: string, slot_min: number): number => {
      const slot_end = slot_min + durata;
      // Get instructor IDs busy with courses in this slot
      const busy_ids = new Set<string>();
      ice_corsi.forEach((c: any) => {
        if (c.giorno !== giorno) return;
        const ci = time_to_min(c.ora_inizio);
        const cf = time_to_min(c.ora_fine);
        if (slot_min >= ci && slot_min < cf) {
          const iid = corso_istruttore[c.id];
          if (iid) busy_ids.add(iid);
        }
      });

      let count = 0;
      disp_istruttori.forEach((d: any) => {
        if (d.giorno !== giorno) return;
        if (busy_ids.has(d.istruttore_id)) return;
        const di = time_to_min(d.ora_inizio);
        const df = time_to_min(d.ora_fine);
        if (slot_min >= di && slot_end <= df) count++;
      });
      return count;
    },
    [disp_istruttori, ice_corsi, corso_istruttore, durata]
  );

  const handle_click = (type: string, data: any) => {
    set_selected_detail({ type, ...data });
  };

  const get_istruttore_nome = (corso_id: string) => {
    const iid = corso_istruttore[corso_id];
    if (!iid) return "";
    const ist = istruttori_map[iid];
    return ist ? `${ist.nome} ${ist.cognome}` : "";
  };

  return (
    <div className="space-y-4">
      {/* Legend */}
      <div className="flex flex-wrap gap-3 text-xs items-center">
        <span className="flex items-center gap-1.5">
          <span className="w-3 h-3 rounded bg-violet-200 border border-violet-300" /> Ghiaccio disponibile
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-3 h-3 rounded bg-violet-100 border border-violet-200 text-[8px] font-bold text-violet-600 flex items-center justify-center">P</span> Privati disponibili
        </span>
        {Object.entries(TIPO_COLORI).map(([tipo, cls]) => (
          <span key={tipo} className="flex items-center gap-1.5">
            <span className={`w-3 h-3 rounded ${cls}`} />
            {tipo.charAt(0).toUpperCase() + tipo.slice(1)}
          </span>
        ))}
      </div>

      {/* Horizontal weekly grid */}
      <div className="overflow-x-auto border border-border rounded-lg bg-card">
        <table className="w-full min-w-[900px] border-collapse text-xs">
          <thead>
            <tr>
              <th className="sticky left-0 z-10 bg-muted border-b border-r border-border px-2 py-1.5 text-left w-24 text-muted-foreground">
                Giorno
              </th>
              {time_cols.map((t) => (
                <th key={t} className="border-b border-r border-border px-1 py-1.5 text-center text-muted-foreground font-medium whitespace-nowrap min-w-[60px]">
                  {t}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {/* Ice rows */}
            {GIORNI.map((giorno) => {
              // Precompute to skip columns covered by multi-span courses
              const skip_cols = new Set<number>();
              time_cols.forEach((t, col_idx) => {
                const slot_min = time_to_min(t);
                const corso_start = is_corso_start(giorno, slot_min, ice_corsi);
                if (corso_start) {
                  const span = get_span(corso_start);
                  for (let s = 1; s < span; s++) {
                    if (col_idx + s < time_cols.length) skip_cols.add(col_idx + s);
                  }
                }
              });

              return (
                <tr key={giorno} className="group">
                  <td className="sticky left-0 z-10 bg-muted border-b border-r border-border px-2 py-1 font-medium text-foreground whitespace-nowrap">
                    {giorno}
                  </td>
                  {time_cols.map((t, col_idx) => {
                    if (skip_cols.has(col_idx)) return null;
                    const slot_min = time_to_min(t);
                    const ice = has_ice(giorno, slot_min);
                    const corso_start = is_corso_start(giorno, slot_min, ice_corsi);
                    const corso_occupying = !corso_start ? get_corso_at(giorno, slot_min, ice_corsi) : null;

                    // Course starts here
                    if (corso_start) {
                      const span = get_span(corso_start);
                      const tipo = (corso_start.tipo || "").toLowerCase();
                      const cls = TIPO_COLORI[tipo] || "bg-muted text-foreground";
                      return (
                        <td
                          key={t}
                          colSpan={span}
                          className={`border-b border-r border-border px-1 py-0.5 cursor-pointer hover:opacity-80 transition-opacity ${cls} rounded-sm`}
                          onClick={() =>
                            handle_click("corso", {
                              corso: corso_start,
                              istruttore: get_istruttore_nome(corso_start.id),
                            })
                          }
                        >
                          <div className="truncate font-semibold leading-tight">{corso_start.nome}</div>
                          <div className="truncate opacity-80 leading-tight">{get_istruttore_nome(corso_start.id)}</div>
                        </td>
                      );
                    }

                    // Ice available, no course
                    if (ice && !corso_occupying) {
                      const n_priv = count_istruttori_disponibili(giorno, slot_min);
                      return (
                        <td
                          key={t}
                          className="border-b border-r border-border bg-violet-100 dark:bg-violet-900/20 text-center cursor-pointer hover:bg-violet-200 dark:hover:bg-violet-900/30 transition-colors"
                          onClick={() =>
                            handle_click("privati", { giorno, ora: t, n_istruttori: n_priv })
                          }
                        >
                          {n_priv > 0 && (
                            <span className="text-[10px] font-bold text-violet-700 dark:text-violet-300">
                              Priv.({n_priv})
                            </span>
                          )}
                        </td>
                      );
                    }

                    // No ice
                    return (
                      <td
                        key={t}
                        className="border-b border-r border-border bg-muted/20"
                      />
                    );
                  })}
                </tr>
              );
            })}

            {/* Off-ice row */}
            {off_ice_corsi.length > 0 && (
              <tr className="bg-muted/10">
                <td className="sticky left-0 z-10 bg-muted border-b border-r border-border px-2 py-0.5 font-medium text-muted-foreground text-[10px] uppercase tracking-wider whitespace-nowrap">
                  Off-Ice
                </td>
                {time_cols.map((t, col_idx) => {
                  const slot_min = time_to_min(t);
                  // Check if any off-ice course starts here (across all days)
                  // For off-ice we show all days merged in one row for simplicity — OR we show per day
                  // Actually let's keep it per-slot: show all off-ice courses that include this time regardless of day
                  // But better: show off-ice grouped. Let's render them if ANY off-ice starts at this slot
                  const starts_here = off_ice_corsi.filter(
                    (c: any) => time_to_min(c.ora_inizio) === slot_min
                  );
                  if (starts_here.length > 0) {
                    return (
                      <td key={t} className="border-b border-r border-border px-0.5 py-0.5">
                        {starts_here.map((c: any) => {
                          const tipo = (c.tipo || "").toLowerCase();
                          const cls = TIPO_COLORI[tipo] || "bg-muted text-foreground";
                          return (
                            <div
                              key={c.id}
                              className={`${cls} rounded text-[9px] px-1 py-0.5 truncate cursor-pointer hover:opacity-80 mb-0.5`}
                              onClick={() =>
                                handle_click("corso", {
                                  corso: c,
                                  istruttore: get_istruttore_nome(c.id),
                                })
                              }
                            >
                              {c.nome} ({c.giorno?.slice(0, 3)})
                            </div>
                          );
                        })}
                      </td>
                    );
                  }
                  return <td key={t} className="border-b border-r border-border" />;
                })}
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Detail panel */}
      {selected_detail && (
        <div className="bg-card border border-border rounded-xl p-5 shadow-sm animate-fade-in">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-bold text-foreground">
              {selected_detail.type === "corso" ? "Dettaglio Corso" : "Slot disponibile per lezioni private"}
            </h3>
            <Button variant="ghost" size="sm" onClick={() => set_selected_detail(null)} className="h-7 w-7 p-0">
              <X className="w-4 h-4" />
            </Button>
          </div>

          {selected_detail.type === "corso" && (
            <div className="space-y-2 text-sm">
              <div>
                <span className="text-muted-foreground">Nome: </span>
                <span className="font-medium">{selected_detail.corso.nome}</span>
              </div>
              <div>
                <span className="text-muted-foreground">Tipo: </span>
                <Badge className={TIPO_COLORI[(selected_detail.corso.tipo || "").toLowerCase()] || ""}>
                  {selected_detail.corso.tipo || "—"}
                </Badge>
              </div>
              <div>
                <span className="text-muted-foreground">Giorno: </span>
                <span>{selected_detail.corso.giorno}</span>
              </div>
              <div>
                <span className="text-muted-foreground">Orario: </span>
                <span>
                  {(selected_detail.corso.ora_inizio || "").slice(0, 5)} – {(selected_detail.corso.ora_fine || "").slice(0, 5)}
                </span>
              </div>
              <div>
                <span className="text-muted-foreground">Istruttore: </span>
                <span>{selected_detail.istruttore || "Non assegnato"}</span>
              </div>
              {selected_detail.corso.livello_richiesto && (
                <div>
                  <span className="text-muted-foreground">Livello: </span>
                  <span>{selected_detail.corso.livello_richiesto}</span>
                </div>
              )}
            </div>
          )}

          {selected_detail.type === "privati" && (
            <div className="space-y-2 text-sm">
              <div>
                <span className="text-muted-foreground">Giorno: </span>
                <span>{selected_detail.giorno}</span>
              </div>
              <div>
                <span className="text-muted-foreground">Orario: </span>
                <span>{selected_detail.ora}</span>
              </div>
              <div>
                <span className="text-muted-foreground">Istruttori disponibili: </span>
                <span className="font-semibold text-violet-700 dark:text-violet-300">{selected_detail.n_istruttori}</span>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── Main Page ──
export default function PlanningPage() {
  const { session } = useAuth();
  const club_id = session?.club_id || get_current_club_id();
  const qc = useQueryClient();

  const [config_open, set_config_open] = useState(false);
  const [cfg_ora_inizio, set_cfg_ora_inizio] = useState("06:00");
  const [cfg_ora_fine, set_cfg_ora_fine] = useState("22:30");
  const [cfg_durata, set_cfg_durata] = useState(20);
  const [info_pista_open, set_info_pista_open] = useState(false);

  // ── Queries ──
  const { data: config } = useQuery({
    queryKey: ["impostazioni_planning", club_id],
    queryFn: async () => {
      const { data } = await supabase
        .from("impostazioni_planning")
        .select("*")
        .eq("club_id", club_id)
        .maybeSingle();
      return data;
    },
    enabled: !!club_id,
  });

  const { data: ghiaccio = [], refetch: refetch_ghiaccio } = useQuery({
    queryKey: ["disponibilita_ghiaccio", club_id],
    queryFn: async () => {
      const { data } = await supabase.from("disponibilita_ghiaccio").select("*").eq("club_id", club_id);
      return data || [];
    },
    enabled: !!club_id,
  });

  const { data: corsi = [] } = useQuery({
    queryKey: ["corsi_planning", club_id],
    queryFn: async () => {
      const { data } = await supabase.from("corsi").select("*").eq("club_id", club_id).eq("attivo", true);
      return data || [];
    },
    enabled: !!club_id,
  });

  const { data: corsi_istruttori_raw = [] } = useQuery({
    queryKey: ["corsi_istruttori_planning", club_id],
    queryFn: async () => {
      const { data } = await supabase.from("corsi_istruttori").select("*");
      return data || [];
    },
    enabled: !!club_id,
  });

  const { data: istruttori_raw = [] } = useQuery({
    queryKey: ["istruttori_planning", club_id],
    queryFn: async () => {
      const { data } = await supabase
        .from("atleti")
        .select("id, nome, cognome")
        .eq("club_id", club_id)
        .eq("ruolo_pista", "istruttore");
      return data || [];
    },
    enabled: !!club_id,
  });

  const { data: disp_istruttori = [] } = useQuery({
    queryKey: ["disponibilita_istruttori", club_id],
    queryFn: async () => {
      const { data } = await supabase.from("disponibilita_istruttori").select("*").eq("club_id", club_id);
      return data || [];
    },
    enabled: !!club_id,
  });

  // ── Save config ──
  const save_config = useMutation({
    mutationFn: async () => {
      if (config) {
        await supabase
          .from("impostazioni_planning")
          .update({
            ora_inizio_giornata: cfg_ora_inizio,
            ora_fine_giornata: cfg_ora_fine,
            durata_slot_minuti: cfg_durata,
          })
          .eq("id", config.id);
      } else {
        await supabase.from("impostazioni_planning").insert({
          club_id,
          ora_inizio_giornata: cfg_ora_inizio,
          ora_fine_giornata: cfg_ora_fine,
          durata_slot_minuti: cfg_durata,
        });
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["impostazioni_planning"] });
      set_config_open(false);
      toast({ title: "Configurazione salvata" });
    },
  });

  function open_config() {
    set_cfg_ora_inizio(config?.ora_inizio_giornata?.slice(0, 5) || "06:00");
    set_cfg_ora_fine(config?.ora_fine_giornata?.slice(0, 5) || "22:30");
    set_cfg_durata(config?.durata_slot_minuti || 20);
    set_config_open(true);
  }

  if (!club_id) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="h-8 w-8 animate-spin rounded-full border-b-2 border-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <h1 className="text-2xl font-bold text-foreground">Planning Ghiaccio</h1>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => set_info_pista_open(true)}>
            <Info className="w-4 h-4 mr-1" /> Info occupazione pista
          </Button>
          <Button variant="outline" size="sm" onClick={open_config}>
            <Settings className="w-4 h-4 mr-1" /> Configura Planning
          </Button>
        </div>
      </div>

      {/* SECTION 1: Ice availability config */}
      <PannelloDisponibilitaGhiaccio
        club_id={club_id}
        ghiaccio={ghiaccio}
        on_saved={() => refetch_ghiaccio()}
      />

      {/* SECTION 2: Weekly planning view */}
      <VistaPlanningSettimanale
        ghiaccio={ghiaccio}
        corsi={corsi}
        corsi_istruttori_raw={corsi_istruttori_raw}
        istruttori_raw={istruttori_raw}
        disp_istruttori={disp_istruttori}
        config={config}
      />

      {corsi.length === 0 && ghiaccio.length > 0 && (
        <div className="text-center py-8 text-muted-foreground">
          Nessun corso pianificato. I corsi vengono gestiti dalla pagina Corsi.
        </div>
      )}

      {ghiaccio.length === 0 && (
        <div className="text-center py-8 text-muted-foreground">
          Nessuna disponibilità ghiaccio configurata. Apri il pannello sopra per aggiungere slot.
        </div>
      )}

      {/* Config Dialog */}
      <Dialog open={config_open} onOpenChange={set_config_open}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Configura Planning</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label className="text-xs">Ora inizio giornata</Label>
                <Input type="time" value={cfg_ora_inizio} onChange={(e) => set_cfg_ora_inizio(e.target.value)} />
              </div>
              <div>
                <Label className="text-xs">Ora fine giornata</Label>
                <Input type="time" value={cfg_ora_fine} onChange={(e) => set_cfg_ora_fine(e.target.value)} />
              </div>
            </div>
            <div>
              <Label className="text-xs">Durata slot (minuti)</Label>
              <Select value={String(cfg_durata)} onValueChange={(v) => set_cfg_durata(Number(v))}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="15">15 minuti</SelectItem>
                  <SelectItem value="20">20 minuti</SelectItem>
                  <SelectItem value="30">30 minuti</SelectItem>
                  <SelectItem value="60">60 minuti</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => set_config_open(false)}>Annulla</Button>
            <Button onClick={() => save_config.mutate()}>Salva</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Info Occupazione Pista Dialog */}
      <Dialog open={info_pista_open} onOpenChange={set_info_pista_open}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Info occupazione pista</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 text-sm text-muted-foreground">
            <p>
              Questa sezione mostra gli altri occupanti della pista (Hockey, Curling, Pattinaggio libero).
            </p>
            <p className="text-xs">
              Funzionalità in fase di sviluppo. Al momento la vista planning mostra solo la disponibilità ghiaccio configurata per il club e i corsi pianificati.
            </p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => set_info_pista_open(false)}>Chiudi</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
