import { useState } from "react";
import { supabase } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";

const CANTONI = [
  "AG","AI","AR","BE","BL","BS","FR","GE","GL","GR","JU","LU","NE","NW","OW",
  "SG","SH","SO","SZ","TG","TI","UR","VD","VS","ZG","ZH",
];

export default function RegisterClubPage() {
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({
    nome_club: "",
    sigla: "",
    cantone: "",
    citta: "",
    email_presidente: "",
    password: "",
    nome_presidente: "",
    cognome_presidente: "",
    telefono: "",
  });

  const update = (k: string, v: string) => setForm((f) => ({ ...f, [k]: v }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (form.password.length < 8) {
      toast.error("Password minimo 8 caratteri");
      return;
    }
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("register-club", { body: form });
      if (error || (data as any)?.error) {
        toast.error((data as any)?.error || error?.message || "Errore registrazione");
        setLoading(false);
        return;
      }
      // Auto-login
      const { error: loginErr } = await supabase.auth.signInWithPassword({
        email: form.email_presidente.trim().toLowerCase(),
        password: form.password,
      });
      if (loginErr) {
        toast.error(loginErr.message);
        setLoading(false);
        return;
      }
      toast.success("Club creato! Benvenuto.");
      window.location.href = "/onboarding";
    } catch (err) {
      toast.error(String(err));
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="w-full max-w-2xl">
        <CardHeader>
          <CardTitle>Registra il tuo club</CardTitle>
          <CardDescription>
            Crea il tuo spazio Ice Arena in pochi minuti. Il presidente diventa l'amministratore principale.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid md:grid-cols-2 gap-4">
              <div className="md:col-span-2">
                <Label>Nome club *</Label>
                <Input required value={form.nome_club} onChange={(e) => update("nome_club", e.target.value)} />
              </div>
              <div>
                <Label>Sigla (max 10)</Label>
                <Input maxLength={10} value={form.sigla} onChange={(e) => update("sigla", e.target.value)} />
              </div>
              <div>
                <Label>Cantone</Label>
                <select
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  value={form.cantone}
                  onChange={(e) => update("cantone", e.target.value)}
                >
                  <option value="">—</option>
                  {CANTONI.map((c) => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
              <div className="md:col-span-2">
                <Label>Città</Label>
                <Input value={form.citta} onChange={(e) => update("citta", e.target.value)} />
              </div>
              <hr className="md:col-span-2 my-2" />
              <div>
                <Label>Nome presidente *</Label>
                <Input required value={form.nome_presidente} onChange={(e) => update("nome_presidente", e.target.value)} />
              </div>
              <div>
                <Label>Cognome presidente *</Label>
                <Input required value={form.cognome_presidente} onChange={(e) => update("cognome_presidente", e.target.value)} />
              </div>
              <div>
                <Label>Email *</Label>
                <Input type="email" required value={form.email_presidente} onChange={(e) => update("email_presidente", e.target.value)} />
              </div>
              <div>
                <Label>Telefono</Label>
                <Input value={form.telefono} onChange={(e) => update("telefono", e.target.value)} />
              </div>
              <div className="md:col-span-2">
                <Label>Password * (min 8 caratteri)</Label>
                <Input type="password" required minLength={8} value={form.password} onChange={(e) => update("password", e.target.value)} />
              </div>
            </div>
            <Button type="submit" disabled={loading} className="w-full">
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Crea club e accedi
            </Button>
            <p className="text-center text-sm text-muted-foreground">
              Hai già un account? <a href="/" className="text-primary underline">Accedi</a>
            </p>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
