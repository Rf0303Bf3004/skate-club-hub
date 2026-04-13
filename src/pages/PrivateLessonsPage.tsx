import React, { useState, useMemo, useEffect } from "react";
import { use_lezioni_private, use_istruttori, use_atleti, use_corsi, use_setup_club } from "@/hooks/use-supabase-data";
import { useQuery } from "@tanstack/react-query";
import {
  use_crea_lezione_privata,
  use_annulla_lezione,
  use_aggiungi_atleta_lezione,
} from "@/hooks/use-supabase-mutations";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ChevronLeft, ChevronRight, X, Search, Check, Clock, User, UserPlus, Settings } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { supabase, get_current_club_id } from "@/lib/supabase";
import { useQueryClient } from "@tanstack/react-query";

// ─── Helpers ───────────────────────────────────────────────
function fmt(d: Date): string {
  return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");
}

function time_to_min(t: string): number {
  const [h, m] = (t || "00:00").split(":").map(Number);
  return h * 60 + (m || 0);
}

function min_to_time(m: number): string {
  return (
    Math.floor(m / 60)
      .toString()
      .padStart(2, "0") +
    ":" +
    (m % 60).toString().padStart(2, "0")
  );
}

function subtract_intervals(
  avail: { start: number; end: number }[],
  busy: { start: number; end: number }[],
): { start: number; end: number }[] {
  let result = [...avail];
  for (const b of busy) {
    const next: { start: number; end: number }[] = [];
    for (const a of result) {
      if (b.end <= a.start || b.start >= a.end) {
        next.push(a);
      } else {
        if (a.start < b.start) next.push({ start: a.start, end: b.start });
        if (a.end > b.end) next.push({ start: b.end, end: a.end });
      }
    }
    result = next;
  }
  return result;
}

function intersect_intervals(
  a: { start: number; end: number }[],
  b: { start: number; end: number }[],
): { start: number; end: number }[] {
  const result: { start: number; end: number }[] = [];
  for (const ia of a) {
    for (const ib of b) {
      const start = Math.max(ia.start, ib.start);
      const end = Math.min(ia.end, ib.end);
      if (start < end) result.push({ start, end });
    }
  }
  return result;
}

function to_num(v: string | number): number {
  if (typeof v === "number") return isNaN(v) ? 0 : v;
  const n = parseFloat(String(v).replace(",", "."));
  return isNaN(n) ? 0 : n;
}

const GIORNI = ["Lunedì", "Martedì", "Mercoledì", "Giovedì", "Venerdì", "Sabato", "Domenica"];
const GIORNI_SHORT = ["Lun", "Mar", "Mer", "Gio", "Ven", "Sab", "Dom"];
const MESI = [
  "Gennaio",
  "Febbraio",
  "Marzo",
  "Aprile",
  "Maggio",
  "Giugno",
  "Luglio",
  "Agosto",
  "Settembre",
  "Ottobre",
  "Novembre",
  "Dicembre",
];

type TipoLezione = "privata" | "semiprivata";

function get_tipo_lezione(atleti_ids: string[]): TipoLezione {
  return atleti_ids.length > 1 ? "semiprivata" : "privata";
}

// ─── NumInput ──────────────────────────────────────────────
const input_cls =
  "w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40";

const NumInput: React.FC<{
  value: string | number;
  onChange: (v: string) => void;
  className?: string;
  placeholder?: string;
}> = ({ value, onChange, className = "", placeholder = "0.00" }) => {
  const [local, set_local] = useState(() => {
    const n = to_num(String(value));
    return n === 0 ? "" : n.toFixed(2);
  });
  const [focused, set_focused] = useState(false);

  useEffect(() => {
    if (!focused) {
      const n = to_num(String(value));
      set_local(n === 0 ? "" : n.toFixed(2));
    }
  }, [value, focused]);

  return (
    <input
      type="text"
      inputMode="decimal"
      value={local}
      placeholder={placeholder}
      onFocus={() => set_focused(true)}
      onKeyDown={(e) => {
        const allowed = [
          "Backspace",
          "Delete",
          "Tab",
          "Escape",
          "Enter",
          "ArrowLeft",
          "ArrowRight",
          "ArrowUp",
          "ArrowDown",
          "Home",
          "End",
        ];
        if (allowed.includes(e.key)) return;
        if ((e.key === "." || e.key === ",") && !local.includes(".")) return;
        if (/^\d$/.test(e.key)) return;
        if (e.ctrlKey || e.metaKey) return;
        e.preventDefault();
      }}
      onChange={(e) => {
        const v = e.target.value.replace(",", ".");
        set_local(v);
        onChange(v);
      }}
      onBlur={() => {
        set_focused(false);
        const n = to_num(local);
        set_local(n === 0 ? "" : n.toFixed(2));
        onChange(String(n));
      }}
      className={`${input_cls} ${className}`}
    />
  );
};

