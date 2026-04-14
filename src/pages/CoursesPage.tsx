import React, { useState, useMemo, useEffect } from "react";
import { useI18n } from "@/lib/i18n";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  use_corsi,
  use_istruttori,
  use_atleti,
  use_atleti_monitori,
  use_presenze_corso,
  use_disponibilita_ghiaccio,
  check_corso_completo,
  get_istruttore_name_from_list,
} from "@/hooks/use-supabase-data";
import { use_upsert_corso, use_elimina_corso, use_upsert_presenza_corso } from "@/hooks/use-supabase-mutations";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
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
  const [show_salto_search, set_show_salto_search] = useState(false);
  const [salto_query, set_salto_query] = useState("");

  const ha_filtro_livello = !!livello_richiesto && livello_richiesto !== "tutti";

  const atleti_iscritti = tutti_atleti.filter((a: any) => atleti_iscritti_ids.includes(a.id));

  // Lista principale: solo atleti compatibili (o tutti se livello_richiesto = 'tutti')
  const atleti_disponibili = useMemo(() => {
    const q = query.toLowerCase();
    return tutti_atleti
      .filter((a: any) => a.stato === "attivo" && !atleti_iscritti_ids.includes(a.id))
      .filter((a: any) => !ha_filtro_livello || is_livello_compatibile(a, livello_richiesto))
      .filter((a: any) => !q || `${a.nome} ${a.cognome}`.toLowerCase().includes(q))
      .sort((a, b) => (a.cognome || "").localeCompare(b.cognome || "", "it"))
      .slice(0, 30);
  }, [tutti_atleti, atleti_iscritti_ids, query, livello_richiesto, ha_filtro_livello]);

  // Lista salto di livello: SOLO atleti NON compatibili
  const atleti_salto = useMemo(() => {
    if (!show_salto_search || !ha_filtro_livello) return [];
    const q = salto_query.toLowerCase();
    return tutti_atleti
      .filter((a: any) => a.stato === "attivo" && !atleti_iscritti_ids.includes(a.id))
      .filter((a: any) => !is_livello_compatibile(a, livello_richiesto))
      .filter((a: any) => !q || `${a.nome} ${a.cognome}`.toLowerCase().includes(q))
      .sort((a, b) => (a.cognome || "").localeCompare(b.cognome || "", "it"))
      .slice(0, 30);
  }, [tutti_atleti, atleti_iscritti_ids, salto_query, livello_richiesto, show_salto_search, ha_filtro_livello]);

  const do_iscrivi = async (atleta_id: string, salto_livello = false, note_sl = "") => {
    set_saving(true);
    try {
      const payload: any = {
        corso_id,
        atleta_id,
        attiva: true,
        salto_livello,
        note_salto_livello: note_sl || "",
      };
      const { error } = await supabase.from("iscrizioni_corsi").insert(payload);
      if (error) throw error;
      set_query("");
      set_salto_query("");
      set_show_salto_search(false);
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
    do_iscrivi(atleta.id);
  };

  const handle_iscrivi_salto = (atleta: any) => {
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
              <p className="text-xs text-orange-600">Vuoi procedere con un salto di livello?</p>
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

      {/* Lista atleti compatibili */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Aggiungi atleta</p>
          {ha_filtro_livello && (
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
              {query ? "Nessuna atleta trovata" : ha_filtro_livello ? "Nessuna atleta con livello compatibile" : "Tutte le atlete sono già iscritte"}
            </p>
          ) : (
            atleti_disponibili.map((a: any) => {
              const livello = get_atleta_livello(a);
              return (
                <div
                  key={a.id}
                  className="flex items-center justify-between px-3 py-2 hover:bg-muted/30 transition-colors"
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <div className="w-6 h-6 rounded-full bg-muted flex items-center justify-center text-muted-foreground text-[10px] font-bold flex-shrink-0">
                      {a.nome[0]}{a.cognome[0]}
                    </div>
                    <div className="min-w-0">
                      <span className="text-sm text-foreground block truncate">
                        {a.cognome} {a.nome}
                      </span>
                      <span className="text-[10px] text-muted-foreground">{livello}</span>
                    </div>
                  </div>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => handle_iscrivi(a)}
                    disabled={saving}
                    className="h-7 text-xs gap-1 flex-shrink-0 text-primary hover:bg-primary/10"
                  >
                    <UserPlus className="w-3.5 h-3.5" /> Iscrivi
                  </Button>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* Pulsante salto di livello */}
      {ha_filtro_livello && !show_salto_search && (
        <Button
          variant="outline"
          size="sm"
          onClick={() => set_show_salto_search(true)}
          className="w-full text-xs gap-1.5 text-orange-600 border-orange-200 hover:bg-orange-50"
        >
          <ArrowRightLeft className="w-3.5 h-3.5" /> Iscrivi con salto di livello
        </Button>
      )}

      {/* Ricerca salto di livello */}
      {show_salto_search && ha_filtro_livello && (
        <div className="space-y-2 border border-orange-200 rounded-xl p-3 bg-orange-50/30">
          <div className="flex items-center justify-between">
            <p className="text-xs font-semibold text-orange-600 uppercase tracking-wide flex items-center gap-1">
              <AlertTriangle className="w-3 h-3" /> Salto di livello
            </p>
            <Button variant="ghost" size="sm" onClick={() => { set_show_salto_search(false); set_salto_query(""); }} className="h-6 w-6 p-0">
              <X className="w-3.5 h-3.5" />
            </Button>
          </div>
          <div className="relative">
            <Search className="w-3.5 h-3.5 text-muted-foreground absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              value={salto_query}
              onChange={(e) => set_salto_query(e.target.value)}
              placeholder="Cerca atleta..."
              autoFocus
              className="w-full rounded-lg border border-orange-200 bg-background pl-9 pr-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-300"
            />
          </div>
          <div className="border border-orange-200 rounded-xl overflow-hidden divide-y divide-orange-100 max-h-48 overflow-y-auto">
            {atleti_salto.length === 0 ? (
              <p className="text-xs text-muted-foreground px-3 py-3 text-center">
                {salto_query ? "Nessuna atleta trovata" : "Nessuna atleta disponibile"}
              </p>
            ) : (
              atleti_salto.map((a: any) => {
                const livello = get_atleta_livello(a);
                return (
                  <div key={a.id} className="flex items-center justify-between px-3 py-2 hover:bg-orange-50 transition-colors">
                    <div className="flex items-center gap-2 min-w-0">
                      <div className="w-6 h-6 rounded-full bg-orange-100 flex items-center justify-center text-orange-600 text-[10px] font-bold flex-shrink-0">
                        {a.nome[0]}{a.cognome[0]}
                      </div>
                      <div className="min-w-0">
                        <span className="text-sm text-foreground block truncate">{a.cognome} {a.nome}</span>
                        <span className="text-[10px] text-orange-600">{livello}</span>
                      </div>
                    </div>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => handle_iscrivi_salto(a)}
                      disabled={saving}
                      className="h-7 text-xs gap-1 flex-shrink-0 text-orange-600 hover:bg-orange-100"
                    >
                      <UserPlus className="w-3.5 h-3.5" /> Iscrivi
                    </Button>
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}

      {/* Lista iscritti */}
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
  const has_planning = !!(corso?.giorno && corso?.ora_inizio && corso?.ora_fine);
  const [posiziona_planning, set_posiziona_planning] = useState(corso ? has_planning : true);
  const [form, set_form] = useState({
    nome: corso?.nome || "",
    tipo: corso?.tipo || "",
    livello_richiesto: corso?.livello_richiesto || "tutti",
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
  const [ghiaccio_error, set_ghiaccio_error] = useState<string | null>(null);
  const [ghiaccio_warning, set_ghiaccio_warning] = useState<string | null>(null);
  const [validating_ghiaccio, set_validating_ghiaccio] = useState(false);
  const [no_ice_realtime, set_no_ice_realtime] = useState(false);

  const set_val = (k: string, v: any) => {
    set_form((p) => ({ ...p, [k]: v }));
    if (["giorno", "ora_inizio", "ora_fine", "tipo"].includes(k)) {
      set_ghiaccio_error(null);
      set_ghiaccio_warning(null);
    }
  };

  // Real-time ice availability check
  useEffect(() => {
    if (!posiziona_planning) { set_no_ice_realtime(false); return; }
    const tipo_lower = (form.tipo || "").toLowerCase().trim();
    if (["danza", "off-ice", "stretching", "off ice"].includes(tipo_lower)) { set_no_ice_realtime(false); return; }
    let cancelled = false;
    (async () => {
      const club_id = get_current_club_id();
      const { data: slots } = await supabase.from("disponibilita_ghiaccio").select("ora_inizio, ora_fine").eq("club_id", club_id).eq("giorno", form.giorno).eq("tipo", "ghiaccio");
      if (cancelled) return;
      const cs = time_to_min(form.ora_inizio), ce = time_to_min(form.ora_fine);
      set_no_ice_realtime(!(slots || []).some((s: any) => time_to_min(s.ora_inizio) <= cs && time_to_min(s.ora_fine) >= ce));
    })();
    return () => { cancelled = true; };
  }, [posiziona_planning, form.giorno, form.ora_inizio, form.ora_fine, form.tipo]);

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

  const TIPI_OFF_ICE = ["danza", "off-ice", "stretching", "off ice"];

  const validate_ghiaccio = async (): Promise<{ blocked: boolean; warning: string | null }> => {
    const tipo_lower = (form.tipo || "").toLowerCase().trim();
    if (TIPI_OFF_ICE.includes(tipo_lower)) {
      return { blocked: false, warning: null };
    }

    const club_id = get_current_club_id();
    const { data: slots_ghiaccio, error: err1 } = await supabase
      .from("disponibilita_ghiaccio")
      .select("*")
      .eq("club_id", club_id)
      .eq("giorno", form.giorno)
      .eq("tipo", "ghiaccio");

    if (err1) throw err1;

    const corso_start = time_to_min(form.ora_inizio);
    const corso_end = time_to_min(form.ora_fine);

    const slot_copre = (slots_ghiaccio || []).some(
      (s: any) => time_to_min(s.ora_inizio) <= corso_start && time_to_min(s.ora_fine) >= corso_end
    );

    if (!slot_copre) {
      return {
        blocked: true,
        warning: null,
      };
    }

    // Check pulizia overlap
    const { data: slots_pulizia } = await supabase
      .from("disponibilita_ghiaccio")
      .select("*")
      .eq("club_id", club_id)
      .eq("giorno", form.giorno)
      .eq("tipo", "pulizia");

    const has_pulizia_overlap = (slots_pulizia || []).some((s: any) => {
      const p_start = time_to_min(s.ora_inizio);
      const p_end = time_to_min(s.ora_fine);
      return p_start < corso_end && p_end > corso_start;
    });

    return {
      blocked: false,
      warning: has_pulizia_overlap
        ? "Attenzione: parte di questo slot è occupata dalla pulizia ghiaccio."
        : null,
    };
  };

  const handle_save_click = async () => {
    if (!form.nome.trim()) {
      toast({ title: "Il nome del corso è obbligatorio", variant: "destructive" });
      return;
    }

    // Skip ghiaccio validation when not placing in planning or when realtime check already detected no ice
    if (!posiziona_planning || no_ice_realtime) {
      do_save();
      return;
    }

    // Validate ghiaccio availability
    set_ghiaccio_error(null);
    set_ghiaccio_warning(null);
    set_validating_ghiaccio(true);
    try {
      const result = await validate_ghiaccio();
      if (result.blocked) {
        set_ghiaccio_error("Nessun ghiaccio disponibile in questo orario. Configura prima la disponibilità ghiaccio in Configurazione Club.");
        set_validating_ghiaccio(false);
        return;
      }
      if (result.warning) {
        set_ghiaccio_warning(result.warning);
      }
    } catch {
      set_validating_ghiaccio(false);
      toast({ title: "Errore verifica ghiaccio", variant: "destructive" });
      return;
    }
    set_validating_ghiaccio(false);

    if (tutti_avvisi.length > 0) {
      set_avviso_istruttori(tutti_avvisi);
      set_confirm_forzatura(true);
      return;
    }
    do_save();
  };

  const do_save = () => {
    const place = posiziona_planning && !no_ice_realtime;
    on_save({
      ...form,
      id: corso?.id,
      giorno: place ? form.giorno : null,
      ora_inizio: place ? form.ora_inizio : null,
      ora_fine: place ? form.ora_fine : null,
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

        {/* Ghiaccio blocking error */}
        {ghiaccio_error && (
          <div className="mx-6 mt-4 bg-destructive/10 border border-destructive/30 rounded-xl p-4 space-y-2 flex-shrink-0">
            <div className="flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 text-destructive flex-shrink-0 mt-0.5" />
              <p className="text-sm font-semibold text-destructive">{ghiaccio_error}</p>
            </div>
            <Button variant="outline" size="sm" onClick={() => set_ghiaccio_error(null)} className="w-full">
              ← Correggi orario
            </Button>
          </div>
        )}

        {/* Ghiaccio pulizia warning (non-blocking) */}
        {ghiaccio_warning && !ghiaccio_error && !confirm_forzatura && (
          <div className="mx-6 mt-4 bg-orange-50 border border-orange-200 rounded-xl p-4 space-y-3 flex-shrink-0">
            <div className="flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 text-orange-500 flex-shrink-0 mt-0.5" />
              <p className="text-sm font-semibold text-orange-700">{ghiaccio_warning}</p>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={() => { set_ghiaccio_warning(null); }} className="flex-1">
                ← Correggi
              </Button>
              <Button
                size="sm"
                onClick={() => {
                  set_ghiaccio_warning(null);
                  if (tutti_avvisi.length > 0) {
                    set_avviso_istruttori(tutti_avvisi);
                    set_confirm_forzatura(true);
                  } else {
                    do_save();
                  }
                }}
                disabled={saving}
                className="flex-1 bg-orange-500 hover:bg-orange-600 text-white"
              >
                {saving ? "..." : "Procedi comunque"}
              </Button>
            </div>
          </div>
        )}

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
                  do_save();
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
              <Field label="Livello richiesto">
                <div className="relative">
                  <select
                    value={form.livello_richiesto}
                    onChange={(e) => set_val("livello_richiesto", e.target.value)}
                    className={`${input_cls} appearance-none pr-8`}
                  >
                    {LIVELLI_CORSO.map((l) => (
                      <option key={l} value={l}>{LIVELLO_LABELS[l] || l}</option>
                    ))}
                  </select>
                  <ChevronDown className="w-4 h-4 text-muted-foreground absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none" />
                </div>
              </Field>
              <div className="flex items-center justify-between px-3 py-2 bg-muted/30 rounded-lg">
                <div className="space-y-0.5">
                  <label htmlFor="posiziona_planning" className="text-sm font-medium text-foreground cursor-pointer">
                    Posiziona subito nel planning
                  </label>
                  {!posiziona_planning && (
                    <p className="text-xs text-muted-foreground">Il corso verrà posizionato nel planning in seguito</p>
                  )}
                </div>
                <Switch
                  id="posiziona_planning"
                  checked={posiziona_planning}
                  onCheckedChange={set_posiziona_planning}
                />
              </div>
              {posiziona_planning && (
                <>
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
                  {no_ice_realtime && (
                    <div className="flex items-start gap-2 px-3 py-2 rounded-lg bg-orange-50 border border-orange-200">
                      <AlertTriangle className="w-4 h-4 text-orange-500 flex-shrink-0 mt-0.5" />
                      <p className="text-xs text-orange-700">
                        Nessun ghiaccio disponibile in questo orario — il corso verrà salvato ma dovrà essere riposizionato nel planning.
                      </p>
                    </div>
                  )}
                </>
              )}

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
                <div className="flex flex-wrap gap-2 max-h-40 overflow-y-auto">
                  {istruttori_attivi.map((i) => {
                    const selected = form.istruttori_ids.includes(i.id);
                    const colore = i.colore || "#6B7280";
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
                    const warning_label = selected && ha_conflitto
                      ? "Conflitto"
                      : selected && !disponibile
                        ? "Non disp."
                        : null;
                    return (
                      <button
                        key={i.id}
                        type="button"
                        onClick={() => toggle_istruttore(i.id)}
                        className="inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-medium cursor-pointer transition-all border-2"
                        style={{
                          borderColor: selected ? colore : "hsl(var(--border))",
                          backgroundColor: selected ? `${colore}20` : "transparent",
                          color: selected ? colore : "hsl(var(--foreground))",
                        }}
                      >
                        <span
                          className="w-3 h-3 rounded-full flex-shrink-0"
                          style={{ backgroundColor: colore }}
                        />
                        {i.nome} {i.cognome}
                        {selected && <span className="text-[10px] font-bold">✓</span>}
                        {warning_label && (
                          <span className="text-[9px] font-bold text-destructive ml-0.5">
                            ({warning_label})
                          </span>
                        )}
                      </button>
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
              disabled={saving || confirm_forzatura || validating_ghiaccio || !!ghiaccio_error}
              className="flex-1 bg-primary hover:bg-primary/90"
            >
              {validating_ghiaccio ? "Verifica..." : saving ? "..." : "💾 Salva"}
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

// ─── Livello badge color ───────────────────────────────────
function get_livello_badge_classes(livello: string): string {
  const l = (livello || "tutti").toLowerCase();
  if (l === "tutti") return "bg-muted text-muted-foreground border-border";
  if (l === "pulcini" || l.startsWith("stellina")) return "bg-emerald-100 text-emerald-800 border-emerald-200";
  if (["interbronzo", "bronzo", "interargento", "argento", "interoro", "oro"].includes(l))
    return "bg-blue-100 text-blue-800 border-blue-200";
  return "bg-orange-100 text-orange-800 border-orange-200";
}

// ─── Card corso (redesigned) ──────────────────────────────
const CorsoCard: React.FC<{
  corso: any;
  istruttori: any[];
  onGestisciIscrizioni: () => void;
  onClick: () => void;
}> = ({ corso, istruttori, onGestisciIscrizioni, onClick }) => {
  const istruttori_corso = (corso.istruttori_ids || [])
    .map((id: string) => istruttori.find((i: any) => i.id === id))
    .filter(Boolean);

  const livello = corso.livello_richiesto || "tutti";
  const livello_label = LIVELLO_LABELS[livello] || livello;
  const num_iscritti = (corso.atleti_ids || []).length;

  return (
    <div
      onClick={onClick}
      className="bg-card rounded-xl shadow-card p-5 hover:shadow-card-hover transition-shadow cursor-pointer border border-border/50 hover:border-primary/30 space-y-3"
    >
      <div className="space-y-1">
        <h3 className="font-bold text-foreground text-lg leading-tight">{corso.nome}</h3>
        {corso.giorno && corso.ora_inizio && corso.ora_fine ? (
          <p className="text-sm text-muted-foreground">
            {corso.giorno} {corso.ora_inizio?.slice(0, 5)} – {corso.ora_fine?.slice(0, 5)}
          </p>
        ) : (
          <Badge variant="secondary" className="text-[10px] bg-muted text-muted-foreground">Da posizionare</Badge>
        )}
      </div>

      <div className="flex items-center gap-2 flex-wrap">
        <span className={`inline-flex items-center text-xs font-semibold px-2.5 py-0.5 rounded-full border ${get_livello_badge_classes(livello)}`}>
          {livello_label}
        </span>
        {corso.tipo && (
          <Badge variant="secondary" className="text-xs">{corso.tipo}</Badge>
        )}
      </div>

      {istruttori_corso.length > 0 && (
        <p className="text-sm text-foreground">
          {istruttori_corso.map((i: any) => `${i.nome} ${i.cognome}`).join(", ")}
        </p>
      )}

      <div className="flex items-center justify-between pt-2 border-t border-border/50">
        <div className="flex items-center gap-2">
          <Users className="w-4 h-4 text-muted-foreground" />
          <span className="text-sm font-medium text-foreground">{num_iscritti} iscritti</span>
        </div>
        <Button
          size="sm"
          variant="outline"
          className="text-xs h-8"
          onClick={(e) => {
            e.stopPropagation();
            onGestisciIscrizioni();
          }}
        >
          Gestisci iscrizioni
        </Button>
      </div>
    </div>
  );
};

// ─── Filter bar ────────────────────────────────────────────
const GIORNI_FILTRO = ["Tutti", ...GIORNI_DB];

const FilterBar: React.FC<{
  giorno: string;
  setGiorno: (g: string) => void;
  tipo: string;
  setTipo: (t: string) => void;
  istruttoreId: string;
  setIstruttoreId: (id: string) => void;
  tipi: string[];
  istruttori: any[];
  onReset: () => void;
  hasFilters: boolean;
}> = ({ giorno, setGiorno, tipo, setTipo, istruttoreId, setIstruttoreId, tipi, istruttori, onReset, hasFilters }) => (
  <div className="bg-card rounded-xl border border-border p-4 space-y-3">
    {/* Day pills */}
    <div className="flex flex-wrap gap-1.5">
      {GIORNI_FILTRO.map((g) => (
        <button
          key={g}
          onClick={() => setGiorno(g)}
          className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors border ${
            giorno === g
              ? "bg-primary text-primary-foreground border-primary"
              : "bg-background text-foreground border-border hover:border-primary/40"
          }`}
        >
          {g}
        </button>
      ))}
    </div>

    <div className="flex flex-wrap gap-2 items-center">
      {/* Tipo dropdown */}
      <div className="relative">
        <select
          value={tipo}
          onChange={(e) => setTipo(e.target.value)}
          className={`${input_cls} appearance-none pr-8 min-w-[160px]`}
        >
          <option value="">Tutti i tipi</option>
          {tipi.map((t) => (
            <option key={t} value={t}>{t}</option>
          ))}
        </select>
        <ChevronDown className="w-4 h-4 text-muted-foreground absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none" />
      </div>

      {/* Istruttore dropdown */}
      <div className="relative">
        <select
          value={istruttoreId}
          onChange={(e) => setIstruttoreId(e.target.value)}
          className={`${input_cls} appearance-none pr-8 min-w-[180px]`}
        >
          <option value="">Tutti gli istruttori</option>
          {istruttori.filter((i: any) => i.attivo).map((i: any) => (
            <option key={i.id} value={i.id}>{i.nome} {i.cognome}</option>
          ))}
        </select>
        <ChevronDown className="w-4 h-4 text-muted-foreground absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none" />
      </div>

      {hasFilters && (
        <Button variant="ghost" size="sm" onClick={onReset} className="text-xs text-muted-foreground">
          <X className="w-3.5 h-3.5 mr-1" /> Azzera filtri
        </Button>
      )}
    </div>
  </div>
);

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
  const [default_tab, set_default_tab] = useState<string | undefined>(undefined);
  const [vista, set_vista] = useState<"giorno" | "istruttore">("giorno");

  // Filters
  const [filtro_giorno, set_filtro_giorno] = useState("Tutti");
  const [filtro_tipo, set_filtro_tipo] = useState("");
  const [filtro_istruttore, set_filtro_istruttore] = useState("");

  const has_filters = filtro_giorno !== "Tutti" || filtro_tipo !== "" || filtro_istruttore !== "";

  const reset_filters = () => {
    set_filtro_giorno("Tutti");
    set_filtro_tipo("");
    set_filtro_istruttore("");
  };

  const corsi_filtrati = useMemo(() => {
    return corsi
      .filter((c: any) => filtro_giorno === "Tutti" || c.giorno === filtro_giorno)
      .filter((c: any) => !filtro_tipo || c.tipo === filtro_tipo)
      .filter((c: any) => !filtro_istruttore || (c.istruttori_ids || []).includes(filtro_istruttore))
      .sort((a: any, b: any) => {
        const day_a = GIORNI_DB.indexOf(a.giorno);
        const day_b = GIORNI_DB.indexOf(b.giorno);
        if (day_a !== day_b) return day_a - day_b;
        return time_to_min(a.ora_inizio) - time_to_min(b.ora_inizio);
      });
  }, [corsi, filtro_giorno, filtro_tipo, filtro_istruttore]);

  const corsi_per_giorno = useMemo(() => {
    const groups: Record<string, any[]> = {};
    GIORNI_DB.forEach(g => { groups[g] = []; });
    groups["Da pianificare"] = [];
    corsi_filtrati.forEach((c: any) => {
      if (c.giorno && GIORNI_DB.includes(c.giorno)) groups[c.giorno].push(c);
      else groups["Da pianificare"].push(c);
    });
    return groups;
  }, [corsi_filtrati]);

  const corsi_per_istruttore = useMemo(() => {
    const groups: Record<string, { label: string; corsi: any[] }> = {};
    groups["_none"] = { label: "Senza istruttore", corsi: [] };
    istruttori.filter((i: any) => i.attivo).forEach((i: any) => {
      groups[i.id] = { label: `${i.nome} ${i.cognome}`, corsi: [] };
    });
    corsi_filtrati.forEach((c: any) => {
      const ids = c.istruttori_ids || [];
      if (ids.length === 0) groups["_none"].corsi.push(c);
      else ids.forEach((id: string) => { if (groups[id]) groups[id].corsi.push(c); });
    });
    return groups;
  }, [corsi_filtrati, istruttori]);

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

  const open_iscrizioni = (corso: any) => {
    set_selected_corso(corso);
    set_default_tab("iscrizioni");
    set_modal_open(true);
  };

  const open_corso = (corso: any) => {
    set_selected_corso(corso);
    set_default_tab(undefined);
    set_modal_open(true);
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
              set_default_tab(undefined);
              set_modal_open(true);
            }}
          >
            <Plus className="w-4 h-4 mr-2" /> {t("nuovo_corso")}
          </Button>
        </div>

        {/* Vista toggle */}
        <div className="flex items-center gap-3 flex-wrap">
          <div className="inline-flex rounded-lg border border-border overflow-hidden">
            {(["giorno", "istruttore"] as const).map((v) => (
              <button key={v} onClick={() => set_vista(v)}
                className={`px-4 py-1.5 text-sm font-medium transition-colors ${vista === v ? "bg-primary text-primary-foreground" : "bg-card text-foreground hover:bg-muted"}`}>
                {v === "giorno" ? "Per giorno" : "Per istruttore"}
              </button>
            ))}
          </div>
        </div>

        <FilterBar
          giorno={filtro_giorno}
          setGiorno={set_filtro_giorno}
          tipo={filtro_tipo}
          setTipo={set_filtro_tipo}
          istruttoreId={filtro_istruttore}
          setIstruttoreId={set_filtro_istruttore}
          tipi={tipi_corso}
          istruttori={istruttori}
          onReset={reset_filters}
          hasFilters={has_filters}
        />

        {corsi_filtrati.length === 0 ? (
          <div className="bg-card rounded-xl shadow-card p-12 text-center text-muted-foreground">
            <p className="text-sm">
              {has_filters
                ? "Nessun corso trovato con questi filtri."
                : "Nessun corso. Clicca \"Nuovo corso\" per aggiungerne uno."}
            </p>
          </div>
        ) : vista === "giorno" ? (
          <div className="space-y-6">
            {[...GIORNI_DB, "Da pianificare"].map((giorno) => {
              const group = corsi_per_giorno[giorno] || [];
              if (group.length === 0) return null;
              return (
                <div key={giorno}>
                  <h2 className="text-sm font-bold text-muted-foreground uppercase tracking-widest mb-3 border-b border-border pb-1">
                    {giorno === "Da pianificare" ? "📋 Da pianificare" : giorno}
                    <span className="text-xs font-normal ml-2 text-muted-foreground">({group.length})</span>
                  </h2>
                  <div className="space-y-2">
                    {group.map((c: any) => {
                      const istruttori_corso = (c.istruttori_ids || []).map((id: string) => istruttori.find((i: any) => i.id === id)).filter(Boolean);
                      return (
                        <div key={c.id} onClick={() => open_corso(c)}
                          className="flex items-center gap-4 px-4 py-3 bg-card rounded-xl border border-border/50 hover:border-primary/30 cursor-pointer transition-shadow hover:shadow-card-hover">
                          <div className="w-24 text-xs font-bold text-primary tabular-nums flex-shrink-0">
                            {c.ora_inizio?.slice(0,5)}–{c.ora_fine?.slice(0,5)}
                          </div>
                          <div className="flex-1 min-w-0">
                            <span className="font-semibold text-foreground">{c.nome}</span>
                          </div>
                          <span className="text-sm text-muted-foreground truncate max-w-[140px]">
                            {istruttori_corso.map((i: any) => `${i.nome} ${i.cognome?.charAt(0)}.`).join(", ") || "—"}
                          </span>
                          {c.tipo && <Badge variant="secondary" className="text-xs flex-shrink-0">{c.tipo}</Badge>}
                          <span className="text-xs text-muted-foreground flex-shrink-0">{(c.atleti_ids||[]).length} iscritti</span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="space-y-6">
            {Object.entries(corsi_per_istruttore).map(([key, { label, corsi: group }]) => {
              if (group.length === 0) return null;
              return (
                <div key={key}>
                  <h2 className="text-sm font-bold text-muted-foreground uppercase tracking-widest mb-3 border-b border-border pb-1">
                    {label}
                    <span className="text-xs font-normal ml-2 text-muted-foreground">({group.length})</span>
                  </h2>
                  <div className="space-y-2">
                    {group.sort((a: any, b: any) => GIORNI_DB.indexOf(a.giorno) - GIORNI_DB.indexOf(b.giorno) || time_to_min(a.ora_inizio) - time_to_min(b.ora_inizio)).map((c: any) => (
                      <div key={c.id} onClick={() => open_corso(c)}
                        className="flex items-center gap-4 px-4 py-3 bg-card rounded-xl border border-border/50 hover:border-primary/30 cursor-pointer transition-shadow hover:shadow-card-hover">
                        <div className="w-20 text-xs font-bold text-muted-foreground flex-shrink-0">{c.giorno || "—"}</div>
                        <div className="w-24 text-xs font-bold text-primary tabular-nums flex-shrink-0">
                          {c.ora_inizio?.slice(0,5)}–{c.ora_fine?.slice(0,5)}
                        </div>
                        <div className="flex-1 min-w-0">
                          <span className="font-semibold text-foreground">{c.nome}</span>
                        </div>
                        {c.tipo && <Badge variant="secondary" className="text-xs flex-shrink-0">{c.tipo}</Badge>}
                        <span className="text-xs text-muted-foreground flex-shrink-0">{(c.atleti_ids||[]).length} iscritti</span>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </>
  );
};

export default CoursesPage;
