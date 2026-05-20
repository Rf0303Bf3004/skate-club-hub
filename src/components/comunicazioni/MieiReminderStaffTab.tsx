import React from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase, get_current_club_id } from "@/lib/supabase";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Check, X, Loader2, BellRing } from "lucide-react";
import { toast } from "@/hooks/use-toast";

// Tab "I miei reminder" — mostra a istruttori/staff i reminder turno del giorno successivo
// con bottoni Sarò presente / Sarò assente. I trigger DB gestiscono le conseguenze.
export const MieiReminderStaffTab: React.FC = () => {
  const { user } = useAuth();
  const club_id = get_current_club_id();
  const qc = useQueryClient();
  const [busy_id, set_busy_id] = React.useState<string | null>(null);

  const { data: reminders = [], isLoading } = useQuery({
    queryKey: ["miei_reminder_staff", user?.id, club_id],
    enabled: !!user?.id && !!club_id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("comunicazioni_destinatari_staff")
        .select("id, stato, rsvp_risposta, rsvp_at, creato_at, comunicazione_id, comunicazioni!inner(id, titolo, testo, sotto_tipo, data_evento, urgente)")
        .eq("user_id", user!.id)
        .eq("club_id", club_id)
        .eq("comunicazioni.sotto_tipo", "reminder_staff")
        .order("creato_at", { ascending: false })
        .limit(50);
      if (error) throw error;
      return (data ?? []) as any[];
    },
  });

  const handle_rsvp = async (dest_id: string, risposta: "si" | "no") => {
    set_busy_id(dest_id);
    try {
      const { error } = await supabase
        .from("comunicazioni_destinatari_staff")
        .update({ rsvp_risposta: risposta, rsvp_at: new Date().toISOString(), stato: risposta === "si" ? "confermato" : "rifiutato" })
        .eq("id", dest_id);
      if (error) throw error;
      toast({ title: risposta === "si" ? "✅ Presenza confermata" : "❌ Assenza segnalata al club" });
      qc.invalidateQueries({ queryKey: ["miei_reminder_staff"] });
      qc.invalidateQueries({ queryKey: ["comunicazioni"] });
    } catch (err: any) {
      toast({ title: "Errore", description: err?.message, variant: "destructive" });
    } finally {
      set_busy_id(null);
    }
  };

  if (isLoading) {
    return <div className="flex items-center justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-primary" /></div>;
  }

  if (reminders.length === 0) {
    return (
      <div className="bg-card border border-dashed border-border rounded-xl p-10 text-center">
        <BellRing className="w-12 h-12 text-muted-foreground/40 mx-auto mb-3" />
        <p className="text-sm text-muted-foreground">Nessun reminder turno staff per te al momento.</p>
        <p className="text-xs text-muted-foreground mt-1">Riceverai un avviso il giorno prima di ogni corso a cui sei assegnato.</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {reminders.map((r) => {
        const com = r.comunicazioni;
        const gia_risposto = !!r.rsvp_risposta;
        return (
          <div key={r.id} className={`bg-card border rounded-xl p-4 shadow-sm ${com?.urgente ? "border-destructive/40" : "border-border"}`}>
            <div className="flex items-start justify-between gap-3 mb-2">
              <div className="flex-1 min-w-0">
                <h3 className="text-sm font-bold text-foreground">{com?.titolo}</h3>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {com?.data_evento && new Date(com.data_evento + "T00:00:00").toLocaleDateString("it-CH", { weekday: "long", day: "2-digit", month: "long" })}
                </p>
              </div>
              {gia_risposto && (
                <Badge variant={r.rsvp_risposta === "si" ? "default" : "destructive"}>
                  {r.rsvp_risposta === "si" ? "✅ Confermato" : "❌ Assente"}
                </Badge>
              )}
            </div>
            <p className="text-sm text-foreground/80 whitespace-pre-wrap mb-3">{com?.testo}</p>
            {!gia_risposto && (
              <div className="flex gap-2 pt-2 border-t border-border">
                <Button size="sm" className="flex-1" onClick={() => handle_rsvp(r.id, "si")} disabled={busy_id === r.id}>
                  <Check className="w-4 h-4 mr-1" /> Sarò presente
                </Button>
                <Button size="sm" variant="outline" className="flex-1" onClick={() => handle_rsvp(r.id, "no")} disabled={busy_id === r.id}>
                  <X className="w-4 h-4 mr-1" /> Sarò assente
                </Button>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
};
