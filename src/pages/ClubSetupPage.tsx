import React, { useState, useEffect } from "react";
import { useI18n } from "@/lib/i18n";
import { useTranslation } from "react-i18next";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { use_club, use_setup_club, use_stagioni, use_atleti, use_istruttori } from "@/hooks/use-supabase-data";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { supabase, get_current_club_id } from "@/lib/supabase";
import { toast } from "@/hooks/use-toast";
import { Upload, Globe, Phone, Mail, MapPin, Hash, Users, UserCheck, Calendar, Building2, Plus, Trash2, Loader2, CheckCircle2, AlertCircle } from "lucide-react";
import CatalogoOffertaTab from "@/components/CatalogoOffertaTab";
import FatturazioneTab from "@/components/FatturazioneTab";
import { RegoleComunicazioniSection } from "@/components/comunicazioni/RegoleComunicazioniSection";
import ModalitaGestioneSection from "@/components/setup/ModalitaGestioneSection";
import RagioniSocialiSection from "@/components/setup/RagioniSocialiSection";
import FatturaLayoutSection from "@/components/setup/FatturaLayoutSection";
import RisorseSection from "@/components/setup/RisorseSection";
import TemplateComunicazioniSection from "@/components/setup/TemplateComunicazioniSection";
import { use_risorse_strutture } from "@/hooks/use-risorse-strutture";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";


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

function use_catalogo_count() {
  const club_id = get_current_club_id();
  return useQuery({
    queryKey: ["catalogo_livelli_count", club_id],
    enabled: !!club_id,
    queryFn: async () => {
      const { count } = await (supabase as any)
        .from("catalogo_livelli")
        .select("id", { count: "exact", head: true })
        .eq("club_id", club_id);
      return count ?? 0;
    },
  });
}

