import React, { useState, useEffect } from "react";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "@/hooks/use-toast";
import {
  Shield, Trash2, AlertTriangle, RefreshCw, Check,
  Skull, Power, PowerOff, UserX, ArrowRightLeft, CalendarX,
  Building2, ChevronDown,
} from "lucide-react";
import { useTranslation } from "react-i18next";

interface Club {
  id: string;
  nome: string;
  attivo: boolean;
}

interface Operazione {
  id: string;
  titolo: string;
  descrizione: string;
  icona: React.ReactNode;
  colore: string;
  parola_chiave: string;
  richiede_club: boolean;
  richiede_club_dest?: boolean;
  esegui: (club_id: string, club_dest?: string) => Promise<string>;
}

const TABELLE_DATI = [
  "presenze", "lezioni_private", "iscrizioni_gare", "gare",
  "iscrizioni_corsi", "corsi", "fatture", "atleti", "istruttori",
] as const;

const SuperAdminManutenzioneStr: React.FC = () => {
  const { t } = useTranslation("superadmin");
  const { session } = useAuth();
  const [clubs, set_clubs] = useState<Club[]>([]);
  const [selected_club, set_selected_club] = useState("");
  const [club_dest, set_club_dest] = useState("");
  const [loading_clubs, set_loading_clubs] = useState(true);
  const [running, set_running] = useState<string | null>(null);
  const [confirm_id, set_confirm_id] = useState<string | null>(null);
  const [confirm_text, set_confirm_text] = useState("");
  const [log, set_log] = useState<string[]>([]);

  const add_log = (msg: string) => {
    const ts = new Date().toLocaleTimeString("it-CH");
    set_log((prev) => [`[${ts}] ${msg}`, ...prev.slice(0, 99)]);
  };

  useEffect(() => {
    (async () => {
      const { data } = await supabase.from("clubs").select("id, nome, attivo").order("nome");
      if (data) set_clubs(data);
      set_loading_clubs(false);
    })();
  }, []);

  const reload_clubs = async () => {
    const { data } = await supabase.from("clubs").select("id, nome, attivo").order("nome");
    if (data) set_clubs(data);
  };

  if (session?.ruolo !== "superadmin") {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Shield className="w-12 h-12 text-destructive mx-auto" />
      </div>
    );
  }

  const club_nome = (id: string) => clubs.find((c) => c.id === id)?.nome || "—";
  const selected = clubs.find((c) => c.id === selected_club);

  const operazioni: Operazione[] = [
    {
      id: "disattiva_club",
      titolo: selected?.attivo === false ? t("str.op.toggle.titolo_on") : t("str.op.toggle.titolo_off"),
      descrizione: selected?.attivo === false
        ? t("str.op.toggle.desc_on")
        : t("str.op.toggle.desc_off"),
      icona: selected?.attivo === false ? <Power className="w-5 h-5" /> : <PowerOff className="w-5 h-5" />,
      colore: "border-yellow-300 bg-yellow-50 dark:border-yellow-800 dark:bg-yellow-950/30",
      parola_chiave: "CONFERMA",
      richiede_club: true,
      esegui: async (cid) => {
        const club = clubs.find((c) => c.id === cid);
        const nuovo_stato = !club?.attivo;
        const { error } = await supabase.from("clubs").update({ attivo: nuovo_stato }).eq("id", cid);
        if (error) throw error;
        await reload_clubs();
        return t("str.op.toggle.result", { nome: club_nome(cid), stato: nuovo_stato ? t("str.op.toggle.stato_on") : t("str.op.toggle.stato_off") });
      },
    },
    {
      id: "reset_utenti",
      titolo: t("str.op.reset_utenti.titolo"),
      descrizione: t("str.op.reset_utenti.descrizione"),
      icona: <UserX className="w-5 h-5" />,
      colore: "border-orange-300 bg-orange-50 dark:border-orange-800 dark:bg-orange-950/30",
      parola_chiave: "ELIMINA",
      richiede_club: true,
      esegui: async (cid) => {
        const { error, count } = await supabase.from("utenti_club").delete({ count: "exact" }).eq("club_id", cid);
        if (error) throw error;
        return t("str.op.reset_utenti.result", { count: count || 0, nome: club_nome(cid) });
      },
    },
    {
      id: "wipe_dati",
      titolo: t("str.op.wipe.titolo"),
      descrizione: t("str.op.wipe.descrizione"),
      icona: <Skull className="w-5 h-5" />,
      colore: "border-red-300 bg-red-50 dark:border-red-800 dark:bg-red-950/30",
      parola_chiave: "ELIMINA",
      richiede_club: true,
      esegui: async (cid) => {
        const risultati: string[] = [];
        for (const tabella of TABELLE_DATI) {
          try {
            const { count } = await supabase.from(tabella).delete({ count: "exact" }).eq("club_id", cid);
            if (count && count > 0) risultati.push(`${tabella}: ${count}`);
          } catch {
            // tabella potrebbe non avere club_id
          }
        }
        // Elimina anche setup_club
        await supabase.from("setup_club").delete().eq("club_id", cid);
        return risultati.length > 0
          ? t("str.op.wipe.result", { nome: club_nome(cid), dettaglio: risultati.join(", ") })
          : t("str.op.wipe.empty", { nome: club_nome(cid) });
      },
    },
    {
      id: "elimina_club",
      titolo: t("str.op.elimina.titolo"),
      descrizione: t("str.op.elimina.descrizione"),
      icona: <Trash2 className="w-5 h-5" />,
      colore: "border-red-400 bg-red-100 dark:border-red-700 dark:bg-red-950/50",
      parola_chiave: "ELIMINA",
      richiede_club: true,
      esegui: async (cid) => {
        const nome = club_nome(cid);
        // Prima elimina tutti i dati
        for (const tabella of TABELLE_DATI) {
          try {
            await supabase.from(tabella).delete().eq("club_id", cid);
          } catch { /* skip */ }
        }
        await supabase.from("setup_club").delete().eq("club_id", cid);
        await supabase.from("utenti_club").delete().eq("club_id", cid);
        // Poi elimina il club
        const { error } = await supabase.from("clubs").delete().eq("id", cid);
        if (error) throw error;
        set_selected_club("");
        await reload_clubs();
        return t("str.op.elimina.result", { nome });
      },
    },
    {
      id: "reset_stagione",
      titolo: t("str.op.reset_stagione.titolo"),
      descrizione: t("str.op.reset_stagione.descrizione"),
      icona: <CalendarX className="w-5 h-5" />,
      colore: "border-orange-300 bg-orange-50 dark:border-orange-800 dark:bg-orange-950/30",
      parola_chiave: "ELIMINA",
      richiede_club: true,
      esegui: async (cid) => {
        const risultati: string[] = [];
        for (const tabella of ["presenze", "lezioni_private", "iscrizioni_corsi"] as const) {
          try {
            const { count } = await supabase.from(tabella).delete({ count: "exact" }).eq("club_id", cid);
            if (count && count > 0) risultati.push(`${tabella}: ${count}`);
          } catch { /* skip */ }
        }
        return risultati.length > 0
          ? t("str.op.reset_stagione.result", { nome: club_nome(cid), dettaglio: risultati.join(", ") })
          : t("str.op.reset_stagione.empty", { nome: club_nome(cid) });
      },
    },
    {
      id: "trasferisci_atleti",
      titolo: t("str.op.trasferisci.titolo"),
      descrizione: t("str.op.trasferisci.descrizione"),
      icona: <ArrowRightLeft className="w-5 h-5" />,
      colore: "border-blue-300 bg-blue-50 dark:border-blue-800 dark:bg-blue-950/30",
      parola_chiave: "CONFERMA",
      richiede_club: true,
      richiede_club_dest: true,
      esegui: async (cid, dest) => {
        if (!dest) throw new Error(t("str.op.trasferisci.err_dest"));
        if (cid === dest) throw new Error(t("str.op.trasferisci.err_same"));
        const { count, error } = await supabase
          .from("atleti")
          .update({ club_id: dest })
          .eq("club_id", cid);
        if (error) throw error;
        return t("str.op.trasferisci.result", { count: count ?? t("str.op.trasferisci.all"), da: club_nome(cid), a: club_nome(dest!) });
      },
    },
  ];

  const handle_esegui = async (op: Operazione) => {
    if (op.richiede_club && !selected_club) {
      toast({ title: t("str.select_club"), variant: "destructive" });
      return;
    }
    set_running(op.id);
    set_confirm_id(null);
    set_confirm_text("");
    try {
      const risultato = await op.esegui(selected_club, club_dest);
      add_log(`✅ ${op.titolo}: ${risultato}`);
      toast({ title: `✅ ${risultato}` });
    } catch (err: any) {
      add_log(`❌ ${op.titolo}: ${err.message}`);
      toast({ title: t("str.error"), description: err.message, variant: "destructive" });
    } finally {
      set_running(null);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-4">
        <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
          <AlertTriangle className="w-6 h-6 text-destructive" />
          {t("str.title")}
        </h1>
        <p className="text-sm text-destructive/80 mt-1">
          {t("str.subtitle")}
        </p>
      </div>

      {/* Selettore club */}
      <div className="rounded-xl border border-border bg-card p-4">
        <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide block mb-2">
          {t("str.club_selected")}
        </label>
        <div className="relative">
          <Building2 className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <select
            value={selected_club}
            onChange={(e) => { set_selected_club(e.target.value); set_confirm_id(null); }}
            className="w-full appearance-none pl-10 pr-10 py-2.5 rounded-lg border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
          >
            <option value="">{t("str.select_club_option")}</option>
            {clubs.map((c) => (
              <option key={c.id} value={c.id}>
                {c.nome} {!c.attivo ? t("str.inactive_suffix") : ""}
              </option>
            ))}
          </select>
          <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
        </div>
      </div>

      {/* Operazioni */}
      <div className="grid gap-4 sm:grid-cols-2">
        {operazioni.map((op) => {
          const is_running = running === op.id;
          const is_confirming = confirm_id === op.id;
          const disabled = !selected_club || is_running;

          return (
            <div key={op.id} className={`rounded-xl border p-5 transition-all ${op.colore}`}>
              <div className="flex items-start gap-3 mb-3">
                <div className="p-2 rounded-lg bg-background/80 border border-border shrink-0">
                  {op.icona}
                </div>
                <div>
                  <p className="font-semibold text-foreground text-sm">{op.titolo}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">{op.descrizione}</p>
                </div>
              </div>

              {!selected_club && (
                <p className="text-xs text-muted-foreground mb-2">{t("str.select_above")}</p>
              )}

              {is_confirming ? (
                <div className="space-y-2">
                  {op.richiede_club_dest && (
                    <div>
                      <label className="text-xs text-muted-foreground block mb-1">{t("str.dest_club")}</label>
                      <select
                        value={club_dest}
                        onChange={(e) => set_club_dest(e.target.value)}
                        className="w-full appearance-none rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
                      >
                        <option value="">{t("str.select_option")}</option>
                        {clubs.filter((c) => c.id !== selected_club).map((c) => (
                          <option key={c.id} value={c.id}>{c.nome}</option>
                        ))}
                      </select>
                    </div>
                  )}
                  <p className="text-xs text-destructive font-medium">
                    {t("str.confirm_prefix")} <strong>{op.parola_chiave}</strong> {t("str.confirm_middle")} <strong>{club_nome(selected_club)}</strong>:
                  </p>
                  <input
                    value={confirm_text}
                    onChange={(e) => set_confirm_text(e.target.value)}
                    placeholder={op.parola_chiave}
                    className="w-full rounded-lg border border-destructive/30 bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-destructive/30"
                    autoFocus
                  />
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      variant="destructive"
                      disabled={confirm_text !== op.parola_chiave || is_running || (op.richiede_club_dest && !club_dest)}
                      onClick={() => handle_esegui(op)}
                      className="gap-1"
                    >
                      {is_running ? <RefreshCw className="w-3 h-3 animate-spin" /> : <Check className="w-3 h-3" />}
                      {t("str.run")}
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => { set_confirm_id(null); set_confirm_text(""); }}>
                      {t("str.cancel")}
                    </Button>
                  </div>
                </div>
              ) : (
                <Button
                  size="sm"
                  variant="outline"
                  disabled={disabled}
                  onClick={() => { set_confirm_id(op.id); set_confirm_text(""); }}
                  className="gap-2 w-full"
                >
                  {is_running ? <RefreshCw className="w-4 h-4 animate-spin" /> : op.icona}
                  {is_running ? t("str.running") : t("str.run")}
                </Button>
              )}
            </div>
          );
        })}
      </div>

      {/* Log */}
      <div className="rounded-xl border border-border bg-card">
        <div className="px-4 py-3 border-b border-border flex items-center justify-between">
          <p className="text-sm font-semibold text-foreground">📋 {t("str.log")}</p>
          {log.length > 0 && (
            <Button variant="ghost" size="sm" onClick={() => set_log([])}>{t("str.clear")}</Button>
          )}
        </div>
        <div className="p-4 max-h-48 overflow-y-auto">
          {log.length === 0 ? (
            <p className="text-xs text-muted-foreground text-center py-4">
              {t("str.log_empty")}
            </p>
          ) : (
            <div className="space-y-1">
              {log.map((entry, i) => (
                <p key={i} className="text-xs font-mono text-muted-foreground">{entry}</p>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default SuperAdminManutenzioneStr;
