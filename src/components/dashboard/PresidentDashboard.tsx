import React, { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  AlertTriangle,
  ArrowDown,
  ArrowRight,
  ArrowUp,
  Briefcase,
  Calendar,
  Clock,
  CreditCard,
  FileDown,
  Mail,
  MapPin,
  Megaphone,
  Snowflake,
  Trophy,
  Users,
} from "lucide-react";
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
} from "recharts";
import { useTranslation } from "react-i18next";

import FotoAtleta from "@/components/common/FotoAtleta";
import OnboardingBanner from "@/components/dashboard/OnboardingBanner";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { Switch } from "@/components/ui/switch";
import { useAuth } from "@/lib/auth";
import { segnala_errore } from "@/lib/errori";
import { supabase } from "@/lib/supabase";

type Riga = Record<string, unknown>;
type Stagione = { id: string; nome: string; data_inizio: string; data_fine: string; attiva: boolean };
type AreaId = "domanda" | "atleti" | "ricavi" | "costi" | "lezioni" | "sportivo" | "catalogo";
type StatoArea = "positivo" | "neutro" | "attenzione" | "mancante" | "senza_dati";

type DashboardData = {
  atleti: Riga[];
  storici: Riga[];
  bilancio: Riga[];
  ricavi: Riga[];
  corsi: Riga[];
  capacita: Riga[];
  richieste_storiche: Riga[];
  ore_pista: Riga[];
  catalogo_pacchetti: Riga[];
  iscrizioni_pacchetti: Riga[];
  costi_istruttori: Riga[];
  ore_lavorate: Riga[];
  lezioni_private: Riga[];
  istruttori: Riga[];
  gare: Riga[];
  iscrizioni_gare: Riga[];
  identity: Riga | null;
  sponsor: Riga[];
  sponsor_cercati: Riga[];
  eventi: Riga[];
  pendenti: {
    iscrizioni: number;
    fatture_bozza: number;
    lezioni_private: number;
  };
};

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

const AREA_PATHS: Record<AreaId, string> = {
  domanda: "/corsi",
  atleti: "/atleti",
  ricavi: "/fatture",
  costi: "/istruttori",
  lezioni: "/lezioni-private",
  sportivo: "/gare",
  catalogo: "/pacchetti-sponsor",
};

const AREA_ACCENTS: Record<AreaId, string> = {
  domanda: "bg-cyan-700",
  atleti: "bg-emerald-600",
  ricavi: "bg-sky-700",
  costi: "bg-amber-600",
  lezioni: "bg-rose-600",
  sportivo: "bg-violet-600",
  catalogo: "bg-teal-700",
};

const AREA_STROKES: Record<AreaId, string> = {
  domanda: "hsl(var(--primary))",
  atleti: "hsl(var(--chart-2, var(--primary)))",
  ricavi: "hsl(var(--primary))",
  costi: "hsl(var(--chart-4, var(--primary)))",
  lezioni: "hsl(var(--chart-5, var(--primary)))",
  sportivo: "hsl(var(--chart-3, var(--primary)))",
  catalogo: "hsl(var(--chart-2, var(--primary)))",
};

const FONTE_COLOR: Record<string, string> = {
  quote_corsi: "hsl(var(--primary))",
  pacchetti_opzionali: "hsl(var(--chart-2, var(--primary)))",
  lezioni_private: "hsl(var(--chart-4, var(--primary)))",
  eventi: "hsl(var(--chart-3, var(--primary)))",
  sponsor: "hsl(var(--chart-5, var(--primary)))",
  altro: "hsl(var(--muted-foreground))",
};

const fmt_chf = (n: number) =>
  new Intl.NumberFormat("it-CH", { style: "currency", currency: "CHF", maximumFractionDigits: 0 }).format(n || 0);
const fmt_int = (n: number) => new Intl.NumberFormat("it-CH").format(Math.round(n || 0));
const fmt_pct = (n: number, dec = 0) => `${n.toFixed(dec)}%`;
const initials = (n?: string, c?: string) => `${(n || "")[0] || ""}${(c || "")[0] || ""}` || "·";

function testo(v: unknown): string {
  return typeof v === "string" ? v : "";
}

function numero(v: unknown): number {
  if (typeof v === "number") return Number.isFinite(v) ? v : 0;
  if (typeof v === "string") {
    const n = Number(v);
    return Number.isFinite(n) ? n : 0;
  }
  return 0;
}

function booleano(v: unknown): boolean {
  return v === true;
}

function righe(data: unknown): Riga[] {
  return Array.isArray(data) ? (data as Riga[]) : [];
}

function prima_riga(data: unknown): Riga | null {
  if (!data || Array.isArray(data)) return null;
  return data as Riga;
}

function errore_lettura(nome: string, error: unknown): Error {
  const message = typeof error === "object" && error && "message" in error ? String((error as { message?: unknown }).message ?? "") : "";
  return new Error(`${nome}: ${message || "lettura non riuscita"}`);
}

function controlla(nome: string, risultato: { data: unknown; error: unknown }): unknown {
  if (risultato.error) throw errore_lettura(nome, risultato.error);
  return risultato.data;
}

function controlla_count(nome: string, risultato: { count?: number | null; error: unknown }): number {
  if (risultato.error) throw errore_lettura(nome, risultato.error);
  return risultato.count ?? 0;
}

function is_podio(r: Riga): boolean {
  const medaglia = testo(r.medaglia).toLowerCase();
  const posizione = numero(r.posizione);
  return medaglia.includes("oro") || medaglia.includes("argent") || medaglia.includes("bronz") || [1, 2, 3].includes(posizione);
}

function stagione_anno_inizio(stagione: Stagione | undefined): number | null {
  const da_data = stagione?.data_inizio ? Number(stagione.data_inizio.slice(0, 4)) : NaN;
  if (Number.isFinite(da_data)) return da_data;
  const trovato = stagione?.nome?.match(/\d{4}/)?.[0];
  return trovato ? Number(trovato) : null;
}

function in_stagione_sponsor(r: Riga, anno: number | null): boolean {
  if (anno === null) return true;
  const inizio = numero(r.stagione_inizio);
  const fine_raw = r.stagione_fine;
  const fine = fine_raw === null || fine_raw === undefined ? null : numero(fine_raw);
  return (!inizio || inizio <= anno) && (fine === null || fine >= anno);
}

function use_segnala_query_error(dove: string, operazione: string, is_error: boolean, error: unknown) {
  useEffect(() => {
    if (!is_error || !error) return;
    void segnala_errore(dove, operazione, error, undefined, "avviso");
  }, [dove, operazione, is_error, error]);
}

function use_stagioni_presidente(club_id: string | undefined) {
  return useQuery<Stagione[]>({
    queryKey: ["presidente", "stagioni", club_id],
    enabled: !!club_id,
    retry: 1,
    staleTime: 30_000,
    queryFn: async () => {
      const res = await supabase
        .from("stagioni")
        .select("id, nome, data_inizio, data_fine, attiva")
        .eq("club_id", club_id as string)
        .order("data_inizio", { ascending: false });
      return righe(controlla("stagioni", res)).map((s) => ({
        id: testo(s.id),
        nome: testo(s.nome),
        data_inizio: testo(s.data_inizio),
        data_fine: testo(s.data_fine),
        attiva: booleano(s.attiva),
      }));
    },
  });
}