// ─── Autocomplete atleta ───────────────────────────────────
const AtletaSearch: React.FC<{
  atleti: any[];
  selected_ids: string[];
  on_change: (ids: string[]) => void;
  escludi_ids?: string[];
}> = ({ atleti, selected_ids, on_change, escludi_ids = [] }) => {
  const [query, set_query] = useState("");
  const [open, set_open] = useState(false);

  const filtered = useMemo(() => {
    const q = query.toLowerCase().trim();
    const disponibili = atleti.filter((a: any) => !escludi_ids.includes(a.id));
    if (!q) return disponibili.slice(0, 8);
    return disponibili.filter((a: any) => `${a.nome} ${a.cognome}`.toLowerCase().includes(q)).slice(0, 8);
  }, [atleti, query, escludi_ids]);

  const toggle = (id: string) => {
    on_change(selected_ids.includes(id) ? selected_ids.filter((i) => i !== id) : [...selected_ids, id]);
  };

  return (
    <div className="relative">
      <div
        className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm flex items-center gap-2 cursor-text min-h-[38px]"
        onClick={() => set_open(true)}
      >
        <Search className="w-3.5 h-3.5 text-muted-foreground flex-shrink-0" />
        <input
          className="flex-1 bg-transparent outline-none text-sm placeholder:text-muted-foreground"
          placeholder="Cerca atleta per nome..."
          value={query}
          onChange={(e) => {
            set_query(e.target.value);
            set_open(true);
          }}
          onFocus={() => set_open(true)}
        />
      </div>
      {open && (
        <>
          <div
            className="fixed inset-0 z-10"
            onClick={() => {
              set_open(false);
              set_query("");
            }}
          />
          <div className="absolute z-20 top-full mt-1 w-full bg-card border border-border rounded-lg shadow-xl overflow-hidden">
            {filtered.length === 0 ? (
              <p className="text-sm text-muted-foreground px-3 py-2">Nessun atleta trovato</p>
            ) : (
              filtered.map((a: any) => {
                const sel = selected_ids.includes(a.id);
                return (
                  <div
                    key={a.id}
                    onClick={() => {
                      toggle(a.id);
                      set_query("");
                    }}
                    className={`flex items-center justify-between px-3 py-2 cursor-pointer text-sm transition-colors
                      ${sel ? "bg-primary/10 text-primary" : "hover:bg-muted/50 text-foreground"}`}
                  >
                    <span>
                      {a.nome} {a.cognome}
                    </span>
                    {sel && <Check className="w-4 h-4" />}
                  </div>
                );
              })
            )}
          </div>
        </>
      )}
      {selected_ids.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mt-2">
          {selected_ids.map((id) => {
            const a = atleti.find((x: any) => x.id === id);
            if (!a) return null;
            return (
              <span
                key={id}
                className="flex items-center gap-1 bg-primary/10 text-primary text-xs px-2 py-1 rounded-full"
              >
                {a.nome} {a.cognome}
                <button onClick={() => toggle(id)} className="hover:text-destructive transition-colors">
                  <X className="w-3 h-3" />
                </button>
              </span>
            );
          })}
        </div>
      )}
    </div>
  );
};

// ─── Modal prenotazione ────────────────────────────────────
const SlotModal: React.FC<{
  form: Record<string, any>;
  atleti: any[];
  slot_minuti: number;
  on_change: (k: string, v: any) => void;
  on_submit: () => void;
  on_close: () => void;
  loading: boolean;
}> = ({ form, atleti, slot_minuti, on_change, on_submit, on_close, loading }) => {
  const date_obj = new Date(form.data + "T00:00:00");
  const date_label = date_obj.toLocaleDateString("it-CH", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <div className="bg-card rounded-2xl shadow-xl w-full max-w-md flex flex-col max-h-[90vh]">
        {/* Header fisso */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border flex-shrink-0">
          <div>
            <h2 className="text-base font-bold text-foreground">
              Prenota {form.ora_inizio}–{form.ora_fine}
            </h2>
            <p className="text-xs text-muted-foreground capitalize">{date_label}</p>
          </div>
          <button onClick={on_close} className="text-muted-foreground hover:text-foreground">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Contenuto scrollabile */}
        <div className="px-6 py-5 space-y-5 overflow-y-auto flex-1">
          <div className="flex items-center gap-2 px-3 py-2 bg-muted/30 rounded-lg">
            <Clock className="w-3.5 h-3.5 text-muted-foreground" />
            <span className="text-xs text-muted-foreground">
              Durata slot: <strong>{slot_minuti} minuti</strong>
            </span>
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Atleta/e *</label>
            <AtletaSearch
              atleti={atleti}
              selected_ids={form.atleti_ids || []}
              on_change={(ids) => on_change("atleti_ids", ids)}
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Costo totale</label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-xs font-medium pointer-events-none">
                CHF
              </span>
              <NumInput
                value={form.costo_totale ?? ""}
                onChange={(v) => on_change("costo_totale", to_num(v))}
                className="pl-11"
                placeholder="0.00"
              />
            </div>
          </div>
          <div
            onClick={() => on_change("ricorrente", !form.ricorrente)}
            className={`flex items-center gap-3 p-3 rounded-xl border-2 cursor-pointer transition-all
              ${form.ricorrente ? "border-primary bg-primary/5 text-primary" : "border-border bg-muted/20 text-muted-foreground hover:border-primary/40"}`}
          >
            <div
              className={`w-5 h-5 rounded-md border-2 flex items-center justify-center flex-shrink-0
              ${form.ricorrente ? "border-primary bg-primary" : "border-muted-foreground"}`}
            >
              {form.ricorrente && <Check className="w-3 h-3 text-white" />}
            </div>
            <div>
              <p className="text-sm font-medium">Lezione ricorrente</p>
              <p className="text-xs opacity-70">Ogni settimana alla stessa ora fino a fine stagione</p>
            </div>
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Note</label>
            <textarea
              value={form.note || ""}
              onChange={(e) => on_change("note", e.target.value)}
              rows={2}
              placeholder="Note opzionali..."
              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-primary/40"
            />
          </div>
        </div>

        {/* Footer fisso */}
        <div className="flex justify-end gap-3 px-6 py-4 border-t border-border flex-shrink-0">
          <Button variant="outline" onClick={on_close} disabled={loading}>
            Annulla
          </Button>
          <Button
            onClick={on_submit}
            disabled={loading || !form.atleti_ids?.length}
            className="bg-primary hover:bg-primary/90 min-w-[110px]"
          >
            {loading ? (
              <span className="flex items-center gap-2">
                <span className="animate-spin rounded-full h-4 w-4 border-b-2 border-white" />
                Salvo...
              </span>
            ) : form.ricorrente ? (
              "📅 Crea ricorrente"
            ) : (
              "Prenota"
            )}
          </Button>
        </div>
      </div>
    </div>
  );
};

