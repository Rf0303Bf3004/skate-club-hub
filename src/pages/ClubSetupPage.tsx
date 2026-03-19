import React, { useState } from "react";
import { useI18n } from "@/lib/i18n";
import { use_club, use_setup_club, use_stagioni, use_atleti, use_istruttori } from "@/hooks/use-supabase-data";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { supabase, DEMO_CLUB_ID } from "@/lib/supabase";
import { toast } from "@/hooks/use-toast";
import { Upload, Globe, Phone, Mail, MapPin, Hash, Users, UserCheck, Calendar, Building2 } from "lucide-react";

const ClubSetupPage: React.FC = () => {
  const { t } = useI18n();
  const { data: club, isLoading: loading_club } = use_club();
  const { data: setup } = use_setup_club();
  const { data: stagioni = [] } = use_stagioni();
  const { data: atleti = [] } = use_atleti();
  const { data: istruttori = [] } = use_istruttori();

  const stagione_attiva = stagioni.find((s: any) => s.attiva);
  const [form, set_form] = useState<Record<string, any>>({});
  const [saving, set_saving] = useState(false);
  const [uploading, set_uploading] = useState(false);
  const [logo_preview, set_logo_preview] = useState<string | null>(null);

  const get_val = (field: string, fallback: any = "") => {
    if (field in form) return form[field];
    return club?.[field] ?? setup?.[field] ?? fallback;
  };

  const set_val = (field: string, value: any) => {
    set_form((prev) => ({ ...prev, [field]: value }));
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
      const path = `${DEMO_CLUB_ID}/logo.${ext}`;
      const { error: upload_error } = await supabase.storage.from("loghi-club").upload(path, file, { upsert: true });
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
        "nome",
        "citta",
        "paese",
        "email",
        "telefono",
        "indirizzo",
        "sito_web",
        "numero_tessera_federale",
        "colore_primario",
        "descrizione",
        "logo_url",
      ];
      for (const f of club_fields) {
        if (f in form) club_payload[f] = form[f];
      }
      if (Object.keys(club_payload).length > 0) {
        const { error } = await supabase.from("clubs").update(club_payload).eq("id", DEMO_CLUB_ID);
        if (error) throw error;
      }

      const setup_payload: Record<string, any> = {};
      const setup_fields = [
        "max_lezioni_private_contemporanee",
        "max_atlete_lezione_condivisa",
        "slot_lezione_privata_minuti",
        "iban",
        "intestatario_conto",
        "banca",
        "indirizzo_banca",
      ];
      for (const f of setup_fields) {
        if (f in form) setup_payload[f] = form[f];
      }
      if (Object.keys(setup_payload).length > 0) {
        const { error } = await supabase.from("setup_club").update(setup_payload).eq("club_id", DEMO_CLUB_ID);
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

  if (loading_club) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  const current_logo = logo_preview || club?.logo_url;
  const colore = get_val("colore_primario", "#3B82F6");

  return (
    <div className="space-y-6 animate-fade-in">
      <h1 className="text-xl font-bold tracking-tight text-foreground">{t("setup_club")}</h1>

      {/* Statistiche live */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {[
          { icon: Users, label: "Atleti", value: atleti.length, color: "text-primary" },
          {
            icon: UserCheck,
            label: "Istruttori",
            value: istruttori.filter((i: any) => i.attivo).length,
            color: "text-success",
          },
          { icon: Calendar, label: "Stagione attiva", value: stagione_attiva?.nome || "—", color: "text-orange-500" },
          { icon: Hash, label: "Club ID", value: DEMO_CLUB_ID.slice(0, 8) + "...", color: "text-muted-foreground" },
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
                <span
                  className={`inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-border text-sm font-medium transition-colors
                  ${uploading ? "opacity-50 cursor-not-allowed" : "hover:bg-muted/50"}`}
                >
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
              <Input
                value={get_val("indirizzo")}
                onChange={(e) => set_val("indirizzo", e.target.value)}
                placeholder="Via Roma 1, Lugano"
              />
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
              <Input
                value={get_val("sito_web")}
                onChange={(e) => set_val("sito_web", e.target.value)}
                placeholder="https://www.clubname.ch"
              />
            </Field>
            <Field label="N° tessera federale" icon={<Hash className="w-3.5 h-3.5" />}>
              <Input
                value={get_val("numero_tessera_federale")}
                onChange={(e) => set_val("numero_tessera_federale", e.target.value)}
                placeholder="FED-12345"
              />
            </Field>
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">Colore sociale</Label>
            <div className="flex items-center gap-3">
              <input
                type="color"
                value={colore}
                onChange={(e) => set_val("colore_primario", e.target.value)}
                className="w-10 h-10 rounded-lg border border-border cursor-pointer p-0.5 bg-background"
              />
              <Input
                value={colore}
                onChange={(e) => set_val("colore_primario", e.target.value)}
                placeholder="#3B82F6"
                className="w-32 font-mono text-sm"
              />
              <div className="w-8 h-8 rounded-lg border border-border" style={{ backgroundColor: colore }} />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">Descrizione club</Label>
            <textarea
              value={get_val("descrizione")}
              onChange={(e) => set_val("descrizione", e.target.value)}
              rows={3}
              placeholder="Breve descrizione del club..."
              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-primary/40"
            />
          </div>
        </section>

        <Separator />

        {/* Dati bancari */}
        <section className="space-y-4">
          <h2 className="text-sm font-bold text-muted-foreground uppercase tracking-widest">Dati Bancari</h2>
          <p className="text-xs text-muted-foreground">Utilizzati per generare il QR Swiss sulle fatture.</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Field label="IBAN" icon={<Building2 className="w-3.5 h-3.5" />}>
              <Input
                value={form.iban ?? setup?.iban ?? ""}
                onChange={(e) => set_val("iban", e.target.value)}
                placeholder="CH56 0483 5012 3456 7800 9"
                className="font-mono"
              />
            </Field>
            <Field label="Intestatario conto" icon={<Hash className="w-3.5 h-3.5" />}>
              <Input
                value={form.intestatario_conto ?? setup?.intestatario_conto ?? ""}
                onChange={(e) => set_val("intestatario_conto", e.target.value)}
                placeholder="Club Pattinaggio Ascona"
              />
            </Field>
            <Field label="Banca" icon={<Building2 className="w-3.5 h-3.5" />}>
              <Input
                value={form.banca ?? setup?.banca ?? ""}
                onChange={(e) => set_val("banca", e.target.value)}
                placeholder="Banca dello Stato del Cantone Ticino"
              />
            </Field>
            <Field label="Indirizzo banca" icon={<MapPin className="w-3.5 h-3.5" />}>
              <Input
                value={form.indirizzo_banca ?? setup?.indirizzo_banca ?? ""}
                onChange={(e) => set_val("indirizzo_banca", e.target.value)}
                placeholder="Via Lugano 1, 6500 Bellinzona"
              />
            </Field>
          </div>
        </section>

        <Separator />

        {/* Parametri stagione */}
        <section className="space-y-4">
          <h2 className="text-sm font-bold text-muted-foreground uppercase tracking-widest">
            {t("parametri_stagione")}
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <Label className="text-xs text-muted-foreground">{t("nome_stagione")}</Label>
              <Input value={stagione_attiva?.nome || ""} disabled className="mt-1 opacity-60" />
            </div>
            <div>
              <Label className="text-xs text-muted-foreground">{t("data_inizio")}</Label>
              <Input value={stagione_attiva?.data_inizio || ""} disabled className="mt-1 opacity-60" />
            </div>
            <div>
              <Label className="text-xs text-muted-foreground">{t("data_fine")}</Label>
              <Input value={stagione_attiva?.data_fine || ""} disabled className="mt-1 opacity-60" />
            </div>
          </div>
          <p className="text-xs text-muted-foreground">
            Per modificare la stagione vai alla pagina <span className="font-medium text-primary">Stagioni</span>.
          </p>
        </section>

        <Separator />

        {/* Parametri lezioni private */}
        <section className="space-y-4">
          <h2 className="text-sm font-bold text-muted-foreground uppercase tracking-widest">
            {t("parametri_lezioni")}
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <Label className="text-xs text-muted-foreground">{t("max_lezioni")}</Label>
              <Input
                type="number"
                value={form.max_lezioni_private_contemporanee ?? setup?.max_lezioni_private_contemporanee ?? ""}
                onChange={(e) => set_val("max_lezioni_private_contemporanee", parseInt(e.target.value))}
                placeholder={t("illimitato")}
                className="mt-1"
              />
            </div>
            <div>
              <Label className="text-xs text-muted-foreground">{t("max_atlete")}</Label>
              <Input
                type="number"
                value={form.max_atlete_lezione_condivisa ?? setup?.max_atlete_lezione_condivisa ?? ""}
                onChange={(e) => set_val("max_atlete_lezione_condivisa", parseInt(e.target.value))}
                placeholder={t("illimitato")}
                className="mt-1"
              />
            </div>
            <div>
              <Label className="text-xs text-muted-foreground">{t("durata_slot")}</Label>
              <Input
                type="number"
                value={form.slot_lezione_privata_minuti ?? setup?.slot_lezione_privata_minuti ?? 20}
                onChange={(e) => set_val("slot_lezione_privata_minuti", parseInt(e.target.value))}
                className="mt-1"
              />
            </div>
          </div>
        </section>

        <Button onClick={handle_save} disabled={saving} className="bg-primary hover:bg-primary/90 w-full sm:w-auto">
          {saving ? (
            <span className="flex items-center gap-2">
              <span className="animate-spin rounded-full h-4 w-4 border-b-2 border-white" />
              Salvo...
            </span>
          ) : (
            t("salva_modifiche")
          )}
        </Button>
      </div>
    </div>
  );
};

const Field: React.FC<{ label: string; icon?: React.ReactNode; children: React.ReactNode }> = ({
  label,
  icon,
  children,
}) => (
  <div className="space-y-1.5">
    <Label className="text-xs text-muted-foreground flex items-center gap-1.5">
      {icon && <span className="text-muted-foreground">{icon}</span>}
      {label}
    </Label>
    {children}
  </div>
);

export default ClubSetupPage;
