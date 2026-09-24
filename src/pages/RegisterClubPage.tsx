import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { codice_errore_edge } from "@/lib/errore-edge";
import { segnala_errore } from "@/lib/errori";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";

type PaeseIso = "CH" | "IT";

interface RigaCap {
  localita: string;
  cantone: string;
}

const CAP_SVIZZERO = /^\d{4}$/;

export default function RegisterClubPage() {
  const { t } = useTranslation(["onboarding", "common"]);
  const [loading, setLoading] = useState(false);
  const [accettaTermini, setAccettaTermini] = useState(false);
  const [form, setForm] = useState({
    nome_club: "",
    paese_iso: "CH" as PaeseIso,
    cap: "",
    localita: "",
    cantone: "",
    provincia: "",
    email_presidente: "",
    password: "",
    password_conferma: "",
    nome_presidente: "",
    cognome_presidente: "",
  });

  const update = (k: keyof typeof form, v: string) => setForm((f) => ({ ...f, [k]: v }));

  // Ricerca CAP: parte solo con 4 cifre (controllo di validità, regola 4).
  const cap_pulito = form.cap.trim();
  const cerca_attiva = form.paese_iso === "CH" && CAP_SVIZZERO.test(cap_pulito);
  const ricerca_cap = useQuery({
    queryKey: ["cerca_cap", cap_pulito],
    enabled: cerca_attiva,
    retry: 1,
    staleTime: 60 * 60 * 1000,
    queryFn: async (): Promise<RigaCap[]> => {
      const { data, error } = await supabase.rpc("cerca_cap", { p_cap: cap_pulito });
      if (error) throw error;
      return (data ?? []) as RigaCap[];
    },
  });

  useEffect(() => {
    if (ricerca_cap.isError) {
      void segnala_errore("RegisterClubPage", t("register.cap.error"), ricerca_cap.error, { cap: cap_pulito }, "avviso");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ricerca_cap.isError]);

  const righe_cap = cerca_attiva && ricerca_cap.isSuccess ? ricerca_cap.data : null;
  const cap_trovato = !!righe_cap && righe_cap.length > 0;
  const cap_non_trovato = !!righe_cap && righe_cap.length === 0;
  const cap_in_attesa = cerca_attiva && !ricerca_cap.isSuccess && !ricerca_cap.isError;
  const cap_guasto = cerca_attiva && ricerca_cap.isError;
  const localita_proposte = cap_trovato ? Array.from(new Set(righe_cap.map((r) => r.localita))) : [];

  // Riempie località e cantone quando arriva la risposta (in un effetto, non nella queryFn).
  useEffect(() => {
    if (!righe_cap || righe_cap.length === 0) return;
    setForm((f) => ({ ...f, localita: righe_cap[0].localita, cantone: righe_cap[0].cantone }));
  }, [righe_cap]);

  const cambia_paese = (p: PaeseIso) =>
    setForm((f) => ({ ...f, paese_iso: p, cap: "", localita: "", cantone: "", provincia: "" }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const ch = form.paese_iso === "CH";
    if (!cap_pulito) { toast.error(t("register.errors.cap_required")); return; }
    if (ch && cap_in_attesa) { toast.error(t("register.errors.cap_pending")); return; }
    if (!form.localita.trim()) { toast.error(t("register.errors.city_required")); return; }
    if (ch && !form.cantone.trim()) { toast.error(t("register.errors.canton_required")); return; }
    if (!ch && !form.provincia.trim()) { toast.error(t("register.errors.province_required")); return; }
    if (form.password.length < 8) { toast.error(t("register.errors.password_min")); return; }
    if (form.password !== form.password_conferma) { toast.error(t("register.errors.passwords_mismatch")); return; }
    if (!accettaTermini) { toast.error(t("register.errors.terms_required")); return; }

    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("register-club", {
        body: {
          nome_club: form.nome_club,
          paese_iso: form.paese_iso,
          cap: cap_pulito,
          citta: form.localita,
          cantone: ch ? form.cantone.trim().toUpperCase() : "",
          provincia: ch ? "" : form.provincia,
          email_presidente: form.email_presidente,
          password: form.password,
          nome_presidente: form.nome_presidente,
          cognome_presidente: form.cognome_presidente,
        },
      });
      if (error || (data as { error?: unknown } | null)?.error) {
        const codice = (await codice_errore_edge(data, error)) ?? "";
        const chiave = /weak|easy to guess|pwned/i.test(codice)
          ? "register.errors.password_weak"
          : /already (been )?registered|already exists|già associato/i.test(codice)
            ? "register.errors.email_exists"
            : "register.errors.register_failed";
        toast.error(t(chiave));
        setLoading(false);
        return;
      }
      const { error: loginErr } = await supabase.auth.signInWithPassword({
        email: form.email_presidente.trim().toLowerCase(),
        password: form.password,
      });
      if (loginErr) { toast.error(t("register.errors.register_failed")); setLoading(false); return; }
      toast.success(t("register.success_created"));
      window.location.href = "/onboarding";
    } catch (err) {
      console.error(err);
      toast.error(t("register.errors.register_failed"));
      setLoading(false);
    }
  };

  const lbl = (key: string, required = false) => `${t(`register.fields.${key}`)}${required ? " *" : ""}`;
  const ch = form.paese_iso === "CH";
  const cantone_manuale = cap_non_trovato || cap_guasto;

  return (
    <div className="min-h-mobile flex items-center justify-center bg-background p-4">
      <Card className="w-full max-w-2xl">
        <CardHeader>
          <CardTitle>{t("register.title")}</CardTitle>
          <CardDescription>{t("register.subtitle")}</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid md:grid-cols-2 gap-4">
              <div className="md:col-span-2">
                <Label>{lbl("club_name", true)}</Label>
                <Input required value={form.nome_club} onChange={(e) => update("nome_club", e.target.value)} />
              </div>
              <div className="md:col-span-2">
                <Label>{lbl("country", true)}</Label>
                <select
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  value={form.paese_iso}
                  onChange={(e) => cambia_paese(e.target.value as PaeseIso)}
                >
                  <option value="CH">{t("register.fields.country_ch")}</option>
                  <option value="IT">{t("register.fields.country_it")}</option>
                </select>
              </div>
              <div>
                <Label>{lbl("cap", true)}</Label>
                <Input
                  required
                  inputMode="numeric"
                  maxLength={ch ? 4 : 5}
                  value={form.cap}
                  onChange={(e) => {
                    const nuovo = e.target.value.replace(/\D/g, "");
                    // Un CAP nuovo invalida località e cantone del precedente.
                    setForm((f) => (nuovo === f.cap ? f : { ...f, cap: nuovo, localita: "", cantone: "" }));
                  }}
                />
              </div>
              <div>
                <Label>{lbl("locality", true)}</Label>
                <Input
                  required
                  list={localita_proposte.length > 1 ? "localita-cap" : undefined}
                  value={form.localita}
                  onChange={(e) => update("localita", e.target.value)}
                />
                {localita_proposte.length > 1 && (
                  <datalist id="localita-cap">
                    {localita_proposte.map((l) => <option key={l} value={l} />)}
                  </datalist>
                )}
              </div>
              {ch ? (
                <div>
                  <Label>{lbl("canton", true)}</Label>
                  <Input
                    required
                    maxLength={2}
                    readOnly={!cantone_manuale}
                    className={cantone_manuale ? "" : "bg-muted"}
                    value={form.cantone}
                    onChange={(e) => update("cantone", e.target.value.toUpperCase())}
                  />
                </div>
              ) : (
                <div>
                  <Label>{lbl("province", true)}</Label>
                  <Input required value={form.provincia} onChange={(e) => update("provincia", e.target.value)} />
                </div>
              )}
              {ch && (
                <div className="md:col-span-2 text-xs" aria-live="polite">
                  {cap_in_attesa && (
                    <span className="flex items-center gap-1 text-muted-foreground">
                      <Loader2 className="h-3 w-3 animate-spin" /> {t("register.cap.searching")}
                    </span>
                  )}
                  {cap_trovato && <span className="text-muted-foreground">{t("register.cap.found_hint")}</span>}
                  {cap_non_trovato && <span className="text-muted-foreground">{t("register.cap.not_found")}</span>}
                  {cap_guasto && (
                    <span className="flex flex-wrap items-center gap-2 text-destructive">
                      {t("register.cap.error")}
                      <Button type="button" size="sm" variant="outline" onClick={() => void ricerca_cap.refetch()}>
                        {t("register.cap.retry")}
                      </Button>
                    </span>
                  )}
                </div>
              )}
              <hr className="md:col-span-2 my-2" />
              <div>
                <Label>{lbl("president_name", true)}</Label>
                <Input required value={form.nome_presidente} onChange={(e) => update("nome_presidente", e.target.value)} />
              </div>
              <div>
                <Label>{lbl("president_surname", true)}</Label>
                <Input required value={form.cognome_presidente} onChange={(e) => update("cognome_presidente", e.target.value)} />
              </div>
              <div className="md:col-span-2">
                <Label>{lbl("email", true)}</Label>
                <Input type="email" required autoComplete="email" value={form.email_presidente} onChange={(e) => update("email_presidente", e.target.value)} />
              </div>
              <div>
                <Label>{lbl("password", true)}</Label>
                <Input type="password" required minLength={8} autoComplete="new-password" value={form.password} onChange={(e) => update("password", e.target.value)} />
              </div>
              <div>
                <Label>{lbl("password_confirm", true)}</Label>
                <Input type="password" required minLength={8} autoComplete="new-password" value={form.password_conferma} onChange={(e) => update("password_conferma", e.target.value)} />
              </div>
            </div>

            <div className="flex items-start gap-2 pt-2">
              <Checkbox
                id="termini"
                checked={accettaTermini}
                onCheckedChange={(v) => setAccettaTermini(v === true)}
              />
              <label htmlFor="termini" className="text-sm text-muted-foreground leading-tight cursor-pointer">
                {t("register.accept_terms_prefix")}{" "}
                <a className="text-primary underline" href="/termini" target="_blank" rel="noreferrer">{t("register.accept_terms_link")}</a>{" "}
                {t("register.accept_terms_middle")}
                <a className="text-primary underline" href="/privacy" target="_blank" rel="noreferrer">{t("register.accept_privacy_link")}</a>.
              </label>
            </div>

            <Button type="submit" disabled={loading} className="w-full">
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {t("register.submit")}
            </Button>
            <p className="text-center text-sm text-muted-foreground">
              {t("register.already_have_account")} <a href="/" className="text-primary underline">{t("register.sign_in")}</a>
            </p>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
