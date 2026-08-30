import React, { useEffect, useState } from "react";
import { useOutletContext } from "react-router-dom";
import { Loader2, Trophy, Tent, Sparkles, Lock } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { toast } from "sonner";
import type { PortaleSession } from "@/lib/portale-auth";
import { useTranslation } from "react-i18next";
import { motivo_non_iscrivibile, oggi_iso, type AtletaLivelloGara } from "@/lib/gare-iscrivibilita";

const PortaleEventiPage: React.FC = () => {
  const { session } = useOutletContext<{ session: PortaleSession }>();
  const { t } = useTranslation("portale");
  const [loading, set_loading] = useState(true);
  const [gare, set_gare] = useState<any[]>([]);
  const [campi, set_campi] = useState<any[]>([]);
  const [eventi, set_eventi] = useState<any[]>([]);
  const [iscr_gare, set_iscr_gare] = useState<Set<string>>(new Set());
  const [atleta_livelli, set_atleta_livelli] = useState<AtletaLivelloGara | null>(null);

  useEffect(() => {
    (async () => {
      const oggi = oggi_iso();
      const [g, c, e, ig, a] = await Promise.all([
        supabase.from("gare_calendario").select("id,nome,data,ora,luogo,indirizzo,club_ospitante,carriera,livello_minimo,scadenza_iscrizioni,archiviata,note").eq("club_id", session.atleta.club_id).gte("data", oggi).order("data"),
        supabase.from("training_camps").select("*").eq("club_id", session.atleta.club_id).gte("data_inizio", oggi).order("data_inizio"),
        supabase.from("eventi_straordinari").select("*").eq("club_id", session.atleta.club_id).gte("data", oggi).order("data"),
        supabase.from("iscrizioni_gare_mobile" as any).select("gara_id").eq("atleta_id", session.atleta.id),
        supabase.from("atleti").select("carriera_artistica,carriera_stile,livello_attuale").eq("id", session.atleta.id).maybeSingle(),
      ]);
      set_gare(g.data ?? []);
      set_campi(c.data ?? []);
      set_eventi(e.data ?? []);
      set_iscr_gare(new Set((ig.data ?? []).map((x: any) => x.gara_id)));
      set_atleta_livelli((a.data as AtletaLivelloGara) ?? null);
      set_loading(false);
    })();
  }, [session.atleta.id, session.atleta.club_id]);

  const iscriviti_gara = async (gara: any) => {
    const motivo = motivo_non_iscrivibile(gara, atleta_livelli);
    if (motivo) { toast.error(motivo); return; }
    const { error } = await supabase.from("iscrizioni_gare").insert({
      atleta_id: session.atleta.id,
      gara_id: gara.id,
      carriera: gara.carriera ?? null,
    });
    if (error) { toast.error(error.message); return; }
    set_iscr_gare((s) => new Set([...s, gara.id]));
    toast.success("Iscrizione registrata");
  };

  if (loading) {
    return <div className="flex justify-center py-8"><Loader2 className="w-6 h-6 animate-spin text-sky-500" /></div>;
  }

  return (
    <div className="max-w-3xl mx-auto space-y-4">
      <h1 className="text-xl font-bold text-slate-800">{t("eventi.titolo")}</h1>
      <Tabs defaultValue="gare">
        <TabsList className="grid grid-cols-3 w-full">
          <TabsTrigger value="gare"><Trophy className="w-4 h-4 mr-1.5" />{t("eventi.gare")}</TabsTrigger>
          <TabsTrigger value="campi"><Tent className="w-4 h-4 mr-1.5" />{t("eventi.campi")}</TabsTrigger>
          <TabsTrigger value="gala"><Sparkles className="w-4 h-4 mr-1.5" />{t("eventi.gala")}</TabsTrigger>
        </TabsList>

        <TabsContent value="gare" className="space-y-3 mt-4">
          {gare.length === 0 ? <EmptyMsg text={t("eventi.nessun_evento")} /> : gare.map((g) => {
            const motivo = motivo_non_iscrivibile(g, atleta_livelli);
            const iscritto = iscr_gare.has(g.id);
            return (
              <div key={g.id} className="bg-white border border-slate-200 rounded-2xl p-4 flex items-start gap-3">
                <DateBox data={g.data} />
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-slate-800">{g.nome}</p>
                  {g.luogo && <p className="text-xs text-slate-500">📍 {g.luogo}</p>}
                  {!iscritto && motivo && (
                    <p className="text-xs text-amber-600 font-medium mt-1 flex items-center gap-1">
                      <Lock className="w-3 h-3" /> {motivo}
                    </p>
                  )}
                  {!iscritto && !motivo && g.scadenza_iscrizioni && (
                    <p className="text-[11px] text-slate-400 mt-1">
                      Iscrizioni entro il {new Date(g.scadenza_iscrizioni + "T00:00:00").toLocaleDateString("it-CH")}
                    </p>
                  )}
                </div>
                {iscritto ? (
                  <span className="text-xs font-bold text-emerald-600 self-center">{t("eventi.iscritto")}</span>
                ) : motivo ? null : (
                  <Button size="sm" className="bg-sky-500 hover:bg-sky-600" onClick={() => iscriviti_gara(g)}>
                    {t("eventi.iscriviti")}
                  </Button>
                )}
              </div>
            );
          })}
        </TabsContent>


        <TabsContent value="campi" className="space-y-3 mt-4">
          {campi.length === 0 ? <EmptyMsg text={t("eventi.nessun_evento")} /> : campi.map((c) => (
            <div key={c.id} className="bg-white border border-slate-200 rounded-2xl p-4 flex items-start gap-3">
              <DateBox data={c.data_inizio} />
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-slate-800">{c.nome ?? "Campo"}</p>
                {c.luogo && <p className="text-xs text-slate-500">📍 {c.luogo}</p>}
              </div>
            </div>
          ))}
        </TabsContent>

        <TabsContent value="gala" className="space-y-3 mt-4">
          {eventi.length === 0 ? <EmptyMsg text={t("eventi.nessun_evento")} /> : eventi.map((e) => (
            <div key={e.id} className="bg-white border border-slate-200 rounded-2xl p-4 flex items-start gap-3">
              <DateBox data={e.data} />
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-slate-800">{e.titolo}</p>
                {e.luogo && <p className="text-xs text-slate-500">📍 {e.luogo}</p>}
              </div>
            </div>
          ))}
        </TabsContent>
      </Tabs>
    </div>
  );
};

const DateBox: React.FC<{ data: string }> = ({ data }) => (
  <div className="flex flex-col items-center justify-center bg-orange-100 text-orange-700 rounded-xl px-3 py-2 min-w-[56px]">
    <span className="text-[10px] uppercase font-bold">
      {new Date(data + "T00:00:00").toLocaleDateString("it-CH", { month: "short" })}
    </span>
    <span className="text-xl font-black leading-none">{new Date(data + "T00:00:00").getDate()}</span>
  </div>
);

const EmptyMsg: React.FC<{ text: string }> = ({ text }) => (
  <div className="bg-white border border-slate-200 rounded-2xl p-8 text-center text-slate-500">{text}</div>
);

export default PortaleEventiPage;
