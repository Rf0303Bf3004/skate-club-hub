import React, { useCallback, useEffect, useState } from "react";
import { NavLink, Outlet, useNavigate } from "react-router-dom";
import { Home, Calendar, Sparkles, MessageSquare, User, LogOut, Menu, X, Plus, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import CodiceAtletaInput from "@/components/portale/CodiceAtletaInput";
import {
  portale_logout, portale_restore_session, portale_get_profili_collegati,
  portale_switch_profilo, portale_remove_profilo, portale_login,
  type PortaleSession,
} from "@/lib/portale-auth";

const PortaleLayout: React.FC = () => {
  const navigate = useNavigate();
  const { t } = useTranslation("portale");
  const [session, set_session] = useState<PortaleSession | null>(null);
  const [profili, set_profili] = useState<PortaleSession[]>([]);
  const [loading, set_loading] = useState(true);
  const [open, set_open] = useState(false);
  const [dialog_open, set_dialog_open] = useState(false);
  const [codice, set_codice] = useState("");
  const [busy, set_busy] = useState(false);
  const [da_rimuovere, set_da_rimuovere] = useState<PortaleSession | null>(null);

  const refresh_profili = useCallback(() => {
    set_profili(portale_get_profili_collegati());
  }, []);

  useEffect(() => {
    (async () => {
      const s = await portale_restore_session();
      if (!s) {
        navigate("/mio-club", { replace: true });
      } else {
        set_session(s);
        refresh_profili();
      }
      set_loading(false);
    })();
  }, [navigate, refresh_profili]);

  const handle_logout = async () => {
    await portale_logout();
    navigate("/mio-club", { replace: true });
  };

  const handle_switch = async (atleta_id: string) => {
    if (atleta_id === session?.atleta.id) return;
    try {
      const s = await portale_switch_profilo(atleta_id);
      if (s) {
        set_session(s);
        refresh_profili();
        toast.success(`Ora stai vedendo il profilo di ${s.atleta.nome}`);
      }
    } catch (err: any) {
      toast.error(err?.message ?? "Impossibile cambiare profilo");
    }
  };

  const handle_add = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!codice.trim()) return;
    set_busy(true);
    try {
      const s = await portale_login(codice);
      set_session(s);
      refresh_profili();
      set_codice("");
      set_dialog_open(false);
      toast.success(`${s.atleta.nome} ${s.atleta.cognome} collegato/a`);
    } catch (err: any) {
      toast.error(err?.message ?? "Codice non valido, controlla e riprova");
    } finally {
      set_busy(false);
    }
  };

  const handle_remove = async () => {
    const target = da_rimuovere;
    set_da_rimuovere(null);
    if (!target) return;
    const s = await portale_remove_profilo(target.atleta.id);
    if (!s) {
      navigate("/mio-club", { replace: true });
      return;
    }
    set_session(s);
    refresh_profili();
    toast.success("Profilo rimosso da questo dispositivo");
  };

  if (loading || !session) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="h-8 w-8 animate-spin rounded-full border-b-2 border-sky-500" />
      </div>
    );
  }

  const items = [
    { to: "/mio-club/home", icon: Home, label: t("menu.home") },
    { to: "/mio-club/calendario", icon: Calendar, label: t("menu.calendario") },
    { to: "/mio-club/eventi", icon: Sparkles, label: t("menu.eventi") },
    { to: "/mio-club/notizie", icon: MessageSquare, label: t("menu.notizie") },
    { to: "/mio-club/profilo", icon: User, label: t("menu.profilo") },
  ];

  const iniziali_di = (s: PortaleSession) =>
    `${s.atleta.nome?.[0] ?? ""}${s.atleta.cognome?.[0] ?? ""}`.toUpperCase() || "?";

  return (
    <div className="flex min-h-screen bg-gradient-to-br from-slate-50 via-white to-sky-50">
      {open && <div className="fixed inset-0 bg-black/30 z-40 lg:hidden" onClick={() => set_open(false)} />}
      <aside className={`fixed lg:static inset-y-0 left-0 z-50 w-64 bg-white border-r border-slate-200 flex flex-col transform transition-transform duration-200 ease-out ${open ? "translate-x-0" : "-translate-x-full lg:translate-x-0"}`}>
        <div className="p-5 flex items-center gap-3 border-b border-slate-200">
          <div className="w-10 h-10 rounded-xl bg-sky-500 text-white flex items-center justify-center font-bold">
            {iniziali_di(session)}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-bold truncate">{session.atleta.nome} {session.atleta.cognome}</p>
            <p className="text-xs text-slate-500 truncate">{session.club?.nome ?? ""}</p>
          </div>
          <button className="lg:hidden" onClick={() => set_open(false)} aria-label="Chiudi menu"><X className="w-5 h-5" /></button>
        </div>

        {/* Switcher profili collegati */}
        <div className="px-4 py-3 border-b border-slate-200">
          <p className="text-[10px] uppercase tracking-wider text-slate-400 font-semibold mb-2">
            I miei profili
          </p>
          <div className="flex flex-wrap items-center gap-2">
            {profili.map((p) => {
              const attivo = p.atleta.id === session.atleta.id;
              return (
                <div key={p.atleta.id} className="relative group">
                  <button
                    onClick={() => handle_switch(p.atleta.id)}
                    title={`${p.atleta.nome} ${p.atleta.cognome}`}
                    className={`w-11 h-11 rounded-full flex items-center justify-center text-xs font-bold transition-all ${
                      attivo
                        ? "bg-gradient-to-br from-sky-500 to-indigo-600 text-white ring-2 ring-sky-500 ring-offset-2 shadow"
                        : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                    }`}
                  >
                    {iniziali_di(p)}
                  </button>
                  <button
                    onClick={() => set_da_rimuovere(p)}
                    aria-label={`Rimuovi ${p.atleta.nome}`}
                    className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-white border border-slate-300 text-slate-500 flex items-center justify-center shadow-sm opacity-0 group-hover:opacity-100 focus:opacity-100 transition-opacity"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </div>
              );
            })}
            <button
              onClick={() => set_dialog_open(true)}
              className="w-11 h-11 rounded-full border-2 border-dashed border-slate-300 text-slate-400 flex items-center justify-center hover:border-sky-400 hover:text-sky-500 transition-colors"
              aria-label="Aggiungi un'altra figlia o figlio"
              title="Aggiungi un'altra figlia/o"
            >
              <Plus className="w-5 h-5" />
            </button>
          </div>
          <button
            onClick={() => set_dialog_open(true)}
            className="mt-2 text-xs font-semibold text-sky-600 hover:text-sky-700"
          >
            + Aggiungi un'altra figlia/o
          </button>
        </div>

        <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
          {items.map((it) => (
            <NavLink
              key={it.to}
              to={it.to}
              onClick={() => set_open(false)}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-colors ${
                  isActive
                    ? "bg-sky-500 text-white shadow-sm"
                    : "text-slate-600 hover:bg-slate-100"
                }`
              }
            >
              <it.icon className="w-4 h-4" />
              {it.label}
            </NavLink>
          ))}
        </nav>
        <div className="p-3 border-t border-slate-200">
          <Button variant="ghost" className="w-full justify-start text-slate-600" onClick={handle_logout}>
            <LogOut className="w-4 h-4 mr-2" /> {t("login.logout")}
          </Button>
        </div>
      </aside>

      <div className="flex-1 flex flex-col min-w-0">
        <header className="h-14 bg-white border-b border-slate-200 flex items-center px-4 lg:px-8 sticky top-0 z-30">
          <Button variant="ghost" size="icon" className="lg:hidden mr-2" onClick={() => set_open(true)}>
            <Menu className="w-5 h-5" />
          </Button>
          <h2 className="font-semibold text-slate-800">{session.club?.nome ?? "Portale Atleta"}</h2>
          <code className="ml-auto hidden sm:inline-block text-[10px] px-2 py-0.5 rounded bg-slate-100 text-slate-500 font-mono">
            {session.atleta.codice_atleta}
          </code>
        </header>
        <main key={session.atleta.id} className="flex-1 p-4 lg:p-8 overflow-x-hidden">
          <Outlet context={{ session }} />
        </main>
      </div>

      {/* Dialog aggiunta profilo */}
      <Dialog open={dialog_open} onOpenChange={set_dialog_open}>
        <DialogContent className="sm:max-w-[420px]">
          <DialogHeader>
            <DialogTitle>Aggiungi un'altra figlia/o</DialogTitle>
            <DialogDescription>
              Inserisci il codice atleta: resterai collegato anche agli altri profili.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handle_add} className="space-y-4">
            <CodiceAtletaInput id="codice_aggiungi" value={codice} onChange={set_codice} autoFocus />
            <DialogFooter>
              <Button type="submit" disabled={busy} className="w-full h-12 rounded-2xl">
                {busy ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Verifica…</> : "Collega profilo"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Conferma rimozione */}
      <AlertDialog open={!!da_rimuovere} onOpenChange={(o) => !o && set_da_rimuovere(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Rimuovere questo profilo?</AlertDialogTitle>
            <AlertDialogDescription>
              {da_rimuovere ? `${da_rimuovere.atleta.nome} ${da_rimuovere.atleta.cognome}` : ""} verrà scollegato da questo dispositivo. Potrai ricollegarlo con il codice atleta.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annulla</AlertDialogCancel>
            <AlertDialogAction onClick={handle_remove}>Rimuovi</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default PortaleLayout;
