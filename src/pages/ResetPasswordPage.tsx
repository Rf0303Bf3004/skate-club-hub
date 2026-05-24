import React, { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, Lock } from "lucide-react";
import { toast } from "sonner";

const ResetPasswordPage: React.FC = () => {
  const [password, set_password] = useState("");
  const [conferma, set_conferma] = useState("");
  const [busy, set_busy] = useState(false);
  const [ready, set_ready] = useState(false);

  useEffect(() => {
    // Supabase mette il token nella hash; setSession via getSession dopo il routing
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) set_ready(true);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY" || event === "SIGNED_IN") set_ready(true);
    });
    return () => { sub.subscription.unsubscribe(); };
  }, []);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password.length < 8) { toast.error("Almeno 8 caratteri"); return; }
    if (password !== conferma) { toast.error("Le password non corrispondono"); return; }
    set_busy(true);
    const { error } = await supabase.auth.updateUser({ password });
    set_busy(false);
    if (error) { toast.error(error.message); return; }
    toast.success("Password aggiornata");
    setTimeout(() => { window.location.href = "/"; }, 1000);
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-muted/30 p-4">
      <div className="w-full max-w-md bg-card rounded-xl shadow-card p-8 space-y-5">
        <div className="text-center">
          <div className="w-12 h-12 rounded-xl bg-primary/10 text-primary mx-auto flex items-center justify-center mb-3"><Lock className="w-6 h-6" /></div>
          <h1 className="text-xl font-bold">Nuova password</h1>
          <p className="text-sm text-muted-foreground mt-1">Imposta una nuova password per il tuo account</p>
        </div>
        {!ready ? (
          <div className="text-center text-sm text-muted-foreground py-4">
            <Loader2 className="w-5 h-5 animate-spin mx-auto mb-2" />
            Attendi… verifica del link
          </div>
        ) : (
          <form onSubmit={submit} className="space-y-3">
            <div className="space-y-1.5"><Label>Nuova password</Label><Input type="password" required value={password} onChange={(e) => set_password(e.target.value)} /></div>
            <div className="space-y-1.5"><Label>Conferma password</Label><Input type="password" required value={conferma} onChange={(e) => set_conferma(e.target.value)} /></div>
            <Button type="submit" className="w-full" disabled={busy}>
              {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : "Aggiorna password"}
            </Button>
          </form>
        )}
      </div>
    </div>
  );
};

export default ResetPasswordPage;