const ClubSetupPage: React.FC = () => {
  const { t: t_old } = useI18n();
  const { t } = useTranslation("settings");
  const queryClient = useQueryClient();
  const { data: club, isLoading: loading_club } = use_club();
  const { data: setup } = use_setup_club();
  const { data: stagioni = [] } = use_stagioni();
  const { data: atleti = [] } = use_atleti();
  const { data: istruttori = [] } = use_istruttori();
  const { data: config_ghiaccio, isLoading: loading_config } = use_config_ghiaccio();
  const { data: disp_ghiaccio_raw, isLoading: loading_disp } = use_disponibilita_ghiaccio();
  const { data: catalogo_count } = use_catalogo_count();
  const { data: risorse = [] } = use_risorse_strutture();

  const stagione_attiva = stagioni.find((s: any) => s.attiva);
  const [form, set_form] = useState<Record<string, any>>({});
  const [saving, set_saving] = useState(false);
  const [uploading, set_uploading] = useState(false);
  const [logo_preview, set_logo_preview] = useState<string | null>(null);

  // Ghiaccio config form
  const [ghiaccio_form, set_ghiaccio_form] = useState<Record<string, any>>({});
  const [saving_ghiaccio, set_saving_ghiaccio] = useState(false);

  // Disponibilità strutture local state
  const [risorsa_sel_id, set_risorsa_sel_id] = useState<string>("");
  const [disp_local, set_disp_local] = useState<Record<string, { ora_inizio: string; ora_fine: string }[]>>({});
  const [disp_pulizia_local, set_disp_pulizia_local] = useState<Record<string, { ora_inizio: string; ora_fine: string }[]>>({});
  const [saving_disp, set_saving_disp] = useState(false);

  const risorse_attive = (risorse ?? []).filter((r: any) => r.attiva !== false);
  const risorsa_sel = (risorse ?? []).find((r: any) => r.id === risorsa_sel_id) ?? null;
  const risorsa_is_ghiaccio = risorsa_sel?.tipo !== "palestra";

  // Seleziona la prima risorsa disponibile
  useEffect(() => {
    if (!risorsa_sel_id && risorse_attive.length > 0) {
      set_risorsa_sel_id(risorse_attive[0].id);
    }
  }, [risorse_attive, risorsa_sel_id]);

  // Sync disp_local quando cambiano i dati o la risorsa selezionata
  useEffect(() => {
    if (disp_ghiaccio_raw) {
      const ghiaccio: Record<string, { ora_inizio: string; ora_fine: string }[]> = {};
      const pulizia: Record<string, { ora_inizio: string; ora_fine: string }[]> = {};
      disp_ghiaccio_raw
        .filter((d: any) => (risorsa_sel_id ? d.risorsa_id === risorsa_sel_id : !d.risorsa_id))
        .forEach((d: any) => {
          const target = d.tipo === "pulizia" ? pulizia : ghiaccio;
          if (!target[d.giorno]) target[d.giorno] = [];
          target[d.giorno].push({ ora_inizio: d.ora_inizio, ora_fine: d.ora_fine });
        });
      set_disp_local(ghiaccio);
      set_disp_pulizia_local(pulizia);
    }
  }, [disp_ghiaccio_raw, risorsa_sel_id]);

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
      toast({ title: t("club.toast.seleziona_file_immagine"), variant: "destructive" });
      return;
    }
    set_uploading(true);
    try {
      const ext = file.name.split(".").pop();
      const club_id = get_current_club_id();
      const path = `${club_id}/logo-${Date.now()}.${ext}`;
      const { error: upload_error } = await supabase.storage
        .from("loghi-club")
        .upload(path, file, { upsert: true });
      if (upload_error) throw upload_error;
      // Pulizia: rimuovi il logo precedente se appartiene alla cartella di questo club.
      // Errori ignorati in silenzio: non deve mai bloccare il salvataggio del nuovo logo.
      try {
        const prev_url: string = (form as any)?.logo_url || logo_preview || "";
        const prev_path = prev_url.split("?")[0].split("/loghi-club/")[1];
        if (prev_path && prev_path.startsWith(`${club_id}/`) && prev_path !== path) {
          await supabase.storage.from("loghi-club").remove([decodeURIComponent(prev_path)]);
        }
      } catch {}
      const { data: url_data } = supabase.storage.from("loghi-club").getPublicUrl(path);
      const logo_url = url_data.publicUrl;
      set_val("logo_url", logo_url);
      set_logo_preview(logo_url);
      toast({ title: t("club.toast.logo_caricato") });
    } catch (err: any) {
      toast({ title: t("club.toast.errore_upload_logo"), description: err?.message, variant: "destructive" });
    } finally {
      set_uploading(false);
    }
  };

  const handle_save = async () => {
    set_saving(true);
    try {
      const club_id = get_current_club_id();
      const club_payload: Record<string, any> = {};
      const club_fields = [
        "nome", "citta", "cap", "paese", "email", "telefono", "indirizzo",
        "sito_web", "numero_tessera_federale", "colore_primario", "descrizione", "logo_url",
        "reminder_allenamenti_attivo", "reminder_staff_attivo", "reminder_orario_invio", "reminder_anticipo_giorni",
        "reminder_planning_atleti_attivo", "reminder_planning_istruttori_attivo",
        "reminder_planning_orario_invio", "reminder_planning_anticipo_giorni",
        "disponibilita_valida_fino_al",
        "disponibilita_tipo_pianificazione", "disponibilita_periodo_giorni", "disponibilita_giorni_preavviso",

      ];
      for (const f of club_fields) {
        if (f in form) club_payload[f] = form[f];
      }
      if (Object.keys(club_payload).length > 0) {
        const { error } = await supabase.from("clubs").update(club_payload).eq("id", club_id);
        if (error) throw error;
      }

      const setup_payload: Record<string, any> = {};
      const setup_fields = [
        "max_lezioni_private_contemporanee", "max_atlete_lezione_condivisa",
        "slot_lezione_privata_minuti", "iban", "intestatario_conto", "banca", "indirizzo_banca", "twint_paylink",
        "data_inizio_stagione", "data_fine_stagione", "medagliere_punti", "clausole_contratto",
      ];
      for (const f of setup_fields) {
        if (f in form) setup_payload[f] = form[f];
      }
      if (Object.keys(setup_payload).length > 0) {
        if ((setup as any)?.id) {
          const { error } = await supabase.from("setup_club").update(setup_payload).eq("id", (setup as any).id);
          if (error) throw error;
        } else {
          const { error } = await supabase.from("setup_club").insert({ club_id, ...setup_payload });
          if (error) throw error;
        }
        await queryClient.invalidateQueries({ queryKey: ["setup_club", club_id] });
      }

      // Auto-sync della stagione attiva con le date configurate.
      // Il DB ammette UNA SOLA stagione attiva per club: cerchiamo quella attiva
      // senza filtrare per tipo e la aggiorniamo; inseriamo solo se non esiste.
      const data_inizio = setup_payload.data_inizio_stagione ?? (setup as any)?.data_inizio_stagione;
      const data_fine = setup_payload.data_fine_stagione ?? (setup as any)?.data_fine_stagione;
      if (data_inizio && data_fine) {
        const { data: existing } = await supabase
          .from("stagioni")
          .select("id")
          .eq("club_id", club_id)
          .eq("attiva", true)
          .order("data_inizio", { ascending: false })
          .limit(1)
          .maybeSingle();
        const stagione_payload = {
          club_id,
          nome: `Stagione ${new Date(data_inizio + "T00:00:00").getFullYear()}/${new Date(data_fine + "T00:00:00").getFullYear()}`,
          tipo: "Regolare",
          data_inizio,
          data_fine,
          attiva: true,
        };
        if (existing?.id) {
          const { error: st_err } = await supabase.from("stagioni").update(stagione_payload).eq("id", existing.id);
          if (st_err) throw st_err;
        } else {
          const { error: st_err } = await supabase.from("stagioni").insert(stagione_payload);
          if (st_err) throw st_err;
        }
        await queryClient.invalidateQueries({ queryKey: ["stagioni"] });
      }

      toast({ title: t("club.toast.configurazione_salvata") });
      set_form({});
    } catch (err: any) {
      toast({ title: t("club.toast.errore_salvataggio"), description: err?.message, variant: "destructive" });
    } finally {
      set_saving(false);
    }
  };

  // Save ghiaccio config (upsert)
  const handle_save_ghiaccio = async () => {
    set_saving_ghiaccio(true);
    try {
      const club_id = get_current_club_id();
      // Allarmi soft: se vuoto/non numerico ⇒ NULL ⇒ allarme disattivato
      const to_int_or_null = (v: any) => {
        if (v === "" || v === null || v === undefined) return null;
        const n = parseInt(v);
        return Number.isNaN(n) ? null : n;
      };
      const payload = {
        club_id,
        ora_apertura_default: get_ghiaccio_val("ora_apertura_default", "06:00"),
        ora_chiusura_default: get_ghiaccio_val("ora_chiusura_default", "22:30"),
        durata_pulizia_minuti: parseInt(get_ghiaccio_val("durata_pulizia_minuti", 30)),
        max_atleti_contemporanei: to_int_or_null(get_ghiaccio_val("max_atleti_contemporanei", "")),
        max_atleti_per_istruttore: to_int_or_null(get_ghiaccio_val("max_atleti_per_istruttore", "")),
        min_iscritti_attivazione_corso: to_int_or_null(get_ghiaccio_val("min_iscritti_attivazione_corso", "")),
        max_atleti_lezione_privata: parseInt(get_ghiaccio_val("max_atleti_lezione_privata", 3)) || 3,
        modalita_costo_privata: get_ghiaccio_val("modalita_costo_privata", "tariffa_fissa") || "tariffa_fissa",
      };

      if (config_ghiaccio?.id) {
        const { error } = await supabase.from("configurazione_ghiaccio").update(payload).eq("id", config_ghiaccio.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("configurazione_ghiaccio").insert(payload);
        if (error) throw error;
      }

      toast({ title: t("club.toast.configurazione_ghiaccio_salvata") });
      set_ghiaccio_form({});
      queryClient.invalidateQueries({ queryKey: ["configurazione_ghiaccio"] });
    } catch (err: any) {
      toast({ title: t("club.toast.errore_salvataggio"), description: err?.message, variant: "destructive" });
    } finally {
      set_saving_ghiaccio(false);
    }
  };

  // Save SOLO sezione lezioni private
  const [saving_private, set_saving_private] = useState(false);
  const handle_save_private = async () => {
    set_saving_private(true);
    try {
      const club_id = get_current_club_id();
      const payload: any = {
        club_id,
        max_atleti_lezione_privata:
          parseInt(get_ghiaccio_val("max_atleti_lezione_privata", (config_ghiaccio as any)?.max_atleti_lezione_privata ?? 3)) || 3,
        modalita_costo_privata:
          get_ghiaccio_val("modalita_costo_privata", (config_ghiaccio as any)?.modalita_costo_privata ?? "tariffa_fissa") || "tariffa_fissa",
      };
      if (config_ghiaccio?.id) {
        const { error } = await supabase
          .from("configurazione_ghiaccio")
          .update(payload)
          .eq("id", config_ghiaccio.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("configurazione_ghiaccio").insert(payload);
        if (error) throw error;
      }
      toast({ title: t("club.toast.configurazione_private_salvata") });
      set_ghiaccio_form((prev) => {
        const { max_atleti_lezione_privata, modalita_costo_privata, ...rest } = prev;
        return rest;
      });
      queryClient.invalidateQueries({ queryKey: ["configurazione_ghiaccio"] });
    } catch (err: any) {
      toast({ title: t("club.toast.errore_salvataggio"), description: err?.message, variant: "destructive" });
    } finally {
      set_saving_private(false);
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

  // Pulizia CRUD
  const add_slot_pulizia = (giorno: string) => {
    const durata = parseInt(get_ghiaccio_val("durata_pulizia_minuti", 30)) || 30;
    const start_h = 12;
    const start_m = 0;
    const end_total = start_h * 60 + start_m + durata;
    const eh = Math.floor(end_total / 60);
    const em = end_total % 60;
    const pad = (n: number) => String(n).padStart(2, "0");
    const ora_inizio = `${pad(start_h)}:${pad(start_m)}`;
    const ora_fine = `${pad(eh)}:${pad(em)}`;
    set_disp_pulizia_local((prev) => ({
      ...prev,
      [giorno]: [...(prev[giorno] || []), { ora_inizio, ora_fine }],
    }));
  };

  const remove_slot_pulizia = (giorno: string, idx: number) => {
    set_disp_pulizia_local((prev) => ({
      ...prev,
      [giorno]: (prev[giorno] || []).filter((_, i) => i !== idx),
    }));
  };

  const update_slot_pulizia = (giorno: string, idx: number, field: "ora_inizio" | "ora_fine", value: string) => {
    set_disp_pulizia_local((prev) => ({
      ...prev,
      [giorno]: (prev[giorno] || []).map((s, i) => (i === idx ? { ...s, [field]: value } : s)),
    }));
  };

  const [rinnovando_disp, set_rinnovando_disp] = useState(false);

  const rinnova_disponibilita = async () => {
    const giorni = Number(get_val("disponibilita_periodo_giorni", 0)) || 0;
    if (giorni <= 0) {
      toast({ title: t("club.toast.periodo_mancante"), variant: "destructive" });
      return;
    }
    set_rinnovando_disp(true);
    try {
      const d = new Date();
      d.setDate(d.getDate() + giorni);
      const nuova = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
      const { error } = await supabase
        .from("clubs")
        .update({ disponibilita_valida_fino_al: nuova, disponibilita_notifica_inviata_per: null })
        .eq("id", get_current_club_id());
      if (error) throw error;
      set_val("disponibilita_valida_fino_al", nuova);
      await queryClient.invalidateQueries({ queryKey: ["club"] });
      toast({ title: t("club.toast.disponibilita_rinnovata") });
    } catch (err: any) {
      toast({ title: t("club.toast.errore_salvataggio"), description: err?.message, variant: "destructive" });
    } finally {
      set_rinnovando_disp(false);
    }
  };



  const save_disponibilita = async () => {
    if (!risorsa_sel_id) {
      toast({ title: t("club.toast.seleziona_risorsa"), variant: "destructive" });
      return;
    }
    set_saving_disp(true);
    try {
      const club_id = get_current_club_id();
      // Cancella solo le righe della risorsa selezionata
      const { error: del_err } = await supabase
        .from("disponibilita_ghiaccio")
        .delete()
        .eq("club_id", club_id)
        .eq("risorsa_id", risorsa_sel_id);
      if (del_err) throw del_err;

      // Insert all (disponibilità + eventuale pulizia)
      const rows: any[] = [];
      for (const [giorno, slots] of Object.entries(disp_local)) {
        for (const s of slots) {
          rows.push({ club_id, risorsa_id: risorsa_sel_id, giorno, ora_inizio: s.ora_inizio, ora_fine: s.ora_fine, tipo: "ghiaccio" });
        }
      }
      if (risorsa_is_ghiaccio) {
        for (const [giorno, slots] of Object.entries(disp_pulizia_local)) {
          for (const s of slots) {
            rows.push({ club_id, risorsa_id: risorsa_sel_id, giorno, ora_inizio: s.ora_inizio, ora_fine: s.ora_fine, tipo: "pulizia" });
          }
        }
      }
      if (rows.length > 0) {
        const { error: ins_err } = await supabase.from("disponibilita_ghiaccio").insert(rows as any);
        if (ins_err) throw ins_err;
      }

      toast({ title: t("club.toast.disponibilita_salvata_per", { risorsa: risorsa_sel?.nome ?? t("club.fields.risorsa") }) });
      queryClient.invalidateQueries({ queryKey: ["disponibilita_ghiaccio"] });
    } catch (err: any) {
      toast({ title: t("club.toast.errore_salvataggio"), description: err?.message, variant: "destructive" });
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

  // Completezza tab
  const tab_completa: Record<string, boolean> = {
    configurazione: !!get_val("nome") && !!get_val("email") && !!get_val("indirizzo"),
    ghiaccio: Object.values(disp_local).some((v) => (v?.length ?? 0) > 0),
    catalogo: (catalogo_count ?? 0) > 0,
    fatturazione: !!String(get_val("iban", "")).trim() && !!String(get_val("intestatario_conto", "")).trim(),
  };

  const tab_label = (value: string, label: string) => (
    <span className="flex items-center gap-1.5">
      {label}
      {tab_completa[value]
        ? <CheckCircle2 className="w-3.5 h-3.5 text-success" />
        : <AlertCircle className="w-3.5 h-3.5 text-orange-500" />}
    </span>
  );

  return (
    <div className="space-y-6 animate-fade-in">
      <h1 className="text-xl font-bold tracking-tight text-foreground">{t_old("setup_club")}</h1>

      {/* Statistiche live */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {[
          { icon: Users, label: t("club.stats.atleti"), value: atleti.length, color: "text-primary" },
          { icon: UserCheck, label: t("club.stats.istruttori"), value: istruttori.filter((i: any) => i.attivo).length, color: "text-success" },
          { icon: Calendar, label: t("club.stats.stagione_attiva"), value: stagione_attiva?.nome || "—", color: "text-orange-500" },
          { icon: Hash, label: t("club.stats.club_id"), value: get_current_club_id().slice(0, 8) + "...", color: "text-muted-foreground" },
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

      <Tabs defaultValue="configurazione" className="w-full">
        <TabsList className="mb-4">
          <TabsTrigger value="configurazione">{tab_label("configurazione", t("club.tabs.configurazione"))}</TabsTrigger>
          <TabsTrigger value="ghiaccio">{tab_label("ghiaccio", t("club.tabs.ghiaccio"))}</TabsTrigger>
          <TabsTrigger value="catalogo">{tab_label("catalogo", t("club.tabs.catalogo"))}</TabsTrigger>
          <TabsTrigger value="fatturazione">{tab_label("fatturazione", t("club.tabs.fatturazione"))}</TabsTrigger>
        </TabsList>

        <TabsContent value="configurazione">
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {[
          { icon: Users, label: t("club.stats.atleti"), value: atleti.length, color: "text-primary" },
          { icon: UserCheck, label: t("club.stats.istruttori"), value: istruttori.filter((i: any) => i.attivo).length, color: "text-success" },
          { icon: Calendar, label: t("club.stats.stagione_attiva"), value: stagione_attiva?.nome || "—", color: "text-orange-500" },
          { icon: Hash, label: t("club.stats.club_id"), value: get_current_club_id().slice(0, 8) + "...", color: "text-muted-foreground" },
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
          <h2 className="text-sm font-bold text-muted-foreground uppercase tracking-widest">{t("club.sezioni.logo")}</h2>
          <div className="flex items-center gap-6">
            <div className="w-20 h-20 rounded-2xl border-2 border-dashed border-border flex items-center justify-center overflow-hidden bg-muted/30 flex-shrink-0">
              {current_logo ? (
                <img src={current_logo} alt="Logo club" className="w-full h-full object-contain p-1" />
              ) : (
                <div className="text-center">
                  <Upload className="w-6 h-6 text-muted-foreground mx-auto mb-1" />
                  <p className="text-[10px] text-muted-foreground">{t("club.fields.logo_placeholder")}</p>
                </div>
              )}
            </div>
            <div className="space-y-2">
              <p className="text-sm text-muted-foreground">{t("club.fields.logo_formato")}</p>
              <label className="cursor-pointer">
                <input type="file" accept="image/*" onChange={handle_logo_upload} className="hidden" />
                <span className={`inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-border text-sm font-medium transition-colors ${uploading ? "opacity-50 cursor-not-allowed" : "hover:bg-muted/50"}`}>
                  <Upload className="w-4 h-4" />
                  {uploading ? t("club.azioni.caricamento") : t("club.azioni.carica_logo")}
                </span>
              </label>
            </div>
          </div>
        </section>

        <Separator />

        {/* Dati club */}
        <section className="space-y-4">
          <h2 className="text-sm font-bold text-muted-foreground uppercase tracking-widest">{t_old("dati_club")}</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Field label={t_old("nome")} icon={<Hash className="w-3.5 h-3.5" />}>
              <Input value={get_val("nome")} onChange={(e) => set_val("nome", e.target.value)} />
            </Field>
            <Field label={t_old("paese")} icon={<Globe className="w-3.5 h-3.5" />}>
              <Input value={get_val("paese")} onChange={(e) => set_val("paese", e.target.value)} placeholder="CH" />
            </Field>
          </div>
          <div className="grid gap-4" style={{ gridTemplateColumns: "60% 15% 25%" }}>
            <Field label={t("club.fields.via")} icon={<MapPin className="w-3.5 h-3.5" />}>
              <Input required value={get_val("indirizzo")} onChange={(e) => set_val("indirizzo", e.target.value)} placeholder="Via del Ghiaccio 7" />
            </Field>
            <Field label={t("club.fields.nap")} icon={<MapPin className="w-3.5 h-3.5" />}>
              <Input required maxLength={10} value={get_val("cap")} onChange={(e) => set_val("cap", e.target.value)} placeholder="6900" />
            </Field>
            <Field label={t("club.fields.citta")} icon={<MapPin className="w-3.5 h-3.5" />}>
              <Input required value={get_val("citta")} onChange={(e) => set_val("citta", e.target.value)} placeholder="Lugano" />
            </Field>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Field label={t_old("email")} icon={<Mail className="w-3.5 h-3.5" />}>
              <Input type="email" value={get_val("email")} onChange={(e) => set_val("email", e.target.value)} />
            </Field>
            <Field label={t_old("telefono")} icon={<Phone className="w-3.5 h-3.5" />}>
              <Input value={get_val("telefono")} onChange={(e) => set_val("telefono", e.target.value)} />
            </Field>
            <Field label={t("club.fields.sito_web")} icon={<Globe className="w-3.5 h-3.5" />}>
              <Input value={get_val("sito_web")} onChange={(e) => set_val("sito_web", e.target.value)} placeholder="https://www.clubname.ch" />
            </Field>
            <Field label={t("club.fields.tessera_federale")} icon={<Hash className="w-3.5 h-3.5" />}>
              <Input value={get_val("numero_tessera_federale")} onChange={(e) => set_val("numero_tessera_federale", e.target.value)} />
            </Field>
          </div>
        </section>

        <Separator />

        {/* Colore primario */}
        <section className="space-y-4">
          <h2 className="text-sm font-bold text-muted-foreground uppercase tracking-widest">{t("club.sezioni.colore_primario")}</h2>
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
          <h2 className="text-sm font-bold text-muted-foreground uppercase tracking-widest">{t("club.sezioni.descrizione")}</h2>
          <textarea
            value={get_val("descrizione")}
            onChange={(e) => set_val("descrizione", e.target.value)}
            rows={3}
            className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
            placeholder={t("club.fields.descrizione_placeholder")}
          />
        </section>

        <Separator />

        {/* Clausole aggiuntive al contratto di adesione */}
        <section className="space-y-4">
          <h2 className="text-sm font-bold text-muted-foreground uppercase tracking-widest">
            {t("club.sezioni.clausole_contratto")}
          </h2>
          <textarea
            value={get_val("clausole_contratto")}
            onChange={(e) => set_val("clausole_contratto", e.target.value)}
            rows={5}
            className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
            placeholder={t("club.fields.clausole_placeholder")}
          />
          <p className="text-xs text-muted-foreground">
            {t("club.testi.clausole_info")}
          </p>
        </section>

        <Separator />

        {/* Date stagione */}
        <section className="space-y-4">
          <h2 className="text-sm font-bold text-muted-foreground uppercase tracking-widest">{t("club.sezioni.stagione")}</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Field label={t("club.fields.data_inizio_stagione")} icon={<Calendar className="w-3.5 h-3.5" />}>
              <Input
                type="date"
                value={get_val("data_inizio_stagione", "")}
                onChange={(e) => set_val("data_inizio_stagione", e.target.value || null)}
              />
            </Field>
            <Field label={t("club.fields.data_fine_stagione")} icon={<Calendar className="w-3.5 h-3.5" />}>
              <Input
                type="date"
                value={get_val("data_fine_stagione", "")}
                onChange={(e) => set_val("data_fine_stagione", e.target.value || null)}
              />
              <p className="text-xs text-muted-foreground mt-1">
                {t("club.testi.banner_scadenza_stagione")}
              </p>
            </Field>
          </div>
        </section>

        <Separator />

        {/* Dati bancari */}
        <section className="space-y-4">
          <h2 className="text-sm font-bold text-muted-foreground uppercase tracking-widest">{t("club.sezioni.dati_bancari")}</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Field label={t("club.fields.iban")} icon={<Hash className="w-3.5 h-3.5" />}>
              <Input
                value={get_val("iban")}
                onChange={(e) => {
                  const v = e.target.value.toUpperCase().replace(/[^A-Z0-9\s]/g, "");
                  set_val("iban", v);
                }}
                placeholder="CH56 0483 5012 3456 7800 9"
                maxLength={26}
              />
              {(() => {
                const iban = get_val("iban", "").replace(/\s/g, "");
                if (iban && (!iban.startsWith("CH") || iban.length !== 21)) {
                  return <p className="text-xs text-destructive mt-1">{t("club.testi.iban_invalido")}</p>;
                }
                return null;
              })()}
            </Field>
            <Field label={t("club.fields.intestatario_conto")} icon={<Building2 className="w-3.5 h-3.5" />}>
              <Input value={get_val("intestatario_conto")} onChange={(e) => set_val("intestatario_conto", e.target.value)} placeholder="Club Pattinaggio Ascona" />
            </Field>
            <Field label={t("club.fields.banca")} icon={<Building2 className="w-3.5 h-3.5" />}>
              <Input value={get_val("banca")} onChange={(e) => set_val("banca", e.target.value)} placeholder="UBS, Raiffeisen, PostFinance..." />
            </Field>
            <Field label={t("club.fields.twint_paylink")} icon={<Globe className="w-3.5 h-3.5" />}>
              <Input value={get_val("twint_paylink")} onChange={(e) => set_val("twint_paylink", e.target.value)} placeholder="https://pay.raisenow.io/xxxxx" />
            </Field>
          </div>
        </section>

        <Separator />

        {/* Medagliere club — punti per posizione */}
        <section className="space-y-4">
          <h2 className="text-sm font-bold text-muted-foreground uppercase tracking-widest">{t("club.sezioni.medagliere")}</h2>
          <p className="text-xs text-muted-foreground">
            {t("club.testi.medagliere_info")}
          </p>
          {(() => {
            const default_punti: Record<string, number> = { "1": 10, "2": 7, "3": 5, "4": 3, "5": 2, "6": 1 };
            const current_punti: Record<string, number> =
              (form.medagliere_punti as any) ?? ((setup as any)?.medagliere_punti ?? default_punti);
            const update_punti = (pos: string, val: string) => {
              const next = { ...current_punti, [pos]: Number(val) || 0 };
              set_val("medagliere_punti", next);
            };
            const remove_pos = (pos: string) => {
              const next = { ...current_punti };
              delete next[pos];
              set_val("medagliere_punti", next);
            };
            const add_pos = () => {
              const used = Object.keys(current_punti).map(Number).filter((n) => !isNaN(n));
              const next_pos = String((used.length ? Math.max(...used) : 0) + 1);
              set_val("medagliere_punti", { ...current_punti, [next_pos]: 0 });
            };
            const sorted = Object.keys(current_punti).sort((a, b) => Number(a) - Number(b));
            return (
              <div className="space-y-2">
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {sorted.map((pos) => (
                    <div key={pos} className="flex items-center gap-1 border border-border rounded-lg px-2 py-1">
                      <span className="text-xs font-bold text-muted-foreground w-8">{pos}°</span>
                      <Input
                        type="number"
                        min={0}
                        value={current_punti[pos]}
                        onChange={(e) => update_punti(pos, e.target.value)}
                        className="h-8 text-sm"
                      />
                      <Button variant="ghost" size="sm" onClick={() => remove_pos(pos)} className="h-7 w-7 p-0 text-destructive">
                        <Trash2 className="w-3 h-3" />
                      </Button>
                    </div>
                  ))}
                </div>
                <Button variant="outline" size="sm" onClick={add_pos} className="gap-1">
                  <Plus className="w-3 h-3" /> {t("club.azioni.aggiungi_posizione")}
                </Button>
              </div>
            );
          })()}
        </section>

        <Separator />

        {/* Reminder automatici */}
        <section className="space-y-4">
          <h2 className="text-sm font-bold text-muted-foreground uppercase tracking-widest">{t("club.sezioni.reminder")}</h2>
          <p className="text-xs text-muted-foreground">
            {t("club.testi.reminder_info")}
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Field label={t("club.fields.reminder_allenamenti")}>
              <div className="flex items-center gap-2">
                <Switch
                  checked={get_val("reminder_allenamenti_attivo", club?.reminder_allenamenti_attivo ?? true)}
                  onCheckedChange={(v) => set_val("reminder_allenamenti_attivo", v)}
                />
                <span className="text-xs text-muted-foreground">
                  {get_val("reminder_allenamenti_attivo", club?.reminder_allenamenti_attivo ?? true) ? t("club.stato.attivo") : t("club.stato.disattivo")}
                </span>
              </div>
            </Field>
            <Field label={t("club.fields.reminder_staff")}>
              <div className="flex items-center gap-2">
                <Switch
                  checked={get_val("reminder_staff_attivo", club?.reminder_staff_attivo ?? true)}
                  onCheckedChange={(v) => set_val("reminder_staff_attivo", v)}
                />
                <span className="text-xs text-muted-foreground">
                  {get_val("reminder_staff_attivo", club?.reminder_staff_attivo ?? true) ? t("club.stato.attivo") : t("club.stato.disattivo")}
                </span>
              </div>
            </Field>
            <Field label={t("club.fields.orario_invio")}>
              <select
                className="w-full h-10 rounded-md border border-input bg-background px-3 text-sm"
                value={String(get_val("reminder_orario_invio", club?.reminder_orario_invio ?? 18))}
                onChange={(e) => set_val("reminder_orario_invio", Number(e.target.value))}
              >
                {[16, 17, 18, 19, 20].map((h) => (
                  <option key={h} value={h}>{h}:00</option>
                ))}
              </select>
            </Field>
            <Field label={t("club.fields.anticipo")}>
              <select
                className="w-full h-10 rounded-md border border-input bg-background px-3 text-sm"
                value={String(get_val("reminder_anticipo_giorni", club?.reminder_anticipo_giorni ?? 1))}
                onChange={(e) => set_val("reminder_anticipo_giorni", Number(e.target.value))}
              >
                <option value="1">{t("club.opzioni.un_giorno_prima")}</option>
                <option value="2">{t("club.opzioni.due_giorni_prima")}</option>
              </select>
            </Field>
          </div>

          <div className="pt-2 space-y-3">
            <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">{t("club.sezioni.planning_giornaliero")}</h3>
            <p className="text-xs text-muted-foreground">
              {t("club.testi.planning_giornaliero_info")}
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Field label={t("club.fields.planning_atleti")}>
                <div className="flex items-center gap-2">
                  <Switch
                    checked={get_val("reminder_planning_atleti_attivo", (club as any)?.reminder_planning_atleti_attivo ?? false)}
                    onCheckedChange={(v) => set_val("reminder_planning_atleti_attivo", v)}
                  />
                  <span className="text-xs text-muted-foreground">
                    {get_val("reminder_planning_atleti_attivo", (club as any)?.reminder_planning_atleti_attivo ?? false) ? t("club.stato.attivo") : t("club.stato.disattivo")}
                  </span>
                </div>
              </Field>
              <Field label={t("club.fields.planning_istruttori")}>
                <div className="flex items-center gap-2">
                  <Switch
                    checked={get_val("reminder_planning_istruttori_attivo", (club as any)?.reminder_planning_istruttori_attivo ?? false)}
                    onCheckedChange={(v) => set_val("reminder_planning_istruttori_attivo", v)}
                  />
                  <span className="text-xs text-muted-foreground">
                    {get_val("reminder_planning_istruttori_attivo", (club as any)?.reminder_planning_istruttori_attivo ?? false) ? t("club.stato.attivo") : t("club.stato.disattivo")}
                  </span>
                </div>
              </Field>
              <Field label={t("club.fields.orario_invio_planning")}>
                <select
                  className="w-full h-10 rounded-md border border-input bg-background px-3 text-sm"
                  value={String(get_val("reminder_planning_orario_invio", (club as any)?.reminder_planning_orario_invio ?? 7))}
                  onChange={(e) => set_val("reminder_planning_orario_invio", Number(e.target.value))}
                >
                  {Array.from({ length: 24 }, (_, h) => h).map((h) => (
                    <option key={h} value={h}>{String(h).padStart(2, "0")}:00</option>
                  ))}
                </select>
              </Field>
              <Field label={t("club.fields.anticipo_planning")}>
                <select
                  className="w-full h-10 rounded-md border border-input bg-background px-3 text-sm"
                  value={String(get_val("reminder_planning_anticipo_giorni", (club as any)?.reminder_planning_anticipo_giorni ?? 0))}
                  onChange={(e) => set_val("reminder_planning_anticipo_giorni", Number(e.target.value))}
                >
                  <option value="0">{t("club.opzioni.stesso_giorno")}</option>
                  <option value="1">{t("club.opzioni.un_giorno_prima")}</option>
                  <option value="2">{t("club.opzioni.due_giorni_prima")}</option>
                </select>
              </Field>
            </div>
          </div>
        </section>

        <Separator />

        {/* Regole comunicazioni intelligenti */}
        <section className="space-y-4">
          <h2 className="text-sm font-bold text-muted-foreground uppercase tracking-widest">{t("club.sezioni.comunicazioni_intelligenti")}</h2>
          <p className="text-xs text-muted-foreground">
            {t("club.testi.comunicazioni_intelligenti_info")}
          </p>
          <RegoleComunicazioniSection club_id={club?.id || get_current_club_id() || null} />
        </section>

        <Separator />

        {/* Messaggi predefiniti */}
        <section className="space-y-4">
          <h2 className="text-sm font-bold text-muted-foreground uppercase tracking-widest">{t("club.sezioni.messaggi_predefiniti")}</h2>
          <p className="text-xs text-muted-foreground">
            {t("club.testi.messaggi_predefiniti_info")}
          </p>
          <TemplateComunicazioniSection club_id={club?.id || get_current_club_id() || null} />
        </section>

        <Separator />

        {/* Salva dati club */}
        <div className="flex justify-end">
          <Button onClick={handle_save} disabled={saving || Object.keys(form).length === 0}>
            {saving ? t("club.azioni.salvataggio") : t("club.azioni.salva_modifiche")}
          </Button>
        </div>

        <Separator />

        <ModalitaGestioneSection />

        <ModalitaGestioneSection
          area="fatturazione"
          label={t("club.tabs.fatturazione")}
          opzioni={[
            { value: "standard", label: t("club.opzioni.fatturazione_standard") },
            { value: "multi_ragione_sociale", label: t("club.opzioni.fatturazione_multi") },
          ]}
        />
        </div>

        </TabsContent>

        <TabsContent value="ghiaccio">
      <div className="bg-card rounded-xl shadow-card p-6 space-y-8 max-w-2xl border-2 border-primary/20">
        <h2 className="text-lg font-bold text-foreground flex items-center gap-2">
          {t("club.sezioni.ghiaccio_planning")}
        </h2>

        {/* Config fields */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Field label={t("club.fields.ora_apertura")}>
            <Input
              type="time"
              value={get_ghiaccio_val("ora_apertura_default", "06:00")}
              onChange={(e) => set_ghiaccio_val("ora_apertura_default", e.target.value)}
            />
          </Field>
          <Field label={t("club.fields.ora_chiusura")}>
            <Input
              type="time"
              value={get_ghiaccio_val("ora_chiusura_default", "22:30")}
              onChange={(e) => set_ghiaccio_val("ora_chiusura_default", e.target.value)}
            />
          </Field>
          <Field label={t("club.fields.durata_pulizia")}>
            <Input
              type="number"
              min={0}
              value={get_ghiaccio_val("durata_pulizia_minuti", 30)}
              onChange={(e) => set_ghiaccio_val("durata_pulizia_minuti", e.target.value)}
            />
          </Field>
          <Field label={t("club.fields.max_atleti_contemporanei")}>
            <Input
              type="number"
              min={1}
              placeholder={t("club.fields.placeholder_lascia_vuoto_allarme")}
              value={get_ghiaccio_val("max_atleti_contemporanei", config_ghiaccio?.max_atleti_contemporanei ?? "")}
              onChange={(e) => set_ghiaccio_val("max_atleti_contemporanei", e.target.value)}
            />
            {!get_ghiaccio_val("max_atleti_contemporanei", config_ghiaccio?.max_atleti_contemporanei ?? "") && (
              <p className="text-[11px] text-muted-foreground italic">{t("club.testi.allarme_non_configurato")}</p>
            )}
          </Field>
          <Field label={t("club.fields.max_atleti_per_istruttore")}>
            <Input
              type="number"
              min={1}
              placeholder={t("club.fields.placeholder_lascia_vuoto_allarme")}
              value={get_ghiaccio_val("max_atleti_per_istruttore", config_ghiaccio?.max_atleti_per_istruttore ?? "")}
              onChange={(e) => set_ghiaccio_val("max_atleti_per_istruttore", e.target.value)}
            />
            {!get_ghiaccio_val("max_atleti_per_istruttore", config_ghiaccio?.max_atleti_per_istruttore ?? "") && (
              <p className="text-[11px] text-muted-foreground italic">{t("club.testi.allarme_non_configurato")}</p>
            )}
          </Field>
          <Field label={t("club.fields.min_iscritti_attivazione")}>
            <Input
              type="number"
              min={0}
              placeholder={t("club.fields.placeholder_lascia_vuoto_allarme")}
              value={get_ghiaccio_val("min_iscritti_attivazione_corso", (config_ghiaccio as any)?.min_iscritti_attivazione_corso ?? "")}
              onChange={(e) => set_ghiaccio_val("min_iscritti_attivazione_corso", e.target.value)}
            />
            {!get_ghiaccio_val("min_iscritti_attivazione_corso", (config_ghiaccio as any)?.min_iscritti_attivazione_corso ?? "") && (
              <p className="text-[11px] text-muted-foreground italic">{t("club.testi.allarme_non_configurato")}</p>
            )}
          </Field>
        </div>

        <Separator />

        {/* Lezioni Private */}
        <div>
          <h3 className="text-sm font-bold text-muted-foreground uppercase tracking-widest mb-4">
            {t("club.sezioni.lezioni_private")}
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Field label={t("club.fields.max_atleti_lezione_privata")}>
              <Input
                type="number"
                min={1}
                value={get_ghiaccio_val("max_atleti_lezione_privata", (config_ghiaccio as any)?.max_atleti_lezione_privata ?? 3)}
                onChange={(e) => set_ghiaccio_val("max_atleti_lezione_privata", e.target.value)}
              />
            </Field>
            <Field label={t("club.fields.modalita_costo_privata")}>
              <RadioGroup
                value={get_ghiaccio_val("modalita_costo_privata", (config_ghiaccio as any)?.modalita_costo_privata ?? "tariffa_fissa")}
                onValueChange={(v) => set_ghiaccio_val("modalita_costo_privata", v)}
                className="flex flex-col gap-2 pt-2"
              >
                <label className="flex items-center gap-2 text-sm cursor-pointer">
                  <RadioGroupItem value="tariffa_fissa" id="mcp_fissa" />
                  <span>{t("club.opzioni.tariffa_fissa")}</span>
                </label>
                <label className="flex items-center gap-2 text-sm cursor-pointer">
                  <RadioGroupItem value="diviso_atleti" id="mcp_diviso" />
                  <span>{t("club.opzioni.diviso_atleti")}</span>
                </label>
              </RadioGroup>
            </Field>
          </div>
          <div className="flex justify-end mt-4">
            <Button onClick={handle_save_private} disabled={saving_private}>
              {saving_private ? t("club.azioni.salvataggio") : t("club.azioni.salva_config_private")}
            </Button>
          </div>
        </div>

        <div className="flex justify-end">
          <Button onClick={handle_save_ghiaccio} disabled={saving_ghiaccio}>
            {saving_ghiaccio ? t("club.azioni.salvataggio") : t("club.azioni.salva_config_ghiaccio")}
          </Button>
        </div>

        <Separator />

        {/* Tipo di pianificazione disponibilità */}
        <div>
          <h3 className="text-sm font-bold text-muted-foreground uppercase tracking-widest mb-4">
            {t("club.sezioni.tipo_pianificazione")}
          </h3>
          <div className="max-w-sm">
            <Label className="text-xs text-muted-foreground">{t("club.fields.tipo_pianificazione")}</Label>
            <Select
              value={get_val("disponibilita_tipo_pianificazione", "stagionale") || "stagionale"}
              onValueChange={(v) => {
                set_val("disponibilita_tipo_pianificazione", v);
                if (v === "stagionale") set_val("disponibilita_valida_fino_al", null);
              }}
            >
              <SelectTrigger className="h-9 mt-1">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="stagionale">{t("club.opzioni.pianificazione_stagionale")}</SelectItem>
                <SelectItem value="periodica">{t("club.opzioni.pianificazione_periodica")}</SelectItem>
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground mt-1">{t("club.testi.tipo_pianificazione_info")}</p>
          </div>

          {get_val("disponibilita_tipo_pianificazione", "stagionale") === "periodica" && (
            <div className="mt-4 space-y-4 max-w-sm">
              <div>
                <Label className="text-xs text-muted-foreground">{t("club.fields.periodo_giorni")}</Label>
                <Input
                  type="number"
                  min={1}
                  className="h-9 mt-1"
                  value={get_val("disponibilita_periodo_giorni", "") ?? ""}
                  onChange={(e) =>
                    set_val("disponibilita_periodo_giorni", e.target.value === "" ? null : Number(e.target.value))
                  }
                />
              </div>
              <div>
                <Label className="text-xs text-muted-foreground">{t("club.fields.giorni_preavviso")}</Label>
                <Input
                  type="number"
                  min={0}
                  className="h-9 mt-1"
                  value={get_val("disponibilita_giorni_preavviso", 5) ?? 5}
                  onChange={(e) =>
                    set_val("disponibilita_giorni_preavviso", e.target.value === "" ? 5 : Number(e.target.value))
                  }
                />
              </div>
              <p className="text-sm">
                <span className="text-muted-foreground">{t("club.testi.prossima_scadenza")}: </span>
                <strong>
                  {get_val("disponibilita_valida_fino_al", "")
                    ? new Date(`${get_val("disponibilita_valida_fino_al", "")}T00:00:00`).toLocaleDateString("it-CH")
                    : t("club.testi.scadenza_non_impostata")}
                </strong>
              </p>
              <Button size="sm" variant="outline" onClick={rinnova_disponibilita} disabled={rinnovando_disp}>
                {rinnovando_disp ? t("club.azioni.salvando") : t("club.azioni.rinnova_disponibilita")}
              </Button>
            </div>
          )}
        </div>

        <Separator />



        {/* Disponibilità strutture settimanale */}
        <div>
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-bold text-muted-foreground uppercase tracking-widest">
              {t("club.sezioni.disponibilita_strutture")}
            </h3>
            <Button size="sm" onClick={save_disponibilita} disabled={saving_disp || !risorsa_sel_id}>
              {saving_disp ? t("club.azioni.salvando") : t("club.azioni.salva_disponibilita")}
            </Button>
          </div>
          <div className="mb-4 max-w-sm">
            <Label className="text-xs text-muted-foreground">
              {t("club.fields.valida_fino_al")}
            </Label>
            <Input
              type="date"
              className="h-9 mt-1"
              value={get_val("disponibilita_valida_fino_al", "") || ""}
              onChange={(e) => set_val("disponibilita_valida_fino_al", e.target.value || null)}
            />
            <p className="text-xs text-muted-foreground mt-1">
              {t("club.testi.disponibilita_scadenza_info")}
            </p>
          </div>
          <div className="mb-4 max-w-sm">
            <Label className="text-xs text-muted-foreground">{t("club.fields.risorsa")}</Label>
            <Select value={risorsa_sel_id} onValueChange={set_risorsa_sel_id}>
              <SelectTrigger className="h-9 mt-1">
                <SelectValue placeholder={t("club.fields.seleziona_risorsa_placeholder")} />
              </SelectTrigger>
              <SelectContent>
                {risorse_attive.map((r: any) => (
                  <SelectItem key={r.id} value={r.id}>
                    {r.nome} · {r.tipo === "palestra" ? t("club.opzioni.palestra") : t("club.opzioni.ghiaccio")}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {risorse_attive.length === 0 && (
              <p className="text-xs text-muted-foreground italic mt-1">
                {t("club.testi.nessuna_risorsa")}
              </p>
            )}
          </div>
          <div className="space-y-4">

            {GIORNI.map((giorno) => {
              const slots = disp_local[giorno] || [];
              return (
                <div key={giorno} className="border border-border/50 rounded-lg p-3">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-medium text-foreground">{giorno}</span>
                    <Button variant="ghost" size="sm" onClick={() => add_slot(giorno)} className="h-7 text-xs">
                      <Plus className="w-3 h-3 mr-1" /> {t("club.azioni.slot")}
                    </Button>
                  </div>
                  {slots.length === 0 && <p className="text-xs text-muted-foreground italic py-1">{t("club.testi.nessuno_slot_prefix")} <strong>{t("club.azioni.plus_slot")}</strong> {t("club.testi.nessuno_slot_suffix")}</p>}
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

        {risorsa_is_ghiaccio && (
        <>
        <Separator />

        {/* Pulizia Ghiaccio */}
        <div>

          <h3 className="text-sm font-bold text-muted-foreground uppercase tracking-widest mb-4">
            {t("club.sezioni.pulizia_ghiaccio")}
          </h3>
          <div className="space-y-4">
            {GIORNI.map((giorno) => {
              const slots = disp_pulizia_local[giorno] || [];
              return (
                <div key={giorno} className="border border-border/50 rounded-lg p-3">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-medium text-foreground">{giorno}</span>
                    <Button variant="ghost" size="sm" onClick={() => add_slot_pulizia(giorno)} className="h-7 text-xs">
                      <Plus className="w-3 h-3 mr-1" /> {t("club.azioni.slot")}
                    </Button>
                  </div>
                  {slots.length === 0 && <p className="text-xs text-muted-foreground italic py-1">{t("club.testi.nessuno_slot_prefix")} <strong>{t("club.azioni.plus_slot")}</strong> {t("club.testi.nessuno_slot_suffix")}</p>}
                  {slots.map((s, idx) => (
                    <div key={idx} className="flex items-center gap-2 mb-1">
                      <Input
                        type="time"
                        value={s.ora_inizio}
                        onChange={(e) => update_slot_pulizia(giorno, idx, "ora_inizio", e.target.value)}
                        className="w-28 h-8 text-xs"
                      />
                      <span className="text-muted-foreground text-xs">—</span>
                      <Input
                        type="time"
                        value={s.ora_fine}
                        onChange={(e) => update_slot_pulizia(giorno, idx, "ora_fine", e.target.value)}
                        className="w-28 h-8 text-xs"
                      />
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => remove_slot_pulizia(giorno, idx)}
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
        </>
        )}
      </div>


      <div className="max-w-2xl mt-6">
        <RisorseSection />
      </div>
        </TabsContent>

        <TabsContent value="catalogo">
          <CatalogoOffertaTab
            club_id={club?.id || get_current_club_id() || null}
            stagione_id={stagione_attiva?.id || null}
          />
        </TabsContent>

        <TabsContent value="fatturazione">
          <div className="space-y-6">
            <FatturazioneTab />
            <RagioniSocialiSection />
            <FatturaLayoutSection />
          </div>
        </TabsContent>
      </Tabs>
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
