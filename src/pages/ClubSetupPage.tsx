import React, { useState, useEffect } from "react";
import { useI18n } from "@/lib/i18n";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { use_club, use_setup_club, use_stagioni, use_atleti, use_istruttori } from "@/hooks/use-supabase-data";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { supabase, get_current_club_id } from "@/lib/supabase";
import { toast } from "@/hooks/use-toast";
import { Upload, Globe, Phone, Mail, MapPin, Hash, Users, UserCheck, Calendar, Building2, Plus, Trash2, Loader2 } from "lucide-react";

const GIORNI = ["Lunedì", "Martedì", "Mercoledì", "Giovedì", "Venerdì", "Sabato", "Domenica"] as const;

// ── Hooks for ghiaccio config ──
function use_config_ghiaccio() {
  const club_id = get_current_club_id();
  return useQuery({
    queryKey: ["configurazione_ghiaccio", club_id],
    enabled: !!club_id,
    queryFn: async () => {
      const { data } = await supabase
        .from("configurazione_ghiaccio")
        .select("*")
        .eq("club_id", club_id)
        .maybeSingle();
      return data;
    },
  });
}

function use_disponibilita_ghiaccio() {
  const club_id = get_current_club_id();
  return useQuery({
    queryKey: ["disponibilita_ghiaccio", club_id],
    enabled: !!club_id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("disponibilita_ghiaccio")
        .select("*")
        .eq("club_id", club_id);
      if (error) throw error;
      return data ?? [];
    },
  });
}

