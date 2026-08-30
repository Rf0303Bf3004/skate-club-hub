import React from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Navigate } from "react-router-dom";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/auth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AlertTriangle, CheckCheck, RefreshCw, Eye } from "lucide-react";
import { segnala_errore } from "@/lib/errori";
import { toast } from "sonner";

interface RigaDiagnosi {
  gravita: string;
  dove: string;
  messaggio: string;
  quante: number;
  ultima: string;
  non_visti: number;
}

const RUOLI_AMMESSI = ["presidente", "segreteria", "admin", "superadmin"];

const STILE_GRAVITA: Record<string, string> = {
  errore: "bg-destructive/10 text-destructive border-destructive/30",
  avviso: "bg-amber-100 text-amber-800 border-amber-300",
  riuscito_a_vuoto: "bg-sky-100 text-sky-800 border-sky-300",
};

const ETICHETTA_GRAVITA: Record<string, string> = {
  errore: "Errore",
  avviso: "Avviso",
  riuscito_a_vuoto: "Riuscito a vuoto",
};

export default function DiagnosticaPage() {
  const { session } = useAuth();
  const qc = useQueryClient();
  const [giorni, set_giorni] = React.useState("30");

  const club_id = session?.club_id;
  const ammesso = RUOLI_AMMESSI.includes(String(session?.ruolo));

  const { data = [], isLoading, refetch, isFetching } = useQuery({
    queryKey: ["cosa_non_va", club_id, giorni],
    enabled: !!club_id && ammesso,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("cosa_non_va" as any, {
        p_club: club_id,
        p_giorni: Number(giorni),
      });
      if (error) {
        await segnala_errore("DiagnosticaPage", "Lettura registro errori", error);
        return [] as RigaDiagnosi[];
      }
      return (data ?? []) as RigaDiagnosi[];
    },
  });

  const segna_visti = useMutation({
    mutationFn: async (dove: string | null) => {
      let q = supabase.from("errori_applicativi").update({ visto: true }).eq("visto", false);
      if (club_id) q = q.eq("club_id", club_id);
      if (dove) q = q.eq("dove", dove);
      const { data, error } = await q.select("id");
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

  if (!ammesso) return <Navigate to="/" replace />;

  const totale_non_visti = data.reduce((s, r) => s + (r.non_visti ?? 0), 0);

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Diagnostica</h1>
          <p className="text-sm text-muted-foreground">
            Registro di ciò che non ha funzionato: errori, avvisi e operazioni riuscite a vuoto.
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
          <Button variant="outline" size="sm" onClick={() => refetch()} disabled={isFetching}>
            <RefreshCw className={`w-4 h-4 mr-1 ${isFetching ? "animate-spin" : ""}`} /> Aggiorna
          </Button>
          <Button size="sm" disabled={totale_non_visti === 0 || segna_visti.isPending}
            onClick={() => segna_visti.mutate(null)}>
            <CheckCheck className="w-4 h-4 mr-1" /> Segna tutto come visto
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-amber-500" />
            Segnalazioni ({data.length}) · non viste: {totale_non_visti}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex justify-center py-10">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
            </div>
          ) : data.length === 0 ? (
            <p className="text-sm text-muted-foreground py-6 text-center">
              Nessuna segnalazione nel periodo scelto. Tutto in ordine.
            </p>
          ) : (
            <div className="space-y-2">
              {data.map((r, i) => (
                <div key={`${r.dove}-${r.messaggio}-${i}`}
                  className={`rounded-md border p-3 flex items-start gap-3 ${STILE_GRAVITA[r.gravita] ?? "bg-muted"}`}>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <Badge variant="outline" className="text-[10px] uppercase tracking-wide">
                        {ETICHETTA_GRAVITA[r.gravita] ?? r.gravita}
                      </Badge>
                      <span className="font-medium text-sm">{r.dove}</span>
                      {r.non_visti > 0 && (
                        <Badge className="text-[10px]">{r.non_visti} non viste</Badge>
                      )}
                    </div>
                    <p className="text-sm mt-1 break-words">{r.messaggio}</p>
                    <p className="text-xs opacity-80 mt-1">
                      {r.quante} volte · ultima: {new Date(r.ultima).toLocaleString("it-CH")}
                    </p>
                  </div>
                  {r.non_visti > 0 && (
                    <Button variant="ghost" size="sm" onClick={() => segna_visti.mutate(r.dove)}
                      disabled={segna_visti.isPending}>
                      <Eye className="w-4 h-4 mr-1" /> Visto
                    </Button>
                  )}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
