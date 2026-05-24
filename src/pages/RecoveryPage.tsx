import React, { useState } from "react";
import { supabase } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, Mail } from "lucide-react";
import { toast } from "sonner";

const RecoveryPage: React.FC = () => {
  const [email, set_email] = useState("");
  const [busy, set_busy] = useState(false);
  const [sent, set_sent] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    set_busy(true);
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    set_busy(false);
    if (error) { toast.error(error.message); return; }
    set_sent(true);
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-muted/30 p-4">
      <div className="w-full max-w-md bg-card rounded-xl shadow-card p-8 space-y-5">
        <div className="text-center">
          <div className="w-12 h-12 rounded-xl bg-primary/10 text-primary mx-auto flex items-center justify-center mb-3"><Mail className="w-6 h-6" /></div>
          <h1 className="text-xl font-bold">Recupero password</h1>
          <p className="text-sm text-muted-foreground mt-1">Inserisci la tua email per ricevere il link di reset</p>
        </div>
        {sent ? (
          <div className="text-center space-y-3">
            <p className="text-sm text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-lg p-3">
              ✅ Se l'indirizzo esiste, abbiamo inviato il link per reimpostare la password.
            </p>
            <a href="/" className="text-sm text-primary hover:underline">Torna al login</a>
          </div>
        ) : (
          <form onSubmit={submit} className="space-y-3">
            <div className="space-y-1.5"><Label>Email</Label><Input type="email" required value={email} onChange={(e) => set_email(e.target.value)} /></div>
            <Button type="submit" className="w-full" disabled={busy}>
              {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : "Invia link di reset"}
            </Button>
            <a href="/" className="block text-center text-xs text-muted-foreground hover:underline">Torna al login</a>
          </form>
        )}
      </div>
    </div>
  );
};

export default RecoveryPage;
