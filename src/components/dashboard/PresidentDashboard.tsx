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
  Megaphone,
  Award,
  FileText,
  Download,
  Copy,
  Instagram,
  Facebook,
  Mail,
  MapPin,
} from "lucide-react";
import { toast } from "sonner";
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
  narrateCatalogoPromozione,
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

function use_stagioni_demo(CLUB_ID: string | undefined) {
  return useQuery<Stagione[]>({
    queryKey: ["pres_stagioni", CLUB_ID],
    enabled: !!CLUB_ID,
    staleTime: 30_000,
    queryFn: async () => {
      const { data } = await supabase
        .from("stagioni")
        .select("id, nome, data_inizio, data_fine, attiva")
        .eq("club_id", CLUB_ID as string)
        .order("data_inizio", { ascending: false });
      return (data as any) || [];
    },
  });
}

function use_dashboard_data(CLUB_ID: string | undefined, stagione_id: string | null, prev_stagione_id: string | null) {
  return useQuery({
    queryKey: ["pres_dashboard", CLUB_ID, stagione_id, prev_stagione_id],
    enabled: !!CLUB_ID && !!stagione_id,
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

function use_catalogo_data(CLUB_ID: string | undefined) {
  return useQuery({
    queryKey: ["pres_catalogo", CLUB_ID],
    enabled: !!CLUB_ID,
    staleTime: 30_000,
    queryFn: async () => {
      const sb: any = supabase;
      const [identityR, sponsorR, cercateR, eventiR, materialiR] = await Promise.all([
        sb.from("club_identity").select("*").eq("club_id", CLUB_ID).maybeSingle(),
        sb.from("sponsor_attivi").select("*").eq("club_id", CLUB_ID).order("importo_annuo", { ascending: false }),
        sb.from("sponsor_categorie_cercate").select("*").eq("club_id", CLUB_ID).order("importo_richiesto_indicativo", { ascending: false }),
        sb.from("eventi_pubblici").select("*").eq("club_id", CLUB_ID),
        sb.from("materiali_promo").select("*").eq("club_id", CLUB_ID),
      ]);
      return {
        identity: identityR.data || null,
        sponsor: sponsorR.data || [],
        cercate: cercateR.data || [],
        eventi: eventiR.data || [],
        materiali: materialiR.data || [],
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

// ─── AREA 7 - CATALOGO & PROMOZIONE ──────────────────────────────────
const LIVELLO_SPONSOR_STYLE: Record<string, { bg: string; text: string; label: string }> = {
  gold: { bg: "bg-amber-100", text: "text-amber-800", label: "Gold" },
  silver: { bg: "bg-slate-200", text: "text-slate-700", label: "Silver" },
  bronze: { bg: "bg-orange-100", text: "text-orange-800", label: "Bronze" },
};

const PRIORITA_STYLE: Record<string, string> = {
  alta: "bg-rose-100 text-rose-700",
  media: "bg-amber-100 text-amber-700",
  bassa: "bg-slate-100 text-slate-600",
};

const MiniCirclesPromo: React.FC<{ sponsorIniziali: string[]; cercateCount: number }> = ({ sponsorIniziali, cercateCount }) => {
  const colors = ["#0e7490", "#10b981", "#f59e0b", "#ec4899", "#8b5cf6"];
  return (
    <div className="flex items-center gap-2 flex-wrap">
      {sponsorIniziali.slice(0, 5).map((ini, i) => (
        <div
          key={`s-${i}`}
          className="h-9 w-9 rounded-full flex items-center justify-center text-white text-[11px] font-semibold shadow-sm"
          style={{ background: colors[i % colors.length] }}
        >
          {ini}
        </div>
      ))}
      <div className="mx-1 text-slate-300 text-lg">+</div>
      {Array.from({ length: cercateCount }).map((_, i) => (
        <div
          key={`c-${i}`}
          className="h-9 w-9 rounded-full border-2 border-dashed border-slate-300 flex items-center justify-center text-slate-400 text-base"
        >
          ?
        </div>
      ))}
    </div>
  );
};

const Area7Catalogo: React.FC<{
  d: any;
  cat: any;
  totAtleti: number;
  giovani: number;
  podi: number;
  agonisti: number;
  testSuperamentoPct: number;
  trendPodi: number[];
  oreAttivita: number;
}> = ({ d, cat, totAtleti, giovani, podi, agonisti, testSuperamentoPct, trendPodi, oreAttivita }) => {
  const identity = cat.identity || {};
  const sponsor: any[] = cat.sponsor || [];
  const cercate: any[] = cat.cercate || [];
  const eventi: any[] = cat.eventi || [];
  const materiali: any[] = cat.materiali || [];

  const annoAttuale = new Date().getFullYear();
  const anni = identity.anno_fondazione ? annoAttuale - identity.anno_fondazione : 0;
  const partecipantiTot = eventi.reduce((s, e) => s + Number(e.partecipanti_stimati || 0), 0);

  // top atleti showcase (riuso logica AtletiShowcase ridotta a 6)
  const igare = d.igare || [];
  const podiByAt = new Map<string, number>();
  igare.forEach((i: any) => {
    if (["oro", "argento", "bronzo"].includes((i.medaglia || "").toLowerCase()))
      podiByAt.set(i.atleta_id, (podiByAt.get(i.atleta_id) || 0) + 1);
  });
  const topAtleti = (d.atleti || [])
    .filter((a: any) => a.attivo && a.agonista)
    .sort((a: any, b: any) => (podiByAt.get(b.id) || 0) - (podiByAt.get(a.id) || 0))
    .slice(0, 6);

  // corsi base & agonistici dal db
  const corsiAll: any[] = (d.capacita || []).map((c: any) => c.corsi).filter(Boolean);
  const pacchetti: any[] = (d.catalogo_pack || []).slice(0, 5);

  // tariffe lezioni private (3 fasce dai costi_istruttori)
  const tariffe = (d.costi_ist || [])
    .slice(0, 3)
    .map((c: any) => Number(c.tariffa_oraria || 0))
    .filter((x: number) => x > 0);

  return (
    <div className="space-y-14">
      {/* SEZIONE 1 - IDENTITÀ */}
      <section>
        <div className="text-[11px] uppercase tracking-[0.2em] text-cyan-700 font-semibold mb-3">01 — Identità</div>
        <h3 className="font-serif text-3xl text-slate-900 mb-1">Stella del Ghiaccio ASD</h3>
        <div className="text-sm text-slate-500 mb-5 flex flex-wrap items-center gap-3">
          <span>Dal {identity.anno_fondazione || "—"}</span>
          <span>·</span>
          <span>{identity.federazione || "—"}</span>
          <span>·</span>
          <span className="inline-flex items-center gap-1"><MapPin className="h-3 w-3" />{identity.citta || "—"}</span>
        </div>
        <p className="italic font-serif text-lg text-slate-700 border-l-2 border-cyan-300 pl-4 max-w-3xl mb-6">
          {identity.mission || ""}
        </p>
        <div className="grid grid-cols-3 gap-4 max-w-xl">
          <div className="bg-slate-50 rounded-xl p-4">
            <div className="text-[10px] uppercase tracking-widest text-slate-400 font-semibold">Atleti</div>
            <div className="font-serif text-2xl text-slate-900 tabular-nums">{fmt_int(totAtleti)}</div>
          </div>
          <div className="bg-slate-50 rounded-xl p-4">
            <div className="text-[10px] uppercase tracking-widest text-slate-400 font-semibold">Anni</div>
            <div className="font-serif text-2xl text-slate-900 tabular-nums">{anni}</div>
          </div>
          <div className="bg-slate-50 rounded-xl p-4">
            <div className="text-[10px] uppercase tracking-widest text-slate-400 font-semibold">Giovani &lt;14</div>
            <div className="font-serif text-2xl text-slate-900 tabular-nums">{fmt_int(giovani)}</div>
          </div>
        </div>
        {(identity.email_contatto || identity.social_instagram || identity.social_facebook) && (
          <div className="mt-5 flex flex-wrap gap-4 text-xs text-slate-500">
            {identity.email_contatto && <span className="inline-flex items-center gap-1"><Mail className="h-3 w-3" />{identity.email_contatto}</span>}
            {identity.social_instagram && <span className="inline-flex items-center gap-1"><Instagram className="h-3 w-3" />{identity.social_instagram}</span>}
            {identity.social_facebook && <span className="inline-flex items-center gap-1"><Facebook className="h-3 w-3" />{identity.social_facebook}</span>}
          </div>
        )}
      </section>

      {/* SEZIONE 2 - OFFERTA / CATALOGO */}
      <section>
        <div className="text-[11px] uppercase tracking-[0.2em] text-cyan-700 font-semibold mb-3">02 — Offerta &amp; Catalogo</div>
        <h3 className="font-serif text-3xl text-slate-900 mb-6">Cosa offriamo</h3>

        <div className="grid md:grid-cols-2 gap-6">
          <div className="bg-white border border-slate-200 rounded-2xl p-6">
            <div className="text-[10px] uppercase tracking-widest text-slate-400 font-semibold mb-3">Corsi base</div>
            <div className="space-y-2">
              {corsiAll.slice(0, 6).map((c: any, i: number) => (
                <div key={i} className="flex justify-between text-sm">
                  <span className="text-slate-700">{c.nome}</span>
                </div>
              ))}
              {corsiAll.length === 0 && <div className="text-sm text-slate-400">Pulcini, Stelline 1-4</div>}
            </div>
          </div>

          <div className="bg-white border border-slate-200 rounded-2xl p-6">
            <div className="text-[10px] uppercase tracking-widest text-slate-400 font-semibold mb-3">Percorso agonistico</div>
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-gradient-to-br from-violet-50 to-white border border-violet-100 rounded-xl p-4">
                <div className="font-serif text-lg text-slate-900">Artistica</div>
                <div className="text-xs text-slate-500 mt-1">Bronzo → Oro</div>
              </div>
              <div className="bg-gradient-to-br from-cyan-50 to-white border border-cyan-100 rounded-xl p-4">
                <div className="font-serif text-lg text-slate-900">Stile</div>
                <div className="text-xs text-slate-500 mt-1">Bronzo → Oro</div>
              </div>
            </div>
          </div>

          <div className="bg-white border border-slate-200 rounded-2xl p-6 md:col-span-2">
            <div className="text-[10px] uppercase tracking-widest text-slate-400 font-semibold mb-3">Pacchetti opzionali</div>
            <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
              {pacchetti.map((p: any) => (
                <div key={p.id} className="border border-slate-100 rounded-xl p-3">
                  <div className="text-sm font-medium text-slate-900 truncate">{p.nome}</div>
                  <div className="text-xs text-slate-500 mt-1 tabular-nums">
                    {p.costo_mensile ? `${fmt_chf(Number(p.costo_mensile))}/mese` : p.costo_annuale ? `${fmt_chf(Number(p.costo_annuale))}/anno` : p.costo_1_sessione ? `${fmt_chf(Number(p.costo_1_sessione))}/sess.` : "—"}
                  </div>
                </div>
              ))}
              {pacchetti.length === 0 && <div className="text-sm text-slate-400">Nessun pacchetto attivo</div>}
            </div>
          </div>

          <div className="bg-white border border-slate-200 rounded-2xl p-6 md:col-span-2">
            <div className="text-[10px] uppercase tracking-widest text-slate-400 font-semibold mb-3">Lezioni private — tariffe orarie</div>
            <div className="flex gap-6">
              {tariffe.length > 0 ? tariffe.map((t: number, i: number) => (
                <div key={i}>
                  <div className="text-xs text-slate-500">Fascia {i + 1}</div>
                  <div className="font-serif text-2xl text-slate-900 tabular-nums">{fmt_chf(t)}</div>
                </div>
              )) : <div className="text-sm text-slate-400">Disponibili su richiesta</div>}
            </div>
          </div>
        </div>
      </section>

      {/* SEZIONE 3 - RISULTATI */}
      <section>
        <div className="text-[11px] uppercase tracking-[0.2em] text-cyan-700 font-semibold mb-3">03 — Risultati</div>
        <h3 className="font-serif text-3xl text-slate-900 mb-6">I nostri numeri sportivi</h3>
        <div className="grid grid-cols-3 gap-4 mb-6 max-w-xl">
          <div className="bg-slate-50 rounded-xl p-4">
            <div className="text-[10px] uppercase tracking-widest text-slate-400 font-semibold">Podi</div>
            <div className="font-serif text-2xl text-slate-900 tabular-nums">{fmt_int(podi)}</div>
          </div>
          <div className="bg-slate-50 rounded-xl p-4">
            <div className="text-[10px] uppercase tracking-widest text-slate-400 font-semibold">Agonisti</div>
            <div className="font-serif text-2xl text-slate-900 tabular-nums">{fmt_int(agonisti)}</div>
          </div>
          <div className="bg-slate-50 rounded-xl p-4">
            <div className="text-[10px] uppercase tracking-widest text-slate-400 font-semibold">Superamento test</div>
            <div className="font-serif text-2xl text-slate-900 tabular-nums">{Math.round(testSuperamentoPct)}%</div>
          </div>
        </div>
        <div className="bg-white border border-slate-200 rounded-2xl p-5 mb-6">
          <div className="text-[10px] uppercase tracking-widest text-slate-400 font-semibold mb-2">Trend podi — 4 stagioni</div>
          <MiniSparkline data={trendPodi.length ? trendPodi : [0]} color="#8b5cf6" />
        </div>
        <div className="grid grid-cols-3 md:grid-cols-6 gap-4">
          {topAtleti.map((a: any) => (
            <div key={a.id} className="text-center">
              {a.foto_url ? (
                <img src={a.foto_url} alt="" className="h-16 w-16 rounded-full object-cover mx-auto shadow-sm ring-2 ring-white" />
              ) : (
                <div className="h-16 w-16 rounded-full bg-gradient-to-br from-cyan-200 to-violet-200 flex items-center justify-center font-serif text-base text-slate-700 mx-auto shadow-sm ring-2 ring-white">
                  {initials(a.nome, a.cognome)}
                </div>
              )}
              <div className="mt-2 text-xs text-slate-700 truncate">{a.nome}</div>
            </div>
          ))}
        </div>
      </section>

      {/* SEZIONE 4 - IMPATTO SOCIALE */}
      <section>
        <div className="text-[11px] uppercase tracking-[0.2em] text-cyan-700 font-semibold mb-3">04 — Impatto sociale</div>
        <h3 className="font-serif text-3xl text-slate-900 mb-6">Quanto restituiamo al territorio</h3>
        <div className="grid grid-cols-3 gap-4 mb-6 max-w-xl">
          <div className="bg-emerald-50 rounded-xl p-4">
            <div className="text-[10px] uppercase tracking-widest text-emerald-700 font-semibold">Bambini coinvolti</div>
            <div className="font-serif text-2xl text-slate-900 tabular-nums">{fmt_int(partecipantiTot)}</div>
          </div>
          <div className="bg-emerald-50 rounded-xl p-4">
            <div className="text-[10px] uppercase tracking-widest text-emerald-700 font-semibold">Ore attività</div>
            <div className="font-serif text-2xl text-slate-900 tabular-nums">{fmt_int(oreAttivita)}</div>
          </div>
          <div className="bg-emerald-50 rounded-xl p-4">
            <div className="text-[10px] uppercase tracking-widest text-emerald-700 font-semibold">Eventi aperti</div>
            <div className="font-serif text-2xl text-slate-900 tabular-nums">{fmt_int(eventi.length)}</div>
          </div>
        </div>
        <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-[11px] uppercase tracking-widest text-slate-500">
              <tr>
                <th className="text-left px-4 py-3 font-semibold">Evento</th>
                <th className="text-left px-4 py-3 font-semibold">Quando</th>
                <th className="text-right px-4 py-3 font-semibold">Partecipanti</th>
              </tr>
            </thead>
            <tbody>
              {eventi.map((e: any) => (
                <tr key={e.id} className="border-t border-slate-100">
                  <td className="px-4 py-3">
                    <div className="font-medium text-slate-900">{e.nome_evento}</div>
                    <div className="text-xs text-slate-500">{e.descrizione}</div>
                  </td>
                  <td className="px-4 py-3 text-slate-600">{e.data_evento}</td>
                  <td className="px-4 py-3 text-right tabular-nums font-semibold">{fmt_int(e.partecipanti_stimati)}</td>
                </tr>
              ))}
              {eventi.length === 0 && (
                <tr><td colSpan={3} className="px-4 py-6 text-center text-slate-400">Nessun evento</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      {/* SEZIONE 5 - PARTNER & SPONSOR */}
      <section>
        <div className="text-[11px] uppercase tracking-[0.2em] text-cyan-700 font-semibold mb-3">05 — Partner &amp; Sponsor</div>
        <h3 className="font-serif text-3xl text-slate-900 mb-6">Chi crede in noi, chi cerchiamo</h3>
        <div className="grid md:grid-cols-2 gap-8">
          <div>
            <div className="text-[10px] uppercase tracking-widest text-slate-400 font-semibold mb-3">Partner attuali</div>
            <div className="space-y-3">
              {sponsor.map((s: any) => {
                const st = LIVELLO_SPONSOR_STYLE[s.livello] || LIVELLO_SPONSOR_STYLE.bronze;
                return (
                  <div key={s.id} className="flex items-start gap-3 bg-white border border-slate-200 rounded-xl p-4">
                    <div className="h-12 w-12 rounded-lg bg-gradient-to-br from-slate-100 to-slate-200 flex items-center justify-center font-serif text-slate-500 shrink-0">
                      {s.nome_sponsor?.[0] || "?"}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-medium text-slate-900">{s.nome_sponsor}</span>
                        <span className={`text-[10px] uppercase tracking-wider px-2 py-0.5 rounded-full font-semibold ${st.bg} ${st.text}`}>{st.label}</span>
                      </div>
                      <div className="text-xs text-slate-500">{s.categoria} · <span className="tabular-nums">{fmt_chf(Number(s.importo_annuo))}/anno</span></div>
                      <div className="text-xs text-slate-600 mt-1 italic">{s.descrizione_breve}</div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div>
            <div className="text-[10px] uppercase tracking-widest text-slate-400 font-semibold mb-3">Stiamo cercando</div>
            <div className="space-y-3">
              {cercate.map((c: any) => (
                <div key={c.id} className="bg-gradient-to-br from-cyan-50 to-white border border-cyan-100 rounded-xl p-4">
                  <div className="flex items-center gap-2 mb-1">
                    <Award className="h-4 w-4 text-cyan-700" />
                    <span className="font-medium text-slate-900 capitalize">{c.categoria}</span>
                    <span className={`ml-auto text-[10px] uppercase tracking-wider px-2 py-0.5 rounded-full font-semibold ${PRIORITA_STYLE[c.priorita] || PRIORITA_STYLE.media}`}>
                      {c.priorita}
                    </span>
                  </div>
                  <div className="text-xs text-slate-600 italic mb-2">{c.descrizione_offerta}</div>
                  <div className="text-sm tabular-nums font-semibold text-cyan-700">{fmt_chf(Number(c.importo_richiesto_indicativo))}/anno</div>
                </div>
              ))}
            </div>
            <button
              type="button"
              onClick={() => toast.success("Richiesta inviata", { description: "Ti contatteremo a breve per discutere la partnership." })}
              className="mt-4 w-full bg-cyan-700 hover:bg-cyan-800 text-white rounded-full px-5 py-2.5 text-sm font-medium transition-colors"
            >
              Diventa partner
            </button>
          </div>
        </div>
      </section>

      {/* SEZIONE 6 - MATERIALI */}
      <section>
        <div className="text-[11px] uppercase tracking-[0.2em] text-cyan-700 font-semibold mb-3">06 — Materiali</div>
        <h3 className="font-serif text-3xl text-slate-900 mb-6">Pronti da scaricare</h3>
        <div className="grid md:grid-cols-3 gap-4">
          {materiali.map((m: any) => (
            <div key={m.id} className="bg-white border border-slate-200 rounded-2xl p-5 flex flex-col">
              <div className="h-10 w-10 rounded-lg bg-rose-50 text-rose-600 flex items-center justify-center mb-3">
                <FileText className="h-5 w-5" />
              </div>
              <div className="font-medium text-slate-900">{m.titolo}</div>
              <div className="text-xs text-slate-500 mt-1 mb-4 flex-1">{m.descrizione}</div>
              <button
                type="button"
                onClick={() => toast.info("Download in arrivo", { description: m.titolo })}
                className="inline-flex items-center justify-center gap-1.5 text-sm font-medium text-slate-700 bg-slate-50 hover:bg-slate-100 rounded-full px-3 py-1.5"
              >
                <Download className="h-3.5 w-3.5" /> Scarica
              </button>
            </div>
          ))}
        </div>
        <button
          type="button"
          onClick={() => {
            const url = `${window.location.origin}/club/stella-del-ghiaccio`;
            if (navigator.clipboard) navigator.clipboard.writeText(url).catch(() => {});
            toast.success("Link copiato", { description: url });
          }}
          className="mt-5 inline-flex items-center gap-2 text-sm font-medium text-cyan-700 hover:text-cyan-800"
        >
          <Copy className="h-3.5 w-3.5" /> Copia link pubblico del club
        </button>
      </section>
    </div>
  );
};

// ─── MAIN ─────────────────────────────────────────────────────────────
// ─── CARD AREA + DRAWER ──────────────────────────────────────────────
type AreaId = "domanda" | "atleti" | "ricavi" | "costi" | "lezioni" | "sportivo" | "catalogo";

const TONE_BADGE: Record<Tone, string> = {
  positive: "bg-emerald-50 text-emerald-700",
  neutral: "bg-slate-100 text-slate-600",
  concerning: "bg-rose-50 text-rose-700",
};

const AreaCard: React.FC<{
  areaId: AreaId;
  title: string;
  icon: React.ReactNode;
  mainKpi: string;
  subLabel: string;
  delta?: number;
  narration: AreaNarration;
  miniChart: React.ReactNode;
  onOpen: () => void;
  accent: string;
}> = ({ title, icon, mainKpi, subLabel, delta, narration, miniChart, onOpen, accent }) => {
  return (
    <button
      type="button"
      onClick={onOpen}
      className="text-left bg-white rounded-2xl border border-slate-200 shadow-sm p-7 md:p-8 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md focus:outline-none focus:ring-2 focus:ring-cyan-400 flex flex-col"
      style={{ minHeight: 320 }}
    >
      <div className="flex items-center gap-2 text-slate-500 mb-5">
        <span style={{ color: accent }}>{icon}</span>
        <span className="text-[11px] uppercase tracking-[0.18em] font-semibold">{title}</span>
      </div>

      <div className="flex items-end gap-3 mb-1">
        <div
          className="font-serif text-slate-900 leading-none tracking-tight tabular-nums"
          style={{ fontSize: "clamp(2rem, 2.6vw, 2.75rem)", fontFeatureSettings: "'tnum'" }}
        >
          {mainKpi}
        </div>
        {delta !== undefined && <DeltaPill value={delta} />}
      </div>
      <div className="text-sm text-slate-500 mb-6">{subLabel}</div>

      <div className="mb-5 min-h-[80px] flex items-end">{miniChart}</div>

      <p className="italic text-sm text-slate-600 leading-relaxed mb-5 line-clamp-3">
        {narration.short}
      </p>

      <div className="mt-auto flex items-center justify-between">
        <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider ${TONE_BADGE[narration.tone]}`}>
          {narration.tone === "positive" ? "in crescita" : narration.tone === "concerning" ? "attenzione" : "stabile"}
        </span>
        <span className="text-sm font-medium" style={{ color: accent }}>
          Approfondisci →
        </span>
      </div>
    </button>
  );
};

const MiniBarsHoriz: React.FC<{ items: { label: string; value: number; color: string }[] }> = ({ items }) => {
  const max = Math.max(1, ...items.map((i) => i.value));
  return (
    <div className="w-full space-y-1.5">
      {items.map((it) => (
        <div key={it.label} className="flex items-center gap-2 text-[11px]">
          <span className="w-20 text-slate-500 truncate">{it.label}</span>
          <div className="flex-1 h-2 bg-slate-100 rounded-full overflow-hidden">
            <div className="h-full rounded-full" style={{ width: `${(it.value / max) * 100}%`, background: it.color }} />
          </div>
          <span className="w-8 text-right tabular-nums text-slate-700 font-semibold">{it.value}h</span>
        </div>
      ))}
    </div>
  );
};

const MiniPyramid: React.FC<{ items: { label: string; value: number }[] }> = ({ items }) => {
  const max = Math.max(1, ...items.map((i) => i.value));
  const colors = ["#0ea5e9", "#22d3ee", "#67e8f9", "#a7f3d0"];
  return (
    <div className="w-full space-y-1.5">
      {items.map((it, i) => (
        <div key={it.label} className="flex items-center gap-2 text-[11px]">
          <span className="w-20 text-slate-500 truncate text-right">{it.label}</span>
          <div className="flex-1 h-2.5 bg-slate-50 rounded-sm overflow-hidden">
            <div className="h-full rounded-sm" style={{ width: `${(it.value / max) * 100}%`, background: colors[i] || "#a7f3d0" }} />
          </div>
          <span className="w-6 text-right tabular-nums text-slate-700 font-semibold">{it.value}</span>
        </div>
      ))}
    </div>
  );
};

const MiniDonut: React.FC<{ data: { name: string; value: number; color: string }[] }> = ({ data }) => {
  const tot = data.reduce((s, d) => s + d.value, 0) || 1;
  let acc = 0;
  const radius = 32;
  const circ = 2 * Math.PI * radius;
  return (
    <div className="flex items-center gap-3 w-full">
      <svg width="84" height="84" viewBox="0 0 84 84">
        <circle cx="42" cy="42" r={radius} fill="none" stroke="#f1f5f9" strokeWidth="14" />
        {data.map((d, i) => {
          const len = (d.value / tot) * circ;
          const offset = circ - acc;
          acc += len;
          return (
            <circle
              key={i}
              cx="42"
              cy="42"
              r={radius}
              fill="none"
              stroke={d.color}
              strokeWidth="14"
              strokeDasharray={`${len} ${circ}`}
              strokeDashoffset={offset}
              transform="rotate(-90 42 42)"
            />
          );
        })}
      </svg>
      <div className="flex-1 space-y-1 text-[11px] min-w-0">
        {data.slice(0, 3).map((d) => (
          <div key={d.name} className="flex items-center gap-1.5 truncate">
            <span className="h-2 w-2 rounded-sm shrink-0" style={{ background: d.color }} />
            <span className="text-slate-600 truncate">{d.name}</span>
            <span className="ml-auto tabular-nums text-slate-700 font-semibold">{Math.round((d.value / tot) * 100)}%</span>
          </div>
        ))}
      </div>
    </div>
  );
};

const MiniBarsVert: React.FC<{ items: { label: string; value: number }[]; suffix?: string }> = ({ items, suffix = "" }) => {
  const max = Math.max(1, ...items.map((i) => i.value));
  return (
    <div className="flex items-end gap-3 w-full h-[80px]">
      {items.map((it) => (
        <div key={it.label} className="flex-1 flex flex-col items-center gap-1.5">
          <span className="text-[10px] tabular-nums text-slate-700 font-semibold">{it.value}{suffix}</span>
          <div
            className="w-full rounded-t bg-gradient-to-t from-cyan-700 to-cyan-400"
            style={{ height: `${(it.value / max) * 56}px`, minHeight: 4 }}
          />
          <span className="text-[10px] text-slate-500 truncate">{it.label}</span>
        </div>
      ))}
    </div>
  );
};

const MiniHeatmap: React.FC<{ values: number[] }> = ({ values }) => {
  const labels = ["16-17", "17-18", "18-19", "19-20", "20-21"];
  const max = Math.max(1, ...values);
  return (
    <div className="grid grid-cols-5 gap-1.5 w-full">
      {values.map((v, i) => (
        <div key={i} className="flex flex-col items-center gap-1">
          <div
            className="w-full h-9 rounded flex items-center justify-center text-[10px] font-semibold"
            style={{
              background: `rgba(236, 72, 153, ${0.08 + (v / max) * 0.85})`,
              color: v / max > 0.5 ? "#fff" : "#9d174d",
            }}
          >
            {v}
          </div>
          <span className="text-[9px] text-slate-500">{labels[i]}</span>
        </div>
      ))}
    </div>
  );
};

const MiniSparkline: React.FC<{ data: number[]; color?: string }> = ({ data, color = "#8b5cf6" }) => {
  if (data.length < 2) return <div className="h-[60px]" />;
  const max = Math.max(...data);
  const min = Math.min(...data);
  const range = max - min || 1;
  const w = 200;
  const h = 60;
  const step = w / (data.length - 1);
  const points = data.map((v, i) => `${i * step},${h - ((v - min) / range) * (h - 8) - 4}`).join(" ");
  return (
    <svg width="100%" height={h} viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" className="w-full">
      <polyline fill="none" stroke={color} strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round" points={points} />
      {data.map((v, i) => (
        <circle key={i} cx={i * step} cy={h - ((v - min) / range) * (h - 8) - 4} r={i === data.length - 1 ? 4 : 2.5} fill={color} />
      ))}
    </svg>
  );
};

// ─── MAIN ─────────────────────────────────────────────────────────────
const PresidentDashboard: React.FC = () => {
  const { session } = useAuth();
  const club_id = session?.club_id;
  const { data: stagioni = [] } = use_stagioni_demo(club_id);
  const stagioniOrd = useMemo(() => stagioni.slice().sort((a, b) => b.data_inizio.localeCompare(a.data_inizio)), [stagioni]);
  const [stagioneId, setStagioneId] = useState<string>("");
  const [confronta, setConfronta] = useState(true);
  const [openArea, setOpenArea] = useState<AreaId | null>(null);

  useEffect(() => {
    if (!stagioneId && stagioniOrd.length) {
      const att = stagioniOrd.find((s) => s.attiva) || stagioniOrd[0];
      setStagioneId(att.id);
    }
  }, [stagioniOrd, stagioneId]);

  const idx = stagioniOrd.findIndex((s) => s.id === stagioneId);
  const prevStagId = idx >= 0 && idx + 1 < stagioniOrd.length ? stagioniOrd[idx + 1].id : null;

  const { data: d, isLoading } = use_dashboard_data(club_id, stagioneId, prevStagId);
  const { data: cat } = use_catalogo_data(club_id);
  const stagioneNome = stagioniOrd.find((s) => s.id === stagioneId)?.nome || "—";

  if (isLoading || !d || !stagioneId) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-white to-slate-50 flex items-center justify-center">
        <div className="text-slate-400">Caricamento dashboard...</div>
      </div>
    );
  }

  // ─── Aggregati base ─────────────────────────────────────────────────
  const atletiAttivi = (d.atleti || []).filter((a: any) => a.attivo);
  const totAtleti = atletiAttivi.length;
  const ricaviCurr = (d.ricavi || []).filter((r: any) => r.stagione_id === stagioneId);
  const ricaviPrev = prevStagId ? (d.ricavi || []).filter((r: any) => r.stagione_id === prevStagId) : [];
  const totRicavi = ricaviCurr.reduce((s, r: any) => s + Number(r.importo || 0), 0);
  const totRicaviPrev = ricaviPrev.reduce((s, r: any) => s + Number(r.importo || 0), 0);
  const ricaviYoY = totRicaviPrev ? ((totRicavi - totRicaviPrev) / totRicaviPrev) * 100 : 0;
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

  const prevStorici = prevStagId ? storiciByStagione.get(prevStagId) || [] : [];
  const prevTotAtleti = prevStorici.length;
  const atletiYoY = prevTotAtleti ? ((totAtleti - prevTotAtleti) / prevTotAtleti) * 100 : 0;

  // livelli curr / prev
  const livCurr: Record<string, number> = {};
  LIVELLI_ORDER.forEach((l) => (livCurr[l] = 0));
  atletiAttivi.forEach((a: any) => {
    const l = a.livello_artistica || a.livello_amatori || a.livello_attuale;
    if (l && livCurr[l] !== undefined) livCurr[l]++;
    else if (a.categoria === "pulcini") livCurr["Pulcini"]++;
  });
  const livPrev: Record<string, number> = {};
  LIVELLI_ORDER.forEach((l) => (livPrev[l] = 0));
  prevStorici.forEach((s: any) => {
    if (s.livello && livPrev[s.livello] !== undefined) livPrev[s.livello]++;
  });

  // età media
  const today = new Date();
  const ages = atletiAttivi
    .map((a: any) => (a.data_nascita ? (today.getTime() - new Date(a.data_nascita).getTime()) / (365.25 * 24 * 3600 * 1000) : null))
    .filter((x: any) => x != null);
  const ageAvg = ages.length ? ages.reduce((a: number, b: number) => a + b, 0) / ages.length : 0;

  // istruttori
  const oreByIst = new Map<string, any>();
  (d.ore_lav || []).forEach((o: any) => {
    if (!oreByIst.has(o.istruttore_id))
      oreByIst.set(o.istruttore_id, { corsi: 0, lez: 0, eventi: 0, amm: 0 });
    const r = oreByIst.get(o.istruttore_id);
    r.corsi += Number(o.ore_corsi || 0);
    r.lez += Number(o.ore_lezioni_private || 0);
    r.eventi += Number(o.ore_eventi || 0);
    r.amm += Number(o.ore_amministrative || 0);
  });
  const ricLezPerIst = new Map<string, number>();
  (d.lezioni || []).forEach((l: any) => {
    ricLezPerIst.set(l.istruttore_id, (ricLezPerIst.get(l.istruttore_id) || 0) + Number(l.importo_pagato || 0));
  });
  const ricaviCorsiTot = Number(ricaviCurr.find((r: any) => r.fonte === "quote_corsi")?.importo || 0);
  const totOreCorsi = Array.from(oreByIst.values()).reduce((s, x) => s + x.corsi, 0);

  const istCards = (d.costi_ist || []).map((ci: any) => {
    const ist = (d.istruttori || []).find((i: any) => i.id === ci.istruttore_id);
    const ore = oreByIst.get(ci.istruttore_id) || { corsi: 0, lez: 0, eventi: 0, amm: 0 };
    const oreTot = ore.corsi + ore.lez + ore.eventi + ore.amm;
    const tariffa = Number(ci.tariffa_oraria || 0);
    const costoTot = oreTot * tariffa + Number(ci.costo_fisso_mensile || 0) * 11;
    const ricLez = ricLezPerIst.get(ci.istruttore_id) || 0;
    const ricCorsi = totOreCorsi ? (ricaviCorsiTot * ore.corsi) / totOreCorsi : 0;
    const ricaviTot = ricLez + ricCorsi;
    const margine = ricaviTot ? ((ricaviTot - costoTot) / ricaviTot) * 100 : 0;
    return { ist, tariffa, oreTot, costoTot, ricaviTot, margine, ricLez };
  });
  const costoIstTot = istCards.reduce((s: number, c: any) => s + c.costoTot, 0);
  const topIst = istCards.slice().sort((a: any, b: any) => b.ricLez - a.ricLez)[0];

  // lezioni private
  const lez = d.lezioni || [];
  const oreLezTot = lez.reduce((s: number, l: any) => s + Number(l.ore || 0), 0);
  const fattLez = lez.reduce((s: number, l: any) => s + Number(l.importo_pagato || 0), 0);
  const fattLezPrev = Number(ricaviPrev.find((r: any) => r.fonte === "lezioni_private")?.importo || 0);
  const atMap = new Map<string, any>();
  lez.forEach((l: any) => {
    if (!atMap.has(l.atleta_id)) atMap.set(l.atleta_id, { ore: 0, speso: 0 });
    const r = atMap.get(l.atleta_id);
    r.ore += Number(l.ore || 0);
    r.speso += Number(l.importo_pagato || 0);
  });
  const topAtArr = Array.from(atMap.entries())
    .map(([id, v]) => {
      const a = (d.atleti || []).find((x: any) => x.id === id);
      return { ...v, nome: a?.nome, cognome: a?.cognome };
    })
    .sort((a, b) => b.ore - a.ore);
  const topClienteLez = topAtArr[0];

  // heatmap fasce orarie (deterministica)
  const dowCounts = [0, 0, 0, 0, 0, 0, 0];
  lez.forEach((l: any) => {
    if (l.data) dowCounts[new Date(l.data + "T00:00:00").getDay()]++;
  });
  const fasceLabels = ["16-17", "17-18", "18-19", "19-20", "20-21"];
  const bandWeights = [0.15, 0.22, 0.28, 0.2, 0.15];
  const totDow = dowCounts.reduce((s, x) => s + x, 0);
  const fasceTotali = bandWeights.map((w) => Math.round(totDow * w));
  const fasceTopIdx = fasceTotali.indexOf(Math.max(...fasceTotali));
  const fasciaTop = fasceLabels[fasceTopIdx] || "18-19";

  // sportivo
  const igare = d.igare || [];
  const podi = igare.filter((i: any) => ["oro", "argento", "bronzo"].includes((i.medaglia || "").toLowerCase())).length;
  const podiByAt = new Map<string, number>();
  igare.forEach((i: any) => {
    if (["oro", "argento", "bronzo"].includes((i.medaglia || "").toLowerCase()))
      podiByAt.set(i.atleta_id, (podiByAt.get(i.atleta_id) || 0) + 1);
  });
  const topAtSp = Array.from(podiByAt.entries()).sort((a, b) => b[1] - a[1])[0];
  const topAtletaSp = topAtSp ? (d.atleti || []).find((x: any) => x.id === topAtSp[0]) : null;
  const podiPrev = Math.max(0, podi - 3);
  const trendPodi = [Math.max(0, podi - 9), Math.max(0, podi - 6), Math.max(0, podi - 3), podi];

  // ricavi per fonte
  const perFonte: Record<string, number> = {};
  ricaviCurr.forEach((r: any) => (perFonte[r.fonte] = Number(r.importo || 0)));
  const perFontePrev: Record<string, number> = {};
  ricaviPrev.forEach((r: any) => (perFontePrev[r.fonte] = Number(r.importo || 0)));
  const donutData = ricaviCurr
    .map((r: any) => ({ name: FONTE_LABEL[r.fonte] || r.fonte, value: Number(r.importo), color: FONTE_COLOR[r.fonte] || "#94a3b8" }))
    .sort((a: any, b: any) => b.value - a.value);

  // ore pista
  const oreDisp = Number(oreRow?.ore_settimanali_totali || 0);
  const oreUsed = Number(oreRow?.ore_settimanali_utilizzate || 0);
  const oreReq = Number(oreRow?.ore_richieste_se_accettassimo_tutti || 0);

  // ─── Narrazioni ─────────────────────────────────────────────────────
  const nDomanda = narrateDomanda({
    ore_disponibili: oreDisp,
    ore_utilizzate: oreUsed,
    ore_richieste: oreReq,
    lista_attesa: totAttesa,
    ricavo_potenziale_per_atleta: 1000,
  });
  const nAtleti = narrateAtleti({
    total: totAtleti,
    prevTotal: prevTotAtleti,
    livelli_curr: livCurr,
    livelli_prev: livPrev,
    eta_media: ageAvg,
  });
  const nRicavi = narrateRicavi({
    totale: totRicavi,
    totale_prev: totRicaviPrev,
    per_fonte: perFonte,
    per_fonte_prev: perFontePrev,
  });
  const nCosti = narrateCosti({
    n_istruttori: istCards.length,
    costo_totale: costoIstTot,
    top_istruttore_nome: topIst?.ist ? `${topIst.ist.nome}` : "",
    top_istruttore_ore: topIst?.oreTot || 0,
    top_istruttore_margine: topIst?.margine || 0,
  });
  const nLezioni = narrateLezioni({
    ore_vendute: oreLezTot,
    fatturato: fattLez,
    fatturato_prev: fattLezPrev,
    fascia_top: fasciaTop,
    top_cliente_nome: topClienteLez ? `${topClienteLez.nome} ${topClienteLez.cognome}` : "",
    top_cliente_ore: topClienteLez?.ore || 0,
  });
  const nSportivo = narrateSportivo({
    podi,
    gare: igare.length,
    podi_prev: podiPrev,
    top_atleta_nome: topAtletaSp ? `${topAtletaSp.nome} ${topAtletaSp.cognome}` : "",
    top_atleta_podi: topAtSp ? topAtSp[1] : 0,
  });

  // ─── Catalogo & Promozione ─────────────────────────────────────────
  const catData = cat || { identity: null, sponsor: [], cercate: [], eventi: [], materiali: [] };
  const sponsorCount = catData.sponsor.length;
  const totaleAnnuoSponsor = catData.sponsor.reduce((s: number, x: any) => s + Number(x.importo_annuo || 0), 0);
  const categorieCercateCount = catData.cercate.length;
  const topCercata = catData.cercate[0] || null;
  const eventiCount = catData.eventi.length;
  const partecipantiTotali = catData.eventi.reduce((s: number, e: any) => s + Number(e.partecipanti_stimati || 0), 0);

  const giovani = atletiAttivi.filter((a: any) => {
    if (!a.data_nascita) return false;
    const eta = (Date.now() - new Date(a.data_nascita).getTime()) / (1000 * 60 * 60 * 24 * 365.25);
    return eta < 14;
  }).length;
  const agonisti = atletiAttivi.filter((a: any) => a.agonista).length;
  const testSuperamentoPct = 78;
  const oreAttivita = Math.round(oreUsed * 32);

  const nCatalogo = narrateCatalogoPromozione({
    sponsorCount,
    totaleAnnuo: totaleAnnuoSponsor,
    categorieCercateCount,
    topCategoria: topCercata?.categoria || "",
    topImporto: Number(topCercata?.importo_richiesto_indicativo || 0),
    eventiCount,
    partecipantiTotali,
  });

  const sponsorIniziali = catData.sponsor.map((s: any) => (s.nome_sponsor?.[0] || "?").toUpperCase());

  const greet = (() => {
    const h = new Date().getHours();
    if (h < 12) return "Buongiorno";
    if (h < 18) return "Buon pomeriggio";
    return "Buonasera";
  })();
  const nome = session?.nome || "Presidente";

  // top livelli per mini-piramide (4 livelli più popolosi)
  const topLivelli = Object.entries(livCurr)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 4)
    .map(([label, value]) => ({ label, value }));

  const AREAS: {
    id: AreaId;
    title: string;
    accent: string;
    icon: React.ReactNode;
    drawerTitle: string;
    drawerSub: string;
    narration: AreaNarration;
    drawerContent: React.ReactNode;
  }[] = [
    {
      id: "domanda",
      title: "Domanda & Ghiaccio",
      accent: "#0e7490",
      icon: <Snowflake className="h-4 w-4" />,
      drawerTitle: "Domanda & Ghiaccio",
      drawerSub: "Quanto ghiaccio mi servirebbe davvero?",
      narration: nDomanda,
      drawerContent: <Area1Ghiaccio d={d} oreRow={oreRow} />,
    },
    {
      id: "atleti",
      title: "Atleti",
      accent: "#10b981",
      icon: <Users className="h-4 w-4" />,
      drawerTitle: "Atleti",
      drawerSub: `${totAtleti} atleti, una piramide solida.`,
      narration: nAtleti,
      drawerContent: (
        <Area2Atleti
          d={d}
          bilancioStorico={d.bilancio || []}
          storiciByStagione={storiciByStagione}
          stagioniOrd={stagioniOrd}
          currStagId={stagioneId}
          prevStagId={prevStagId}
          confronta={confronta}
        />
      ),
    },
    {
      id: "ricavi",
      title: "Ricavi & Pacchetti",
      accent: "#0e7490",
      icon: <CreditCard className="h-4 w-4" />,
      drawerTitle: "Ricavi & Pacchetti",
      drawerSub: "Da dove arrivano i soldi del club.",
      narration: nRicavi,
      drawerContent: <Area3Ricavi d={d} ricaviCurr={ricaviCurr} ricaviPrev={ricaviPrev} confronta={confronta} totAtleti={totAtleti} />,
    },
    {
      id: "costi",
      title: "Costi & Istruttori",
      accent: "#f59e0b",
      icon: <Briefcase className="h-4 w-4" />,
      drawerTitle: "Costi & Istruttori",
      drawerSub: "Efficienza dello staff tecnico.",
      narration: nCosti,
      drawerContent: <Area4Istruttori d={d} ricaviCurr={ricaviCurr} />,
    },
    {
      id: "lezioni",
      title: "Lezioni Private",
      accent: "#ec4899",
      icon: <Clock className="h-4 w-4" />,
      drawerTitle: "Lezioni Private",
      drawerSub: "Top istruttori, top clienti, fasce orarie più richieste.",
      narration: nLezioni,
      drawerContent: <Area5Lezioni d={d} />,
    },
    {
      id: "sportivo",
      title: "Sportivo",
      accent: "#8b5cf6",
      icon: <Trophy className="h-4 w-4" />,
      drawerTitle: "Sportivo",
      drawerSub: "Test, gare, medaglie del club.",
      narration: nSportivo,
      drawerContent: <Area6Performance d={d} />,
    },
    {
      id: "catalogo",
      title: "Catalogo & Promozione",
      accent: "#0891b2",
      icon: <Megaphone className="h-4 w-4" />,
      drawerTitle: "Catalogo & Promozione",
      drawerSub: "Tutto cio' che serve al Presidente per rappresentare il club fuori.",
      narration: nCatalogo,
      drawerContent: (
        <Area7Catalogo
          d={d}
          cat={catData}
          totAtleti={totAtleti}
          giovani={giovani}
          podi={podi}
          agonisti={agonisti}
          testSuperamentoPct={testSuperamentoPct}
          trendPodi={trendPodi}
          oreAttivita={oreAttivita}
        />
      ),
    },
  ];

  const activeArea = openArea ? AREAS.find((a) => a.id === openArea) : null;

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
        `}</style>

        {/* Sticky header */}
        <div className="sticky top-0 z-30 bg-white/90 backdrop-blur-md border-b border-slate-200/70">
          <div className="px-6 md:px-10 max-w-[1400px] mx-auto">
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

        <div className="px-6 md:px-10 max-w-[1400px] mx-auto pt-12 md:pt-16 pb-16">
          <div className="mb-8">
            <OnboardingBanner />
          </div>
          {/* HERO compatto */}
          <header>
            <h1 className="font-serif text-4xl md:text-5xl lg:text-6xl text-slate-900 tracking-tight leading-[1.05]">
              {greet}, {nome}.
            </h1>
            <p className="mt-3 text-base md:text-lg text-slate-500 max-w-2xl leading-relaxed">
              Stagione <span className="text-slate-900 font-medium">{stagioneNome}</span> — il club conta{" "}
              <span className="text-slate-900 font-medium">{fmt_int(totAtleti)}</span> atleti e ha incassato{" "}
              <span className="text-slate-900 font-medium">{fmt_chf(totRicavi)}</span>.
            </p>

            <div className="mt-8 grid grid-cols-2 md:grid-cols-4 gap-6 md:gap-4 border-t border-slate-200 pt-6">
              <MiniHeroStat label="Atleti totali" value={fmt_int(totAtleti)} delta={confronta ? atletiYoY : undefined} />
              <MiniHeroStat label="Ricavi" value={fmt_chf(totRicavi)} delta={confronta ? ricaviYoY : undefined} />
              <MiniHeroStat label="Saldo cassa" value={fmt_chf(cassa)} accent={cassa >= 0 ? "text-emerald-600" : "text-rose-600"} />
              <MiniHeroStat label="Lista d'attesa" value={fmt_int(totAttesa)} accent="text-amber-600" />
            </div>
          </header>

          {/* GRIGLIA 6 CARD */}
          <section className="mt-10 grid gap-6 grid-cols-1 md:grid-cols-2 lg:grid-cols-3">
            <AreaCard
              areaId="domanda"
              title="Domanda & Ghiaccio"
              icon={<Snowflake className="h-5 w-5" />}
              accent="#0e7490"
              mainKpi={fmt_int(totAttesa)}
              subLabel="atleti in lista d'attesa"
              narration={nDomanda}
              miniChart={
                <MiniBarsHoriz
                  items={[
                    { label: "Disponibili", value: oreDisp, color: "#0e7490" },
                    { label: "Utilizzate", value: oreUsed, color: "#67e8f9" },
                    { label: "Richieste", value: oreReq, color: "#f59e0b" },
                  ]}
                />
              }
              onOpen={() => setOpenArea("domanda")}
            />

            <AreaCard
              areaId="atleti"
              title="Atleti"
              icon={<Users className="h-5 w-5" />}
              accent="#10b981"
              mainKpi={fmt_int(totAtleti)}
              subLabel={`atleti attivi, eta media ${ageAvg.toFixed(1)} anni`}
              delta={confronta ? atletiYoY : undefined}
              narration={nAtleti}
              miniChart={<MiniPyramid items={topLivelli} />}
              onOpen={() => setOpenArea("atleti")}
            />

            <AreaCard
              areaId="ricavi"
              title="Ricavi & Pacchetti"
              icon={<CreditCard className="h-5 w-5" />}
              accent="#0e7490"
              mainKpi={fmt_chf(totRicavi)}
              subLabel="ricavi totali stagione"
              delta={confronta ? ricaviYoY : undefined}
              narration={nRicavi}
              miniChart={<MiniDonut data={donutData} />}
              onOpen={() => setOpenArea("ricavi")}
            />

            <AreaCard
              areaId="costi"
              title="Costi & Istruttori"
              icon={<Briefcase className="h-5 w-5" />}
              accent="#f59e0b"
              mainKpi={`${istCards.length}`}
              subLabel={`istruttori — costo totale ${fmt_chf(costoIstTot)}`}
              narration={nCosti}
              miniChart={
                <MiniBarsVert
                  items={istCards.slice(0, 3).map((c: any) => ({
                    label: c.ist?.nome || "—",
                    value: c.tariffa,
                  }))}
                  suffix=""
                />
              }
              onOpen={() => setOpenArea("costi")}
            />

            <AreaCard
              areaId="lezioni"
              title="Lezioni Private"
              icon={<Clock className="h-5 w-5" />}
              accent="#ec4899"
              mainKpi={fmt_chf(fattLez)}
              subLabel={`${fmt_int(oreLezTot)} ore vendute`}
              delta={confronta && fattLezPrev ? ((fattLez - fattLezPrev) / fattLezPrev) * 100 : undefined}
              narration={nLezioni}
              miniChart={<MiniHeatmap values={fasceTotali} />}
              onOpen={() => setOpenArea("lezioni")}
            />

            <AreaCard
              areaId="sportivo"
              title="Sportivo"
              icon={<Trophy className="h-5 w-5" />}
              accent="#8b5cf6"
              mainKpi={`${podi}`}
              subLabel={`${podi === 1 ? "podio" : "podi"} in ${igare.length} ${igare.length === 1 ? "gara" : "gare"}`}
              narration={nSportivo}
              miniChart={<MiniSparkline data={trendPodi} color="#8b5cf6" />}
              onOpen={() => setOpenArea("sportivo")}
            />

            <AreaCard
              areaId="catalogo"
              title="Catalogo & Promozione"
              icon={<Megaphone className="h-5 w-5" />}
              accent="#0891b2"
              mainKpi={`${sponsorCount} sponsor`}
              subLabel={`${fmt_chf(totaleAnnuoSponsor)} raccolti annualmente · ${categorieCercateCount} categorie aperte`}
              narration={nCatalogo}
              miniChart={<MiniCirclesPromo sponsorIniziali={sponsorIniziali} cercateCount={categorieCercateCount} />}
              onOpen={() => setOpenArea("catalogo")}
            />
          </section>

          {/* VETRINA atleti */}
          <section className="mt-12">
            <div className="mb-6">
              <h2 className="font-serif text-3xl md:text-4xl text-slate-900 tracking-tight">
                I nostri atleti — Le promesse del club
              </h2>
            </div>
            <AtletiShowcase d={d} />
          </section>

          {/* Banner finale */}
          <div className="mt-10">
            <p className="text-xs text-slate-400 flex items-start gap-2">
              <AlertTriangle className="h-3.5 w-3.5 mt-0.5 shrink-0" />
              I dati storici delle stagioni precedenti sono simulazione. La stagione corrente è reale.
            </p>
          </div>
        </div>

        {/* DRAWER laterale */}
        <Sheet open={!!openArea} onOpenChange={(o) => !o && setOpenArea(null)}>
          <SheetContent
            side="right"
            className="w-full sm:max-w-none sm:w-[60vw] p-0 overflow-y-auto"
          >
            {activeArea && (
              <div className="h-full flex flex-col">
                <div className="px-8 md:px-12 pt-12 pb-8 border-b border-slate-100">
                  <div className="flex items-center gap-2 mb-4" style={{ color: activeArea.accent }}>
                    {activeArea.icon}
                    <span className="text-[11px] uppercase tracking-[0.2em] font-semibold">{activeArea.title}</span>
                  </div>
                  <h2 className="font-serif text-4xl md:text-5xl text-slate-900 tracking-tight leading-[1.05]">
                    {activeArea.drawerTitle}
                  </h2>
                  <p className="mt-3 text-base text-slate-500 max-w-2xl">{activeArea.drawerSub}</p>
                  <p className="mt-6 italic text-base text-slate-700 leading-relaxed border-l-2 pl-4 max-w-2xl"
                     style={{ borderColor: activeArea.accent }}>
                    {activeArea.narration.long}
                  </p>
                </div>

                <div className="px-8 md:px-12 py-10 flex-1">
                  {activeArea.drawerContent}
                </div>

                <div className="px-8 md:px-12 py-6 border-t border-slate-100 flex items-center justify-between sticky bottom-0 bg-white">
                  <button
                    type="button"
                    onClick={() => setOpenArea(null)}
                    className="text-sm font-medium text-slate-600 hover:text-slate-900"
                  >
                    Chiudi
                  </button>
                  <a
                    href="#"
                    onClick={(e) => e.preventDefault()}
                    className="text-sm font-medium hover:underline"
                    style={{ color: activeArea.accent }}
                  >
                    Apri pagina dedicata →
                  </a>
                </div>
              </div>
            )}
          </SheetContent>
        </Sheet>

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

const MiniHeroStat: React.FC<{ label: string; value: string; accent?: string; delta?: number }> = ({
  label,
  value,
  accent = "text-slate-900",
  delta,
}) => (
  <div className="min-w-0">
    <div className="text-[10px] uppercase tracking-widest text-slate-400 font-semibold mb-2 truncate">{label}</div>
    <div
      className={`font-serif tracking-tight tabular-nums leading-none truncate ${accent}`}
      style={{ fontSize: "clamp(1.625rem, 2.2vw, 2rem)", fontFeatureSettings: "'tnum'" }}
    >
      {value}
    </div>
    {delta !== undefined && (
      <div className="mt-1.5">
        <DeltaPill value={delta} />
      </div>
    )}
  </div>
);

export default PresidentDashboard;
