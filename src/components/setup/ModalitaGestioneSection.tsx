import React from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase, get_current_club_id } from "@/lib/supabase";
import { useAuth } from "@/lib/auth";
import { useModalitaArea } from "@/hooks/useModalitaArea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "@/hooks/use-toast";
import { Check, FlaskConical } from "lucide-react";

/**
 * Sezione avanzata/sperimentale: permette al Presidente/admin di scegliere una
 * modalità di gestione alternativa ("Tailor Made") per un'area operativa.
 * Additiva: nessuna schermata esistente cambia comportamento.
 */
export const ModalitaGestioneSection: React.FC = () => {
  const { session } = useAuth();
  const allowed = !!session && ["superadmin", "admin", "presidente"].includes(session.ruolo);
  const queryClient = useQueryClient();
  const { modalita, is_loading } = useModalitaArea("ghiaccio");
  const [just_saved, set_just_saved] = React.useState(false);

  const salva = useMutation({
    mutationFn: async (nuova_modalita: string) => {
      const club_id = get_current_club_id();
      if (!club_id) throw new Error("Club non disponibile");
      const { error } = await supabase
        .from("moduli_gestione_club" as any)
        .upsert(
          {
            club_id,
            area: "ghiaccio",
            modalita: nuova_modalita,
            attivato_da: session?.user_id ?? null,
            attivato_at: new Date().toISOString(),
          } as any,
          { onConflict: "club_id,area" }
        );
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["moduli_gestione_club"] });
      toast({ title: "Modalità aggiornata" });
    },
    onError: (e: any) => {
      toast({ title: "Errore", description: e?.message ?? "Salvataggio non riuscito", variant: "destructive" });
    },
  });

  React.useEffect(() => {
    if (salva.isSuccess) {
      set_just_saved(true);
      const timer = setTimeout(() => set_just_saved(false), 2500);
      return () => clearTimeout(timer);
    }
  }, [salva.isSuccess]);

  if (!allowed) return null;

  return (
    <section className="space-y-4 rounded-xl border border-dashed border-muted-foreground/30 bg-muted/30 p-4">
      <div className="flex items-center gap-2">
        <FlaskConical className="w-4 h-4 text-muted-foreground" />
        <h2 className="text-sm font-bold text-muted-foreground uppercase tracking-widest">
          Modalità di gestione
        </h2>
        <Badge variant="outline" className="text-[10px]">Avanzato</Badge>
      </div>

      <div className="space-y-1.5 max-w-md">
        <Label className="text-xs text-muted-foreground">Ghiaccio</Label>
        <Select
          value={modalita}
          disabled={is_loading || salva.isPending}
          onValueChange={(v) => salva.mutate(v)}
        >
          <SelectTrigger className="h-10">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="standard">Standard (corsi settimanali ricorrenti)</SelectItem>
            <SelectItem value="griglia_giornaliera">
              <span className="flex items-center gap-2">
                Griglia giornaliera (Tailor Made)
                <Badge variant="secondary" className="text-[10px]">In costruzione</Badge>
              </span>
            </SelectItem>
          </SelectContent>
        </Select>
        <p className="text-xs text-muted-foreground">
          Cambia il modo in cui questo club gestisce l'area Ghiaccio. La modalità Standard resta quella
          predefinita e consigliata per la maggior parte dei club.
        </p>
      </div>
    </section>
  );
};

export default ModalitaGestioneSection;
