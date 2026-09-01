import React from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Navigate } from "react-router-dom";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/auth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { AlertTriangle, CheckCheck, RefreshCw, PlayCircle, ChevronDown, Info, CircleCheck } from "lucide-react";
import { segnala_errore } from "@/lib/errori";
import { toast } from "sonner";

interface VoceDiagnosi {
  urgenza: number;
  fascia: string;
  club: string | null;
  titolo: string;
  dettaglio: string | null;
  significato: string | null;
  cosa_fare: string | null;
  chi: string | null;
  da_quando: string | null;
  ultima_volta: string | null;
  quante: number;
  righe: string[] | null;
}

const RUOLI_AMMESSI = ["superadmin"];

const ORDINE_FASCE = ["Da fare adesso", "Da sistemare quando puoi", "Solo per sapere"] as const;

const STILE_FASCIA: Record<string, { bordo: string; icona: React.ReactNode }> = {
  "Da fare adesso": {
    bordo: "border-l-4 border-l-destructive",
    icona: <AlertTriangle className="w-4 h-4 text-destructive" />,
  },
  "Da sistemare quando puoi": {
    bordo: "border-l-4 border-l-amber-400",
    icona: <AlertTriangle className="w-4 h-4 text-amber-500" />,
  },
  "Solo per sapere": {
    bordo: "border-l-4 border-l-muted-foreground/30",
    icona: <Info className="w-4 h-4 text-muted-foreground" />,
  },
};