function use_presidente_dashboard(club_id: string | undefined, stagione_id: string | null, prev_stagione_id: string | null) {
  return useQuery<DashboardData>({
    queryKey: ["presidente", "dashboard", club_id, stagione_id, prev_stagione_id],
    enabled: !!club_id && !!stagione_id,
    retry: 1,
    staleTime: 30_000,
    queryFn: async () => {
      const ids = [stagione_id, prev_stagione_id].filter((id): id is string => !!id);
      const [
        atleti_res,
        storici_res,
        bilancio_res,
        ricavi_res,
        corsi_res,
        capacita_res,
        richieste_res,
        ore_res,
        catalogo_pack_res,
        iscr_pack_res,
        costi_istruttori_res,
        ore_lavorate_res,
        lezioni_res,
        istruttori_res,
        gare_res,
        identity_res,
        sponsor_res,
        sponsor_cercati_res,
        eventi_res,
        pendenti_iscrizioni_res,
        pendenti_fatture_res,
        pendenti_lezioni_res,
      ] = await Promise.all([
        supabase
          .from("atleti")
          .select("id, nome, cognome, foto_path, livello_artistica, livello_attuale, livello_amatori, livello_stile, agonista, data_nascita, attivo, categoria")
          .eq("club_id", club_id as string),
        supabase
          .from("atleti_storici_stagioni")
          .select("status, motivo_abbandono, stagione_id, livello")
          .eq("club_id", club_id as string)
          .in("stagione_id", ids),
        supabase.from("bilancio_stagione").select("*").eq("club_id", club_id as string).in("stagione_id", ids),
        supabase.from("ricavi_per_fonte").select("*").eq("club_id", club_id as string).in("stagione_id", ids),
        supabase.from("corsi").select("id, nome, stagione_id").eq("club_id", club_id as string).in("stagione_id", ids),
        supabase
          .from("capacita_corsi")
          .select("corso_id, capacita_max, ore_settimanali_dedicate")
          .eq("club_id", club_id as string),
        supabase
          .from("richieste_iscrizione_storiche")
          .select("*")
          .eq("club_id", club_id as string)
          .in("stagione_id", ids),
        supabase.from("ore_pista_disponibili").select("*").eq("club_id", club_id as string).in("stagione_id", ids),
        supabase
          .from("catalogo_pacchetti_opzionali")
          .select("id, nome, costo_mensile, costo_annuale, costo_1_sessione, costo_2_sessioni, attivo")
          .eq("club_id", club_id as string),
        supabase
          .from("iscrizioni_pacchetti_storiche")
          .select("pacchetto_id, prezzo_pagato, atleta_id, stagione_id")
          .eq("club_id", club_id as string)
          .eq("stagione_id", stagione_id as string),
        supabase.from("costi_istruttori").select("*").eq("club_id", club_id as string).eq("stagione_id", stagione_id as string),
        supabase.from("ore_lavorate_istruttori").select("*").eq("club_id", club_id as string).eq("stagione_id", stagione_id as string),
        supabase
          .from("lezioni_private_storiche")
          .select("istruttore_id, atleta_id, ore, importo_pagato, data")
          .eq("club_id", club_id as string)
          .eq("stagione_id", stagione_id as string),
        supabase.from("istruttori").select("id, nome, cognome").eq("club_id", club_id as string),
        supabase
          .from("gare_calendario")
          .select("id, nome, stagione_id")
          .eq("club_id", club_id as string)
          .in("stagione_id", ids),
        supabase.from("club_identity").select("*").eq("club_id", club_id as string).maybeSingle(),
        supabase.from("sponsor_attivi").select("*").eq("club_id", club_id as string).order("importo_annuo", { ascending: false }),
        supabase
          .from("sponsor_categorie_cercate")
          .select("*")
          .eq("club_id", club_id as string)
          .order("importo_richiesto_indicativo", { ascending: false }),
        supabase.from("eventi_pubblici").select("*").eq("club_id", club_id as string).eq("stagione_id", stagione_id as string),
        supabase
          .from("richieste_iscrizione")
          .select("id", { count: "exact", head: true })
          .eq("club_id", club_id as string)
          .eq("stato", "in_attesa"),
        supabase
          .from("fatture")
          .select("id", { count: "exact", head: true })
          .eq("club_id", club_id as string)
          .eq("stato", "bozza"),
        supabase
          .from("richieste_lezioni_private")
          .select("id", { count: "exact", head: true })
          .eq("club_id", club_id as string)
          .eq("stato", "in_attesa"),
      ]);

      const gare = righe(controlla("gare_calendario", gare_res));
      const gara_ids = gare.map((g) => testo(g.id)).filter(Boolean);
      const iscrizioni_gare_res = gara_ids.length
        ? await supabase.from("iscrizioni_gare").select("medaglia, posizione, atleta_id, gara_id").in("gara_id", gara_ids)
        : { data: [], error: null };

      return {
        atleti: righe(controlla("atleti", atleti_res)),
        storici: righe(controlla("atleti_storici_stagioni", storici_res)),
        bilancio: righe(controlla("bilancio_stagione", bilancio_res)),
        ricavi: righe(controlla("ricavi_per_fonte", ricavi_res)),
        corsi: righe(controlla("corsi", corsi_res)),
        capacita: righe(controlla("capacita_corsi", capacita_res)),
        richieste_storiche: righe(controlla("richieste_iscrizione_storiche", richieste_res)),
        ore_pista: righe(controlla("ore_pista_disponibili", ore_res)),
        catalogo_pacchetti: righe(controlla("catalogo_pacchetti_opzionali", catalogo_pack_res)),
        iscrizioni_pacchetti: righe(controlla("iscrizioni_pacchetti_storiche", iscr_pack_res)),
        costi_istruttori: righe(controlla("costi_istruttori", costi_istruttori_res)),
        ore_lavorate: righe(controlla("ore_lavorate_istruttori", ore_lavorate_res)),
        lezioni_private: righe(controlla("lezioni_private_storiche", lezioni_res)),
        istruttori: righe(controlla("istruttori", istruttori_res)),
        gare,
        iscrizioni_gare: righe(controlla("iscrizioni_gare", iscrizioni_gare_res)),
        identity: prima_riga(controlla("club_identity", identity_res)),
        sponsor: righe(controlla("sponsor_attivi", sponsor_res)),
        sponsor_cercati: righe(controlla("sponsor_categorie_cercate", sponsor_cercati_res)),
        eventi: righe(controlla("eventi_pubblici", eventi_res)),
        pendenti: {
          iscrizioni: controlla_count("richieste_iscrizione", pendenti_iscrizioni_res),
          fatture_bozza: controlla_count("fatture", pendenti_fatture_res),
          lezioni_private: controlla_count("richieste_lezioni_private", pendenti_lezioni_res),
        },
      };
    },
  });
}

const MessaggioPagina: React.FC<{ titolo: string; testo: string; azione?: React.ReactNode; errore?: boolean }> = ({ titolo, testo, azione, errore }) => (
  <div className="min-h-screen bg-background px-6 py-16">
    <div className={`mx-auto max-w-3xl rounded-lg border p-6 ${errore ? "border-destructive/30 bg-destructive/10" : "border-amber-200 bg-amber-50"}`}>
      <div className="flex items-start gap-3">
        <AlertTriangle className={`mt-1 h-5 w-5 shrink-0 ${errore ? "text-destructive" : "text-amber-700"}`} />
        <div>
          <h1 className="text-2xl font-semibold text-foreground">{titolo}</h1>
          <p className="mt-2 text-sm text-muted-foreground">{testo}</p>
          {azione ? <div className="mt-4">{azione}</div> : null}
        </div>
      </div>
    </div>
  </div>
);

const Caricamento: React.FC<{ testo_loading: string }> = ({ testo_loading }) => (
  <div className="min-h-screen bg-background flex items-center justify-center">
    <div className="rounded-lg border bg-card px-5 py-4 text-sm text-muted-foreground shadow-sm">{testo_loading}</div>
  </div>
);

const DeltaPill: React.FC<{ value: number; suffix?: string }> = ({ value, suffix = "%" }) => {
  const positive = value > 0.1;
  const negative = value < -0.1;
  const cls = positive
    ? "bg-emerald-50 text-emerald-700"
    : negative
      ? "bg-rose-50 text-rose-700"
      : "bg-muted text-muted-foreground";
  const Icon = positive ? ArrowUp : negative ? ArrowDown : ArrowRight;
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold ${cls}`}>
      <Icon className="h-3 w-3" />
      {Math.abs(value).toFixed(1)}
      {suffix}
    </span>
  );
};

const ValoreGrande: React.FC<{ value: string; label: string; delta?: number; nota?: string; tono?: "base" | "positivo" | "attenzione" | "pericolo" }> = ({
  value,
  label,
  delta,
  nota,
  tono = "base",
}) => {
  const colore = tono === "positivo" ? "text-emerald-700" : tono === "attenzione" ? "text-amber-700" : tono === "pericolo" ? "text-rose-700" : "text-foreground";
  return (
    <div className="rounded-lg border bg-card p-5 shadow-sm">
      <div className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className={`mt-2 text-3xl font-semibold tabular-nums ${colore}`}>{value}</div>
      {delta !== undefined ? <div className="mt-2"><DeltaPill value={delta} /></div> : nota ? <div className="mt-2 text-xs text-muted-foreground">{nota}</div> : null}
    </div>
  );
};

const StatoDati: React.FC<{ titolo: string; testo: string }> = ({ titolo, testo }) => (
  <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
    <div className="font-semibold">{titolo}</div>
    <div className="mt-1">{testo}</div>
  </div>
);

const RigaInfo: React.FC<{ label: string; value: string; tono?: "base" | "positivo" | "attenzione" | "pericolo" }> = ({ label, value, tono = "base" }) => {
  const colore = tono === "positivo" ? "text-emerald-700" : tono === "attenzione" ? "text-amber-700" : tono === "pericolo" ? "text-rose-700" : "text-foreground";
  return (
    <div className="flex items-baseline justify-between gap-4 border-b border-border py-3 last:border-b-0">
      <span className="text-sm text-muted-foreground">{label}</span>
      <span className={`text-right font-semibold tabular-nums ${colore}`}>{value}</span>
    </div>
  );
};

const AreaCard: React.FC<{
  id_area: AreaId;
  title: string;
  icon: React.ReactNode;
  main_kpi: string;
  sub_label: string;
  stato: StatoArea;
  stato_label: string;
  link_label: string;
  children: React.ReactNode;
  on_open: () => void;
}> = ({ id_area, title, icon, main_kpi, sub_label, stato, stato_label, link_label, children, on_open }) => {
  const stato_cls =
    stato === "positivo"
      ? "bg-emerald-50 text-emerald-700"
      : stato === "attenzione"
        ? "bg-amber-50 text-amber-700"
        : stato === "mancante"
          ? "bg-rose-50 text-rose-700"
          : "bg-muted text-muted-foreground";
  return (
    <article className="rounded-lg border bg-card p-6 shadow-sm">
      <button type="button" onClick={on_open} className="w-full text-left focus:outline-none focus:ring-2 focus:ring-ring rounded-md">
        <div className="flex items-center gap-2 text-muted-foreground">
          <span className={`flex h-8 w-8 items-center justify-center rounded-md text-primary-foreground ${AREA_ACCENTS[id_area]}`}>{icon}</span>
          <span className="text-[11px] font-semibold uppercase tracking-wide">{title}</span>
        </div>
        <div className="mt-5 text-3xl font-semibold tabular-nums text-foreground">{main_kpi}</div>
        <div className="mt-1 text-sm text-muted-foreground">{sub_label}</div>
        <div className="mt-5 min-h-[90px]">{children}</div>
      </button>
      <div className="mt-5 flex items-center justify-between gap-4">
        <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide ${stato_cls}`}>{stato_label}</span>
        <a href={AREA_PATHS[id_area]} className="text-sm font-medium text-primary hover:underline">
          {link_label}
        </a>
      </div>
    </article>
  );
};

