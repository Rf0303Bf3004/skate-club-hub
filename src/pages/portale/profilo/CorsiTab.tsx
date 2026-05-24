import React, { useEffect, useState } from "react";
import { useOutletContext } from "react-router-dom";
import { supabase } from "@/lib/supabase";
import { Loader2 } from "lucide-react";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import type { PortaleSession } from "@/lib/portale-auth";
import { useTranslation } from "react-i18next";

const CorsiTab: React.FC = () => {
  const ctx = useOutletContext<{ session?: PortaleSession }>() as any;
  const session = ctx?.session as PortaleSession | undefined;
  const { t } = useTranslation("portale");
  const [loading, set_loading] = useState(true);
  const [corsi, set_corsi] = useState<any[]>([]);
  const [iscr, set_iscr] = useState<Set<string>>(new Set());
  const [richieste, set_richieste] = useState<Set<string>>(new Set());
  const [privates, set_privates] = useState<any[]>([]);

  const load = async () => {
    if (!session) return;
    const oggi = new Date().toISOString().slice(0, 10);
    const [c, i, r, lp] = await Promise.all([
      supabase.from("corsi").select("*").eq("club_id", session.atleta.club_id).eq("attivo", true).order("nome"),
      supabase.from("iscrizioni_corsi").select("corso_id").eq("atleta_id", session.atleta.id).eq("attiva", true),
      supabase.from("richieste_iscrizione").select("corso_id").eq("atleta_id", session.atleta.id).eq("stato", "in_attesa"),
      supabase.from("lezioni_private_atlete").select("lezione_id, lezioni_private(*)").eq("atleta_id", session.atleta.id),
    ]);
    set_corsi(c.data ?? []);
    set_iscr(new Set((i.data ?? []).map((x: any) => x.corso_id)));
    set_richieste(new Set((r.data ?? []).map((x: any) => x.corso_id)));
    set_privates(((lp.data ?? []) as any[]).map((x) => x.lezioni_private).filter((l) => l && !l.annullata && l.data >= oggi));
    set_loading(false);
  };

  useEffect(() => { load(); }, [session?.atleta.id]);

  const richiedi = async (corso: any) => {
    if (!session) return;
    const { error } = await supabase.from("richieste_iscrizione").insert({
      club_id: session.atleta.club_id,
      atleta_id: session.atleta.id,
      corso_id: corso.id,
      stato: "in_attesa",
    });
    if (error) { toast.error(error.message); return; }
    toast.success("Richiesta inviata");
    load();
  };

  if (loading) return <div className="flex justify-center py-8"><Loader2 className="w-6 h-6 animate-spin text-sky-500" /></div>;

  const miei = corsi.filter((c) => iscr.has(c.id));
  const disponibili = corsi.filter((c) => !iscr.has(c.id));

  return (
    <Tabs defaultValue="miei">
      <TabsList className="grid grid-cols-3 w-full">
        <TabsTrigger value="miei">{t("corsi.miei")} ({miei.length})</TabsTrigger>
        <TabsTrigger value="disp">{t("corsi.disponibili")} ({disponibili.length})</TabsTrigger>
        <TabsTrigger value="priv">{t("corsi.lezioni_private")} ({privates.length})</TabsTrigger>
      </TabsList>

      <TabsContent value="miei" className="space-y-3 mt-4">
        {miei.length === 0 ? <Empty text={t("corsi.nessuno")} /> : miei.map((c) => <CorsoCard key={c.id} corso={c} stato="iscritto" t={t} />)}
      </TabsContent>
      <TabsContent value="disp" className="space-y-3 mt-4">
        {disponibili.length === 0 ? <Empty text={t("corsi.nessuno")} /> : disponibili.map((c) => (
          <CorsoCard key={c.id} corso={c}
            stato={richieste.has(c.id) ? "richiesta" : "libero"}
            on_richiedi={() => richiedi(c)}
            t={t}
          />
        ))}
      </TabsContent>
      <TabsContent value="priv" className="space-y-3 mt-4">
        {privates.length === 0 ? <Empty text={t("corsi.nessuno")} /> : privates.map((l) => (
          <div key={l.id} className="bg-white border border-slate-200 rounded-2xl p-4">
            <p className="font-semibold text-slate-800">Lezione privata</p>
            <p className="text-sm text-slate-500">
              {new Date(l.data + "T00:00:00").toLocaleDateString("it-CH")} · {l.ora_inizio?.slice(0,5)}–{l.ora_fine?.slice(0,5)}
            </p>
          </div>
        ))}
      </TabsContent>
    </Tabs>
  );
};

const CorsoCard: React.FC<{ corso: any; stato: "iscritto" | "richiesta" | "libero"; on_richiedi?: () => void; t: any }> = ({ corso, stato, on_richiedi, t }) => (
  <div className="bg-white border border-slate-200 rounded-2xl p-4 flex items-center gap-3">
    <div className="flex-1 min-w-0">
      <p className="font-semibold text-slate-800">{corso.nome}</p>
      <p className="text-xs text-slate-500">{corso.giorno ?? "—"}{corso.ora_inizio ? ` · ${corso.ora_inizio.slice(0,5)}` : ""}</p>
    </div>
    {stato === "iscritto" && <span className="text-xs font-bold text-emerald-600">{t("corsi.iscritto")}</span>}
    {stato === "richiesta" && <span className="text-xs font-bold text-amber-600">{t("corsi.richiesta_inviata")}</span>}
    {stato === "libero" && <Button size="sm" className="bg-sky-500 hover:bg-sky-600" onClick={on_richiedi}>{t("corsi.richiedi")}</Button>}
  </div>
);

const Empty: React.FC<{ text: string }> = ({ text }) => (
  <div className="bg-white border border-slate-200 rounded-2xl p-8 text-center text-slate-500">{text}</div>
);

export default CorsiTab;
