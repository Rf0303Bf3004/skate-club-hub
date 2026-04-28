import React, { useState, useMemo } from "react";
import { useI18n } from "@/lib/i18n";
import { fmt_date_long, locale_to_bcp47 } from "@/lib/format-data";
import { useNavigate } from "react-router-dom";
import {
  use_atleti,
  use_corsi,
  use_gare,
  use_comunicazioni,
  use_fatture,
  use_istruttori,
  use_club,
  use_presenze,
  use_lezioni_private,
  use_atleti_monitori,
  use_setup_club,
  get_istruttore_name_from_list,
} from "@/hooks/use-supabase-data";
import { use_segna_presenza, use_elimina_presenza, use_crea_comunicazione } from "@/hooks/use-supabase-mutations";
import { calculate_age, days_until } from "@/lib/mock-data";
import {
  Users,
  BookOpen,
  Trophy,
  CreditCard,
  TrendingUp,
  MessageSquare,
  XCircle,
  Clock,
  Wifi,
  ChevronDown,
  ChevronUp,
  Gift,
  AlertTriangle,
  Send,
  MessageCircle,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "@/hooks/use-toast";
import { supabase, get_current_club_id } from "@/lib/supabase";
import { useQuery } from "@tanstack/react-query";
import IstruttoriDisponibiliWidget from "@/components/dashboard/IstruttoriDisponibiliWidget";
import MedagliereWidget from "@/components/MedagliereWidget";
import {
  RichiesteIscrizioneWidget,
  UltimeIscrizioniWidget,
  RichiesteLezioniPrivateWidget,
} from "@/components/dashboard/RichiesteIscrizioneWidget";

// ─── Helpers ──────────────────────────────────────────────
function normalize_giorno(value?: string): string {
  return (value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase();
}

function match_giorno(giorno_db: string, today_key: string): boolean {
  return normalize_giorno(giorno_db) === normalize_giorno(today_key);
}

function get_slots_giorno(disponibilita: Record<string, any[]>, today_key: string): any[] {
  const key = Object.keys(disponibilita).find((k) => normalize_giorno(k) === normalize_giorno(today_key));
  return key ? disponibilita[key] : [];
}

function to_date_key(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function add_days(date: string, days: number): string {
  const d = new Date(date + "T00:00:00");
  d.setDate(d.getDate() + days);
  return to_date_key(d);
}

function get_giorno_key(date: string): string {
  const keys = ["domenica", "lunedì", "martedì", "mercoledì", "giovedì", "venerdì", "sabato"];
  return keys[new Date(date + "T00:00:00").getDay()];
}

function format_data_breve(date: string): string {
  return new Date(date + "T00:00:00").toLocaleDateString("de-CH", { weekday: "short", day: "numeric", month: "short" });
}

// ─── Hook template comunicazioni ──────────────────────────
function use_template_comunicazioni() {
  return useQuery({
    queryKey: ["comunicazioni_template", get_current_club_id()],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("comunicazioni_template")
        .select("*")
        .eq("club_id", get_current_club_id())
        .order("nome");
      if (error) throw error;
      return data ?? [];
    },
  });
}

// ─── KPI Card ─────────────────────────────────────────────
const KPICard: React.FC<{
  title: string;
  value: string;
  icon: React.ReactNode;
  trend?: string;
  highlight?: boolean;
  subtitle?: string;
}> = ({ title, value, icon, trend, highlight, subtitle }) => (
  <div
    className={`rounded-xl shadow-card p-5 bg-card transition-shadow hover:shadow-card-hover ${highlight ? "ring-1 ring-accent/30" : ""}`}
  >
    <div className="flex items-start justify-between">
      <div className="space-y-1">
        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">{title}</p>
        <p className="text-2xl font-bold tracking-tight tabular-nums text-foreground">{value}</p>
        {subtitle && <p className="text-xs text-muted-foreground">{subtitle}</p>}
      </div>
      <div className="w-10 h-10 rounded-lg bg-primary/5 flex items-center justify-center text-primary">{icon}</div>
    </div>
    {trend && (
      <div className="mt-3 flex items-center gap-1 text-xs font-medium text-success">
        <TrendingUp className="w-3 h-3" />
        {trend}
      </div>
    )}
  </div>
);

// ─── Card corso del giorno ─────────────────────────────────
const CorsoCard: React.FC<{
  corso: any;
  atleti: any[];
  monitori: any[];
  istruttori: any[];
  presenze: any[];
  presenze_corso: any[];
  data: string;
  on_segna: (atleta_id: string, riferimento_id: string) => void;
  on_segna_istr: (id: string) => void;
  loading: boolean;
  }> = ({ corso, atleti, monitori, istruttori, presenze, presenze_corso, data, on_segna, on_segna_istr, loading }) => {
  const [expanded, set_expanded] = useState(false);

  // Stato corso basato sull'orario corrente (solo per oggi)
  const is_today = data === to_date_key(new Date());
  const is_past = data < to_date_key(new Date());
  const adesso = new Date();
  const min_ora = adesso.getHours() * 60 + adesso.getMinutes();
  const [hi, mi] = (corso.ora_inizio || "00:00").split(":").map(Number);
  const [hf, mf] = (corso.ora_fine || "23:59").split(":").map(Number);
  const min_inizio = hi * 60 + mi;
  const min_fine = hf * 60 + mf;

  let stato_corso: "terminato" | "in_corso" | "presto" | "futuro";
  let bloccato: boolean;

  if (is_past) {
    stato_corso = "terminato";
    bloccato = true;
  } else if (!is_today) {
    stato_corso = "futuro";
    bloccato = true;
  } else {
    const non_iniziato = min_inizio > min_ora;
    const terminato = min_fine <= min_ora;
    const presto = non_iniziato && (min_inizio - min_ora) <= 30;
    bloccato = non_iniziato || terminato;
    stato_corso = terminato ? "terminato" : (!non_iniziato ? "in_corso" : presto ? "presto" : "futuro");
  }
  const atleti_corso = atleti.filter((a) => corso.atleti_ids?.includes(a.id));
  const presenti_atleti = atleti_corso.filter((a) =>
    presenze.some((p) => p.persona_id === a.id && p.riferimento_id === corso.id && !p.ora_uscita),
  );

  const monitori_assegnati = monitori.filter(
    (m) => (corso.monitori || []).includes(m.id) || (corso.aiuto_monitori || []).includes(m.id),
  );

  const istruttori_corso = istruttori.filter((i) => corso.istruttori_ids?.includes(i.id));

  const get_stato_monitore = (id: string) => {
    const p = presenze_corso.find((x) => x.persona_id === id && x.corso_id === corso.id);
    return p?.stato || "attesa";
  };

  // WhatsApp remind per monitore
  const genera_wa_monitore = (persona: any) => {
    const tel = persona.genitore1_telefono || "";
    if (!tel) return null;
    const tipo = (corso.monitori || []).includes(persona.id) ? "monitore" : "aiuto monitore";
    const data_fmt = new Date(data + "T00:00:00").toLocaleDateString("de-CH", {
      weekday: "long",
      day: "numeric",
      month: "long",
    });
    const msg = encodeURIComponent(
      `Ciao ${persona.nome}! 👋\nTi ricordiamo che hai il corso *${corso.nome}* come ${tipo} il ${data_fmt} dalle ${corso.ora_inizio?.slice(0, 5)} alle ${corso.ora_fine?.slice(0, 5)}.\nConfermi la presenza? Grazie! ⛸️`,
    );
    const tel_clean = tel.replace(/\s+/g, "").replace(/^0/, "+41");
    return `https://wa.me/${tel_clean}?text=${msg}`;
  };

  const stato_color = (stato: string) => {
    if (stato === "confermato") return "text-success";
    if (stato === "assente") return "text-destructive";
    return "text-orange-500";
  };

  const stato_label = (stato: string) => {
    if (stato === "confermato") return "✅";
    if (stato === "assente") return "❌";
    return "⏳";
  };

  return (
    <div className={"rounded-xl overflow-hidden border border-border/50 border-l-4 " + (stato_corso === "in_corso" ? "border-l-green-500 bg-green-50/30" : stato_corso === "presto" ? "border-l-amber-400 bg-amber-50/20" : stato_corso === "terminato" ? "border-l-gray-400 bg-muted/20" : "border-l-gray-300")}>
      <div
        className="flex items-center gap-3 p-3 cursor-pointer hover:bg-muted/30 transition-colors"
        onClick={() => set_expanded((e) => !e)}
      >
        <div className="text-center w-12 flex-shrink-0">
          <p className="text-xs font-bold tabular-nums text-primary">{corso.ora_inizio?.slice(0, 5)}</p>
          <p className="text-[10px] text-muted-foreground">{corso.ora_fine?.slice(0, 5)}</p>
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-foreground">{corso.nome}
                  {stato_corso === "in_corso" && <span className="ml-2 text-[10px] font-bold px-2 py-0.5 rounded-full bg-green-100 text-green-700">In corso</span>}
                  {stato_corso === "presto" && <span className="ml-2 text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-100 text-amber-700">Inizia fra {min_inizio - min_ora} min</span>}
                  {stato_corso === "futuro" && <span className="ml-2 text-[10px] font-bold px-2 py-0.5 rounded-full bg-gray-100 text-gray-500">Inizia alle {corso.ora_inizio?.slice(0,5)}</span>}
                  {stato_corso === "terminato" && <span className="ml-2 text-[10px] font-bold px-2 py-0.5 rounded-full bg-muted text-muted-foreground">Terminato</span>}
                </p>          <div className="flex items-center gap-2 mt-0.5">
            <Badge variant="secondary" className="text-[10px]">
              {corso.tipo || "Corso"}
            </Badge>
            <span className="text-xs text-muted-foreground">
              {istruttori_corso.map((i) => `${i.nome} ${i.cognome}`).join(", ") || "—"}
            </span>
          </div>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <span
            className={`text-xs font-bold px-2 py-0.5 rounded-full
            ${
              presenti_atleti.length === atleti_corso.length && atleti_corso.length > 0
                ? "bg-success/10 text-success"
                : presenti_atleti.length > 0
                  ? "bg-orange-100 text-orange-600"
                  : "bg-muted/50 text-muted-foreground"
            }`}
          >
            {presenti_atleti.length}/{atleti_corso.length}
          </span>
          {monitori_assegnati.length > 0 && (
            <span className="text-xs text-muted-foreground">👥 {monitori_assegnati.length}</span>
          )}
          {expanded ? (
            <ChevronUp className="w-4 h-4 text-muted-foreground" />
          ) : (
            <ChevronDown className="w-4 h-4 text-muted-foreground" />
          )}
        </div>
      </div>

      {expanded && (
        <div className="border-t border-border/50">
          {/* Istruttori */}
          {istruttori_corso.length > 0 && (
            <div className="px-4 py-2 bg-muted/10">
              <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wide mb-1">Istruttori</p>
              {istruttori_corso.map((i) => {
                const presenza = presenze.find((p) => p.persona_id === i.id && !p.ora_uscita);
                return (
                  <div key={i.id} className="flex items-center justify-between py-1">
                    <span className="text-xs text-foreground">
                      {i.nome} {i.cognome}
                    </span>
                    <div className="flex items-center gap-1.5">
                      <span className={`text-[10px] ${presenza ? "text-success" : "text-muted-foreground"}`}>
                        {presenza ? "✅ Presente" : "⏳ Atteso"}
                      </span>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => on_segna_istr(i.id)}
                        className="h-6 text-[10px] px-2"
                      >
                        {presenza ? "Uscita" : "Entrata"}
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Monitori */}
          {monitori_assegnati.length > 0 && (
            <div className="px-4 py-2 bg-primary/3 border-t border-border/30">
              <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wide mb-1">
                Monitori & Aiuto monitori
              </p>
              {monitori_assegnati.map((m) => {
                const tipo = (corso.monitori || []).includes(m.id) ? "Monitore" : "Aiuto monitore";
                const stato = get_stato_monitore(m.id);
                const wa = genera_wa_monitore(m);
                return (
                  <div key={m.id} className="flex items-center justify-between py-1">
                    <div>
                      <span className="text-xs text-foreground">
                        {m.nome} {m.cognome}
                      </span>
                      <span className="text-[10px] text-muted-foreground ml-1">({tipo})</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <span className={`text-xs ${stato_color(stato)}`}>{stato_label(stato)}</span>
                      {wa && stato === "attesa" && (
                        <a
                          href={wa}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-[10px] px-1.5 py-0.5 rounded bg-green-100 text-green-700 hover:bg-green-200 flex items-center gap-0.5"
                        >
                          <MessageCircle className="w-2.5 h-2.5" /> WA
                        </a>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Atleti */}
          <div className="divide-y divide-border/30">
            <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wide px-4 py-2">
              Atleti ({atleti_corso.length})
            </p>
            {atleti_corso.length === 0 ? (
              <p className="text-xs text-muted-foreground px-4 py-3">Nessuna atleta iscritta.</p>
            ) : (
              atleti_corso.map((a) => {
                const presenza = presenze.find(
                  (p) => p.persona_id === a.id && p.riferimento_id === corso.id && !p.ora_uscita,
                );
                // Compleanno: confronta giorno+mese di data_nascita con la data del corso
                let is_compleanno = false;
                if (a.data_nascita) {
                  const nasc = new Date(a.data_nascita + "T00:00:00");
                  const ref = new Date(data + "T00:00:00");
                  is_compleanno =
                    nasc.getDate() === ref.getDate() && nasc.getMonth() === ref.getMonth();
                }
                return (
                  <div
                    key={a.id}
                    className={`flex items-center gap-3 px-4 py-2.5 transition-colors ${
                      is_compleanno ? "bg-yellow-100" : presenza ? "bg-success/5" : "bg-background"
                    }`}
                  >
                    <div className={`w-2 h-2 rounded-full flex-shrink-0 ${presenza ? "bg-success" : "bg-border"}`} />
                    <p className="text-sm font-medium text-foreground flex-1 flex items-center gap-1.5">
                      {is_compleanno && <span title="Compleanno oggi!">🎂</span>}
                      <span>{a.nome} {a.cognome}</span>
                      {is_compleanno && (
                        <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-yellow-300 text-yellow-900">
                          Buon compleanno!
                        </span>
                      )}
                    </p>
                    <Button
                      size="sm"
                      variant={presenza ? "outline" : "default"}
                      onClick={() => on_segna(a.id, corso.id)}
                      disabled={loading || bloccato}
                      className={`h-7 text-xs ${presenza ? "text-success border-success/40" : bloccato ? "opacity-40 cursor-not-allowed bg-muted text-muted-foreground" : "bg-success hover:bg-success/90 text-white"}`}
                    >
                      {presenza ? "✓ Presente" : "Segna"}
                    </Button>
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
};

// ─── Box comunicazione rapida ──────────────────────────────
export type BoxComunicazionePreset = {
  tipo_dest: string;
  persona_id?: string;
  titolo: string;
  testo: string;
  marker?: string; // chiave per riapplicare lo stesso preset più volte
};

const BoxComunicazione: React.FC<{
  atleti: any[];
  istruttori: any[];
  monitori: any[];
  corsi: any[];
  gare: any[];
  preset?: BoxComunicazionePreset | null;
  on_preset_consumed?: () => void;
}> = ({ atleti, istruttori, monitori, corsi, gare, preset, on_preset_consumed }) => {
  const { data: templates = [] } = use_template_comunicazioni();
  const crea = use_crea_comunicazione();

  const [tipo_dest, set_tipo_dest] = useState("tutti");
  const [riferimento_id, set_riferimento_id] = useState("");
  const [persona_id, set_persona_id] = useState("");
  const [titolo, set_titolo] = useState("");
  const [testo, set_testo] = useState("");
  const [template_sel, set_template_sel] = useState("");
  const [sending_wa, set_sending_wa] = useState(false);

  // Applica preset esterno (es. "Invia auguri" da banner compleanno)
  const last_preset_marker = React.useRef<string | null>(null);
  React.useEffect(() => {
    if (!preset) return;
    const marker = preset.marker || preset.titolo + "|" + (preset.persona_id || "");
    if (last_preset_marker.current === marker) return;
    last_preset_marker.current = marker;
    set_tipo_dest(preset.tipo_dest);
    set_persona_id(preset.persona_id || "");
    set_riferimento_id("");
    set_titolo(preset.titolo);
    set_testo(preset.testo);
    set_template_sel("");
    on_preset_consumed?.();
  }, [preset, on_preset_consumed]);

  const input_cls =
    "w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40";

  // Calcola destinatari effettivi
  const get_destinatari = (): { nome: string; telefono: string }[] => {
    if (tipo_dest === "tutti") {
      return atleti
        .filter((a) => a.stato === "attivo")
        .map((a) => ({
          nome: `${a.nome} ${a.cognome}`,
          telefono: a.genitore1_telefono || "",
        }))
        .filter((x) => x.telefono);
    }
    if (tipo_dest === "atleti_attivi") {
      return atleti
        .filter((a) => a.stato === "attivo")
        .map((a) => ({
          nome: `${a.nome} ${a.cognome}`,
          telefono: a.genitore1_telefono || "",
        }))
        .filter((x) => x.telefono);
    }
    if (tipo_dest === "istruttori") {
      return istruttori
        .filter((i) => i.stato === "attivo")
        .map((i) => ({
          nome: `${i.nome} ${i.cognome}`,
          telefono: i.telefono || "",
        }))
        .filter((x) => x.telefono);
    }
    if (tipo_dest === "monitori") {
      return monitori
        .filter((m) => m.ruolo_pista === "monitore")
        .map((m) => ({
          nome: `${m.nome} ${m.cognome}`,
          telefono: m.genitore1_telefono || "",
        }))
        .filter((x) => x.telefono);
    }
    if (tipo_dest === "aiuto_monitori") {
      return monitori
        .filter((m) => m.ruolo_pista === "aiuto_monitore")
        .map((m) => ({
          nome: `${m.nome} ${m.cognome}`,
          telefono: m.genitore1_telefono || "",
        }))
        .filter((x) => x.telefono);
    }
    if (tipo_dest === "corso" && riferimento_id) {
      const corso = corsi.find((c) => c.id === riferimento_id);
      if (!corso) return [];
      return atleti
        .filter((a) => corso.atleti_ids?.includes(a.id))
        .map((a) => ({
          nome: `${a.nome} ${a.cognome}`,
          telefono: a.genitore1_telefono || "",
        }))
        .filter((x) => x.telefono);
    }
    if (tipo_dest === "gara" && riferimento_id) {
      const gara = gare.find((g) => g.id === riferimento_id);
      if (!gara) return [];
      return atleti
        .filter((a) => gara.atleti_iscritti?.some((ai: any) => ai.atleta_id === a.id))
        .map((a) => ({
          nome: `${a.nome} ${a.cognome}`,
          telefono: a.genitore1_telefono || "",
        }))
        .filter((x) => x.telefono);
    }
    if (tipo_dest === "singolo_atleta" && persona_id) {
      const a = atleti.find((x) => x.id === persona_id);
      if (!a) return [];
      return [{ nome: `${a.nome} ${a.cognome}`, telefono: a.genitore1_telefono || "" }].filter((x) => x.telefono);
    }
    if (tipo_dest === "singolo_istruttore" && persona_id) {
      const i = istruttori.find((x) => x.id === persona_id);
      if (!i) return [];
      return [{ nome: `${i.nome} ${i.cognome}`, telefono: i.telefono || "" }].filter((x) => x.telefono);
    }
    return [];
  };

  const destinatari = get_destinatari();

  const handle_template = (tid: string) => {
    set_template_sel(tid);
    const t = templates.find((x) => x.id === tid);
    if (t) {
      set_titolo(t.nome);
      set_testo(t.testo);
    }
  };

  const handle_salva_inapp = async () => {
    if (!titolo || !testo) {
      toast({ title: "Inserisci titolo e testo", variant: "destructive" });
      return;
    }
    try {
      const is_birthday = last_preset_marker.current?.startsWith("birthday:") ?? false;
      const target_atleta_id = tipo_dest === "singolo_atleta" ? persona_id : null;
      await crea.mutateAsync({
        titolo,
        testo,
        tipo_destinatari: is_birthday ? "compleanno" : tipo_dest,
        corso_id: tipo_dest === "corso" ? riferimento_id : null,
        atleta_id: target_atleta_id,
      });
      toast({ title: "✅ Comunicazione salvata" });
      set_titolo("");
      set_testo("");
      set_template_sel("");
    } catch (err: any) {
      toast({ title: "Errore", description: err?.message, variant: "destructive" });
    }
  };

  const handle_invia_wa = () => {
    if (!testo) {
      toast({ title: "Inserisci il testo del messaggio", variant: "destructive" });
      return;
    }
    if (destinatari.length === 0) {
      toast({ title: "Nessun destinatario con numero WhatsApp", variant: "destructive" });
      return;
    }
    set_sending_wa(true);
    destinatari.forEach((d) => {
      const tel = d.telefono.replace(/\s+/g, "").replace(/^0/, "+41");
      const msg_personale = testo.replace("{nome}", d.nome.split(" ")[0]);
      const msg = encodeURIComponent(msg_personale);
      window.open(`https://wa.me/${tel}?text=${msg}`, "_blank");
    });
    set_sending_wa(false);
    toast({ title: `✅ Aperte ${destinatari.length} chat WhatsApp` });
  };

  return (
    <div className="bg-card rounded-xl shadow-card p-5 space-y-4">
      <div className="flex items-center gap-2">
        <MessageSquare className="w-4 h-4 text-primary" />
        <h3 className="text-xs font-bold text-muted-foreground uppercase tracking-widest">Comunicazione rapida</h3>
      </div>

      {/* Template */}
      <div className="space-y-1.5">
        <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Template</label>
        <select value={template_sel} onChange={(e) => handle_template(e.target.value)} className={input_cls}>
          <option value="">Scegli template...</option>
          {templates.map((t: any) => (
            <option key={t.id} value={t.id}>
              {t.nome}
            </option>
          ))}
        </select>
      </div>

      {/* Destinatari */}
      <div className="space-y-1.5">
        <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Destinatari</label>
        <select
          value={tipo_dest}
          onChange={(e) => {
            set_tipo_dest(e.target.value);
            set_riferimento_id("");
            set_persona_id("");
          }}
          className={input_cls}
        >
          <option value="tutti">Tutti (club intero)</option>
          <option value="atleti_attivi">Tutti gli atleti attivi</option>
          <option value="istruttori">Tutti gli istruttori</option>
          <option value="monitori">Tutti i monitori</option>
          <option value="aiuto_monitori">Tutti gli aiuto monitori</option>
          <option value="corso">Iscritti a un corso</option>
          <option value="gara">Iscritti a una gara</option>
          <option value="singolo_atleta">Singolo atleta</option>
          <option value="singolo_istruttore">Singolo istruttore/monitore</option>
        </select>

        {tipo_dest === "corso" && (
          <select value={riferimento_id} onChange={(e) => set_riferimento_id(e.target.value)} className={input_cls}>
            <option value="">Seleziona corso...</option>
            {corsi
              .filter((c) => c.stato === "attivo")
              .map((c) => (
                <option key={c.id} value={c.id}>
                  {c.nome}
                </option>
              ))}
          </select>
        )}
        {tipo_dest === "gara" && (
          <select value={riferimento_id} onChange={(e) => set_riferimento_id(e.target.value)} className={input_cls}>
            <option value="">Seleziona gara...</option>
            {gare.map((g) => (
              <option key={g.id} value={g.id}>
                {g.nome} — {new Date(g.data + "T00:00:00").toLocaleDateString("de-CH", { day: "2-digit", month: "2-digit", year: "numeric" })}
              </option>
            ))}
          </select>
        )}
        {tipo_dest === "singolo_atleta" && (
          <select value={persona_id} onChange={(e) => set_persona_id(e.target.value)} className={input_cls}>
            <option value="">Seleziona atleta...</option>
            {atleti
              .filter((a) => a.stato === "attivo")
              .map((a) => (
                <option key={a.id} value={a.id}>
                  {a.nome} {a.cognome}
                </option>
              ))}
          </select>
        )}
        {tipo_dest === "singolo_istruttore" && (
          <select value={persona_id} onChange={(e) => set_persona_id(e.target.value)} className={input_cls}>
            <option value="">Seleziona persona...</option>
            {[...istruttori, ...monitori].map((i) => (
              <option key={i.id} value={i.id}>
                {i.nome} {i.cognome}
              </option>
            ))}
          </select>
        )}

        {destinatari.length > 0 && (
          <p className="text-xs text-primary font-medium">
            📨 {destinatari.length} destinatar{destinatari.length === 1 ? "io" : "i"} con WhatsApp
          </p>
        )}
      </div>

      {/* Titolo */}
      <div className="space-y-1.5">
        <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Titolo</label>
        <input
          value={titolo}
          onChange={(e) => set_titolo(e.target.value)}
          placeholder="Oggetto comunicazione..."
          className={input_cls}
        />
      </div>

      {/* Testo */}
      <div className="space-y-1.5">
        <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Messaggio</label>
        <textarea
          value={testo}
          onChange={(e) => set_testo(e.target.value)}
          rows={4}
          placeholder="Scrivi il messaggio... Usa {nome} per personalizzarlo"
          className={`${input_cls} resize-none`}
        />
        <p className="text-[10px] text-muted-foreground">
          Variabili: {"{nome}"}, {"{corso}"}, {"{gara}"}, {"{data}"}, {"{importo}"}
        </p>
      </div>

      {/* Azioni */}
      <div className="flex gap-2">
        <Button
          variant="outline"
          size="sm"
          onClick={handle_salva_inapp}
          disabled={crea.isPending}
          className="flex-1 gap-1.5 text-xs"
        >
          <Send className="w-3.5 h-3.5" />
          {crea.isPending ? "..." : "Salva in-app"}
        </Button>
        <Button
          size="sm"
          onClick={handle_invia_wa}
          disabled={sending_wa || destinatari.length === 0}
          className="flex-1 gap-1.5 text-xs bg-green-600 hover:bg-green-700 text-white"
        >
          <MessageCircle className="w-3.5 h-3.5" />
          WhatsApp ({destinatari.length})
        </Button>
      </div>
    </div>
  );
};

// ─── Widget compleanni ─────────────────────────────────────
const WidgetCompleanni: React.FC<{ atleti: any[] }> = ({ atleti }) => {
  const today = new Date();
  const today_md = `${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;

  const compleanni = atleti
    .filter((a) => a.data_nascita)
    .map((a) => {
      const dn = new Date(a.data_nascita);
      const md = `${String(dn.getMonth() + 1).padStart(2, "0")}-${String(dn.getDate()).padStart(2, "0")}`;
      
      // Data del prossimo compleanno quest'anno
      const this_year_bday = new Date(today.getFullYear(), dn.getMonth(), dn.getDate());
      
      // Calcola giorni rimanenti (se negativo, il compleanno è già passato → prossimo anno)
      let giorni = Math.ceil((this_year_bday.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
      let next_birthday_year = today.getFullYear();
      
      if (giorni < 0) {
        // Compleanno già passato quest'anno → prossimo è l'anno prossimo
        giorni += 365;
        next_birthday_year = today.getFullYear() + 1;
      }
      
      // Età al prossimo compleanno = anno del prossimo compleanno - anno di nascita
      const eta = next_birthday_year - dn.getFullYear();
      
      return { ...a, md, giorni, eta };
    })
    .filter((a) => a.giorni <= 7)
    .sort((a, b) => a.giorni - b.giorni);

  if (compleanni.length === 0) return null;

  return (
    <div className="bg-card rounded-xl shadow-card p-5 space-y-3">
      <div className="flex items-center gap-2">
        <Gift className="w-4 h-4 text-pink-500" />
        <h3 className="text-xs font-bold text-muted-foreground uppercase tracking-widest">Compleanni</h3>
      </div>
      {compleanni.map((a) => (
        <div key={a.id} className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-full bg-pink-100 flex items-center justify-center text-pink-600 text-xs font-bold">
              {a.nome[0]}
              {a.cognome[0]}
            </div>
            <div>
              <p className="text-sm font-medium text-foreground">
                {a.nome} {a.cognome}
              </p>
              <p className="text-xs text-muted-foreground">compie {a.eta} anni</p>
            </div>
          </div>
          <Badge variant={a.giorni === 0 ? "default" : "secondary"} className="text-xs">
            {a.giorni === 0 ? "🎂 Oggi!" : a.giorni === 1 ? "Domani" : `fra ${a.giorni}gg`}
          </Badge>
        </div>
      ))}
    </div>
  );
};

// ─── Widget fatture in scadenza ────────────────────────────
const WidgetFatture: React.FC<{ fatture: any[]; atleti: any[] }> = ({ fatture, atleti }) => {
  const today = new Date().toISOString().split("T")[0];
  const tra_7 = add_days(today, 7);

  const in_scadenza = fatture
    .filter((f) => f.stato === "da_pagare" && f.scadenza && f.scadenza >= today && f.scadenza <= tra_7)
    .sort((a, b) => a.scadenza.localeCompare(b.scadenza))
    .slice(0, 5);

  const scadute = fatture.filter((f) => f.stato === "da_pagare" && f.scadenza && f.scadenza < today);

  if (in_scadenza.length === 0 && scadute.length === 0) return null;

  return (
    <div className="bg-card rounded-xl shadow-card p-5 space-y-3">
      <div className="flex items-center gap-2">
        <AlertTriangle className="w-4 h-4 text-orange-500" />
        <h3 className="text-xs font-bold text-muted-foreground uppercase tracking-widest">Fatture</h3>
      </div>
      {scadute.length > 0 && (
        <div className="bg-destructive/5 border border-destructive/20 rounded-lg px-3 py-2">
          <p className="text-xs font-bold text-destructive">{scadute.length} fatture scadute</p>
          <p className="text-xs text-muted-foreground">
            CHF {scadute.reduce((s, f) => s + f.importo, 0).toFixed(2)} da incassare
          </p>
        </div>
      )}
      {in_scadenza.map((f) => {
        const atleta = atleti.find((a) => a.id === f.atleta_id);
        return (
          <div key={f.id} className="flex items-center justify-between">
            <div>
              <p className="text-xs font-medium text-foreground">{atleta ? `${atleta.nome} ${atleta.cognome}` : "—"}</p>
              <p className="text-xs text-muted-foreground">{f.descrizione}</p>
            </div>
            <div className="text-right">
              <p className="text-xs font-bold text-foreground">CHF {Number(f.importo).toFixed(2)}</p>
              <p className="text-xs text-orange-500">
                {new Date(f.scadenza + "T00:00:00").toLocaleDateString("de-CH", { day: "2-digit", month: "short" })}
              </p>
            </div>
          </div>
        );
      })}
    </div>
  );
};

// ─── Presenze istruttori ───────────────────────────────────
const SezionePresenzeIstruttori: React.FC<{
  istruttori: any[];
  today_key: string;
  presenze: any[];
  on_segna: (id: string) => void;
  on_elimina: (id: string) => void;
  loading: boolean;
}> = ({ istruttori, today_key, presenze, on_segna, on_elimina, loading }) => {
  const today_istruttori = istruttori.filter((i) => {
    if (i.stato !== "attivo") return false;
    return get_slots_giorno(i.disponibilita || {}, today_key).length > 0;
  });

  return (
    <div className="space-y-2">
      {today_istruttori.length === 0 ? (
        <p className="text-xs text-muted-foreground text-center py-4">Nessun istruttore previsto oggi</p>
      ) : (
        today_istruttori.map((i) => {
          const presenza = presenze.find((p) => p.persona_id === i.id);
          const is_present = !!presenza && !presenza.ora_uscita;
          const has_left = !!presenza?.ora_uscita;
          const slots = get_slots_giorno(i.disponibilita || {}, today_key);
          return (
            <div
              key={i.id}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-xl border transition-all
              ${is_present ? "bg-success/5 border-success/20" : has_left ? "bg-muted/20 border-border/50" : "bg-muted/10 border-border/30"}`}
            >
              <div
                className={`w-2 h-2 rounded-full flex-shrink-0 ${is_present ? "bg-success" : has_left ? "bg-muted-foreground" : "bg-orange-400"}`}
              />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-foreground">
                  {i.nome} {i.cognome}
                </p>
                <p className="text-xs text-muted-foreground">
                  {presenza ? (
                    <>
                      {presenza.metodo === "nfc" && <Wifi className="w-3 h-3 inline mr-1" />}
                      Entrata: {presenza.ora_entrata?.slice(0, 5)}
                      {presenza.ora_uscita && ` · Uscita: ${presenza.ora_uscita?.slice(0, 5)}`}
                    </>
                  ) : (
                    slots.map((s) => `${s.ora_inizio}-${s.ora_fine}`).join(", ")
                  )}
                </p>
              </div>
              <div className="flex items-center gap-1">
                {!has_left ? (
                  <Button
                    size="sm"
                    variant={is_present ? "outline" : "default"}
                    onClick={() => on_segna(i.id)}
                    disabled={loading}
                    className={`h-7 text-xs ${is_present ? "" : "bg-success hover:bg-success/90 text-white"}`}
                  >
                    {is_present ? "🚪 Uscita" : "✅ Entrata"}
                  </Button>
                ) : (
                  <span className="text-xs text-muted-foreground">Uscito</span>
                )}
                {presenza && (
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => on_elimina(presenza.id)}
                    className="h-7 w-7 p-0 text-destructive hover:bg-destructive/10"
                  >
                    <XCircle className="w-3.5 h-3.5" />
                  </Button>
                )}
              </div>
            </div>
          );
        })
      )}
    </div>
  );
};

// ─── Main Dashboard ────────────────────────────────────────
const DashboardPage: React.FC = () => {
  const { t } = useI18n();
  const { data: atleti = [], isLoading: loading_atleti } = use_atleti();
  const { data: corsi = [], isLoading: loading_corsi } = use_corsi();
  const { data: gare = [], isLoading: loading_gare } = use_gare();
  const { data: fatture = [], isLoading: loading_fatture } = use_fatture();
  const { data: istruttori = [], isLoading: loading_istruttori } = use_istruttori();
  const { data: monitori = [] } = use_atleti_monitori();
  const { data: comunicazioni = [] } = use_comunicazioni();
  const { data: lezioni = [] } = use_lezioni_private();
  const { data: club } = use_club();
  const { data: setup } = use_setup_club();
  const navigate = useNavigate();
  const today = new Date().toISOString().split("T")[0];
  const { data: presenze = [] } = use_presenze(today);
  const { data: presenze_corso = [] } = useQuery({
    queryKey: ["presenze_corso_oggi", today],
    queryFn: async () => {
      const { data, error } = await supabase.from("presenze_corso").select("*").eq("data", today);
      if (error) throw error;
      return data ?? [];
    },
  });

  const segna = use_segna_presenza();
  const elimina_p = use_elimina_presenza();
  const [tab_presenze, set_tab_presenze] = useState<"corsi" | "istruttori">("corsi");
  const [agenda_offset, set_agenda_offset] = useState(0);
  const [com_preset, set_com_preset] = useState<BoxComunicazionePreset | null>(null);

  // Atleti con compleanno oggi
  const compleanni_oggi = useMemo(() => {
    const oggi = new Date();
    const md = `${String(oggi.getMonth() + 1).padStart(2, "0")}-${String(oggi.getDate()).padStart(2, "0")}`;
    return atleti.filter((a) => {
      if (!a.data_nascita) return false;
      const dn = new Date(a.data_nascita + "T00:00:00");
      const dn_md = `${String(dn.getMonth() + 1).padStart(2, "0")}-${String(dn.getDate()).padStart(2, "0")}`;
      return dn_md === md;
    });
  }, [atleti]);

  const handle_invia_auguri = (atleta: any) => {
    const nome = atleta.nome || "";
    const preset: BoxComunicazionePreset = {
      tipo_dest: "singolo_atleta",
      persona_id: atleta.id,
      titolo: `🎂 Auguri ${nome}!`,
      testo: `🎂 Tanti auguri ${nome}! Il tuo club e i tuoi istruttori ti fanno i migliori auguri per il tuo compleanno! 🎉`,
      marker: `birthday:${atleta.id}:${Date.now()}`,
    };
    set_com_preset(preset);
    setTimeout(() => {
      const el = document.getElementById("box-comunicazione");
      if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 50);
  };

  const is_loading = loading_atleti || loading_corsi || loading_gare || loading_fatture || loading_istruttori;

  const active_atleti = atleti.filter((a) => a.stato === "attivo").length;
  const active_corsi = corsi.filter((c) => c.stato === "attivo").length;
  const upcoming_gare = gare.filter((g) => days_until(g.data) >= 0);
  const next_gara = upcoming_gare.sort((a, b) => days_until(a.data) - days_until(b.data))[0];
  const fatture_da_pagare = fatture.filter((f) => f.stato === "da_pagare");
  const totale_fatture = fatture_da_pagare.reduce((s, f) => s + f.importo, 0);
  const today_iso_kpi = new Date().toISOString().split("T")[0];
  const fatture_scadute_count = fatture_da_pagare.filter((f) => {
    const d = (f as any).data_scadenza || (f as any).scadenza;
    return d && String(d) < today_iso_kpi;
  }).length;
  const fatture_in_arrivo_count = fatture_da_pagare.length - fatture_scadute_count;

  const today_day_keys = ["domenica", "lunedì", "martedì", "mercoledì", "giovedì", "venerdì", "sabato"];
  const today_key = today_day_keys[new Date().getDay()];

  // Corsi per il giorno selezionato
  const t2m_dash = (t: string) => { const [h,m] = (t||'').split(':').map(Number); return (h||0)*60+(m||0); };
  const oraOra = new Date().getHours() * 60 + new Date().getMinutes();

  const agenda_data = add_days(today, agenda_offset);
  const agenda_is_today = agenda_offset === 0;
  const agenda_label = agenda_is_today ? "Oggi" : format_data_breve(agenda_data);

  const corsi_agenda = corsi
    .filter((c) => match_giorno(c.giorno, get_giorno_key(agenda_data)) && c.stato === "attivo")
    .map((c) => {
      if (!agenda_is_today) return { ...c, stato_tempo: "futuro" as const };
      const fineMin = t2m_dash(c.ora_fine);
      const inizioMin = t2m_dash(c.ora_inizio);
      if (fineMin + 30 < oraOra) return null; // nascosto: finito da più di 30 min
      if (fineMin < oraOra) return { ...c, stato_tempo: "terminato" as const };
      if (inizioMin <= oraOra && oraOra <= fineMin) return { ...c, stato_tempo: "in_corso" as const };
      if (inizioMin - oraOra <= 120) return { ...c, stato_tempo: "prossimo" as const, traMinuti: inizioMin - oraOra };
      return { ...c, stato_tempo: "futuro" as const };
    })
    .filter(Boolean)
    .sort((a: any, b: any) => (a.ora_inizio || "").localeCompare(b.ora_inizio || ""));

  const today_lezioni = lezioni.filter((l) => l.data === today && !l.annullata);
  const totale_presenti = presenze.filter((p) => !p.ora_uscita).length;

  const handle_segna_atleta = async (atleta_id: string, riferimento_id: string) => {
    try {
      const result = await segna.mutateAsync({
        persona_id: atleta_id,
        tipo_persona: "atleta",
        data: today,
        metodo: "manuale",
        riferimento_id,
        tipo_riferimento: "corso",
      } as any);
      toast({ title: result.tipo === "entrata" ? "✅ Presenza registrata" : "🚪 Uscita registrata" });
    } catch (err: any) {
      toast({ title: "Errore", description: err?.message, variant: "destructive" });
    }
  };

  const handle_segna_istruttore = async (id: string) => {
    try {
      const result = await segna.mutateAsync({
        persona_id: id,
        tipo_persona: "istruttore",
        data: today,
        metodo: "manuale",
      });
      toast({ title: result.tipo === "entrata" ? "✅ Entrata registrata" : "🚪 Uscita registrata" });
    } catch (err: any) {
      toast({ title: "Errore", description: err?.message, variant: "destructive" });
    }
  };

  const handle_elimina = async (id: string) => {
    try {
      await elimina_p.mutateAsync(id);
      toast({ title: "🗑️ Presenza rimossa" });
    } catch (err: any) {
      toast({ title: "Errore", description: err?.message, variant: "destructive" });
    }
  };

  if (is_loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex items-center gap-4">
        {club?.logo_url ? (
          <img
            src={club.logo_url}
            alt={club.nome}
            className="w-14 h-14 rounded-2xl object-contain border border-border bg-white p-1 shadow-sm"
          />
        ) : (
          <div className="w-14 h-14 rounded-2xl bg-primary/10 flex items-center justify-center text-primary font-bold text-xl shadow-sm">
            {club?.nome?.[0] || "C"}
          </div>
        )}
        <div>
          <h1 className="text-xl font-bold text-foreground">{club?.nome || "Dashboard"}</h1>
          {club?.citta && (
            <p className="text-sm text-muted-foreground">
              {club.citta}
              {club.paese ? `, ${club.paese}` : ""}
            </p>
          )}
        </div>
        <div className="ml-auto text-right">
          <p className="text-xs text-muted-foreground capitalize">
            {new Date().toLocaleDateString("de-CH", {
              weekday: "long",
              day: "numeric",
              month: "long",
              year: "numeric",
            })}
          </p>
          <p className="text-xs font-bold text-success">{totale_presenti} presenti in pista</p>
        </div>
      </div>

      {/* KPI */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KPICard title="Atleti attivi" value={String(active_atleti)} icon={<Users className="w-5 h-5" />} />
        <KPICard title="Corsi attivi" value={String(active_corsi)} icon={<BookOpen className="w-5 h-5" />} />
        <KPICard
          title="Prossime gare"
          value={String(upcoming_gare.length)}
          icon={<Trophy className="w-5 h-5" />}
          subtitle={next_gara ? `fra ${days_until(next_gara.data)}gg: ${next_gara.nome}` : undefined}
        />
        <KPICard
          title="Da incassare"
          value={`CHF ${totale_fatture.toLocaleString()}`}
          icon={<CreditCard className="w-5 h-5" />}
          highlight
          subtitle={
            fatture_da_pagare.length > 0
              ? `${fatture_scadute_count} scadute · ${fatture_in_arrivo_count} in arrivo`
              : undefined
          }
        />
      </div>

      {/* Banner compleanni del giorno */}
      {compleanni_oggi.length > 0 && (
        <div className="rounded-xl border border-yellow-300 bg-gradient-to-r from-yellow-50 via-amber-50 to-pink-50 px-5 py-4 shadow-sm">
          <div className="flex items-start gap-3 flex-wrap">
            <div className="text-3xl leading-none">🎂</div>
            <div className="flex-1 min-w-[220px]">
              <p className="text-sm font-bold text-amber-900">
                Oggi è il compleanno di{" "}
                {compleanni_oggi.map((a, idx) => (
                  <span key={a.id}>
                    <span className="font-semibold">{a.nome} {a.cognome}</span>
                    {idx < compleanni_oggi.length - 2
                      ? ", "
                      : idx === compleanni_oggi.length - 2
                        ? " e "
                        : ""}
                  </span>
                ))}
                ! 🎉
              </p>
              <p className="text-xs text-amber-800/80 mt-0.5">
                Mandagli gli auguri dal club: clicca "Invia auguri" e personalizza il messaggio prima di inviarlo.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              {compleanni_oggi.map((a) => (
                <Button
                  key={a.id}
                  size="sm"
                  onClick={() => handle_invia_auguri(a)}
                  className="gap-1.5 bg-amber-500 hover:bg-amber-600 text-white text-xs"
                >
                  <Gift className="w-3.5 h-3.5" />
                  Invia auguri a {a.nome}
                </Button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Banner fine stagione */}
      {(() => {
        const data_fine = (setup as any)?.data_fine_stagione;
        if (!data_fine) return null;
        const fine = new Date(data_fine + "T00:00:00");
        const oggi = new Date();
        oggi.setHours(0, 0, 0, 0);
        const diff_days = Math.ceil((fine.getTime() - oggi.getTime()) / (1000 * 60 * 60 * 24));
        if (diff_days > 30) return null;
        const data_fmt = fine.toLocaleDateString("de-CH", { day: "numeric", month: "long", year: "numeric" });
        const is_past = diff_days < 0;
        return (
          <div
            className={`flex items-center gap-3 rounded-xl border px-5 py-3 ${
              is_past
                ? "border-destructive/50 bg-destructive/10 animate-[season-pulse_1s_ease-in-out_infinite]"
                : "border-amber-500/30 bg-amber-500/10"
            }`}
          >
            <AlertTriangle className={`w-5 h-5 flex-shrink-0 ${is_past ? "text-destructive" : "text-amber-600"}`} />
            <p className={`text-sm flex-1 ${is_past ? "text-destructive font-semibold" : "text-amber-800"}`}>
              {is_past
                ? `⚠ La stagione è terminata il ${data_fmt}. Termina la stagione ora.`
                : `La stagione termina il ${data_fmt}. È ora di pianificare la nuova stagione.`}
            </p>
            <Button size="sm" variant={is_past ? "destructive" : "outline"} onClick={() => navigate("/nuova-stagione")}>
              {is_past ? "Termina Stagione" : "Avvia Nuova Stagione"}
            </Button>
          </div>
        );
      })()}

      {/* Layout principale */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Colonna sinistra — corsi + presenze */}
        <div className="lg:col-span-2 space-y-5">
          {/* Agenda corsi — un giorno alla volta */}
          <div className="bg-card rounded-xl shadow-card p-5 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-bold text-muted-foreground uppercase tracking-widest">Agenda corsi</h3>
              <div className="flex items-center gap-1">
                <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={() => set_agenda_offset((o) => o - 1)}>
                  <ChevronLeft className="w-4 h-4" />
                </Button>
                <button
                  onClick={() => set_agenda_offset(0)}
                  className={`text-xs font-bold px-3 py-1 rounded-full transition-colors ${agenda_is_today ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:bg-muted/80"}`}
                >
                  {agenda_label}
                </button>
                <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={() => set_agenda_offset((o) => o + 1)}>
                  <ChevronRight className="w-4 h-4" />
                </Button>
              </div>
            </div>

            <div className="flex gap-1 p-1 bg-muted/30 rounded-lg">
              {(["corsi", "istruttori"] as const).map((tab) => (
                <button
                  key={tab}
                  onClick={() => set_tab_presenze(tab)}
                  className={`flex-1 text-xs font-medium py-1.5 rounded-md transition-all
                    ${tab_presenze === tab ? "bg-card shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground"}`}
                >
                  {tab === "corsi" ? "📋 Corsi & Appello" : "👨‍🏫 Istruttori"}
                </button>
              ))}
            </div>

            {tab_presenze === "corsi" && (
              <div className="space-y-5">
                {corsi_agenda.length === 0 && (agenda_is_today ? today_lezioni.length === 0 : true) ? (
                  <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
                    <Clock className="w-8 h-8 mb-2 opacity-30" />
                    <p className="text-sm">Nessun corso per {agenda_label.toLowerCase()}</p>
                  </div>
                ) : (
                  <>
                    <div className="space-y-2">
                      <span className="text-xs text-muted-foreground">
                        {corsi_agenda.length} cors{corsi_agenda.length === 1 ? "o" : "i"}
                      </span>
                      {corsi_agenda.map((corso: any) => (
                        <CorsoCard
                          key={corso.id}
                          corso={corso}
                          atleti={atleti}
                          monitori={monitori}
                          istruttori={istruttori}
                          presenze={presenze}
                          presenze_corso={presenze_corso}
                          data={agenda_data}
                          on_segna={handle_segna_atleta}
                          on_segna_istr={handle_segna_istruttore}
                          loading={segna.isPending}
                        />
                      ))}
                    </div>
                    {agenda_is_today && today_lezioni.length > 0 && (
                      <div className="space-y-2">
                        <div className="flex items-center gap-2">
                          <div className="text-xs font-bold px-2.5 py-1 rounded-full bg-primary text-white">
                            Lezioni private oggi
                          </div>
                        </div>
                        {today_lezioni.map((lezione) => {
                          const atleti_lezione = atleti.filter((a) => lezione.atleti_ids?.includes(a.id));
                          const istr = istruttori.find((i) => i.id === lezione.istruttore_id);
                          return (
                            <div key={lezione.id} className="border border-border/50 rounded-xl p-3">
                              <div className="flex items-center gap-3 mb-2">
                                <span className="text-xs font-bold text-primary w-12">
                                  {lezione.ora_inizio?.slice(0, 5)}
                                </span>
                                <div>
                                  <p className="text-sm font-semibold text-foreground">Lezione privata</p>
                                  <p className="text-xs text-muted-foreground">
                                    {istr ? `${istr.nome} ${istr.cognome}` : "—"}
                                  </p>
                                </div>
                              </div>
                              {atleti_lezione.map((a) => {
                                const presenza = presenze.find(
                                  (p) => p.persona_id === a.id && p.riferimento_id === lezione.id,
                                );
                                return (
                                  <div key={a.id} className="flex items-center justify-between px-2 py-1.5">
                                    <span className="text-sm text-foreground">
                                      {a.nome} {a.cognome}
                                    </span>
                                    <Button
                                      size="sm"
                                      variant={presenza ? "outline" : "default"}
                                      onClick={() => handle_segna_atleta(a.id, lezione.id)}
                                      disabled={segna.isPending}
                                      className={`h-6 text-xs ${presenza ? "text-success border-success/40" : "bg-success hover:bg-success/90 text-white"}`}
                                    >
                                      {presenza ? "✓" : "Segna"}
                                    </Button>
                                  </div>
                                );
                              })}
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </>
                )}
              </div>
            )}

            {tab_presenze === "istruttori" && (
              <SezionePresenzeIstruttori
                istruttori={istruttori}
                today_key={today_key}
                presenze={presenze}
                on_segna={handle_segna_istruttore}
                on_elimina={handle_elimina}
                loading={segna.isPending}
              />
            )}
          </div>

          {/* Box comunicazione rapida */}
          <div id="box-comunicazione">
            <BoxComunicazione
              atleti={atleti}
              istruttori={istruttori}
              monitori={monitori}
              corsi={corsi}
              gare={gare}
              preset={com_preset}
              on_preset_consumed={() => set_com_preset(null)}
            />
          </div>
        </div>

        {/* Colonna destra — widget */}
        <div className="space-y-5">
          <RichiesteIscrizioneWidget />
          <UltimeIscrizioniWidget />
          <RichiesteLezioniPrivateWidget />
          <IstruttoriDisponibiliWidget />
          <WidgetCompleanni atleti={atleti} />
          <WidgetFatture fatture={fatture} atleti={atleti} />

          {/* Prossime gare */}
          {upcoming_gare.length > 0 && (
            <div className="bg-card rounded-xl shadow-card p-5 space-y-3">
              <div className="flex items-center gap-2">
                <Trophy className="w-4 h-4 text-primary" />
                <h3 className="text-xs font-bold text-muted-foreground uppercase tracking-widest">Prossime gare</h3>
              </div>
              {upcoming_gare.slice(0, 3).map((g) => (
                <div key={g.id} className="flex items-center gap-3">
                  <div
                    className={`text-center px-2 py-1.5 rounded-lg min-w-[40px]
                    ${days_until(g.data) <= 7 ? "bg-orange-100 text-orange-700" : "bg-muted/50 text-muted-foreground"}`}
                  >
                    <p className="text-xs font-bold tabular-nums">{days_until(g.data)}gg</p>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-foreground truncate">{g.nome}</p>
                    <p className="text-xs text-muted-foreground">
                      {g.localita} · {g.atleti_iscritti?.length || 0} atleti
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Medagliere stagione (top 5) */}
          <MedagliereWidget compact limit={5} />

          {/* Ultime comunicazioni */}
          {comunicazioni.length > 0 && (
            <div className="bg-card rounded-xl shadow-card p-5 space-y-3">
              <div className="flex items-center gap-2">
                <MessageSquare className="w-4 h-4 text-primary" />
                <h3 className="text-xs font-bold text-muted-foreground uppercase tracking-widest">Comunicazioni</h3>
              </div>
              {comunicazioni.slice(0, 3).map((c) => (
                <div key={c.id} className="space-y-0.5">
                  <p className="text-sm font-medium text-foreground">{c.titolo}</p>
                  <p className="text-xs text-muted-foreground">{c.data}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default DashboardPage;
