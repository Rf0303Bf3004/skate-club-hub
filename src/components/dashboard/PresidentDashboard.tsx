import React, { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { ArrowDown, ArrowRight, ArrowUp, ChevronRight, FileWarning, Inbox, Trophy } from "lucide-react";
import {
  use_atleti,
  use_fatture,
  use_gare,
  use_stagioni,
  use_richieste_iscrizione,
} from "@/hooks/use-supabase-data";
import { useAuth } from "@/lib/auth";
import { supabase, get_current_club_id } from "@/lib/supabase";

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
  "Stelline 4": 7,
  "Stellina 3": 8,
  "Stelline 3": 8,
  "Stellina 2": 9,
  "Stelline 2": 9,
  "Stellina 1": 10,
  "Stelline 1": 10,
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

// ─── Count-up animato ────────────────────────────────────────────────
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

const NumeroGrosso: React.FC<{ value: number; format?: (n: number) => string; className?: string }> = ({
  value,
  format = format_int,
  className = "",
}) => {
  const v = useCountUp(value);
  return (
    <span className={`tabular-nums tracking-tight ${className}`}>{format(v)}</span>
  );
};

// ─── Sparkline SVG semplice ───────────────────────────────────────────
const Sparkline: React.FC<{ values: number[]; className?: string }> = ({ values, className = "" }) => {
  if (!values || values.length < 2) {
    return <div className={`h-10 w-full ${className}`} />;
  }
  const w = 200;
  const h = 40;
  const max = Math.max(...values, 1);
  const min = Math.min(...values, 0);
  const range = max - min || 1;
  const pts = values.map((v, i) => {
    const x = (i / (values.length - 1)) * w;
    const y = h - ((v - min) / range) * h;
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  });
  const d = `M ${pts.join(" L ")}`;
  const area = `${d} L ${w},${h} L 0,${h} Z`;
  return (
    <svg viewBox={`0 0 ${w} ${h}`} className={`w-full h-10 ${className}`} preserveAspectRatio="none">
      <defs>
        <linearGradient id="spark-grad" x1="0" x2="0" y1="0" y2="1">
          <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity="0.18" />
          <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={area} fill="url(#spark-grad)" />
      <path d={d} fill="none" stroke="hsl(var(--primary))" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
};

// ─── Progress circolare ───────────────────────────────────────────────
const ProgressCircle: React.FC<{ value: number; size?: number; stroke?: number }> = ({
  value,
  size = 88,
  stroke = 8,
}) => {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const animated = useCountUp(value, 1200);
  const offset = c - (Math.min(100, Math.max(0, animated)) / 100) * c;
  return (
    <svg width={size} height={size} className="-rotate-90">
      <circle cx={size / 2} cy={size / 2} r={r} stroke="hsl(var(--muted))" strokeWidth={stroke} fill="none" />
      <circle
        cx={size / 2}
        cy={size / 2}
        r={r}
        stroke="hsl(var(--primary))"
        strokeWidth={stroke}
        strokeLinecap="round"
        fill="none"
        strokeDasharray={c}
        strokeDashoffset={offset}
        style={{ transition: "stroke-dashoffset 200ms linear" }}
      />
    </svg>
  );
};

// ─── Variazione (delta) ──────────────────────────────────────────────
const DeltaPill: React.FC<{ delta: number; suffix?: string }> = ({ delta, suffix = "" }) => {
  if (delta === 0 || Number.isNaN(delta)) {
    return (
      <span className="inline-flex items-center gap-1 text-xs font-medium text-muted-foreground">
        <ArrowRight className="h-3 w-3" /> 0{suffix}
      </span>
    );
  }
  const positive = delta > 0;
  return (
    <span
      className={`inline-flex items-center gap-1 text-xs font-medium ${
        positive ? "text-emerald-600" : "text-rose-600"
      }`}
    >
      {positive ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />}
      {positive ? "+" : ""}
      {delta}
      {suffix}
    </span>
  );
};

// ─── Card morbida ─────────────────────────────────────────────────────
const SoftCard: React.FC<React.HTMLAttributes<HTMLDivElement>> = ({ className = "", children, ...rest }) => (
  <div
    {...rest}
    className={`rounded-3xl bg-card border border-border/40 shadow-[0_1px_2px_rgba(15,23,42,0.04),0_8px_24px_-12px_rgba(15,23,42,0.08)] transition-all duration-300 hover:-translate-y-0.5 hover:shadow-[0_2px_4px_rgba(15,23,42,0.05),0_16px_40px_-16px_rgba(15,23,42,0.12)] ${className}`}
  >
    {children}
  </div>
);

// ─── Mini barra piramide ─────────────────────────────────────────────
const PiramideMini: React.FC<{ items: { label: string; value: number }[] }> = ({ items }) => {
  const max = Math.max(...items.map((i) => i.value), 1);
  return (
    <div className="space-y-2">
      {items.map((i) => (
        <div key={i.label} className="flex items-center gap-3">
          <div className="text-[11px] uppercase tracking-wider text-muted-foreground w-14 shrink-0">{i.label}</div>
          <div className="flex-1 h-1.5 rounded-full bg-muted overflow-hidden">
            <div
              className="h-full rounded-full bg-primary/70 transition-all duration-700"
              style={{ width: `${(i.value / max) * 100}%` }}
            />
          </div>
          <div className="text-xs font-medium tabular-nums text-foreground/80 w-8 text-right">{i.value}</div>
        </div>
      ))}
    </div>
  );
};

// ─── Componente principale ──────────────────────────────────────────
const PresidentDashboard: React.FC = () => {
  const { session } = useAuth();
  const navigate = useNavigate();

  const { data: atleti = [], isLoading: l_atleti } = use_atleti();
  const { data: fatture = [], isLoading: l_fatture } = use_fatture();
  const { data: gare = [], isLoading: l_gare } = use_gare();
  const { data: stagioni = [] } = use_stagioni();
  const { data: richieste = [] } = use_richieste_iscrizione();

  const club_id = get_current_club_id();

  // Stagione corrente e precedente
  const today_iso = new Date().toISOString().split("T")[0];
  const stagione_corr = useMemo(
    () =>
      stagioni.find((s: any) => s.attiva) ||
      stagioni.find((s: any) => today_iso >= s.data_inizio && today_iso <= s.data_fine) ||
      stagioni[0] ||
      null,
    [stagioni, today_iso],
  );
  const stagione_prec = useMemo(() => {
    if (!stagione_corr) return null;
    const sorted = [...stagioni]
      .filter((s: any) => s.data_fine < stagione_corr.data_inizio)
      .sort((a: any, b: any) => (a.data_inizio < b.data_inizio ? 1 : -1));
    return sorted[0] || null;
  }, [stagioni, stagione_corr]);

  // Test livello (per stagione corrente)
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

  // Adesioni per ritenzione
  const { data: ritenzione_data } = useQuery({
    enabled: !!club_id && !!stagione_corr,
    queryKey: ["pres_ritenzione", club_id, stagione_corr?.id, stagione_prec?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("adesioni_atleta")
        .select("atleta_id, stagione_id, stato")
        .eq("club_id", club_id);
      if (error) throw error;
      const corr_atleti = new Set(
        (data || [])
          .filter((a: any) => a.stagione_id === stagione_corr?.id && a.stato === "attiva")
          .map((a: any) => a.atleta_id),
      );
      const prec_atleti = new Set(
        (data || [])
          .filter((a: any) => stagione_prec && a.stagione_id === stagione_prec.id)
          .map((a: any) => a.atleta_id),
      );
      let ritornati = 0;
      prec_atleti.forEach((id) => {
        if (corr_atleti.has(id)) ritornati++;
      });
      const tasso = prec_atleti.size > 0 ? Math.round((ritornati / prec_atleti.size) * 100) : 0;
      return {
        atleti_corr: corr_atleti.size,
        atleti_prec: prec_atleti.size,
        tasso,
      };
    },
  });

  // ─── Atleti attivi e ripartizione categorie ─────────────────
  const atleti_attivi = useMemo(() => atleti.filter((a: any) => a.attivo), [atleti]);
  const ripartizione = useMemo(() => {
    const r = { Pulcini: 0, Amatori: 0, Artistica: 0, Stile: 0 };
    atleti_attivi.forEach((a: any) => {
      const cat = (a.categoria || "").toLowerCase();
      if (a.livello_artistica || a.carriera_artistica) r.Artistica++;
      else if (a.livello_stile || a.carriera_stile) r.Stile++;
      else if (cat === "amatori" || a.livello_amatori) r.Amatori++;
      else r.Pulcini++;
    });
    return r;
  }, [atleti_attivi]);

  const delta_atleti = ritenzione_data
    ? (ritenzione_data.atleti_corr || atleti_attivi.length) - (ritenzione_data.atleti_prec || 0)
    : 0;

  // ─── Finanze ────────────────────────────────────────────────
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
  const totale_attese = incassato + da_incassare + scaduto;
  const ratio_scaduto = totale_attese > 0 ? scaduto / totale_attese : 0;

  // Sparkline ultimi 3 mesi (incassi mensili pagati)
  const sparkline_finanze = useMemo(() => {
    const now = new Date();
    const buckets: number[] = [];
    for (let i = 11; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      const sum = fatture
        .filter((f: any) => f.pagata && (f.data_pagamento || f.data_emissione || "").startsWith(key))
        .reduce((s: number, f: any) => s + (Number(f.importo) || 0), 0);
      buckets.push(sum);
    }
    return buckets;
  }, [fatture]);

  // ─── Sportivo ───────────────────────────────────────────────
  const tasso_superamento =
    test_data && test_data.sostenuti > 0
      ? Math.round((test_data.superati / test_data.sostenuti) * 100)
      : 0;

  const gare_stagione = useMemo(() => {
    if (!stagione_corr) return gare;
    return gare.filter(
      (g: any) =>
        g.data && g.data >= stagione_corr.data_inizio && g.data <= stagione_corr.data_fine,
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

  // ─── Attenzioni ─────────────────────────────────────────────
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
      label: `${richieste_vecchie} ${richieste_vecchie === 1 ? "richiesta iscrizione in attesa" : "richieste iscrizione in attesa"} da oltre 7 giorni`,
      action: () => navigate("/richieste-iscrizione"),
      cta: "Esamina",
    },
    licenze_in_scadenza > 0 && {
      icon: FileWarning,
      label: `${licenze_in_scadenza} ${licenze_in_scadenza === 1 ? "licenza federale in scadenza" : "licenze federali in scadenza"} entro 60 giorni`,
      action: () => navigate("/atleti"),
      cta: "Verifica atleti",
    },
  ].filter(Boolean) as { icon: any; label: string; action: () => void; cta: string }[];

  // ─── Vetrina atleti ─────────────────────────────────────────
  const atleti_vetrina = useMemo(() => {
    type Item = { atleta: any; medaglie: number; ultimo_risultato: string | null; rank: number };
    const map = new Map<string, Item>();
    atleti_attivi.forEach((a: any) => {
      if (!a.atleta_federazione && !(a.livello_artistica || a.carriera_artistica || a.livello_stile || a.carriera_stile)) return;
      map.set(a.id, { atleta: a, medaglie: 0, ultimo_risultato: null, rank: get_livello_rank(a) });
    });
    // calcola medaglie + ultimo risultato
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

  // ─── Saluto ────────────────────────────────────────────────
  const ora = new Date().getHours();
  const saluto = ora < 6 ? "Buonanotte" : ora < 13 ? "Buongiorno" : ora < 19 ? "Buon pomeriggio" : "Buonasera";
  const data_lunga = new Intl.DateTimeFormat("it-CH", {
    weekday: "long",
    day: "numeric",
    month: "long",
  }).format(new Date());

  const nome_pres = session?.nome || "Presidente";

  // ─── Frase del giorno ─────────────────────────────────────
  const can_build_frase = atleti_attivi.length > 0;
  const stagione_label = stagione_corr?.nome || "questa stagione";

  if (l_atleti || l_fatture || l_gare) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="h-8 w-8 animate-spin rounded-full border-b-2 border-primary" />
      </div>
    );
  }

  return (
    <div className="animate-fade-in -mx-4 sm:-mx-6 lg:-mx-8 -mt-6">
      {/* ZONA 1 — Saluto */}
      <section className="px-6 sm:px-12 lg:px-24 pt-12 pb-12 sm:pt-16 sm:pb-16">
        <p className="text-sm uppercase tracking-[0.2em] text-muted-foreground mb-3">
          {data_lunga}
        </p>
        <h1 className="font-serif text-3xl sm:text-4xl lg:text-5xl font-light text-foreground tracking-tight">
          {saluto}, <span className="font-normal">{nome_pres}</span>.
        </h1>
        {can_build_frase && (
          <p className="mt-6 max-w-3xl font-serif text-xl sm:text-2xl leading-relaxed text-muted-foreground">
            Il club conta{" "}
            <span className="font-semibold text-primary">{format_int(atleti_attivi.length)}</span> atleti attivi
            {ritenzione_data && stagione_prec ? (
              <>
                {" "}
                (<span className={delta_atleti >= 0 ? "text-emerald-600 font-medium" : "text-rose-600 font-medium"}>
                  {delta_atleti >= 0 ? "+" : ""}
                  {delta_atleti}
                </span>{" "}
                sulla stagione scorsa)
              </>
            ) : null}
            {incassato > 0 ? (
              <>
                {" "}
                e ha incassato <span className="font-semibold text-foreground">{format_chf(incassato)}</span> di quote
                in {stagione_label}.
              </>
            ) : (
              <>{" in "}{stagione_label}.</>
            )}
          </p>
        )}
      </section>

      {/* ZONA 2 — Salute del club */}
      <section className="px-6 sm:px-12 lg:px-24 pb-16">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* CARD 1 — ATLETI */}
          <SoftCard className="p-8 flex flex-col">
            <div className="text-xs uppercase tracking-wider text-muted-foreground mb-6">Atleti attivi</div>
            <div className="flex items-baseline gap-3 mb-1">
              <NumeroGrosso
                value={atleti_attivi.length}
                className="text-6xl lg:text-7xl font-light text-foreground"
              />
              {ritenzione_data && stagione_prec && <DeltaPill delta={delta_atleti} />}
            </div>
            <div className="mt-8">
              <PiramideMini
                items={[
                  { label: "Pulcini", value: ripartizione.Pulcini },
                  { label: "Amatori", value: ripartizione.Amatori },
                  { label: "Artistica", value: ripartizione.Artistica },
                  { label: "Stile", value: ripartizione.Stile },
                ]}
              />
            </div>
            {ritenzione_data && stagione_prec ? (
              <div className="mt-6 pt-6 border-t border-border/40 text-xs text-muted-foreground">
                Ritenzione stagione su stagione{" "}
                <span className="text-foreground font-medium">{ritenzione_data.tasso}%</span>
              </div>
            ) : (
              <div className="mt-6 pt-6 border-t border-border/40 text-xs text-muted-foreground">
                Ritenzione disponibile dalla prossima stagione
              </div>
            )}
          </SoftCard>

          {/* CARD 2 — FINANZE */}
          <SoftCard className="p-8 flex flex-col">
            <div className="text-xs uppercase tracking-wider text-muted-foreground mb-6">Finanze</div>
            <div className="space-y-4">
              <div>
                <div className="text-[11px] uppercase tracking-wider text-muted-foreground/70">Incassato</div>
                <NumeroGrosso
                  value={incassato}
                  format={format_chf}
                  className="text-4xl font-light text-foreground"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <div className="text-[11px] uppercase tracking-wider text-muted-foreground/70">Da incassare</div>
                  <NumeroGrosso
                    value={da_incassare}
                    format={format_chf}
                    className="text-xl font-medium text-foreground/80"
                  />
                </div>
                <div>
                  <div className="text-[11px] uppercase tracking-wider text-muted-foreground/70">Scaduto</div>
                  <NumeroGrosso
                    value={scaduto}
                    format={format_chf}
                    className={`text-xl font-medium ${ratio_scaduto >= 0.6 ? "text-rose-600" : "text-foreground/80"}`}
                  />
                </div>
              </div>
            </div>
            <div className="mt-6">
              <Sparkline values={sparkline_finanze} />
            </div>
            <div className="mt-4 text-xs text-muted-foreground">
              {stagione_corr?.nome || "Stagione corrente"}
            </div>
          </SoftCard>

          {/* CARD 3 — SPORTIVO */}
          <SoftCard className="p-8 flex flex-col">
            <div className="text-xs uppercase tracking-wider text-muted-foreground mb-6">Risultati sportivi</div>
            <div className="flex items-center gap-6">
              <div className="relative">
                <ProgressCircle value={tasso_superamento} />
                <div className="absolute inset-0 flex items-center justify-center">
                  <NumeroGrosso
                    value={tasso_superamento}
                    format={(n) => `${Math.round(n)}%`}
                    className="text-2xl font-medium text-foreground"
                  />
                </div>
              </div>
              <div className="flex-1">
                <div className="text-xs text-muted-foreground">Tasso di superamento test</div>
                {test_data ? (
                  <div className="text-sm text-foreground/80 mt-1 tabular-nums">
                    {test_data.superati} superati / {test_data.sostenuti} sostenuti
                  </div>
                ) : (
                  <div className="text-sm text-muted-foreground mt-1">Dato non disponibile</div>
                )}
              </div>
            </div>
            <div className="mt-8 grid grid-cols-2 gap-4 pt-6 border-t border-border/40">
              <div>
                <div className="text-[11px] uppercase tracking-wider text-muted-foreground/70">Gare disputate</div>
                <NumeroGrosso value={gare_disputate} className="text-2xl font-light text-foreground" />
              </div>
              <div>
                <div className="text-[11px] uppercase tracking-wider text-muted-foreground/70">Podi</div>
                <div className="flex items-center gap-2">
                  <Trophy className="h-4 w-4 text-primary/70" />
                  <NumeroGrosso value={podi} className="text-2xl font-light text-foreground" />
                </div>
              </div>
            </div>
          </SoftCard>
        </div>
      </section>

      {/* ZONA 3 — Attenzioni */}
      {attenzioni.length > 0 && (
        <section className="px-6 sm:px-12 lg:px-24 pb-16">
          <div className="text-xs uppercase tracking-[0.2em] text-muted-foreground mb-4">Attenzioni</div>
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
        <section className="px-6 sm:px-12 lg:px-24 pb-24">
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
    </div>
  );
};

export default PresidentDashboard;
