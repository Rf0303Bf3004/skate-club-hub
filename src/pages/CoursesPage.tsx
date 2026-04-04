import React, { useState, useMemo, useEffect } from "react";
import { useI18n } from "@/lib/i18n";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  use_corsi,
  use_istruttori,
  use_atleti,
  use_atleti_monitori,
  use_presenze_corso,
  get_istruttore_name_from_list,
} from "@/hooks/use-supabase-data";
import { use_upsert_corso, use_elimina_corso, use_upsert_presenza_corso } from "@/hooks/use-supabase-mutations";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Plus,
  AlertTriangle,
  X,
  ChevronDown,
  Search,
  UserPlus,
  Trash2,
  MessageCircle,
  CheckCircle,
  XCircle,
  Clock,
  ArrowRightLeft,
  Users,
} from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { supabase, get_current_club_id } from "@/lib/supabase";

const GIORNI_DB = ["Lunedì", "Martedì", "Mercoledì", "Giovedì", "Venerdì", "Sabato", "Domenica"];

const LIVELLI_CORSO = [
  "tutti", "pulcini", "stellina1", "stellina2", "stellina3", "stellina4",
  "Interbronzo", "Bronzo", "Interargento", "Argento", "Interoro", "Oro",
];

const LIVELLO_LABELS: Record<string, string> = {
  tutti: "Tutti i livelli",
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

function get_atleta_livello(atleta: any): string {
  return atleta.carriera_artistica || atleta.carriera_stile || atleta.percorso_amatori || "Pulcini";
}

function normalize_livello(l: string): string {
  if (!l) return "pulcini";
  const map: Record<string, string> = {
    "pulcini": "pulcini",
    "stellina 1": "stellina1", "stellina1": "stellina1", "stelline 1": "stellina1",
    "stellina 2": "stellina2", "stellina2": "stellina2", "stelline 2": "stellina2",
    "stellina 3": "stellina3", "stellina3": "stellina3", "stelline 3": "stellina3",
    "stellina 4": "stellina4", "stellina4": "stellina4", "stelline 4": "stellina4",
    "interbronzo": "Interbronzo",
    "bronzo": "Bronzo",
    "interargento": "Interargento",
    "argento": "Argento",
    "interoro": "Interoro",
    "oro": "Oro",
  };
  return map[l.toLowerCase()] ?? l;
}

function is_livello_compatibile(atleta: any, livello_richiesto: string): boolean {
  if (!livello_richiesto || livello_richiesto === "tutti") return true;
  const livello_atleta = normalize_livello(get_atleta_livello(atleta));
  const livello_corso = normalize_livello(livello_richiesto);
  return livello_atleta === livello_corso;
}

function time_to_min(t: string): number {
  const [h, m] = (t || "00:00").split(":").map(Number);
  return h * 60 + (m || 0);
}

function is_istruttore_disponibile(istruttore: any, giorno: string, ora_inizio: string, ora_fine: string): boolean {
  const slots = istruttore.disponibilita?.[giorno] || [];
  if (slots.length === 0) return false;
  const corso_start = time_to_min(ora_inizio);
  const corso_end = time_to_min(ora_fine);
  return slots.some((s: any) => time_to_min(s.ora_inizio) <= corso_start && time_to_min(s.ora_fine) >= corso_end);
}

function use_tipi_corso() {
  return useQuery({
    queryKey: ["tipi_corso", get_current_club_id()],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("tipi_corso")
        .select("nome")
        .eq("club_id", get_current_club_id())
        .order("nome");
      if (error) throw error;
      return (data ?? []).map((t: any) => t.nome as string);
    },
  });
}

// ─── NumInput ──────────────────────────────────────────────
function to_num(v: string | number): number {
  if (typeof v === "number") return isNaN(v) ? 0 : v;
  const n = parseFloat(String(v).replace(",", "."));
  return isNaN(n) ? 0 : n;
}

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

const Field: React.FC<{ label: string; children: React.ReactNode; required?: boolean }> = ({
  label,
  children,
  required,
}) => (
  <div className="space-y-1.5">
    <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
      {label}
      {required && " *"}
    </label>
    {children}
  </div>
);

