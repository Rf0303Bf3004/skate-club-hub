import React, { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase, get_current_club_id } from "@/lib/supabase";
import { use_corsi, use_istruttori } from "@/hooks/use-supabase-data";
import { X, Loader2 } from "lucide-react";

// ── Constants ──
const GIORNI = ["Lunedì", "Martedì", "Mercoledì", "Giovedì", "Venerdì", "Sabato", "Domenica"] as const;
const GIORNI_ABBR: Record<string, string> = {
  "Lunedì": "Lun", "Martedì": "Mar", "Mercoledì": "Mer",
  "Giovedì": "Gio", "Venerdì": "Ven", "Sabato": "Sab", "Domenica": "Dom",
};
const OFF_ICE_TYPES = ["danza", "off-ice", "stretching"];

const TIPO_COLORS: Record<string, { bg: string; text: string }> = {
  pulcini:    { bg: "#16A34A", text: "#fff" },
  amatori:    { bg: "#3B82F6", text: "#fff" },
  artistica:  { bg: "#7C3AED", text: "#fff" },
  stile:      { bg: "#D97706", text: "#fff" },
  adulti:     { bg: "#0D9488", text: "#fff" },
  danza:      { bg: "#EC4899", text: "#fff" },
  "off-ice":  { bg: "#6B7280", text: "#fff" },
  stretching: { bg: "#84CC16", text: "#fff" },
};
const PRIVATE_COLOR = { bg: "#FB923C", text: "#fff" };
const PULIZIA_COLOR = { bg: "#9CA3AF", text: "#fff" };
const GHIACCIO_BG = "#7F77DD";

