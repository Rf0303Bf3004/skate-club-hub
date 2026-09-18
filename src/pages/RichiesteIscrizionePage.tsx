import React, { useState } from "react";
import { Navigate } from "react-router-dom";
import { ClipboardList } from "lucide-react";
import { useTranslation } from "react-i18next";
import { usePermessiSezioniMatrix } from "@/hooks/usePermessi";
import { usePermessiAzione } from "@/hooks/use-permessi-azione";
import NotaPermesso from "@/components/common/NotaPermesso";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import TabRinnovi from "@/components/iscrizioni/TabRinnovi";
import TabDomandeNuove from "@/components/iscrizioni/TabDomandeNuove";
import TabRichiesteCorsi from "@/components/iscrizioni/TabRichiesteCorsi";
import { use_richieste_iscrizione } from "@/hooks/use-supabase-data";
import { use_domande_iscrizione } from "@/hooks/use-iscrizioni-stagione";

/**
 * Una pagina sola per tutto quello che la segreteria deve decidere:
 * rinnovi di stagione, domande delle famiglie nuove, richieste ai corsi.
 */
const RichiesteIscrizionePage: React.FC = () => {
  const { t } = useTranslation("atleti");
  const k = (s: string, o?: any) => t(`iscrizioni_stagione.${s}`, o as any) as string;
  const { puo_gestire_sportivo } = usePermessiAzione();
  const { visibile_set, is_admin_like, is_loading: is_loading_permessi } = usePermessiSezioniMatrix();
  const allowed = is_admin_like || visibile_set.has("richieste_iscrizione");
  const [scheda, set_scheda] = useState("rinnovi");

  // Bollini sulle schede: si mostrano solo su letture riuscite, mai un numero
  // più basso del vero.
  const richieste_corsi = use_richieste_iscrizione();
  const domande = use_domande_iscrizione();
  const corsi_in_attesa = richieste_corsi.isSuccess
    ? ((richieste_corsi.data ?? []) as any[]).filter((r) => r.stato === "in_attesa").length
    : null;
  const domande_in_attesa = domande.isSuccess ? (domande.data ?? []).length : null;

  const Bollino: React.FC<{ n: number | null }> = ({ n }) =>
    n && n > 0 ? (
      <span className="ml-2 inline-flex items-center justify-center min-w-5 h-5 px-1.5 rounded-full bg-destructive text-destructive-foreground text-[10px] font-bold tabular-nums">
        {n}
      </span>
    ) : null;

  if (is_loading_permessi) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  if (!allowed) return <Navigate to="/" replace />;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <div className="p-2 rounded-lg bg-primary/10">
          <ClipboardList className="w-5 h-5 text-primary" />
        </div>
        <div>
          <h1 className="text-xl font-bold tracking-tight text-foreground">{t("richieste_iscrizione.page_title")}</h1>
          <p className="text-sm text-muted-foreground">{t("richieste_iscrizione.page_subtitle")}</p>
        </div>
      </div>

      {!puo_gestire_sportivo && (
        <NotaPermesso testo={k("comune.sola_lettura")} />
      )}

      <Tabs value={scheda} onValueChange={set_scheda}>
        <TabsList>
          <TabsTrigger value="rinnovi">{k("tabs.rinnovi")}</TabsTrigger>
          <TabsTrigger value="domande">{k("tabs.domande")}</TabsTrigger>
          <TabsTrigger value="corsi">{k("tabs.corsi")}</TabsTrigger>
        </TabsList>

        <TabsContent value="rinnovi" className="mt-5">
          <TabRinnovi puo_gestire={puo_gestire_sportivo} />
        </TabsContent>
        <TabsContent value="domande" className="mt-5">
          <TabDomandeNuove puo_gestire={puo_gestire_sportivo} />
        </TabsContent>
        <TabsContent value="corsi" className="mt-5">
          <TabRichiesteCorsi puo_gestire_sportivo={puo_gestire_sportivo} />
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default RichiesteIscrizionePage;
