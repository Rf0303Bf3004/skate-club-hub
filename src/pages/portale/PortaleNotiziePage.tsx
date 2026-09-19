import React, { useEffect, useState } from "react";
import { useOutletContext } from "react-router-dom";
import { Loader2, Archive, ArchiveRestore, MessageSquare, AlertTriangle } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import type { PortaleSession } from "@/lib/portale-auth";
import { useTranslation } from "react-i18next";
import { use_contenuti_traduzioni } from "@/hooks/use-contenuti-traduzioni";
import { segnala_errore } from "@/lib/errori";

interface Dest {
  id: string;
  archiviato_at: string | null;
  creato_at: string;
  rsvp_risposta: string | null;
  rsvp_at: string | null;
  comunicazioni: {
    id: string;
    titolo: string;
    testo: string | null;
    corpo?: string | null;
    richiede_rsvp: boolean | null;
    rsvp_scadenza: string | null;
  } | null;
}

const PortaleNotiziePage: React.FC = () => {
  const { session } = useOutletContext<{ session: PortaleSession }>();
  const { t } = useTranslation("portale");
  const [loading, set_loading] = useState(true);
  const [errore, set_errore] = useState(false);
  const [items, set_items] = useState<Dest[]>([]);
  const [busy_id, set_busy_id] = useState<string | null>(null);
  const [da_confermare, set_da_confermare] = useState<Dest | null>(null);

  const { traduci } = use_contenuti_traduzioni(
    "comunicazioni",
    items.map((i) => i.comunicazioni?.id).filter(Boolean) as string[],
  );

  const load = async () => {
    set_loading(true);
    const { data, error } = await supabase
      .from("comunicazioni_destinatari")
      .select(
        "id, archiviato_at, creato_at, rsvp_risposta, rsvp_at, comunicazioni(id, titolo, testo, corpo, richiede_rsvp, rsvp_scadenza)",
      )
      .eq("atleta_id", session.atleta.id)
      .order("creato_at", { ascending: false });
    if (error) {
      segnala_errore("PortaleNotiziePage", "comunicazioni_destinatari", error, "avviso");
      set_errore(true);
      set_items([]);
      set_loading(false);
      return;
    }
    set_errore(false);
    set_items((data ?? []) as any);
    set_loading(false);
  };

  useEffect(() => { load(); }, [session.atleta.id]);

  const toggle_archive = async (item: Dest) => {
    const newVal = item.archiviato_at ? null : new Date().toISOString();
    const { error } = await supabase
      .from("comunicazioni_destinatari")
      .update({ archiviato_at: newVal })
      .eq("id", item.id);
    if (error) { toast.error(error.message); return; }
    toast.success(newVal ? "Archiviata" : "Ripristinata");
    load();
  };

  const salva_rsvp = async (item: Dest, risposta: "si" | "no") => {
    set_busy_id(item.id);
    const { error } = await supabase
      .from("comunicazioni_destinatari")
      .update({ rsvp_risposta: risposta, rsvp_at: new Date().toISOString() })
      .eq("id", item.id);
    set_busy_id(null);
    if (error) {
      segnala_errore("PortaleNotiziePage", "rsvp_risposta", error);
      toast.error(t("assenze.errore"));
      return;
    }
    toast.success(risposta === "no" ? t("assenze.salvato") : t("assenze.ritirato"));
    load();
  };

  const scadenza_passata = (it: Dest) => {
    const s = it.comunicazioni?.rsvp_scadenza;
    if (!s) return false;
    return new Date(s).getTime() < Date.now();
  };

  const attive = items.filter((i) => !i.archiviato_at);
  const archivio = items.filter((i) => !!i.archiviato_at);

  if (loading) {
    return <div className="flex justify-center py-8"><Loader2 className="w-6 h-6 animate-spin text-sky-500" /></div>;
  }

  const render_rsvp = (it: Dest) => {
    if (!it.comunicazioni?.richiede_rsvp) return null;
    const risposto = it.rsvp_risposta === "si" || it.rsvp_risposta === "no";
    const scaduto = scadenza_passata(it);
    // Chi non ha risposto e non è più in tempo non vede nulla: non c'è più niente da fare.
    if (!risposto && scaduto) return null;
    return (
      <div className="mt-3 pt-3 border-t border-slate-100">
        {risposto ? (
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className={`text-sm font-semibold ${it.rsvp_risposta === "no" ? "text-rose-600" : "text-emerald-600"}`}>
              {it.rsvp_risposta === "no" ? t("assenze.avvisato") : t("assenze.confermato")}
            </p>
            {!scaduto && (
              it.rsvp_risposta === "no" ? (
                <Button variant="outline" size="sm" disabled={busy_id === it.id} onClick={() => salva_rsvp(it, "si")}>
                  {t("assenze.invece_ci_saro")}
                </Button>
              ) : (
                <Button variant="outline" size="sm" disabled={busy_id === it.id} onClick={() => set_da_confermare(it)}>
                  {t("assenze.non_posso")}
                </Button>
              )
            )}
          </div>
        ) : (
          <div className="space-y-2">
            <p className="text-sm text-slate-600">{t("assenze.attesa")}</p>
            <Button
              variant="outline"
              className="w-full border-rose-300 text-rose-600 hover:bg-rose-50"
              disabled={busy_id === it.id}
              onClick={() => set_da_confermare(it)}
            >
              {t("assenze.non_posso")}
            </Button>
          </div>
        )}
      </div>
    );
  };

  const render_list = (list: Dest[], is_archive: boolean) => (
    <div className="space-y-3 mt-4">
      {list.length === 0 ? (
        <div className="bg-white border border-slate-200 rounded-2xl p-8 text-center text-slate-500">
          <MessageSquare className="w-10 h-10 mx-auto mb-2 opacity-40" />
          {t("notizie.nessuna")}
        </div>
      ) : list.map((it) => (
        <div key={it.id} className="bg-white border border-slate-200 rounded-2xl p-4">
          <div className="flex items-start justify-between gap-3 mb-2">
            <div className="min-w-0 flex-1">
              <h3 className="font-semibold text-slate-800">
                {traduci(it.comunicazioni?.id, "titolo", it.comunicazioni?.titolo) || "—"}
              </h3>
              <p className="text-[11px] text-slate-400 mt-0.5">
                {new Date(it.creato_at).toLocaleDateString("it-CH", { day: "2-digit", month: "2-digit", year: "numeric" })}
              </p>
            </div>
            <Button variant="ghost" size="sm" onClick={() => toggle_archive(it)}>
              {is_archive ? <ArchiveRestore className="w-4 h-4" /> : <Archive className="w-4 h-4" />}
            </Button>
          </div>
          <p className="text-sm text-slate-600 whitespace-pre-wrap">
            {traduci(it.comunicazioni?.id, "testo", it.comunicazioni?.testo ?? it.comunicazioni?.corpo ?? "")}
          </p>
          {render_rsvp(it)}
        </div>
      ))}
    </div>
  );

  return (
    <div className="max-w-3xl mx-auto space-y-4">
      <h1 className="text-xl font-bold text-slate-800">{t("notizie.titolo")}</h1>

      {errore && (
        <div className="flex items-start gap-2 rounded-xl border border-amber-300 bg-amber-50 p-3 text-sm text-amber-800">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          <div className="flex-1">
            <p>{t("assenze.errore_lettura")}</p>
            <Button variant="outline" size="sm" className="mt-2" onClick={load}>
              {t("login.entra") === "" ? "Riprova" : "Riprova"}
            </Button>
          </div>
        </div>
      )}

      <Tabs defaultValue="attive">
        <TabsList className="grid grid-cols-2 w-full">
          <TabsTrigger value="attive">{t("notizie.attive")} ({attive.length})</TabsTrigger>
          <TabsTrigger value="archivio">{t("notizie.archivio")} ({archivio.length})</TabsTrigger>
        </TabsList>
        <TabsContent value="attive">{render_list(attive, false)}</TabsContent>
        <TabsContent value="archivio">{render_list(archivio, true)}</TabsContent>
      </Tabs>

      <AlertDialog open={!!da_confermare} onOpenChange={(v) => { if (!v) set_da_confermare(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("assenze.conferma_titolo")}</AlertDialogTitle>
            <AlertDialogDescription>{t("assenze.conferma_testo")}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("assenze.annulla")}</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                const it = da_confermare;
                set_da_confermare(null);
                if (it) salva_rsvp(it, "no");
              }}
            >
              {t("assenze.conferma_ok")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default PortaleNotiziePage;