const MiniBarsHoriz: React.FC<{ items: { label: string; value: number; color: string }[]; empty_label: string }> = ({ items, empty_label }) => {
  const max = Math.max(0, ...items.map((i) => i.value));
  if (max === 0) return <div className="text-sm text-muted-foreground">{empty_label}</div>;
  return (
    <div className="space-y-2">
      {items.map((it) => (
        <div key={it.label} className="grid grid-cols-[88px_1fr_48px] items-center gap-2 text-xs">
          <span className="truncate text-muted-foreground">{it.label}</span>
          <div className="h-2 overflow-hidden rounded-full bg-muted">
            <div className="h-full rounded-full" style={{ width: `${(it.value / max) * 100}%`, backgroundColor: it.color }} />
          </div>
          <span className="text-right font-semibold tabular-nums text-foreground">{fmt_int(it.value)}</span>
        </div>
      ))}
    </div>
  );
};

const MiniPyramid: React.FC<{ items: { label: string; value: number }[]; empty_label: string }> = ({ items, empty_label }) => {
  const max = Math.max(0, ...items.map((i) => i.value));
  if (max === 0) return <div className="text-sm text-muted-foreground">{empty_label}</div>;
  return (
    <div className="space-y-2">
      {items.map((it) => (
        <div key={it.label} className="grid grid-cols-[88px_1fr_34px] items-center gap-2 text-xs">
          <span className="truncate text-right text-muted-foreground">{it.label}</span>
          <div className="h-2 overflow-hidden rounded-full bg-muted">
            <div className="h-full rounded-full bg-emerald-600" style={{ width: `${(it.value / max) * 100}%` }} />
          </div>
          <span className="text-right font-semibold tabular-nums text-foreground">{fmt_int(it.value)}</span>
        </div>
      ))}
    </div>
  );
};

const MiniDonut: React.FC<{ data: { name: string; value: number; color: string }[]; empty_label: string }> = ({ data, empty_label }) => {
  const tot = data.reduce((s, d) => s + d.value, 0);
  if (data.length === 0 || tot === 0) return <div className="text-sm text-muted-foreground">{empty_label}</div>;
  return (
    <div className="flex items-center gap-4">
      <div className="h-24 flex-1 min-w-0">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie data={data} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={24} outerRadius={42} paddingAngle={2}>
              {data.map((d) => <Cell key={d.name} fill={d.color} />)}
            </Pie>
          </PieChart>
        </ResponsiveContainer>
      </div>
      <div className="min-w-0 flex-[2] space-y-1 text-xs">
        {data.slice(0, 3).map((d) => (
          <div key={d.name} className="flex items-center gap-2">
            <span className="h-2 w-2 shrink-0 rounded-sm" style={{ backgroundColor: d.color }} />
            <span className="truncate text-muted-foreground">{d.name}</span>
            <span className="ml-auto font-semibold tabular-nums text-foreground">{fmt_pct((d.value / tot) * 100)}</span>
          </div>
        ))}
      </div>
    </div>
  );
};

const MiniBarsVert: React.FC<{ items: { label: string; value: number }[]; empty_label: string }> = ({ items, empty_label }) => {
  const max = Math.max(0, ...items.map((i) => i.value));
  if (max === 0) return <div className="text-sm text-muted-foreground">{empty_label}</div>;
  return (
    <div className="flex h-24 items-end gap-3">
      {items.map((it) => (
        <div key={it.label} className="flex flex-1 flex-col items-center gap-1">
          <span className="text-[10px] font-semibold tabular-nums text-foreground">{fmt_int(it.value)}</span>
          <div className="w-full rounded-t bg-primary" style={{ height: `${Math.max(6, (it.value / max) * 56)}px` }} />
          <span className="max-w-full truncate text-[10px] text-muted-foreground">{it.label}</span>
        </div>
      ))}
    </div>
  );
};

const StatoSegreteria: React.FC<{ d: DashboardData; t: (key: string, opts?: Record<string, unknown>) => string }> = ({ d, t }) => {
  const righe_pendenti = [
    { label: t("president_home.secretary.registrations"), value: d.pendenti.iscrizioni, href: "/richieste-iscrizione" },
    { label: t("president_home.secretary.draft_invoices"), value: d.pendenti.fatture_bozza, href: "/fatture?stato=bozza" },
    { label: t("president_home.secretary.private_lessons"), value: d.pendenti.lezioni_private, href: "/lezioni-private" },
  ];
  return (
    <section className="mt-8 rounded-lg border bg-card p-5 shadow-sm">
      <div className="mb-4 flex items-center gap-2">
        <AlertTriangle className="h-4 w-4 text-amber-700" />
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">{t("president_home.secretary.title")}</h2>
      </div>
      <div className="grid gap-3 md:grid-cols-3">
        {righe_pendenti.map((r) => (
          <a key={r.href} href={r.href} className="rounded-lg border bg-background p-4 transition-colors hover:bg-muted/50">
            <div className="text-2xl font-semibold tabular-nums text-foreground">{fmt_int(r.value)}</div>
            <div className="mt-1 text-sm text-muted-foreground">{r.label}</div>
            <div className="mt-3 text-sm font-medium text-primary">{t("president_home.open_link")}</div>
          </a>
        ))}
      </div>
    </section>
  );
};

function fonte_label(t: (key: string, opts?: Record<string, unknown>) => string, fonte: string): string {
  return t(`president_home.fonte.${fonte}`, { defaultValue: fonte });
}

function riepilogo_livelli(atleti: Riga[]): Record<string, number> {
  const out: Record<string, number> = {};
  LIVELLI_ORDER.forEach((l) => { out[l] = 0; });
  atleti.forEach((a) => {
    const livello = testo(a.livello_artistica) || testo(a.livello_amatori) || testo(a.livello_attuale);
    if (livello && out[livello] !== undefined) out[livello] += 1;
    else if (testo(a.categoria) === "pulcini") out.Pulcini += 1;
  });
  return out;
}