function time_to_min(t: string): number {
  const [h, m] = (t || "00:00").split(":").map(Number);
  return h * 60 + (m || 0);
}
function min_to_time(m: number): string {
  return `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;
}

// ── Data hooks ──
function use_config_ghiaccio() {
  const club_id = get_current_club_id();
  return useQuery({
    queryKey: ["configurazione_ghiaccio", club_id],
    enabled: !!club_id,
    queryFn: async () => {
      const { data } = await supabase
        .from("configurazione_ghiaccio")
        .select("*")
        .eq("club_id", club_id)
        .maybeSingle();
      return data;
    },
  });
}

function use_disponibilita_ghiaccio() {
  const club_id = get_current_club_id();
  return useQuery({
    queryKey: ["disponibilita_ghiaccio", club_id],
    enabled: !!club_id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("disponibilita_ghiaccio")
        .select("*")
        .eq("club_id", club_id);
      if (error) throw error;
      return data ?? [];
    },
  });
}

// ── Types ──
type DetailInfo = {
  type: "corso" | "private" | "pulizia";
  nome?: string;
  giorno: string;
  ora_inizio: string;
  ora_fine: string;
  tipo?: string;
  livello?: string;
  n_iscritti?: number;
  istruttori_nomi?: string[];
  alert_max?: boolean;
  alert_ratio?: boolean;
  istruttori_disponibili?: string[];
};

// ── Main component ──
export default function PlanningPage() {
  const { data: config, isLoading: loadingConfig } = use_config_ghiaccio();
  const { data: ghiaccio_slots, isLoading: loadingGhiaccio } = use_disponibilita_ghiaccio();
  const { data: corsi_raw, isLoading: loadingCorsi } = use_corsi();
  const { data: istruttori_raw, isLoading: loadingIstr } = use_istruttori();
  const [detail, setDetail] = useState<DetailInfo | null>(null);

  const loading = loadingConfig || loadingGhiaccio || loadingCorsi || loadingIstr;

  const ora_apertura = config?.ora_apertura_default ?? "06:00";
  const ora_chiusura = config?.ora_chiusura_default ?? "22:30";
  const durata_pulizia = config?.durata_pulizia_minuti ?? 10;
  const max_atleti = config?.max_atleti_contemporanei ?? 30;
  const max_per_istr = config?.max_atleti_per_istruttore ?? 8;

  const start_min = time_to_min(ora_apertura);
  const end_min = time_to_min(ora_chiusura);
  const total_min = end_min - start_min;

  // Header ticks every 30 min
  const ticks = useMemo(() => {
    const arr: number[] = [];
    for (let m = start_min; m <= end_min; m += 30) arr.push(m);
    return arr;
  }, [start_min, end_min]);

  const corsi = (corsi_raw ?? []).filter((c: any) => c.attivo !== false);
  const istruttori = istruttori_raw ?? [];

  // Istruttori name map
  const istr_map = useMemo(() => {
    const m: Record<string, string> = {};
    istruttori.forEach((i: any) => { m[i.id] = `${i.nome} ${i.cognome}`; });
    return m;
  }, [istruttori]);

  // Count available instructors for a given day and time range
  const count_istr_disponibili = (giorno: string, start: number, end: number): string[] => {
    return istruttori.filter((ist: any) => {
      const slots = ist.disponibilita?.[giorno] ?? [];
      return slots.some((s: any) => time_to_min(s.ora_inizio) <= start && time_to_min(s.ora_fine) >= end);
    }).map((ist: any) => `${ist.nome} ${ist.cognome}`);
  };

  // Build blocks per day
  const build_day = (giorno: string) => {
    const day_ghiaccio = (ghiaccio_slots ?? []).filter((g: any) => g.giorno === giorno);
    const day_corsi_ice = corsi.filter((c: any) => c.giorno === giorno && !OFF_ICE_TYPES.includes((c.tipo || "").toLowerCase()));
    const day_corsi_off = corsi.filter((c: any) => c.giorno === giorno && OFF_ICE_TYPES.includes((c.tipo || "").toLowerCase()));

    type Block = { left: number; width: number; color: string; textColor: string; label: string; onClick: () => void; alert?: boolean };
    const blocks: Block[] = [];
    const off_blocks: Block[] = [];

    // Process each ghiaccio slot
    day_ghiaccio.forEach((g: any) => {
      const g_start = time_to_min(g.ora_inizio);
      const g_end = time_to_min(g.ora_fine);

      // Find courses overlapping this ice slot
      const overlapping = day_corsi_ice.filter((c: any) => {
        const cs = time_to_min(c.ora_inizio);
        const ce = time_to_min(c.ora_fine);
        return cs < g_end && ce > g_start;
      });

      if (overlapping.length === 0) {
        // Entire slot is private
        const names = count_istr_disponibili(giorno, g_start, g_end);
        blocks.push({
          left: ((g_start - start_min) / total_min) * 100,
          width: ((g_end - g_start) / total_min) * 100,
          color: PRIVATE_COLOR.bg,
          textColor: PRIVATE_COLOR.text,
          label: `Priv.(${names.length})`,
          onClick: () => setDetail({
            type: "private", giorno,
            ora_inizio: min_to_time(g_start), ora_fine: min_to_time(g_end),
            istruttori_disponibili: names,
          }),
        });
      } else {
        // Fill gaps with private, add courses
        const sorted = [...overlapping].sort((a: any, b: any) => time_to_min(a.ora_inizio) - time_to_min(b.ora_inizio));
        let cursor = g_start;

        sorted.forEach((c: any) => {
          const cs = Math.max(time_to_min(c.ora_inizio), g_start);
          const ce = Math.min(time_to_min(c.ora_fine), g_end);

          // Gap before course = private
          if (cs > cursor) {
            const names = count_istr_disponibili(giorno, cursor, cs);
            blocks.push({
              left: ((cursor - start_min) / total_min) * 100,
              width: ((cs - cursor) / total_min) * 100,
              color: PRIVATE_COLOR.bg, textColor: PRIVATE_COLOR.text,
              label: `Priv.(${names.length})`,
              onClick: () => setDetail({
                type: "private", giorno,
                ora_inizio: min_to_time(cursor), ora_fine: min_to_time(cs),
                istruttori_disponibili: names,
              }),
            });
          }

          // Course block
          const tipo_key = (c.tipo || "").toLowerCase();
          const colors = TIPO_COLORS[tipo_key] || { bg: "#94A3B8", text: "#fff" };
          const n_iscritti = c.atleti_ids?.length ?? 0;
          const alert_max = n_iscritti > max_atleti;
          const n_istr = c.istruttori_ids?.length || 1;
          const alert_ratio = n_iscritti / n_istr > max_per_istr;

          blocks.push({
            left: ((cs - start_min) / total_min) * 100,
            width: ((ce - cs) / total_min) * 100,
            color: colors.bg, textColor: colors.text,
            label: c.nome || tipo_key,
            alert: alert_max,
            onClick: () => setDetail({
              type: "corso", nome: c.nome, giorno, tipo: c.tipo,
              ora_inizio: c.ora_inizio, ora_fine: c.ora_fine,
              livello: c.livello_richiesto,
              n_iscritti,
              istruttori_nomi: (c.istruttori_ids ?? []).map((id: string) => istr_map[id] || id),
              alert_max, alert_ratio,
            }),
          });
          cursor = ce;
        });

        // Gap after last course
        if (cursor < g_end) {
          const names = count_istr_disponibili(giorno, cursor, g_end);
          blocks.push({
            left: ((cursor - start_min) / total_min) * 100,
            width: ((g_end - cursor) / total_min) * 100,
            color: PRIVATE_COLOR.bg, textColor: PRIVATE_COLOR.text,
            label: `Priv.(${names.length})`,
            onClick: () => setDetail({
              type: "private", giorno,
              ora_inizio: min_to_time(cursor), ora_fine: min_to_time(g_end),
              istruttori_disponibili: names,
            }),
          });
        }
      }

      // Pulizia after ice slot
      const pulizia_start = g_end;
      const pulizia_end = Math.min(g_end + durata_pulizia, end_min);
      if (pulizia_end > pulizia_start) {
        blocks.push({
          left: ((pulizia_start - start_min) / total_min) * 100,
          width: ((pulizia_end - pulizia_start) / total_min) * 100,
          color: PULIZIA_COLOR.bg, textColor: PULIZIA_COLOR.text,
          label: "Pulizia",
          onClick: () => setDetail({
            type: "pulizia", giorno,
            ora_inizio: min_to_time(pulizia_start), ora_fine: min_to_time(pulizia_end),
          }),
        });
      }
    });

    // Off-ice courses
    day_corsi_off.forEach((c: any) => {
      const cs = time_to_min(c.ora_inizio);
      const ce = time_to_min(c.ora_fine);
      const tipo_key = (c.tipo || "").toLowerCase();
      const colors = TIPO_COLORS[tipo_key] || { bg: "#94A3B8", text: "#fff" };
      off_blocks.push({
        left: ((cs - start_min) / total_min) * 100,
        width: ((ce - cs) / total_min) * 100,
        color: colors.bg, textColor: colors.text,
        label: c.nome || tipo_key,
        onClick: () => setDetail({
          type: "corso", nome: c.nome, giorno, tipo: c.tipo,
          ora_inizio: c.ora_inizio, ora_fine: c.ora_fine,
          livello: c.livello_richiesto,
          n_iscritti: c.atleti_ids?.length ?? 0,
          istruttori_nomi: (c.istruttori_ids ?? []).map((id: string) => istr_map[id] || id),
        }),
      });
    });

    return { blocks, off_blocks };
  };

  // Total ice hours
  const ore_ghiaccio = useMemo(() => {
    if (!ghiaccio_slots) return 0;
    return ghiaccio_slots.reduce((acc: number, g: any) => {
      return acc + (time_to_min(g.ora_fine) - time_to_min(g.ora_inizio));
    }, 0) / 60;
  }, [ghiaccio_slots]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!ghiaccio_slots || ghiaccio_slots.length === 0) {
    return (
      <div className="p-8 text-center text-muted-foreground">
        <p className="text-lg font-medium">Configura prima la disponibilità ghiaccio in Configurazione Club</p>
      </div>
    );
  }

  const LABEL_W = 48;

  return (
    <div className="p-4 space-y-4">
      {/* Toolbar */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <h1 className="text-xl font-bold text-foreground">Planning Ghiaccio</h1>
        <span className="text-sm text-muted-foreground">
          {ore_ghiaccio.toFixed(1)} ore ghiaccio disponibili questa settimana
        </span>
      </div>

      {/* Legend */}
      <div className="flex flex-wrap gap-2 text-xs">
        {Object.entries(TIPO_COLORS).map(([k, v]) => (
          <span key={k} className="px-2 py-0.5 rounded font-medium" style={{ background: v.bg, color: v.text }}>
            {k}
          </span>
        ))}
        <span className="px-2 py-0.5 rounded font-medium" style={{ background: PRIVATE_COLOR.bg, color: PRIVATE_COLOR.text }}>private</span>
        <span className="px-2 py-0.5 rounded font-medium" style={{ background: PULIZIA_COLOR.bg, color: PULIZIA_COLOR.text }}>pulizia</span>
      </div>

      {/* Grid */}
      <div className="border border-border rounded-lg overflow-x-auto bg-card">
        {/* Time header */}
        <div className="flex border-b border-border sticky top-0 bg-card z-10">
          <div className="flex-shrink-0 border-r border-border" style={{ width: LABEL_W }} />
          <div className="flex-1 relative" style={{ minWidth: total_min * 1.5 }}>
            {ticks.map((t) => (
              <span
                key={t}
                className="absolute text-[10px] text-muted-foreground top-0 -translate-x-1/2"
                style={{ left: `${((t - start_min) / total_min) * 100}%` }}
              >
                {min_to_time(t)}
              </span>
            ))}
            <div className="h-5" />
          </div>
        </div>

        {/* Day rows */}
        {GIORNI.map((giorno) => {
          const { blocks, off_blocks } = build_day(giorno);
          return (
            <div key={giorno} className="border-b border-border last:border-b-0">
              {/* Off-ice thin row */}
              {off_blocks.length > 0 && (
                <div className="flex">
                  <div className="flex-shrink-0 border-r border-border" style={{ width: LABEL_W }} />
                  <div className="flex-1 relative" style={{ height: 16, minWidth: total_min * 1.5 }}>
                    {off_blocks.map((b, i) => (
                      <div
                        key={i}
                        className="absolute top-0 h-full rounded-sm cursor-pointer flex items-center justify-center overflow-hidden"
                        style={{ left: `${b.left}%`, width: `${b.width}%`, background: b.color, color: b.textColor }}
                        onClick={b.onClick}
                      >
                        <span className="text-[9px] font-medium truncate px-0.5">{b.label}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Main ice row */}
              <div className="flex">
                <div
                  className="flex-shrink-0 flex items-center justify-center font-semibold text-xs text-foreground border-r border-border bg-muted"
                  style={{ width: LABEL_W, height: 50 }}
                >
                  {GIORNI_ABBR[giorno]}
                </div>
                <div className="flex-1 relative" style={{ height: 50, minWidth: total_min * 1.5, background: "#F3F4F6" }}>
                  {blocks.map((b, i) => (
                    <div
                      key={i}
                      className="absolute top-1 cursor-pointer flex items-center justify-center overflow-hidden rounded"
                      style={{
                        left: `${b.left}%`,
                        width: `${b.width}%`,
                        height: 42,
                        background: b.color,
                        color: b.textColor,
                        border: b.alert ? "2px solid #E24B4A" : "1px solid rgba(0,0,0,0.08)",
                      }}
                      onClick={b.onClick}
                    >
                      <span className="text-[11px] font-semibold truncate px-1">{b.label}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Detail panel */}
      {detail && (
        <div className="border border-border rounded-lg p-4 bg-card relative">
          <button
            className="absolute top-2 right-2 text-muted-foreground hover:text-foreground"
            onClick={() => setDetail(null)}
          >
            <X className="h-4 w-4" />
          </button>

          {detail.type === "corso" && (
            <div className="space-y-1 text-sm">
              <p className="font-bold text-foreground">{detail.nome}</p>
              <p className="text-muted-foreground">{detail.giorno} — {detail.ora_inizio} / {detail.ora_fine}</p>
              <p>Tipo: <span className="font-medium">{detail.tipo}</span></p>
              {detail.livello && <p>Livello: {detail.livello}</p>}
              <p>Iscritti: <span className="font-semibold">{detail.n_iscritti}</span></p>
              {detail.istruttori_nomi && detail.istruttori_nomi.length > 0 && (
                <p>Istruttori: {detail.istruttori_nomi.join(", ")}</p>
              )}
              {detail.alert_max && (
                <p className="text-destructive font-semibold">⚠ Superato limite max atleti contemporanei ({max_atleti})</p>
              )}
              {detail.alert_ratio && (
                <p className="text-orange-600 font-semibold">⚠ Superato rapporto atleti/istruttore ({max_per_istr})</p>
              )}
            </div>
          )}

          {detail.type === "private" && (
            <div className="space-y-1 text-sm">
              <p className="font-bold text-foreground">Slot Lezione Privata</p>
              <p className="text-muted-foreground">{detail.giorno} — {detail.ora_inizio} / {detail.ora_fine}</p>
              <p>Istruttori disponibili: <span className="font-semibold">{detail.istruttori_disponibili?.length ?? 0}</span></p>
              {detail.istruttori_disponibili && detail.istruttori_disponibili.length > 0 && (
                <ul className="list-disc list-inside">
                  {detail.istruttori_disponibili.map((n, i) => <li key={i}>{n}</li>)}
                </ul>
              )}
            </div>
          )}

          {detail.type === "pulizia" && (
            <div className="space-y-1 text-sm">
              <p className="font-bold text-foreground">Pulizia Ghiaccio</p>
              <p className="text-muted-foreground">{detail.giorno} — {detail.ora_inizio} / {detail.ora_fine}</p>
              <p>Durata: {durata_pulizia} minuti</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