const ClubSetupPage: React.FC = () => {
  const { t } = useI18n();
  const queryClient = useQueryClient();
  const { data: club, isLoading: loading_club } = use_club();
  const { data: setup } = use_setup_club();
  const { data: stagioni = [] } = use_stagioni();
  const { data: atleti = [] } = use_atleti();
  const { data: istruttori = [] } = use_istruttori();
  const { data: config_ghiaccio, isLoading: loading_config } = use_config_ghiaccio();
  const { data: disp_ghiaccio_raw, isLoading: loading_disp } = use_disponibilita_ghiaccio();

  const stagione_attiva = stagioni.find((s: any) => s.attiva);
  const [form, set_form] = useState<Record<string, any>>({});
  const [saving, set_saving] = useState(false);
  const [uploading, set_uploading] = useState(false);
  const [logo_preview, set_logo_preview] = useState<string | null>(null);

  // Ghiaccio config form
  const [ghiaccio_form, set_ghiaccio_form] = useState<Record<string, any>>({});
  const [saving_ghiaccio, set_saving_ghiaccio] = useState(false);

  // Disponibilità ghiaccio local state
  const [disp_local, set_disp_local] = useState<Record<string, { ora_inizio: string; ora_fine: string }[]>>({});
  const [saving_disp, set_saving_disp] = useState(false);

  // Sync disp_local when data loads
  useEffect(() => {
    if (disp_ghiaccio_raw) {
      const m: Record<string, { ora_inizio: string; ora_fine: string }[]> = {};
      disp_ghiaccio_raw.forEach((d: any) => {
        if (!m[d.giorno]) m[d.giorno] = [];
        m[d.giorno].push({ ora_inizio: d.ora_inizio, ora_fine: d.ora_fine });
      });
      set_disp_local(m);
    }
  }, [disp_ghiaccio_raw]);

  const get_val = (field: string, fallback: any = "") => {
    if (field in form) return form[field];
    return club?.[field] ?? setup?.[field] ?? fallback;
  };

  const set_val = (field: string, value: any) => {
    set_form((prev) => ({ ...prev, [field]: value }));
  };

  const get_ghiaccio_val = (field: string, fallback: any = "") => {
    if (field in ghiaccio_form) return ghiaccio_form[field];
    return (config_ghiaccio as any)?.[field] ?? fallback;
  };

  const set_ghiaccio_val = (field: string, value: any) => {
    set_ghiaccio_form((prev) => ({ ...prev, [field]: value }));
  };

  const handle_logo_upload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      toast({ title: "Seleziona un file immagine", variant: "destructive" });
      return;
    }
    set_uploading(true);
    try {
      const ext = file.name.split(".").pop();
      const path = `${get_current_club_id()}/logo.${ext}`;
      const { error: upload_error } = await supabase.storage
        .from("loghi-club")
        .upload(path, file, { upsert: true });
      if (upload_error) throw upload_error;
      const { data: url_data } = supabase.storage.from("loghi-club").getPublicUrl(path);
      const logo_url = url_data.publicUrl;
      set_val("logo_url", logo_url);
      set_logo_preview(logo_url);
      toast({ title: "✅ Logo caricato correttamente" });
    } catch (err: any) {
      toast({ title: "Errore upload logo", description: err?.message, variant: "destructive" });
    } finally {
      set_uploading(false);
    }
  };

  const handle_save = async () => {
    set_saving(true);
    try {
      const club_payload: Record<string, any> = {};
      const club_fields = [
        "nome", "citta", "paese", "email", "telefono", "indirizzo",
        "sito_web", "numero_tessera_federale", "colore_primario", "descrizione", "logo_url",
      ];
      for (const f of club_fields) {
        if (f in form) club_payload[f] = form[f];
      }
      if (Object.keys(club_payload).length > 0) {
        const { error } = await supabase.from("clubs").update(club_payload).eq("id", get_current_club_id());
        if (error) throw error;
      }

      const setup_payload: Record<string, any> = {};
      const setup_fields = [
        "max_lezioni_private_contemporanee", "max_atlete_lezione_condivisa",
        "slot_lezione_privata_minuti", "iban", "intestatario_conto", "banca", "indirizzo_banca",
      ];
      for (const f of setup_fields) {
        if (f in form) setup_payload[f] = form[f];
      }
      if (Object.keys(setup_payload).length > 0) {
        const { error } = await supabase.from("setup_club").update(setup_payload).eq("club_id", get_current_club_id());
        if (error) throw error;
      }

      toast({ title: "✅ Configurazione salvata" });
      set_form({});
    } catch (err: any) {
      toast({ title: "Errore salvataggio", description: err?.message, variant: "destructive" });
    } finally {
      set_saving(false);
    }
  };

  // Save ghiaccio config (upsert)
  const handle_save_ghiaccio = async () => {
    set_saving_ghiaccio(true);
    try {
      const club_id = get_current_club_id();
      const payload = {
        club_id,
        ora_apertura_default: get_ghiaccio_val("ora_apertura_default", "06:00"),
        ora_chiusura_default: get_ghiaccio_val("ora_chiusura_default", "22:30"),
        durata_pulizia_minuti: parseInt(get_ghiaccio_val("durata_pulizia_minuti", 30)),
        max_atleti_contemporanei: parseInt(get_ghiaccio_val("max_atleti_contemporanei", 30)),
        max_atleti_per_istruttore: parseInt(get_ghiaccio_val("max_atleti_per_istruttore", 8)),
        min_atleti_attivazione_corso: parseInt(get_ghiaccio_val("min_atleti_attivazione_corso", 3)),
      };

      if (config_ghiaccio?.id) {
        const { error } = await supabase.from("configurazione_ghiaccio").update(payload).eq("id", config_ghiaccio.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("configurazione_ghiaccio").insert(payload);
        if (error) throw error;
      }

      toast({ title: "✅ Configurazione ghiaccio salvata" });
      set_ghiaccio_form({});
      queryClient.invalidateQueries({ queryKey: ["configurazione_ghiaccio"] });
    } catch (err: any) {
      toast({ title: "Errore salvataggio", description: err?.message, variant: "destructive" });
    } finally {
      set_saving_ghiaccio(false);
    }
  };

  // Disponibilità ghiaccio CRUD
  const add_slot = (giorno: string) => {
    set_disp_local((prev) => ({
      ...prev,
      [giorno]: [...(prev[giorno] || []), { ora_inizio: "08:00", ora_fine: "12:00" }],
    }));
  };

  const remove_slot = (giorno: string, idx: number) => {
    set_disp_local((prev) => ({
      ...prev,
      [giorno]: (prev[giorno] || []).filter((_, i) => i !== idx),
    }));
  };

  const update_slot = (giorno: string, idx: number, field: "ora_inizio" | "ora_fine", value: string) => {
    set_disp_local((prev) => ({
      ...prev,
      [giorno]: (prev[giorno] || []).map((s, i) => (i === idx ? { ...s, [field]: value } : s)),
    }));
  };

  const save_disponibilita = async () => {
    set_saving_disp(true);
    try {
      const club_id = get_current_club_id();
      // Delete all existing
      const { error: del_err } = await supabase.from("disponibilita_ghiaccio").delete().eq("club_id", club_id);
      if (del_err) throw del_err;

      // Insert all
      const rows: any[] = [];
      for (const [giorno, slots] of Object.entries(disp_local)) {
        for (const s of slots) {
          rows.push({ club_id, giorno, ora_inizio: s.ora_inizio, ora_fine: s.ora_fine });
        }
      }
      if (rows.length > 0) {
        const { error: ins_err } = await supabase.from("disponibilita_ghiaccio").insert(rows);
        if (ins_err) throw ins_err;
      }

      toast({ title: "✅ Disponibilità ghiaccio salvata" });
      queryClient.invalidateQueries({ queryKey: ["disponibilita_ghiaccio"] });
    } catch (err: any) {
      toast({ title: "Errore salvataggio", description: err?.message, variant: "destructive" });
    } finally {
      set_saving_disp(false);
    }
  };

  if (loading_club) return (
    <div className="flex items-center justify-center h-64">
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
    </div>
  );

  const current_logo = logo_preview || club?.logo_url;
  const colore = get_val("colore_primario", "#3B82F6");

  return (
    <div className="space-y-6 animate-fade-in">
      <h1 className="text-xl font-bold tracking-tight text-foreground">{t("setup_club")}</h1>

      {/* Statistiche live */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {[
          { icon: Users, label: "Atleti", value: atleti.length, color: "text-primary" },
          { icon: UserCheck, label: "Istruttori", value: istruttori.filter((i: any) => i.attivo).length, color: "text-success" },
          { icon: Calendar, label: "Stagione attiva", value: stagione_attiva?.nome || "—", color: "text-orange-500" },
          { icon: Hash, label: "Club ID", value: get_current_club_id().slice(0, 8) + "...", color: "text-muted-foreground" },
        ].map((stat, i) => (
          <div key={i} className="bg-card rounded-xl shadow-card p-4 flex items-center gap-3">
            <div className={`w-9 h-9 rounded-lg bg-muted/50 flex items-center justify-center ${stat.color}`}>
              <stat.icon className="w-4 h-4" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">{stat.label}</p>
              <p className="text-sm font-bold text-foreground truncate max-w-[100px]">{stat.value}</p>
            </div>
          </div>
        ))}
      </div>

      <div className="bg-card rounded-xl shadow-card p-6 space-y-8 max-w-2xl">
        {/* Logo */}
        <section className="space-y-4">
          <h2 className="text-sm font-bold text-muted-foreground uppercase tracking-widest">Logo Club</h2>
          <div className="flex items-center gap-6">
            <div className="w-20 h-20 rounded-2xl border-2 border-dashed border-border flex items-center justify-center overflow-hidden bg-muted/30 flex-shrink-0">
              {current_logo ? (
                <img src={current_logo} alt="Logo club" className="w-full h-full object-contain p-1" />
              ) : (
                <div className="text-center">
                  <Upload className="w-6 h-6 text-muted-foreground mx-auto mb-1" />
                  <p className="text-[10px] text-muted-foreground">Logo</p>
                </div>
              )}
            </div>
            <div className="space-y-2">
              <p className="text-sm text-muted-foreground">Formato consigliato: PNG o SVG, sfondo trasparente</p>
              <label className="cursor-pointer">
                <input type="file" accept="image/*" onChange={handle_logo_upload} className="hidden" />
                <span className={`inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-border text-sm font-medium transition-colors ${uploading ? "opacity-50 cursor-not-allowed" : "hover:bg-muted/50"}`}>
                  <Upload className="w-4 h-4" />
                  {uploading ? "Caricamento..." : "Carica logo"}
                </span>
              </label>
            </div>
          </div>
        </section>

        <Separator />

        {/* Dati club */}
        <section className="space-y-4">
          <h2 className="text-sm font-bold text-muted-foreground uppercase tracking-widest">{t("dati_club")}</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Field label={t("nome")} icon={<Hash className="w-3.5 h-3.5" />}>
              <Input value={get_val("nome")} onChange={(e) => set_val("nome", e.target.value)} />
            </Field>
            <Field label={t("citta")} icon={<MapPin className="w-3.5 h-3.5" />}>
              <Input value={get_val("citta")} onChange={(e) => set_val("citta", e.target.value)} />
            </Field>
            <Field label="Indirizzo" icon={<MapPin className="w-3.5 h-3.5" />}>
              <Input value={get_val("indirizzo")} onChange={(e) => set_val("indirizzo", e.target.value)} placeholder="Via Roma 1, Lugano" />
            </Field>
            <Field label={t("paese")} icon={<Globe className="w-3.5 h-3.5" />}>
              <Input value={get_val("paese")} onChange={(e) => set_val("paese", e.target.value)} placeholder="CH" />
            </Field>
            <Field label={t("email")} icon={<Mail className="w-3.5 h-3.5" />}>
              <Input type="email" value={get_val("email")} onChange={(e) => set_val("email", e.target.value)} />
            </Field>
            <Field label={t("telefono")} icon={<Phone className="w-3.5 h-3.5" />}>
              <Input value={get_val("telefono")} onChange={(e) => set_val("telefono", e.target.value)} />
            </Field>
            <Field label="Sito web" icon={<Globe className="w-3.5 h-3.5" />}>
              <Input value={get_val("sito_web")} onChange={(e) => set_val("sito_web", e.target.value)} placeholder="https://www.clubname.ch" />
            </Field>
            <Field label="Tessera federale" icon={<Hash className="w-3.5 h-3.5" />}>
              <Input value={get_val("numero_tessera_federale")} onChange={(e) => set_val("numero_tessera_federale", e.target.value)} />
            </Field>
          </div>
        </section>

        <Separator />

        {/* Colore primario */}
        <section className="space-y-4">
          <h2 className="text-sm font-bold text-muted-foreground uppercase tracking-widest">Colore primario</h2>
          <div className="flex items-center gap-4">
            <input
              type="color"
              value={colore}
              onChange={(e) => set_val("colore_primario", e.target.value)}
              className="w-10 h-10 rounded-lg border border-border cursor-pointer"
            />
            <span className="text-sm text-muted-foreground">{colore}</span>
          </div>
        </section>

        <Separator />

        {/* Descrizione */}
        <section className="space-y-4">
          <h2 className="text-sm font-bold text-muted-foreground uppercase tracking-widest">Descrizione</h2>
          <textarea
            value={get_val("descrizione")}
            onChange={(e) => set_val("descrizione", e.target.value)}
            rows={3}
            className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
            placeholder="Descrizione del club..."
          />
        </section>

        <Separator />

        {/* Salva dati club */}
        <div className="flex justify-end">
          <Button onClick={handle_save} disabled={saving || Object.keys(form).length === 0}>
            {saving ? "Salvataggio..." : "Salva modifiche"}
          </Button>
        </div>
      </div>

      {/* ═══════════════════════════════════════════════════ */}
      {/* GHIACCIO E PLANNING */}
      {/* ═══════════════════════════════════════════════════ */}
      <div className="bg-card rounded-xl shadow-card p-6 space-y-8 max-w-2xl">
        <h2 className="text-sm font-bold text-muted-foreground uppercase tracking-widest">🧊 Ghiaccio e Planning</h2>

        {/* Config fields */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Field label="Ora apertura pista">
            <Input
              type="time"
              value={get_ghiaccio_val("ora_apertura_default", "06:00")}
              onChange={(e) => set_ghiaccio_val("ora_apertura_default", e.target.value)}
            />
          </Field>
          <Field label="Ora chiusura pista">
            <Input
              type="time"
              value={get_ghiaccio_val("ora_chiusura_default", "22:30")}
              onChange={(e) => set_ghiaccio_val("ora_chiusura_default", e.target.value)}
            />
          </Field>
          <Field label="Durata pulizia ghiaccio (min)">
            <Input
              type="number"
              min={0}
              value={get_ghiaccio_val("durata_pulizia_minuti", 30)}
              onChange={(e) => set_ghiaccio_val("durata_pulizia_minuti", e.target.value)}
            />
          </Field>
          <Field label="Max atleti contemporanei (alert)">
            <Input
              type="number"
              min={1}
              value={get_ghiaccio_val("max_atleti_contemporanei", 30)}
              onChange={(e) => set_ghiaccio_val("max_atleti_contemporanei", e.target.value)}
            />
          </Field>
          <Field label="Max atleti per istruttore (alert)">
            <Input
              type="number"
              min={1}
              value={get_ghiaccio_val("max_atleti_per_istruttore", 8)}
              onChange={(e) => set_ghiaccio_val("max_atleti_per_istruttore", e.target.value)}
            />
          </Field>
          <Field label="Min iscritti attivazione corso">
            <Input
              type="number"
              min={0}
              value={get_ghiaccio_val("min_atleti_attivazione_corso", 3)}
              onChange={(e) => set_ghiaccio_val("min_atleti_attivazione_corso", e.target.value)}
            />
          </Field>
        </div>

        <div className="flex justify-end">
          <Button onClick={handle_save_ghiaccio} disabled={saving_ghiaccio}>
            {saving_ghiaccio ? "Salvataggio..." : "Salva configurazione ghiaccio"}
          </Button>
        </div>

        <Separator />

        {/* Disponibilità ghiaccio settimanale */}
        <div>
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-bold text-muted-foreground uppercase tracking-widest">
              Disponibilità ghiaccio settimanale
            </h3>
            <Button size="sm" onClick={save_disponibilita} disabled={saving_disp}>
              {saving_disp ? "..." : "Salva disponibilità"}
            </Button>
          </div>
          <div className="space-y-4">
            {GIORNI.map((giorno) => {
              const slots = disp_local[giorno] || [];
              return (
                <div key={giorno} className="border border-border/50 rounded-lg p-3">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-medium text-foreground">{giorno}</span>
                    <Button variant="ghost" size="sm" onClick={() => add_slot(giorno)} className="h-7 text-xs">
                      <Plus className="w-3 h-3 mr-1" /> Slot
                    </Button>
                  </div>
                  {slots.length === 0 && <p className="text-xs text-muted-foreground">Nessuno slot</p>}
                  {slots.map((s, idx) => (
                    <div key={idx} className="flex items-center gap-2 mb-1">
                      <Input
                        type="time"
                        value={s.ora_inizio}
                        onChange={(e) => update_slot(giorno, idx, "ora_inizio", e.target.value)}
                        className="w-28 h-8 text-xs"
                      />
                      <span className="text-muted-foreground text-xs">—</span>
                      <Input
                        type="time"
                        value={s.ora_fine}
                        onChange={(e) => update_slot(giorno, idx, "ora_fine", e.target.value)}
                        className="w-28 h-8 text-xs"
                      />
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => remove_slot(giorno, idx)}
                        className="h-7 w-7 p-0 text-destructive"
                      >
                        <Trash2 className="w-3 h-3" />
                      </Button>
                    </div>
                  ))}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
};

const Field: React.FC<{ label: string; icon?: React.ReactNode; children: React.ReactNode }> = ({ label, icon, children }) => (
  <div className="space-y-1.5">
    <Label className="flex items-center gap-1.5 text-xs text-muted-foreground">
      {icon}
      {label}
    </Label>
    {children}
  </div>
);

export default ClubSetupPage;