// ─── Modal aggiungi atleta (semiprivata) ───────────────────
const AggiungiAtletaModal: React.FC<{
  slot: any;
  atleti: any[];
  costo_attuale: number;
  on_close: () => void;
  on_confirm: (atleta_id: string, nuovo_costo: number, modalita: "dividi" | "manuale") => void;
  loading: boolean;
}> = ({ slot, atleti, costo_attuale, on_close, on_confirm, loading }) => {
  const [atleta_id, set_atleta_id] = useState<string>("");
  const [modalita, set_modalita] = useState<"dividi" | "manuale">("dividi");
  const [costo_manuale_str, set_costo_manuale_str] = useState<string>(costo_attuale.toFixed(2));

  const atleti_esistenti = slot.lesson?.atleti_ids || [];
  const n_totale = atleti_esistenti.length + 1;
  const costo_diviso = modalita === "dividi" ? costo_attuale : to_num(costo_manuale_str);
  const quota_per_atleta = costo_diviso / n_totale;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <div className="bg-card rounded-2xl shadow-xl w-full max-w-sm flex flex-col max-h-[90vh]">
        <div className="flex items-center justify-between px-6 py-4 border-b border-border flex-shrink-0">
          <div>
            <h2 className="text-base font-bold text-foreground">Aggiungi atleta</h2>
            <p className="text-xs text-muted-foreground">La lezione diventerà semiprivata</p>
          </div>
          <button onClick={on_close} className="text-muted-foreground hover:text-foreground">
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="px-6 py-5 space-y-5 overflow-y-auto flex-1">
          <div className="flex items-center gap-2 px-3 py-2 bg-orange-500/10 border border-orange-500/20 rounded-xl">
            <span className="text-orange-500 text-sm">👥</span>
            <span className="text-xs font-medium text-orange-600">Diventerà una lezione semiprivata</span>
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
              Nuova atleta *
            </label>
            <AtletaSearch
              atleti={atleti}
              selected_ids={atleta_id ? [atleta_id] : []}
              on_change={(ids) => set_atleta_id(ids[ids.length - 1] || "")}
              escludi_ids={atleti_esistenti}
            />
          </div>
          <div className="space-y-3">
            <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
              Gestione costo
            </label>
            <div className="grid grid-cols-2 gap-2">
              <div
                onClick={() => set_modalita("dividi")}
                className={`p-3 rounded-xl border-2 cursor-pointer transition-all text-center
                  ${modalita === "dividi" ? "border-primary bg-primary/5" : "border-border hover:border-primary/40"}`}
              >
                <p className="text-sm font-medium">÷ Dividi</p>
                <p className="text-xs text-muted-foreground mt-0.5">Costo attuale diviso per {n_totale}</p>
              </div>
              <div
                onClick={() => set_modalita("manuale")}
                className={`p-3 rounded-xl border-2 cursor-pointer transition-all text-center
                  ${modalita === "manuale" ? "border-primary bg-primary/5" : "border-border hover:border-primary/40"}`}
              >
                <p className="text-sm font-medium">✏️ Manuale</p>
                <p className="text-xs text-muted-foreground mt-0.5">Imposta nuovo totale</p>
              </div>
            </div>
            {modalita === "manuale" && (
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-xs font-medium pointer-events-none">
                  CHF
                </span>
                <NumInput
                  value={costo_manuale_str}
                  onChange={(v) => set_costo_manuale_str(v)}
                  className="pl-11"
                  placeholder="0.00"
                />
              </div>
            )}
            <div className="bg-muted/30 rounded-xl px-4 py-3 space-y-1.5">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Riepilogo quote</p>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Totale lezione</span>
                <span className="font-semibold">CHF {costo_diviso.toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Quota per atleta ({n_totale})</span>
                <span className="font-semibold text-primary">CHF {quota_per_atleta.toFixed(2)}</span>
              </div>
            </div>
          </div>
        </div>
        <div className="flex justify-end gap-3 px-6 py-4 border-t border-border flex-shrink-0">
          <Button variant="outline" onClick={on_close} disabled={loading}>
            Annulla
          </Button>
          <Button
            onClick={() => atleta_id && on_confirm(atleta_id, costo_diviso, modalita)}
            disabled={loading || !atleta_id}
            className="bg-orange-500 hover:bg-orange-600 text-white min-w-[120px]"
          >
            {loading ? (
              <span className="flex items-center gap-2">
                <span className="animate-spin rounded-full h-4 w-4 border-b-2 border-white" />
                Salvo...
              </span>
            ) : (
              "👥 Aggiungi atleta"
            )}
          </Button>
        </div>
      </div>
    </div>
  );
};

