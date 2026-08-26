import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { toast } from "sonner";
import { Loader2, ArrowLeft, ArrowRight, Plus, Trash2, Upload, BookOpen, UserPlus, Users, LayoutDashboard } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";

interface SlotGhiaccio {
  giorno: string;
  ora_inizio: string;
  ora_fine: string;
}

const TOTAL_STEPS = 3;

export default function OnboardingPage() {
  const { t } = useTranslation("onboarding");
  const { session } = useAuth();
  const navigate = useNavigate();
  const GIORNI = [
    t("wizard.days.monday"),
    t("wizard.days.tuesday"),
    t("wizard.days.wednesday"),
    t("wizard.days.thursday"),
    t("wizard.days.friday"),
    t("wizard.days.saturday"),
    t("wizard.days.sunday"),
  ];
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [done, setDone] = useState(false);

  // Step 1: identity + brand
  const [identity, setIdentity] = useState({
    anno_fondazione: "",
    federazione: "",
    mission: "",
    sito_web: "",
    social_instagram: "",
    social_facebook: "",
  });
  const [logoUrl, setLogoUrl] = useState<string>("");
  const [coloreSeed, setColoreSeed] = useState<string>("#3B82F6");

  // Step 2: stagione
  const [stagione, setStagione] = useState({
    nome: "",
    data_inizio: "",
    data_fine: "",
  });

  // Step 3: disponibilità ghiaccio
  const [slots, setSlots] = useState<SlotGhiaccio[]>([
    { giorno: GIORNI[0], ora_inizio: "17:00", ora_fine: "20:00" },
  ]);

  useEffect(() => {
    if (!session) return;
    void (async () => {
      const [{ data: stag }, { data: club }, { data: ident }] = await Promise.all([
        supabase.from("stagioni").select("id, nome, data_inizio, data_fine").eq("club_id", session.club_id).eq("attiva", true).maybeSingle(),
        supabase.from("clubs").select("logo_url, colore_primario").eq("id", session.club_id).maybeSingle(),
        supabase.from("club_identity").select("anno_fondazione, federazione, mission, sito_web, social_instagram, social_facebook").eq("club_id", session.club_id).maybeSingle(),
      ]);
      if (stag) setStagione({ nome: stag.nome || "", data_inizio: stag.data_inizio || "", data_fine: stag.data_fine || "" });
      if (club) {
        if (club.logo_url) setLogoUrl(club.logo_url);
        if (club.colore_primario) setColoreSeed(club.colore_primario);
      }
      if (ident) {
        setIdentity({
          anno_fondazione: ident.anno_fondazione ? String(ident.anno_fondazione) : "",
          federazione: ident.federazione || "",
          mission: ident.mission || "",
          sito_web: ident.sito_web || "",
          social_instagram: ident.social_instagram || "",
          social_facebook: ident.social_facebook || "",
        });
      }
    })();
  }, [session]);

  if (!session) return null;

  const handleLogoUpload = async (file: File) => {
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) { toast.error(t("wizard.logo_max_size")); return; }
    setUploadingLogo(true);
    try {
      const ext = file.name.split(".").pop() || "png";
      const path = `${session.club_id}/logo-${Date.now()}.${ext}`;
      const { error: upErr } = await supabase.storage.from("loghi-club").upload(path, file, { upsert: true });
      if (upErr) { toast.error(upErr.message); return; }
      // Pulizia: rimuovi il logo precedente se appartiene alla cartella di questo club.
      // Errori ignorati in silenzio: è pulizia, non deve bloccare il salvataggio.
      try {
        const prev_path = (logoUrl || "").split("?")[0].split("/loghi-club/")[1];
        if (prev_path && prev_path.startsWith(`${session.club_id}/`) && prev_path !== path) {
          await supabase.storage.from("loghi-club").remove([decodeURIComponent(prev_path)]);
        }
      } catch {}
      const { data: pub } = supabase.storage.from("loghi-club").getPublicUrl(path);
      setLogoUrl(pub.publicUrl);
      toast.success(t("wizard.logo_uploaded"));
    } finally {
      setUploadingLogo(false);
    }
  };

  const saveStep1 = async () => {
    setLoading(true);
    const [r1, r2] = await Promise.all([
      supabase.from("club_identity").update({
        anno_fondazione: identity.anno_fondazione ? parseInt(identity.anno_fondazione) : null,
        federazione: identity.federazione || null,
        mission: identity.mission || null,
        sito_web: identity.sito_web || null,
        social_instagram: identity.social_instagram || null,
        social_facebook: identity.social_facebook || null,
      }).eq("club_id", session.club_id),
      supabase.from("clubs").update({
        logo_url: logoUrl || null,
        colore_primario: coloreSeed || null,
      }).eq("id", session.club_id),
    ]);
    setLoading(false);
    if (r1.error) { toast.error(r1.error.message); return false; }
    if (r2.error) { toast.error(r2.error.message); return false; }
    return true;
  };

  const saveStep2 = async () => {
    setLoading(true);
    const { error } = await supabase
      .from("stagioni")
      .update({
        nome: stagione.nome,
        data_inizio: stagione.data_inizio,
        data_fine: stagione.data_fine,
      })
      .eq("club_id", session.club_id)
      .eq("attiva", true);
    setLoading(false);
    if (error) { toast.error(error.message); return false; }
    return true;
  };

  const saveStep3 = async () => {
    const valid = slots.filter((s) => s.giorno && s.ora_inizio && s.ora_fine && s.ora_inizio < s.ora_fine);
    if (valid.length === 0) return true;
    setLoading(true);
    const { data: stag } = await supabase
      .from("stagioni").select("id").eq("club_id", session.club_id).eq("attiva", true).maybeSingle();
    const payload = valid.map((s) => ({
      club_id: session.club_id,
      stagione_id: stag?.id ?? null,
      giorno: s.giorno,
      ora_inizio: s.ora_inizio,
      ora_fine: s.ora_fine,
      tipo: "ghiaccio",
    }));
    const { error } = await supabase.from("disponibilita_ghiaccio").insert(payload);
    setLoading(false);
    if (error) { toast.error(t("wizard.availability_error", { message: error.message })); return false; }
    toast.success(t("wizard.slots_configured", { count: valid.length }));
    return true;
  };

  const next = async () => {
    let ok = true;
    if (step === 1) ok = await saveStep1();
    else if (step === 2) ok = await saveStep2();
    else if (step === 3) {
      ok = await saveStep3();
      if (ok) { setDone(true); return; }
    }
    if (ok) setStep(step + 1);
  };

  const completeAndGo = async (to: string) => {
    setLoading(true);
    const { error } = await supabase
      .from("clubs")
      .update({ onboarding_completato: true })
      .eq("id", session.club_id);
    setLoading(false);
    if (error) { toast.error(error.message); return; }
    toast.success(t("wizard.onboarding_completed"));
    navigate(to, { replace: true });
    if (to === "/") window.location.reload();
  };

  if (done) {
    return (
      <div className="min-h-screen bg-background p-4 md:p-8">
        <div className="max-w-3xl mx-auto">
          <div className="mb-6 text-center">
            <h1 className="text-3xl font-bold">{t("wizard.done.title")}</h1>
            <p className="text-muted-foreground mt-2">{t("wizard.done.subtitle")}</p>
          </div>
          <div className="grid md:grid-cols-3 gap-4">
            <button onClick={() => completeAndGo("/corsi")} disabled={loading} className="text-left">
              <Card className="h-full hover:border-primary transition-colors cursor-pointer">
                <CardHeader>
                  <BookOpen className="h-8 w-8 text-primary mb-2" />
                  <CardTitle className="text-lg">{t("wizard.done.create_course_title")}</CardTitle>
                  <CardDescription>{t("wizard.done.create_course_desc")}</CardDescription>
                </CardHeader>
              </Card>
            </button>
            <button onClick={() => completeAndGo("/utenti")} disabled={loading} className="text-left">
              <Card className="h-full hover:border-primary transition-colors cursor-pointer">
                <CardHeader>
                  <UserPlus className="h-8 w-8 text-primary mb-2" />
                  <CardTitle className="text-lg">{t("wizard.done.invite_instructor_title")}</CardTitle>
                  <CardDescription>{t("wizard.done.invite_instructor_desc")}</CardDescription>
                </CardHeader>
              </Card>
            </button>
            <button onClick={() => completeAndGo("/import-atleti")} disabled={loading} className="text-left">
              <Card className="h-full hover:border-primary transition-colors cursor-pointer">
                <CardHeader>
                  <Users className="h-8 w-8 text-primary mb-2" />
                  <CardTitle className="text-lg">{t("wizard.done.import_athletes_title")}</CardTitle>
                  <CardDescription>{t("wizard.done.import_athletes_desc")}</CardDescription>
                </CardHeader>
              </Card>
            </button>
          </div>
          <div className="mt-6 flex justify-center">
            <Button variant="outline" onClick={() => completeAndGo("/")} disabled={loading}>
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              <LayoutDashboard className="h-4 w-4 mr-2" /> {t("wizard.done.go_to_dashboard")}
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background p-4 md:p-8">
      <div className="max-w-3xl mx-auto">
        <div className="mb-6">
          <h1 className="text-2xl font-bold">{t("wizard.welcome_title")}</h1>
          <p className="text-muted-foreground">{t("wizard.step_of", { step, total: TOTAL_STEPS })}</p>
          <div className="mt-3 flex gap-1">
            {Array.from({ length: TOTAL_STEPS }, (_, i) => i + 1).map((i) => (
              <div key={i} className={`h-2 flex-1 rounded ${i <= step ? "bg-primary" : "bg-muted"}`} />
            ))}
          </div>
        </div>

        <Card>
          {step === 1 && (
            <>
              <CardHeader>
                <CardTitle>{t("wizard.step1.title")}</CardTitle>
                <CardDescription>{t("wizard.step1.subtitle")}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid md:grid-cols-2 gap-4">
                  <div>
                    <Label>{t("wizard.step1.logo_label")}</Label>
                    <div className="flex items-center gap-3 mt-1">
                      {logoUrl ? (
                        <img src={logoUrl} alt="logo" className="h-16 w-16 object-contain rounded border bg-muted" />
                      ) : (
                        <div className="h-16 w-16 rounded border bg-muted flex items-center justify-center text-xs text-muted-foreground">{t("wizard.step1.logo_empty")}</div>
                      )}
                      <label className="cursor-pointer">
                        <input
                          type="file"
                          accept="image/*"
                          className="hidden"
                          onChange={(e) => e.target.files?.[0] && handleLogoUpload(e.target.files[0])}
                        />
                        <span className="inline-flex items-center gap-1 px-3 py-2 text-sm rounded-md border hover:bg-accent">
                          {uploadingLogo ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
                          {t("wizard.step1.logo_upload_button")}
                        </span>
                      </label>
                    </div>
                  </div>
                  <div>
                    <Label>{t("wizard.step1.primary_color_label")}</Label>
                    <div className="flex items-center gap-2 mt-1">
                      <input
                        type="color"
                        value={coloreSeed}
                        onChange={(e) => setColoreSeed(e.target.value)}
                        className="h-10 w-16 rounded border cursor-pointer bg-background"
                      />
                      <Input value={coloreSeed} onChange={(e) => setColoreSeed(e.target.value)} className="font-mono" />
                    </div>
                  </div>
                  <div>
                    <Label>{t("wizard.step1.founding_year_label")}</Label>
                    <Input type="number" value={identity.anno_fondazione} onChange={(e) => setIdentity({ ...identity, anno_fondazione: e.target.value })} />
                  </div>
                  <div>
                    <Label>{t("wizard.step1.federation_label")}</Label>
                    <Input value={identity.federazione} onChange={(e) => setIdentity({ ...identity, federazione: e.target.value })} placeholder={t("wizard.step1.federation_placeholder")} />
                  </div>
                  <div className="md:col-span-2">
                    <Label>{t("wizard.step1.mission_label")}</Label>
                    <Textarea value={identity.mission} onChange={(e) => setIdentity({ ...identity, mission: e.target.value })} placeholder={t("wizard.step1.mission_placeholder")} />
                  </div>
                  <div className="md:col-span-2">
                    <Label>{t("wizard.step1.website_label")}</Label>
                    <Input value={identity.sito_web} onChange={(e) => setIdentity({ ...identity, sito_web: e.target.value })} />
                  </div>
                  <div>
                    <Label>{t("wizard.step1.instagram_label")}</Label>
                    <Input value={identity.social_instagram} onChange={(e) => setIdentity({ ...identity, social_instagram: e.target.value })} placeholder={t("wizard.step1.instagram_placeholder")} />
                  </div>
                  <div>
                    <Label>{t("wizard.step1.facebook_label")}</Label>
                    <Input value={identity.social_facebook} onChange={(e) => setIdentity({ ...identity, social_facebook: e.target.value })} />
                  </div>
                </div>
              </CardContent>
            </>
          )}

          {step === 2 && (
            <>
              <CardHeader>
                <CardTitle>{t("wizard.step2.title")}</CardTitle>
                <CardDescription>{t("wizard.step2.subtitle")}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label>{t("wizard.step2.season_name_label")}</Label>
                  <Input value={stagione.nome} onChange={(e) => setStagione({ ...stagione, nome: e.target.value })} />
                </div>
                <div className="grid md:grid-cols-2 gap-4">
                  <div>
                    <Label>{t("wizard.step2.start_date_label")}</Label>
                    <Input type="date" value={stagione.data_inizio} onChange={(e) => setStagione({ ...stagione, data_inizio: e.target.value })} />
                  </div>
                  <div>
                    <Label>{t("wizard.step2.end_date_label")}</Label>
                    <Input type="date" value={stagione.data_fine} onChange={(e) => setStagione({ ...stagione, data_fine: e.target.value })} />
                  </div>
                </div>
              </CardContent>
            </>
          )}

          {step === 3 && (
            <>
              <CardHeader>
                <CardTitle>{t("wizard.step3.title")}</CardTitle>
                <CardDescription>{t("wizard.step3.subtitle")}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {slots.map((s, i) => (
                  <div key={i} className="grid grid-cols-12 gap-2 items-end">
                    <div className="col-span-5">
                      <Label className={i === 0 ? "" : "sr-only"}>{t("wizard.step3.day_label")}</Label>
                      <select
                        className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                        value={s.giorno}
                        onChange={(e) => {
                          const next = [...slots]; next[i].giorno = e.target.value; setSlots(next);
                        }}
                      >
                        {GIORNI.map((g) => <option key={g} value={g}>{g}</option>)}
                      </select>
                    </div>
                    <div className="col-span-3">
                      <Label className={i === 0 ? "" : "sr-only"}>{t("wizard.step3.start_label")}</Label>
                      <Input type="time" value={s.ora_inizio} onChange={(e) => {
                        const next = [...slots]; next[i].ora_inizio = e.target.value; setSlots(next);
                      }} />
                    </div>
                    <div className="col-span-3">
                      <Label className={i === 0 ? "" : "sr-only"}>{t("wizard.step3.end_label")}</Label>
                      <Input type="time" value={s.ora_fine} onChange={(e) => {
                        const next = [...slots]; next[i].ora_fine = e.target.value; setSlots(next);
                      }} />
                    </div>
                    <div className="col-span-1">
                      <Button variant="ghost" size="icon" onClick={() => setSlots(slots.filter((_, j) => j !== i))}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                ))}
                <Button variant="outline" size="sm" onClick={() => setSlots([...slots, { giorno: GIORNI[0], ora_inizio: "17:00", ora_fine: "20:00" }])}>
                  <Plus className="h-4 w-4 mr-1" /> {t("wizard.step3.add_slot")}
                </Button>
                <p className="text-xs text-muted-foreground pt-2">
                  {t("wizard.step3.skip_hint")}
                </p>
              </CardContent>
            </>
          )}

          <div className="flex justify-between p-6 border-t">
            <Button variant="outline" disabled={step === 1 || loading} onClick={() => setStep(step - 1)}>
              <ArrowLeft className="h-4 w-4 mr-1" /> {t("wizard.back_button")}
            </Button>
            <Button onClick={next} disabled={loading}>
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {step < TOTAL_STEPS ? <>{t("wizard.next_button")} <ArrowRight className="h-4 w-4 ml-1" /></> : t("wizard.complete_button")}
            </Button>
          </div>
        </Card>
      </div>
    </div>
  );
}
