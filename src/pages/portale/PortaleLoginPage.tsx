import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { Loader2, Snowflake } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { portale_login, portale_restore_session, normalize_codice } from "@/lib/portale-auth";

const PortaleLoginPage: React.FC = () => {
  const navigate = useNavigate();
  const [codice, set_codice] = useState("");
  const [busy, set_busy] = useState(false);

  useEffect(() => {
    (async () => {
      const s = await portale_restore_session();
      if (s) navigate("/mio-club/home", { replace: true });
    })();
  }, [navigate]);

  const handle_submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!codice.trim()) return;
    set_busy(true);
    try {
      await portale_login(codice);
      navigate("/mio-club/home", { replace: true });
    } catch (err: any) {
      toast.error(err?.message ?? "Errore di accesso, riprova");
    } finally {
      set_busy(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-sky-50 via-white to-indigo-50 p-4">
      <div className="w-full max-w-md">
        <div className="bg-card rounded-2xl shadow-xl p-8 space-y-6 border border-border">
          <div className="flex flex-col items-center gap-3">
            <div className="w-14 h-14 rounded-2xl bg-sky-500 text-white flex items-center justify-center shadow-lg">
              <Snowflake className="w-7 h-7" />
            </div>
            <div className="text-center">
              <h1 className="text-2xl font-bold tracking-tight text-foreground">Portale Atleta</h1>
              <p className="text-sm text-muted-foreground mt-1">Accedi con il tuo codice atleta</p>
            </div>
          </div>

          <form onSubmit={handle_submit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="codice">Codice atleta</Label>
              <Input
                id="codice"
                value={codice}
                onChange={(e) => set_codice(e.target.value.toUpperCase())}
                onBlur={() => set_codice((c) => normalize_codice(c))}
                placeholder="AT-XXXX-XXXX"
                className="font-mono tracking-wider text-center text-lg uppercase"
                autoComplete="off"
                autoFocus
              />
              <p className="text-xs text-muted-foreground">
                Il codice si trova sulla tessera o nelle comunicazioni del club.
              </p>
            </div>
            <Button type="submit" className="w-full bg-sky-500 hover:bg-sky-600 text-white" disabled={busy}>
              {busy ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Verifica…</> : "Entra"}
            </Button>
          </form>

          <p className="text-center text-xs text-muted-foreground">
            Sei amministratore? <a href="/" className="text-sky-600 hover:underline">Accesso staff</a>
          </p>
        </div>
      </div>
    </div>
  );
};

export default PortaleLoginPage;
