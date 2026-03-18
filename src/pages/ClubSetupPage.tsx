import React, { useState, useRef } from "react";
import { useI18n } from "@/lib/i18n";
import { use_club, use_setup_club, use_stagioni, use_atleti, use_istruttori } from "@/hooks/use-supabase-data";
import { supabase, DEMO_CLUB_ID } from "@/lib/supabase";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { toast } from "@/hooks/use-toast";
import { Upload, Globe, Phone, Mail, MapPin, Hash, Palette, Users, UserCheck, Calendar } from "lucide-react";

const ClubSetupPage: React.FC = () => {
  const { t } = useI18n();
  const { data: club, isLoading: loading_club } = use_club();
  const { data: setup } = use_setup_club();
  const { data: stagioni = [] } = use_stagioni();
  const { data: atleti = [] } = use_atleti();
  const { data: istruttori = [] } = use_istruttori();
  const stagione_attiva = stagioni.find((s: any) => s.attiva);
  const file_input_ref = useRef<HTMLInputElement>(null);

  const [club_form, set_club_form] = useState<Record<string, any>>({});
  const [setup_form, set_setup_form] = useState<Record<string, any>>({});
  const [saving, set_saving] = useState(false);
  const [uploading_logo, set_uploading_logo] = useState(false);
  const [logo_preview, set_logo_preview] = useState<string | null>(null);

  // Inizializza form con dati club quando arrivano
  React.useEffect(() => {
    if (club && Object.keys(club_form).length === 0) {
      set_club_form({
        nome: club.nome || "",
        citta: club.citta || "",
        paese: club.paese || "",
        email: club.email || "",
        telefono: club.telefono || "",
        indirizzo: club.indirizzo || "",
        sito_web: club.sito_web || "",
        numero_tessera_federale: club.numero_tessera_federale || "",
        colore_primario: club.colore_primario || "#3B82F6",
        descrizione: club.descrizione || "",
        logo_url: club.logo_url || "",
      });
      if (club.logo_url) set_logo_preview(club.logo_url);
    }
  }, [club]);

  React.useEffect(() => {
    if (setup && Object.keys(setup_form).length === 0) {
      set_setup_form({
        max_lezioni_private_contemporanee: setup.max_lezioni_private_contemporanee ?? 3,
        max_atlete_lezione_condivisa: setup.max_atlete_lezione_condivisa ?? 4,
        slot_lezione_privata_minuti: setup.slot_lezione_privata_minuti ?? 20,
      });
    }
  }, [setup]);

  const handle_logo_upload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      toast({
        title: "Formato non valido",
        description: "Carica un file immagine (PNG, JPG, SVG)",
        variant: "destructive",
      });
      return;
    }
    set_uploading_logo(true);
    try {
      const ext = file.name.split(".").pop();
      const path = `${DEMO_CLUB_ID}/logo.${ext}`;
      const { error: upload_error } = await supabase.storage.from("loghi-club").upload(path, file, { upsert: true });
      if (upload_error) throw upload_error;

      const { data: url_data } = supabase.storage.from("loghi-club").getPublicUrl(path);
      const logo_url = url_data.publicUrl;

      set_logo_preview(logo_url);
      set_club_form((prev) => ({ ...prev, logo_url }));
      toast({ title: "✅ Logo caricato correttamente" });
    } catch (err: any) {
      toast({ title: "Errore upload logo", description: err?.message, variant: "destructive" });
    } finally {
      set_uploading_logo(false);
    }
  };

  const handle_save = async () => {
    set_saving(true);
    try {
      // Salva dati club
      const { error: club_error } = await supabase
        .from("clubs")
        .update({
          nome: club_form.nome,
          citta: club_form.citta,
          paese: club_form.paese,
          email: club_form.email,
          telefono: club_form.telefono,
          indirizzo: club_form.indirizzo,
          sito_web: club_form.sito_web,
          numero_tessera_federale: club_form.numero_tessera_federale,
          colore_primario: club_form.colore_primario,
          descrizione: club_form.descrizione,
          logo_url: club_form.logo_url,
        })
        .eq("id", DEMO_CLUB_ID);
      if (club_error) throw club_error;

      // Salva parametri setup
      const { error: setup_error } = await supabase.from("setup_club").upsert(
        {
          club_id: DEMO_CLUB_ID,
          max_lezioni_private_contemporanee: Number(setup_form.max_lezioni_private_contemporanee) || 3,
          max_atlete_lezione_condivisa: Number(setup_form.max_atlete_lezione_condivisa) || 4,
          slot_lezione_privata_minuti: Number(setup_form.slot_lezione_privata_minuti) || 20,
        },
        { onConflict: "club_id" },
      );
      if (setup_error) throw setup_error;

      toast({ title: "✅ Configurazione salvata correttamente" });
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

  const atleti_attivi = atleti.filter((a: any) => a.stato === "attivo").length;
  const istruttori_attivi = istruttori.filter((i: any) => i.stato === "attivo").length;

  return (
    <div className="space-y-6 animate-fade-in">
      <h1 className="text-xl font-bold tracking-tight text-foreground">{t("setup_club")}</h1>

      {/* Statistiche live */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
        <div className="bg-card rounded-xl shadow-card p-4 flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center">
            <Users className="w-4 h-4 text-primary" />
          </div>
          <div>
            <p className="text-2xl font-bold text-foreground tabular-nums">{atleti_attivi}</p>
            <p className="text-xs text-muted-foreground">Atleti attivi</p>
          </div>
        </div>
        <div className="bg-card rounded-xl shadow-card p-4 flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center">
            <UserCheck className="w-4 h-4 text-primary" />
          </div>
          <div>
            <p className="text-2xl font-bold text-foreground tabular-nums">{istruttori_attivi}</p>
            <p className="text-xs text-muted-foreground">Istruttori attivi</p>
          </div>
        </div>
        <div className="bg-card rounded-xl shadow-card p-4 flex items-center gap-3 col-span-2 sm:col-span-1">
          <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center">
            <Calendar className="w-4 h-4 text-primary" />
          </div>
          <div>
            <p className="text-sm font-bold text-foreground truncate">{stagione_attiva?.nome || "—"}</p>
            <p className="text-xs text-muted-foreground">Stagione attiva</p>
          </div>
        </div>
      </div>

      <div className="bg-card rounded-xl shadow-card p-6 space-y-8 max-w-2xl">
        {/* Logo */}
        <section className="space-y-4">
          <h2 className="text-sm font-bold text-muted-foreground uppercase tracking-widest">Logo Club</h2>
          <div className="flex items-center gap-5">
            <div className="w-20 h-20 rounded-xl border-2 border-dashed border-border bg-muted/30 flex items-center justify-center overflow-hidden flex-shrink-0">
              {logo_preview ? (
                <img src={logo_preview} alt="Logo club" className="w-full h-full object-contain p-1" />
              ) : (
                <Upload className="w-6 h-6 text-muted-foreground" />
              )}
            </div>
            <div className="space-y-2">
              <p className="text-sm text-muted-foreground">PNG, JPG o SVG — max 50MB</p>
              <Button
                variant="outline"
                size="sm"
                onClick={() => file_input_ref.current?.click()}
                disabled={uploading_logo}
              >
                {uploading_logo ? (
                  <span className="flex items-center gap-2">
                    <span className="animate-spin rounded-full h-3 w-3 border-b-2 border-primary" />
                    Carico...
                  </span>
                ) : (
                  <>
                    <Upload className="w-3.5 h-3.5 mr-1.5" />
                    {logo_preview ? "Cambia logo" : "Carica logo"}
                  </>
                )}
              </Button>
              <input
                ref={file_input_ref}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handle_logo_upload}
              />
            </div>
          </div>
        </section>

        <Separator />

        {/* Dati club */}
        <section className="space-y-4">
          <h2 className="text-sm font-bold text-muted-foreground uppercase tracking-widest">{t("dati_club")}</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Field label={t("nome")} icon={<Hash className="w-3.5 h-3.5" />}>
              <Input
                value={club_form.nome || ""}
                onChange={(e) => set_club_form((p) => ({ ...p, nome: e.target.value }))}
              />
            </Field>
            <Field label="Tessera federale" icon={<Hash className="w-3.5 h-3.5" />}>
              <Input
                value={club_form.numero_tessera_federale || ""}
                onChange={(e) => set_club_form((p) => ({ ...p, numero_tessera_federale: e.target.value }))}
                placeholder="es. ISF-12345"
              />
            </Field>
            <Field label={t("email")} icon={<Mail className="w-3.5 h-3.5" />}>
              <Input
                type="email"
                value={club_form.email || ""}
                onChange={(e) => set_club_form((p) => ({ ...p, email: e.target.value }))}
              />
            </Field>
            <Field label={t("telefono")} icon={<Phone className="w-3.5 h-3.5" />}>
              <Input
                value={club_form.telefono || ""}
                onChange={(e) => set_club_form((p) => ({ ...p, telefono: e.target.value }))}
              />
            </Field>
            <Field label="Sito web" icon={<Globe className="w-3.5 h-3.5" />}>
              <Input
                value={club_form.sito_web || ""}
                onChange={(e) => set_club_form((p) => ({ ...p, sito_web: e.target.value }))}
                placeholder="https://..."
              />
            </Field>
            <Field label="Colore primario" icon={<Palette className="w-3.5 h-3.5" />}>
              <div className="flex items-center gap-2 mt-1">
                <input
                  type="color"
                  value={club_form.colore_primario || "#3B82F6"}
                  onChange={(e) => set_club_form((p) => ({ ...p, colore_primario: e.target.value }))}
                  className="w-10 h-9 rounded-lg border border-border cursor-pointer p-0.5 bg-background"
                />
                <Input
                  value={club_form.colore_primario || "#3B82F6"}
                  onChange={(e) => set_club_form((p) => ({ ...p, colore_primario: e.target.value }))}
                  className="flex-1 font-mono text-sm"
                  placeholder="#3B82F6"
                />
              </div>
            </Field>
          </div>

          <Field label="Indirizzo / Sede" icon={<MapPin className="w-3.5 h-3.5" />}>
            <Input
              value={club_form.indirizzo || ""}
              onChange={(e) => set_club_form((p) => ({ ...p, indirizzo: e.target.value }))}
              placeholder="es. Via della Pista 1, Ascona"
            />
          </Field>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Field label={t("citta")} icon={<MapPin className="w-3.5 h-3.5" />}>
              <Input
                value={club_form.citta || ""}
                onChange={(e) => set_club_form((p) => ({ ...p, citta: e.target.value }))}
              />
            </Field>
            <Field label={t("paese")} icon={<Globe className="w-3.5 h-3.5" />}>
              <Input
                value={club_form.paese || ""}
                onChange={(e) => set_club_form((p) => ({ ...p, paese: e.target.value }))}
              />
            </Field>
          </div>

          <Field label="Descrizione club">
            <textarea
              value={club_form.descrizione || ""}
              onChange={(e) => set_club_form((p) => ({ ...p, descrizione: e.target.value }))}
              rows={3}
              placeholder="Breve descrizione del club..."
              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-primary/40 mt-1"
            />
          </Field>
        </section>

        <Separator />

        {/* Parametri stagione */}
        <section className="space-y-4">
          <h2 className="text-sm font-bold text-muted-foreground uppercase tracking-widest">
            {t("parametri_stagione")}
          </h2>
          {stagione_attiva ? (
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="sm:col-span-1">
                <Label className="text-xs text-muted-foreground">Nome stagione</Label>
                <Input
                  defaultValue={stagione_attiva.nome}
                  readOnly
                  className="mt-1 bg-muted/30 text-muted-foreground"
                />
              </div>
              <div>
                <Label className="text-xs text-muted-foreground">{t("data_inizio")}</Label>
                <Input
                  defaultValue={stagione_attiva.data_inizio}
                  readOnly
                  className="mt-1 bg-muted/30 text-muted-foreground"
                />
              </div>
              <div>
                <Label className="text-xs text-muted-foreground">{t("data_fine")}</Label>
                <Input
                  defaultValue={stagione_attiva.data_fine}
                  readOnly
                  className="mt-1 bg-muted/30 text-muted-foreground"
                />
              </div>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground italic">
              Nessuna stagione attiva. Vai in Stagioni per configurarla.
            </p>
          )}
          <p className="text-xs text-muted-foreground">
            Per modificare la stagione vai nella sezione <strong>Stagioni</strong>.
          </p>
        </section>

        <Separator />

        {/* Parametri lezioni private */}
        <section className="space-y-4">
          <h2 className="text-sm font-bold text-muted-foreground uppercase tracking-widest">
            {t("parametri_lezioni")}
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <Label className="text-xs text-muted-foreground">{t("max_lezioni")}</Label>
              <Input
                type="number"
                min={1}
                value={setup_form.max_lezioni_private_contemporanee ?? 3}
                onChange={(e) => set_setup_form((p) => ({ ...p, max_lezioni_private_contemporanee: e.target.value }))}
                className="mt-1"
              />
            </div>
            <div>
              <Label className="text-xs text-muted-foreground">{t("max_atlete")}</Label>
              <Input
                type="number"
                min={1}
                value={setup_form.max_atlete_lezione_condivisa ?? 4}
                onChange={(e) => set_setup_form((p) => ({ ...p, max_atlete_lezione_condivisa: e.target.value }))}
                className="mt-1"
              />
            </div>
            <div>
              <Label className="text-xs text-muted-foreground">{t("durata_slot")}</Label>
              <Input
                type="number"
                min={5}
                step={5}
                value={setup_form.slot_lezione_privata_minuti ?? 20}
                onChange={(e) => set_setup_form((p) => ({ ...p, slot_lezione_privata_minuti: e.target.value }))}
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

// Helper component
const Field: React.FC<{
  label: string;
  icon?: React.ReactNode;
  children: React.ReactNode;
}> = ({ label, icon, children }) => (
  <div>
    <Label className="text-xs text-muted-foreground flex items-center gap-1.5 mb-1">
      {icon && <span className="text-muted-foreground/60">{icon}</span>}
      {label}
    </Label>
    {children}
  </div>
);

export default ClubSetupPage;
