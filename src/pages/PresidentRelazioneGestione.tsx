import React, { useState } from "react";
import { Navigate, useLocation, useSearchParams } from "react-router-dom";
import { useAuth } from "@/lib/auth";
import { use_stagioni } from "@/hooks/use-supabase-data";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from "@/components/ui/tooltip";
import { FileDown } from "lucide-react";
import BlocchiTestoTab from "@/components/relazione/BlocchiTestoTab";
import AllegatiTab from "@/components/relazione/AllegatiTab";
import ParagrafiTab from "@/components/relazione/ParagrafiTab";

export default function PresidentRelazioneGestione() {
  const { session } = useAuth();
  const loc = useLocation();
  const embedded = loc.pathname.startsWith("/presidente/relazione");
  const { data: stagioni = [] } = use_stagioni();
  const stagione_attiva = (stagioni as any[]).find((s) => s.attiva) || (stagioni as any[])[0];
  const [stagione_id, set_stagione_id] = useState<string | undefined>(undefined);
  const [search_params, set_search_params] = useSearchParams();
  const tab_param = search_params.get("tab");
  const tab_attivo = tab_param === "paragrafi" || tab_param === "allegati" || tab_param === "blocchi"
    ? tab_param
    : "blocchi";

  React.useEffect(() => {
    if (!stagione_id && stagione_attiva) set_stagione_id(stagione_attiva.id);
  }, [stagione_attiva, stagione_id]);

  if (session && (session.ruolo as string) !== "presidente") {
    return <Navigate to="/" replace />;
  }

  return (
    <div className="space-y-6">
      {!embedded && (
        <header className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
          <div>
            <h1 className="text-3xl font-serif tracking-tight text-foreground">Gestione Relazione</h1>
            <p className="text-sm text-muted-foreground mt-1 max-w-2xl">
              Configura i contenuti redazionali e gli allegati che andranno nella relazione PDF di fine stagione.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Select value={stagione_id} onValueChange={set_stagione_id}>
              <SelectTrigger className="w-44 h-9 text-sm"><SelectValue placeholder="Stagione" /></SelectTrigger>
              <SelectContent>
                {(stagioni as any[]).map((s) => (
                  <SelectItem key={s.id} value={s.id}>{s.nome}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <span>
                    <Button disabled variant="outline" className="gap-2">
                      <FileDown className="w-4 h-4" />
                      Anteprima relazione
                    </Button>
                  </span>
                </TooltipTrigger>
                <TooltipContent>Disponibile nel prossimo step</TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>
        </header>
      )}

      {stagione_id && session?.club_id && (
        <Tabs
          value={tab_attivo}
          onValueChange={(v) => {
            const next = new URLSearchParams(search_params);
            next.set("tab", v);
            set_search_params(next, { replace: true });
          }}
          className="w-full"
        >
          <TabsList>
            <TabsTrigger value="blocchi">Notizie del Presidente</TabsTrigger>
            <TabsTrigger value="paragrafi">Racconto dei dati</TabsTrigger>
            <TabsTrigger value="allegati">Documenti allegati</TabsTrigger>
          </TabsList>
          <TabsContent value="blocchi" className="mt-4">
            <BlocchiTestoTab club_id={session.club_id} stagione_id={stagione_id} />
          </TabsContent>
          <TabsContent value="paragrafi" className="mt-4">
            <ParagrafiTab club_id={session.club_id} stagione_id={stagione_id} />
          </TabsContent>
          <TabsContent value="allegati" className="mt-4">
            <AllegatiTab club_id={session.club_id} stagione_id={stagione_id} />
          </TabsContent>
        </Tabs>
      )}
    </div>
  );
}
