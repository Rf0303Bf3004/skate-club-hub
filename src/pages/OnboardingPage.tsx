import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { toast } from "sonner";
import { Loader2, ArrowLeft, ArrowRight, Plus, Trash2, Upload } from "lucide-react";
import { useNavigate } from "react-router-dom";

interface CorsoDraft {
  nome: string;
  livello_richiesto: string;
  costo_mensile: string;
  capienza_max: string;
}

interface StaffDraft {
  nome: string;
  cognome: string;
  email: string;
  ruolo: "istruttore" | "segreteria" | "dt";
}

interface SlotGhiaccio {
  giorno: string;
  ora_inizio: string;
  ora_fine: string;
}

const GIORNI = ["Lunedì","Martedì","Mercoledì","Giovedì","Venerdì","Sabato","Domenica"];

export default function OnboardingPage() {
  const { session } = useAuth();
  const navigate = useNavigate();
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [uploadingLogo, setUploadingLogo] = useState(false);

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

  // Step 3: corsi
  const [corsi, setCorsi] = useState<CorsoDraft[]>([
    { nome: "", livello_richiesto: "", costo_mensile: "", capienza_max: "" },
  ]);

  // Step 4: staff
  const [staff, setStaff] = useState<StaffDraft[]>([]);

  // Step 5: disponibilità ghiaccio
  const [slots, setSlots] = useState<SlotGhiaccio[]>([
    { giorno: "Lunedì", ora_inizio: "17:00", ora_fine: "20:00" },
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
    if (file.size > 5 * 1024 * 1024) { toast.error("Logo max 5MB"); return; }
    setUploadingLogo(true);
    try {
      const ext = file.name.split(".").pop() || "png";
      const path = `${session.club_id}/logo-${Date.now()}.${ext}`;
      const { error: upErr } = await supabase.storage.from("loghi-club").upload(path, file, { upsert: true });
      if (upErr) { toast.error(upErr.message); return; }
      const { data: pub } = supabase.storage.from("loghi-club").getPublicUrl(path);
      setLogoUrl(pub.publicUrl);
      toast.success("Logo caricato");
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
    const valid = corsi.filter((c) => c.nome.trim());
    if (valid.length === 0) return true;
    setLoading(true);
    const { data: stag } = await supabase
      .from("stagioni").select("id").eq("club_id", session.club_id).eq("attiva", true).maybeSingle();
    const payload = valid.map((c) => ({
      club_id: session.club_id,
      stagione_id: stag?.id ?? null,
      nome: c.nome.trim(),
      livello_richiesto: c.livello_richiesto.trim() || null,
      costo_mensile: c.costo_mensile ? parseFloat(c.costo_mensile) : 0,
      capienza_max: c.capienza_max ? parseInt(c.capienza_max) : null,
      attivo: true,
      tipo: "corso",
    }));
    const { error } = await supabase.from("corsi").insert(payload);
    setLoading(false);
    if (error) { toast.error(error.message); return false; }
    toast.success(`${valid.length} corsi creati`);
    return true;
  };

  const saveStep4 = async () => {
    const valid = staff.filter((s) => s.email.trim() && s.nome.trim() && s.cognome.trim());
    if (valid.length === 0) return true;
    setLoading(true);
    let ok = 0, fail = 0;
    for (const s of valid) {
      const { data, error } = await supabase.functions.invoke("invite-staff", {
        body: {
          club_id: session.club_id,
          email: s.email.trim().toLowerCase(),
          nome: s.nome.trim(),
          cognome: s.cognome.trim(),
          ruolo: s.ruolo,
        },
      });
      if (error || (data as any)?.error) fail++;
      else ok++;
    }
    setLoading(false);
    if (ok) toast.success(`${ok} inviti inviati`);
    if (fail) toast.error(`${fail} inviti falliti`);
    return true;
  };

  const saveStep5 = async () => {
    const valid = slots.filter((s) => s.giorno && s.ora_inizio && s.ora_fine && s.ora_inizio < s.ora_fine);
    if (valid.length === 0) {
      // niente da salvare, OK
      return true;
    }
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
    if (error) { toast.error(`Errore disponibilità: ${error.message}`); return false; }
    toast.success(`${valid.length} slot ghiaccio configurati`);
    return true;
  };

  const finalize = async () => {
    const ok5 = await saveStep5();
    if (!ok5) return;
    setLoading(true);
    const { error } = await supabase
      .from("clubs")
      .update({ onboarding_completato: true })
      .eq("id", session.club_id);
    setLoading(false);
    if (error) { toast.error(error.message); return; }
    toast.success("Onboarding completato! Benvenuto nella tua dashboard.", { duration: 5000 });
    navigate("/", { replace: true });
    window.location.reload();
  };

  const next = async () => {
    let ok = true;
    if (step === 1) ok = await saveStep1();
    else if (step === 2) ok = await saveStep2();
    else if (step === 3) ok = await saveStep3();
    else if (step === 4) ok = await saveStep4();
    if (ok) setStep(step + 1);
  };

  return (
    <div className="min-h-screen bg-background p-4 md:p-8">
      <div className="max-w-3xl mx-auto">
        <div className="mb-6">
          <h1 className="text-2xl font-bold">Benvenuto in Ice Arena</h1>
          <p className="text-muted-foreground">Step {step} di 5</p>
          <div className="mt-3 flex gap-1">
            {[1,2,3,4,5].map((i) => (
              <div key={i} className={`h-2 flex-1 rounded ${i <= step ? "bg-primary" : "bg-muted"}`} />
            ))}
          </div>
        </div>

        <Card>
          {step === 1 && (
            <>
              <CardHeader>
                <CardTitle>Identità del club</CardTitle>
                <CardDescription>Logo, colore, dati base. Tutto modificabile in seguito.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid md:grid-cols-2 gap-4">
                  <div>
                    <Label>Logo club</Label>
                    <div className="flex items-center gap-3 mt-1">
                      {logoUrl ? (
                        <img src={logoUrl} alt="logo" className="h-16 w-16 object-contain rounded border bg-muted" />
                      ) : (
                        <div className="h-16 w-16 rounded border bg-muted flex items-center justify-center text-xs text-muted-foreground">vuoto</div>
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
                          Carica logo
                        </span>
                      </label>
                    </div>
                  </div>
                  <div>
                    <Label>Colore primario</Label>
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
                    <Label>Anno fondazione</Label>
                    <Input type="number" value={identity.anno_fondazione} onChange={(e) => setIdentity({ ...identity, anno_fondazione: e.target.value })} />
                  </div>
                  <div>
                    <Label>Federazione</Label>
                    <Input value={identity.federazione} onChange={(e) => setIdentity({ ...identity, federazione: e.target.value })} placeholder="es. FSP / ISU" />
                  </div>
                  <div className="md:col-span-2">
                    <Label>Mission</Label>
                    <Textarea value={identity.mission} onChange={(e) => setIdentity({ ...identity, mission: e.target.value })} placeholder="In 1-2 frasi, cosa vi distingue" />
                  </div>
                  <div className="md:col-span-2">
                    <Label>Sito web</Label>
                    <Input value={identity.sito_web} onChange={(e) => setIdentity({ ...identity, sito_web: e.target.value })} />
                  </div>
                  <div>
                    <Label>Instagram</Label>
                    <Input value={identity.social_instagram} onChange={(e) => setIdentity({ ...identity, social_instagram: e.target.value })} placeholder="@handle" />
                  </div>
                  <div>
                    <Label>Facebook</Label>
                    <Input value={identity.social_facebook} onChange={(e) => setIdentity({ ...identity, social_facebook: e.target.value })} />
                  </div>
                </div>
              </CardContent>
            </>
          )}

          {step === 2 && (
            <>
              <CardHeader>
                <CardTitle>Prima stagione</CardTitle>
                <CardDescription>Modificabile dalla pagina Stagioni.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label>Nome stagione *</Label>
                  <Input value={stagione.nome} onChange={(e) => setStagione({ ...stagione, nome: e.target.value })} />
                </div>
                <div className="grid md:grid-cols-2 gap-4">
                  <div>
                    <Label>Data inizio *</Label>
                    <Input type="date" value={stagione.data_inizio} onChange={(e) => setStagione({ ...stagione, data_inizio: e.target.value })} />
                  </div>
                  <div>
                    <Label>Data fine *</Label>
                    <Input type="date" value={stagione.data_fine} onChange={(e) => setStagione({ ...stagione, data_fine: e.target.value })} />
                  </div>
                </div>
              </CardContent>
            </>
          )}

          {step === 3 && (
            <>
              <CardHeader>
                <CardTitle>Primi corsi</CardTitle>
                <CardDescription>Aggiungi i corsi principali. Capienza e prezzo modificabili dopo.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {corsi.map((c, i) => (
                  <div key={i} className="grid grid-cols-12 gap-2 items-end">
                    <div className="col-span-4">
                      <Label className={i === 0 ? "" : "sr-only"}>Nome</Label>
                      <Input value={c.nome} onChange={(e) => {
                        const next = [...corsi]; next[i].nome = e.target.value; setCorsi(next);
                      }} />
                    </div>
                    <div className="col-span-3">
                      <Label className={i === 0 ? "" : "sr-only"}>Livello</Label>
                      <Input value={c.livello_richiesto} onChange={(e) => {
                        const next = [...corsi]; next[i].livello_richiesto = e.target.value; setCorsi(next);
                      }} />
                    </div>
                    <div className="col-span-2">
                      <Label className={i === 0 ? "" : "sr-only"}>CHF/mese</Label>
                      <Input type="number" value={c.costo_mensile} onChange={(e) => {
                        const next = [...corsi]; next[i].costo_mensile = e.target.value; setCorsi(next);
                      }} />
                    </div>
                    <div className="col-span-2">
                      <Label className={i === 0 ? "" : "sr-only"}>Capienza</Label>
                      <Input type="number" placeholder="max" value={c.capienza_max} onChange={(e) => {
                        const next = [...corsi]; next[i].capienza_max = e.target.value; setCorsi(next);
                      }} />
                    </div>
                    <div className="col-span-1">
                      <Button variant="ghost" size="icon" onClick={() => setCorsi(corsi.filter((_, j) => j !== i))}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                ))}
                <Button variant="outline" size="sm" onClick={() => setCorsi([...corsi, { nome: "", livello_richiesto: "", costo_mensile: "", capienza_max: "" }])}>
                  <Plus className="h-4 w-4 mr-1" /> Aggiungi corso
                </Button>
              </CardContent>
            </>
          )}

          {step === 4 && (
            <>
              <CardHeader>
                <CardTitle>Invita lo staff</CardTitle>
                <CardDescription>Riceveranno un'email con password temporanea per accedere. Puoi saltare e invitarli dopo da "Utenti".</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {staff.map((s, i) => (
                  <div key={i} className="grid grid-cols-12 gap-2 items-end">
                    <div className="col-span-3">
                      <Label className={i === 0 ? "" : "sr-only"}>Nome</Label>
                      <Input value={s.nome} onChange={(e) => {
                        const next = [...staff]; next[i].nome = e.target.value; setStaff(next);
                      }} />
                    </div>
                    <div className="col-span-3">
                      <Label className={i === 0 ? "" : "sr-only"}>Cognome</Label>
                      <Input value={s.cognome} onChange={(e) => {
                        const next = [...staff]; next[i].cognome = e.target.value; setStaff(next);
                      }} />
                    </div>
                    <div className="col-span-3">
                      <Label className={i === 0 ? "" : "sr-only"}>Email</Label>
                      <Input type="email" value={s.email} onChange={(e) => {
                        const next = [...staff]; next[i].email = e.target.value; setStaff(next);
                      }} />
                    </div>
                    <div className="col-span-2">
                      <Label className={i === 0 ? "" : "sr-only"}>Ruolo</Label>
                      <select
                        className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                        value={s.ruolo}
                        onChange={(e) => {
                          const next = [...staff]; next[i].ruolo = e.target.value as StaffDraft["ruolo"]; setStaff(next);
                        }}
                      >
                        <option value="istruttore">Istruttore</option>
                        <option value="segreteria">Segreteria</option>
                        <option value="dt">Direttore Tecnico</option>
                      </select>
                    </div>
                    <div className="col-span-1">
                      <Button variant="ghost" size="icon" onClick={() => setStaff(staff.filter((_, j) => j !== i))}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                ))}
                <Button variant="outline" size="sm" onClick={() => setStaff([...staff, { nome: "", cognome: "", email: "", ruolo: "istruttore" }])}>
                  <Plus className="h-4 w-4 mr-1" /> Aggiungi membro
                </Button>
              </CardContent>
            </>
          )}

          {step === 5 && (
            <>
              <CardHeader>
                <CardTitle>Disponibilità ghiaccio settimanale</CardTitle>
                <CardDescription>Indica gli slot ricorrenti di disponibilità della pista. Modificabili da Configurazione Club.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {slots.map((s, i) => (
                  <div key={i} className="grid grid-cols-12 gap-2 items-end">
                    <div className="col-span-5">
                      <Label className={i === 0 ? "" : "sr-only"}>Giorno</Label>
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
                      <Label className={i === 0 ? "" : "sr-only"}>Inizio</Label>
                      <Input type="time" value={s.ora_inizio} onChange={(e) => {
                        const next = [...slots]; next[i].ora_inizio = e.target.value; setSlots(next);
                      }} />
                    </div>
                    <div className="col-span-3">
                      <Label className={i === 0 ? "" : "sr-only"}>Fine</Label>
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
                <Button variant="outline" size="sm" onClick={() => setSlots([...slots, { giorno: "Lunedì", ora_inizio: "17:00", ora_fine: "20:00" }])}>
                  <Plus className="h-4 w-4 mr-1" /> Aggiungi slot
                </Button>
                <p className="text-xs text-muted-foreground pt-2">
                  Puoi saltare lasciando la lista vuota e configurare dopo.
                </p>
              </CardContent>
            </>
          )}

          <div className="flex justify-between p-6 border-t">
            <Button variant="outline" disabled={step === 1 || loading} onClick={() => setStep(step - 1)}>
              <ArrowLeft className="h-4 w-4 mr-1" /> Indietro
            </Button>
            {step < 5 ? (
              <Button onClick={next} disabled={loading}>
                {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Avanti <ArrowRight className="h-4 w-4 ml-1" />
              </Button>
            ) : (
              <Button onClick={finalize} disabled={loading}>
                {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Completa onboarding
              </Button>
            )}
          </div>
        </Card>
      </div>
    </div>
  );
}
