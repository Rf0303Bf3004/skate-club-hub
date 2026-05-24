import React, { useEffect, useState } from "react";
import { useOutletContext } from "react-router-dom";
import { Loader2, Archive, ArchiveRestore, MessageSquare } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { toast } from "sonner";
import type { PortaleSession } from "@/lib/portale-auth";
import { useTranslation } from "react-i18next";

interface Dest {
  id: string;
  archiviato_at: string | null;
  creato_at: string;
  comunicazioni: { titolo: string; testo: string | null; corpo?: string | null } | null;
}

const PortaleNotiziePage: React.FC = () => {
  const { session } = useOutletContext<{ session: PortaleSession }>();
  const { t } = useTranslation("portale");
  const [loading, set_loading] = useState(true);
  const [items, set_items] = useState<Dest[]>([]);

  const load = async () => {
    set_loading(true);
    const { data } = await supabase
      .from("comunicazioni_destinatari")
      .select("id, archiviato_at, creato_at, comunicazioni(titolo, testo, corpo)")
      .eq("atleta_id", session.atleta.id)
      .order("creato_at", { ascending: false });
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

  const attive = items.filter((i) => !i.archiviato_at);
  const archivio = items.filter((i) => !!i.archiviato_at);

  if (loading) {
    return <div className="flex justify-center py-8"><Loader2 className="w-6 h-6 animate-spin text-sky-500" /></div>;
  }

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
              <h3 className="font-semibold text-slate-800">{it.comunicazioni?.titolo ?? "—"}</h3>
              <p className="text-[11px] text-slate-400 mt-0.5">
                {new Date(it.creato_at).toLocaleDateString("it-CH", { day: "2-digit", month: "2-digit", year: "numeric" })}
              </p>
            </div>
            <Button variant="ghost" size="sm" onClick={() => toggle_archive(it)}>
              {is_archive ? <ArchiveRestore className="w-4 h-4" /> : <Archive className="w-4 h-4" />}
            </Button>
          </div>
          <p className="text-sm text-slate-600 whitespace-pre-wrap">
            {it.comunicazioni?.testo ?? it.comunicazioni?.corpo ?? ""}
          </p>
        </div>
      ))}
    </div>
  );

  return (
    <div className="max-w-3xl mx-auto space-y-4">
      <h1 className="text-xl font-bold text-slate-800">{t("notizie.titolo")}</h1>
      <Tabs defaultValue="attive">
        <TabsList className="grid grid-cols-2 w-full">
          <TabsTrigger value="attive">{t("notizie.attive")} ({attive.length})</TabsTrigger>
          <TabsTrigger value="archivio">{t("notizie.archivio")} ({archivio.length})</TabsTrigger>
        </TabsList>
        <TabsContent value="attive">{render_list(attive, false)}</TabsContent>
        <TabsContent value="archivio">{render_list(archivio, true)}</TabsContent>
      </Tabs>
    </div>
  );
};

export default PortaleNotiziePage;
