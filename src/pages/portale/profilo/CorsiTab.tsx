import React from "react";
import { useOutletContext } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { Loader2 } from "lucide-react";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import type { PortaleSession } from "@/lib/portale-auth";
import { useTranslation } from "react-i18next";
import RichiestePrivateSezione from "@/components/portale/RichiestePrivateSezione";
import { segnala_errore } from "@/lib/errori";
import { format_data } from "@/lib/format-data";

interface DatiCorsi {
  miei: any[];
  disponibili: any[];
  richieste: Set<string>;
  privates: any[];
}

/**
 * Corsi proposti all'atleta: la regola è UNA sola, quella del database
 * (`valuta_iscrizione`). Qui non si filtra per livello in nessun altro modo.
 */
async function carica_corsi(session: PortaleSession): Promise<DatiCorsi> {
  const oggi = new Date().toISOString().slice(0, 10);
  const club_id = session.atleta.club_id;
  const atleta_id = session.atleta.id;

  const { data: stag, error: st_err } = await supabase
    .from("stagioni").select("id").eq("club_id", club_id).eq("attiva", true).maybeSingle();
  if (st_err) throw st_err;

  const [c, i, r, lp] = await Promise.all([
    stag
      ? supabase.from("corsi").select("*").eq("club_id", club_id).eq("stagione_id", stag.id).eq("attivo", true).order("nome")
      : Promise.resolve({ data: [] as any[], error: null }),
    supabase.from("iscrizioni_corsi").select("corso_id").eq("atleta_id", atleta_id).eq("attiva", true),
    supabase.from("richieste_iscrizione").select("corso_id").eq("atleta_id", atleta_id).eq("stato", "in_attesa"),
    supabase.from("lezioni_private_atlete").select("lezione_id, lezioni_private(*)").eq("atleta_id", atleta_id),
  ]);
  for (const res of [c, i, r, lp]) if (res.error) throw res.error;

  const corsi = (c.data ?? []) as any[];
  const iscr = new Set(((i.data ?? []) as any[]).map((x) => x.corso_id));
  const richieste = new Set(((r.data ?? []) as any[]).map((x) => x.corso_id));

  const candidati = corsi.filter((x) => !iscr.has(x.id));
  const esiti = await Promise.all(
    candidati.map(async (corso) => {
      const { data, error } = await supabase.rpc("valuta_iscrizione", {
        p_atleta_id: atleta_id,
        p_corso_id: corso.id,
      });
      if (error) throw error;
      const riga = Array.isArray(data) ? data[0] : data;
      return riga?.conforme === true || richieste.has(corso.id) ? corso : null;
    }),
  );

  // I miei corsi possono essere anche di altre stagioni ancora attive: si leggono a parte.
  let miei = corsi.filter((x) => iscr.has(x.id));
  const mancanti = [...iscr].filter((id) => !miei.some((m) => m.id === id));
  if (mancanti.length > 0) {
    const { data: altri, error } = await supabase.from("corsi").select("*").in("id", mancanti).eq("attivo", true);
    if (error) throw error;
    miei = [...miei, ...((altri ?? []) as any[])];
  }

  return {
    miei,
    disponibili: esiti.filter(Boolean) as any[],
    richieste,
    privates: ((lp.data ?? []) as any[])
      .map((x) => x.lezioni_private)
      .filter((l) => l && !l.annullata && l.data >= oggi),
  };
}

const CorsiTab: React.FC = () => {
  const ctx = useOutletContext<{ session?: PortaleSession }>();
  const session = ctx?.session;
  const { t } = useTranslation("portale");
  const qc = useQueryClient();

  const query = useQuery({
    queryKey: ["portale_corsi", session?.atleta.id],
    enabled: !!session,
    queryFn: () => carica_corsi(session as PortaleSession),
    meta: { onError: undefined },
  });

  React.useEffect(() => {
    if (query.isError) segnala_errore("CorsiTab", t("corsi.errore"), query.error, { gravita: "avviso" } as any);
  }, [query.isError]);

  const richiedi = async (corso: any) => {
    if (!session) return;
    const { error } = await supabase.from("richieste_iscrizione").insert({
      club_id: session.atleta.club_id,
      atleta_id: session.atleta.id,
      corso_id: corso.id,
      stato: "in_attesa",
    });
    if (error) {
      segnala_errore("CorsiTab", t("corsi.richiedi"), error);
      return;
    }
    toast.success(t("corsi.richiesta_ok"));
    qc.invalidateQueries({ queryKey: ["portale_corsi", session.atleta.id] });
  };

  if (query.isError) {
    return (
      <div className="bg-white border border-red-200 rounded-2xl p-6 text-center space-y-3">
        <p className="text-sm text-red-700">{t("corsi.errore")}</p>
        <Button size="sm" variant="outline" onClick={() => query.refetch()}>{t("corsi.riprova")}</Button>
      </div>
    );
  }
  if (!query.isSuccess) {
    return <div className="flex justify-center py-8"><Loader2 className="w-6 h-6 animate-spin text-sky-500" /></div>;
  }

  const { miei, disponibili, richieste, privates } = query.data;

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
            <p className="font-semibold text-slate-800">{t("corsi.lezione_privata")}</p>
            <p className="text-sm text-slate-500">
              {format_data(new Date(l.data + "T00:00:00"))} · {l.ora_inizio?.slice(0,5)}–{l.ora_fine?.slice(0,5)}
            </p>
          </div>
        ))}
        {session && (
          <RichiestePrivateSezione atleta_id={session.atleta.id} club_id={session.atleta.club_id} />
        )}
      </TabsContent>
    </Tabs>
  );
};

const CorsoCard: React.FC<{ corso: any; stato: "iscritto" | "richiesta" | "libero"; on_richiedi?: () => void; t: (k: string) => string }> = ({ corso, stato, on_richiedi, t }) => (
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