export default function DiagnosticaPage() {
  const { session } = useAuth();
  const qc = useQueryClient();
  const [giorni, set_giorni] = React.useState("30");
  const [aperti, set_aperti] = React.useState<Record<string, boolean>>({});

  const club_id = session?.club_id;
  const ammesso = RUOLI_AMMESSI.includes(String(session?.ruolo));

  const { data = [], isLoading, refetch, isFetching } = useQuery({
    queryKey: ["cosa_non_va", club_id, giorni],
    enabled: ammesso,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("cosa_non_va" as any, {
        p_club: club_id ?? null,
        p_giorni: Number(giorni),
      });
      if (error) {
        await segnala_errore("DiagnosticaPage", "Lettura registro errori", error);
        return [] as VoceDiagnosi[];
      }
      return (data ?? []) as VoceDiagnosi[];
    },
  });

  const segna_visti = useMutation({
    mutationFn: async (ids: string[]) => {
      const { data, error } = await supabase
        .from("errori_applicativi")
        .update({ visto: true })
        .in("id", ids)
        .select("id");
      if (error) throw error;
      return data?.length ?? 0;
    },
    onSuccess: (n) => {
      toast.success(`${n} segnalazioni marcate come viste`);
      qc.invalidateQueries({ queryKey: ["cosa_non_va"] });
      qc.invalidateQueries({ queryKey: ["diagnostica_non_visti"] });
    },
    onError: (e) => segnala_errore("DiagnosticaPage", "Marca come visto", e),
  });

  const lancia_controlli = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.rpc("lancia_controlli_notturni" as any);
      if (error) throw error;
    },
    onSuccess: async () => {
      toast.success("Controlli eseguiti");
      await qc.invalidateQueries({ queryKey: ["cosa_non_va"] });
      qc.invalidateQueries({ queryKey: ["diagnostica_non_visti"] });
    },
    onError: (e) => segnala_errore("DiagnosticaPage", "Esecuzione controlli", e),
  });

  if (!ammesso) return <Navigate to="/" replace />;

  const per_fascia = ORDINE_FASCE.map((fascia) => ({
    fascia,
    voci: data.filter((v) => v.fascia === fascia),
  })).filter((b) => b.voci.length > 0);

  const tutto_ok = !isLoading && per_fascia.length === 0;
  const nulla_di_urgente = !isLoading && data.filter((v) => v.urgenza === 1).length === 0;


  return (
    <div className="p-6 space-y-6">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Diagnostica</h1>
          <p className="text-sm text-muted-foreground">
            Cosa c'è da fare, spiegato in parole semplici.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Select value={giorni} onValueChange={set_giorni}>
            <SelectTrigger className="w-36"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="7">Ultimi 7 giorni</SelectItem>
              <SelectItem value="30">Ultimi 30 giorni</SelectItem>
              <SelectItem value="90">Ultimi 90 giorni</SelectItem>
            </SelectContent>
          </Select>
          <Button variant="secondary" size="sm" onClick={() => lancia_controlli.mutate()} disabled={lancia_controlli.isPending}>
            <PlayCircle className={`w-4 h-4 mr-1 ${lancia_controlli.isPending ? "animate-pulse" : ""}`} /> Esegui i controlli adesso
          </Button>
          <Button variant="outline" size="sm" onClick={() => refetch()} disabled={isFetching}>
            <RefreshCw className={`w-4 h-4 mr-1 ${isFetching ? "animate-spin" : ""}`} /> Aggiorna
          </Button>
        </div>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-10">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
        </div>
      ) : tutto_ok ? (
        <Card>
          <CardContent className="py-10 flex flex-col items-center gap-2 text-center">
            <CircleCheck className="w-10 h-10 text-primary" />
            <p className="text-lg font-semibold">Va tutto bene</p>
            <p className="text-sm text-muted-foreground">
              Nessuna segnalazione nel periodo scelto. Non c'è nulla da fare.
            </p>
          </CardContent>
        </Card>
      ) : (
        <>
          {nulla_di_urgente && (
            <Card className="border-l-4 border-l-success">
              <CardContent className="py-4 flex items-center gap-3">
                <CircleCheck className="w-6 h-6 text-success" />
                <div>
                  <p className="font-medium">Nessun problema da risolvere adesso</p>
                  <p className="text-sm text-muted-foreground">Qui sotto trovi solo cose da sistemare con calma.</p>
                </div>
              </CardContent>
            </Card>
          )}
          {per_fascia.map(({ fascia, voci }) => {
          const stile = STILE_FASCIA[fascia];
          const calmo = fascia === "Solo per sapere";
          const aperto_fascia = fasce_aperte[fascia] ?? !calmo;
          return (
            <Card key={fascia}>
              <CardHeader className="pb-3">
                <button
                  type="button"
                  className="w-full text-left"
                  onClick={() => set_fasce_aperte((p) => ({ ...p, [fascia]: !aperto_fascia }))}
                >
                  <CardTitle className={`text-base flex items-center gap-2 ${calmo ? "text-muted-foreground" : ""}`}>
                    {stile.icona}
                    {fascia} ({voci.length})
                    <ChevronDown className={`w-4 h-4 ml-auto transition-transform ${aperto_fascia ? "rotate-180" : ""}`} />
                  </CardTitle>
                </button>
              </CardHeader>
              {aperto_fascia && (
              <CardContent className="space-y-2">

                {voci.map((v, i) => {
                  const key = `${fascia}-${v.titolo}-${i}`;
                  const aperto = !!aperti[key];
                  return (
                    <div key={key} className={`rounded-md border bg-card p-4 ${stile.bordo}`}>
                      <div className="flex items-start gap-3 flex-wrap">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className={`font-semibold ${calmo ? "text-foreground/80" : ""}`}>{v.titolo}</span>
                            {v.da_quando && (
                              <span className="text-xs text-muted-foreground">{v.da_quando}</span>
                            )}
                            {v.quante > 1 && (
                              <Badge variant="outline" className="text-[10px]">{v.quante} segnalazioni</Badge>
                            )}
                          </div>
                          {v.significato && (
                            <p className="text-sm text-muted-foreground mt-1 break-words">{v.significato}</p>
                          )}
                          {v.cosa_fare && (
                            <p className="text-sm font-medium mt-2 break-words">
                              <span className="text-muted-foreground font-normal">Cosa fare: </span>
                              {v.cosa_fare}
                            </p>
                          )}
                          {v.dettaglio && (
                            <Collapsible open={aperto} onOpenChange={(o) => set_aperti((p) => ({ ...p, [key]: o }))}>
                              <CollapsibleTrigger className="mt-2 inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground">
                                <ChevronDown className={`w-3 h-3 transition-transform ${aperto ? "rotate-180" : ""}`} />
                                {aperto ? "Nascondi dettaglio" : "Mostra dettaglio"}
                              </CollapsibleTrigger>
                              <CollapsibleContent>
                                <p className="text-xs text-muted-foreground mt-2 break-words rounded bg-muted/50 p-2">
                                  {v.dettaglio}
                                  {v.ultima_volta && <span className="block mt-1 opacity-80">Ultima volta: {v.ultima_volta}</span>}
                                </p>
                              </CollapsibleContent>
                            </Collapsible>
                          )}
                        </div>
                        <div className="flex flex-col items-end gap-2 shrink-0">
                          {v.chi && (
                            <Badge variant="secondary" className="text-[10px] uppercase tracking-wide">{v.chi}</Badge>
                          )}
                          {v.righe && v.righe.length > 0 && (
                            <Button variant="ghost" size="sm" onClick={() => segna_visti.mutate(v.righe!)}
                              disabled={segna_visti.isPending}>
                              <CheckCheck className="w-4 h-4 mr-1" /> Segna come visto
                            </Button>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </CardContent>
              )}
            </Card>
          );
          })}
        </>
      )}
    </div>
  );
}
