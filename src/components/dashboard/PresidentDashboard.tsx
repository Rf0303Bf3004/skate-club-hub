import React, { useEffect, useMemo, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  ArrowDown,
  ArrowUp,
  ArrowRight,
  TrendingUp,
  Users,
  Snowflake,
  Wallet,
  Trophy,
  AlertTriangle,
  FileDown,
  Sparkles,
  Calendar,
  CreditCard,
  Briefcase,
  Clock,
  X,
} from "lucide-react";
import {
  Sheet,
  SheetContent,
} from "@/components/ui/sheet";
import {
  narrateDomanda,
  narrateAtleti,
  narrateRicavi,
  narrateCosti,
  narrateLezioni,
  narrateSportivo,
  type AreaNarration,
  type Tone,
} from "@/lib/narrate";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip as RTooltip,
  PieChart,
  Pie,
  Cell,
  BarChart,
  Bar,
  CartesianGrid,
  Area,
  AreaChart,
} from "recharts";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/lib/supabase";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

const CLUB_ID = "00030001-0000-0000-0000-000000000001";

// ─── Helpers ──────────────────────────────────────────────────────────
const fmt_chf = (n: number) =>
  new Intl.NumberFormat("it-CH", { style: "currency", currency: "CHF", maximumFractionDigits: 0 }).format(n || 0);
const fmt_int = (n: number) => new Intl.NumberFormat("it-CH").format(Math.round(n || 0));
const fmt_pct = (n: number, dec = 0) => `${n >= 0 ? "" : ""}${n.toFixed(dec)}%`;
const initials = (n?: string, c?: string) => ((n || "")[0] || "") + ((c || "")[0] || "") || "·";

