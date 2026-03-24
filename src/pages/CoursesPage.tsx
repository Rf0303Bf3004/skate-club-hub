import React, { useState, useMemo } from "react";
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
} from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { supabase, get_current_club_id } from "@/lib/supabase";

const GIORNI_DB = ["Lunedì", "Martedì", "Mercoledì", "Giovedì", "Venerdì", "Sabato", "Domenica"];

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

const input_cls =
  "w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40";

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
  atleti_iscritti_ids: string[];
  tutti_atleti: any[];
  on_refresh: () => void;
}> = ({ corso_id, atleti_iscritti_ids, tutti_atleti, on_refresh }) => {
  const [query, set_query] = useState("");
  const [saving, set_saving] = useState(false);
  const [removing, set_removing] = useState<string | null>(null);

  const atleti_iscritti = tutti_atleti.filter((a: any) => atleti_iscritti_ids.includes(a.id));
  const atleti_disponibili = useMemo(() => {
    const q = query.toLowerCase();
    return tutti_atleti
      .filter((a: any) => a.stato === "attivo" && !atleti_iscritti_ids.includes(a.id))
      .filter((a: any) => !q || `${a.nome} ${a.cognome}`.toLowerCase().includes(q))
      .slice(0, 20);
  }, [tutti_atleti, atleti_iscritti_ids, query]);

  const handle_iscrivi = async (atleta_id: string) => {
    set_saving(true);
    try {
      const { error } = await supabase.from("iscrizioni_corsi").insert({
        corso_id,
        atleta_id,
        attiva: true,
        data_iscrizione: new Date().toISOString().split("T")[0],
      });
      if (error) throw error;
      set_query("");
      on_refresh();
      toast({ title: "✅ Atleta iscritta al corso" });
    } catch (err: any) {
      toast({ title: "Errore iscrizione", description: err?.message, variant: "destructive" });
    } finally {
      set_saving(false);
    }
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

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Aggiungi atleta</p>
        <div className="relative">
          <Search className="w-3.5 h-3.5 text-muted-foreground absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            value={query}
            onChange={(e) => set_query(e.target.value)}
            placeholder="Filtra per nome..."
            className="w-full rounded-lg border border-border bg-background pl-9 pr-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
          />
        </div>
        <div className="border border-border rounded-xl overflow-hidden divide-y divide-border/50 max-h-48 overflow-y-auto">
          {atleti_disponibili.length === 0 ? (
            <p className="text-xs text-muted-foreground px-3 py-3 text-center">
              {query ? "Nessuna atleta trovata" : "Tutte le atlete sono già iscritte"}
            </p>
          ) : (
            atleti_disponibili.map((a: any) => (
              <div
                key={a.id}
                className="flex items-center justify-between px-3 py-2 hover:bg-muted/30 transition-colors"
              >
                <div className="flex items-center gap-2">
                  <div className="w-6 h-6 rounded-full bg-muted flex items-center justify-center text-muted-foreground text-[10px] font-bold">
                    {a.nome[0]}
                    {a.cognome[0]}
                  </div>
                  <span className="text-sm text-foreground">
                    {a.nome} {a.cognome}
                  </span>
                </div>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => handle_iscrivi(a.id)}
                  disabled={saving}
                  className="h-7 text-xs text-primary hover:bg-primary/10 gap-1"
                >
                  <UserPlus className="w-3.5 h-3.5" /> Iscrivi
                </Button>
              </div>
            ))
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
                    {a.nome[0]}
                    {a.cognome[0]}
                  </div>
                  <div>
                    <p className="text-sm font-medium text-foreground">
                      {a.nome} {a.cognome}
                    </p>
                    <p className="text-xs text-muted-foreground">{a.livello_amatori}</p>
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

  const monitori_ids: string[] = corso.monitori || [];
  const aiuto_ids: string[] = corso.aiuto_monitori || [];

  const toggle_persona = async (persona_id: string, tipo: "monitore" | "aiuto_monitore") => {
    set_saving(true);
    try {
      const lista = tipo === "monitore" ? monitori_ids : aiuto_ids;
      const is_present = lista.includes(persona_id);
      if (is_present) {
        await supabase.from("corsi_monitori").delete().eq("corso_id", corso.id).eq("persona_id", persona_id);
      } else {
        await supabase.from("corsi_monitori").insert({ corso_id: corso.id, persona_id, tipo });
      }
      on_refresh();
    } catch (err: any) {
      toast({ title: "Errore", description: err?.message, variant: "destructive" });
    } finally {
      set_saving(false);
    }
  };

  const monitori = tutti_monitori.filter((a) => a.ruolo_pista === "monitore");
  const aiuto_monitori = tutti_monitori.filter((a) => a.ruolo_pista === "aiuto_monitore");

  const PersonaRow: React.FC<{
    persona: any;
    tipo: "monitore" | "aiuto_monitore";
    selected: boolean;
  }> = ({ persona, tipo, selected }) => (
    <div
      onClick={() => !saving && toggle_persona(persona.id, tipo)}
      className={`flex items-center justify-between px-3 py-2.5 rounded-xl border-2 cursor-pointer transition-all
        ${selected ? "border-primary bg-primary/5" : "border-border hover:border-primary/40 bg-background"}`}
    >
      <div className="flex items-center gap-2">
        <div
          className={`w-4 h-4 rounded border-2 flex items-center justify-center flex-shrink-0
          ${selected ? "border-primary bg-primary" : "border-muted-foreground"}`}
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
            Monitori ({monitori_ids.length} assegnati)
          </p>
          <div className="space-y-1.5">
            {monitori.map((m) => (
              <PersonaRow key={m.id} persona={m} tipo="monitore" selected={monitori_ids.includes(m.id)} />
            ))}
          </div>
        </div>
      )}
      {aiuto_monitori.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs font-bold text-muted-foreground uppercase tracking-wide">
            Aiuto monitori ({aiuto_ids.length} assegnati)
          </p>
          <div className="space-y-1.5">
            {aiuto_monitori.map((m) => (
              <PersonaRow key={m.id} persona={m} tipo="aiuto_monitore" selected={aiuto_ids.includes(m.id)} />
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
  const [show_sostituto, set_show_sostituto] = useState<string | null>(null);
  const { data: presenze = [] } = use_presenze_corso(corso.id, data_sel);
  const upsert_presenza = use_upsert_presenza_corso();

  const monitori_assegnati = tutti_monitori.filter(
    (a) => (corso.monitori || []).includes(a.id) || (corso.aiuto_monitori || []).includes(a.id),
  );

  const get_stato_persona = (persona_id: string) => {
    const p = presenze.find((x: any) => x.persona_id === persona_id);
    return p?.stato || "attesa";
  };

  const get_sostituto_persona = (persona_id: string) => {
    const p = presenze.find((x: any) => x.persona_id === persona_id);
    return p?.sostituto_id || null;
  };

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

  // Genera link WhatsApp per remind
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
    const tel_clean = tel.replace(/\s+/g, "").replace(/^0/, "+41");
    return `https://wa.me/${tel_clean}?text=${msg}`;
  };

  const stato_icon = (stato: string) => {
    if (stato === "confermato") return <CheckCircle className="w-4 h-4 text-success" />;
    if (stato === "assente") return <XCircle className="w-4 h-4 text-destructive" />;
    if (stato === "sostituito") return <ArrowRightLeft className="w-4 h-4 text-orange-500" />;
    return <Clock className="w-4 h-4 text-muted-foreground" />;
  };

  const stato_label = (stato: string) => {
    if (stato === "confermato") return "Confermato";
    if (stato === "assente") return "Assente";
    if (stato === "sostituito") return "Sostituito";
    return "In attesa";
  };

  const monitori_disponibili_sostituzione = tutti_monitori.filter(
    (m) => !monitori_assegnati.find((ma) => ma.id === m.id),
  );

  return (
    <div className="space-y-4">
      {/* Selezione data */}
      <div className="flex items-center gap-3">
        <Field label="Data lezione">
          <input type="date" value={data_sel} onChange={(e) => set_data_sel(e.target.value)} className={input_cls} />
        </Field>
      </div>

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
            {/* Invia remind a tutti */}
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

                {/* Azioni stato */}
                <div className="flex gap-1.5 flex-wrap">
                  {["confermato", "assente", "attesa"].map((s) => (
                    <button
                      key={s}
                      onClick={() => handle_set_stato(persona.id, tipo as any, s as any)}
                      className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-all border
                        ${
                          stato === s
                            ? s === "confermato"
                              ? "bg-success text-white border-success"
                              : s === "assente"
                                ? "bg-destructive text-white border-destructive"
                                : "bg-muted text-foreground border-border"
                            : "bg-background text-muted-foreground border-border hover:border-primary/40"
                        }`}
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

                {/* Sostituto se assente */}
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
                            if (e.target.value) {
                              handle_set_stato(persona.id, tipo as any, "sostituito", e.target.value);
                            }
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
    costo_mensile: corso?.costo_mensile ?? 0,
    costo_annuale: corso?.costo_annuale ?? 0,
    istruttori_ids: corso?.istruttori_ids || [],
    attivo: corso?.stato === "attivo" || corso?.attivo !== false,
    note: corso?.note || "",
    stagione_id: corso?.stagione_id || null,
  });
  const [confirm_delete, set_confirm_delete] = useState(false);
  const [avviso_istruttori, set_avviso_istruttori] = useState<string[]>([]);
  const [confirm_forzatura, set_confirm_forzatura] = useState(false);

  const set_val = (k: string, v: any) => set_form((p) => ({ ...p, [k]: v }));

  const toggle_istruttore = (id: string) => {
    set_form((p) => ({
      ...p,
      istruttori_ids: p.istruttori_ids.includes(id)
        ? p.istruttori_ids.filter((x: string) => x !== id)
        : [...p.istruttori_ids, id],
    }));
  };

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
    on_save({ ...form, id: corso?.id });
  };

  const istruttori_attivi = istruttori.filter((i) => i.attivo);

  // Determina quante tab mostrare
  const ha_monitori =
    corso?.id &&
    (monitori.filter((m) => m.ruolo_pista === "monitore").length > 0 ||
      monitori.filter((m) => m.ruolo_pista === "aiuto_monitore").length > 0);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <div className="bg-card rounded-2xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between px-6 py-4 border-b border-border">
          <h2 className="text-base font-bold text-foreground">{corso?.id ? "Modifica corso" : "Nuovo corso"}</h2>
          <button onClick={on_close} className="text-muted-foreground hover:text-foreground">
            <X className="w-5 h-5" />
          </button>
        </div>

        {confirm_forzatura && (
          <div className="mx-6 mt-4 bg-orange-50 border border-orange-200 rounded-xl p-4 space-y-3">
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
                  on_save({ ...form, id: corso?.id });
                }}
                disabled={saving}
                className="flex-1 bg-orange-500 hover:bg-orange-600 text-white"
              >
                {saving ? "..." : "Salva comunque"}
              </Button>
            </div>
          </div>
        )}

        <Tabs defaultValue="info" className="px-6 pt-4">
          <TabsList className="w-full flex">
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

          {/* ── Info ── */}
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
            <div className="grid grid-cols-2 gap-3">
              <Field label="Costo mensile">
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-xs">CHF</span>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={form.costo_mensile}
                    onChange={(e) => set_val("costo_mensile", parseFloat(e.target.value) || 0)}
                    className={`${input_cls} pl-11`}
                  />
                </div>
              </Field>
              <Field label="Costo annuale">
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-xs">CHF</span>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={form.costo_annuale}
                    onChange={(e) => set_val("costo_annuale", parseFloat(e.target.value) || 0)}
                    className={`${input_cls} pl-11`}
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
                      className={`flex items-center justify-between px-3 py-2.5 rounded-xl border-2 cursor-pointer transition-all
                        ${
                          selected
                            ? ha_conflitto
                              ? "border-destructive bg-destructive/5"
                              : !disponibile
                                ? "border-orange-400 bg-orange-50"
                                : "border-primary bg-primary/5"
                            : "border-border hover:border-primary/40 bg-background"
                        }`}
                    >
                      <div className="flex items-center gap-2">
                        <div
                          className={`w-4 h-4 rounded border-2 flex items-center justify-center flex-shrink-0
                          ${selected ? (ha_conflitto ? "border-destructive bg-destructive" : "border-primary bg-primary") : "border-muted-foreground"}`}
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

          {/* ── Iscrizioni ── */}
          <TabsContent value="iscrizioni" className="py-4">
            {corso?.id && (
              <TabIscrizioni
                corso_id={corso.id}
                atleti_iscritti_ids={corso.atleti_ids || []}
                tutti_atleti={atleti}
                on_refresh={() => qc.invalidateQueries({ queryKey: ["corsi"] })}
              />
            )}
          </TabsContent>

          {/* ── Monitori ── */}
          <TabsContent value="monitori" className="py-4">
            {corso?.id && (
              <TabMonitori
                corso={corso}
                tutti_monitori={monitori}
                on_refresh={() => qc.invalidateQueries({ queryKey: ["corsi"] })}
              />
            )}
          </TabsContent>

          {/* ── Presenze ── */}
          <TabsContent value="presenze" className="py-4">
            {corso?.id && (
              <TabPresenze corso={corso} tutti_atleti={atleti} tutti_monitori={monitori} istruttori={istruttori} />
            )}
          </TabsContent>
        </Tabs>

        <div className="px-6 py-4 border-t border-border space-y-2">
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

        <div className="bg-card rounded-xl shadow-card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border">
                  <th className="text-left px-4 py-3 text-xs font-bold text-muted-foreground uppercase tracking-wider">
                    {t("nome")}
                  </th>
                  <th className="text-left px-4 py-3 text-xs font-bold text-muted-foreground uppercase tracking-wider">
                    {t("tipo")}
                  </th>
                  <th className="text-left px-4 py-3 text-xs font-bold text-muted-foreground uppercase tracking-wider hidden sm:table-cell">
                    {t("giorno")}
                  </th>
                  <th className="text-left px-4 py-3 text-xs font-bold text-muted-foreground uppercase tracking-wider hidden sm:table-cell">
                    {t("ora_inizio")}
                  </th>
                  <th className="text-left px-4 py-3 text-xs font-bold text-muted-foreground uppercase tracking-wider hidden md:table-cell">
                    {t("istruttori")}
                  </th>
                  <th className="text-center px-4 py-3 text-xs font-bold text-muted-foreground uppercase tracking-wider">
                    Monitori
                  </th>
                  <th className="text-center px-4 py-3 text-xs font-bold text-muted-foreground uppercase tracking-wider">
                    {t("iscritti")}
                  </th>
                  <th className="text-right px-4 py-3 text-xs font-bold text-muted-foreground uppercase tracking-wider hidden lg:table-cell">
                    {t("costo_mensile")}
                  </th>
                  <th className="text-center px-4 py-3 text-xs font-bold text-muted-foreground uppercase tracking-wider">
                    {t("stato")}
                  </th>
                </tr>
              </thead>
              <tbody>
                {corsi.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="px-4 py-12 text-center text-muted-foreground text-sm">
                      Nessun corso. Clicca "Nuovo corso" per aggiungerne uno.
                    </td>
                  </tr>
                ) : (
                  corsi.map((c: any) => (
                    <tr
                      key={c.id}
                      onClick={() => {
                        set_selected_corso(c);
                        set_modal_open(true);
                      }}
                      className="border-b border-border/50 hover:bg-muted/30 cursor-pointer transition-colors"
                    >
                      <td className="px-4 py-3 font-medium text-foreground">{c.nome}</td>
                      <td className="px-4 py-3">
                        <Badge variant="secondary" className="text-xs">
                          {c.tipo || "—"}
                        </Badge>
                      </td>
                      <td className="px-4 py-3 text-muted-foreground hidden sm:table-cell">{c.giorno}</td>
                      <td className="px-4 py-3 tabular-nums text-muted-foreground hidden sm:table-cell">
                        {c.ora_inizio?.slice(0, 5)} - {c.ora_fine?.slice(0, 5)}
                      </td>
                      <td className="px-4 py-3 text-muted-foreground hidden md:table-cell">
                        {(c.istruttori_ids || [])
                          .map((id: string) => get_istruttore_name_from_list(istruttori, id))
                          .join(", ")}
                      </td>
                      <td className="px-4 py-3 text-center tabular-nums text-muted-foreground">
                        {(c.monitori?.length || 0) + (c.aiuto_monitori?.length || 0) > 0 ? (
                          <Badge variant="outline" className="text-xs">
                            {(c.monitori?.length || 0) + (c.aiuto_monitori?.length || 0)}
                          </Badge>
                        ) : (
                          "—"
                        )}
                      </td>
                      <td className="px-4 py-3 text-center tabular-nums font-medium text-foreground">
                        {(c.atleti_ids || []).length}
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums text-muted-foreground hidden lg:table-cell">
                        CHF {c.costo_mensile}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span
                          className={`inline-block w-2 h-2 rounded-full ${c.stato === "attivo" ? "bg-success" : "bg-muted-foreground"}`}
                        />
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </>
  );
};

export default CoursesPage;
