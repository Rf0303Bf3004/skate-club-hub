import React, { useState } from "react";
import { Navigate, useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "@/lib/auth";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { use_stagioni } from "@/hooks/use-supabase-data";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from "@/components/ui/tooltip";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { FileDown, Maximize2 } from "lucide-react";
import Compositore from "@/components/relazione/Compositore";
import PresidentRelazioneGestione from "./PresidentRelazioneGestione";

export default function PresidentRelazione() {
  const { session } = useAuth();
  const nav = useNavigate();
  const loc = useLocation();
  const { data: stagioni = [] } = use_stagioni();
  const stagione_attiva = (stagioni as any[]).find((s) => s.attiva) || (stagioni as any[])[0];
  const [stagione_id, set_stagione_id] = useState<string | undefined>(undefined);
  const [fullscreen, set_fullscreen] = useState(false);

  React.useEffect(() => {
    if (!stagione_id && stagione_attiva) set_stagione_id(stagione_attiva.id);
  }, [stagione_attiva, stagione_id]);

  const { data: club } = useQuery({
    queryKey: ["club_for_relazione", session?.club_id],
    enabled: !!session?.club_id,
    queryFn: async () => {
      const { data } = await supabase.from("clubs").select("*").eq("id", session!.club_id!).maybeSingle();
      return data;
    },
  });

  // hook order safe: counts independent of role
  if (session && (session.ruolo as string) !== "presidente") {
    return <Navigate to="/" replace />;
  }

  const is_contenuti = loc.pathname.endsWith("/contenuti");
  const stagione_nome = (stagioni as any[]).find((s) => s.id === stagione_id)?.nome ?? "—";

  // active sections count via cached compositore items would require lifting; quick estimate
  return (
    <div className={fullscreen ? "fixed inset-0 z-50 bg-background p-6 overflow-auto" : "space-y-4"}>
      <header className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div>
          <h1 className="text-3xl font-serif tracking-tight text-foreground">Relazione di fine stagione</h1>
          <p className="text-sm text-muted-foreground mt-1 max-w-2xl">
            Componi visualmente la relazione PDF che andrà ai soci e agli stakeholder.
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <Select value={stagione_id} onValueChange={set_stagione_id}>
            <SelectTrigger className="w-44 h-9 text-sm"><SelectValue placeholder="Stagione" /></SelectTrigger>
            <SelectContent>
              {(stagioni as any[]).map((s) => (
                <SelectItem key={s.id} value={s.id}>{s.nome}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button variant="outline" size="sm" className="gap-2 h-9" onClick={() => set_fullscreen((f) => !f)}>
            <Maximize2 className="w-4 h-4" />{fullscreen ? "Esci fullscreen" : "Fullscreen"}
          </Button>
          <span className="text-xs text-muted-foreground hidden md:inline">
            Usa il bottone "Genera PDF" nel compositore
          </span>
      </header>

      <Tabs value={is_contenuti ? "contenuti" : "compositore"} onValueChange={(v) => {
        if (v === "compositore") nav("/presidente/relazione");
        else nav("/presidente/relazione/contenuti");
      }}>
        <TabsList>
          <TabsTrigger value="compositore">Compositore</TabsTrigger>
          <TabsTrigger value="contenuti">Contenuti</TabsTrigger>
        </TabsList>
      </Tabs>

      {is_contenuti ? (
        <PresidentRelazioneGestione />
      ) : (
        stagione_id && session?.club_id && (
          <Compositore
            club_id={session.club_id}
            stagione_id={stagione_id}
            club={club}
            presidente={`${session.nome ?? ""} ${session.cognome ?? ""}`.trim() || session.email || "Presidente"}
            stagione_nome={stagione_nome}
          />
        )
      )}
    </div>
  );
}