// ─── Modal dettaglio slot occupato ────────────────────────
const SlotDetailModal: React.FC<{
  slot: any;
  atleti: any[];
  on_close: () => void;
  on_annulla: () => void;
  on_modifica: () => void;
  on_aggiungi_atleta: () => void;
  loading: boolean;
}> = ({ slot, atleti, on_close, on_annulla, on_modifica, on_aggiungi_atleta, loading }) => {
  const atleti_ids: string[] = slot.lesson?.atleti_ids || [];
  const tipo = get_tipo_lezione(atleti_ids);
  const is_semiprivata = tipo === "semiprivata";
  const nomi_atleti = atleti_ids
    .map((id: string) => {
      const a = atleti.find((x: any) => x.id === id);
      return a ? `${a.nome} ${a.cognome}` : null;
    })
    .filter(Boolean);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <div className="bg-card rounded-2xl shadow-xl w-full max-w-sm flex flex-col max-h-[90vh]">
        <div className="flex items-center justify-between px-6 py-4 border-b border-border flex-shrink-0">
          <div className="flex items-center gap-2">
            <h2 className="text-base font-bold text-foreground">Dettaglio lezione</h2>
            {is_semiprivata ? (
              <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-orange-500/15 text-orange-600 border border-orange-500/20">
                👥 Semiprivata
              </span>
            ) : (
              <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-destructive/10 text-destructive border border-destructive/20">
                🔒 Privata
              </span>
            )}
          </div>
          <button onClick={on_close} className="text-muted-foreground hover:text-foreground">
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="px-6 py-5 space-y-4 overflow-y-auto flex-1">
          <div className="flex items-center gap-3 p-3 bg-muted/30 rounded-xl">
            <Clock className="w-4 h-4 text-muted-foreground flex-shrink-0" />
            <span className="text-sm font-semibold text-foreground tabular-nums">
              {slot.time} – {slot.end_time}
            </span>
          </div>
          <div className="space-y-2">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Atleta/e</p>
            {nomi_atleti.length > 0 ? (
              nomi_atleti.map((nome: string, i: number) => (
                <div key={i} className="flex items-center gap-2 px-3 py-2 bg-primary/5 rounded-lg">
                  <User className="w-3.5 h-3.5 text-primary flex-shrink-0" />
                  <span className="text-sm font-medium text-foreground">{nome}</span>
                </div>
              ))
            ) : (
              <p className="text-sm text-muted-foreground italic">Nessun atleta registrato</p>
            )}
          </div>
          {slot.lesson?.costo > 0 && (
            <div className="flex items-center justify-between px-3 py-2 bg-muted/30 rounded-xl">
              <span className="text-xs text-muted-foreground font-medium">Costo totale</span>
              <span className="text-sm font-bold text-foreground">CHF {Number(slot.lesson.costo).toFixed(2)}</span>
            </div>
          )}
          {slot.lesson?.note && (
            <div className="space-y-1">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Note</p>
              <p className="text-sm text-foreground bg-muted/30 px-3 py-2 rounded-lg">{slot.lesson.note}</p>
            </div>
          )}
        </div>
        <div className="px-6 py-4 border-t border-border space-y-2 flex-shrink-0">
          <Button
            variant="outline"
            onClick={on_aggiungi_atleta}
            disabled={loading}
            className="w-full border-orange-500/40 text-orange-600 hover:bg-orange-500/10"
          >
            <UserPlus className="w-4 h-4 mr-2" /> Aggiungi atleta (semiprivata)
          </Button>
          <div className="flex gap-2">
            <Button variant="outline" onClick={on_modifica} disabled={loading} className="flex-1">
              ✏️ Modifica
            </Button>
            <Button variant="destructive" onClick={on_annulla} disabled={loading} className="flex-1">
              {loading ? <span className="animate-spin rounded-full h-4 w-4 border-b-2 border-white" /> : "× Annulla"}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};

// ─── Modal cambio durata slot ──────────────────────────────
const CambioDurataModal: React.FC<{
  durata_attuale: number;
  on_close: () => void;
  on_confirm: (nuova_durata: number, aggiorna_esistenti: boolean) => Promise<void>;
  saving: boolean;
}> = ({ durata_attuale, on_close, on_confirm, saving }) => {
  const [nuova_durata, set_nuova_durata] = useState(durata_attuale);
  const [aggiorna_esistenti, set_aggiorna_esistenti] = useState(false);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <div className="bg-card rounded-2xl shadow-xl w-full max-w-sm flex flex-col max-h-[90vh]">
        <div className="flex items-center justify-between px-6 py-4 border-b border-border flex-shrink-0">
          <h2 className="text-base font-bold text-foreground">Cambia durata slot</h2>
          <button onClick={on_close} className="text-muted-foreground hover:text-foreground">
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="px-6 py-5 space-y-4 overflow-y-auto flex-1">
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
              Nuova durata (minuti)
            </label>
            <div className="flex gap-2">
              {[15, 20, 30, 45, 60].map((m) => (
                <button
                  key={m}
                  onClick={() => set_nuova_durata(m)}
                  className={`flex-1 py-2 rounded-xl border-2 text-sm font-bold transition-all
                    ${nuova_durata === m ? "border-primary bg-primary/10 text-primary" : "border-border text-muted-foreground hover:border-primary/40"}`}
                >
                  {m}'
                </button>
              ))}
            </div>
          </div>
          <div className="bg-orange-50 border border-orange-200 rounded-xl px-4 py-3 space-y-3">
            <p className="text-xs font-bold text-orange-700">Cosa fare con le lezioni già esistenti?</p>
            <div className="space-y-2">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  checked={!aggiorna_esistenti}
                  onChange={() => set_aggiorna_esistenti(false)}
                  className="accent-primary"
                />
                <span className="text-sm text-foreground">Solo nuove prenotazioni (consigliato)</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  checked={aggiorna_esistenti}
                  onChange={() => set_aggiorna_esistenti(true)}
                  className="accent-primary"
                />
                <span className="text-sm text-foreground">Aggiorna anche le lezioni future esistenti</span>
              </label>
            </div>
          </div>
        </div>
        <div className="flex gap-2 px-6 py-4 border-t border-border flex-shrink-0">
          <Button variant="outline" onClick={on_close} disabled={saving} className="flex-1">
            Annulla
          </Button>
          <Button
            onClick={() => on_confirm(nuova_durata, aggiorna_esistenti)}
            disabled={saving || nuova_durata === durata_attuale}
            className="flex-1 bg-primary hover:bg-primary/90"
          >
            {saving ? "..." : "💾 Salva durata"}
          </Button>
        </div>
      </div>
    </div>
  );
};