const AreaGhiaccio: React.FC<{ d: DashboardData; stagione_id: string; t: (key: string, opts?: Record<string, unknown>) => string }> = ({ d, stagione_id, t }) => {
  const ore = d.ore_pista.find((o) => testo(o.stagione_id) === stagione_id);
  const richieste = d.richieste_storiche.filter((r) => testo(r.stagione_id) === stagione_id);
  const disponibili = ore ? numero(ore.ore_settimanali_totali) : null;
  const utilizzate = ore ? numero(ore.ore_settimanali_utilizzate) : null;
  const richieste_tutte = ore ? numero(ore.ore_richieste_se_accettassimo_tutti) : null;
  const costo_orario = ore ? numero(ore.costo_orario_pista) : null;
  const tot_richieste = richieste.reduce((s, r) => s + numero(r.n_richieste_ricevute), 0);
  const tot_accettate = richieste.reduce((s, r) => s + numero(r.n_iscritti_accettati), 0);
  const tot_attesa = richieste.reduce((s, r) => s + numero(r.n_in_lista_attesa), 0);
  const corsi = new Map<string, { nome: string; capacita: number; iscritti: number; attesa: number }>();
  d.capacita.forEach((c) => {
    const corso = d.corsi.find((r) => testo(r.id) === testo(c.corso_id));
    if (testo(corso?.stagione_id) !== stagione_id) return;
    corsi.set(testo(c.corso_id), {
      nome: testo(corso?.nome) || t("president_home.ice.table.course"),
      capacita: numero(c.capacita_max),
      iscritti: 0,
      attesa: 0,
    });
  });
  richieste.forEach((r) => {
    const row = corsi.get(testo(r.corso_id));
    if (!row) return;
    row.iscritti = numero(r.n_iscritti_accettati);
    row.attesa = numero(r.n_in_lista_attesa);
  });
  const tabella = Array.from(corsi.values());

  return (
    <div className="space-y-8">
      {!ore ? <StatoDati titolo={t("president_home.missing.title")} testo={t("president_home.ice.missing_hours")} /> : null}
      <div className="grid gap-4 md:grid-cols-4">
        <ValoreGrande label={t("president_home.ice.available")} value={disponibili === null ? "—" : `${fmt_int(disponibili)} h`} />
        <ValoreGrande label={t("president_home.ice.used")} value={utilizzate === null ? "—" : `${fmt_int(utilizzate)} h`} />
        <ValoreGrande label={t("president_home.ice.requested_all")} value={richieste_tutte === null ? "—" : `${fmt_int(richieste_tutte)} h`} tono="attenzione" />
        <ValoreGrande label={t("president_home.ice.hourly_cost")} value={costo_orario === null ? "—" : `${fmt_chf(costo_orario)}/h`} />
      </div>
      <div className="grid gap-4 md:grid-cols-3">
        <ValoreGrande label={t("president_home.ice.requests_received")} value={fmt_int(tot_richieste)} />
        <ValoreGrande label={t("president_home.ice.accepted")} value={fmt_int(tot_accettate)} tono="positivo" />
        <ValoreGrande label={t("president_home.ice.in_waiting_list")} value={fmt_int(tot_attesa)} tono={tot_attesa > 0 ? "attenzione" : "base"} />
      </div>
      {tabella.length === 0 ? (
        <StatoDati titolo={t("president_home.empty.title")} testo={t("president_home.ice.no_courses")} />
      ) : (
        <div className="overflow-x-auto rounded-lg border bg-card">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-xs uppercase tracking-wide text-muted-foreground">
              <tr>
                <th className="px-4 py-3 text-left font-semibold">{t("president_home.ice.table.course")}</th>
                <th className="px-4 py-3 text-right font-semibold">{t("president_home.ice.table.capacity")}</th>
                <th className="px-4 py-3 text-right font-semibold">{t("president_home.ice.table.enrolled")}</th>
                <th className="px-4 py-3 text-right font-semibold">{t("president_home.ice.table.waiting")}</th>
                <th className="px-4 py-3 text-right font-semibold">{t("president_home.ice.table.saturation")}</th>
              </tr>
            </thead>
            <tbody>
              {tabella.map((r) => {
                const sat = r.capacita ? (r.iscritti / r.capacita) * 100 : 0;
                return (
                  <tr key={r.nome} className="border-t">
                    <td className="px-4 py-3 font-medium text-foreground">{r.nome}</td>
                    <td className="px-4 py-3 text-right tabular-nums text-muted-foreground">{fmt_int(r.capacita)}</td>
                    <td className="px-4 py-3 text-right tabular-nums text-foreground">{fmt_int(r.iscritti)}</td>
                    <td className="px-4 py-3 text-right tabular-nums font-semibold text-amber-700">{fmt_int(r.attesa)}</td>
                    <td className="px-4 py-3 text-right tabular-nums text-foreground">{fmt_pct(sat)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

const AreaAtleti: React.FC<{ d: DashboardData; stagioni: Stagione[]; stagione_id: string; prev_stagione_id: string | null; confronta: boolean; t: (key: string, opts?: Record<string, unknown>) => string }> = ({ d, stagioni, stagione_id, prev_stagione_id, confronta, t }) => {
  const attivi = d.atleti.filter((a) => booleano(a.attivo));
  const storici_curr = d.storici.filter((s) => testo(s.stagione_id) === stagione_id);
  const storici_prev = prev_stagione_id ? d.storici.filter((s) => testo(s.stagione_id) === prev_stagione_id) : [];
  const prev_tot = storici_prev.length;
  const yoy = prev_tot ? ((attivi.length - prev_tot) / prev_tot) * 100 : undefined;
  const abbandoni = storici_curr.filter((s) => testo(s.status) === "abbandonato").length;
  const eta_valide = attivi
    .map((a) => testo(a.data_nascita))
    .filter(Boolean)
    .map((data) => (Date.now() - new Date(`${data}T00:00:00`).getTime()) / (365.25 * 24 * 3600 * 1000))
    .filter((eta) => Number.isFinite(eta));
  const eta_media = eta_valide.length ? eta_valide.reduce((s, eta) => s + eta, 0) / eta_valide.length : null;
  const livelli = riepilogo_livelli(attivi);
  const livelli_prev = riepilogo_livelli(storici_prev.map((s) => ({ livello_attuale: s.livello })));
  const prev_has_levels = Object.values(livelli_prev).some((v) => v > 0);
  const max_livelli = Math.max(1, ...Object.values(livelli), ...Object.values(livelli_prev));
  const trend = stagioni
    .slice()
    .reverse()
    .map((s) => {
      const storico = d.storici.filter((r) => testo(r.stagione_id) === s.id);
      if (s.id === stagione_id) return { nome: s.nome, atleti: attivi.length };
      if (storico.length > 0) return { nome: s.nome, atleti: storico.length };
      return null;
    })
    .filter((r): r is { nome: string; atleti: number } => r !== null);

  return (
    <div className="space-y-8">
      <div className="grid gap-4 md:grid-cols-4">
        <ValoreGrande label={t("president_home.athletes.active_athletes")} value={fmt_int(attivi.length)} delta={confronta ? yoy : undefined} />
        <ValoreGrande label={t("president_home.athletes.dropouts")} value={fmt_int(abbandoni)} tono={abbandoni > 0 ? "attenzione" : "base"} />
        <ValoreGrande label={t("president_home.athletes.avg_age")} value={eta_media === null ? "—" : t("president_home.athletes.years_short", { value: eta_media.toFixed(1) })} />
        <ValoreGrande label={t("president_home.athletes.levels_count")} value={fmt_int(Object.values(livelli).filter((v) => v > 0).length)} />
      </div>
      {confronta && prev_stagione_id && !prev_has_levels ? <StatoDati titolo={t("president_home.missing.title")} testo={t("president_home.athletes.missing_previous_levels")} /> : null}
      <div className="rounded-lg border bg-card p-5">
        <h3 className="mb-5 text-sm font-semibold uppercase tracking-wide text-muted-foreground">{t("president_home.athletes.levels_pyramid")}</h3>
        <div className="space-y-3">
          {LIVELLI_ORDER.map((livello) => {
            const c = livelli[livello] || 0;
            const pc = livelli_prev[livello] || 0;
            return (
              <div key={livello} className="grid grid-cols-[110px_1fr_42px] items-center gap-3 text-sm">
                <span className="truncate text-right text-muted-foreground">{livello}</span>
                <div className="relative h-6 overflow-hidden rounded-md bg-muted">
                  {confronta && prev_has_levels ? <div className="absolute inset-y-0 left-0 bg-muted-foreground/30" style={{ width: `${(pc / max_livelli) * 100}%` }} /> : null}
                  <div className="absolute inset-y-0 left-0 rounded-md bg-emerald-600" style={{ width: `${(c / max_livelli) * 100}%` }} />
                </div>
                <span className="text-right font-semibold tabular-nums text-foreground">{fmt_int(c)}</span>
              </div>
            );
          })}
        </div>
      </div>
      {trend.length < 2 ? (
        <StatoDati titolo={t("president_home.missing.title")} testo={t("president_home.athletes.missing_trend")} />
      ) : (
        <div className="rounded-lg border bg-card p-5">
          <h3 className="mb-5 text-sm font-semibold uppercase tracking-wide text-muted-foreground">{t("president_home.athletes.trend_title")}</h3>
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={trend} margin={{ top: 20, right: 20, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="nome" tick={{ fontSize: 12 }} />
                <YAxis width={40} tick={{ fontSize: 12 }} />
                <RTooltip />
                <Line type="monotone" dataKey="atleti" stroke={AREA_STROKES.atleti} strokeWidth={3} dot={{ r: 4 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}
    </div>
  );
};

const AreaRicavi: React.FC<{ d: DashboardData; stagione_id: string; prev_stagione_id: string | null; confronta: boolean; t: (key: string, opts?: Record<string, unknown>) => string }> = ({ d, stagione_id, prev_stagione_id, confronta, t }) => {
  const curr = d.ricavi.filter((r) => testo(r.stagione_id) === stagione_id);
  const prev = prev_stagione_id ? d.ricavi.filter((r) => testo(r.stagione_id) === prev_stagione_id) : [];
  const totale = curr.reduce((s, r) => s + numero(r.importo), 0);
  const totale_prev = prev.reduce((s, r) => s + numero(r.importo), 0);
  const yoy = totale_prev ? ((totale - totale_prev) / totale_prev) * 100 : undefined;
  const data = curr
    .map((r) => ({ name: fonte_label(t, testo(r.fonte)), key: testo(r.fonte), value: numero(r.importo), color: FONTE_COLOR[testo(r.fonte)] || FONTE_COLOR.altro }))
    .filter((r) => r.value > 0)
    .sort((a, b) => b.value - a.value);
  const pacchetti = new Map<string, { nome: string; iscritti: number; ricavo: number; prezzo: number }>();
  d.catalogo_pacchetti.forEach((p) => {
    if (p.attivo === false) return;
    pacchetti.set(testo(p.id), {
      nome: testo(p.nome),
      iscritti: 0,
      ricavo: 0,
      prezzo: numero(p.costo_mensile) || numero(p.costo_annuale) || numero(p.costo_2_sessioni) || numero(p.costo_1_sessione),
    });
  });
  d.iscrizioni_pacchetti.forEach((i) => {
    const row = pacchetti.get(testo(i.pacchetto_id));
    if (!row) return;
    row.iscritti += 1;
    row.ricavo += numero(i.prezzo_pagato);
  });
  const pacchetti_usati = Array.from(pacchetti.values()).filter((p) => p.iscritti > 0).sort((a, b) => b.ricavo - a.ricavo);

  return (
    <div className="space-y-8">
      {curr.length === 0 ? <StatoDati titolo={t("president_home.missing.title")} testo={t("president_home.revenue.missing")} /> : null}
      <div className="grid gap-4 md:grid-cols-3">
        <ValoreGrande label={t("president_home.revenue.season_revenue")} value={curr.length === 0 ? "—" : fmt_chf(totale)} delta={confronta ? yoy : undefined} />
        <ValoreGrande label={t("president_home.revenue.sources")} value={fmt_int(curr.length)} />
        <ValoreGrande label={t("president_home.revenue.packages_used")} value={fmt_int(pacchetti_usati.length)} />
      </div>
      <div className="rounded-lg border bg-card p-5">
        <h3 className="mb-5 text-sm font-semibold uppercase tracking-wide text-muted-foreground">{t("president_home.revenue.composition")}</h3>
        {data.length === 0 ? (
          <div className="text-sm text-muted-foreground">{t("president_home.revenue.no_sources")}</div>
        ) : (
          <div className="grid gap-6 md:grid-cols-[260px_1fr]">
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={data} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={58} outerRadius={100} paddingAngle={2}>
                    {data.map((r) => <Cell key={r.key} fill={r.color} />)}
                  </Pie>
                  <RTooltip formatter={(v) => fmt_chf(Number(v))} />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="space-y-3">
              {data.map((r) => (
                <div key={r.key} className="flex items-center gap-3 rounded-lg border bg-background p-3">
                  <span className="h-3 w-3 rounded-sm" style={{ backgroundColor: r.color }} />
                  <span className="flex-1 text-sm font-medium text-foreground">{r.name}</span>
                  <span className="text-sm font-semibold tabular-nums text-foreground">{fmt_chf(r.value)}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
      <div className="rounded-lg border bg-card p-5">
        <h3 className="mb-5 text-sm font-semibold uppercase tracking-wide text-muted-foreground">{t("president_home.revenue.packages_title")}</h3>
        {pacchetti_usati.length === 0 ? <div className="text-sm text-muted-foreground">{t("president_home.revenue.no_packages")}</div> : null}
        <div className="space-y-2">
          {pacchetti_usati.map((p) => <RigaInfo key={p.nome} label={`${p.nome} · ${fmt_int(p.iscritti)}`} value={fmt_chf(p.ricavo)} />)}
        </div>
      </div>
    </div>
  );
};

const AreaIstruttori: React.FC<{ d: DashboardData; t: (key: string, opts?: Record<string, unknown>) => string }> = ({ d, t }) => {
  const ore_by = new Map<string, { corsi: number; lezioni: number; eventi: number; amministrative: number }>();
  d.ore_lavorate.forEach((o) => {
    const id = testo(o.istruttore_id);
    if (!id) return;
    const row = ore_by.get(id) ?? { corsi: 0, lezioni: 0, eventi: 0, amministrative: 0 };
    row.corsi += numero(o.ore_corsi);
    row.lezioni += numero(o.ore_lezioni_private);
    row.eventi += numero(o.ore_eventi);
    row.amministrative += numero(o.ore_amministrative);
    ore_by.set(id, row);
  });
  const cards = d.costi_istruttori.map((c) => {
    const istruttore = d.istruttori.find((i) => testo(i.id) === testo(c.istruttore_id));
    const ore = ore_by.get(testo(c.istruttore_id)) ?? { corsi: 0, lezioni: 0, eventi: 0, amministrative: 0 };
    const ore_totali = ore.corsi + ore.lezioni + ore.eventi + ore.amministrative;
    const tariffa = numero(c.tariffa_oraria);
    return { istruttore, ore, ore_totali, tariffa, costo_variabile: ore_totali * tariffa, costo_fisso_mensile: numero(c.costo_fisso_mensile) };
  });
  const ore_totali = cards.reduce((s, c) => s + c.ore_totali, 0);
  const costo_variabile = cards.reduce((s, c) => s + c.costo_variabile, 0);
  const stacked = [
    { nome: t("president_home.costs.legend.courses"), ore: cards.reduce((s, c) => s + c.ore.corsi, 0) },
    { nome: t("president_home.costs.legend.private"), ore: cards.reduce((s, c) => s + c.ore.lezioni, 0) },
    { nome: t("president_home.costs.legend.events"), ore: cards.reduce((s, c) => s + c.ore.eventi, 0) },
    { nome: t("president_home.costs.legend.admin"), ore: cards.reduce((s, c) => s + c.ore.amministrative, 0) },
  ];

  return (
    <div className="space-y-8">
      {cards.length === 0 ? <StatoDati titolo={t("president_home.empty.title")} testo={t("president_home.costs.no_costs")} /> : null}
      <div className="grid gap-4 md:grid-cols-3">
        <ValoreGrande label={t("president_home.costs.instructors")} value={fmt_int(cards.length)} />
        <ValoreGrande label={t("president_home.costs.hours_worked")} value={`${fmt_int(ore_totali)} h`} />
        <ValoreGrande label={t("president_home.costs.variable_cost")} value={cards.length === 0 ? "—" : fmt_chf(costo_variabile)} />
      </div>
      <div className="rounded-lg border bg-card p-5">
        <h3 className="mb-5 text-sm font-semibold uppercase tracking-wide text-muted-foreground">{t("president_home.costs.hours_by_type")}</h3>
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={stacked}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="nome" tick={{ fontSize: 12 }} />
              <YAxis tick={{ fontSize: 12 }} />
              <RTooltip />
              <Bar dataKey="ore" fill={AREA_STROKES.costi} radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        {cards.map((c) => (
          <div key={testo(c.istruttore?.id) || `${testo(c.istruttore?.nome)}-${testo(c.istruttore?.cognome)}`} className="rounded-lg border bg-card p-5">
            <div className="mb-4 flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-full bg-muted font-semibold text-muted-foreground">
                {initials(testo(c.istruttore?.nome), testo(c.istruttore?.cognome))}
              </div>
              <div>
                <div className="font-semibold text-foreground">{testo(c.istruttore?.nome)} {testo(c.istruttore?.cognome)}</div>
                <div className="text-sm text-muted-foreground">{fmt_chf(c.tariffa)}/h</div>
              </div>
            </div>
            <RigaInfo label={t("president_home.costs.hours_worked")} value={`${fmt_int(c.ore_totali)} h`} />
            <RigaInfo label={t("president_home.costs.variable_cost")} value={fmt_chf(c.costo_variabile)} />
            <RigaInfo label={t("president_home.costs.fixed_monthly")} value={c.costo_fisso_mensile ? fmt_chf(c.costo_fisso_mensile) : "—"} />
          </div>
        ))}
      </div>
    </div>
  );
};

const AreaLezioni: React.FC<{ d: DashboardData; t: (key: string, opts?: Record<string, unknown>) => string }> = ({ d, t }) => {
  const lezioni = d.lezioni_private;
  const ore_totali = lezioni.reduce((s, l) => s + numero(l.ore), 0);
  const fatturato = lezioni.reduce((s, l) => s + numero(l.importo_pagato), 0);
  const per_istruttore = new Map<string, { ore: number; ricavo: number }>();
  const per_atleta = new Map<string, { ore: number; speso: number }>();
  const per_giorno = new Map<string, number>();
  lezioni.forEach((l) => {
    const istruttore_id = testo(l.istruttore_id);
    const atleta_id = testo(l.atleta_id);
    const data = testo(l.data);
    if (istruttore_id) {
      const row = per_istruttore.get(istruttore_id) ?? { ore: 0, ricavo: 0 };
      row.ore += numero(l.ore);
      row.ricavo += numero(l.importo_pagato);
      per_istruttore.set(istruttore_id, row);
    }
    if (atleta_id) {
      const row = per_atleta.get(atleta_id) ?? { ore: 0, speso: 0 };
      row.ore += numero(l.ore);
      row.speso += numero(l.importo_pagato);
      per_atleta.set(atleta_id, row);
    }
    if (data) {
      const giorno = new Date(`${data}T00:00:00`).getDay();
      const label = [t("president_home.dow.sun"), t("president_home.dow.mon"), t("president_home.dow.tue"), t("president_home.dow.wed"), t("president_home.dow.thu"), t("president_home.dow.fri"), t("president_home.dow.sat")][giorno];
      per_giorno.set(label, (per_giorno.get(label) ?? 0) + 1);
    }
  });
  const top_istruttori = Array.from(per_istruttore.entries())
    .map(([id, v]) => ({ ...v, istruttore: d.istruttori.find((i) => testo(i.id) === id) }))
    .sort((a, b) => b.ricavo - a.ricavo)
    .slice(0, 5);
  const top_atleti = Array.from(per_atleta.entries())
    .map(([id, v]) => ({ ...v, atleta: d.atleti.find((a) => testo(a.id) === id) }))
    .sort((a, b) => b.ore - a.ore)
    .slice(0, 5);
  const giorni = Array.from(per_giorno.entries()).map(([label, value]) => ({ label, value }));

  return (
    <div className="space-y-8">
      {lezioni.length === 0 ? <StatoDati titolo={t("president_home.empty.title")} testo={t("president_home.private.no_lessons")} /> : null}
      <div className="grid gap-4 md:grid-cols-3">
        <ValoreGrande label={t("president_home.private.lessons_sold")} value={fmt_int(lezioni.length)} />
        <ValoreGrande label={t("president_home.private.hours_sold_label")} value={`${fmt_int(ore_totali)} h`} />
        <ValoreGrande label={t("president_home.private.turnover")} value={lezioni.length === 0 ? "—" : fmt_chf(fatturato)} />
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-lg border bg-card p-5">
          <h3 className="mb-4 text-sm font-semibold uppercase tracking-wide text-muted-foreground">{t("president_home.private.top_instructors")}</h3>
          {top_istruttori.length === 0 ? <div className="text-sm text-muted-foreground">{t("president_home.private.no_top")}</div> : null}
          {top_istruttori.map((r) => <RigaInfo key={testo(r.istruttore?.id)} label={`${testo(r.istruttore?.nome)} ${testo(r.istruttore?.cognome)}`} value={`${fmt_int(r.ore)} h · ${fmt_chf(r.ricavo)}`} />)}
        </div>
        <div className="rounded-lg border bg-card p-5">
          <h3 className="mb-4 text-sm font-semibold uppercase tracking-wide text-muted-foreground">{t("president_home.private.top_clients")}</h3>
          {top_atleti.length === 0 ? <div className="text-sm text-muted-foreground">{t("president_home.private.no_top")}</div> : null}
          {top_atleti.map((r) => <RigaInfo key={testo(r.atleta?.id)} label={`${testo(r.atleta?.nome)} ${testo(r.atleta?.cognome)}`} value={`${fmt_int(r.ore)} h · ${fmt_chf(r.speso)}`} />)}
        </div>
      </div>
      <div className="rounded-lg border bg-card p-5">
        <h3 className="mb-4 text-sm font-semibold uppercase tracking-wide text-muted-foreground">{t("president_home.private.days_title")}</h3>
        <MiniBarsHoriz items={giorni.map((g) => ({ ...g, color: AREA_STROKES.lezioni }))} empty_label={t("president_home.private.no_days")} />
      </div>
    </div>
  );
};

const AreaSport: React.FC<{ d: DashboardData; stagione_id: string; prev_stagione_id: string | null; t: (key: string, opts?: Record<string, unknown>) => string }> = ({ d, stagione_id, prev_stagione_id, t }) => {
  const gare_curr = d.gare.filter((g) => testo(g.stagione_id) === stagione_id);
  const gare_prev = prev_stagione_id ? d.gare.filter((g) => testo(g.stagione_id) === prev_stagione_id) : [];
  const gare_ids_curr = new Set(gare_curr.map((g) => testo(g.id)));
  const gare_ids_prev = new Set(gare_prev.map((g) => testo(g.id)));
  const iscr_curr = d.iscrizioni_gare.filter((i) => gare_ids_curr.has(testo(i.gara_id)));
  const iscr_prev = d.iscrizioni_gare.filter((i) => gare_ids_prev.has(testo(i.gara_id)));
  const podi = iscr_curr.filter(is_podio).length;
  const podi_prev = iscr_prev.filter(is_podio).length;
  const top_atleta = Array.from(iscr_curr.filter(is_podio).reduce((map, i) => {
    const id = testo(i.atleta_id);
    map.set(id, (map.get(id) ?? 0) + 1);
    return map;
  }, new Map<string, number>()).entries()).sort((a, b) => b[1] - a[1])[0];
  const atleta = top_atleta ? d.atleti.find((a) => testo(a.id) === top_atleta[0]) : null;

  return (
    <div className="space-y-8">
      {gare_curr.length === 0 ? <StatoDati titolo={t("president_home.empty.title")} testo={t("president_home.sport.no_competitions")} /> : null}
      <div className="grid gap-4 md:grid-cols-4">
        <ValoreGrande label={t("president_home.sport.competitions")} value={fmt_int(gare_curr.length)} />
        <ValoreGrande label={t("president_home.sport.entries")} value={fmt_int(iscr_curr.length)} />
        <ValoreGrande label={t("president_home.sport.podiums")} value={fmt_int(podi)} />
        <ValoreGrande label={t("president_home.sport.podium_rate")} value={iscr_curr.length ? fmt_pct((podi / iscr_curr.length) * 100) : "—"} />
      </div>
      {atleta ? (
        <div className="rounded-lg border bg-card p-5">
          <h3 className="mb-4 text-sm font-semibold uppercase tracking-wide text-muted-foreground">{t("president_home.sport.top_athlete")}</h3>
          <div className="flex items-center gap-4">
            <FotoAtleta
              foto_path={testo(atleta.foto_path)}
              nome={testo(atleta.nome)}
              cognome={testo(atleta.cognome)}
              className="h-14 w-14 rounded-full"
              fallback={<div className="flex h-14 w-14 items-center justify-center rounded-full bg-muted font-semibold text-muted-foreground">{initials(testo(atleta.nome), testo(atleta.cognome))}</div>}
            />
            <div>
              <div className="font-semibold text-foreground">{testo(atleta.nome)} {testo(atleta.cognome)}</div>
              <div className="text-sm text-muted-foreground">{t("president_home.sport.podiums_count", { count: top_atleta[1] })}</div>
            </div>
          </div>
        </div>
      ) : null}
      {gare_prev.length === 0 ? <StatoDati titolo={t("president_home.missing.title")} testo={t("president_home.sport.missing_previous")} /> : null}
      {gare_prev.length > 0 ? (
        <div className="rounded-lg border bg-card p-5">
          <RigaInfo label={t("president_home.sport.previous_podiums")} value={fmt_int(podi_prev)} />
        </div>
      ) : null}
    </div>
  );
};

const AreaCatalogo: React.FC<{ d: DashboardData; club_nome: string; sponsor: Riga[]; t: (key: string, opts?: Record<string, unknown>) => string }> = ({ d, club_nome, sponsor, t }) => {
  const identity = d.identity ?? {};
  const partecipanti = d.eventi.reduce((s, e) => s + numero(e.partecipanti_stimati), 0);
  const pacchetti = d.catalogo_pacchetti.filter((p) => p.attivo !== false).slice(0, 8);
  const corsi = d.corsi.slice(0, 8);
  const sponsor_totale = sponsor.reduce((s, r) => s + numero(r.importo_annuo), 0);

  return (
    <div className="space-y-8">
      <div className="rounded-lg border bg-card p-5">
        <h3 className="text-2xl font-semibold text-foreground">{club_nome}</h3>
        <div className="mt-3 flex flex-wrap gap-4 text-sm text-muted-foreground">
          <span>{t("president_home.catalog.since", { anno: testo(identity.anno_fondazione) || "—" })}</span>
          <span>{testo(identity.federazione) || "—"}</span>
          <span className="inline-flex items-center gap-1"><MapPin className="h-3 w-3" />{testo(identity.citta) || "—"}</span>
          {testo(identity.email_contatto) ? <span className="inline-flex items-center gap-1"><Mail className="h-3 w-3" />{testo(identity.email_contatto)}</span> : null}
        </div>
        {testo(identity.mission) ? <p className="mt-4 border-l-2 border-primary pl-4 text-sm italic text-muted-foreground">{testo(identity.mission)}</p> : null}
      </div>
      <div className="grid gap-4 md:grid-cols-4">
        <ValoreGrande label={t("president_home.catalog.active_sponsors")} value={fmt_int(sponsor.length)} />
        <ValoreGrande label={t("president_home.catalog.sponsor_value")} value={fmt_chf(sponsor_totale)} />
        <ValoreGrande label={t("president_home.catalog.open_events")} value={fmt_int(d.eventi.length)} />
        <ValoreGrande label={t("president_home.catalog.participants")} value={fmt_int(partecipanti)} />
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-lg border bg-card p-5">
          <h3 className="mb-4 text-sm font-semibold uppercase tracking-wide text-muted-foreground">{t("president_home.catalog.offer")}</h3>
          {corsi.length === 0 && pacchetti.length === 0 ? <div className="text-sm text-muted-foreground">{t("president_home.catalog.no_offer")}</div> : null}
          {corsi.map((c) => <RigaInfo key={testo(c.nome)} label={testo(c.nome)} value={t("president_home.catalog.course")} />)}
          {pacchetti.map((p) => <RigaInfo key={testo(p.id)} label={testo(p.nome)} value={t("president_home.catalog.package")} />)}
        </div>
        <div className="rounded-lg border bg-card p-5">
          <h3 className="mb-4 text-sm font-semibold uppercase tracking-wide text-muted-foreground">{t("president_home.catalog.sponsors")}</h3>
          {sponsor.length === 0 ? <div className="text-sm text-muted-foreground">{t("president_home.catalog.no_sponsors")}</div> : null}
          {sponsor.map((s) => <RigaInfo key={testo(s.id)} label={testo(s.nome_sponsor)} value={fmt_chf(numero(s.importo_annuo))} />)}
        </div>
      </div>
      <div className="rounded-lg border bg-card p-5">
        <h3 className="mb-4 text-sm font-semibold uppercase tracking-wide text-muted-foreground">{t("president_home.catalog.events")}</h3>
        {d.eventi.length === 0 ? <div className="text-sm text-muted-foreground">{t("president_home.catalog.no_events")}</div> : null}
        {d.eventi.map((e) => <RigaInfo key={testo(e.id)} label={testo(e.nome_evento)} value={t("president_home.catalog.event_value", { count: numero(e.partecipanti_stimati) })} />)}
      </div>
    </div>
  );
};

const AtletiShowcase: React.FC<{ d: DashboardData; t: (key: string, opts?: Record<string, unknown>) => string }> = ({ d, t }) => {
  const podi_by_atleta = new Map<string, number>();
  d.iscrizioni_gare.filter(is_podio).forEach((i) => {
    const atleta_id = testo(i.atleta_id);
    podi_by_atleta.set(atleta_id, (podi_by_atleta.get(atleta_id) ?? 0) + 1);
  });
  const showcase = d.atleti
    .filter((a) => booleano(a.attivo) && booleano(a.agonista))
    .sort((a, b) => (podi_by_atleta.get(testo(b.id)) ?? 0) - (podi_by_atleta.get(testo(a.id)) ?? 0))
    .slice(0, 8);

  return (
    <section className="mt-12">
      <h2 className="mb-5 text-2xl font-semibold text-foreground">{t("president_home.showcase.title")}</h2>
      {showcase.length === 0 ? (
        <StatoDati titolo={t("president_home.empty.title")} testo={t("president_home.showcase.empty")} />
      ) : (
        <div className="grid grid-cols-2 gap-4 rounded-lg border bg-card p-5 md:grid-cols-4">
          {showcase.map((a) => {
            const podi = podi_by_atleta.get(testo(a.id)) ?? 0;
            return (
              <div key={testo(a.id)} className="text-center">
                <FotoAtleta
                  foto_path={testo(a.foto_path)}
                  nome={testo(a.nome)}
                  cognome={testo(a.cognome)}
                  className="mx-auto h-20 w-20 rounded-full"
                  fallback={<div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-muted font-semibold text-muted-foreground">{initials(testo(a.nome), testo(a.cognome))}</div>}
                />
                <div className="mt-3 font-medium text-foreground">{testo(a.nome)} {testo(a.cognome)}</div>
                <div className="text-xs text-muted-foreground">{testo(a.livello_artistica) || testo(a.livello_attuale) || t("president_home.showcase.competitor")}</div>
                {podi > 0 ? <div className="mt-1 text-xs font-semibold text-amber-700">{t("president_home.showcase.podiums", { count: podi })}</div> : null}
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
};

const PresidentDashboard: React.FC = () => {
  const { t } = useTranslation("dashboard");
  const { session } = useAuth();
  const club_id = session?.club_id;
  const [stagione_id, set_stagione_id] = useState("");
  const [confronta, set_confronta] = useState(true);
  const [open_area, set_open_area] = useState<AreaId | null>(null);

  const stagioni_query = use_stagioni_presidente(club_id);
  const stagioni = stagioni_query.data ?? [];
  const stagioni_ord = useMemo(() => stagioni.slice().sort((a, b) => b.data_inizio.localeCompare(a.data_inizio)), [stagioni]);

  useEffect(() => {
    if (stagioni_ord.length === 0) {
      if (stagione_id) set_stagione_id("");
      return;
    }
    if (stagione_id && stagioni_ord.some((s) => s.id === stagione_id)) return;
    set_stagione_id((stagioni_ord.find((s) => s.attiva) ?? stagioni_ord[0]).id);
  }, [stagioni_ord, stagione_id]);

  const stagione = stagioni_ord.find((s) => s.id === stagione_id);
  const idx = stagioni_ord.findIndex((s) => s.id === stagione_id);
  const prev_stagione_id = idx >= 0 && idx + 1 < stagioni_ord.length ? stagioni_ord[idx + 1].id : null;
  const dashboard_query = use_presidente_dashboard(club_id, stagione_id || null, prev_stagione_id);

  use_segnala_query_error("PresidentDashboard", t("president_home.error.stagioni_operation"), stagioni_query.isError, stagioni_query.error);
  use_segnala_query_error("PresidentDashboard", t("president_home.error.dashboard_operation"), dashboard_query.isError, dashboard_query.error);

  if (!club_id) {
    return <MessaggioPagina titolo={t("president_home.no_club.title")} testo={t("president_home.no_club.text")} />;
  }

  if (stagioni_query.isPending) {
    return <Caricamento testo_loading={t("president_home.loading")} />;
  }

  if (stagioni_query.isError) {
    return (
      <MessaggioPagina
        errore
        titolo={t("president_home.error.title")}
        testo={t("president_home.error.text", { motivo: stagioni_query.error?.message ?? "" })}
        azione={<Button type="button" onClick={() => void stagioni_query.refetch()}>{t("president_home.retry")}</Button>}
      />
    );
  }

  if (stagioni_ord.length === 0) {
    return (
      <MessaggioPagina
        titolo={t("president_home.no_season.title")}
        testo={t("president_home.no_season.text")}
        azione={<Button asChild><a href="/stagioni">{t("president_home.no_season.link")}</a></Button>}
      />
    );
  }

  if (dashboard_query.isPending || !dashboard_query.data || !stagione) {
    return <Caricamento testo_loading={t("president_home.loading")} />;
  }

  if (dashboard_query.isError) {
    return (
      <MessaggioPagina
        errore
        titolo={t("president_home.error.title")}
        testo={t("president_home.error.text", { motivo: dashboard_query.error?.message ?? "" })}
        azione={<Button type="button" onClick={() => void dashboard_query.refetch()}>{t("president_home.retry")}</Button>}
      />
    );
  }

  const d = dashboard_query.data;
  const club_nome = session?.club_nome || t("president_home.club_fallback");
  const atleti_attivi = d.atleti.filter((a) => booleano(a.attivo));
  const livelli = riepilogo_livelli(atleti_attivi);
  const top_livelli = Object.entries(livelli).sort((a, b) => b[1] - a[1]).slice(0, 4).map(([label, value]) => ({ label, value }));
  const ricavi_curr = d.ricavi.filter((r) => testo(r.stagione_id) === stagione_id);
  const ricavi_prev = prev_stagione_id ? d.ricavi.filter((r) => testo(r.stagione_id) === prev_stagione_id) : [];
  const totale_ricavi = ricavi_curr.reduce((s, r) => s + numero(r.importo), 0);
  const totale_ricavi_prev = ricavi_prev.reduce((s, r) => s + numero(r.importo), 0);
  const ricavi_yoy = totale_ricavi_prev ? ((totale_ricavi - totale_ricavi_prev) / totale_ricavi_prev) * 100 : undefined;
  const storici_prev = prev_stagione_id ? d.storici.filter((s) => testo(s.stagione_id) === prev_stagione_id) : [];
  const atleti_yoy = storici_prev.length ? ((atleti_attivi.length - storici_prev.length) / storici_prev.length) * 100 : undefined;
  const bilancio = d.bilancio.find((b) => testo(b.stagione_id) === stagione_id);
  const cassa = bilancio ? numero(bilancio.cassa_finale) : null;
  const ore_row = d.ore_pista.find((o) => testo(o.stagione_id) === stagione_id);
  const ore_disponibili = ore_row ? numero(ore_row.ore_settimanali_totali) : null;
  const ore_usate = ore_row ? numero(ore_row.ore_settimanali_utilizzate) : null;
  const ore_richieste = ore_row ? numero(ore_row.ore_richieste_se_accettassimo_tutti) : null;
  const richieste_stagione = d.richieste_storiche.filter((r) => testo(r.stagione_id) === stagione_id);
  const lista_attesa = richieste_stagione.reduce((s, r) => s + numero(r.n_in_lista_attesa), 0);
  const totale_richieste = richieste_stagione.reduce((s, r) => s + numero(r.n_richieste_ricevute), 0);
  const totale_accettate = richieste_stagione.reduce((s, r) => s + numero(r.n_iscritti_accettati), 0);
  const ore_lavorate_totali = d.ore_lavorate.reduce((s, o) => s + numero(o.ore_corsi) + numero(o.ore_lezioni_private) + numero(o.ore_eventi) + numero(o.ore_amministrative), 0);
  const costo_variabile_istruttori = d.costi_istruttori.reduce((tot, c) => {
    const ore = d.ore_lavorate
      .filter((o) => testo(o.istruttore_id) === testo(c.istruttore_id))
      .reduce((s, o) => s + numero(o.ore_corsi) + numero(o.ore_lezioni_private) + numero(o.ore_eventi) + numero(o.ore_amministrative), 0);
    return tot + ore * numero(c.tariffa_oraria);
  }, 0);
  const lezioni_ore = d.lezioni_private.reduce((s, l) => s + numero(l.ore), 0);
  const lezioni_fatturato = d.lezioni_private.reduce((s, l) => s + numero(l.importo_pagato), 0);
  const gare_curr = d.gare.filter((g) => testo(g.stagione_id) === stagione_id);
  const gare_ids = new Set(gare_curr.map((g) => testo(g.id)));
  const iscrizioni_gare_curr = d.iscrizioni_gare.filter((i) => gare_ids.has(testo(i.gara_id)));
  const podi = iscrizioni_gare_curr.filter(is_podio).length;
  const anno_stagione = stagione_anno_inizio(stagione);
  const sponsor_attivi = d.sponsor.filter((s) => in_stagione_sponsor(s, anno_stagione));
  const sponsor_totale = sponsor_attivi.reduce((s, r) => s + numero(r.importo_annuo), 0);
  const donut_data = ricavi_curr
    .map((r) => ({ name: fonte_label(t, testo(r.fonte)), value: numero(r.importo), color: FONTE_COLOR[testo(r.fonte)] || FONTE_COLOR.altro }))
    .filter((r) => r.value > 0)
    .sort((a, b) => b.value - a.value);

  const aree: {
    id: AreaId;
    title: string;
    icon: React.ReactNode;
    main_kpi: string;
    sub_label: string;
    stato: StatoArea;
    drawer_content: React.ReactNode;
    mini: React.ReactNode;
  }[] = [
    {
      id: "domanda",
      title: t("president_home.areas.demand.title"),
      icon: <Snowflake className="h-4 w-4" />,
      main_kpi: fmt_int(lista_attesa),
      sub_label: t("president_home.cards.waiting_athletes"),
      stato: ore_row ? (lista_attesa > 0 ? "attenzione" : "positivo") : "mancante",
      mini: <MiniBarsHoriz empty_label={t("president_home.missing.short")} items={[
        { label: t("president_home.ice.available"), value: ore_disponibili ?? 0, color: AREA_STROKES.domanda },
        { label: t("president_home.ice.used"), value: ore_usate ?? 0, color: "hsl(var(--chart-2, var(--primary)))" },
        { label: t("president_home.cards.requested"), value: ore_richieste ?? 0, color: "hsl(var(--chart-4, var(--primary)))" },
      ]} />,
      drawer_content: <AreaGhiaccio d={d} stagione_id={stagione_id} t={t} />,
    },
    {
      id: "atleti",
      title: t("president_home.areas.athletes.title"),
      icon: <Users className="h-4 w-4" />,
      main_kpi: fmt_int(atleti_attivi.length),
      sub_label: t("president_home.cards.active_athletes"),
      stato: atleti_attivi.length > 0 ? "positivo" : "neutro",
      mini: <MiniPyramid items={top_livelli} empty_label={t("president_home.empty.short")} />,
      drawer_content: <AreaAtleti d={d} stagioni={stagioni_ord} stagione_id={stagione_id} prev_stagione_id={prev_stagione_id} confronta={confronta} t={t} />,
    },
    {
      id: "ricavi",
      title: t("president_home.areas.revenue.title"),
      icon: <CreditCard className="h-4 w-4" />,
      main_kpi: ricavi_curr.length === 0 ? "—" : fmt_chf(totale_ricavi),
      sub_label: ricavi_curr.length === 0 ? t("president_home.missing.short") : t("president_home.cards.total_season_revenue"),
      stato: ricavi_curr.length === 0 ? "mancante" : "neutro",
      mini: <MiniDonut data={donut_data} empty_label={t("president_home.missing.short")} />,
      drawer_content: <AreaRicavi d={d} stagione_id={stagione_id} prev_stagione_id={prev_stagione_id} confronta={confronta} t={t} />,
    },
    {
      id: "costi",
      title: t("president_home.areas.costs.title"),
      icon: <Briefcase className="h-4 w-4" />,
      main_kpi: fmt_int(d.costi_istruttori.length),
      sub_label: t("president_home.cards.instructors", { count: d.costi_istruttori.length }),
      stato: d.costi_istruttori.length === 0 ? "mancante" : "neutro",
      mini: <MiniBarsVert items={d.costi_istruttori.slice(0, 3).map((c) => {
        const istruttore = d.istruttori.find((i) => testo(i.id) === testo(c.istruttore_id));
        return { label: testo(istruttore?.nome) || "—", value: numero(c.tariffa_oraria) };
      })} empty_label={t("president_home.missing.short")} />,
      drawer_content: <AreaIstruttori d={d} t={t} />,
    },
    {
      id: "lezioni",
      title: t("president_home.areas.private.title"),
      icon: <Clock className="h-4 w-4" />,
      main_kpi: d.lezioni_private.length === 0 ? "—" : fmt_chf(lezioni_fatturato),
      sub_label: d.lezioni_private.length === 0 ? t("president_home.empty.short") : t("president_home.cards.private_hours", { count: fmt_int(lezioni_ore) }),
      stato: d.lezioni_private.length === 0 ? "neutro" : "positivo",
      mini: <MiniBarsHoriz empty_label={t("president_home.empty.short")} items={[
        { label: t("president_home.private.lessons_sold"), value: d.lezioni_private.length, color: AREA_STROKES.lezioni },
        { label: t("president_home.private.hours_sold_label"), value: lezioni_ore, color: "hsl(var(--chart-4, var(--primary)))" },
      ]} />,
      drawer_content: <AreaLezioni d={d} t={t} />,
    },
    {
      id: "sportivo",
      title: t("president_home.areas.sportivo.title"),
      icon: <Trophy className="h-4 w-4" />,
      main_kpi: fmt_int(podi),
      sub_label: t("president_home.cards.podiums_in_competitions", { podi, gare: gare_curr.length }),
      stato: gare_curr.length === 0 ? "neutro" : "positivo",
      mini: <MiniBarsHoriz empty_label={t("president_home.empty.short")} items={[
        { label: t("president_home.sport.competitions"), value: gare_curr.length, color: AREA_STROKES.sportivo },
        { label: t("president_home.sport.entries"), value: iscrizioni_gare_curr.length, color: "hsl(var(--chart-3, var(--primary)))" },
        { label: t("president_home.sport.podiums"), value: podi, color: "hsl(var(--chart-4, var(--primary)))" },
      ]} />,
      drawer_content: <AreaSport d={d} stagione_id={stagione_id} prev_stagione_id={prev_stagione_id} t={t} />,
    },
    {
      id: "catalogo",
      title: t("president_home.areas.catalogo.title"),
      icon: <Megaphone className="h-4 w-4" />,
      main_kpi: fmt_int(sponsor_attivi.length),
      sub_label: t("president_home.cards.sponsor_value", { importo: fmt_chf(sponsor_totale) }),
      stato: sponsor_attivi.length === 0 ? "neutro" : "positivo",
      mini: <MiniBarsHoriz empty_label={t("president_home.empty.short")} items={[
        { label: t("president_home.catalog.active_sponsors"), value: sponsor_attivi.length, color: AREA_STROKES.catalogo },
        { label: t("president_home.catalog.open_events"), value: d.eventi.length, color: "hsl(var(--chart-2, var(--primary)))" },
        { label: t("president_home.catalog.searching"), value: d.sponsor_cercati.length, color: "hsl(var(--chart-4, var(--primary)))" },
      ]} />,
      drawer_content: <AreaCatalogo d={d} club_nome={club_nome} sponsor={sponsor_attivi} t={t} />,
    },
  ];

  const area_aperta = open_area ? aree.find((a) => a.id === open_area) : null;
  const saluto = (() => {
    const h = new Date().getHours();
    if (h < 12) return t("president_home.greet.morning");
    if (h < 18) return t("president_home.greet.afternoon");
    return t("president_home.greet.evening");
  })();

  return (
    <div className="min-h-screen bg-background">
      <div className="sticky top-0 z-30 border-b bg-background/95 backdrop-blur">
        <div className="mx-auto flex max-w-[1400px] items-center justify-between gap-4 px-6 py-4 md:px-10">
          <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{t("president_home.kicker")}</div>
          <div className="flex items-center gap-3">
            <Select value={stagione_id} onValueChange={set_stagione_id}>
              <SelectTrigger className="h-9 min-w-[150px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {stagioni_ord.map((s) => <SelectItem key={s.id} value={s.id}>{s.nome}</SelectItem>)}
              </SelectContent>
            </Select>
            <label className="hidden items-center gap-2 text-xs text-muted-foreground sm:flex">
              <Switch checked={confronta} onCheckedChange={set_confronta} />
              <span>{t("president_home.compare_last_year_short")}</span>
            </label>
          </div>
        </div>
      </div>

      <main className="mx-auto max-w-[1400px] px-6 py-10 md:px-10 md:py-14">
        <div className="mb-8"><OnboardingBanner /></div>
        <header>
          <div className="text-sm font-medium text-primary">{t("president_home.analysis_of", { club: club_nome })}</div>
          <h1 className="mt-2 text-4xl font-semibold tracking-tight text-foreground md:text-5xl">
            {saluto}, {session?.nome || t("president_home.role_fallback")}.
          </h1>
          <p className="mt-4 max-w-3xl text-base leading-relaxed text-muted-foreground md:text-lg">
            {t("president_home.hero", { stagione: stagione.nome, club: club_nome })}
          </p>
          <div className="mt-6 flex flex-wrap gap-3">
            <Button asChild>
              <a href="/presidente/relazione"><FileDown className="mr-2 h-4 w-4" />{t("president_home.report_link")}</a>
            </Button>
            <Button asChild variant="outline">
              <a href="/presidente/relazione/contenuti">{t("president_home.report_content_link")}</a>
            </Button>
          </div>
          <div className="mt-8 grid gap-4 md:grid-cols-4">
            <ValoreGrande label={t("president_home.stats.total_athletes")} value={fmt_int(atleti_attivi.length)} delta={confronta ? atleti_yoy : undefined} />
            <ValoreGrande label={t("president_home.stats.revenue")} value={ricavi_curr.length === 0 ? "—" : fmt_chf(totale_ricavi)} delta={confronta ? ricavi_yoy : undefined} />
            <ValoreGrande label={t("president_home.stats.cash_balance")} value={cassa === null ? "—" : fmt_chf(cassa)} tono={cassa === null ? "base" : cassa >= 0 ? "positivo" : "pericolo"} />
            <ValoreGrande label={t("president_home.stats.waiting_list")} value={fmt_int(lista_attesa)} tono={lista_attesa > 0 ? "attenzione" : "base"} />
          </div>
        </header>

        <StatoSegreteria d={d} t={t} />

        <section className="mt-10 grid gap-5 md:grid-cols-2 xl:grid-cols-3">
          {aree.map((area) => (
            <AreaCard
              key={area.id}
              id_area={area.id}
              title={area.title}
              icon={area.icon}
              main_kpi={area.main_kpi}
              sub_label={area.sub_label}
              stato={area.stato}
              stato_label={t(`president_home.state.${area.stato}`)}
              link_label={t("president_home.open_area")}
              on_open={() => set_open_area(area.id)}
            >
              {area.mini}
            </AreaCard>
          ))}
        </section>

        <AtletiShowcase d={d} t={t} />

        <div className="mt-10 rounded-lg border bg-card p-4 text-sm text-muted-foreground">
          <AlertTriangle className="mr-2 inline h-4 w-4 align-[-2px] text-amber-700" />
          {t("president_home.disclaimer")}
        </div>
      </main>

      <Sheet open={!!open_area} onOpenChange={(open) => !open && set_open_area(null)}>
        <SheetContent side="right" className="w-full overflow-y-auto p-0 sm:max-w-none sm:w-[62vw]">
          {area_aperta ? (
            <div className="flex min-h-full flex-col">
              <div className="border-b px-8 py-8 md:px-10">
                <div className="mb-3 flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                  <span className={`flex h-8 w-8 items-center justify-center rounded-md text-primary-foreground ${AREA_ACCENTS[area_aperta.id]}`}>{area_aperta.icon}</span>
                  {area_aperta.title}
                </div>
                <h2 className="text-3xl font-semibold text-foreground">{area_aperta.title}</h2>
                <p className="mt-2 text-sm text-muted-foreground">{t(`president_home.areas.${area_aperta.id}.sub`)}</p>
              </div>
              <div className="flex-1 px-8 py-8 md:px-10">{area_aperta.drawer_content}</div>
              <div className="sticky bottom-0 flex items-center justify-between gap-4 border-t bg-background px-8 py-5 md:px-10">
                <Button type="button" variant="outline" onClick={() => set_open_area(null)}>{t("president_home.close")}</Button>
                <Button asChild>
                  <a href={AREA_PATHS[area_aperta.id]}>{t("president_home.open_area")}</a>
                </Button>
              </div>
            </div>
          ) : null}
        </SheetContent>
      </Sheet>
    </div>
  );
};

export default PresidentDashboard;
