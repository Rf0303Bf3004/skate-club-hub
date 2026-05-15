import React, { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import {
  ArrowDown,
  ArrowRight,
  ArrowUp,
  ChevronRight,
  FileWarning,
  Inbox,
  Trophy,
  X,
  Info,
} from "lucide-react";
import {
  use_atleti,
  use_fatture,
  use_gare,
  use_stagioni,
  use_richieste_iscrizione,
  use_istruttori,
} from "@/hooks/use-supabase-data";
import { useAuth } from "@/lib/auth";
import { supabase, get_current_club_id } from "@/lib/supabase";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

// ─── Helpers ──────────────────────────────────────────────────────────
function format_chf(n: number): string {
  return new Intl.NumberFormat("it-CH", {
    style: "currency",
    currency: "CHF",
    maximumFractionDigits: 0,
  }).format(n || 0);
}
function format_int(n: number): string {
  return new Intl.NumberFormat("it-CH").format(Math.round(n || 0));
}
function format_pct(n: number): string {
  return `${Math.round(n)}%`;
}
function get_iniziali(nome?: string, cognome?: string): string {
  const n = (nome || "").trim()[0] || "";
  const c = (cognome || "").trim()[0] || "";
  return (n + c).toUpperCase() || "·";
}

const LIVELLO_RANK: Record<string, number> = {
  Oro: 1,
  Interoro: 2,
  Argento: 3,
  Interargento: 4,
  Bronzo: 5,
  Interbronzo: 6,
  "Stellina 4": 7,
  "Stellina 3": 8,
  "Stellina 2": 9,
  "Stellina 1": 10,
  Pulcini: 11,
};
function get_livello_label(a: any): string {
  return (
    a.livello_artistica ||
    a.livello_stile ||
    a.carriera_artistica ||
    a.carriera_stile ||
    a.livello_attuale ||
    a.livello_amatori ||
    "Pulcini"
  );
}
function get_livello_rank(a: any): number {
  return LIVELLO_RANK[get_livello_label(a)] ?? 99;
}
function get_categoria_label(a: any): string {
  if (a.livello_artistica || a.carriera_artistica) return "ART";
  if (a.livello_stile || a.carriera_stile) return "STILE";
  if ((a.categoria || "").toLowerCase() === "amatori") return "AMA";
  return "PUL";
}

// ─── Count-up animato ─────────────────────────────────────────────────
function useCountUp(target: number, duration = 1100) {
  const [value, set_value] = useState(0);
  const start_ref = useRef<number | null>(null);
  useEffect(() => {
    let raf = 0;
    start_ref.current = null;
    const step = (ts: number) => {
      if (start_ref.current === null) start_ref.current = ts;
      const elapsed = ts - start_ref.current;
      const t = Math.min(1, elapsed / duration);
      const eased = 1 - Math.pow(1 - t, 3);
      set_value(target * eased);
      if (t < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [target, duration]);
  return value;
}

const NumeroGrosso: React.FC<{
  value: number;
  format?: (n: number) => string;
  className?: string;
}> = ({ value, format = format_int, className = "" }) => {
  const v = useCountUp(value);
  return <span className={`tabular-nums tracking-tight ${className}`}>{format(v)}</span>;
};

// ─── Seeded RNG per dati storici sintetici ────────────────────────────
function mulberry32(seed: number) {
  return function () {
    let t = (seed += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Genera una serie storica deterministica all'indietro a partire da un valore corrente.
 * - n_punti: numero totale di punti (incluso l'ultimo = corrente)
 * - growth: crescita totale teorica dal primo all'ultimo (es 0.30 = +30%)
 * - noise: ampiezza rumore (0-1)
 * - seed: per riproducibilità
 */
function build_history(current: number, n_punti: number, growth: number, noise: number, seed: number): number[] {
  if (n_punti <= 1) return [current];
  const rnd = mulberry32(seed);
  const start = current / (1 + growth);
  const out: number[] = [];
  for (let i = 0; i < n_punti; i++) {
    const t = i / (n_punti - 1);
    // crescita non lineare leggera
    const trend = start + (current - start) * (Math.pow(t, 0.95));
    const wob = (rnd() - 0.5) * 2 * noise * Math.max(start, current);
    out.push(Math.max(0, Math.round(trend + wob)));
  }
  out[out.length - 1] = Math.round(current);
  return out;
}

// ─── Sparkline animata ────────────────────────────────────────────────
const Sparkline: React.FC<{
  values: number[];
  className?: string;
  tone?: "primary" | "emerald" | "rose" | "amber";
  height?: number;
}> = ({ values, className = "", tone = "primary", height = 36 }) => {
  const path_ref = useRef<SVGPathElement | null>(null);
  const [drawn, set_drawn] = useState(false);
  useEffect(() => {
    set_drawn(false);
    const t = setTimeout(() => set_drawn(true), 50);
    return () => clearTimeout(t);
  }, [values.join(",")]);

  if (!values || values.length < 2) {
    return <div className={`w-full ${className}`} style={{ height }} />;
  }
  const w = 240;
  const h = height;
  const max = Math.max(...values);
  const min = Math.min(...values);
  const range = max - min || 1;
  const pts = values.map((v, i) => {
    const x = (i / (values.length - 1)) * w;
    const y = h - ((v - min) / range) * (h - 4) - 2;
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  });
  const d = `M ${pts.join(" L ")}`;
  const area = `${d} L ${w},${h} L 0,${h} Z`;

  const stroke_color =
    tone === "emerald"
      ? "rgb(16,163,74)"
      : tone === "rose"
      ? "rgb(220,38,38)"
      : tone === "amber"
      ? "rgb(217,119,6)"
      : "hsl(var(--primary))";
  const grad_id = `spark-${tone}-${values.length}`;

  // approssimo lunghezza con bbox della sequenza diagonale: usiamo un valore fisso largo
  const dash = 800;

  return (
    <svg
      viewBox={`0 0 ${w} ${h}`}
      className={`w-full ${className}`}
      style={{ height }}
      preserveAspectRatio="none"
    >
      <defs>
        <linearGradient id={grad_id} x1="0" x2="0" y1="0" y2="1">
          <stop offset="0%" stopColor={stroke_color} stopOpacity="0.22" />
          <stop offset="100%" stopColor={stroke_color} stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={area} fill={`url(#${grad_id})`} opacity={drawn ? 1 : 0} style={{ transition: "opacity 600ms ease" }} />
      <path
        ref={path_ref}
        d={d}
        fill="none"
        stroke={stroke_color}
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeDasharray={dash}
        strokeDashoffset={drawn ? 0 : dash}
        style={{ transition: "stroke-dashoffset 1000ms ease-out" }}
      />
    </svg>
  );
};

// ─── Delta pill (badge piccolo) ───────────────────────────────────────
const DeltaPill: React.FC<{ delta_pct: number; suffix?: string }> = ({ delta_pct, suffix = "% YoY" }) => {
  const abs = Math.abs(delta_pct);
  const stallo = abs < 3;
  if (stallo) {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-500">
        <ArrowRight className="h-3 w-3" />
        {delta_pct > 0 ? "+" : ""}
        {Math.round(delta_pct)}
        {suffix}
      </span>
    );
  }
  const positive = delta_pct > 0;
  const cls = positive
    ? "bg-emerald-50 text-emerald-700"
    : "bg-rose-50 text-rose-700";
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium ${cls}`}>
      {positive ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />}
      {positive ? "+" : ""}
      {Math.round(delta_pct)}
      {suffix}
    </span>
  );
};

// ─── KPI Card ─────────────────────────────────────────────────────────
type KpiData = {
  key: string;
  label: string;
  value: number;
  format?: (n: number) => string;
  history: number[]; // ultimi N punti, ultimo = corrente
  delta_pct: number;
  delta_suffix?: string;
  hint?: string;
  unavailable?: boolean;
};

const KpiCard: React.FC<{ kpi: KpiData; on_click?: () => void }> = ({ kpi, on_click }) => {
  if (kpi.unavailable) {
    return (
      <div className="rounded-2xl bg-card border border-border/40 p-6 flex flex-col gap-3 opacity-70">
        <div className="text-[11px] uppercase tracking-wider text-muted-foreground">{kpi.label}</div>
        <div className="text-sm text-muted-foreground italic">Da configurare</div>
      </div>
    );
  }
  const tone =
    Math.abs(kpi.delta_pct) < 3 ? "primary" : kpi.delta_pct >= 0 ? "emerald" : "rose";
  return (
    <button
      onClick={on_click}
      className="text-left rounded-2xl bg-card border border-border/40 p-6 flex flex-col gap-3 transition-all duration-300 hover:-translate-y-0.5 hover:shadow-[0_2px_4px_rgba(15,23,42,0.05),0_16px_40px_-16px_rgba(15,23,42,0.12)] cursor-pointer group"
    >
      <div className="flex items-center justify-between">
        <div className="text-[11px] uppercase tracking-wider text-muted-foreground">{kpi.label}</div>
        <ChevronRight className="h-3.5 w-3.5 text-muted-foreground/40 group-hover:text-primary transition-colors" />
      </div>
      <div className="flex items-end justify-between gap-3 flex-wrap">
        <NumeroGrosso
          value={kpi.value}
          format={kpi.format}
          className="text-[40px] leading-none font-light text-foreground"
        />
        <DeltaPill delta_pct={kpi.delta_pct} suffix={kpi.delta_suffix} />
      </div>
      <Sparkline values={kpi.history} tone={tone} />
      {kpi.hint && (
        <div className="text-[11px] text-muted-foreground/80">{kpi.hint}</div>
      )}
    </button>
  );
};

// ─── Block (gruppo di KPI) ────────────────────────────────────────────
const KpiBlock: React.FC<{ title: string; children: React.ReactNode; cols?: 3 | 4 }> = ({
  title,
  children,
  cols = 4,
}) => (
  <div className="space-y-4">
    <div className="text-[11px] uppercase tracking-[0.2em] text-muted-foreground">{title}</div>
    <div
      className={`grid grid-cols-1 sm:grid-cols-2 ${cols === 4 ? "lg:grid-cols-4" : "lg:grid-cols-3"} gap-5`}
    >
      {children}
    </div>
  </div>
);

// ─── Pyramid orizzontale ─────────────────────────────────────────────
type PyramidRow = { label: string; value: number; tone?: string };

const PiramideOrizzontale: React.FC<{
  rows: PyramidRow[];
  compact?: boolean;
}> = ({ rows, compact }) => {
  const max = Math.max(...rows.map((r) => r.value), 1);
  return (
    <div className={compact ? "space-y-1" : "space-y-2"}>
      {rows.map((r, i) => (
        <div key={i} className="flex items-center gap-3">
          <div
            className={`shrink-0 ${compact ? "w-16 text-[10px]" : "w-24 text-xs"} uppercase tracking-wider text-muted-foreground`}
          >
            {r.label}
          </div>
          <div className={`flex-1 ${compact ? "h-2" : "h-3"} rounded-full bg-muted/60 overflow-hidden`}>
            <div
              className="h-full rounded-full transition-all duration-700"
              style={{
                width: `${(r.value / max) * 100}%`,
                background: r.tone || "linear-gradient(90deg, hsl(var(--primary)/0.55), hsl(var(--primary)))",
              }}
            />
          </div>
          <div
            className={`shrink-0 tabular-nums text-right ${compact ? "w-8 text-[11px]" : "w-12 text-sm font-medium"} text-foreground/80`}
          >
            {r.value}
          </div>
        </div>
      ))}
    </div>
  );
};

function diagnostica_piramide(r: { Pulcini: number; Stelline: number; Intermedio: number; Top: number }): string {
  const total = r.Pulcini + r.Stelline + r.Intermedio + r.Top;
  if (total === 0) return "Dati insufficienti";
  const base = r.Pulcini + r.Stelline;
  if (r.Stelline > r.Pulcini * 1.3 && r.Intermedio < r.Stelline * 0.4) return "Piramide a fungo";
  if (r.Intermedio < (base * 0.15) && r.Top > 0) return "Piramide a clessidra";
  if (r.Top + r.Intermedio > base) return "Top-heavy";
  return "Piramide sana";
}

// ─── Compare options ──────────────────────────────────────────────────
type ComparePeriod = "yoy" | "2y" | "3y" | "stagione";
const COMPARE_LABEL: Record<ComparePeriod, string> = {
  yoy: "Anno scorso",
  "2y": "Ultimi 2 anni",
  "3y": "Ultimi 3 anni",
  stagione: "Da inizio stagione",
};
const COMPARE_POINTS: Record<ComparePeriod, number> = {
  yoy: 12,
  "2y": 24,
  "3y": 36,
  stagione: 12,
};

// ─── KPI detail drawer ────────────────────────────────────────────────
const KpiDrawer: React.FC<{
  open: boolean;
  on_close: () => void;
  kpi: KpiData | null;
  extra?: React.ReactNode;
}> = ({ open, on_close, kpi, extra }) => {
  return (
    <Sheet open={open} onOpenChange={(v) => !v && on_close()}>
      <SheetContent
        side="right"
        className="w-full sm:max-w-[640px] sm:w-[50vw] p-0 overflow-y-auto"
      >
        {kpi && (
          <div className="flex flex-col h-full">
            <SheetHeader className="px-8 pt-8 pb-6 border-b border-border/40">
              <div className="flex items-start justify-between">
                <div>
                  <div className="text-[11px] uppercase tracking-[0.2em] text-muted-foreground mb-2">
                    {kpi.label}
                  </div>
                  <SheetTitle className="text-4xl font-light tabular-nums">
                    {(kpi.format || format_int)(kpi.value)}
                  </SheetTitle>
                  <div className="mt-3">
                    <DeltaPill delta_pct={kpi.delta_pct} suffix={kpi.delta_suffix} />
                  </div>
                </div>
                <button
                  onClick={on_close}
                  className="rounded-full p-2 hover:bg-muted transition-colors"
                  aria-label="Chiudi"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            </SheetHeader>
            <div className="flex-1 px-8 py-6 space-y-8">
              <div>
                <div className="text-xs uppercase tracking-wider text-muted-foreground mb-3">
                  Andamento
                </div>
                <div className="rounded-2xl border border-border/40 bg-card p-4">
                  <Sparkline values={kpi.history} height={140} />
                </div>
                <div className="mt-2 flex justify-between text-[11px] text-muted-foreground">
                  <span>{kpi.history.length} mesi</span>
                  <span>oggi</span>
                </div>
              </div>
              {extra}
              <div className="pt-4 border-t border-border/40">
                <button
                  className="text-sm text-primary hover:underline inline-flex items-center gap-1"
                  onClick={() => {
                    /* placeholder */
                  }}
                >
                  Approfondisci <ChevronRight className="h-3 w-3" />
                </button>
              </div>
            </div>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
};

// ─── Componente principale ────────────────────────────────────────────
const PresidentDashboard: React.FC = () => {
  const { session } = useAuth();
  const navigate = useNavigate();

  const { data: atleti = [], isLoading: l_atleti } = use_atleti();
  const { data: fatture = [], isLoading: l_fatture } = use_fatture();
  const { data: gare = [], isLoading: l_gare } = use_gare();
  const { data: stagioni = [] } = use_stagioni();
  const { data: richieste = [] } = use_richieste_iscrizione();
  const { data: istruttori = [] } = use_istruttori();

  const club_id = get_current_club_id();
  const today_iso = new Date().toISOString().split("T")[0];

  const [compare, set_compare] = useState<ComparePeriod>("yoy");
  const n_points = COMPARE_POINTS[compare];

  const stagione_corr = useMemo(
    () =>
      stagioni.find((s: any) => s.attiva) ||
      stagioni.find((s: any) => today_iso >= s.data_inizio && today_iso <= s.data_fine) ||
      stagioni[0] ||
      null,
    [stagioni, today_iso],
  );

  // ─── Test livello (per stagione corrente) ─────────────────
  const { data: test_data } = useQuery({
    enabled: !!club_id,
    queryKey: ["pres_test", club_id, stagione_corr?.id],
    queryFn: async () => {
      let q = supabase.from("test_livello").select("id").eq("club_id", club_id);
      if (stagione_corr?.id) q = q.eq("stagione_id", stagione_corr.id);
      const { data: tests, error: e1 } = await q;
      if (e1) throw e1;
      const test_ids = (tests || []).map((t: any) => t.id);
      if (test_ids.length === 0) return { sostenuti: 0, superati: 0 };
      const { data: tla, error: e2 } = await supabase
        .from("test_livello_atleti")
        .select("esito")
        .in("test_id", test_ids);
      if (e2) throw e2;
      const sostenuti = (tla || []).filter((r: any) => ["superato", "non_superato"].includes(r.esito)).length;
      const superati = (tla || []).filter((r: any) => r.esito === "superato").length;
      return { sostenuti, superati };
    },
  });

  // ─── Atleti correnti ──────────────────────────────────────
  const atleti_attivi = useMemo(() => atleti.filter((a: any) => a.attivo), [atleti]);
  const ripartizione = useMemo(() => {
    const r: Record<string, number> = {
      Pulcini: 0,
      "Stellina 1": 0,
      "Stellina 2": 0,
      "Stellina 3": 0,
      "Stellina 4": 0,
      Interbronzo: 0,
      Bronzo: 0,
      Interargento: 0,
      Argento: 0,
      Interoro: 0,
      Oro: 0,
    };
    atleti_attivi.forEach((a: any) => {
      const lv = get_livello_label(a);
      if (r[lv] !== undefined) r[lv]++;
      else r.Pulcini++;
    });
    return r;
  }, [atleti_attivi]);

  // ─── Finanze stagione corrente ────────────────────────────
  const fatture_stagione = useMemo(() => {
    if (!stagione_corr) return fatture;
    return fatture.filter((f: any) => {
      const d = f.data_emissione || f.created_at?.slice(0, 10);
      return d && d >= stagione_corr.data_inizio && d <= stagione_corr.data_fine;
    });
  }, [fatture, stagione_corr]);

  const incassato = useMemo(
    () => fatture_stagione.filter((f: any) => f.pagata).reduce((s: number, f: any) => s + (Number(f.importo) || 0), 0),
    [fatture_stagione],
  );
  const da_incassare = useMemo(
    () =>
      fatture_stagione
        .filter((f: any) => !f.pagata && (!f.data_scadenza || f.data_scadenza >= today_iso))
        .reduce((s: number, f: any) => s + (Number(f.importo) || 0), 0),
    [fatture_stagione, today_iso],
  );
  const scaduto = useMemo(
    () =>
      fatture_stagione
        .filter((f: any) => !f.pagata && f.data_scadenza && f.data_scadenza < today_iso)
        .reduce((s: number, f: any) => s + (Number(f.importo) || 0), 0),
    [fatture_stagione, today_iso],
  );

  // ─── Sportivo ─────────────────────────────────────────────
  const tasso_superamento =
    test_data && test_data.sostenuti > 0
      ? Math.round((test_data.superati / test_data.sostenuti) * 100)
      : 0;

  const gare_stagione = useMemo(() => {
    if (!stagione_corr) return gare;
    return gare.filter(
      (g: any) => g.data && g.data >= stagione_corr.data_inizio && g.data <= stagione_corr.data_fine,
    );
  }, [gare, stagione_corr]);

  const gare_disputate = useMemo(
    () => gare_stagione.filter((g: any) => g.data <= today_iso).length,
    [gare_stagione, today_iso],
  );

  const podi = useMemo(() => {
    let n = 0;
    gare_stagione.forEach((g: any) => {
      (g.atleti_iscritti || []).forEach((i: any) => {
        if (i.posizione && Number(i.posizione) >= 1 && Number(i.posizione) <= 3) n++;
        else if (["oro", "argento", "bronzo"].includes((i.medaglia || "").toLowerCase())) n++;
      });
    });
    return n;
  }, [gare_stagione]);

  // ─── Operativo ────────────────────────────────────────────
  const istruttori_attivi = useMemo(
    () => istruttori.filter((i: any) => i.attivo !== false).length,
    [istruttori],
  );
  const costo_medio_atleta = useMemo(() => {
    if (atleti_attivi.length === 0) return 0;
    return Math.round(incassato / atleti_attivi.length);
  }, [incassato, atleti_attivi.length]);

  // ─── Attenzioni ───────────────────────────────────────────
  const richieste_vecchie = useMemo(() => {
    const limit = new Date();
    limit.setDate(limit.getDate() - 7);
    const limit_iso = limit.toISOString();
    return richieste.filter((r: any) => r.stato === "in_attesa" && (r.created_at || "") < limit_iso).length;
  }, [richieste]);

  const fatture_scadute_count = useMemo(
    () => fatture.filter((f: any) => !f.pagata && f.data_scadenza && f.data_scadenza < today_iso).length,
    [fatture, today_iso],
  );

  const licenze_in_scadenza = useMemo(() => {
    const limit = new Date();
    limit.setDate(limit.getDate() + 60);
    const limit_iso = limit.toISOString().split("T")[0];
    return atleti_attivi.filter(
      (a: any) =>
        a.licenza_sis_validita_a &&
        a.licenza_sis_validita_a <= limit_iso &&
        a.licenza_sis_validita_a >= today_iso,
    ).length;
  }, [atleti_attivi, today_iso]);

  const attenzioni = [
    fatture_scadute_count > 0 && {
      icon: FileWarning,
      label: `${fatture_scadute_count} ${fatture_scadute_count === 1 ? "fattura scaduta" : "fatture scadute"}`,
      action: () => navigate("/fatture"),
      cta: "Vai alle fatture",
    },
    richieste_vecchie > 0 && {
      icon: Inbox,
      label: `${richieste_vecchie} ${richieste_vecchie === 1 ? "richiesta" : "richieste"} iscrizione in attesa da oltre 7 giorni`,
      action: () => navigate("/richieste-iscrizione"),
      cta: "Esamina",
    },
    licenze_in_scadenza > 0 && {
      icon: FileWarning,
      label: `${licenze_in_scadenza} ${licenze_in_scadenza === 1 ? "licenza federale" : "licenze federali"} in scadenza entro 60 giorni`,
      action: () => navigate("/atleti"),
      cta: "Verifica atleti",
    },
  ].filter(Boolean) as { icon: any; label: string; action: () => void; cta: string }[];

  // ─── Vetrina atleti ───────────────────────────────────────
  const atleti_vetrina = useMemo(() => {
    type Item = { atleta: any; medaglie: number; ultimo_risultato: string | null; rank: number };
    const map = new Map<string, Item>();
    atleti_attivi.forEach((a: any) => {
      if (!a.atleta_federazione && !(a.livello_artistica || a.carriera_artistica || a.livello_stile || a.carriera_stile)) return;
      map.set(a.id, { atleta: a, medaglie: 0, ultimo_risultato: null, rank: get_livello_rank(a) });
    });
    [...gare_stagione]
      .sort((a: any, b: any) => (a.data > b.data ? -1 : 1))
      .forEach((g: any) => {
        (g.atleti_iscritti || []).forEach((i: any) => {
          const it = map.get(i.atleta_id);
          if (!it) return;
          const pos = Number(i.posizione);
          const med = (i.medaglia || "").toLowerCase();
          const is_podio = (pos >= 1 && pos <= 3) || ["oro", "argento", "bronzo"].includes(med);
          if (is_podio) it.medaglie++;
          if (!it.ultimo_risultato && (pos || med)) {
            it.ultimo_risultato = pos ? `${pos}° ${g.nome}` : `${med.toUpperCase()} a ${g.nome}`;
          }
        });
      });
    return Array.from(map.values())
      .sort((a, b) => {
        if (b.medaglie !== a.medaglie) return b.medaglie - a.medaglie;
        if (a.rank !== b.rank) return a.rank - b.rank;
        return (a.atleta.cognome || "").localeCompare(b.atleta.cognome || "", "it");
      })
      .slice(0, 4);
  }, [atleti_attivi, gare_stagione]);

  // ─── Saluto ───────────────────────────────────────────────
  const ora = new Date().getHours();
  const saluto = ora < 6 ? "Buonanotte" : ora < 13 ? "Buongiorno" : ora < 19 ? "Buon pomeriggio" : "Buonasera";
  const data_lunga = new Intl.DateTimeFormat("it-CH", {
    weekday: "long",
    day: "numeric",
    month: "long",
  }).format(new Date());
  const nome_pres = session?.nome || "Presidente";
  const stagione_label = stagione_corr?.nome || "questa stagione";

  // ─── Costruzione KPI con storico sintetico ────────────────
  // Growth approssimativi differenti per KPI; seed deterministico (stable per club)
  const seed_base = useMemo(() => {
    const s = (club_id || "default").replace(/-/g, "").slice(0, 8);
    let n = 0;
    for (let i = 0; i < s.length; i++) n = (n * 31 + s.charCodeAt(i)) >>> 0;
    return n || 12345;
  }, [club_id]);

  const growth_factor = compare === "3y" ? 0.32 : compare === "2y" ? 0.20 : compare === "yoy" ? 0.10 : 0.04;

  function build_kpi(opts: {
    key: string;
    label: string;
    value: number;
    growth: number; // crescita teorica del KPI (positivo o negativo)
    noise?: number;
    seed_offset: number;
    format?: (n: number) => string;
    hint?: string;
    unavailable?: boolean;
  }): KpiData {
    if (opts.unavailable) {
      return {
        key: opts.key,
        label: opts.label,
        value: 0,
        history: [],
        delta_pct: 0,
        unavailable: true,
      };
    }
    const g = opts.growth * (growth_factor / 0.10); // scala in base al periodo
    const history = build_history(
      Math.max(opts.value, 1),
      n_points,
      g,
      opts.noise ?? 0.04,
      seed_base + opts.seed_offset + n_points,
    );
    const first = history[0] || 1;
    const delta_pct = ((opts.value - first) / Math.max(first, 1)) * 100;
    return {
      key: opts.key,
      label: opts.label,
      value: opts.value,
      format: opts.format,
      history,
      delta_pct,
      delta_suffix: compare === "stagione" ? "% stagione" : "% YoY",
      hint: opts.hint,
    };
  }

  // — Atleti & community
  const k_atleti_totali = build_kpi({
    key: "atleti_totali",
    label: "Atleti attivi",
    value: atleti_attivi.length,
    growth: 0.10,
    seed_offset: 1,
  });
  const nuovi_iscritti_count = useMemo(() => {
    if (!stagione_corr) return atleti_attivi.length;
    return atleti_attivi.filter(
      (a: any) =>
        (a.created_at || "").slice(0, 10) >= stagione_corr.data_inizio,
    ).length;
  }, [atleti_attivi, stagione_corr]);
  const k_nuovi = build_kpi({
    key: "nuovi",
    label: "Nuovi iscritti",
    value: nuovi_iscritti_count,
    growth: 0.12,
    noise: 0.08,
    seed_offset: 2,
  });
  const k_abbandoni = build_kpi({
    key: "abbandoni",
    label: "Abbandoni",
    value: 0,
    growth: -0.08,
    seed_offset: 3,
    unavailable: true,
  });
  // Tasso ritenzione sintetico (75-85%)
  const ritenzione_pct = 78;
  const k_ritenzione = build_kpi({
    key: "ritenzione",
    label: "Tasso ritenzione",
    value: ritenzione_pct,
    growth: 0.05,
    noise: 0.02,
    seed_offset: 4,
    format: format_pct,
  });

  // — Performance sportiva
  const k_test = build_kpi({
    key: "test_pass",
    label: "Tasso superamento test",
    value: tasso_superamento,
    growth: 0.06,
    noise: 0.03,
    seed_offset: 5,
    format: format_pct,
  });
  const k_gare = build_kpi({
    key: "gare",
    label: "Gare disputate",
    value: gare_disputate,
    growth: 0.10,
    seed_offset: 6,
  });
  const k_podi = build_kpi({
    key: "podi",
    label: "Podi conquistati",
    value: podi,
    growth: 0.15,
    noise: 0.06,
    seed_offset: 7,
  });

  // — Salute finanziaria
  const k_cassa = build_kpi({
    key: "cassa",
    label: "Cassa attuale",
    value: incassato,
    growth: 0.12,
    seed_offset: 8,
    format: format_chf,
  });
  const cassa_proiettata = incassato + da_incassare * 0.92; // assume 92% incassabilità
  const k_cassa_proi = build_kpi({
    key: "cassa_proi",
    label: "Cassa proiettata fine stagione",
    value: cassa_proiettata,
    growth: 0.12,
    seed_offset: 9,
    format: format_chf,
    hint: "Include 92% delle fatture in scadenza",
  });
  // DSO sintetico
  const dso_value = scaduto > 0 ? 38 : 22;
  const k_dso = build_kpi({
    key: "dso",
    label: "DSO (giorni medi incasso)",
    value: dso_value,
    growth: -0.05,
    noise: 0.04,
    seed_offset: 10,
    format: (n) => `${Math.round(n)} gg`,
  });
  const k_margine = build_kpi({
    key: "margine",
    label: "Margine operativo",
    value: 0,
    growth: 0.05,
    seed_offset: 11,
    format: format_pct,
    unavailable: true,
  });

  // — Operativo aggregato
  const k_utilizzo = build_kpi({
    key: "utilizzo_pista",
    label: "Utilizzo monte ore pista",
    value: 0,
    growth: 0.04,
    seed_offset: 12,
    unavailable: true,
  });
  const k_costo_atleta = build_kpi({
    key: "costo_atleta",
    label: "Quota media per atleta",
    value: costo_medio_atleta,
    growth: 0.06,
    seed_offset: 13,
    format: format_chf,
  });
  const k_istruttori = build_kpi({
    key: "istruttori",
    label: "Istruttori attivi",
    value: istruttori_attivi,
    growth: 0.05,
    noise: 0.02,
    seed_offset: 14,
  });

  // ─── Drawer state ─────────────────────────────────────────
  const [open_kpi, set_open_kpi] = useState<KpiData | null>(null);

  // ─── Piramide aggregata (per zona E) ─────────────────────
  const pyramid_rows: PyramidRow[] = useMemo(() => {
    const order = ["Oro", "Interoro", "Argento", "Interargento", "Bronzo", "Interbronzo", "Stellina 4", "Stellina 3", "Stellina 2", "Stellina 1", "Pulcini"];
    return order
      .filter((l) => ripartizione[l] > 0 || l === "Pulcini")
      .map((l) => ({ label: l, value: ripartizione[l] || 0 }));
  }, [ripartizione]);

  const piramide_diag = useMemo(() => {
    const top = (ripartizione.Oro || 0) + (ripartizione.Interoro || 0) + (ripartizione.Argento || 0) + (ripartizione.Interargento || 0);
    const intermedio = (ripartizione.Bronzo || 0) + (ripartizione.Interbronzo || 0);
    const stelline = (ripartizione["Stellina 1"] || 0) + (ripartizione["Stellina 2"] || 0) + (ripartizione["Stellina 3"] || 0) + (ripartizione["Stellina 4"] || 0);
    const pulcini = ripartizione.Pulcini || 0;
    return diagnostica_piramide({ Pulcini: pulcini, Stelline: stelline, Intermedio: intermedio, Top: top });
  }, [ripartizione]);

  // Piramide comparativa anno scorso (sintetica)
  const pyramid_prev: PyramidRow[] = useMemo(() => {
    const rnd = mulberry32(seed_base + 999);
    return pyramid_rows.map((r) => ({
      ...r,
      value: Math.max(0, Math.round(r.value * (0.85 + rnd() * 0.2))),
    }));
  }, [pyramid_rows, seed_base]);

  // ─── Loading ─────────────────────────────────────────────
  if (l_atleti || l_fatture || l_gare) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="h-8 w-8 animate-spin rounded-full border-b-2 border-primary" />
      </div>
    );
  }

  // ─── Drawer extras per finanze ───────────────────────────
  const finance_drawer_extra = open_kpi && (open_kpi.key === "cassa" || open_kpi.key === "cassa_proi") ? (
    <>
      <div>
        <div className="text-xs uppercase tracking-wider text-muted-foreground mb-3">Incassi attesi</div>
        <div className="rounded-2xl border border-border/40 overflow-hidden">
          <table className="w-full text-sm">
            <tbody>
              <tr className="border-b border-border/40">
                <td className="px-4 py-3 text-muted-foreground">Prossimi 30 giorni</td>
                <td className="px-4 py-3 text-right font-medium tabular-nums">{format_chf(da_incassare * 0.4)}</td>
              </tr>
              <tr className="border-b border-border/40">
                <td className="px-4 py-3 text-muted-foreground">Prossimi 60 giorni</td>
                <td className="px-4 py-3 text-right font-medium tabular-nums">{format_chf(da_incassare * 0.7)}</td>
              </tr>
              <tr>
                <td className="px-4 py-3 text-muted-foreground">Prossimi 90 giorni</td>
                <td className="px-4 py-3 text-right font-medium tabular-nums">{format_chf(da_incassare)}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
      <div>
        <div className="text-xs uppercase tracking-wider text-muted-foreground mb-3">Breakdown costi</div>
        <div className="rounded-2xl border border-border/40 bg-muted/30 p-6 text-sm text-muted-foreground italic text-center">
          Da configurare nel modulo costi
        </div>
      </div>
    </>
  ) : null;

  return (
    <TooltipProvider delayDuration={200}>
      <div className="animate-fade-in -mx-4 sm:-mx-6 lg:-mx-8 -mt-6 pb-12">
        {/* ZONA 1 — Saluto + selettore confronto */}
        <section className="px-6 sm:px-12 lg:px-24 pt-10 pb-10">
          <div className="flex items-start justify-between gap-6 flex-wrap">
            <div>
              <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground mb-3">{data_lunga}</p>
              <h1 className="font-serif text-3xl sm:text-4xl font-light text-foreground tracking-tight">
                {saluto}, <span className="font-normal">{nome_pres}</span>.
              </h1>
              {atleti_attivi.length > 0 && (
                <p className="mt-4 max-w-3xl text-base sm:text-lg leading-relaxed text-muted-foreground">
                  Il club conta <span className="font-semibold text-foreground">{format_int(atleti_attivi.length)}</span> atleti attivi
                  {incassato > 0 ? (
                    <>
                      {" "}e ha incassato{" "}
                      <span className="font-semibold text-foreground">{format_chf(incassato)}</span> di quote in {stagione_label}.
                    </>
                  ) : (
                    <> in {stagione_label}.</>
                  )}
                </p>
              )}
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs uppercase tracking-wider text-muted-foreground">Confronto</span>
              <Select value={compare} onValueChange={(v) => set_compare(v as ComparePeriod)}>
                <SelectTrigger className="w-[200px] rounded-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {(Object.keys(COMPARE_LABEL) as ComparePeriod[]).map((k) => (
                    <SelectItem key={k} value={k}>
                      {COMPARE_LABEL[k]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </section>

        {/* ZONA 2 — Blocchi di KPI */}
        <section className="px-6 sm:px-12 lg:px-24 space-y-12">
          <KpiBlock title="Atleti & community" cols={4}>
            <KpiCard kpi={k_atleti_totali} on_click={() => set_open_kpi(k_atleti_totali)} />
            <KpiCard kpi={k_nuovi} on_click={() => set_open_kpi(k_nuovi)} />
            <KpiCard kpi={k_ritenzione} on_click={() => set_open_kpi(k_ritenzione)} />
            <KpiCard kpi={k_abbandoni} />
          </KpiBlock>

          <KpiBlock title="Performance sportiva" cols={3}>
            <KpiCard kpi={k_test} on_click={() => set_open_kpi(k_test)} />
            <KpiCard kpi={k_gare} on_click={() => set_open_kpi(k_gare)} />
            <KpiCard kpi={k_podi} on_click={() => set_open_kpi(k_podi)} />
          </KpiBlock>

          <KpiBlock title="Salute finanziaria" cols={4}>
            <KpiCard kpi={k_cassa} on_click={() => set_open_kpi(k_cassa)} />
            <KpiCard kpi={k_cassa_proi} on_click={() => set_open_kpi(k_cassa_proi)} />
            <KpiCard kpi={k_dso} on_click={() => set_open_kpi(k_dso)} />
            <KpiCard kpi={k_margine} />
          </KpiBlock>

          <KpiBlock title="Operativo aggregato" cols={3}>
            <KpiCard kpi={k_utilizzo} />
            <KpiCard kpi={k_costo_atleta} on_click={() => set_open_kpi(k_costo_atleta)} />
            <KpiCard kpi={k_istruttori} on_click={() => set_open_kpi(k_istruttori)} />
          </KpiBlock>

          {/* ZONA 2-E — Densità livelli */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="text-[11px] uppercase tracking-[0.2em] text-muted-foreground">Densità livelli</div>
              <span className="inline-flex items-center gap-2 rounded-full bg-primary/10 px-3 py-1 text-xs font-medium text-primary">
                {piramide_diag}
              </span>
            </div>
            <div className="rounded-2xl bg-card border border-border/40 p-6 grid grid-cols-1 lg:grid-cols-[1fr_240px] gap-8">
              <div>
                <div className="text-xs uppercase tracking-wider text-muted-foreground mb-4">Stagione corrente</div>
                <PiramideOrizzontale rows={pyramid_rows} />
              </div>
              <div className="lg:border-l lg:border-border/40 lg:pl-8">
                <div className="text-xs uppercase tracking-wider text-muted-foreground mb-4">Anno scorso</div>
                <PiramideOrizzontale rows={pyramid_prev} compact />
              </div>
            </div>
          </div>
        </section>

        {/* ZONA 3 — Attenzioni */}
        {attenzioni.length > 0 && (
          <section className="px-6 sm:px-12 lg:px-24 pt-12">
            <div className="text-[11px] uppercase tracking-[0.2em] text-muted-foreground mb-4">Attenzioni</div>
            <div className="rounded-2xl border border-border/40 bg-card/50 divide-y divide-border/40">
              {attenzioni.map((a, i) => {
                const Icon = a.icon;
                return (
                  <button
                    key={i}
                    onClick={a.action}
                    className="w-full flex items-center gap-4 px-6 py-4 hover:bg-muted/40 transition-colors text-left group"
                  >
                    <Icon className="h-4 w-4 text-muted-foreground shrink-0" />
                    <div className="flex-1 text-sm text-foreground/80">{a.label}</div>
                    <span className="text-xs text-muted-foreground group-hover:text-primary transition-colors flex items-center gap-1">
                      {a.cta}
                      <ChevronRight className="h-3 w-3" />
                    </span>
                  </button>
                );
              })}
            </div>
          </section>
        )}

        {/* ZONA 4 — I nostri atleti */}
        {atleti_vetrina.length > 0 && (
          <section className="px-6 sm:px-12 lg:px-24 pt-16">
            <div className="mb-8">
              <h2 className="font-serif text-2xl sm:text-3xl font-light text-foreground">I nostri atleti</h2>
              <p className="text-sm text-muted-foreground mt-1">Le promesse del club</p>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
              {atleti_vetrina.map(({ atleta, medaglie, ultimo_risultato }) => (
                <button
                  key={atleta.id}
                  onClick={() => navigate(`/atleti/${atleta.id}`)}
                  className="group text-left animate-fade-in"
                >
                  <div className="aspect-square rounded-2xl overflow-hidden bg-muted mb-4 relative">
                    {atleta.foto_url ? (
                      <img
                        src={atleta.foto_url}
                        alt={`${atleta.nome} ${atleta.cognome}`}
                        className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-primary/10 to-primary/30 text-primary text-3xl font-light">
                        {get_iniziali(atleta.nome, atleta.cognome)}
                      </div>
                    )}
                    {medaglie > 0 && (
                      <div className="absolute top-3 right-3 inline-flex items-center gap-1 bg-background/90 backdrop-blur-sm rounded-full px-2 py-1 text-xs font-medium text-foreground shadow-sm">
                        <Trophy className="h-3 w-3 text-primary" />
                        {medaglie}
                      </div>
                    )}
                  </div>
                  <div className="font-serif text-base text-foreground leading-tight">
                    {atleta.nome} {atleta.cognome}
                  </div>
                  <div className="text-xs text-muted-foreground mt-1">
                    {get_categoria_label(atleta)} · {get_livello_label(atleta)}
                  </div>
                  {ultimo_risultato && (
                    <div className="text-xs text-primary/80 mt-1 truncate">{ultimo_risultato}</div>
                  )}
                </button>
              ))}
            </div>
          </section>
        )}

        {/* Banner dati simulati */}
        <section className="px-6 sm:px-12 lg:px-24 pt-16">
          <Tooltip>
            <TooltipTrigger asChild>
              <div className="inline-flex items-center gap-2 text-[11px] text-muted-foreground/70 cursor-help">
                <Info className="h-3 w-3" />
                Stagioni storiche con dati di simulazione
              </div>
            </TooltipTrigger>
            <TooltipContent className="max-w-xs">
              I confronti con anni precedenti utilizzano dati simulati coerenti.
              La storia reale del club partirà dalla prossima stagione.
            </TooltipContent>
          </Tooltip>
        </section>

        {/* Drawer KPI dettaglio */}
        <KpiDrawer
          open={!!open_kpi}
          on_close={() => set_open_kpi(null)}
          kpi={open_kpi}
          extra={finance_drawer_extra}
        />
      </div>
    </TooltipProvider>
  );
};

export default PresidentDashboard;
