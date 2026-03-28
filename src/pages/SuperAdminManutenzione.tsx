import React, { useState, useEffect } from "react";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "@/hooks/use-toast";
import {
  Shield, Trash2, Database, Copy, Download, RefreshCw,
  Check, AlertTriangle, Wrench, Building2, ChevronDown,
} from "lucide-react";

interface Club {
  id: string;
  nome: string;
}

interface Operazione {
  id: string;
  titolo: string;
  descrizione: string;
  icona: React.ReactNode;
  colore: string;
  richiede_club: boolean;
  esegui: (club_id: string | null) => Promise<string>;
}

const SuperAdminManutenzione: React.FC = () => {
  const { session } = useAuth();
  const [clubs, set_clubs] = useState<Club[]>([]);
  const [selected_club, set_selected_club] = useState<string>("__tutti__");
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
      const { data } = await supabase.from("clubs").select("id, nome").order("nome");
      if (data) set_clubs(data);
      set_loading_clubs(false);
    })();
  }, []);

  if (session?.ruolo !== "superadmin") {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Shield className="w-12 h-12 text-destructive mx-auto" />
      </div>
    );
  }

  const club_id = selected_club === "__tutti__" ? null : selected_club;
  const club_nome = club_id ? clubs.find((c) => c.id === club_id)?.nome || "—" : "tutti i club";

  const operazioni: Operazione[] = [
    {
      id: "fatture_pagate",
      titolo: "Pulizia fatture pagate",
      descrizione: "Elimina le fatture già saldate per alleggerire il database.",
      icona: <Trash2 className="w-5 h-5" />,
      colore: "border-orange-200 bg-orange-50 dark:border-orange-900 dark:bg-orange-950/30",
      richiede_club: false,
      esegui: async (cid) => {
        let q = supabase.from("fatture").delete({ count: "exact" }).eq("pagata", true);
        if (cid) q = q.eq("club_id", cid);
        const { error, count } = await q;
        if (error) throw error;
        return `Eliminate ${count || 0} fatture pagate`;
      },
    },
    {
      id: "presenze_vecchie",
      titolo: "Pulizia presenze vecchie (> 12 mesi)",
      descrizione: "Rimuove le presenze più vecchie di un anno.",
      icona: <Database className="w-5 h-5" />,
      colore: "border-orange-200 bg-orange-50 dark:border-orange-900 dark:bg-orange-950/30",
      richiede_club: false,
      esegui: async (cid) => {
        const un_anno_fa = new Date();
        un_anno_fa.setFullYear(un_anno_fa.getFullYear() - 1);
        let q = supabase.from("presenze").delete({ count: "exact" }).lt("data", un_anno_fa.toISOString().split("T")[0]);
        if (cid) q = q.eq("club_id", cid);
        const { error, count } = await q;
        if (error) throw error;
        return `Eliminate ${count || 0} presenze vecchie`;
      },
    },
    {
      id: "gare_archiviate",
      titolo: "Elimina gare archiviate",
      descrizione: "Rimuove gare archiviate e relative iscrizioni.",
      icona: <Trash2 className="w-5 h-5" />,
      colore: "border-red-200 bg-red-50 dark:border-red-900 dark:bg-red-950/30",
      richiede_club: false,
      esegui: async (cid) => {
        let q = supabase.from("gare_calendario").select("id").eq("archiviata", true);
        if (cid) q = q.eq("club_id", cid);
        const { data: gare } = await q;
        if (!gare?.length) return "Nessuna gara archiviata trovata";
        for (const g of gare) {
          await supabase.from("iscrizioni_gare").delete().eq("gara_id", g.id);
        }
        let dq = supabase.from("gare_calendario").delete({ count: "exact" }).eq("archiviata", true);
        if (cid) dq = dq.eq("club_id", cid);
        const { error, count } = await dq;
        if (error) throw error;
        return `Eliminate ${count || 0} gare archiviate e relative iscrizioni`;
      },
    },
    {
      id: "setup_club",
      titolo: "Crea setup club mancanti",
      descrizione: "Genera un record setup_club per i club che non ce l'hanno.",
      icona: <Copy className="w-5 h-5" />,
      colore: "border-blue-200 bg-blue-50 dark:border-blue-900 dark:bg-blue-950/30",
      richiede_club: false,
      esegui: async (cid) => {
        const target = cid ? [clubs.find((c) => c.id === cid)!] : clubs;
        let creati = 0;
        for (const club of target) {
          const { data: exists } = await supabase.from("setup_club").select("id").eq("club_id", club.id).maybeSingle();
          if (!exists) {
            const { error } = await supabase.from("setup_club").insert({ club_id: club.id });
            if (error) throw error;
            creati++;
          }
        }
        return creati > 0 ? `Creati ${creati} setup club mancanti` : "Tutti i club hanno già un setup";
      },
    },
    {
      id: "export_dati",
      titolo: "Esporta dati club (Backup CSV)",
      descrizione: "Scarica i dati principali (atleti, istruttori, corsi) in formato CSV.",
      icona: <Download className="w-5 h-5" />,
      colore: "border-green-200 bg-green-50 dark:border-green-900 dark:bg-green-950/30",
      richiede_club: true,
      esegui: async (cid) => {
        if (!cid) return "Seleziona un club specifico per l'esportazione";
        const club = clubs.find((c) => c.id === cid);
        const tables = ["atleti", "istruttori", "corsi", "fatture"] as const;
        let all_csv = `=== BACKUP ${club?.nome?.toUpperCase()} — ${new Date().toLocaleDateString("it-CH")} ===\n\n`;

        for (const table of tables) {
          const { data } = await supabase.from(table).select("*").eq("club_id", cid);
          if (!data?.length) {
            all_csv += `--- ${table.toUpperCase()} (vuoto) ---\n\n`;
            continue;
          }
          const headers = Object.keys(data[0]);
          all_csv += `--- ${table.toUpperCase()} (${data.length} righe) ---\n`;
          all_csv += headers.join(";") + "\n";
          for (const row of data) {
            all_csv += headers.map((h) => String((row as any)[h] ?? "")).join(";") + "\n";
          }
          all_csv += "\n";
        }

        const blob = new Blob([all_csv], { type: "text/csv;charset=utf-8" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `backup_${club?.nome?.replace(/\s+/g, "_")}_${new Date().toISOString().split("T")[0]}.csv`;
        a.click();
        URL.revokeObjectURL(url);
        return `Backup scaricato per ${club?.nome}`;
      },
    },
  ];

  const handle_esegui = async (op: Operazione) => {
    if (op.richiede_club && !club_id) {
      toast({ title: "Seleziona un club", description: "Questa operazione richiede un club specifico.", variant: "destructive" });
      return;
    }
    set_running(op.id);
    set_confirm_id(null);
    set_confirm_text("");
    try {
      const risultato = await op.esegui(club_id);
      add_log(`✅ ${op.titolo}: ${risultato} (${club_nome})`);
      toast({ title: `✅ ${risultato}` });
    } catch (err: any) {
      add_log(`❌ ${op.titolo}: ${err.message}`);
      toast({ title: "Errore", description: err.message, variant: "destructive" });
    } finally {
      set_running(null);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
          <Wrench className="w-6 h-6 text-primary" />
          Manutenzione Ordinaria
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Operazioni di pulizia e manutenzione del database.
        </p>
      </div>

      {/* Selettore club */}
      <div className="rounded-xl border border-border bg-card p-4">
        <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide block mb-2">
          Ambito operazione
        </label>
        <div className="relative">
          <Building2 className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <select
            value={selected_club}
            onChange={(e) => set_selected_club(e.target.value)}
            className="w-full appearance-none pl-10 pr-10 py-2.5 rounded-lg border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
          >
            <option value="__tutti__">🌐 Tutti i club</option>
            {clubs.map((c) => (
              <option key={c.id} value={c.id}>{c.nome}</option>
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
          const needs_club = op.richiede_club && !club_id;

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

              {needs_club && (
                <p className="text-xs text-orange-600 mb-2 flex items-center gap-1">
                  <AlertTriangle className="w-3 h-3" />
                  Richiede un club specifico
                </p>
              )}

              {is_confirming ? (
                <div className="space-y-2">
                  <p className="text-xs text-destructive font-medium">
                    Digita <strong>CONFERMA</strong> per procedere su <strong>{club_nome}</strong>:
                  </p>
                  <input
                    value={confirm_text}
                    onChange={(e) => set_confirm_text(e.target.value)}
                    placeholder="CONFERMA"
                    className="w-full rounded-lg border border-destructive/30 bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-destructive/30"
                    autoFocus
                  />
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      variant="destructive"
                      disabled={confirm_text !== "CONFERMA" || is_running}
                      onClick={() => handle_esegui(op)}
                      className="gap-1"
                    >
                      {is_running ? <RefreshCw className="w-3 h-3 animate-spin" /> : <Check className="w-3 h-3" />}
                      Esegui
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => { set_confirm_id(null); set_confirm_text(""); }}>
                      Annulla
                    </Button>
                  </div>
                </div>
              ) : (
                <Button
                  size="sm"
                  variant={op.id === "export_dati" ? "default" : "outline"}
                  disabled={is_running || needs_club}
                  onClick={() => {
                    if (op.id === "export_dati") {
                      handle_esegui(op);
                    } else {
                      set_confirm_id(op.id);
                      set_confirm_text("");
                    }
                  }}
                  className="gap-2 w-full"
                >
                  {is_running ? <RefreshCw className="w-4 h-4 animate-spin" /> : op.icona}
                  {is_running ? "In esecuzione..." : "Esegui"}
                </Button>
              )}
            </div>
          );
        })}
      </div>

      {/* Log */}
      <div className="rounded-xl border border-border bg-card">
        <div className="px-4 py-3 border-b border-border flex items-center justify-between">
          <p className="text-sm font-semibold text-foreground">📋 Log operazioni</p>
          {log.length > 0 && (
            <Button variant="ghost" size="sm" onClick={() => set_log([])}>
              Pulisci
            </Button>
          )}
        </div>
        <div className="p-4 max-h-48 overflow-y-auto">
          {log.length === 0 ? (
            <p className="text-xs text-muted-foreground text-center py-4">
              Nessuna operazione eseguita in questa sessione.
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

export default SuperAdminManutenzione;