// ─── Main Page ─────────────────────────────────────────────
const LezioniPrivatePage: React.FC = () => {
  const { data: lezioni = [], isLoading } = use_lezioni_private();
  const { data: istruttori = [] } = use_istruttori();
  const { data: atleti = [] } = use_atleti();
  const { data: corsi = [] } = use_corsi();
  const { data: setup } = use_setup_club();
  const { data: ghiaccio_disp = [] } = useQuery({
    queryKey: ["disponibilita_ghiaccio"],
    queryFn: async () => {
      const club_id = await get_current_club_id();
      const { data } = await supabase.from("disponibilita_ghiaccio").select("*").eq("club_id", club_id).eq("tipo", "ghiaccio");
      return data || [];
    },
  });
  const qc = useQueryClient();

  const crea_lezione = use_crea_lezione_privata();
  const annulla_lezione = use_annulla_lezione();
  const aggiungi_atleta_mut = use_aggiungi_atleta_lezione();

  const slot_minuti = setup?.slot_lezione_privata_minuti || 20;

  const [selected_istruttore, set_selected_istruttore] = useState<string>("");
  const [cal_year, set_cal_year] = useState(new Date().getFullYear());
  const [cal_month, set_cal_month] = useState(new Date().getMonth());
  const [selected_date, set_selected_date] = useState<string>(fmt(new Date()));
  const [form_open, set_form_open] = useState(false);
  const [form_data, set_form_data] = useState<Record<string, any>>({});
  const [saving, set_saving] = useState(false);
  const [detail_slot, set_detail_slot] = useState<any>(null);
  const [aggiungi_open, set_aggiungi_open] = useState(false);
  const [durata_modal, set_durata_modal] = useState(false);
  const [saving_durata, set_saving_durata] = useState(false);

  React.useEffect(() => {
    if (!selected_istruttore && istruttori.length > 0) set_selected_istruttore(istruttori[0].id);
  }, [istruttori, selected_istruttore]);

  const istruttore = istruttori.find((i: any) => i.id === selected_istruttore);

  const dispSlots = useMemo(() => {
    if (!istruttore?.disponibilita) return [];
    const slots: { giorno: string; ora_inizio: string; ora_fine: string }[] = [];
    for (const [giorno, times] of Object.entries(
      istruttore.disponibilita as Record<string, { ora_inizio: string; ora_fine: string }[]>,
    )) {
      for (const t of times) slots.push({ giorno, ora_inizio: t.ora_inizio, ora_fine: t.ora_fine });
    }
    return slots;
  }, [istruttore]);

  const corso_busy_by_day = useMemo(() => {
    if (!selected_istruttore) return {};
    const result: Record<string, { start: number; end: number }[]> = {};
    for (const c of corsi) {
      if (!c.istruttori_ids?.includes(selected_istruttore) || !c.attivo || !c.giorno) continue;
      if (!result[c.giorno]) result[c.giorno] = [];
      const s = time_to_min(c.ora_inizio || "00:00");
      const e = time_to_min(c.ora_fine || "00:00");
      if (e > s) result[c.giorno].push({ start: s, end: e });
    }
    return result;
  }, [corsi, selected_istruttore]);

  const get_slots_for_date = (date_str: string) => {
    if (!istruttore) return [];
    const date = new Date(date_str + "T00:00:00");
    const day_of_week = date.getDay();
    const giorno = GIORNI[day_of_week === 0 ? 6 : day_of_week - 1];
    const dayDispSlots = dispSlots.filter((ds: any) => ds.giorno === giorno);
    const avail_istruttore = dayDispSlots.map((ds) => ({ start: time_to_min(ds.ora_inizio), end: time_to_min(ds.ora_fine) }));
    const ice_slots = ghiaccio_disp.filter((g: any) => g.giorno === giorno);
    const ice_intervals = ice_slots.map((g: any) => ({ start: time_to_min(g.ora_inizio), end: time_to_min(g.ora_fine) }));
    const busy_corsi = corso_busy_by_day[giorno] || [];
    // Slots with ice
    const avail_with_ice = ice_intervals.length > 0
      ? intersect_intervals(avail_istruttore, ice_intervals)
      : avail_istruttore;
    const free_with_ice = subtract_intervals(avail_with_ice, busy_corsi);
    const ice_times = new Set<number>();
    for (const interval of free_with_ice) {
      for (let m = interval.start; m + slot_minuti <= interval.end; m += slot_minuti) ice_times.add(m);
    }
    // All instructor slots (including off-ice)
    const free_all = subtract_intervals(avail_istruttore, busy_corsi);
    const all_free_times = new Set<number>();
    for (const interval of free_all) {
      for (let m = interval.start; m + slot_minuti <= interval.end; m += slot_minuti) all_free_times.add(m);
    }
    const day_lessons = lezioni.filter((l: any) => l.istruttore_id === selected_istruttore && l.data === date_str);
    const all_times = new Set(all_free_times);
    for (const l of day_lessons) all_times.add(time_to_min(l.ora_inizio));
    return Array.from(all_times)
      .sort((a, b) => a - b)
      .map((m) => {
        const time = min_to_time(m);
        const lesson = day_lessons.find((l: any) => time_to_min(l.ora_inizio) === m);
        const tipo = lesson ? get_tipo_lezione(lesson.atleti_ids || []) : null;
        const has_ice = ice_times.has(m);
        return { time, end_time: min_to_time(m + slot_minuti), status: lesson ? "occupato" : "libero", lesson, tipo, has_ice };
      });
  };

  const month_info = useMemo(() => {
    if (!istruttore) return {};
    const result: Record<string, { liberi: number; occupati: number }> = {};
    const days_in_month = new Date(cal_year, cal_month + 1, 0).getDate();
    for (let d = 1; d <= days_in_month; d++) {
      const date_str = fmt(new Date(cal_year, cal_month, d));
      const slots = get_slots_for_date(date_str);
      result[date_str] = {
        liberi: slots.filter((s) => s.status === "libero").length,
        occupati: slots.filter((s) => s.status === "occupato").length,
      };
    }
    return result;
  }, [istruttore, cal_year, cal_month, lezioni, corso_busy_by_day, dispSlots, slot_minuti, ghiaccio_disp]);

  const cal_days = useMemo(() => {
    const first = new Date(cal_year, cal_month, 1);
    const first_dow = first.getDay();
    const offset = first_dow === 0 ? 6 : first_dow - 1;
    const days_in_month = new Date(cal_year, cal_month + 1, 0).getDate();
    const cells: (number | null)[] = [];
    for (let i = 0; i < offset; i++) cells.push(null);
    for (let d = 1; d <= days_in_month; d++) cells.push(d);
    return cells;
  }, [cal_year, cal_month]);

  const prev_month = () => {
    if (cal_month === 0) {
      set_cal_year((y) => y - 1);
      set_cal_month(11);
    } else set_cal_month((m) => m - 1);
  };
  const next_month = () => {
    if (cal_month === 11) {
      set_cal_year((y) => y + 1);
      set_cal_month(0);
    } else set_cal_month((m) => m + 1);
  };

  const open_slot = (time: string, end_time: string) => {
    const costo = (istruttore?.costo_minuto_lezione_privata || 0) * slot_minuti;
    set_form_data({
      istruttore_id: selected_istruttore,
      data: selected_date,
      ora_inizio: time,
      ora_fine: end_time,
      durata_minuti: slot_minuti,
      atleti_ids: [],
      ricorrente: false,
      costo_totale: costo,
      note: "",
    });
    set_form_open(true);
  };

  const handle_annulla = async () => {
    if (!detail_slot?.lesson) return;
    if (!window.confirm("Annullare questa lezione e liberare lo slot?")) return;
    try {
      await annulla_lezione.mutateAsync(detail_slot.lesson.id);
      set_detail_slot(null);
      toast({ title: "Lezione annullata — slot liberato" });
    } catch (err: any) {
      toast({ title: "Errore annullamento", description: err?.message, variant: "destructive" });
    }
  };

  const handle_modifica = () => {
    if (!detail_slot?.lesson) return;
    const lesson = detail_slot.lesson;
    set_form_data({
      istruttore_id: selected_istruttore,
      data: selected_date,
      ora_inizio: lesson.ora_inizio,
      ora_fine: lesson.ora_fine,
      durata_minuti: lesson.durata_minuti || slot_minuti,
      atleti_ids: lesson.atleti_ids || [],
      ricorrente: false,
      costo_totale: lesson.costo || 0,
      note: lesson.note || "",
    });
    set_detail_slot(null);
    set_form_open(true);
  };

  const handle_aggiungi_atleta = async (atleta_id: string, nuovo_costo: number, modalita: "dividi" | "manuale") => {
    if (!detail_slot?.lesson) return;
    try {
      await aggiungi_atleta_mut.mutateAsync({
        lezione_id: detail_slot.lesson.id,
        atleta_id,
        nuovo_costo_totale: nuovo_costo,
        modalita_costo: modalita,
        atleti_ids_esistenti: detail_slot.lesson.atleti_ids || [],
      });
      set_aggiungi_open(false);
      set_detail_slot(null);
      toast({ title: "👥 Atleta aggiunta — lezione diventata semiprivata!" });
    } catch (err: any) {
      toast({ title: "Errore", description: err?.message, variant: "destructive" });
    }
  };

  const handle_submit = async () => {
    if (!form_data.atleti_ids?.length) {
      toast({ title: "Seleziona almeno un atleta", variant: "destructive" });
      return;
    }
    set_saving(true);
    try {
      // Build athlete names for the corso record
      const atleti_nomi = (form_data.atleti_ids || []).map((aid: string) => {
        const a = atleti.find((x: any) => x.id === aid);
        return a ? a.nome : "?";
      });
      await crea_lezione.mutateAsync({
        istruttore_id: form_data.istruttore_id,
        data: form_data.data,
        ora_inizio: form_data.ora_inizio,
        ora_fine: form_data.ora_fine,
        durata_minuti: form_data.durata_minuti,
        atleti_ids: form_data.atleti_ids,
        atleti_nomi,
        ricorrente: form_data.ricorrente,
        costo_totale: form_data.costo_totale || 0,
        note: form_data.note || "",
      });
      set_form_open(false);
      toast({
        title: form_data.ricorrente ? "📅 Lezioni ricorrenti create fino a fine stagione!" : "✅ Lezione prenotata!",
      });
    } catch (err: any) {
      toast({
        title: "Errore durante il salvataggio",
        description: err?.message ?? "Controlla la console.",
        variant: "destructive",
      });
    } finally {
      set_saving(false);
    }
  };

  const handle_cambia_durata = async (nuova_durata: number, aggiorna_esistenti: boolean) => {
    set_saving_durata(true);
    try {
      const { error } = await supabase
        .from("setup_club")
        .update({ slot_lezione_privata_minuti: nuova_durata })
        .eq("club_id", get_current_club_id());
      if (error) throw error;
      if (aggiorna_esistenti) {
        const today = fmt(new Date());
        const { error: e2 } = await supabase
          .from("lezioni_private")
          .update({ durata_minuti: nuova_durata })
          .eq("club_id", get_current_club_id())
          .gte("data", today)
          .eq("annullata", false);
        if (e2) throw e2;
        await qc.invalidateQueries({ queryKey: ["lezioni_private"] });
      }
      await qc.invalidateQueries({ queryKey: ["setup_club"] });
      set_durata_modal(false);
      toast({
        title: `✅ Durata slot aggiornata a ${nuova_durata} minuti`,
        description: aggiorna_esistenti
          ? "Le lezioni future sono state aggiornate."
          : "Valida per le nuove prenotazioni.",
      });
    } catch (err: any) {
      toast({ title: "Errore salvataggio durata", description: err?.message, variant: "destructive" });
    } finally {
      set_saving_durata(false);
    }
  };

  const get_atleti_names = (atleti_ids: string[]): string => {
    return atleti_ids
      .map((id) => {
        const a = atleti.find((x: any) => x.id === id);
        return a ? `${a.nome} ${a.cognome}` : null;
      })
      .filter(Boolean)
      .join(", ");
  };

  const today = fmt(new Date());
  const selected_slots = get_slots_for_date(selected_date);
  const selected_date_obj = new Date(selected_date + "T00:00:00");
  const is_today = selected_date === today;
  const now_minutes = (() => { const n = new Date(); return n.getHours() * 60 + n.getMinutes(); })();
  const selected_label = selected_date_obj.toLocaleDateString("it-CH", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });

  if (isLoading)
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );

  return (
    <>
      {form_open && (
        <SlotModal
          form={form_data}
          atleti={atleti}
          slot_minuti={slot_minuti}
          on_change={(k, v) => set_form_data((p) => ({ ...p, [k]: v }))}
          on_submit={handle_submit}
          on_close={() => set_form_open(false)}
          loading={saving}
        />
      )}
      {detail_slot && !aggiungi_open && (
        <SlotDetailModal
          slot={detail_slot}
          atleti={atleti}
          on_close={() => set_detail_slot(null)}
          on_annulla={handle_annulla}
          on_modifica={handle_modifica}
          on_aggiungi_atleta={() => set_aggiungi_open(true)}
          loading={annulla_lezione.isPending}
        />
      )}
      {detail_slot && aggiungi_open && (
        <AggiungiAtletaModal
          slot={detail_slot}
          atleti={atleti}
          costo_attuale={detail_slot.lesson?.costo || 0}
          on_close={() => set_aggiungi_open(false)}
          on_confirm={handle_aggiungi_atleta}
          loading={aggiungi_atleta_mut.isPending}
        />
      )}
      {durata_modal && (
        <CambioDurataModal
          durata_attuale={slot_minuti}
          on_close={() => set_durata_modal(false)}
          on_confirm={handle_cambia_durata}
          saving={saving_durata}
        />
      )}

      <div className="space-y-6 animate-fade-in">
        <div className="flex items-center justify-between">
          <h1 className="text-xl font-bold tracking-tight text-foreground">Lezioni Private</h1>
          <Button variant="outline" size="sm" onClick={() => set_durata_modal(true)} className="gap-2 text-xs">
            <Settings className="w-3.5 h-3.5" /> Slot: {slot_minuti} min
          </Button>
        </div>

        <div className="w-64">
          <Select value={selected_istruttore} onValueChange={set_selected_istruttore}>
            <SelectTrigger>
              <SelectValue placeholder="Seleziona istruttore" />
            </SelectTrigger>
            <SelectContent>
              {istruttori
                .filter((i: any) => i.attivo)
                .map((i: any) => (
                  <SelectItem key={i.id} value={i.id}>
                    {i.nome} {i.cognome}
                  </SelectItem>
                ))}
            </SelectContent>
          </Select>
        </div>

        {istruttore ? (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* ── Calendario ── */}
            <div className="bg-card rounded-2xl shadow-card p-5">
              <div className="flex items-center justify-between mb-4">
                <button onClick={prev_month} className="p-1.5 rounded-lg hover:bg-muted/50 transition-colors">
                  <ChevronLeft className="w-4 h-4 text-muted-foreground" />
                </button>
                <h2 className="text-sm font-bold text-foreground">
                  {MESI[cal_month]} {cal_year}
                </h2>
                <button onClick={next_month} className="p-1.5 rounded-lg hover:bg-muted/50 transition-colors">
                  <ChevronRight className="w-4 h-4 text-muted-foreground" />
                </button>
              </div>
              <div className="grid grid-cols-7 mb-2">
                {GIORNI_SHORT.map((g) => (
                  <div key={g} className="text-center text-[10px] font-bold text-muted-foreground uppercase py-1">
                    {g}
                  </div>
                ))}
              </div>
              <div className="grid grid-cols-7 gap-1">
                {cal_days.map((day, i) => {
                  if (!day) return <div key={i} />;
                  const date_str = fmt(new Date(cal_year, cal_month, day));
                  const info = month_info[date_str] || { liberi: 0, occupati: 0 };
                  const is_selected = date_str === selected_date;
                  const is_today = date_str === today;
                  const is_past = date_str < today;
                  const has_slots = info.liberi > 0 || info.occupati > 0;
                  return (
                    <button
                      key={i}
                      onClick={() => set_selected_date(date_str)}
                      disabled={is_past && !has_slots}
                      className={`relative flex flex-col items-center justify-center rounded-xl py-2 text-sm font-medium transition-all
                        ${is_past ? "opacity-40 cursor-default" : ""}
                        ${is_selected ? "bg-primary text-primary-foreground shadow-md" : is_today ? "ring-2 ring-primary text-primary" : has_slots ? "hover:bg-muted/50 text-foreground" : "text-muted-foreground/40 cursor-default"}`}
                    >
                      {day}
                      {has_slots && (
                        <div className="flex gap-0.5 mt-0.5">
                          {info.occupati > 0 && (
                            <div
                              className={`w-1.5 h-1.5 rounded-full ${is_selected ? "bg-white/70" : "bg-destructive/70"}`}
                            />
                          )}
                          {info.liberi > 0 && !is_past && (
                            <div className={`w-1.5 h-1.5 rounded-full ${is_selected ? "bg-white" : "bg-success"}`} />
                          )}
                        </div>
                      )}
                    </button>
                  );
                })}
              </div>
              <div className="flex items-center gap-4 mt-4 text-xs text-muted-foreground">
                <div className="flex items-center gap-1.5">
                  <div className="w-2 h-2 rounded-full bg-success" /> Libero
                </div>
                <div className="flex items-center gap-1.5">
                  <div className="w-2 h-2 rounded-full bg-destructive/70" /> Prenotato
                </div>
              </div>
            </div>

            {/* ── Slot giorno ── */}
            <div className="bg-card rounded-2xl shadow-card p-5">
              <h3 className="text-sm font-bold text-foreground capitalize mb-4">{selected_label}</h3>
              {selected_slots.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-40 text-muted-foreground">
                  <Clock className="w-8 h-8 mb-2 opacity-30" />
                  <p className="text-sm">Nessuno slot disponibile</p>
                  <p className="text-xs mt-1 opacity-70">L'istruttore non è disponibile in questo giorno</p>
                </div>
              ) : (
                <div className="space-y-2 max-h-[420px] overflow-y-auto pr-1">
                  {selected_slots.map((slot, i) => {
                    const is_semiprivata = slot.tipo === "semiprivata";
                    const is_past_date = selected_date < today;
                    const is_free = slot.status === "libero";
                    const is_off_ice = is_free && !slot.has_ice;
                    const is_past_time = is_today && time_to_min(slot.time) <= now_minutes;
                    // Hide free slots on past dates or past times today
                    if (is_free && (is_past_date || is_past_time)) return null;
                    return (
                      <div
                        key={i}
                        onClick={() =>
                          is_free && !is_past_date ? open_slot(slot.time, slot.end_time) : !is_free ? set_detail_slot(slot) : undefined
                        }
                        className={`flex items-center justify-between px-4 py-3 rounded-xl transition-all
                          ${is_free && is_past_date ? "opacity-40 cursor-default" : "cursor-pointer"}
                          ${is_off_ice
                            ? "bg-sky-500/10 hover:bg-sky-500/20 border border-sky-500/20"
                            : is_free
                              ? "bg-success/10 hover:bg-success/20 border border-success/20"
                              : is_semiprivata
                                ? "bg-orange-500/10 hover:bg-orange-500/15 border border-orange-500/20"
                                : "bg-destructive/10 hover:bg-destructive/15 border border-destructive/20"}`}
                      >
                        <div className="flex items-center gap-3">
                          <div
                            className={`w-2 h-2 rounded-full flex-shrink-0 ${is_off_ice ? "bg-sky-500" : is_free ? "bg-success" : is_semiprivata ? "bg-orange-500" : "bg-destructive"}`}
                          />
                          <div>
                            <p className="text-sm font-semibold text-foreground tabular-nums">
                              {slot.time} – {slot.end_time}
                            </p>
                            {is_off_ice && (
                              <p className="text-xs text-sky-600 mt-0.5">⛸️ Fuori ghiaccio</p>
                            )}
                            {slot.status === "occupato" && slot.lesson && (
                              <p className="text-xs text-muted-foreground mt-0.5">
                                {slot.lesson.atleti_ids?.length
                                  ? get_atleti_names(slot.lesson.atleti_ids)
                                  : slot.lesson.note || "Occupato"}
                              </p>
                            )}
                          </div>
                        </div>
                        <span
                          className={`text-xs font-bold px-2 py-0.5 rounded-full ${is_off_ice ? "bg-sky-500/20 text-sky-600" : is_free ? "bg-success/20 text-success" : is_semiprivata ? "bg-orange-500/20 text-orange-600" : "bg-destructive/20 text-destructive"}`}
                        >
                          {is_off_ice ? "🏋️ Off-Ice" : is_free ? "+ Prenota" : is_semiprivata ? "👥 Semi" : "Dettagli"}
                        </span>
                      </div>
                    );
                  })}
                </div>
              )}
              <div className="flex items-center gap-4 mt-4 text-xs text-muted-foreground flex-wrap">
                <div className="flex items-center gap-1.5">
                  <div className="w-2 h-2 rounded-full bg-success" /> Libero (ghiaccio)
                </div>
                <div className="flex items-center gap-1.5">
                  <div className="w-2 h-2 rounded-full bg-sky-500" /> Fuori ghiaccio
                </div>
                <div className="flex items-center gap-1.5">
                  <div className="w-2 h-2 rounded-full bg-destructive" /> Privata
                </div>
                <div className="flex items-center gap-1.5">
                  <div className="w-2 h-2 rounded-full bg-orange-500" /> Semiprivata
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div className="bg-card rounded-2xl shadow-card p-8 text-center text-muted-foreground">
            Seleziona un istruttore per vedere le disponibilità
          </div>
        )}
      </div>
    </>
  );
};

export default LezioniPrivatePage;
