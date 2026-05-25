import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { Loader2, Snowflake } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/lib/supabase";
import { portale_login, portale_restore_session, normalize_codice } from "@/lib/portale-auth";

const PortaleLoginPage: React.FC = () => {
  const navigate = useNavigate();
  const [codice, set_codice] = useState("");
  const [busy, set_busy] = useState(false);
  const [logo_url, set_logo_url] = useState<string | null>(null);

  useEffect(() => {
    document.title = "Il mio club — Ice Arena";
    let meta = document.querySelector('meta[name="description"]');
    if (!meta) {
      meta = document.createElement("meta");
      meta.setAttribute("name", "description");
      document.head.appendChild(meta);
    }
    meta.setAttribute(
      "content",
      "Entra nel tuo club inserendo il codice atleta. Calendario, eventi, fatture e novità in un solo posto."
    );

    (async () => {
      const s = await portale_restore_session();
      if (s) {
        navigate("/mio-club/home", { replace: true });
        return;
      }
      const { data } = await supabase.from("clubs").select("logo_url").not("logo_url", "is", null).limit(1).maybeSingle();
      if (data?.logo_url) set_logo_url(data.logo_url);
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
      toast.error(err?.message ?? "Codice non valido, controlla e riprova");
    } finally {
      set_busy(false);
    }
  };

  // Maschera AT-XXXX-XXXX
  const on_change = (raw: string) => {
    const clean = raw.toUpperCase().replace(/[^A-Z0-9]/g, "");
    let out = clean;
    if (clean.startsWith("AT")) {
      const rest = clean.slice(2);
      out = "AT" + (rest.length > 0 ? "-" + rest.slice(0, 4) : "");
      if (rest.length > 4) out += "-" + rest.slice(4, 8);
    } else if (clean.length > 0) {
      out = "AT-" + clean.slice(0, 4);
      if (clean.length > 4) out += "-" + clean.slice(4, 8);
    }
    set_codice(out);
  };

  return (
    <div className="min-h-screen relative flex items-center justify-center p-0 sm:p-4 bg-gradient-to-br from-sky-500 via-indigo-600 to-purple-700">
      {/* Pattern decorativo */}
      <div className="absolute inset-0 opacity-20 pointer-events-none">
        <div className="absolute -top-24 -left-24 w-96 h-96 rounded-full bg-white blur-3xl" />
        <div className="absolute -bottom-24 -right-24 w-[28rem] h-[28rem] rounded-full bg-sky-200 blur-3xl" />
      </div>

      <div className="relative w-full sm:max-w-[420px] min-h-screen sm:min-h-0">
        <div className="bg-white/95 backdrop-blur-xl sm:rounded-3xl shadow-2xl p-8 sm:p-10 space-y-7 border border-white/40 min-h-screen sm:min-h-0 flex flex-col justify-center">
          {/* Logo club */}
          <div className="flex flex-col items-center gap-4">
            {logo_url ? (
              <img src={logo_url} alt="Logo del club" className="w-20 h-20 object-contain rounded-2xl" />
            ) : (
              <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-sky-500 to-indigo-600 text-white flex items-center justify-center shadow-xl">
                <Snowflake className="w-10 h-10" />
              </div>
            )}
            <div className="text-center space-y-1">
              <h1 className="text-3xl sm:text-4xl font-bold tracking-tight text-slate-900">
                Benvenuto
              </h1>
              <p className="text-sm sm:text-base text-slate-600">
                Entra nel tuo club inserendo il codice atleta
              </p>
            </div>
          </div>

          <form onSubmit={handle_submit} className="space-y-5">
            <input
              id="codice"
              value={codice}
              onChange={(e) => on_change(e.target.value)}
              onBlur={() => set_codice((c) => normalize_codice(c))}
              placeholder="AT-XXXX-XXXX"
              maxLength={12}
              className="w-full h-14 font-mono tracking-[0.25em] text-center text-xl uppercase rounded-2xl border-2 border-slate-200 bg-white focus:border-sky-500 focus:outline-none focus:ring-4 focus:ring-sky-500/20 transition-all"
              autoComplete="off"
              autoFocus
              inputMode="text"
            />
            <Button
              type="submit"
              className="w-full h-14 text-base font-semibold rounded-2xl bg-gradient-to-r from-sky-500 to-indigo-600 hover:from-sky-600 hover:to-indigo-700 text-white shadow-lg shadow-indigo-500/30 transition-all hover:shadow-xl hover:scale-[1.01]"
              disabled={busy}
            >
              {busy ? <><Loader2 className="w-5 h-5 mr-2 animate-spin" /> Verifica…</> : "Entra"}
            </Button>
          </form>

          <p className="text-center text-xs text-slate-500">
            Hai dimenticato il codice? Chiedi al tuo club.
          </p>
        </div>
      </div>
    </div>
  );
};

export default PortaleLoginPage;
