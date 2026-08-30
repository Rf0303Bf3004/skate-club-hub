import React from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/auth";
import { Card, CardContent } from "@/components/ui/card";
import { AlertTriangle, ShieldCheck } from "lucide-react";

const RUOLI_AMMESSI = ["presidente", "segreteria", "admin", "superadmin"];

/** Card dashboard: conteggio segnalazioni non viste, porta alla pagina Diagnostica. */
export default function DiagnosticaCard() {
  const { session } = useAuth();
  const navigate = useNavigate();
  const club_id = session?.club_id;
  const ammesso = RUOLI_AMMESSI.includes(String(session?.ruolo));

  const { data: non_visti = 0 } = useQuery({
    queryKey: ["diagnostica_non_visti", club_id],
    enabled: !!club_id && ammesso,
    refetchInterval: 120000,
    queryFn: async () => {
      const { count, error } = await supabase
        .from("errori_applicativi")
        .select("id", { count: "exact", head: true })
        .eq("club_id", club_id!)
        .eq("visto", false);
      if (error) {
        console.warn("[DiagnosticaCard] conteggio non disponibile", error);
        return 0;
      }
      return count ?? 0;
    },
  });

  if (!ammesso) return null;

  return (
    <Card
      onClick={() => navigate("/diagnostica")}
      className={`cursor-pointer transition-shadow hover:shadow-md ${non_visti > 0 ? "border-amber-300" : ""}`}
    >
      <CardContent className="p-4 flex items-center gap-3">
        {non_visti > 0 ? (
          <AlertTriangle className="w-8 h-8 text-amber-500 shrink-0" />
        ) : (
          <ShieldCheck className="w-8 h-8 text-emerald-500 shrink-0" />
        )}
        <div>
          <p className="text-2xl font-bold tabular-nums">{non_visti}</p>
          <p className="text-xs text-muted-foreground">
            {non_visti > 0 ? "segnalazioni da verificare" : "nessuna segnalazione"}
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
