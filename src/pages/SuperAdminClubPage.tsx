import React, { useState, useEffect } from "react";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "@/hooks/use-toast";
import {
  Shield, Users, Building2, MapPin, Mail, Phone, Globe,
  RefreshCw, Check, X, Pencil, ChevronRight, Search,
  UserCheck, BookOpen, CreditCard, AlertTriangle,
} from "lucide-react";
import { useTranslation } from "react-i18next";

interface Club {
  id: string;
  nome: string;
  citta: string | null;
  paese: string | null;
  email: string | null;
  telefono: string | null;
  indirizzo: string | null;
  sito_web: string | null;
  numero_tessera_federale: string | null;
  colore_primario: string;
  descrizione: string | null;
  attivo: boolean;
  is_demo: boolean;
  logo_url: string | null;
  created_at: string;
}

interface ClubStats {
  atleti: number;
  istruttori: number;
  corsi: number;
  fatture_da_pagare: number;
  utenti: number;
}

const SuperAdminClubPage: React.FC = () => {
  const { t } = useTranslation("superadmin");
  const { session } = useAuth();
  const [clubs, set_clubs] = useState<Club[]>([]);
  const [stats, set_stats] = useState<Record<string, ClubStats>>({});
  const [loading, set_loading] = useState(true);
  const [selected_id, set_selected_id] = useState<string | null>(null);
  const [editing, set_editing] = useState(false);
  const [saving, set_saving] = useState(false);
  const [search, set_search] = useState("");
  const [form, set_form] = useState<Partial<Club>>({});

  const load_clubs = async () => {
    set_loading(true);
    try {
      const { data } = await supabase.from("clubs").select("*").order("nome");
      if (!data) return;
      set_clubs(data as Club[]);

      const all_stats: Record<string, ClubStats> = {};
      await Promise.all(
        data.map(async (c: any) => {
          const [atleti, istruttori, corsi, fatture, utenti] = await Promise.all([
            supabase.from("atleti").select("id", { count: "exact" }).eq("club_id", c.id),
            supabase.from("istruttori").select("id", { count: "exact" }).eq("club_id", c.id),
            supabase.from("corsi").select("id", { count: "exact" }).eq("club_id", c.id),
            supabase.from("fatture").select("id", { count: "exact" }).eq("club_id", c.id).eq("pagata", false),
            supabase.from("utenti_club").select("id", { count: "exact" }).eq("club_id", c.id),
          ]);
          all_stats[c.id] = {
            atleti: atleti.count || 0,
            istruttori: istruttori.count || 0,
            corsi: corsi.count || 0,
            fatture_da_pagare: fatture.count || 0,
            utenti: utenti.count || 0,
          };
        })
      );
      set_stats(all_stats);
    } finally {
      set_loading(false);
    }
  };

  useEffect(() => { load_clubs(); }, []);

  if (session?.ruolo !== "superadmin") {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Shield className="w-12 h-12 text-destructive mx-auto" />
        <p className="text-muted-foreground mt-2">{t("clubs.access_denied")}</p>
      </div>
    );
  }

  const filtered = clubs.filter((c) =>
    c.nome.toLowerCase().includes(search.toLowerCase()) ||
    (c.citta || "").toLowerCase().includes(search.toLowerCase())
  );

  const selected = clubs.find((c) => c.id === selected_id);
  const selected_stats = selected_id ? stats[selected_id] : null;

  const start_edit = () => {
    if (!selected) return;
    set_form({ ...selected });
    set_editing(true);
  };

  const handle_save = async () => {
    if (!selected_id || !form.nome) return;
    set_saving(true);
    try {
      const { error } = await supabase.from("clubs").update({
        nome: form.nome,
        citta: form.citta || null,
        paese: form.paese || null,
        email: form.email || null,
        telefono: form.telefono || null,
        indirizzo: form.indirizzo || null,
        sito_web: form.sito_web || null,
        numero_tessera_federale: form.numero_tessera_federale || null,
        colore_primario: form.colore_primario || "#3B82F6",
        descrizione: form.descrizione || null,
        attivo: form.attivo,
      }).eq("id", selected_id);
      if (error) throw error;
      toast({ title: t("clubs.toast.updated") });
      set_editing(false);
      load_clubs();
    } catch (err: any) {
      toast({ title: t("clubs.toast.error"), description: err.message, variant: "destructive" });
    } finally {
      set_saving(false);
    }
  };

  const input_cls = "w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30";

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <Building2 className="w-6 h-6 text-primary" />
            {t("clubs.title")}
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            {t("clubs.count", { count: clubs.length })}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button size="sm" onClick={() => (window.location.href = "/superadmin/clubs/nuovo")} className="gap-2">
            <Building2 className="w-4 h-4" /> {t("clubs.new")}
          </Button>
          <Button variant="outline" size="sm" onClick={load_clubs} disabled={loading} className="gap-2">
            <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
            {t("clubs.refresh")}
          </Button>
        </div>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <input
          value={search}
          onChange={(e) => set_search(e.target.value)}
          placeholder={t("clubs.search_placeholder")}
          className="w-full pl-10 pr-4 py-2.5 rounded-lg border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Lista club */}
        <div className="lg:col-span-1 space-y-2 max-h-[70vh] overflow-y-auto pr-1">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <RefreshCw className="w-6 h-6 animate-spin text-muted-foreground" />
            </div>
          ) : filtered.length === 0 ? (
            <p className="text-center text-muted-foreground py-8 text-sm">{t("clubs.empty")}</p>
          ) : (
            filtered.map((club) => {
              const cs = stats[club.id];
              const is_selected = selected_id === club.id;
              return (
                <div
                  key={club.id}
                  onClick={() => { set_selected_id(club.id); set_editing(false); }}
                  className={`rounded-xl border p-4 cursor-pointer transition-all ${
                    is_selected
                      ? "border-primary bg-primary/5 shadow-md"
                      : "border-border bg-card hover:border-primary/40 hover:shadow-sm"
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div className="min-w-0">
                      <p className="font-semibold text-foreground truncate">{club.nome}</p>
                      <p className="text-xs text-muted-foreground">{club.citta || "—"}</p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      {!club.attivo && <Badge variant="destructive" className="text-[10px]">{t("clubs.inactive")}</Badge>}
                      <ChevronRight className={`w-4 h-4 text-muted-foreground transition-transform ${is_selected ? "rotate-90" : ""}`} />
                    </div>
                  </div>
                  {cs && (
                    <div className="grid grid-cols-3 gap-1.5 mt-3 text-center">
                      {[
                        { label: t("clubs.stats.atleti"), value: cs.atleti },
                        { label: t("clubs.stats.istruttori"), value: cs.istruttori },
                        { label: t("clubs.stats.corsi"), value: cs.corsi },
                      ].map(({ label, value }) => (
                        <div key={label} className="rounded-md bg-muted/50 py-1.5">
                          <p className="text-sm font-bold text-foreground">{value}</p>
                          <p className="text-[10px] text-muted-foreground">{label}</p>
                        </div>
                      ))}
                    </div>
                  )}
                  {cs && cs.fatture_da_pagare > 0 && (
                    <div className="mt-2 flex items-center gap-1 text-xs text-orange-600">
                      <AlertTriangle className="w-3 h-3" />
                      {t("clubs.unpaid_invoices", { count: cs.fatture_da_pagare })}
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>

        {/* Dettaglio club */}
        <div className="lg:col-span-2">
          {!selected ? (
            <div className="flex items-center justify-center h-64 rounded-xl border border-dashed border-border">
              <p className="text-muted-foreground text-sm">{t("clubs.select_hint")}</p>
            </div>
          ) : editing ? (
            /* ── Modifica ── */
            <div className="rounded-xl border border-border bg-card p-6 space-y-4">
              <div className="flex items-center justify-between mb-2">
                <h2 className="text-lg font-bold text-foreground">{t("clubs.edit_title")}</h2>
                <Button variant="ghost" size="sm" onClick={() => set_editing(false)}>
                  <X className="w-4 h-4" />
                </Button>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <input value={form.nome || ""} onChange={(e) => set_form({ ...form, nome: e.target.value })} placeholder={t("clubs.form.nome")} className={input_cls} />
                <input value={form.citta || ""} onChange={(e) => set_form({ ...form, citta: e.target.value })} placeholder={t("clubs.form.citta")} className={input_cls} />
                <input value={form.paese || ""} onChange={(e) => set_form({ ...form, paese: e.target.value })} placeholder={t("clubs.form.paese")} className={input_cls} />
                <input value={form.email || ""} onChange={(e) => set_form({ ...form, email: e.target.value })} placeholder={t("clubs.form.email")} type="email" className={input_cls} />
                <input value={form.telefono || ""} onChange={(e) => set_form({ ...form, telefono: e.target.value })} placeholder={t("clubs.form.telefono")} className={input_cls} />
                <input value={form.indirizzo || ""} onChange={(e) => set_form({ ...form, indirizzo: e.target.value })} placeholder={t("clubs.form.indirizzo")} className={input_cls} />
                <input value={form.sito_web || ""} onChange={(e) => set_form({ ...form, sito_web: e.target.value })} placeholder={t("clubs.form.sito_web")} className={input_cls} />
                <input value={form.numero_tessera_federale || ""} onChange={(e) => set_form({ ...form, numero_tessera_federale: e.target.value })} placeholder={t("clubs.form.tessera")} className={input_cls} />
              </div>
              <div className="flex items-center gap-3">
                <label className="text-sm text-muted-foreground">{t("clubs.form.colore")}</label>
                <input type="color" value={form.colore_primario || "#3B82F6"} onChange={(e) => set_form({ ...form, colore_primario: e.target.value })} className="w-10 h-8 rounded cursor-pointer border border-border" />
              </div>
              <textarea value={form.descrizione || ""} onChange={(e) => set_form({ ...form, descrizione: e.target.value })} placeholder={t("clubs.form.descrizione")} rows={2} className={input_cls} />
              <div className="flex items-center gap-3">
                <label className="text-sm text-muted-foreground">{t("clubs.form.attivo")}</label>
                <button
                  onClick={() => set_form({ ...form, attivo: !form.attivo })}
                  className={`w-10 h-6 rounded-full transition-colors ${form.attivo ? "bg-green-500" : "bg-muted"}`}
                >
                  <div className={`w-4 h-4 rounded-full bg-white shadow transition-transform mx-1 ${form.attivo ? "translate-x-4" : ""}`} />
                </button>
              </div>
              <div className="flex gap-3 pt-2">
                <Button onClick={handle_save} disabled={saving} className="gap-2">
                  {saving ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                  {saving ? t("clubs.saving") : t("clubs.save")}
                </Button>
                <Button variant="outline" onClick={() => set_editing(false)}>{t("clubs.cancel")}</Button>
              </div>
            </div>
          ) : (
            /* ── Dettaglio ── */
            <div className="rounded-xl border border-border bg-card p-6 space-y-5">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  {selected.logo_url ? (
                    <img src={selected.logo_url} alt={t("clubs.logo_alt")} className="w-12 h-12 rounded-lg object-cover border border-border" />
                  ) : (
                    <div className="w-12 h-12 rounded-lg flex items-center justify-center text-lg font-bold text-primary-foreground" style={{ backgroundColor: selected.colore_primario }}>
                      {selected.nome[0]}
                    </div>
                  )}
                  <div>
                    <h2 className="text-xl font-bold text-foreground">{selected.nome}</h2>
                    <div className="flex items-center gap-2 mt-1">
                      <Badge variant={selected.attivo ? "default" : "destructive"}>
                        {selected.attivo ? t("clubs.active") : t("clubs.inactive")}
                      </Badge>
                      {selected.is_demo && <Badge variant="outline">{t("clubs.demo")}</Badge>}
                    </div>
                  </div>
                </div>
                <Button variant="outline" size="sm" onClick={start_edit} className="gap-2">
                  <Pencil className="w-4 h-4" />
                  {t("clubs.edit")}
                </Button>
              </div>

              {/* Statistiche */}
              {selected_stats && (
                <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
                  {[
                    { label: t("clubs.stats.atleti"), value: selected_stats.atleti, icon: Users, color: "text-blue-600" },
                    { label: t("clubs.stats.istruttori"), value: selected_stats.istruttori, icon: UserCheck, color: "text-green-600" },
                    { label: t("clubs.stats.corsi"), value: selected_stats.corsi, icon: BookOpen, color: "text-purple-600" },
                    { label: t("clubs.stats.utenti"), value: selected_stats.utenti, icon: Users, color: "text-primary" },
                    { label: t("clubs.stats.fatture_aperte"), value: selected_stats.fatture_da_pagare, icon: CreditCard, color: selected_stats.fatture_da_pagare > 0 ? "text-orange-600" : "text-muted-foreground" },
                  ].map(({ label, value, icon: Icon, color }) => (
                    <div key={label} className="rounded-lg bg-muted/40 p-3 text-center">
                      <Icon className={`w-5 h-5 mx-auto mb-1 ${color}`} />
                      <p className="text-xl font-bold text-foreground">{value}</p>
                      <p className="text-[10px] text-muted-foreground">{label}</p>
                    </div>
                  ))}
                </div>
              )}

              {/* Info */}
              <div className="grid sm:grid-cols-2 gap-3">
                {[
                  { icon: MapPin, label: t("clubs.form.citta"), value: selected.citta },
                  { icon: MapPin, label: t("clubs.form.indirizzo"), value: selected.indirizzo },
                  { icon: Mail, label: t("clubs.form.email"), value: selected.email },
                  { icon: Phone, label: t("clubs.form.telefono"), value: selected.telefono },
                  { icon: Globe, label: t("clubs.form.sito_web"), value: selected.sito_web },
                  { icon: Shield, label: t("clubs.form.paese"), value: selected.paese },
                ].map(({ icon: Icon, label, value }) => (
                  <div key={label} className="flex items-center gap-3 rounded-lg bg-muted/30 px-3 py-2">
                    <Icon className="w-4 h-4 text-muted-foreground shrink-0" />
                    <div className="min-w-0">
                      <p className="text-[10px] text-muted-foreground uppercase tracking-wide">{label}</p>
                      <p className="text-sm text-foreground truncate">{value || "—"}</p>
                    </div>
                  </div>
                ))}
              </div>

              {selected.descrizione && (
                <div className="rounded-lg bg-muted/30 p-3">
                  <p className="text-[10px] text-muted-foreground uppercase tracking-wide mb-1">{t("clubs.form.descrizione")}</p>
                  <p className="text-sm text-foreground">{selected.descrizione}</p>
                </div>
              )}

              <p className="text-[10px] text-muted-foreground">
                {t("clubs.created_on", { data: new Date(selected.created_at).toLocaleDateString("de-CH", { day: "2-digit", month: "2-digit", year: "numeric" }) })}
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default SuperAdminClubPage;
