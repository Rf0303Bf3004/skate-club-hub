import React, { useState, useEffect } from "react";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "@/hooks/use-toast";
import {
  Shield, Users, Database, Trash2, Copy, RefreshCw,
  ChevronDown, ChevronUp, AlertTriangle, Check, X,
  Building2, UserCheck, BarChart3
} from "lucide-react";

// ─── Tipi ─────────────────────────────────────────────────
interface ClubStats {
  id: string;
  nome: string;
  citta: string;
  atleti: number;
  istruttori: number;
  corsi: number;
  fatture_da_pagare: number;
  utenti: number;
}

// ─── Sezione club ──────────────────────────────────────────
const ClubCard: React.FC<{
  club: ClubStats;
  on_select: () => void;
  selected: boolean;
}> = ({ club, on_select, selected }) => (
  <div
    onClick={on_select}
    className={`rounded-xl border p-4 cursor-pointer transition-all ${
      selected
        ? "border-primary bg-primary/5 shadow-md"
        : "border-border bg-card hover:border-primary/40 hover:shadow-sm"
    }`}
  >
    <div className="flex items-start justify-between mb-3">
      <div>
        <p className="font-semibold text-foreground">{club.nome}</p>
        <p className="text-xs text-muted-foreground">{club.citta || "—"}</p>
      </div>
      <Badge variant="secondary" className="text-[10px]">
        {club.utenti} utenti
      </Badge>
    </div>
    <div className="grid grid-cols-3 gap-2 text-center">
      {[
        { label: "Atleti", value: club.atleti },
        { label: "Istruttori", value: club.istruttori },
        { label: "Corsi", value: club.corsi },
      ].map(({ label, value }) => (
        <div key={label} className="rounded-lg bg-muted/50 p-2">
          <p className="text-lg font-bold text-foreground">{value}</p>
          <p className="text-[10px] text-muted-foreground">{label}</p>
        </div>
      ))}
    </div>
    {club.fatture_da_pagare > 0 && (
      <div className="mt-2 flex items-center gap-1 text-xs text-orange-600">
        <AlertTriangle className="w-3 h-3" />
        {club.fatture_da_pagare} fatture da pagare
      </div>
    )}
  </div>
);

