import React, { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase, get_current_club_id } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ChevronDown, ChevronRight, Send, MessageSquare } from "lucide-react";
import { toast } from "@/hooks/use-toast";

type Destinatario = {
  id: string;
  atleta_id: string;
  rsvp_risposta: string | null;
  rsvp_at: string | null;
  atleti?: { nome: string; cognome: string } | null;
};

type Conversazione = {
  id: string;
  titolo: string;
  testo: string;
  created_at: string;
  rsvp_scadenza: string | null;
  destinatari: Destinatario[];
};

function format_date(iso: string | null) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("it-CH", { day: "2-digit", month: "2-digit", year: "numeric" });
}

export const ConversazioniTab: React.FC = () => {
  const qc = useQueryClient();
  const [open_id, set_open_id] = useState<string | null>(null);

  const { data: conversazioni = [], isLoading } = useQuery({
    queryKey: ["comunicazioni_conversazioni", get_current_club_id()],
    queryFn: async (): Promise<Conversazione[]> => {
      const club_id = get_current_club_id();
      const { data, error } = await supabase
        .from("comunicazioni")
        .select(`
          id, titolo, testo, created_at, rsvp_scadenza,
          destinatari:comunicazioni_destinatari(
            id, atleta_id, rsvp_risposta, rsvp_at,
            atleti:atleti(nome, cognome)
          )
        `)
        .eq("club_id", club_id)
        .eq("richiede_rsvp", true)
        .eq("archiviata", false)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as any;
    },
  });

  const sollecita = useMutation({
    mutationFn: async (conv: Conversazione) => {
      const in_attesa = conv.destinatari.filter((d) => !d.rsvp_risposta).map((d) => d.atleta_id);
      if (in_attesa.length === 0) throw new Error("Nessun destinatario in attesa");
      const { error } = await supabase.from("comunicazioni").insert({
        club_id: get_current_club_id(),
        titolo: `🔔 Promemoria: ${conv.titolo}`,
        testo: `Ti ricordiamo di rispondere alla comunicazione:\n\n${conv.testo}`,
        tipo: "promemoria",
        tipo_destinatari: "atleti",
        atleti_ids: in_attesa,
        richiede_rsvp: true,
        categoria: "inviata",
      });
      if (error) throw error;
      return in_attesa.length;
    },
    onSuccess: (n) => {
      toast({ title: `📨 Sollecito inviato a ${n} destinatari` });
      qc.invalidateQueries({ queryKey: ["comunicazioni"] });
      qc.invalidateQueries({ queryKey: ["comunicazioni_conversazioni"] });
    },
    onError: (err: any) => toast({ title: "Errore", description: err?.message, variant: "destructive" }),
  });

  if (isLoading) {
    return <div className="text-sm text-muted-foreground py-8 text-center">Caricamento conversazioni…</div>;
  }

  if (conversazioni.length === 0) {
    return (
      <div className="bg-card rounded-xl shadow-card p-12 text-center space-y-3">
        <MessageSquare className="w-12 h-12 text-muted-foreground/40 mx-auto" />
        <p className="text-sm text-muted-foreground">Nessuna conversazione con risposta richiesta.</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {conversazioni.map((conv) => {
        const tot = conv.destinatari.length;
        const conferme = conv.destinatari.filter((d) => d.rsvp_risposta === "si").length;
        const rifiuti = conv.destinatari.filter((d) => d.rsvp_risposta === "no").length;
        const in_attesa = tot - conferme - rifiuti;
        const expanded = open_id === conv.id;
        return (
          <div key={conv.id} className="bg-card rounded-xl shadow-card border border-border overflow-hidden">
            <div className="p-4">
              <div className="flex items-start justify-between gap-3">
                <button
                  onClick={() => set_open_id(expanded ? null : conv.id)}
                  className="flex items-start gap-2 text-left flex-1 min-w-0"
                >
                  {expanded ? <ChevronDown className="w-4 h-4 mt-1" /> : <ChevronRight className="w-4 h-4 mt-1" />}
                  <div className="min-w-0 flex-1">
                    <h3 className="font-semibold text-foreground truncate">{conv.titolo}</h3>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      Inviata il {format_date(conv.created_at)} a {tot} destinatari
                    </p>
                    <div className="flex flex-wrap gap-2 mt-2">
                      <Badge className="bg-success/15 text-success border-success/30" variant="outline">✓ {conferme} conferme</Badge>
                      <Badge className="bg-destructive/15 text-destructive border-destructive/30" variant="outline">❌ {rifiuti} rifiuti</Badge>
                      <Badge className="bg-warning/15 text-warning border-warning/30" variant="outline">⏳ {in_attesa} in attesa</Badge>
                    </div>
                  </div>
                </button>
                {in_attesa > 0 && (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => sollecita.mutate(conv)}
                    disabled={sollecita.isPending}
                    className="shrink-0"
                  >
                    <Send className="w-3.5 h-3.5 mr-1.5" /> Sollecita non rispondenti
                  </Button>
                )}
              </div>
            </div>
            {expanded && (
              <div className="border-t border-border bg-muted/20 px-4 py-3 space-y-1.5 max-h-80 overflow-y-auto">
                {conv.destinatari.map((d) => {
                  const nome = d.atleti ? `${d.atleti.cognome} ${d.atleti.nome}` : d.atleta_id.slice(0, 8);
                  const stato = d.rsvp_risposta === "si"
                    ? <span className="text-success">✓ confermato il {format_date(d.rsvp_at)}</span>
                    : d.rsvp_risposta === "no"
                    ? <span className="text-destructive">❌ rifiutato il {format_date(d.rsvp_at)}</span>
                    : <span className="text-warning">⏳ in attesa</span>;
                  return (
                    <div key={d.id} className="flex items-center justify-between gap-3 text-sm py-1 border-b border-border/40 last:border-0">
                      <span className="text-foreground">{nome}</span>
                      <span className="text-xs">{stato}</span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
};