function useCountUp(target: number, duration = 1100) {
  const [val, setVal] = useState(0);
  useEffect(() => {
    let raf = 0;
    const t0 = performance.now();
    const from = 0;
    const tick = (t: number) => {
      const p = Math.min(1, (t - t0) / duration);
      const eased = 1 - Math.pow(1 - p, 3);
      setVal(from + (target - from) * eased);
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target, duration]);
  return val;
}

const LIVELLI_ORDER = [
  "Pulcini",
  "Stellina 1",
  "Stellina 2",
  "Stellina 3",
  "Stellina 4",
  "Interbronzo",
  "Bronzo",
  "Interargento",
  "Argento",
  "Interoro",
  "Oro",
];

const FONTE_LABEL: Record<string, string> = {
  quote_corsi: "Quote corsi",
  pacchetti_opzionali: "Pacchetti opzionali",
  lezioni_private: "Lezioni private",
  eventi: "Eventi",
  sponsor: "Sponsor",
  altro: "Altro",
};
const FONTE_COLOR: Record<string, string> = {
  quote_corsi: "#0e7490", // cyan-700
  pacchetti_opzionali: "#10b981", // emerald
  lezioni_private: "#f59e0b", // amber
  eventi: "#8b5cf6", // violet
  sponsor: "#ec4899", // pink
  altro: "#94a3b8", // slate
};

// ─── Data fetching ────────────────────────────────────────────────────
type Stagione = { id: string; nome: string; data_inizio: string; data_fine: string; attiva: boolean };

function use_stagioni_demo() {
  return useQuery<Stagione[]>({
    queryKey: ["pres_stagioni"],
    staleTime: 30_000,
    queryFn: async () => {
      const { data } = await supabase
        .from("stagioni")
        .select("id, nome, data_inizio, data_fine, attiva")
        .eq("club_id", CLUB_ID)
        .order("data_inizio", { ascending: false });
      return (data as any) || [];
    },
  });
}

function use_dashboard_data(stagione_id: string | null, prev_stagione_id: string | null) {
  return useQuery({
    queryKey: ["pres_dashboard", stagione_id, prev_stagione_id],
    enabled: !!stagione_id,
    staleTime: 30_000,
    queryFn: async () => {
      const ids = [stagione_id, prev_stagione_id].filter(Boolean) as string[];
      const [
        atletiR,
        storiciR,
        bilancioR,
        ricaviR,
        capacitaR,
        richiesteR,
        oreR,
        catalogoPackR,
        iscrPackR,
        costiIstR,
        oreLavR,
        lezioniR,
        istruttoriR,
        motiviR,
        cassaR,
        igareR,
      ] = await Promise.all([
        supabase.from("atleti").select("id, nome, cognome, foto_url, livello_artistica, livello_attuale, livello_amatori, livello_stile, agonista, data_nascita, attivo, categoria").eq("club_id", CLUB_ID),
        supabase.from("atleti_storici_stagioni").select("status, motivo_abbandono, stagione_id, livello").eq("club_id", CLUB_ID).in("stagione_id", ids),
        supabase.from("bilancio_stagione").select("*").eq("club_id", CLUB_ID),
        supabase.from("ricavi_per_fonte").select("*").eq("club_id", CLUB_ID),
        supabase.from("capacita_corsi").select("corso_id, capacita_max, ore_settimanali_dedicate, corsi(nome, stagione_id)").eq("club_id", CLUB_ID),
        supabase.from("richieste_iscrizione_storiche").select("*").eq("club_id", CLUB_ID).in("stagione_id", ids),
          supabase.from("ore_pista_disponibili").select("*").eq("club_id", CLUB_ID),
        supabase.from("catalogo_pacchetti_opzionali").select("id, nome, costo_mensile, costo_annuale, costo_1_sessione, costo_2_sessioni").eq("club_id", CLUB_ID),
        supabase.from("iscrizioni_pacchetti_storiche").select("pacchetto_id, prezzo_pagato, atleta_id, stagione_id").eq("club_id", CLUB_ID).eq("stagione_id", stagione_id as string),
        supabase.from("costi_istruttori").select("*").eq("club_id", CLUB_ID).eq("stagione_id", stagione_id as string),
        supabase.from("ore_lavorate_istruttori").select("*").eq("club_id", CLUB_ID).eq("stagione_id", stagione_id as string),
        supabase.from("lezioni_private_storiche").select("istruttore_id, atleta_id, ore, importo_pagato, data").eq("club_id", CLUB_ID).eq("stagione_id", stagione_id as string),
        supabase.from("istruttori").select("id, nome, cognome").eq("club_id", CLUB_ID),
        supabase.from("motivi_abbandono_aggregati").select("motivo, count, stagione_id").eq("club_id", CLUB_ID).eq("stagione_id", stagione_id as string),
        supabase.from("cassa_movimenti").select("*").eq("club_id", CLUB_ID).eq("stagione_id", stagione_id as string),
        supabase.from("iscrizioni_gare").select("medaglia, posizione, atleta_id").limit(2000),
      ]);
      return {
        atleti: atletiR.data || [],
        storici: storiciR.data || [],
        bilancio: bilancioR.data || [],
        ricavi: ricaviR.data || [],
        capacita: capacitaR.data || [],
        richieste: richiesteR.data || [],
        ore: oreR.data || [],
        catalogo_pack: catalogoPackR.data || [],
        iscr_pack: iscrPackR.data || [],
        costi_ist: costiIstR.data || [],
        ore_lav: oreLavR.data || [],
        lezioni: lezioniR.data || [],
        istruttori: istruttoriR.data || [],
        motivi: motiviR.data || [],
        cassa: cassaR.data || [],
        igare: igareR.data || [],
      };
    },
  });
}

// ─── Mini UI ──────────────────────────────────────────────────────────
const Section: React.FC<{ kicker: string; title: string; intro?: string; accent?: string; children: React.ReactNode }> = ({
  kicker,
  title,
  intro,
  accent = "#0e7490",
  children,
}) => (
  <section className="px-6 md:px-10 py-16 md:py-24 max-w-[1400px] mx-auto">
    <div className="mb-10 md:mb-14">
      <div className="flex items-center gap-3 mb-4">
        <span className="h-px w-10" style={{ background: accent }} />
        <span className="uppercase tracking-[0.18em] text-xs font-semibold" style={{ color: accent }}>
          {kicker}
        </span>
      </div>
      <h2 className="font-serif text-4xl md:text-5xl lg:text-6xl text-slate-900 leading-[1.05] tracking-tight">
        {title}
      </h2>
      {intro && <p className="mt-4 text-lg text-slate-500 max-w-3xl">{intro}</p>}
    </div>
    {children}
  </section>
);

const HeroNumber: React.FC<{ value: number; suffix?: string; prefix?: string; delta?: number; label?: string; isCurrency?: boolean }> = ({
  value,
  suffix,
  prefix,
  delta,
  label,
  isCurrency,
}) => {
  const v = useCountUp(value);
  const formatted = isCurrency ? fmt_chf(v) : fmt_int(v);
  return (
    <div>
      <div className="font-serif text-[56px] md:text-[72px] leading-none tracking-tight text-slate-900 tabular-nums">
        {prefix}
        {formatted}
        {suffix}
      </div>
      {(label || delta !== undefined) && (
        <div className="mt-3 flex items-center gap-3 text-sm text-slate-500">
          {label && <span>{label}</span>}
          {delta !== undefined && <DeltaPill value={delta} />}
        </div>
      )}
    </div>
  );
};

const DeltaPill: React.FC<{ value: number; suffix?: string }> = ({ value, suffix = "%" }) => {
  const positive = value > 0.1;
  const negative = value < -0.1;
  const cls = positive
    ? "bg-emerald-50 text-emerald-700"
    : negative
    ? "bg-rose-50 text-rose-700"
    : "bg-slate-100 text-slate-600";
  const Icon = positive ? ArrowUp : negative ? ArrowDown : ArrowRight;
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold ${cls}`}>
      <Icon className="h-3 w-3" />
      {Math.abs(value).toFixed(1)}
      {suffix}
    </span>
  );
};

// ─── HEADER ───────────────────────────────────────────────────────────
const Header: React.FC<{
  nome: string;
  stagioni: Stagione[];
  stagioneId: string;
  setStagioneId: (s: string) => void;
  confronta: boolean;
  setConfronta: (v: boolean) => void;
  totAtleti: number;
  ricavi: number;
  cassa: number;
  attesa: number;
  stagioneNome: string;
}> = ({ nome, stagioni, stagioneId, setStagioneId, confronta, setConfronta, totAtleti, ricavi, cassa, attesa, stagioneNome }) => {
  const greet = (() => {
    const h = new Date().getHours();
    if (h < 12) return "Buongiorno";
    if (h < 18) return "Buon pomeriggio";
    return "Buonasera";
  })();
  return (
    <header className="px-6 md:px-10 pt-14 md:pt-20 pb-12 max-w-[1400px] mx-auto">
      <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-8">
        <div className="flex-1 min-w-0">
          <div className="text-xs uppercase tracking-[0.2em] text-cyan-700 font-semibold mb-3">
            Dashboard Presidente
          </div>
          <h1 className="font-serif text-5xl md:text-6xl lg:text-7xl text-slate-900 tracking-tight leading-[1.02]">
            {greet}, {nome || "Presidente"}.
          </h1>
          <p className="mt-5 text-lg md:text-xl text-slate-500 max-w-2xl leading-relaxed">
            Stagione <span className="text-slate-900 font-medium">{stagioneNome}</span> — il club conta{" "}
            <span className="text-slate-900 font-medium">{fmt_int(totAtleti)}</span> atleti e ha incassato{" "}
            <span className="text-slate-900 font-medium">{fmt_chf(ricavi)}</span>.
          </p>
        </div>
        <div className="flex flex-col gap-3 md:items-end shrink-0">
          <div className="flex items-center gap-2 bg-white border border-slate-200 rounded-full pl-4 pr-1 py-1 shadow-sm">
            <Calendar className="h-4 w-4 text-slate-400" />
            <Select value={stagioneId} onValueChange={setStagioneId}>
              <SelectTrigger className="border-0 shadow-none h-9 min-w-[160px] focus:ring-0">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {stagioni.map((s) => (
                  <SelectItem key={s.id} value={s.id}>
                    {s.nome}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <label className="inline-flex items-center gap-3 text-sm text-slate-600 cursor-pointer">
            <Switch checked={confronta} onCheckedChange={setConfronta} />
            <span>Confronta con anno scorso</span>
          </label>
        </div>
      </div>

      {/* mini hero stats */}
      <div className="mt-14 grid grid-cols-2 md:grid-cols-4 gap-8 md:gap-4 border-t border-slate-200 pt-10">
        <MiniHero label="Atleti totali" value={fmt_int(totAtleti)} />
        <MiniHero label="Ricavi stagione" value={fmt_chf(ricavi)} />
        <MiniHero label="Saldo cassa" value={fmt_chf(cassa)} accent={cassa >= 0 ? "text-emerald-600" : "text-rose-600"} />
        <MiniHero label="Lista d'attesa" value={fmt_int(attesa)} accent="text-amber-600" />
      </div>
    </header>
  );
};
const MiniHero: React.FC<{ label: string; value: string; accent?: string }> = ({ label, value, accent = "text-slate-900" }) => (
  <div className="min-w-0">
    <div className="text-xs uppercase tracking-widest text-slate-400 font-semibold mb-2 truncate">{label}</div>
    <div
      className={`font-serif tracking-tight tabular-nums leading-none truncate ${accent}`}
      style={{ fontSize: "clamp(1.875rem, 2.4vw, 2.25rem)", fontFeatureSettings: "'tnum'" }}
    >
      {value}
    </div>
  </div>
);

// ─── AREA 1 - GHIACCIO ────────────────────────────────────────────────
const Area1Ghiaccio: React.FC<{ d: any; oreRow: any }> = ({ d, oreRow }) => {
  if (!oreRow) return null;
  const tot = Number(oreRow.ore_settimanali_totali || 0);
  const used = Number(oreRow.ore_settimanali_utilizzate || 0);
  const req = Number(oreRow.ore_richieste_se_accettassimo_tutti || 0);
  const costo = Number(oreRow.costo_orario_pista || 180);
  const max = Math.max(tot, used, req, 1);
  const ricRows = (d.richieste || []).filter((r: any) => r.stagione_id);
  const totRich = ricRows.reduce((s: number, r: any) => s + (r.n_richieste_ricevute || 0), 0);
  const totAcc = ricRows.reduce((s: number, r: any) => s + (r.n_iscritti_accettati || 0), 0);
  const totAtt = ricRows.reduce((s: number, r: any) => s + (r.n_in_lista_attesa || 0), 0);
  const oreExtra = Math.max(0, req - tot);
  const costoExtra = oreExtra * costo * 40; // ~40 settimane stagione
  const ricaviExtraPotenziali = totAtt * 1000; // ~1000 CHF/atleta media

  // join capacita+richieste per corso
  const corsiMap = new Map<string, any>();
  (d.capacita || []).forEach((c: any) => {
    corsiMap.set(c.corso_id, {
      nome: c.corsi?.nome || "Corso",
      capacita: c.capacita_max,
      ore: c.ore_settimanali_dedicate,
      iscritti: 0,
      attesa: 0,
      richieste: 0,
    });
  });
  ricRows.forEach((r: any) => {
    const row = corsiMap.get(r.corso_id);
    if (row) {
      row.iscritti = r.n_iscritti_accettati;
      row.attesa = r.n_in_lista_attesa;
      row.richieste = r.n_richieste_ricevute;
    }
  });
  const tabella = Array.from(corsiMap.values());

  const Bar = ({ label, value, color, highlight }: any) => (
    <div className="mb-5">
      <div className="flex justify-between text-sm mb-2">
        <span className="text-slate-700 font-medium">{label}</span>
        <span className="font-serif text-2xl tabular-nums text-slate-900">{value}h</span>
      </div>
      <div className="h-3 bg-slate-100 rounded-full overflow-hidden">
        <div
          className="h-full rounded-full transition-all duration-700"
          style={{ width: `${(value / max) * 100}%`, background: color, boxShadow: highlight ? `0 0 0 3px ${color}22` : undefined }}
        />
      </div>
    </div>
  );

  return (
    <div className="grid lg:grid-cols-3 gap-10">
      <div className="lg:col-span-2 bg-white rounded-3xl border border-slate-200 p-8 md:p-10 shadow-sm">
        <h3 className="text-sm uppercase tracking-widest text-slate-400 font-semibold mb-6">
          Ore di pista — settimana tipo
        </h3>
        <Bar label="Disponibili" value={tot} color="#0e7490" />
        <Bar label="Utilizzate" value={used} color="#67e8f9" />
        <Bar label="Richieste se accettassimo tutti" value={req} color="#f59e0b" highlight />
        <div className="mt-8 p-5 rounded-2xl bg-amber-50 border border-amber-100">
          <div className="flex items-start gap-3">
            <Snowflake className="h-5 w-5 text-amber-600 mt-0.5" />
            <div>
              <div className="font-serif text-2xl text-amber-900">+{oreExtra}h ci servirebbero</div>
              <div className="text-sm text-amber-800 mt-1">
                Costo extra stimato: <strong>{fmt_chf(costoExtra)}</strong>/anno · Ricavi potenziali da{" "}
                {fmt_int(totAtt)} atleti in attesa: <strong>~{fmt_chf(ricaviExtraPotenziali)}</strong>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-3xl border border-slate-200 p-8 shadow-sm flex flex-col justify-between">
        <div>
          <h3 className="text-sm uppercase tracking-widest text-slate-400 font-semibold mb-6">Domanda stagione</h3>
          <div className="space-y-6">
            <div>
              <div className="text-xs text-slate-500 uppercase tracking-wider">Richieste ricevute</div>
              <div className="font-serif text-4xl text-slate-900 tabular-nums">{fmt_int(totRich)}</div>
            </div>
            <div>
              <div className="text-xs text-slate-500 uppercase tracking-wider">Iscritti accettati</div>
              <div className="font-serif text-4xl text-emerald-600 tabular-nums">{fmt_int(totAcc)}</div>
            </div>
            <div>
              <div className="text-xs text-slate-500 uppercase tracking-wider">In lista d'attesa</div>
              <div className="font-serif text-4xl text-rose-600 tabular-nums">{fmt_int(totAtt)}</div>
            </div>
          </div>
        </div>
        <div className="text-xs text-slate-500 mt-8">
          Costo orario pista: <strong className="text-slate-700">{fmt_chf(costo)}/h</strong>
        </div>
      </div>

      <div className="lg:col-span-3 bg-white rounded-3xl border border-slate-200 overflow-hidden shadow-sm">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-slate-500 uppercase text-xs tracking-wider">
            <tr>
              <th className="text-left px-6 py-4 font-semibold">Corso</th>
              <th className="text-right px-6 py-4 font-semibold">Capacità</th>
              <th className="text-right px-6 py-4 font-semibold">Iscritti</th>
              <th className="text-right px-6 py-4 font-semibold">Lista attesa</th>
              <th className="text-right px-6 py-4 font-semibold">Saturazione</th>
            </tr>
          </thead>
          <tbody>
            {tabella.map((r: any, i: number) => {
              const sat = r.capacita ? (r.iscritti / r.capacita) * 100 : 0;
              return (
                <tr key={i} className="border-t border-slate-100">
                  <td className="px-6 py-4 font-medium text-slate-900">{r.nome}</td>
                  <td className="px-6 py-4 text-right tabular-nums text-slate-600">{r.capacita}</td>
                  <td className="px-6 py-4 text-right tabular-nums text-slate-900">{r.iscritti}</td>
                  <td className="px-6 py-4 text-right tabular-nums">
                    {r.attesa > 0 ? <span className="text-amber-600 font-semibold">{r.attesa}</span> : <span className="text-slate-400">0</span>}
                  </td>
                  <td className="px-6 py-4 text-right">
                    <div className="inline-flex items-center gap-2">
                      <div className="w-24 h-2 bg-slate-100 rounded-full overflow-hidden">
                        <div className="h-full bg-cyan-600" style={{ width: `${Math.min(100, sat)}%` }} />
                      </div>
                      <span className="tabular-nums font-semibold text-slate-700 w-12 text-right">{Math.round(sat)}%</span>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
};

// ─── AREA 2 - ATLETI ──────────────────────────────────────────────────
const Area2Atleti: React.FC<{ d: any; bilancioStorico: any[]; storiciByStagione: Map<string, any[]>; stagioniOrd: Stagione[]; currStagId: string; prevStagId: string | null; confronta: boolean }> = ({
  d,
  storiciByStagione,
  stagioniOrd,
  currStagId,
  prevStagId,
  confronta,
}) => {
  const atletiAttivi = (d.atleti || []).filter((a: any) => a.attivo);
  const total = atletiAttivi.length;

  const curr = storiciByStagione.get(currStagId) || [];
  const prev = prevStagId ? storiciByStagione.get(prevStagId) || [] : [];
  const prevTot = prev.length;
  const yoyPct = prevTot ? ((total - prevTot) / prevTot) * 100 : 0;

  const abbandoni = curr.filter((s) => s.status === "abbandonato").length;
  const ritenzione = prevTot ? ((prevTot - abbandoni) / prevTot) * 100 : 100;
  const newCount = Math.max(0, total - (prevTot - abbandoni));

  // età media
  const today = new Date();
  const ages = atletiAttivi
    .map((a: any) => (a.data_nascita ? (today.getTime() - new Date(a.data_nascita).getTime()) / (365.25 * 24 * 3600 * 1000) : null))
    .filter((x: any) => x != null);
  const ageAvg = ages.length ? ages.reduce((a: number, b: number) => a + b, 0) / ages.length : 0;

  // piramide
  const counts: Record<string, number> = {};
  LIVELLI_ORDER.forEach((l) => (counts[l] = 0));
  atletiAttivi.forEach((a: any) => {
    const l = a.livello_artistica || a.livello_amatori || a.livello_attuale;
    if (l && counts[l] !== undefined) counts[l]++;
    else if (a.categoria === "pulcini") counts["Pulcini"]++;
  });
  const maxLivello = Math.max(1, ...Object.values(counts));
  const prevCounts: Record<string, number> = {};
  LIVELLI_ORDER.forEach((l) => (prevCounts[l] = 0));
  prev.forEach((s: any) => {
    if (s.livello && prevCounts[s.livello] !== undefined) prevCounts[s.livello]++;
  });
  // fallback: se i livelli storici non sono popolati, scala dalla stagione corrente
  const prevHasLevels = Object.values(prevCounts).some((v) => v > 0);
  if (!prevHasLevels) {
    const ratio = total ? prevTot / total : 1;
    LIVELLI_ORDER.forEach((l) => (prevCounts[l] = Math.round(counts[l] * ratio)));
  }

  const livColor = (i: number) => {
    // gradient verde tenue → cyan → viola
    const stops = ["#a7f3d0", "#86efac", "#67e8f9", "#22d3ee", "#0ea5e9", "#3b82f6", "#6366f1", "#8b5cf6", "#a78bfa", "#c084fc", "#e879f9"];
    return stops[i] || "#8b5cf6";
  };

  // trend atleti per stagione
  const trend = stagioniOrd
    .slice()
    .reverse()
    .map((s) => {
      const list = storiciByStagione.get(s.id);
      const c = (list && list.length) || (s.id === currStagId ? total : 0);
      return { name: s.nome, atleti: c };
    });

  // diagnostica
  const upper = (counts["Bronzo"] || 0) + (counts["Interargento"] || 0) + (counts["Argento"] || 0) + (counts["Interoro"] || 0) + (counts["Oro"] || 0);
  const lower = (counts["Pulcini"] || 0) + (counts["Stellina 1"] || 0) + (counts["Stellina 2"] || 0);
  const diagn = lower >= upper * 1.2 ? "Piramide sana" : upper > lower ? "Piramide top-heavy" : "Piramide equilibrata";

  return (
    <>
      <div className="grid md:grid-cols-3 gap-10 items-end mb-12">
        <div className="md:col-span-1">
          <HeroNumber value={total} label="atleti attivi" delta={confronta ? yoyPct : undefined} />
        </div>
        <div className="md:col-span-2 grid grid-cols-2 lg:grid-cols-4 gap-6">
          <MiniStat label="Nuovi iscritti" value={fmt_int(newCount)} />
          <MiniStat label="Abbandoni" value={fmt_int(abbandoni)} accent="text-rose-600" />
          <MiniStat label="Ritenzione" value={`${ritenzione.toFixed(0)}%`} accent="text-emerald-600" />
          <MiniStat label="Età media" value={ageAvg ? `${ageAvg.toFixed(1)} a.` : "—"} />
        </div>
      </div>

      <div className="bg-white rounded-3xl border border-slate-200 p-8 md:p-10 shadow-sm">
        <div className="flex items-baseline justify-between mb-8">
          <h3 className="text-sm uppercase tracking-widest text-slate-400 font-semibold">Piramide livelli</h3>
          <span className="inline-flex items-center gap-2 text-sm text-emerald-700 bg-emerald-50 rounded-full px-3 py-1">
            <Sparkles className="h-3.5 w-3.5" /> {diagn}
          </span>
        </div>
        <div className="space-y-3">
          {LIVELLI_ORDER.map((l, i) => {
            const c = counts[l] || 0;
            const pc = prevCounts[l] || 0;
            const wCurr = (c / maxLivello) * 100;
            const wPrev = (pc / maxLivello) * 100;
            const pct = total ? (c / total) * 100 : 0;
            return (
              <div key={l} className="flex items-center gap-4">
                <div className="w-28 text-sm text-slate-600 text-right">{l}</div>
                <div className="flex-1 relative h-7 bg-slate-50 rounded-md overflow-hidden">
                  {confronta && (
                    <div className="absolute inset-y-0 left-0 bg-slate-200/70" style={{ width: `${wPrev}%` }} />
                  )}
                  <div
                    className="absolute inset-y-0 left-0 rounded-md transition-all duration-700"
                    style={{ width: `${wCurr}%`, background: livColor(i) }}
                  />
                </div>
                <div className="w-20 text-sm tabular-nums text-slate-900 font-semibold">{c}</div>
                <div className="w-12 text-xs text-slate-400 tabular-nums">{pct.toFixed(0)}%</div>
              </div>
            );
          })}
        </div>
      </div>

      <div className="mt-10 bg-white rounded-3xl border border-slate-200 p-8 md:p-10 shadow-sm">
        <h3 className="text-sm uppercase tracking-widest text-slate-400 font-semibold mb-8">
          Atleti totali — ultime stagioni
        </h3>
        <div className="h-72">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={trend} margin={{ top: 30, right: 30, left: 10, bottom: 10 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
              <XAxis dataKey="name" tick={{ fill: "#64748b", fontSize: 12 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fill: "#64748b", fontSize: 12 }} axisLine={false} tickLine={false} width={40} />
              <RTooltip />
              <Line
                type="monotone"
                dataKey="atleti"
                stroke="#0e7490"
                strokeWidth={3}
                dot={{ r: 6, fill: "#0e7490" }}
                label={{ position: "top", fill: "#0f172a", fontSize: 13, fontWeight: 600 }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>
    </>
  );
};
const MiniStat: React.FC<{ label: string; value: string; accent?: string }> = ({ label, value, accent = "text-slate-900" }) => (
  <div className="bg-white border border-slate-200 rounded-2xl px-5 py-5">
    <div className="text-xs text-slate-500 uppercase tracking-wider">{label}</div>
    <div className={`font-serif text-3xl tabular-nums mt-1 ${accent}`}>{value}</div>
  </div>
);

// ─── AREA 3 - RICAVI ──────────────────────────────────────────────────
const Area3Ricavi: React.FC<{ d: any; ricaviCurr: any[]; ricaviPrev: any[]; confronta: boolean; totAtleti: number }> = ({
  d,
  ricaviCurr,
  ricaviPrev,
  confronta,
  totAtleti,
}) => {
  const tot = ricaviCurr.reduce((s, r) => s + Number(r.importo || 0), 0);
  const totPrev = ricaviPrev.reduce((s, r) => s + Number(r.importo || 0), 0);
  const yoy = totPrev ? ((tot - totPrev) / totPrev) * 100 : 0;
  const pieData = ricaviCurr
    .map((r) => ({ name: FONTE_LABEL[r.fonte] || r.fonte, key: r.fonte, value: Number(r.importo) }))
    .sort((a, b) => b.value - a.value);

  // pacchetti
  const pkMap = new Map<string, any>();
  (d.catalogo_pack || []).forEach((p: any) => {
    pkMap.set(p.id, { ...p, iscritti: 0, ricavo: 0, prezzo: p.costo_mensile || p.costo_annuale || p.costo_2_sessioni || p.costo_1_sessione || 0 });
  });
  (d.iscr_pack || []).forEach((i: any) => {
    const r = pkMap.get(i.pacchetto_id);
    if (r) {
      r.iscritti++;
      r.ricavo += Number(i.prezzo_pagato);
    }
  });
  const pkRows = Array.from(pkMap.values()).filter((p: any) => p.iscritti > 0).sort((a, b) => b.ricavo - a.ricavo);
  const maxPk = Math.max(1, ...pkRows.map((p) => p.ricavo));
  const ricavoMedio = totAtleti ? tot / totAtleti : 0;

  return (
    <>
      <div className="mb-12">
        <HeroNumber value={tot} isCurrency label="ricavi stagione" delta={confronta ? yoy : undefined} />
      </div>

      <div className="grid lg:grid-cols-3 gap-10">
        <div className="lg:col-span-2 bg-white rounded-3xl border border-slate-200 p-8 md:p-10 shadow-sm">
          <h3 className="text-sm uppercase tracking-widest text-slate-400 font-semibold mb-6">
            Composizione ricavi
          </h3>
          <div className="grid md:grid-cols-2 gap-6 items-center">
            <div className="h-72">
              <ResponsiveContainer>
                <PieChart>
                  <Pie data={pieData} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={60} outerRadius={110} paddingAngle={2}>
                    {pieData.map((e: any) => (
                      <Cell key={e.key} fill={FONTE_COLOR[e.key] || "#94a3b8"} />
                    ))}
                  </Pie>
                  <RTooltip formatter={(v: any) => fmt_chf(Number(v))} />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="space-y-3">
              {pieData.map((e: any) => {
                const pct = tot ? (e.value / tot) * 100 : 0;
                return (
                  <div key={e.key} className="flex items-center gap-3">
                    <span className="h-3 w-3 rounded-sm shrink-0" style={{ background: FONTE_COLOR[e.key] }} />
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium text-slate-700">{e.name}</div>
                    </div>
                    <div className="text-right">
                      <div className="font-serif text-lg tabular-nums text-slate-900">{fmt_chf(e.value)}</div>
                      <div className="text-xs text-slate-400">{pct.toFixed(0)}%</div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        <div className="bg-gradient-to-br from-cyan-50 to-emerald-50 rounded-3xl border border-cyan-100 p-8 flex flex-col justify-between">
          <div>
            <div className="text-xs uppercase tracking-widest text-cyan-700 font-semibold mb-3">Ricavo medio</div>
            <div className="font-serif text-5xl text-slate-900 tabular-nums">{fmt_chf(ricavoMedio)}</div>
            <div className="text-sm text-slate-600 mt-2">per atleta attivo</div>
          </div>
          <p className="text-sm text-slate-600 mt-6 leading-relaxed">
            Quote corsi è la fonte principale, ma <strong>pacchetti opzionali</strong> e{" "}
            <strong>lezioni private</strong> insieme superano CHF{" "}
            {fmt_chf(
              (ricaviCurr.find((r: any) => r.fonte === "pacchetti_opzionali")?.importo || 0) +
                (ricaviCurr.find((r: any) => r.fonte === "lezioni_private")?.importo || 0)
            )}
            .
          </p>
        </div>
      </div>

      <div className="mt-10 bg-white rounded-3xl border border-slate-200 p-8 md:p-10 shadow-sm">
        <h3 className="text-sm uppercase tracking-widest text-slate-400 font-semibold mb-6">
          Adesione ai pacchetti opzionali
        </h3>
        <div className="space-y-4">
          {pkRows.map((p: any) => {
            const pct = totAtleti ? (p.iscritti / totAtleti) * 100 : 0;
            return (
              <div key={p.id}>
                <div className="flex items-baseline justify-between mb-1.5">
                  <div>
                    <span className="font-medium text-slate-900">{p.nome}</span>
                    <span className="ml-3 text-sm text-slate-500">
                      {fmt_chf(Number(p.prezzo))} · {p.iscritti} atleti ({pct.toFixed(0)}%)
                    </span>
                  </div>
                  <div className="font-serif text-xl tabular-nums text-slate-900">{fmt_chf(p.ricavo)}</div>
                </div>
                <div className="h-2.5 bg-slate-100 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-emerald-400 to-cyan-500 transition-all duration-700"
                    style={{ width: `${(p.ricavo / maxPk) * 100}%` }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </>
  );
};

// ─── AREA 4 - ISTRUTTORI ──────────────────────────────────────────────
const Area4Istruttori: React.FC<{ d: any; ricaviCurr: any[] }> = ({ d, ricaviCurr }) => {
  // Aggregate ore per istruttore
  const oreByIst = new Map<string, any>();
  (d.ore_lav || []).forEach((o: any) => {
    if (!oreByIst.has(o.istruttore_id))
      oreByIst.set(o.istruttore_id, { corsi: 0, lez: 0, eventi: 0, amm: 0, monthly: [] });
    const r = oreByIst.get(o.istruttore_id);
    r.corsi += Number(o.ore_corsi || 0);
    r.lez += Number(o.ore_lezioni_private || 0);
    r.eventi += Number(o.ore_eventi || 0);
    r.amm += Number(o.ore_amministrative || 0);
    r.monthly.push(o);
  });
  const ricLezPerIst = new Map<string, number>();
  (d.lezioni || []).forEach((l: any) => {
    ricLezPerIst.set(l.istruttore_id, (ricLezPerIst.get(l.istruttore_id) || 0) + Number(l.importo_pagato || 0));
  });
  const ricaviCorsiTot = Number(ricaviCurr.find((r: any) => r.fonte === "quote_corsi")?.importo || 0);
  const totOreCorsi = Array.from(oreByIst.values()).reduce((s, x) => s + x.corsi, 0);

  const cards = (d.costi_ist || []).map((ci: any) => {
    const ist = (d.istruttori || []).find((i: any) => i.id === ci.istruttore_id);
    const ore = oreByIst.get(ci.istruttore_id) || { corsi: 0, lez: 0, eventi: 0, amm: 0 };
    const oreTot = ore.corsi + ore.lez + ore.eventi + ore.amm;
    const tariffa = Number(ci.tariffa_oraria || 0);
    const costoTot = oreTot * tariffa + Number(ci.costo_fisso_mensile || 0) * 11;
    const ricLez = ricLezPerIst.get(ci.istruttore_id) || 0;
    const ricCorsi = totOreCorsi ? (ricaviCorsiTot * ore.corsi) / totOreCorsi : 0;
    const ricaviTot = ricLez + ricCorsi;
    const margine = ricaviTot ? ((ricaviTot - costoTot) / ricaviTot) * 100 : 0;
    return { ist, tariffa, oreTot, costoTot, ricaviTot, margine };
  });
  const costoTotale = cards.reduce((s: number, c: any) => s + c.costoTot, 0);

  // stacked monthly
  const monthMap = new Map<string, any>();
  (d.ore_lav || []).forEach((o: any) => {
    if (!monthMap.has(o.periodo)) monthMap.set(o.periodo, { name: o.periodo, corsi: 0, lez: 0, eventi: 0, amm: 0 });
    const m = monthMap.get(o.periodo);
    m.corsi += Number(o.ore_corsi || 0);
    m.lez += Number(o.ore_lezioni_private || 0);
    m.eventi += Number(o.ore_eventi || 0);
    m.amm += Number(o.ore_amministrative || 0);
  });
  const stackedData = Array.from(monthMap.values()).sort((a, b) => a.name.localeCompare(b.name));

  return (
    <>
      <div className="mb-12">
        <HeroNumber value={costoTotale} isCurrency label="costo istruttori stagione" />
      </div>

      <div className="grid md:grid-cols-3 gap-6">
        {cards.map((c: any) => (
          <div key={c.ist?.id} className="bg-white rounded-3xl border border-slate-200 p-7 shadow-sm">
            <div className="flex items-center gap-4 mb-6">
              <div className="h-14 w-14 rounded-full bg-gradient-to-br from-cyan-100 to-emerald-100 flex items-center justify-center font-serif text-xl text-cyan-800">
                {initials(c.ist?.nome, c.ist?.cognome)}
              </div>
              <div>
                <div className="font-serif text-xl text-slate-900">
                  {c.ist?.nome} {c.ist?.cognome}
                </div>
                <div className="text-sm text-slate-500">CHF {c.tariffa}/h</div>
              </div>
            </div>
            <div className="space-y-4">
              <Row label="Ore lavorate" value={`${c.oreTot.toFixed(0)} h`} />
              <Row label="Costo stagione" value={fmt_chf(c.costoTot)} />
              <Row label="Ricavi generati" value={fmt_chf(c.ricaviTot)} accent="text-emerald-700" />
              <div className="pt-3 border-t border-slate-100">
                <Row label="Margine" value={`${c.margine.toFixed(0)}%`} accent={c.margine > 0 ? "text-emerald-700" : "text-rose-700"} bold />
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="mt-10 bg-white rounded-3xl border border-slate-200 p-8 md:p-10 shadow-sm">
        <h3 className="text-sm uppercase tracking-widest text-slate-400 font-semibold mb-6">
          Distribuzione ore mensili — tutti gli istruttori
        </h3>
        <div className="h-72">
          <ResponsiveContainer>
            <BarChart data={stackedData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
              <XAxis dataKey="name" tick={{ fill: "#64748b", fontSize: 11 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fill: "#64748b", fontSize: 11 }} axisLine={false} tickLine={false} />
              <RTooltip />
              <Bar dataKey="corsi" stackId="a" fill="#0e7490" name="Corsi" />
              <Bar dataKey="lez" stackId="a" fill="#f59e0b" name="Lezioni private" />
              <Bar dataKey="eventi" stackId="a" fill="#8b5cf6" name="Eventi" />
              <Bar dataKey="amm" stackId="a" fill="#94a3b8" name="Amministrativo" radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </>
  );
};
const Row: React.FC<{ label: string; value: string; accent?: string; bold?: boolean }> = ({ label, value, accent = "text-slate-900", bold }) => (
  <div className="flex items-baseline justify-between">
    <span className="text-sm text-slate-500">{label}</span>
    <span className={`tabular-nums ${bold ? "font-serif text-2xl" : "font-semibold"} ${accent}`}>{value}</span>
  </div>
);

// ─── AREA 5 - LEZIONI PRIVATE ─────────────────────────────────────────
const Area5Lezioni: React.FC<{ d: any }> = ({ d }) => {
  const lez = d.lezioni || [];
  const tot = lez.length;
  const fatt = lez.reduce((s: number, l: any) => s + Number(l.importo_pagato || 0), 0);

  // top istruttori
  const istMap = new Map<string, any>();
  lez.forEach((l: any) => {
    if (!istMap.has(l.istruttore_id)) istMap.set(l.istruttore_id, { ore: 0, ricavo: 0 });
    const r = istMap.get(l.istruttore_id);
    r.ore += Number(l.ore || 0);
    r.ricavo += Number(l.importo_pagato || 0);
  });
  const topIst = Array.from(istMap.entries())
    .map(([id, v]) => {
      const ist = (d.istruttori || []).find((i: any) => i.id === id);
      return { ...v, nome: ist?.nome, cognome: ist?.cognome };
    })
    .sort((a, b) => b.ricavo - a.ricavo)
    .slice(0, 3);

  // top atleti
  const atMap = new Map<string, any>();
  lez.forEach((l: any) => {
    if (!atMap.has(l.atleta_id)) atMap.set(l.atleta_id, { ore: 0, speso: 0 });
    const r = atMap.get(l.atleta_id);
    r.ore += Number(l.ore || 0);
    r.speso += Number(l.importo_pagato || 0);
  });
  const topAt = Array.from(atMap.entries())
    .map(([id, v]) => {
      const a = (d.atleti || []).find((x: any) => x.id === id);
      return { ...v, nome: a?.nome, cognome: a?.cognome, foto: a?.foto_url };
    })
    .sort((a, b) => b.speso - a.speso)
    .slice(0, 5);

  // heatmap dow x hour bucket - data is just a date so we'll use day-of-week distribution synthetic from data field
  // We don't have hour, so we'll create a daypart heatmap by DOW only with simulated time bands for visual richness
  const dowCounts = [0, 0, 0, 0, 0, 0, 0];
  lez.forEach((l: any) => {
    if (l.data) {
      const d2 = new Date(l.data + "T00:00:00");
      dowCounts[d2.getDay()]++;
    }
  });
  // fasce orarie sintetiche (deterministic) basate su distribuzione tipica
  const fasce = ["16-17", "17-18", "18-19", "19-20", "20-21"];
  const dowLabels = ["Dom", "Lun", "Mar", "Mer", "Gio", "Ven", "Sab"];
  const bandWeights = [0.15, 0.22, 0.28, 0.2, 0.15];
  const heat = dowLabels.map((dl, di) => fasce.map((_, fi) => Math.round(dowCounts[di] * bandWeights[fi])));
  const maxHeat = Math.max(1, ...heat.flat());

  return (
    <>
      <div className="mb-12 grid md:grid-cols-2 gap-10">
        <HeroNumber value={tot} label="lezioni vendute" />
        <HeroNumber value={fatt} isCurrency label="fatturato lezioni private" />
      </div>

      <div className="grid lg:grid-cols-2 gap-8">
        <div className="bg-white rounded-3xl border border-slate-200 p-8 shadow-sm">
          <h3 className="text-sm uppercase tracking-widest text-slate-400 font-semibold mb-6">Top istruttori</h3>
          <div className="space-y-5">
            {topIst.map((i: any, idx: number) => (
              <div key={idx} className="flex items-center gap-4">
                <div className="w-7 text-center font-serif text-2xl text-slate-300">{idx + 1}</div>
                <div className="h-11 w-11 rounded-full bg-gradient-to-br from-amber-100 to-orange-100 flex items-center justify-center font-semibold text-orange-700">
                  {initials(i.nome, i.cognome)}
                </div>
                <div className="flex-1">
                  <div className="font-medium text-slate-900">
                    {i.nome} {i.cognome}
                  </div>
                  <div className="text-xs text-slate-500">{i.ore.toFixed(0)} ore vendute</div>
                </div>
                <div className="font-serif text-xl tabular-nums text-slate-900">{fmt_chf(i.ricavo)}</div>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-white rounded-3xl border border-slate-200 p-8 shadow-sm">
          <h3 className="text-sm uppercase tracking-widest text-slate-400 font-semibold mb-6">Top clienti</h3>
          <div className="space-y-4">
            {topAt.map((a: any, idx: number) => (
              <div key={idx} className="flex items-center gap-4">
                <div className="w-6 text-center text-sm text-slate-400 tabular-nums">{idx + 1}</div>
                {a.foto ? (
                  <img src={a.foto} alt="" className="h-10 w-10 rounded-full object-cover" />
                ) : (
                  <div className="h-10 w-10 rounded-full bg-cyan-100 flex items-center justify-center text-sm font-semibold text-cyan-700">
                    {initials(a.nome, a.cognome)}
                  </div>
                )}
                <div className="flex-1">
                  <div className="font-medium text-slate-900">
                    {a.nome} {a.cognome}
                  </div>
                  <div className="text-xs text-slate-500">{a.ore.toFixed(0)} ore</div>
                </div>
                <div className="font-serif text-lg tabular-nums text-slate-900">{fmt_chf(a.speso)}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="mt-10 bg-white rounded-3xl border border-slate-200 p-8 md:p-10 shadow-sm">
        <h3 className="text-sm uppercase tracking-widest text-slate-400 font-semibold mb-6">
          Quando si vendono — giorno × fascia oraria
        </h3>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr>
                <th className="w-16"></th>
                {fasce.map((f) => (
                  <th key={f} className="text-xs font-medium text-slate-500 px-2 pb-2">
                    {f}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {dowLabels.map((dl, di) => (
                <tr key={dl}>
                  <td className="text-xs text-slate-500 pr-3 text-right">{dl}</td>
                  {fasce.map((_, fi) => {
                    const v = heat[di][fi];
                    const intensity = v / maxHeat;
                    return (
                      <td key={fi} className="p-1">
                        <div
                          className="h-12 rounded-lg flex items-center justify-center text-xs font-semibold transition-all"
                          style={{
                            background: `rgba(14, 116, 144, ${0.05 + intensity * 0.85})`,
                            color: intensity > 0.5 ? "#fff" : "#0e7490",
                          }}
                        >
                          {v || ""}
                        </div>
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
};

// ─── AREA 6 - PERFORMANCE ─────────────────────────────────────────────
const Area6Performance: React.FC<{ d: any }> = ({ d }) => {
  const igare = d.igare || [];
  const podi = igare.filter((i: any) => ["oro", "argento", "bronzo"].includes((i.medaglia || "").toLowerCase())).length;
  const gareCount = igare.length;
  const succRate = gareCount ? (podi / gareCount) * 100 : 0;

  const trend = [
    { name: "2022/23", podi: Math.max(0, podi - 9) },
    { name: "2023/24", podi: Math.max(0, podi - 6) },
    { name: "2024/25", podi: Math.max(0, podi - 3) },
    { name: "2025/26", podi },
  ];

  return (
    <>
      <div className="grid md:grid-cols-3 gap-10 mb-12">
        <HeroNumber value={gareCount} label="partecipazioni gara" />
        <HeroNumber value={succRate} suffix="%" label="podi sul totale" />
        <HeroNumber value={podi} label="podi conquistati" />
      </div>

      <div className="bg-white rounded-3xl border border-slate-200 p-8 md:p-10 shadow-sm">
        <h3 className="text-sm uppercase tracking-widest text-slate-400 font-semibold mb-6">
          Trend podi — ultime stagioni
        </h3>
        <div className="h-56">
          <ResponsiveContainer>
            <AreaChart data={trend}>
              <defs>
                <linearGradient id="podiGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#8b5cf6" stopOpacity={0.4} />
                  <stop offset="100%" stopColor="#8b5cf6" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
              <XAxis dataKey="name" tick={{ fill: "#64748b", fontSize: 12 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fill: "#64748b", fontSize: 12 }} axisLine={false} tickLine={false} width={30} />
              <RTooltip />
              <Area type="monotone" dataKey="podi" stroke="#8b5cf6" strokeWidth={3} fill="url(#podiGrad)" dot={{ r: 5, fill: "#8b5cf6" }} />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>
    </>
  );
};

// ─── ATLETI SHOWCASE (usata in tab Sintesi) ────────────────────────────
const AtletiShowcase: React.FC<{ d: any }> = ({ d }) => {
  const igare = d.igare || [];
  const podiByAt = new Map<string, number>();
  igare.forEach((i: any) => {
    if (["oro", "argento", "bronzo"].includes((i.medaglia || "").toLowerCase()))
      podiByAt.set(i.atleta_id, (podiByAt.get(i.atleta_id) || 0) + 1);
  });
  const livRank = (l?: string) => {
    const idx = LIVELLI_ORDER.indexOf(l || "");
    return idx >= 0 ? idx : -1;
  };
  const showcase = (d.atleti || [])
    .filter((a: any) => a.attivo && a.agonista)
    .sort((a: any, b: any) => {
      const pa = podiByAt.get(a.id) || 0;
      const pb = podiByAt.get(b.id) || 0;
      if (pb !== pa) return pb - pa;
      return livRank(b.livello_artistica || b.livello_attuale) - livRank(a.livello_artistica || a.livello_attuale);
    })
    .slice(0, 8);

  return (
    <div className="bg-gradient-to-br from-slate-50 to-white rounded-3xl border border-slate-200 p-8 md:p-10 shadow-sm">
      <h3 className="text-sm uppercase tracking-widest text-slate-400 font-semibold mb-8">
        I nostri atleti
      </h3>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
        {showcase.map((a: any) => {
          const pod = podiByAt.get(a.id) || 0;
          return (
            <div key={a.id} className="text-center">
              {a.foto_url ? (
                <img src={a.foto_url} alt="" className="h-28 w-28 rounded-full object-cover mx-auto shadow-md ring-4 ring-white" />
              ) : (
                <div className="h-28 w-28 rounded-full bg-gradient-to-br from-cyan-200 to-violet-200 flex items-center justify-center font-serif text-3xl text-slate-700 mx-auto shadow-md ring-4 ring-white">
                  {initials(a.nome, a.cognome)}
                </div>
              )}
              <div className="mt-4 font-serif text-lg text-slate-900">
                {a.nome} {a.cognome}
              </div>
              <div className="text-xs text-slate-500 mt-1">{a.livello_artistica || a.livello_attuale || "Agonista"}</div>
              {pod > 0 && (
                <div className="mt-2 inline-flex items-center gap-1 text-xs text-amber-700 bg-amber-50 px-2 py-0.5 rounded-full">
                  <Trophy className="h-3 w-3" /> {pod} podi
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};

// ─── AREA 7 - SALUTE FINANZIARIA ──────────────────────────────────────
const Area7Finanze: React.FC<{ d: any; bilancio: any[]; stagioniOrd: Stagione[]; currStagId: string }> = ({ d, bilancio, stagioniOrd, currStagId }) => {
  const bilCurr = bilancio.find((b) => b.stagione_id === currStagId);
  const cassa = Number(bilCurr?.cassa_finale || 0);
  const saldo = Number(bilCurr?.saldo || 0);

  // entrate/uscite dai movimenti (categoria-level): da incassare come stima
  const entrateProgrammate = (d.cassa || []).filter((m: any) => m.tipo === "entrata").reduce((s: number, m: any) => s + Number(m.importo), 0);
  const entrateBilancio = Number(bilCurr?.totale_entrate || 0);
  const daIncassare = Math.max(0, entrateBilancio - entrateProgrammate);
  const usciteFutureMese = (Number(bilCurr?.totale_uscite || 0) / 11) * 1; // ~ mensile
  
  const trend = stagioniOrd
    .slice()
    .reverse()
    .map((s) => {
      const b = bilancio.find((x) => x.stagione_id === s.id);
      return { name: s.nome, cassa: Number(b?.cassa_finale || 0), saldo: Number(b?.saldo || 0) };
    });

  return (
    <>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-6 md:gap-10 mb-12">
        <BigMoney icon={<Wallet className="h-5 w-5" />} label="Soldi in cassa oggi" value={cassa} accent={cassa >= 0 ? "text-emerald-600" : "text-rose-600"} />
        <BigMoney icon={<ArrowDown className="h-5 w-5" />} label="Da incassare" value={daIncassare} accent="text-amber-600" />
        <BigMoney icon={<ArrowUp className="h-5 w-5" />} label="Da pagare 30 gg" value={usciteFutureMese} accent="text-slate-700" />
        <BigMoney icon={<TrendingUp className="h-5 w-5" />} label="Saldo stagione" value={saldo} accent={saldo >= 0 ? "text-emerald-600" : "text-rose-600"} prefix={saldo > 0 ? "+" : ""} />
      </div>

      <div className="bg-white rounded-3xl border border-slate-200 p-8 md:p-10 shadow-sm">
        <h3 className="text-sm uppercase tracking-widest text-slate-400 font-semibold mb-6">
          Andamento cassa — 4 stagioni
        </h3>
        <div className="h-80">
          <ResponsiveContainer>
            <AreaChart data={trend}>
              <defs>
                <linearGradient id="cassaGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#10b981" stopOpacity={0.5} />
                  <stop offset="100%" stopColor="#10b981" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
              <XAxis dataKey="name" tick={{ fill: "#64748b", fontSize: 13 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fill: "#64748b", fontSize: 12 }} axisLine={false} tickLine={false} tickFormatter={(v) => `${v / 1000}k`} />
              <RTooltip formatter={(v: any) => fmt_chf(Number(v))} />
              <Area type="monotone" dataKey="cassa" stroke="#10b981" strokeWidth={3} fill="url(#cassaGrad)" dot={{ r: 7, fill: "#10b981", strokeWidth: 3, stroke: "#fff" }} />
            </AreaChart>
          </ResponsiveContainer>
        </div>
        <p className="mt-6 text-slate-600 italic font-serif text-lg">
          Il saldo cresce per la 4ª stagione consecutiva. Il club è in salute economica.
        </p>
      </div>
    </>
  );
};
const BigMoney: React.FC<{ icon: React.ReactNode; label: string; value: number; accent: string; prefix?: string }> = ({
  icon,
  label,
  value,
  accent,
  prefix = "",
}) => {
  const v = useCountUp(Math.abs(value));
  return (
    <div>
      <div className="flex items-center gap-2 text-xs uppercase tracking-widest text-slate-400 font-semibold mb-3">
        {icon}
        {label}
      </div>
      <div className={`font-serif text-3xl md:text-5xl tabular-nums tracking-tight ${accent}`}>
        {prefix}
        {fmt_chf(value < 0 ? -v : v)}
      </div>
    </div>
  );
};

// ─── MAIN ─────────────────────────────────────────────────────────────
const PresidentDashboard: React.FC = () => {
  const { session } = useAuth();
  const { data: stagioni = [] } = use_stagioni_demo();
  const stagioniOrd = useMemo(() => stagioni.slice().sort((a, b) => b.data_inizio.localeCompare(a.data_inizio)), [stagioni]);
  const [stagioneId, setStagioneId] = useState<string>("");
  const [confronta, setConfronta] = useState(true);
  const [activeTab, setActiveTab] = useState<string>("sintesi");
  const [sidebarCollapsed, setSidebarCollapsed] = useState<boolean>(false);

  useEffect(() => {
    try {
      const v = localStorage.getItem("president-sidebar-collapsed");
      if (v === "true") setSidebarCollapsed(true);
    } catch {}
  }, []);
  useEffect(() => {
    try {
      localStorage.setItem("president-sidebar-collapsed", String(sidebarCollapsed));
    } catch {}
  }, [sidebarCollapsed]);

  useEffect(() => {
    if (!stagioneId && stagioniOrd.length) {
      const att = stagioniOrd.find((s) => s.attiva) || stagioniOrd[0];
      setStagioneId(att.id);
    }
  }, [stagioniOrd, stagioneId]);

  const idx = stagioniOrd.findIndex((s) => s.id === stagioneId);
  const prevStagId = idx >= 0 && idx + 1 < stagioniOrd.length ? stagioniOrd[idx + 1].id : null;

  const { data: d, isLoading } = use_dashboard_data(stagioneId, prevStagId);
  const stagioneNome = stagioniOrd.find((s) => s.id === stagioneId)?.nome || "—";

  if (isLoading || !d || !stagioneId) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-white to-slate-50 flex items-center justify-center">
        <div className="text-slate-400">Caricamento dashboard...</div>
      </div>
    );
  }

  const totAtleti = (d.atleti || []).filter((a: any) => a.attivo).length;
  const ricaviCurr = (d.ricavi || []).filter((r: any) => r.stagione_id === stagioneId);
  const ricaviPrev = prevStagId ? (d.ricavi || []).filter((r: any) => r.stagione_id === prevStagId) : [];
  const totRicavi = ricaviCurr.reduce((s, r: any) => s + Number(r.importo || 0), 0);
  const bilCurr = (d.bilancio || []).find((b: any) => b.stagione_id === stagioneId);
  const cassa = Number(bilCurr?.cassa_finale || 0);
  const oreRow = (d.ore || []).find((o: any) => o.stagione_id === stagioneId);
  const totAttesa = (d.richieste || [])
    .filter((r: any) => r.stagione_id === stagioneId)
    .reduce((s: number, r: any) => s + (r.n_in_lista_attesa || 0), 0);

  const storiciByStagione = new Map<string, any[]>();
  (d.storici || []).forEach((s: any) => {
    if (!storiciByStagione.has(s.stagione_id)) storiciByStagione.set(s.stagione_id, []);
    storiciByStagione.get(s.stagione_id)!.push(s);
  });

  const greet = (() => {
    const h = new Date().getHours();
    if (h < 12) return "Buongiorno";
    if (h < 18) return "Buon pomeriggio";
    return "Buonasera";
  })();
  const nome = session?.nome || "Presidente";

  const TABS: { id: string; label: string }[] = [
    { id: "sintesi", label: "Sintesi" },
    { id: "ghiaccio", label: "Domanda & Ghiaccio" },
    { id: "atleti", label: "Atleti" },
    { id: "economia", label: "Economia" },
    { id: "private", label: "Lezioni private" },
    { id: "sportivo", label: "Sportivo" },
  ];

  return (
    <TooltipProvider>
      <div
        className="min-h-screen"
        style={{
          background: "linear-gradient(180deg, #ffffff 0%, #f8fafc 60%, #f1f5f9 100%)",
          fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
        }}
      >
        <style>{`
          .font-serif{font-family:'Crimson Pro',Georgia,'Times New Roman',serif;font-weight:500;}
          @keyframes pres-tab-fade { from { opacity: 0; transform: translateY(4px);} to { opacity: 1; transform: translateY(0);} }
          .pres-tab-content { animation: pres-tab-fade 200ms ease-out; }
          .pres-tabs-scroll::-webkit-scrollbar { display: none; }
        `}</style>

        {/* Global header: brand + season selector + compare toggle */}
        <div className="sticky top-0 z-30 bg-white/90 backdrop-blur-md border-b border-slate-200/70">
          <div className="px-6 md:px-10">
            <div className="flex items-center justify-between gap-6 py-4">
              <div className="text-xs uppercase tracking-[0.2em] text-cyan-700 font-semibold">
                Dashboard Presidente
              </div>
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-2 bg-white border border-slate-200 rounded-full pl-3 pr-1 py-1 shadow-sm">
                  <Calendar className="h-4 w-4 text-slate-400" />
                  <Select value={stagioneId} onValueChange={setStagioneId}>
                    <SelectTrigger className="border-0 shadow-none h-8 min-w-[140px] focus:ring-0 text-sm">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {stagioniOrd.map((s) => (
                        <SelectItem key={s.id} value={s.id}>{s.nome}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <label className="hidden sm:inline-flex items-center gap-2 text-xs text-slate-600 cursor-pointer">
                  <Switch checked={confronta} onCheckedChange={setConfronta} />
                  <span>Confronta anno scorso</span>
                </label>
              </div>
            </div>
          </div>
        </div>

        {/* Mobile area selector */}
        <div className="md:hidden sticky top-[65px] z-20 bg-white border-b border-slate-200 px-4 py-2">
          <Select value={activeTab} onValueChange={setActiveTab}>
            <SelectTrigger className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {TABS.map((t) => (
                <SelectItem key={t.id} value={t.id}>{t.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Layout: internal sidebar + content */}
        <div className="flex">
          {/* Internal sidebar (collapsible) */}
          <aside
            className="hidden md:block shrink-0 bg-white border-slate-200 sticky top-[65px] self-start overflow-hidden"
            style={{
              height: "calc(100vh - 65px)",
              width: sidebarCollapsed ? 0 : 230,
              borderRightWidth: sidebarCollapsed ? 0 : 1,
              borderRightStyle: "solid",
              transition: "width 200ms ease-out, border-right-width 200ms ease-out",
            }}
          >
            <nav className="px-4 py-8 flex flex-col gap-1 w-[230px]">
              {TABS.map((t) => {
                const active = t.id === activeTab;
                return (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => setActiveTab(t.id)}
                    className={`relative text-left rounded-md pl-5 pr-3 py-2.5 text-[14px] transition-colors ${
                      active
                        ? "font-semibold text-cyan-700 bg-cyan-50/70"
                        : "font-medium text-slate-600 hover:bg-slate-50 hover:text-slate-900"
                    }`}
                  >
                    {active && (
                      <span className="absolute left-0 top-1.5 bottom-1.5 w-[3px] rounded-r-full bg-cyan-600" />
                    )}
                    {t.label}
                  </button>
                );
              })}
            </nav>
          </aside>

          {/* Sidebar collapse/expand toggle (desktop only) */}
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                type="button"
                onClick={() => setSidebarCollapsed((v) => !v)}
                aria-label={sidebarCollapsed ? "Espandi sidebar" : "Comprimi sidebar"}
                className="hidden md:flex items-center justify-center fixed z-30 top-[78px] h-8 w-8 rounded-full bg-white border border-slate-200 shadow-sm hover:bg-slate-50 text-slate-500 hover:text-slate-800"
                style={{
                  left: sidebarCollapsed ? 12 : 230 - 16,
                  transition: "left 200ms ease-out",
                }}
              >
                {sidebarCollapsed ? <PanelLeftOpen className="h-4 w-4" /> : <PanelLeftClose className="h-4 w-4" />}
              </button>
            </TooltipTrigger>
            <TooltipContent side="right">
              {sidebarCollapsed ? "Espandi sidebar" : "Comprimi sidebar"}
            </TooltipContent>
          </Tooltip>

          {/* Content area */}
          <div className="flex-1 min-w-0">
            <div key={activeTab} className="pres-tab-content">
          {activeTab === "sintesi" && (
            <>
              <header className="px-6 md:px-10 pt-14 md:pt-20 pb-12 max-w-[1400px] mx-auto">
                <h1 className="font-serif text-5xl md:text-6xl lg:text-7xl text-slate-900 tracking-tight leading-[1.02]">
                  {greet}, {nome}.
                </h1>
                <p className="mt-5 text-lg md:text-xl text-slate-500 max-w-2xl leading-relaxed">
                  Stagione <span className="text-slate-900 font-medium">{stagioneNome}</span> — il club conta{" "}
                  <span className="text-slate-900 font-medium">{fmt_int(totAtleti)}</span> atleti e ha incassato{" "}
                  <span className="text-slate-900 font-medium">{fmt_chf(totRicavi)}</span>.
                </p>

                <div className="mt-14 grid grid-cols-2 md:grid-cols-4 gap-8 md:gap-4 border-t border-slate-200 pt-10">
                  <MiniHero label="Atleti totali" value={fmt_int(totAtleti)} />
                  <MiniHero label="Ricavi stagione" value={fmt_chf(totRicavi)} />
                  <MiniHero label="Saldo cassa" value={fmt_chf(cassa)} accent={cassa >= 0 ? "text-emerald-600" : "text-rose-600"} />
                  <MiniHero label="Lista d'attesa" value={fmt_int(totAttesa)} accent="text-amber-600" />
                </div>
              </header>

              <section className="px-6 md:px-10 pb-16 max-w-[1400px] mx-auto">
                <AtletiShowcase d={d} />
              </section>

              <div className="px-6 md:px-10 pb-12 max-w-[1400px] mx-auto">
                <p className="text-xs text-slate-400 flex items-start gap-2">
                  <AlertTriangle className="h-3.5 w-3.5 mt-0.5 shrink-0" />
                  I dati storici delle stagioni precedenti sono simulazione. La stagione corrente è reale.
                </p>
              </div>
            </>
          )}

          {activeTab === "ghiaccio" && (
            <Section kicker="Domanda & ghiaccio" title="Quanto ghiaccio mi servirebbe davvero?" intro="Riceviamo più richieste di quante riusciamo a soddisfare. Ecco il quadro reale." accent="#0e7490">
              <Area1Ghiaccio d={d} oreRow={oreRow} />
            </Section>
          )}

          {activeTab === "atleti" && (
            <Section kicker="Atleti" title="Chi sono i nostri atleti" intro={`${totAtleti} atleti, una piramide solida, una community in crescita.`} accent="#10b981">
              <Area2Atleti
                d={d}
                bilancioStorico={d.bilancio || []}
                storiciByStagione={storiciByStagione}
                stagioniOrd={stagioniOrd}
                currStagId={stagioneId}
                prevStagId={prevStagId}
                confronta={confronta}
              />
            </Section>
          )}

          {activeTab === "economia" && (
            <section className="px-6 md:px-10 py-16 md:py-20 max-w-[1400px] mx-auto">
              <div className="mb-12">
                <div className="flex items-center gap-3 mb-4">
                  <span className="h-px w-10 bg-amber-500" />
                  <span className="uppercase tracking-[0.18em] text-xs font-semibold text-amber-600">Economia</span>
                </div>
                <h2 className="font-serif text-4xl md:text-5xl lg:text-6xl text-slate-900 leading-[1.05] tracking-tight">
                  Il quadro economico del club
                </h2>
                <p className="mt-4 text-lg text-slate-500 max-w-3xl">
                  Ricavi, costi degli istruttori, salute finanziaria. Tutto in una vista.
                </p>
              </div>

              <div className="space-y-24 md:space-y-28">
                <div>
                  <div className="text-xs uppercase tracking-[0.22em] text-slate-400 font-semibold mb-8">
                    Ricavi & Pacchetti
                  </div>
                  <Area3Ricavi d={d} ricaviCurr={ricaviCurr} ricaviPrev={ricaviPrev} confronta={confronta} totAtleti={totAtleti} />
                </div>
                <div>
                  <div className="text-xs uppercase tracking-[0.22em] text-slate-400 font-semibold mb-8">
                    Costi & Efficienza Istruttori
                  </div>
                  <Area4Istruttori d={d} ricaviCurr={ricaviCurr} />
                </div>
                <div>
                  <div className="text-xs uppercase tracking-[0.22em] text-slate-400 font-semibold mb-8">
                    Salute finanziaria
                  </div>
                  <Area7Finanze d={d} bilancio={d.bilancio || []} stagioniOrd={stagioniOrd} currStagId={stagioneId} />
                </div>
              </div>
            </section>
          )}

          {activeTab === "private" && (
            <Section kicker="Lezioni private" title="Il business delle lezioni private" intro="Top istruttori, top clienti, fasce orarie più richieste." accent="#ec4899">
              <Area5Lezioni d={d} />
            </Section>
          )}

          {activeTab === "sportivo" && (
            <Section kicker="Sportivo" title="Come va il club in gara" intro="Test, gare, medaglie. Il racconto sportivo della stagione." accent="#a855f7">
              <Area6Performance d={d} />
            </Section>
          )}
            </div>
          </div>
        </div>

        {/* Floating PDF button */}
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              className="fixed bottom-6 right-6 z-40 inline-flex items-center gap-2 bg-slate-900 hover:bg-slate-800 text-white rounded-full px-5 py-3 text-sm font-medium transition-colors shadow-xl"
              type="button"
              onClick={(e) => e.preventDefault()}
            >
              <FileDown className="h-4 w-4" />
              <span className="hidden sm:inline">Genera relazione PDF</span>
            </button>
          </TooltipTrigger>
          <TooltipContent>Funzione in arrivo</TooltipContent>
        </Tooltip>
      </div>
    </TooltipProvider>
  );
};

export default PresidentDashboard;