// ─── Azione con conferma ───────────────────────────────────
const AzioneCard: React.FC<{
  titolo: string;
  descrizione: string;
  colore: "red" | "orange" | "blue" | "green";
  icon: React.ReactNode;
  on_esegui: () => Promise<void>;
  richiede_club?: boolean;
  club_selezionato?: boolean;
}> = ({ titolo, descrizione, colore, icon, on_esegui, richiede_club, club_selezionato }) => {
  const [confirm, set_confirm] = useState(false);
  const [loading, set_loading] = useState(false);

  const colori = {
    red: "border-destructive/30 bg-destructive/5 text-destructive",
    orange: "border-orange-200 bg-orange-50 text-orange-700 dark:border-orange-800 dark:bg-orange-950 dark:text-orange-300",
    blue: "border-primary/30 bg-primary/5 text-primary",
    green: "border-green-200 bg-green-50 text-green-700 dark:border-green-800 dark:bg-green-950 dark:text-green-300",
  };

  const btn_colori = {
    red: "bg-destructive hover:bg-destructive/90 text-destructive-foreground",
    orange: "bg-orange-500 hover:bg-orange-600 text-white",
    blue: "bg-primary hover:bg-primary/90 text-primary-foreground",
    green: "bg-green-600 hover:bg-green-700 text-white",
  };

  const handle_esegui = async () => {
    set_loading(true);
    try {
      await on_esegui();
      set_confirm(false);
    } finally {
      set_loading(false);
    }
  };

  const disabled = richiede_club && !club_selezionato;

  return (
    <div className={`rounded-xl border p-4 ${colori[colore]}`}>
      <div className="flex items-start gap-3 mb-3">
        <div className="mt-0.5">{icon}</div>
        <div className="flex-1">
          <p className="font-semibold text-sm">{titolo}</p>
          <p className="text-xs opacity-70 mt-0.5">{descrizione}</p>
          {disabled && (
            <p className="text-[10px] mt-1 opacity-60">⚠️ Seleziona prima un club</p>
          )}
        </div>
      </div>
      {!confirm ? (
        <Button
          disabled={disabled}
          onClick={() => set_confirm(true)}
          className={`w-full text-xs h-8 ${disabled ? "opacity-40" : btn_colori[colore]}`}
        >
          Esegui
        </Button>
      ) : (
        <div className="space-y-2">
          <p className="text-xs font-bold text-center">Sei sicuro?</p>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => set_confirm(false)} className="flex-1 h-7 text-xs">
              <X className="w-3 h-3 mr-1" /> No
            </Button>
            <Button onClick={handle_esegui} disabled={loading} className={`flex-1 h-7 text-xs ${btn_colori[colore]}`}>
              {loading ? <RefreshCw className="w-3 h-3 mr-1 animate-spin" /> : <Check className="w-3 h-3 mr-1" />}
              {loading ? "..." : "Sì, esegui"}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
};

// ─── Gestore utenti club ───────────────────────────────────
const GestoreUtenti: React.FC<{ club_id: string; club_nome: string }> = ({ club_id, club_nome }) => {
  const [utenti, set_utenti] = useState<any[]>([]);
  const [loading, set_loading] = useState(false);
  const [nuovo_email, set_nuovo_email] = useState("");
  const [nuovo_password, set_nuovo_password] = useState("");
  const [nuovo_ruolo, set_nuovo_ruolo] = useState("admin");
  const [nuovo_nome, set_nuovo_nome] = useState("");
  const [nuovo_cognome, set_nuovo_cognome] = useState("");
  const [adding, set_adding] = useState(false);

  const load_utenti = async () => {
    set_loading(true);
    try {
      const { data } = await supabase.from("utenti_club").select("*").eq("club_id", club_id);
      set_utenti(data || []);
    } finally {
      set_loading(false);
    }
  };

  useEffect(() => {
    load_utenti();
  }, [club_id]);

  const handle_elimina_utente = async (id: string) => {
    const { error } = await supabase.from("utenti_club").delete().eq("id", id);
    if (error) {
      toast({ title: "Errore", description: error.message, variant: "destructive" });
      return;
    }
    toast({ title: "✅ Utente rimosso" });
    load_utenti();
  };

  const handle_aggiungi_utente = async () => {
    if (!nuovo_email || !nuovo_password) {
      toast({ title: "Email e password obbligatori", variant: "destructive" });
      return;
    }
    set_adding(true);
    try {
      const { data: auth_data, error: auth_err } = await supabase.auth.admin.createUser({
        email: nuovo_email,
        password: nuovo_password,
        email_confirm: true,
      });
      if (auth_err) throw auth_err;
      const { error: uc_err } = await supabase.from("utenti_club").insert({
        user_id: auth_data.user.id,
        club_id,
        ruolo: nuovo_ruolo,
        nome: nuovo_nome,
        cognome: nuovo_cognome,
      });
      if (uc_err) throw uc_err;
      toast({ title: "✅ Utente creato e collegato al club" });
      set_nuovo_email("");
      set_nuovo_password("");
      set_nuovo_nome("");
      set_nuovo_cognome("");
      load_utenti();
    } catch (err: any) {
      toast({ title: "Errore creazione utente", description: err?.message, variant: "destructive" });
    } finally {
      set_adding(false);
    }
  };

  const input_cls =
    "w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40";

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Users className="w-5 h-5 text-primary" />
        <h3 className="font-semibold text-foreground">Utenti — {club_nome}</h3>
      </div>

      {/* Lista utenti */}
      <div className="space-y-2">
        {loading ? (
          <p className="text-sm text-muted-foreground">Caricamento...</p>
        ) : utenti.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nessun utente collegato.</p>
        ) : (
          utenti.map((u) => (
            <div key={u.id} className="flex items-center justify-between rounded-lg border border-border bg-card p-3">
              <div>
                <p className="text-sm font-medium text-foreground">
                  {u.nome} {u.cognome}
                </p>
                <div className="flex items-center gap-2 mt-0.5">
                  <Badge variant="outline" className="text-[10px]">
                    {u.ruolo}
                  </Badge>
                  <span className="text-[10px] text-muted-foreground">{u.user_id?.slice(0, 8)}...</span>
                </div>
              </div>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => handle_elimina_utente(u.id)}
                className="h-7 w-7 p-0 text-destructive hover:bg-destructive/10"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </Button>
            </div>
          ))
        )}
      </div>

      {/* Aggiungi utente */}
      <div className="rounded-xl border border-border bg-muted/30 p-4 space-y-3">
        <p className="text-sm font-semibold text-foreground">Aggiungi utente</p>
        <div className="grid grid-cols-2 gap-2">
          <input
            value={nuovo_nome}
            onChange={(e) => set_nuovo_nome(e.target.value)}
            placeholder="Nome"
            className={input_cls}
          />
          <input
            value={nuovo_cognome}
            onChange={(e) => set_nuovo_cognome(e.target.value)}
            placeholder="Cognome"
            className={input_cls}
          />
        </div>
        <input
          value={nuovo_email}
          onChange={(e) => set_nuovo_email(e.target.value)}
          placeholder="Email"
          className={input_cls}
        />
        <input
          type="password"
          value={nuovo_password}
          onChange={(e) => set_nuovo_password(e.target.value)}
          placeholder="Password"
          className={input_cls}
        />
        <select value={nuovo_ruolo} onChange={(e) => set_nuovo_ruolo(e.target.value)} className={input_cls}>
          <option value="admin">Admin</option>
          <option value="staff">Staff</option>
        </select>
        <Button onClick={handle_aggiungi_utente} disabled={adding} className="w-full">
          {adding ? "..." : "➕ Aggiungi utente"}
        </Button>
      </div>
    </div>
  );
};