const TipoCorsoSelect: React.FC<{
  value: string;
  on_change: (v: string) => void;
  tipi: string[];
  on_add_tipo: (nome: string) => Promise<void>;
}> = ({ value, on_change, tipi, on_add_tipo }) => {
  const [show_aggiungi, set_show_aggiungi] = useState(false);
  const [nuovo_tipo, set_nuovo_tipo] = useState("");
  const [adding, set_adding] = useState(false);

  const handle_aggiungi = async () => {
    const nome = nuovo_tipo.trim();
    if (!nome) return;
    if (tipi.includes(nome)) {
      on_change(nome);
      set_show_aggiungi(false);
      set_nuovo_tipo("");
      return;
    }
    set_adding(true);
    try {
      await on_add_tipo(nome);
      on_change(nome);
      set_show_aggiungi(false);
      set_nuovo_tipo("");
    } finally {
      set_adding(false);
    }
  };

  return (
    <div className="space-y-2">
      <div className="relative">
        <select
          value={value}
          onChange={(e) => {
            if (e.target.value === "__nuovo__") {
              set_show_aggiungi(true);
            } else {
              on_change(e.target.value);
              set_show_aggiungi(false);
            }
          }}
          className={`${input_cls} appearance-none pr-8`}
        >
          <option value="">Nessun tipo</option>
          {tipi.map((t) => (
            <option key={t} value={t}>
              {t}
            </option>
          ))}
          <option value="__nuovo__">➕ Aggiungi nuovo tipo...</option>
        </select>
        <ChevronDown className="w-4 h-4 text-muted-foreground absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none" />
      </div>
      {show_aggiungi && (
        <div className="flex gap-2 p-3 bg-primary/5 border border-primary/20 rounded-xl">
          <input
            type="text"
            value={nuovo_tipo}
            onChange={(e) => set_nuovo_tipo(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handle_aggiungi()}
            placeholder="Nome nuovo tipo..."
            autoFocus
            className={input_cls}
          />
          <Button
            size="sm"
            onClick={handle_aggiungi}
            disabled={adding || !nuovo_tipo.trim()}
            className="bg-primary hover:bg-primary/90 h-8"
          >
            {adding ? "..." : "Aggiungi"}
          </Button>
          <Button
            size="sm"
            variant="ghost"
            onClick={() => {
              set_show_aggiungi(false);
              set_nuovo_tipo("");
            }}
            className="h-8 w-8 p-0"
          >
            <X className="w-3.5 h-3.5" />
          </Button>
        </div>
      )}
    </div>
  );
};

// ─── Tab Iscrizioni ────────────────────────────────────────
const TabIscrizioni: React.FC<{
  corso_id: string;
  livello_richiesto: string;
  atleti_iscritti_ids: string[];
  tutti_atleti: any[];
  on_refresh: () => void;
}> = ({ corso_id, livello_richiesto, atleti_iscritti_ids, tutti_atleti, on_refresh }) => {
  const [query, set_query] = useState("");
  const [saving, set_saving] = useState(false);
  const [removing, set_removing] = useState<string | null>(null);
  const [salto_dialog, set_salto_dialog] = useState<any>(null);
  const [note_salto, set_note_salto] = useState("");

  const atleti_iscritti = tutti_atleti.filter((a: any) => atleti_iscritti_ids.includes(a.id));
  const atleti_disponibili = useMemo(() => {
    const q = query.toLowerCase();
    const filtered = tutti_atleti
      .filter((a: any) => a.stato === "attivo" && !atleti_iscritti_ids.includes(a.id))
      .filter((a: any) => !q || `${a.nome} ${a.cognome}`.toLowerCase().includes(q));
    // Sort: compatible first, then incompatible
    filtered.sort((a, b) => {
      const a_ok = is_livello_compatibile(a, livello_richiesto) ? 0 : 1;
      const b_ok = is_livello_compatibile(b, livello_richiesto) ? 0 : 1;
      if (a_ok !== b_ok) return a_ok - b_ok;
      return (a.cognome || "").localeCompare(b.cognome || "", "it");
    });
    return filtered.slice(0, 30);
  }, [tutti_atleti, atleti_iscritti_ids, query, livello_richiesto]);

  const do_iscrivi = async (atleta_id: string, salto_livello = false, note_sl = "") => {
    set_saving(true);
    try {
      const payload: any = {
        corso_id,
        atleta_id,
        attiva: true,
        data_iscrizione: new Date().toISOString().split("T")[0],
        salto_livello,
        note_salto_livello: note_sl || "",
      };
      const { error } = await supabase.from("iscrizioni_corsi").insert(payload);
      if (error) throw error;
      set_query("");
      on_refresh();
      toast({ title: salto_livello ? "⚠️ Iscrizione con salto di livello" : "✅ Atleta iscritta al corso" });
    } catch (err: any) {
      toast({ title: "Errore iscrizione", description: err?.message, variant: "destructive" });
    } finally {
      set_saving(false);
      set_salto_dialog(null);
      set_note_salto("");
    }
  };

  const handle_iscrivi = (atleta: any) => {
    if (!livello_richiesto || livello_richiesto === "tutti") {
      do_iscrivi(atleta.id);
      return;
    }
    if (is_livello_compatibile(atleta, livello_richiesto)) {
      do_iscrivi(atleta.id);
      return;
    }
    // Level mismatch → show confirmation
    set_salto_dialog(atleta);
    set_note_salto("");
  };

  const handle_rimuovi = async (atleta_id: string) => {
    set_removing(atleta_id);
    try {
      const { error } = await supabase
        .from("iscrizioni_corsi")
        .delete()
        .eq("corso_id", corso_id)
        .eq("atleta_id", atleta_id);
      if (error) throw error;
      on_refresh();
      toast({ title: "🗑️ Atleta rimossa dal corso" });
    } catch (err: any) {
      toast({ title: "Errore rimozione", description: err?.message, variant: "destructive" });
    } finally {
      set_removing(null);
    }
  };

  const livello_label = LIVELLO_LABELS[livello_richiesto] || livello_richiesto || "Tutti";

  return (
    <div className="space-y-4">
      {/* Level jump confirmation dialog */}
      {salto_dialog && (
        <div className="bg-orange-50 border border-orange-200 rounded-xl p-4 space-y-3">
          <div className="flex items-start gap-2">
            <AlertTriangle className="w-5 h-5 text-orange-500 flex-shrink-0 mt-0.5" />
            <div className="space-y-1">
              <p className="text-sm font-bold text-orange-700">Attenzione: salto di livello</p>
              <p className="text-xs text-orange-600">
                <strong>{salto_dialog.nome} {salto_dialog.cognome}</strong> ha livello{" "}
                <strong>{get_atleta_livello(salto_dialog)}</strong>, ma il corso richiede{" "}
                <strong>{livello_label}</strong>.
              </p>
              <p className="text-xs text-orange-600">Stai richiedendo un salto di livello. Vuoi procedere comunque?</p>
            </div>
          </div>
          <div className="space-y-2">
            <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
              Note salto di livello (opzionale)
            </label>
            <textarea
              value={note_salto}
              onChange={(e) => set_note_salto(e.target.value)}
              placeholder="Motivazione del salto di livello..."
              rows={2}
              className={`${input_cls} resize-none`}
            />
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => set_salto_dialog(null)} className="flex-1">
              Annulla
            </Button>
            <Button
              size="sm"
              onClick={() => do_iscrivi(salto_dialog.id, true, note_salto)}
              disabled={saving}
              className="flex-1 bg-orange-500 hover:bg-orange-600 text-white"
            >
              {saving ? "..." : "Conferma salto di livello"}
            </Button>
          </div>
        </div>
      )}

      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Aggiungi atleta</p>
          {livello_richiesto && livello_richiesto !== "tutti" && (
            <Badge variant="secondary" className="text-[10px]">Livello: {livello_label}</Badge>
          )}
        </div>
        <div className="relative">
          <Search className="w-3.5 h-3.5 text-muted-foreground absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            value={query}
            onChange={(e) => set_query(e.target.value)}
            placeholder="Filtra per nome..."
            className="w-full rounded-lg border border-border bg-background pl-9 pr-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
          />
        </div>
        <div className="border border-border rounded-xl overflow-hidden divide-y divide-border/50 max-h-56 overflow-y-auto">
          {atleti_disponibili.length === 0 ? (
            <p className="text-xs text-muted-foreground px-3 py-3 text-center">
              {query ? "Nessuna atleta trovata" : "Tutte le atlete sono già iscritte"}
            </p>
          ) : (
            atleti_disponibili.map((a: any) => {
              const livello = get_atleta_livello(a);
              const compatibile = is_livello_compatibile(a, livello_richiesto);
              return (
                <div
                  key={a.id}
                  className={`flex items-center justify-between px-3 py-2 hover:bg-muted/30 transition-colors ${!compatibile ? "bg-orange-50/50" : ""}`}
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <div className="w-6 h-6 rounded-full bg-muted flex items-center justify-center text-muted-foreground text-[10px] font-bold flex-shrink-0">
                      {a.nome[0]}{a.cognome[0]}
                    </div>
                    <div className="min-w-0">
                      <span className="text-sm text-foreground block truncate">
                        {a.cognome} {a.nome}
                      </span>
                      <div className="flex items-center gap-1.5">
                        <span className="text-[10px] text-muted-foreground">{livello}</span>
                        {!compatibile && (
                          <span className="text-[9px] font-bold text-orange-600 bg-orange-100 px-1 py-0.5 rounded">
                            Salto di livello
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => handle_iscrivi(a)}
                    disabled={saving}
                    className={`h-7 text-xs gap-1 flex-shrink-0 ${compatibile ? "text-primary hover:bg-primary/10" : "text-orange-600 hover:bg-orange-50"}`}
                  >
                    <UserPlus className="w-3.5 h-3.5" /> Iscrivi
                  </Button>
                </div>
              );
            })
          )}
        </div>
      </div>
      <div className="space-y-2">
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
          Iscritte ({atleti_iscritti.length})
        </p>
        {atleti_iscritti.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-4">Nessuna atleta iscritta.</p>
        ) : (
          <div className="border border-border rounded-xl overflow-hidden divide-y divide-border/50">
            {atleti_iscritti.map((a: any) => (
              <div key={a.id} className="flex items-center justify-between px-3 py-2.5">
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center text-primary text-xs font-bold">
                    {a.nome[0]}{a.cognome[0]}
                  </div>
                  <div>
                    <p className="text-sm font-medium text-foreground">
                      {a.cognome} {a.nome}
                    </p>
                    <p className="text-xs text-muted-foreground">{get_atleta_livello(a)}</p>
                  </div>
                </div>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => handle_rimuovi(a.id)}
                  disabled={removing === a.id}
                  className="h-7 w-7 p-0 text-destructive hover:bg-destructive/10"
                >
                  {removing === a.id ? "..." : <Trash2 className="w-3.5 h-3.5" />}
                </Button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

// ─── Tab Monitori ──────────────────────────────────────────
const TabMonitori: React.FC<{
  corso: any;
  tutti_monitori: any[];
  on_refresh: () => void;
}> = ({ corso, tutti_monitori, on_refresh }) => {
  const [saving, set_saving] = useState(false);
  const [local_monitori, set_local_monitori] = useState<string[]>(corso.monitori || []);
  const [local_aiuto, set_local_aiuto] = useState<string[]>(corso.aiuto_monitori || []);

  React.useEffect(() => {
    set_local_monitori(corso.monitori || []);
    set_local_aiuto(corso.aiuto_monitori || []);
  }, [corso.monitori, corso.aiuto_monitori]);

  const toggle_persona = async (persona_id: string, tipo: "monitore" | "aiuto_monitore") => {
    set_saving(true);
    try {
      const lista = tipo === "monitore" ? local_monitori : local_aiuto;
      const is_present = lista.includes(persona_id);
      if (tipo === "monitore")
        set_local_monitori(is_present ? lista.filter((id) => id !== persona_id) : [...lista, persona_id]);
      else set_local_aiuto(is_present ? lista.filter((id) => id !== persona_id) : [...lista, persona_id]);
      if (is_present)
        await supabase.from("corsi_monitori").delete().eq("corso_id", corso.id).eq("persona_id", persona_id);
      else await supabase.from("corsi_monitori").insert({ corso_id: corso.id, persona_id, tipo });
      on_refresh();
    } catch (err: any) {
      set_local_monitori(corso.monitori || []);
      set_local_aiuto(corso.aiuto_monitori || []);
      toast({ title: "Errore", description: err?.message, variant: "destructive" });
    } finally {
      set_saving(false);
    }
  };

  const monitori = tutti_monitori.filter((a) => a.ruolo_pista === "monitore");
  const aiuto_monitori = tutti_monitori.filter((a) => a.ruolo_pista === "aiuto_monitore");

  const PersonaRow: React.FC<{ persona: any; tipo: "monitore" | "aiuto_monitore"; selected: boolean }> = ({
    persona,
    tipo,
    selected,
  }) => (
    <div
      onClick={() => !saving && toggle_persona(persona.id, tipo)}
      className={`flex items-center justify-between px-3 py-2.5 rounded-xl border-2 cursor-pointer transition-all ${selected ? "border-primary bg-primary/5" : "border-border hover:border-primary/40 bg-background"}`}
    >
      <div className="flex items-center gap-2">
        <div
          className={`w-4 h-4 rounded border-2 flex items-center justify-center flex-shrink-0 ${selected ? "border-primary bg-primary" : "border-muted-foreground"}`}
        >
          {selected && <span className="text-white text-[10px] font-bold">✓</span>}
        </div>
        {persona.foto_url ? (
          <img src={persona.foto_url} alt={persona.nome} className="w-7 h-7 rounded-full object-cover" />
        ) : (
          <div className="w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center text-primary text-xs font-bold">
            {persona.nome[0]}
            {persona.cognome[0]}
          </div>
        )}
        <span className="text-sm font-medium text-foreground">
          {persona.nome} {persona.cognome}
        </span>
      </div>
      {selected && (
        <Badge variant="default" className="text-[10px]">
          Assegnato
        </Badge>
      )}
    </div>
  );

  return (
    <div className="space-y-5">
      {monitori.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs font-bold text-muted-foreground uppercase tracking-wide">
            Monitori ({local_monitori.length} assegnati)
          </p>
          <div className="space-y-1.5">
            {monitori.map((m) => (
              <PersonaRow key={m.id} persona={m} tipo="monitore" selected={local_monitori.includes(m.id)} />
            ))}
          </div>
        </div>
      )}
      {aiuto_monitori.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs font-bold text-muted-foreground uppercase tracking-wide">
            Aiuto monitori ({local_aiuto.length} assegnati)
          </p>
          <div className="space-y-1.5">
            {aiuto_monitori.map((m) => (
              <PersonaRow key={m.id} persona={m} tipo="aiuto_monitore" selected={local_aiuto.includes(m.id)} />
            ))}
          </div>
        </div>
      )}
      {monitori.length === 0 && aiuto_monitori.length === 0 && (
        <div className="text-center py-8 text-muted-foreground">
          <p className="text-sm">Nessun monitore o aiuto monitore registrato.</p>
          <p className="text-xs mt-1">Vai su Atleti e imposta il ruolo pista a "Monitore" o "Aiuto monitore".</p>
        </div>
      )}
    </div>
  );
};

// ─── Tab Presenze corso ────────────────────────────────────
const TabPresenze: React.FC<{
  corso: any;
  tutti_atleti: any[];
  tutti_monitori: any[];
  istruttori: any[];
}> = ({ corso, tutti_atleti, tutti_monitori, istruttori }) => {
  const [data_sel, set_data_sel] = useState(new Date().toISOString().split("T")[0]);
  const { data: presenze = [] } = use_presenze_corso(corso.id, data_sel);
  const upsert_presenza = use_upsert_presenza_corso();

  const monitori_assegnati = tutti_monitori.filter(
    (a) => (corso.monitori || []).includes(a.id) || (corso.aiuto_monitori || []).includes(a.id),
  );
  const get_stato_persona = (persona_id: string) =>
    presenze.find((x: any) => x.persona_id === persona_id)?.stato || "attesa";
  const get_sostituto_persona = (persona_id: string) =>
    presenze.find((x: any) => x.persona_id === persona_id)?.sostituto_id || null;

  const handle_set_stato = async (
    persona_id: string,
    tipo: "monitore" | "aiuto_monitore",
    stato: "attesa" | "confermato" | "assente" | "sostituito",
    sostituto_id?: string,
  ) => {
    try {
      await upsert_presenza.mutateAsync({
        corso_id: corso.id,
        persona_id,
        tipo_persona: tipo,
        data: data_sel,
        stato,
        sostituto_id,
      });
    } catch (err: any) {
      toast({ title: "Errore", description: err?.message, variant: "destructive" });
    }
  };

  const genera_wa_link = (persona: any, tipo: string) => {
    const tel = persona.genitore1_telefono || persona.telefono || "";
    if (!tel) return null;
    const data_fmt = new Date(data_sel + "T00:00:00").toLocaleDateString("it-CH", {
      weekday: "long",
      day: "numeric",
      month: "long",
    });
    const msg = encodeURIComponent(
      `Ciao ${persona.nome}! 👋\n\nTi ricordiamo che hai il corso *${corso.nome}* come ${tipo} il ${data_fmt} dalle ${corso.ora_inizio?.slice(0, 5)} alle ${corso.ora_fine?.slice(0, 5)}.\n\nPuoi confermare la tua presenza? Grazie! ⛸️`,
    );
    return `https://wa.me/${tel.replace(/\s+/g, "").replace(/^0/, "+41")}?text=${msg}`;
  };

  const stato_icon = (stato: string) => {
    if (stato === "confermato") return <CheckCircle className="w-4 h-4 text-success" />;
    if (stato === "assente") return <XCircle className="w-4 h-4 text-destructive" />;
    if (stato === "sostituito") return <ArrowRightLeft className="w-4 h-4 text-orange-500" />;
    return <Clock className="w-4 h-4 text-muted-foreground" />;
  };

  const stato_label = (stato: string) =>
    ({ confermato: "Confermato", assente: "Assente", sostituito: "Sostituito" })[stato] || "In attesa";
  const monitori_disponibili_sostituzione = tutti_monitori.filter(
    (m) => !monitori_assegnati.find((ma) => ma.id === m.id),
  );

  return (
    <div className="space-y-4">
      <Field label="Data lezione">
        <input type="date" value={data_sel} onChange={(e) => set_data_sel(e.target.value)} className={input_cls} />
      </Field>
      {monitori_assegnati.length === 0 ? (
        <div className="text-center py-6 text-muted-foreground">
          <p className="text-sm">Nessun monitore assegnato a questo corso.</p>
          <p className="text-xs mt-1">Vai alla tab "Monitori" per assegnarli.</p>
        </div>
      ) : (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-xs font-bold text-muted-foreground uppercase tracking-wide">
              Presenze —{" "}
              {new Date(data_sel + "T00:00:00").toLocaleDateString("it-CH", {
                weekday: "long",
                day: "numeric",
                month: "long",
              })}
            </p>
            <Button
              size="sm"
              variant="outline"
              className="gap-1.5 text-xs h-7 text-green-700 border-green-300 hover:bg-green-50"
              onClick={() => {
                const non_confermati = monitori_assegnati.filter((m) => get_stato_persona(m.id) === "attesa");
                if (non_confermati.length === 0) {
                  toast({ title: "Tutti hanno già confermato!" });
                  return;
                }
                non_confermati.forEach((m) => {
                  const tipo = (corso.monitori || []).includes(m.id) ? "monitore" : "aiuto monitore";
                  const link = genera_wa_link(m, tipo);
                  if (link) window.open(link, "_blank");
                });
              }}
            >
              <MessageCircle className="w-3.5 h-3.5" />
              Remind tutti ({monitori_assegnati.filter((m) => get_stato_persona(m.id) === "attesa").length})
            </Button>
          </div>
          {monitori_assegnati.map((persona) => {
            const tipo = (corso.monitori || []).includes(persona.id) ? "monitore" : "aiuto_monitore";
            const tipo_label = tipo === "monitore" ? "Monitore" : "Aiuto monitore";
            const stato = get_stato_persona(persona.id);
            const sostituto_id = get_sostituto_persona(persona.id);
            const sostituto = sostituto_id ? tutti_monitori.find((m) => m.id === sostituto_id) : null;
            const wa_link = genera_wa_link(persona, tipo_label.toLowerCase());
            return (
              <div key={persona.id} className="bg-muted/20 rounded-xl border border-border p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    {persona.foto_url ? (
                      <img src={persona.foto_url} alt={persona.nome} className="w-9 h-9 rounded-full object-cover" />
                    ) : (
                      <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center text-primary text-sm font-bold">
                        {persona.nome[0]}
                        {persona.cognome[0]}
                      </div>
                    )}
                    <div>
                      <p className="text-sm font-semibold text-foreground">
                        {persona.nome} {persona.cognome}
                      </p>
                      <Badge variant="secondary" className="text-[10px] mt-0.5">
                        {tipo_label}
                      </Badge>
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5">
                    {stato_icon(stato)}
                    <span className="text-xs text-muted-foreground">{stato_label(stato)}</span>
                  </div>
                </div>
                <div className="flex gap-1.5 flex-wrap">
                  {["confermato", "assente", "attesa"].map((s) => (
                    <button
                      key={s}
                      onClick={() => handle_set_stato(persona.id, tipo as any, s as any)}
                      className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-all border ${stato === s ? (s === "confermato" ? "bg-success text-white border-success" : s === "assente" ? "bg-destructive text-white border-destructive" : "bg-muted text-foreground border-border") : "bg-background text-muted-foreground border-border hover:border-primary/40"}`}
                    >
                      {s === "confermato" ? "✅ Confermato" : s === "assente" ? "❌ Assente" : "⏳ In attesa"}
                    </button>
                  ))}
                  {wa_link && (
                    <a
                      href={wa_link}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="px-2.5 py-1 rounded-lg text-xs font-medium border border-green-300 text-green-700 hover:bg-green-50 transition-all flex items-center gap-1"
                    >
                      <MessageCircle className="w-3 h-3" /> WhatsApp
                    </a>
                  )}
                </div>
                {stato === "assente" && (
                  <div className="space-y-2 pt-1 border-t border-border">
                    {sostituto ? (
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <ArrowRightLeft className="w-3.5 h-3.5 text-orange-500" />
                          <span className="text-xs text-foreground">
                            Sostituto:{" "}
                            <strong>
                              {sostituto.nome} {sostituto.cognome}
                            </strong>
                          </span>
                        </div>
                        <button
                          onClick={() => handle_set_stato(persona.id, tipo as any, "assente", undefined)}
                          className="text-xs text-destructive hover:underline"
                        >
                          Rimuovi
                        </button>
                      </div>
                    ) : (
                      <div className="space-y-1.5">
                        <p className="text-xs font-semibold text-muted-foreground">Assegna sostituto</p>
                        <select
                          onChange={(e) => {
                            if (e.target.value) handle_set_stato(persona.id, tipo as any, "sostituito", e.target.value);
                          }}
                          defaultValue=""
                          className={`${input_cls} text-xs py-1.5`}
                        >
                          <option value="">Seleziona sostituto...</option>
                          {monitori_disponibili_sostituzione.map((m) => (
                            <option key={m.id} value={m.id}>
                              {m.nome} {m.cognome}
                            </option>
                          ))}
                        </select>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

// ─── Modal corso ───────────────────────────────────────────
const CorsoModal: React.FC<{
  corso?: any;
  istruttori: any[];
  corsi: any[];
  atleti: any[];
  monitori: any[];
  tipi_corso: string[];
  on_close: () => void;
  on_save: (data: any) => Promise<void>;
  on_delete?: () => Promise<void>;
  on_add_tipo: (nome: string) => Promise<void>;
  saving: boolean;
  deleting: boolean;
}> = ({
  corso,
  istruttori,
  corsi,
  atleti,
  monitori,
  tipi_corso,
  on_close,
  on_save,
  on_delete,
  on_add_tipo,
  saving,
  deleting,
}) => {
  const qc = useQueryClient();
  const [form, set_form] = useState({
    nome: corso?.nome || "",
    tipo: corso?.tipo || "",
    giorno: corso?.giorno || "Lunedì",
    ora_inizio: corso?.ora_inizio?.slice(0, 5) || "08:00",
    ora_fine: corso?.ora_fine?.slice(0, 5) || "09:00",
    costo_mensile_str: (() => {
      const n = to_num(corso?.costo_mensile ?? 0);
      return n === 0 ? "" : n.toFixed(2);
    })(),
    costo_annuale_str: (() => {
      const n = to_num(corso?.costo_annuale ?? 0);
      return n === 0 ? "" : n.toFixed(2);
    })(),
    istruttori_ids: corso?.istruttori_ids || [],
    attivo: corso?.stato === "attivo" || corso?.attivo !== false,
    note: corso?.note || "",
    stagione_id: corso?.stagione_id || null,
  });
  const [confirm_delete, set_confirm_delete] = useState(false);
  const [avviso_istruttori, set_avviso_istruttori] = useState<string[]>([]);
  const [confirm_forzatura, set_confirm_forzatura] = useState(false);

  const set_val = (k: string, v: any) => set_form((p) => ({ ...p, [k]: v }));
  const toggle_istruttore = (id: string) =>
    set_form((p) => ({
      ...p,
      istruttori_ids: p.istruttori_ids.includes(id)
        ? p.istruttori_ids.filter((x: string) => x !== id)
        : [...p.istruttori_ids, id],
    }));

  const istruttori_non_disponibili = useMemo(
    () =>
      form.istruttori_ids
        .map((id: string) => istruttori.find((i: any) => i.id === id))
        .filter((i: any) => i && !is_istruttore_disponibile(i, form.giorno, form.ora_inizio, form.ora_fine))
        .map((i: any) => `${i.nome} ${i.cognome}`),
    [form.istruttori_ids, form.giorno, form.ora_inizio, form.ora_fine, istruttori],
  );

  const conflitti_corsi = useMemo(
    () =>
      form.istruttori_ids.flatMap((id: string) =>
        corsi
          .filter(
            (c) =>
              c.id !== corso?.id &&
              c.istruttori_ids?.includes(id) &&
              c.giorno === form.giorno &&
              c.attivo !== false &&
              time_to_min(c.ora_inizio?.slice(0, 5)) < time_to_min(form.ora_fine) &&
              time_to_min(c.ora_fine?.slice(0, 5)) > time_to_min(form.ora_inizio),
          )
          .map((c) => {
            const istr = istruttori.find((i) => i.id === id);
            return `${istr?.nome} ${istr?.cognome} — conflitto con "${c.nome}" (${c.ora_inizio?.slice(0, 5)}–${c.ora_fine?.slice(0, 5)})`;
          }),
      ),
    [form.istruttori_ids, form.giorno, form.ora_inizio, form.ora_fine, corsi, corso, istruttori],
  );

  const tutti_avvisi = [
    ...new Set([
      ...istruttori_non_disponibili.map((n) => `${n} non è disponibile in questo orario`),
      ...conflitti_corsi,
    ]),
  ];

  const handle_save_click = () => {
    if (!form.nome.trim()) {
      toast({ title: "Il nome del corso è obbligatorio", variant: "destructive" });
      return;
    }
    if (tutti_avvisi.length > 0) {
      set_avviso_istruttori(tutti_avvisi);
      set_confirm_forzatura(true);
      return;
    }
    on_save({
      ...form,
      id: corso?.id,
      costo_mensile: to_num(form.costo_mensile_str),
      costo_annuale: to_num(form.costo_annuale_str),
    });
  };

  const istruttori_attivi = istruttori.filter((i) => i.attivo);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <div className="bg-card rounded-2xl shadow-xl w-full max-w-lg flex flex-col max-h-[90vh]">
        <div className="flex items-center justify-between px-6 py-4 border-b border-border flex-shrink-0">
          <h2 className="text-base font-bold text-foreground">{corso?.id ? "Modifica corso" : "Nuovo corso"}</h2>
          <button onClick={on_close} className="text-muted-foreground hover:text-foreground">
            <X className="w-5 h-5" />
          </button>
        </div>

        {confirm_forzatura && (
          <div className="mx-6 mt-4 bg-orange-50 border border-orange-200 rounded-xl p-4 space-y-3 flex-shrink-0">
            <div className="flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 text-orange-500 flex-shrink-0 mt-0.5" />
              <div className="space-y-1">
                <p className="text-sm font-bold text-orange-700">Attenzione — Problemi di disponibilità</p>
                {avviso_istruttori.map((msg, i) => (
                  <p key={i} className="text-xs text-orange-600">
                    • {msg}
                  </p>
                ))}
              </div>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={() => set_confirm_forzatura(false)} className="flex-1">
                ← Correggi
              </Button>
              <Button
                size="sm"
                onClick={() => {
                  set_confirm_forzatura(false);
                  on_save({
                    ...form,
                    id: corso?.id,
                    costo_mensile: to_num(form.costo_mensile_str),
                    costo_annuale: to_num(form.costo_annuale_str),
                  });
                }}
                disabled={saving}
                className="flex-1 bg-orange-500 hover:bg-orange-600 text-white"
              >
                {saving ? "..." : "Salva comunque"}
              </Button>
            </div>
          </div>
        )}

        <Tabs defaultValue="info" className="px-6 pt-4 flex flex-col flex-1 overflow-hidden">
          <TabsList className="w-full flex flex-shrink-0">
            <TabsTrigger value="info" className="flex-1">
              Informazioni
            </TabsTrigger>
            <TabsTrigger value="iscrizioni" className="flex-1" disabled={!corso?.id}>
              Iscrizioni {corso?.id ? `(${corso.atleti_ids?.length || 0})` : ""}
            </TabsTrigger>
            <TabsTrigger value="monitori" className="flex-1" disabled={!corso?.id}>
              Monitori {corso?.id ? `(${(corso.monitori?.length || 0) + (corso.aiuto_monitori?.length || 0)})` : ""}
            </TabsTrigger>
            <TabsTrigger value="presenze" className="flex-1" disabled={!corso?.id}>
              Presenze
            </TabsTrigger>
          </TabsList>

          <div className="overflow-y-auto flex-1">
            <TabsContent value="info" className="py-4 space-y-4">
              <Field label="Nome" required>
                <input
                  value={form.nome}
                  onChange={(e) => set_val("nome", e.target.value)}
                  placeholder="es. Corso Avanzato"
                  className={input_cls}
                />
              </Field>
              <Field label="Tipo">
                <TipoCorsoSelect
                  value={form.tipo}
                  on_change={(v) => set_val("tipo", v)}
                  tipi={tipi_corso}
                  on_add_tipo={on_add_tipo}
                />
              </Field>
              <div className="grid grid-cols-3 gap-3">
                <Field label="Giorno">
                  <select value={form.giorno} onChange={(e) => set_val("giorno", e.target.value)} className={input_cls}>
                    {GIORNI_DB.map((g) => (
                      <option key={g} value={g}>
                        {g}
                      </option>
                    ))}
                  </select>
                </Field>
                <Field label="Ora inizio">
                  <input
                    type="time"
                    value={form.ora_inizio}
                    onChange={(e) => set_val("ora_inizio", e.target.value)}
                    className={input_cls}
                  />
                </Field>
                <Field label="Ora fine">
                  <input
                    type="time"
                    value={form.ora_fine}
                    onChange={(e) => set_val("ora_fine", e.target.value)}
                    className={input_cls}
                  />
                </Field>
              </div>

              {/* ← Costi con NumInput */}
              <div className="grid grid-cols-2 gap-3">
                <Field label="Costo mensile">
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-xs pointer-events-none">
                      CHF
                    </span>
                    <NumInput
                      value={form.costo_mensile_str}
                      onChange={(v) => set_val("costo_mensile_str", v)}
                      className="pl-11"
                      placeholder="0.00"
                    />
                  </div>
                </Field>
                <Field label="Costo annuale">
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-xs pointer-events-none">
                      CHF
                    </span>
                    <NumInput
                      value={form.costo_annuale_str}
                      onChange={(v) => set_val("costo_annuale_str", v)}
                      className="pl-11"
                      placeholder="0.00"
                    />
                  </div>
                </Field>
              </div>

              <Field label="Istruttori">
                <div className="space-y-2 max-h-40 overflow-y-auto">
                  {istruttori_attivi.map((i) => {
                    const selected = form.istruttori_ids.includes(i.id);
                    const disponibile = is_istruttore_disponibile(i, form.giorno, form.ora_inizio, form.ora_fine);
                    const ha_conflitto = corsi.some(
                      (c) =>
                        c.id !== corso?.id &&
                        c.istruttori_ids?.includes(i.id) &&
                        c.giorno === form.giorno &&
                        c.attivo !== false &&
                        time_to_min(c.ora_inizio?.slice(0, 5)) < time_to_min(form.ora_fine) &&
                        time_to_min(c.ora_fine?.slice(0, 5)) > time_to_min(form.ora_inizio),
                    );
                    return (
                      <div
                        key={i.id}
                        onClick={() => toggle_istruttore(i.id)}
                        className={`flex items-center justify-between px-3 py-2.5 rounded-xl border-2 cursor-pointer transition-all ${selected ? (ha_conflitto ? "border-destructive bg-destructive/5" : !disponibile ? "border-orange-400 bg-orange-50" : "border-primary bg-primary/5") : "border-border hover:border-primary/40 bg-background"}`}
                      >
                        <div className="flex items-center gap-2">
                          <div
                            className={`w-4 h-4 rounded border-2 flex items-center justify-center flex-shrink-0 ${selected ? (ha_conflitto ? "border-destructive bg-destructive" : "border-primary bg-primary") : "border-muted-foreground"}`}
                          >
                            {selected && <span className="text-white text-[10px] font-bold">✓</span>}
                          </div>
                          <span className="text-sm font-medium text-foreground">
                            {i.nome} {i.cognome}
                          </span>
                        </div>
                        <div className="flex items-center gap-1">
                          {selected && ha_conflitto && (
                            <span className="text-[10px] font-bold text-destructive bg-destructive/10 px-1.5 py-0.5 rounded-full">
                              Conflitto
                            </span>
                          )}
                          {selected && !ha_conflitto && !disponibile && (
                            <span className="text-[10px] font-bold text-orange-600 bg-orange-100 px-1.5 py-0.5 rounded-full">
                              Non disponibile
                            </span>
                          )}
                          {!selected && (
                            <span
                              className={`text-[10px] font-medium px-1.5 py-0.5 rounded-full ${disponibile ? "text-success bg-success/10" : "text-muted-foreground bg-muted/50"}`}
                            >
                              {disponibile ? "✓ Disponibile" : "Non disp."}
                            </span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </Field>
              <div className="flex items-center gap-3 px-3 py-2 bg-muted/30 rounded-lg">
                <input
                  type="checkbox"
                  id="attivo_corso"
                  checked={form.attivo}
                  onChange={(e) => set_val("attivo", e.target.checked)}
                  className="w-4 h-4 accent-primary"
                />
                <label htmlFor="attivo_corso" className="text-sm font-medium text-foreground cursor-pointer">
                  Corso attivo
                </label>
              </div>
              <Field label="Note">
                <textarea
                  value={form.note}
                  onChange={(e) => set_val("note", e.target.value)}
                  rows={2}
                  placeholder="Note aggiuntive..."
                  className={`${input_cls} resize-none`}
                />
              </Field>
            </TabsContent>

            <TabsContent value="iscrizioni" className="py-4">
              {corso?.id && (
                <TabIscrizioni
                  corso_id={corso.id}
                  livello_richiesto={corso.livello_richiesto || "tutti"}
                  atleti_iscritti_ids={corso.atleti_ids || []}
                  tutti_atleti={atleti}
                  on_refresh={() => qc.invalidateQueries({ queryKey: ["corsi"] })}
                />
              )}
            </TabsContent>
            <TabsContent value="monitori" className="py-4">
              {corso?.id && (
                <TabMonitori
                  corso={corso}
                  tutti_monitori={monitori}
                  on_refresh={() => qc.invalidateQueries({ queryKey: ["corsi"] })}
                />
              )}
            </TabsContent>
            <TabsContent value="presenze" className="py-4">
              {corso?.id && (
                <TabPresenze corso={corso} tutti_atleti={atleti} tutti_monitori={monitori} istruttori={istruttori} />
              )}
            </TabsContent>
          </div>
        </Tabs>

        <div className="px-6 py-4 border-t border-border space-y-2 flex-shrink-0">
          <div className="flex gap-2">
            <Button variant="outline" onClick={on_close} disabled={saving} className="flex-1">
              Annulla
            </Button>
            <Button
              onClick={handle_save_click}
              disabled={saving || confirm_forzatura}
              className="flex-1 bg-primary hover:bg-primary/90"
            >
              {saving ? "..." : "💾 Salva"}
            </Button>
          </div>
          {corso?.id && !confirm_delete && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => set_confirm_delete(true)}
              className="w-full text-destructive hover:bg-destructive/10"
            >
              🗑️ Elimina corso
            </Button>
          )}
          {confirm_delete && (
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={() => set_confirm_delete(false)} className="flex-1">
                Annulla
              </Button>
              <Button variant="destructive" size="sm" onClick={on_delete} disabled={deleting} className="flex-1">
                {deleting ? "..." : "Elimina definitivamente"}
              </Button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

// ─── Card corso ────────────────────────────────────────────
const CorsoCard: React.FC<{
  corso: any;
  istruttori: any[];
  monitori: any[];
  onClick: () => void;
}> = ({ corso, istruttori, monitori, onClick }) => {
  const istruttori_corso = (corso.istruttori_ids || [])
    .map((id: string) => istruttori.find((i: any) => i.id === id))
    .filter(Boolean);
  const monitori_corso = monitori.filter((m: any) => (corso.monitori || []).includes(m.id));
  const aiuto_corso = monitori.filter((m: any) => (corso.aiuto_monitori || []).includes(m.id));

  return (
    <div
      onClick={onClick}
      className="bg-card rounded-xl shadow-card p-5 hover:shadow-card-hover transition-shadow cursor-pointer border border-border/50 hover:border-primary/30 space-y-4"
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="font-semibold text-foreground text-base">{corso.nome}</h3>
          <div className="flex items-center gap-2 mt-1 flex-wrap">
            {corso.tipo && (
              <Badge variant="secondary" className="text-xs">
                {corso.tipo}
              </Badge>
            )}
            <span className="text-xs text-muted-foreground">
              {corso.giorno} · {corso.ora_inizio?.slice(0, 5)}–{corso.ora_fine?.slice(0, 5)}
            </span>
          </div>
        </div>
        <div className="flex flex-col items-end gap-0.5 shrink-0">
          <span
            className={`inline-block w-2 h-2 rounded-full ${corso.stato === "attivo" ? "bg-success" : "bg-muted-foreground"}`}
          />
          {to_num(corso.costo_mensile) > 0 && (
            <span className="text-xs text-muted-foreground tabular-nums">
              CHF {to_num(corso.costo_mensile).toFixed(2)}/mese
            </span>
          )}
          {to_num(corso.costo_annuale) > 0 && (
            <span className="text-xs text-muted-foreground tabular-nums">
              CHF {to_num(corso.costo_annuale).toFixed(2)}/anno
            </span>
          )}
        </div>
      </div>

      <div className="space-y-3">
        {istruttori_corso.length > 0 && (
          <div className="space-y-1.5">
            <p className="text-[10px] font-bold uppercase tracking-wide text-purple-700">Istruttori</p>
            <div className="flex flex-wrap gap-1">
              {istruttori_corso.map((i: any) => (
                <span
                  key={i.id}
                  className="text-xs bg-purple-50 text-purple-800 px-2 py-0.5 rounded-full font-medium border border-purple-100"
                >
                  {i.nome} {i.cognome}
                </span>
              ))}
            </div>
          </div>
        )}
        {monitori_corso.length > 0 && (
          <div className="space-y-1.5">
            <p className="text-[10px] font-bold uppercase tracking-wide text-teal-700">Monitori</p>
            <div className="flex flex-wrap gap-1">
              {monitori_corso.map((m: any) => (
                <span
                  key={m.id}
                  className="text-xs bg-teal-50 text-teal-800 px-2 py-0.5 rounded-full font-medium border border-teal-100"
                >
                  {m.nome} {m.cognome}
                </span>
              ))}
            </div>
          </div>
        )}
        {aiuto_corso.length > 0 && (
          <div className="space-y-1.5">
            <p className="text-[10px] font-bold uppercase tracking-wide text-blue-700">Aiuto Monitori</p>
            <div className="flex flex-wrap gap-1">
              {aiuto_corso.map((m: any) => (
                <span
                  key={m.id}
                  className="text-xs bg-blue-50 text-blue-800 px-2 py-0.5 rounded-full font-medium border border-blue-100"
                >
                  {m.nome} {m.cognome}
                </span>
              ))}
            </div>
          </div>
        )}
        {istruttori_corso.length === 0 && monitori_corso.length === 0 && aiuto_corso.length === 0 && (
          <p className="text-xs text-muted-foreground italic">Nessun personale assegnato</p>
        )}
      </div>

      <div className="flex items-center justify-between pt-2 border-t border-border/50">
        <div className="flex items-center gap-1 text-xs text-muted-foreground">
          <Users className="w-3.5 h-3.5" />
          <span>{(corso.atleti_ids || []).length} iscritti</span>
        </div>
      </div>
    </div>
  );
};

// ─── Main Page ─────────────────────────────────────────────
const CoursesPage: React.FC = () => {
  const { t } = useI18n();
  const qc = useQueryClient();
  const { data: corsi = [], isLoading } = use_corsi();
  const { data: istruttori = [] } = use_istruttori();
  const { data: atleti = [] } = use_atleti();
  const { data: monitori = [] } = use_atleti_monitori();
  const { data: tipi_corso = [] } = use_tipi_corso();
  const upsert = use_upsert_corso();
  const elimina = use_elimina_corso();
  const [modal_open, set_modal_open] = useState(false);
  const [selected_corso, set_selected_corso] = useState<any>(null);

  const handle_add_tipo = async (nome: string) => {
    const { error } = await supabase.from("tipi_corso").insert({ club_id: get_current_club_id(), nome });
    if (error) throw error;
    await qc.invalidateQueries({ queryKey: ["tipi_corso"] });
    toast({ title: `✅ Tipo "${nome}" aggiunto` });
  };

  const handle_save = async (data: any) => {
    try {
      await upsert.mutateAsync({ ...data, istruttori_ids: Array.from(new Set(data.istruttori_ids || [])) });
      set_modal_open(false);
      toast({ title: data.id ? "✅ Corso aggiornato" : "✅ Corso creato" });
    } catch (err: any) {
      toast({ title: "Errore salvataggio", description: err?.message, variant: "destructive" });
    }
  };

  const handle_delete = async () => {
    try {
      await elimina.mutateAsync(selected_corso.id);
      set_modal_open(false);
      toast({ title: "🗑️ Corso eliminato correttamente" });
    } catch (err: any) {
      toast({ title: "Errore eliminazione", description: err?.message, variant: "destructive" });
    }
  };

  if (isLoading)
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );

  return (
    <>
      {modal_open && (
        <CorsoModal
          corso={selected_corso}
          istruttori={istruttori}
          corsi={corsi}
          atleti={atleti}
          monitori={monitori}
          tipi_corso={tipi_corso}
          on_close={() => set_modal_open(false)}
          on_save={handle_save}
          on_delete={selected_corso?.id ? handle_delete : undefined}
          on_add_tipo={handle_add_tipo}
          saving={upsert.isPending}
          deleting={elimina.isPending}
        />
      )}

      <div className="space-y-6 animate-fade-in">
        <div className="flex items-center justify-between">
          <h1 className="text-xl font-bold tracking-tight text-foreground">{t("corsi")}</h1>
          <Button
            className="bg-primary hover:bg-primary/90"
            onClick={() => {
              set_selected_corso(null);
              set_modal_open(true);
            }}
          >
            <Plus className="w-4 h-4 mr-2" /> {t("nuovo_corso")}
          </Button>
        </div>

        {corsi.length === 0 ? (
          <div className="bg-card rounded-xl shadow-card p-12 text-center text-muted-foreground">
            <p className="text-sm">Nessun corso. Clicca "Nuovo corso" per aggiungerne uno.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {corsi.map((c: any) => (
              <CorsoCard
                key={c.id}
                corso={c}
                istruttori={istruttori}
                monitori={monitori}
                onClick={() => {
                  set_selected_corso(c);
                  set_modal_open(true);
                }}
              />
            ))}
          </div>
        )}
      </div>
    </>
  );
};

export default CoursesPage;
