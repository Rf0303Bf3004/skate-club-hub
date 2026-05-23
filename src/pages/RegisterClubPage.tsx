import { useState } from "react";
import { useTranslation } from "react-i18next";
import { supabase } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";

const CANTONI = [
  "AG","AI","AR","BE","BL","BS","FR","GE","GL","GR","JU","LU","NE","NW","OW",
  "SG","SH","SO","SZ","TG","TI","UR","VD","VS","ZG","ZH",
];

const FEDERAZIONI = ["FSP", "ISU", "altro", "nessuna"];

export default function RegisterClubPage() {
  const { t } = useTranslation(['onboarding', 'common']);
  const [loading, setLoading] = useState(false);
  const [accettaTermini, setAccettaTermini] = useState(false);
  const [form, setForm] = useState({
    nome_club: "",
    sigla: "",
    cantone: "",
    citta: "",
    federazione: "",
    federazione_altro: "",
    email_presidente: "",
    password: "",
    password_conferma: "",
    nome_presidente: "",
    cognome_presidente: "",
    telefono: "",
  });

  const update = (k: string, v: string) => setForm((f) => ({ ...f, [k]: v }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.citta.trim()) { toast.error(t('register.errors.city_required')); return; }
    if (!form.federazione) { toast.error(t('register.errors.federation_required')); return; }
    if (form.federazione === "altro" && !form.federazione_altro.trim()) {
      toast.error(t('register.errors.federation_other_required')); return;
    }
    if (form.password.length < 8) { toast.error(t('register.errors.password_min')); return; }
    if (form.password !== form.password_conferma) { toast.error(t('register.errors.passwords_mismatch')); return; }
    if (!accettaTermini) { toast.error(t('register.errors.terms_required')); return; }

    const federazione_finale =
      form.federazione === "altro" ? form.federazione_altro.trim() :
      form.federazione === "nessuna" ? "" : form.federazione;

    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("register-club", {
        body: {
          nome_club: form.nome_club,
          sigla: form.sigla,
          cantone: form.cantone,
          citta: form.citta,
          federazione: federazione_finale,
          email_presidente: form.email_presidente,
          password: form.password,
          nome_presidente: form.nome_presidente,
          cognome_presidente: form.cognome_presidente,
          telefono: form.telefono,
        },
      });
      if (error || (data as any)?.error) {
        toast.error((data as any)?.error || error?.message || t('register.errors.register_failed'));
        setLoading(false);
        return;
      }
      const { error: loginErr } = await supabase.auth.signInWithPassword({
        email: form.email_presidente.trim().toLowerCase(),
        password: form.password,
      });
      if (loginErr) { toast.error(loginErr.message); setLoading(false); return; }
      toast.success(t('register.success_created'));
      window.location.href = "/onboarding";
    } catch (err) {
      toast.error(String(err));
      setLoading(false);
    }
  };

  // Helper per label "campo *"
  const lbl = (key: string, required = false) => `${t(`register.fields.${key}`)}${required ? ' *' : ''}`;

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="w-full max-w-2xl">
        <CardHeader>
          <CardTitle>{t('register.title')}</CardTitle>
          <CardDescription>{t('register.subtitle')}</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid md:grid-cols-2 gap-4">
              <div className="md:col-span-2">
                <Label>{lbl('club_name', true)}</Label>
                <Input required value={form.nome_club} onChange={(e) => update("nome_club", e.target.value)} />
              </div>
              <div>
                <Label>{lbl('club_sigla')}</Label>
                <Input maxLength={10} value={form.sigla} onChange={(e) => update("sigla", e.target.value)} />
              </div>
              <div>
                <Label>{lbl('canton')}</Label>
                <select
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  value={form.cantone}
                  onChange={(e) => update("cantone", e.target.value)}
                >
                  <option value="">—</option>
                  {CANTONI.map((c) => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
              <div>
                <Label>{lbl('city', true)}</Label>
                <Input required value={form.citta} onChange={(e) => update("citta", e.target.value)} />
              </div>
              <div>
                <Label>{lbl('federation', true)}</Label>
                <select
                  required
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  value={form.federazione}
                  onChange={(e) => update("federazione", e.target.value)}
                >
                  <option value="">{t('register.fields.federation_select_hint')}</option>
                  {FEDERAZIONI.map((f) => <option key={f} value={f}>{f}</option>)}
                </select>
              </div>
              {form.federazione === "altro" && (
                <div className="md:col-span-2">
                  <Label>{lbl('federation_other', true)}</Label>
                  <Input
                    required
                    value={form.federazione_altro}
                    onChange={(e) => update("federazione_altro", e.target.value)}
                  />
                </div>
              )}
              <hr className="md:col-span-2 my-2" />
              <div>
                <Label>{lbl('president_name', true)}</Label>
                <Input required value={form.nome_presidente} onChange={(e) => update("nome_presidente", e.target.value)} />
              </div>
              <div>
                <Label>{lbl('president_surname', true)}</Label>
                <Input required value={form.cognome_presidente} onChange={(e) => update("cognome_presidente", e.target.value)} />
              </div>
              <div>
                <Label>{lbl('email', true)}</Label>
                <Input type="email" required value={form.email_presidente} onChange={(e) => update("email_presidente", e.target.value)} />
              </div>
              <div>
                <Label>{lbl('phone')}</Label>
                <Input value={form.telefono} onChange={(e) => update("telefono", e.target.value)} />
              </div>
              <div>
                <Label>{lbl('password', true)}</Label>
                <Input type="password" required minLength={8} value={form.password} onChange={(e) => update("password", e.target.value)} />
              </div>
              <div>
                <Label>{lbl('password_confirm', true)}</Label>
                <Input type="password" required minLength={8} value={form.password_conferma} onChange={(e) => update("password_conferma", e.target.value)} />
              </div>
            </div>

            <div className="flex items-start gap-2 pt-2">
              <Checkbox
                id="termini"
                checked={accettaTermini}
                onCheckedChange={(v) => setAccettaTermini(v === true)}
              />
              <label htmlFor="termini" className="text-sm text-muted-foreground leading-tight cursor-pointer">
                {t('register.accept_terms_prefix')}{' '}
                <a className="text-primary underline" href="/termini" target="_blank" rel="noreferrer">{t('register.accept_terms_link')}</a>{' '}
                {t('register.accept_terms_middle')}
                <a className="text-primary underline" href="/privacy" target="_blank" rel="noreferrer">{t('register.accept_privacy_link')}</a>.
              </label>
            </div>

            <Button type="submit" disabled={loading} className="w-full">
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {t('register.submit')}
            </Button>
            <p className="text-center text-sm text-muted-foreground">
              {t('register.already_have_account')} <a href="/" className="text-primary underline">{t('register.sign_in')}</a>
            </p>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