// ─── Main SuperAdmin Page ──────────────────────────────────
const SuperAdminPage: React.FC = () => {
  const { session } = useAuth();
  const [clubs, set_clubs] = useState<ClubStats[]>([]);
  const [selected_club, set_selected_club] = useState<string | null>(null);
  const [loading, set_loading] = useState(true);
  const [tab, set_tab] = useState<"clubs" | "azioni" | "utenti" | "db">("clubs");
  const [log, set_log] = useState<string[]>([]);

  const add_log = (msg: string) => {
    const ts = new Date().toLocaleTimeString("it-CH");
    set_log((prev) => [`[${ts}] ${msg}`, ...prev.slice(0, 49)]);
  };

  const load_clubs = async () => {
    set_loading(true);
    try {
      const { data: clubs_data } = await supabase.from("clubs").select("*").order("nome");
      if (!clubs_data) return;

      const stats: ClubStats[] = await Promise.all(
        clubs_data.map(async (c) => {
          const [atleti, istruttori, corsi, fatture, utenti] = await Promise.all([
            supabase.from("atleti").select("id", { count: "exact" }).eq("club_id", c.id),
            supabase.from("istruttori").select("id", { count: "exact" }).eq("club_id", c.id),
            supabase.from("corsi").select("id", { count: "exact" }).eq("club_id", c.id),
            supabase.from("fatture").select("id", { count: "exact" }).eq("club_id", c.id).eq("pagata", false),
            supabase.from("utenti_club").select("id", { count: "exact" }).eq("club_id", c.id),
          ]);
          return {
            id: c.id,
            nome: c.nome,
            citta: c.citta,
            atleti: atleti.count || 0,
            istruttori: istruttori.count || 0,
            corsi: corsi.count || 0,
            fatture_da_pagare: fatture.count || 0,
            utenti: utenti.count || 0,
          };
        })
      );
      set_clubs(stats);
    } finally {
      set_loading(false);
    }
  };

  useEffect(() => {
    load_clubs();
  }, []);

  const selected_club_data = clubs.find((c) => c.id === selected_club);

  // ─── Azioni di manutenzione ───────────────────────────────
  const azioni = [
    {
      titolo: "Elimina fatture pagate",
      descrizione: "Rimuove tutte le fatture già pagate del club selezionato per alleggerire il DB.",
      colore: "orange" as const,
      icon: <Trash2 className="w-4 h-4" />,
      richiede_club: true,
      on_esegui: async () => {
        const { error, count } = await supabase
          .from("fatture")
          .delete({ count: "exact" })
          .eq("club_id", selected_club!)
          .eq("pagata", true);
        if (error) throw error;
        add_log(`✅ Eliminato ${count} fatture pagate da ${selected_club_data?.nome}`);
        toast({ title: `✅ ${count} fatture pagate eliminate` });
      },
    },
    {
      titolo: "Elimina presenze vecchie (> 1 anno)",
      descrizione: "Rimuove le presenze più vecchie di 12 mesi dal club selezionato.",
      colore: "orange" as const,
      icon: <Database className="w-4 h-4" />,
      richiede_club: true,
      on_esegui: async () => {
        const un_anno_fa = new Date();
        un_anno_fa.setFullYear(un_anno_fa.getFullYear() - 1);
        const { error, count } = await supabase
          .from("presenze")
          .delete({ count: "exact" })
          .eq("club_id", selected_club!)
          .lt("data", un_anno_fa.toISOString().split("T")[0]);
        if (error) throw error;
        add_log(`✅ Eliminate ${count} presenze vecchie da ${selected_club_data?.nome}`);
        toast({ title: `✅ ${count} presenze eliminate` });
      },
    },
    {
      titolo: "Crea setup club mancante",
      descrizione: "Crea un record setup_club vuoto se manca per il club selezionato.",
      colore: "blue" as const,
      icon: <Copy className="w-4 h-4" />,
      richiede_club: true,
      on_esegui: async () => {
        const { data: existing } = await supabase
          .from("setup_club")
          .select("id")
          .eq("club_id", selected_club!)
          .maybeSingle();
        if (existing) {
          toast({ title: "Setup già esistente" });
          return;
        }
        const { error } = await supabase.from("setup_club").insert({ club_id: selected_club! });
        if (error) throw error;
        add_log(`✅ Setup creato per ${selected_club_data?.nome}`);
        toast({ title: "✅ Setup club creato" });
      },
    },
    {
      titolo: "Ricrea policy RLS",
      descrizione: "Disabilita e riabilita RLS su tutte le tabelle principali.",
      colore: "blue" as const,
      icon: <Shield className="w-4 h-4" />,
      richiede_club: false,
      on_esegui: async () => {
        add_log("⚠️ RLS reset — operazione manuale richiesta su Supabase SQL Editor");
        toast({
          title: "⚠️ Esegui manualmente su Supabase SQL Editor",
          description: "Le policy RLS vanno gestite dal SQL Editor di Supabase.",
        });
      },
    },
    {
      titolo: "Elimina gare archiviate",
      descrizione: "Rimuove tutte le gare archiviate e le relative iscrizioni del club selezionato.",
      colore: "red" as const,
      icon: <Trash2 className="w-4 h-4" />,
      richiede_club: true,
      on_esegui: async () => {
        const { data: gare } = await supabase
          .from("gare_calendario")
          .select("id")
          .eq("club_id", selected_club!)
          .eq("archiviata", true);
        if (!gare?.length) {
          toast({ title: "Nessuna gara archiviata" });
          return;
        }
        for (const g of gare) {
          await supabase.from("iscrizioni_gare").delete().eq("gara_id", g.id);
        }
        const { count } = await supabase
          .from("gare_calendario")
          .delete({ count: "exact" })
          .eq("club_id", selected_club!)
          .eq("archiviata", true);
        add_log(`✅ Eliminate ${count} gare archiviate da ${selected_club_data?.nome}`);
        toast({ title: `✅ ${count} gare archiviate eliminate` });
      },
    },
    {
      titolo: "Elimina TUTTI i dati del club",
      descrizione: "⚠️ IRREVERSIBILE — Elimina tutti atleti, istruttori, corsi, gare, fatture del club selezionato.",
      colore: "red" as const,
      icon: <AlertTriangle className="w-4 h-4" />,
      richiede_club: true,
      on_esegui: async () => {
        const cid = selected_club!;
        const tabelle = [
          "presenze",
          "fatture",
          "lezioni_private_atlete",
          "lezioni_private",
          "iscrizioni_corsi",
          "iscrizioni_gare",
          "iscrizioni_campo",
          "corsi_istruttori",
          "disponibilita_istruttori",
          "storico_livelli_atleta",
          "ore_pista_monitors",
          "ore_lavoro_istruttori",
          "comunicazioni",
          "stagioni",
          "campi_allenamento",
          "corsi",
          "gare_calendario",
          "atleti",
          "istruttori",
          "setup_club",
        ];
        for (const t of tabelle) {
          await (supabase.from(t as any) as any).delete().eq("club_id", cid);
        }
        add_log(`⚠️ TUTTI i dati eliminati da ${selected_club_data?.nome}`);
        toast({ title: `⚠️ Tutti i dati di ${selected_club_data?.nome} eliminati` });
        await load_clubs();
      },
    },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="rounded-xl bg-card border border-border p-6">
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div className="flex items-center gap-3">
            <Shield className="w-8 h-8 text-primary" />
            <div>
              <h1 className="text-2xl font-bold text-foreground">Super Admin Panel</h1>
              <p className="text-xs text-muted-foreground">
                Logged as {session.email} · SUPERADMIN
              </p>
            </div>
          </div>
          <Button variant="outline" onClick={load_clubs} className="gap-2">
            <RefreshCw className="w-4 h-4" /> Ricarica
          </Button>
        </div>
      </div>

      <div className="space-y-4">
        {/* Tab */}
        <div className="flex gap-1 bg-muted/50 rounded-xl p-1">
          {(
            [
              { key: "clubs", label: "🏢 Club", icon: Building2 },
              { key: "azioni", label: "⚙️ Azioni", icon: Database },
              { key: "utenti", label: "👥 Utenti", icon: UserCheck },
              { key: "db", label: "📋 Log", icon: BarChart3 },
            ] as const
          ).map((t) => (
            <button
              key={t.key}
              onClick={() => set_tab(t.key)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-all
                ${tab === t.key ? "bg-card shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground"}`}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* Tab: Club */}
        {tab === "clubs" && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-muted-foreground">
                Club registrati ({clubs.length})
              </h3>
            </div>
            {loading ? (
              <div className="flex items-center justify-center py-12">
                <RefreshCw className="w-6 h-6 animate-spin text-muted-foreground" />
              </div>
            ) : (
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {clubs.map((c) => (
                  <ClubCard
                    key={c.id}
                    club={c}
                    selected={selected_club === c.id}
                    on_select={() => set_selected_club(selected_club === c.id ? null : c.id)}
                  />
                ))}
              </div>
            )}
            {selected_club && (
              <div className="flex items-center gap-2 rounded-lg bg-primary/5 border border-primary/20 px-4 py-2">
                <Check className="w-4 h-4 text-primary" />
                <span className="text-sm font-medium text-foreground">
                  Club selezionato: {selected_club_data?.nome}
                </span>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => set_selected_club(null)}
                  className="ml-auto h-6 w-6 p-0 text-muted-foreground"
                >
                  <X className="w-3.5 h-3.5" />
                </Button>
              </div>
            )}
          </div>
        )}

        {/* Tab: Azioni */}
        {tab === "azioni" && (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              {selected_club
                ? `Club selezionato: ${selected_club_data?.nome}. Le azioni che richiedono un club useranno questo.`
                : "Seleziona un club nella tab 🏢 Club per abilitare le azioni specifiche per club."}
            </p>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {azioni.map((a, i) => (
                <AzioneCard key={i} {...a} club_selezionato={!!selected_club} />
              ))}
            </div>
          </div>
        )}

        {/* Tab: Utenti */}
        {tab === "utenti" && (
          <div>
            {!selected_club ? (
              <div className="text-center py-12 space-y-2">
                <Users className="w-10 h-10 text-muted-foreground mx-auto" />
                <p className="text-muted-foreground">
                  Seleziona un club nella tab 🏢 Club per gestire gli utenti.
                </p>
              </div>
            ) : (
              <GestoreUtenti club_id={selected_club} club_nome={selected_club_data?.nome || ""} />
            )}
          </div>
        )}

        {/* Tab: Log */}
        {tab === "db" && (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-muted-foreground">Log operazioni</h3>
              <Button variant="ghost" onClick={() => set_log([])} className="text-xs h-7">
                Pulisci
              </Button>
            </div>
            <div className="rounded-xl border border-border bg-card p-4 font-mono text-xs space-y-1 max-h-96 overflow-y-auto">
              {log.length === 0 ? (
                <p className="text-muted-foreground">{"// Nessuna operazione eseguita ancora"}</p>
              ) : (
                log.map((l, i) => (
                  <p key={i} className="text-foreground">
                    {l}
                  </p>
                ))
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default SuperAdminPage;
