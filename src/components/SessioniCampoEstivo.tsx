import React, { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase, get_current_club_id } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { toast } from "@/hooks/use-toast";
import {
  Plus,
  Calendar,
  Clock,
  MapPin,
  User,
  Trash2,
  ChevronDown,
  ChevronUp,
  Users,
} from "lucide-react";

interface Props {
  gara_id: string;
}

const input_cls =
  "w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40";

interface SessioneForm {
  data: string;
  ora_inizio: string;
  ora_fine: string;
  luogo: string;
  istruttore_id: string;
  note: string;
}

const empty_session = (): SessioneForm => ({
  data: "",
  ora_inizio: "",
  ora_fine: "",
  luogo: "",
  istruttore_id: "",
  note: "",
});

const SessioniCampoEstivo: React.FC<Props> = ({ gara_id }) => {
  const qc = useQueryClient();
  const [open_form, set_open_form] = useState(false);
  const [form, set_form] = useState<SessioneForm>(empty_session());
  const [saving, set_saving] = useState(false);
  const [expanded_id, set_expanded_id] = useState<string | null>(null);

  // ─── Sessioni ──
  const { data: sessioni = [], isLoading } = useQuery({
    queryKey: ["sessioni-campo", gara_id],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("sessioni_campo")
        .select("*")
        .eq("gara_id", gara_id)
        .order("data");
      if (error) throw error;
      return data ?? [];
    },
  });

  // ─── Atleti del club ──
  const { data: atleti = [] } = useQuery({
    queryKey: ["atleti-club-sessioni", get_current_club_id()],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("atleti")
        .select("id, nome, cognome, attivo")
        .eq("club_id", get_current_club_id())
        .order("cognome");
      if (error) throw error;
      return (data ?? []).filter((a: any) => a.attivo !== false);
    },
  });

  // ─── Istruttori del club ──
  const { data: istruttori = [] } = useQuery({
    queryKey: ["istruttori-club-sessioni", get_current_club_id()],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("istruttori")
        .select("id, nome, cognome")
        .eq("club_id", get_current_club_id())
        .order("cognome");
      if (error) throw error;
      return data ?? [];
    },
  });

  // ─── Presenze (per sessione espansa) ──
  const { data: presenze = [] } = useQuery({
    queryKey: ["presenze-campo", expanded_id],
    queryFn: async () => {
      if (!expanded_id) return [];
      const { data, error } = await (supabase as any)
        .from("presenze_campo")
        .select("*")
        .eq("sessione_id", expanded_id);
      if (error) throw error;
      return data ?? [];
    },
    enabled: !!expanded_id,
  });

  const presenza_map: Record<string, any> = {};
  presenze.forEach((p: any) => {
    presenza_map[p.atleta_id] = p;
  });

  const handle_save_session = async () => {
    if (!form.data) {
      toast({ title: "Data obbligatoria", variant: "destructive" });
      return;
    }
    set_saving(true);
    try {
      const { error } = await (supabase as any).from("sessioni_campo").insert({
        gara_id,
        data: form.data,
        ora_inizio: form.ora_inizio || null,
        ora_fine: form.ora_fine || null,
        luogo: form.luogo.trim() || null,
        istruttore_id: form.istruttore_id || null,
        note: form.note.trim() || null,
      });
      if (error) throw error;
      await qc.invalidateQueries({ queryKey: ["sessioni-campo", gara_id] });
      toast({ title: "Sessione aggiunta!" });
      set_open_form(false);
      set_form(empty_session());
    } catch (err: any) {
      toast({
        title: "Errore",
        description: err?.message,
        variant: "destructive",
      });
    } finally {
      set_saving(false);
    }
  };

  const handle_delete_session = async (id: string) => {
    if (!confirm("Eliminare questa sessione e tutte le presenze collegate?")) return;
    try {
      const { error } = await (supabase as any)
        .from("sessioni_campo")
        .delete()
        .eq("id", id);
      if (error) throw error;
      await qc.invalidateQueries({ queryKey: ["sessioni-campo", gara_id] });
      if (expanded_id === id) set_expanded_id(null);
      toast({ title: "Sessione eliminata" });
    } catch (err: any) {
      toast({ title: "Errore", description: err?.message, variant: "destructive" });
    }
  };

  const toggle_presenza = async (sessione_id: string, atleta_id: string, presente: boolean) => {
    const existing = presenza_map[atleta_id];
    try {
      if (existing) {
        const { error } = await (supabase as any)
          .from("presenze_campo")
          .update({ presente })
          .eq("id", existing.id);
        if (error) throw error;
      } else {
        const { error } = await (supabase as any).from("presenze_campo").insert({
          sessione_id,
          atleta_id,
          presente,
        });
        if (error) throw error;
      }
      await qc.invalidateQueries({ queryKey: ["presenze-campo", sessione_id] });
    } catch (err: any) {
      toast({ title: "Errore presenza", description: err?.message, variant: "destructive" });
    }
  };

  const istr_label = (id: string | null) => {
    if (!id) return null;
    const i = istruttori.find((x: any) => x.id === id);
    return i ? `${i.nome} ${i.cognome}` : null;
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-bold text-foreground flex items-center gap-2">
          <Calendar className="w-4 h-4" /> Sessioni ({sessioni.length})
        </h3>
        <Button onClick={() => set_open_form(true)} size="sm" className="gap-2">
          <Plus className="w-4 h-4" /> Aggiungi sessione
        </Button>
      </div>

      {isLoading ? (
        <div className="text-sm text-muted-foreground py-4">Caricamento…</div>
      ) : sessioni.length === 0 ? (
        <div className="bg-muted/20 rounded-xl p-8 text-center text-muted-foreground">
          <Calendar className="w-8 h-8 mx-auto mb-2 opacity-30" />
          <p className="text-sm">Nessuna sessione ancora aggiunta.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {sessioni.map((s: any) => {
            const is_open = expanded_id === s.id;
            const istr_name = istr_label(s.istruttore_id);
            const presenti_count = is_open
              ? presenze.filter((p: any) => p.presente).length
              : null;
            return (
              <div key={s.id} className="bg-card border border-border rounded-xl overflow-hidden">
                <button
                  type="button"
                  onClick={() => set_expanded_id(is_open ? null : s.id)}
                  className="w-full flex items-center gap-3 px-4 py-3 hover:bg-muted/30 transition-colors text-left"
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-semibold text-foreground">
                        {new Date(s.data + "T00:00:00").toLocaleDateString("it-CH", {
                          weekday: "short",
                          day: "numeric",
                          month: "short",
                          year: "numeric",
                        })}
                      </span>
                      {(s.ora_inizio || s.ora_fine) && (
                        <Badge variant="outline" className="text-[10px] gap-1">
                          <Clock className="w-3 h-3" />
                          {(s.ora_inizio || "").slice(0, 5)}
                          {s.ora_fine ? ` — ${(s.ora_fine || "").slice(0, 5)}` : ""}
                        </Badge>
                      )}
                      {presenti_count !== null && (
                        <Badge className="text-[10px] gap-1 bg-primary/10 text-primary hover:bg-primary/10">
                          <Users className="w-3 h-3" />
                          {presenti_count} presenti
                        </Badge>
                      )}
                    </div>
                    <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground flex-wrap">
                      {s.luogo && (
                        <span className="flex items-center gap-1">
                          <MapPin className="w-3 h-3" /> {s.luogo}
                        </span>
                      )}
                      {istr_name && (
                        <span className="flex items-center gap-1">
                          <User className="w-3 h-3" /> {istr_name}
                        </span>
                      )}
                      {s.note && <span className="italic truncate">{s.note}</span>}
                    </div>
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={(e) => {
                      e.stopPropagation();
                      handle_delete_session(s.id);
                    }}
                    className="text-destructive hover:bg-destructive/10 h-8 w-8 p-0"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </Button>
                  {is_open ? (
                    <ChevronUp className="w-4 h-4 text-muted-foreground" />
                  ) : (
                    <ChevronDown className="w-4 h-4 text-muted-foreground" />
                  )}
                </button>

                {is_open && (
                  <div className="border-t border-border bg-muted/10 px-4 py-3 space-y-2">
                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                      Presenze atleti ({atleti.length})
                    </p>
                    {atleti.length === 0 ? (
                      <p className="text-sm text-muted-foreground py-3">
                        Nessun atleta attivo nel club.
                      </p>
                    ) : (
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 max-h-80 overflow-y-auto">
                        {atleti.map((a: any) => {
                          const p = presenza_map[a.id];
                          const checked = !!(p && p.presente);
                          return (
                            <label
                              key={a.id}
                              className={`flex items-center gap-2 px-3 py-2 rounded-lg cursor-pointer transition-colors ${
                                checked
                                  ? "bg-primary/10 border border-primary/30"
                                  : "bg-background border border-border hover:border-primary/30"
                              }`}
                            >
                              <Checkbox
                                checked={checked}
                                onCheckedChange={(v) => toggle_presenza(s.id, a.id, !!v)}
                              />
                              <span className="text-sm text-foreground truncate">
                                {a.cognome} {a.nome}
                              </span>
                            </label>
                          );
                        })}
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Modal nuova sessione */}
      <Dialog open={open_form} onOpenChange={set_open_form}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Nuova sessione</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                Data *
              </label>
              <input
                type="date"
                value={form.data}
                onChange={(e) => set_form((p) => ({ ...p, data: e.target.value }))}
                className={input_cls}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                  Ora inizio
                </label>
                <input
                  type="time"
                  value={form.ora_inizio}
                  onChange={(e) => set_form((p) => ({ ...p, ora_inizio: e.target.value }))}
                  className={input_cls}
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                  Ora fine
                </label>
                <input
                  type="time"
                  value={form.ora_fine}
                  onChange={(e) => set_form((p) => ({ ...p, ora_fine: e.target.value }))}
                  className={input_cls}
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                Luogo
              </label>
              <input
                value={form.luogo}
                onChange={(e) => set_form((p) => ({ ...p, luogo: e.target.value }))}
                placeholder="es. Pista Lugano"
                className={input_cls}
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                Istruttore
              </label>
              <select
                value={form.istruttore_id}
                onChange={(e) => set_form((p) => ({ ...p, istruttore_id: e.target.value }))}
                className={input_cls}
              >
                <option value="">— Nessuno —</option>
                {istruttori.map((i: any) => (
                  <option key={i.id} value={i.id}>
                    {i.nome} {i.cognome}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                Note
              </label>
              <textarea
                value={form.note}
                onChange={(e) => set_form((p) => ({ ...p, note: e.target.value }))}
                rows={2}
                placeholder="Note sulla sessione..."
                className={`${input_cls} resize-none`}
              />
            </div>
            <div className="flex justify-end gap-3 pt-2">
              <Button variant="outline" onClick={() => set_open_form(false)} disabled={saving}>
                Annulla
              </Button>
              <Button onClick={handle_save_session} disabled={saving}>
                {saving ? "..." : "Salva"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default SessioniCampoEstivo;
