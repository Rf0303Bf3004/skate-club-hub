import React from "react";
import { useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Trophy, Sparkles, ClipboardCheck, Archive, ExternalLink, Inbox } from "lucide-react";
import { toast } from "@/hooks/use-toast";

interface NotificaStaffRow {
  id: string;
  comunicazione_id: string;
  letto_at: string | null;
  archiviato_at: string | null;
  creato_at: string;
  comunicazione: {
    id: string;
    titolo: string;
    testo: string;
    tipo: string;
    created_at: string;
    gara_id: string | null;
    evento_straordinario_id: string | null;
    test_livello_id: string | null;
  } | null;
}

export function use_iscrizioni_atleti_notifiche(include_archiviate = false) {
  const { session } = useAuth();
  return useQuery({
    queryKey: ["notifiche_staff_iscrizioni", session?.user_id, include_archiviate],
    enabled: !!session?.user_id,
    queryFn: async (): Promise<NotificaStaffRow[]> => {
      const { data, error } = await supabase
        .from("comunicazioni_destinatari_staff")
        .select(`
          id, comunicazione_id, letto_at, archiviato_at, creato_at,
          comunicazione:comunicazioni!inner(
            id, titolo, testo, tipo, created_at,
            gara_id, evento_straordinario_id, test_livello_id, club_id
          )
        `)
        .eq("user_id", session!.user_id)
        .eq("club_id", session!.club_id)
        .order("creato_at", { ascending: false });
      if (error) throw error;
      const rows = (data ?? []) as any[];
      return rows.filter((r) => {
        if (r.comunicazione?.tipo !== "iscrizione_atleta") return false;
        if (!include_archiviate && r.archiviato_at) return false;
        return true;
      });
    },
  });
}

export function use_count_iscrizioni_non_lette() {
  const q = use_iscrizioni_atleti_notifiche(false);
  const count = (q.data ?? []).filter((n) => !n.letto_at).length;
  return count;
}

export const IscrizioniAtletiNotifiche: React.FC = () => {
  const { data = [], isLoading } = use_iscrizioni_atleti_notifiche(false);
  const qc = useQueryClient();
  const navigate = useNavigate();

  const mark_read = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("comunicazioni_destinatari_staff")
        .update({ letto_at: new Date().toISOString(), stato: "letta" })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["notifiche_staff_iscrizioni"] }),
  });

  const archive = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("comunicazioni_destinatari_staff")
        .update({ archiviato_at: new Date().toISOString() })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["notifiche_staff_iscrizioni"] });
      toast({ title: "Notifica archiviata" });
    },
  });

  const get_icon = (c: NotificaStaffRow["comunicazione"]) => {
    if (!c) return Inbox;
    if (c.gara_id) return Trophy;
    if (c.evento_straordinario_id) return Sparkles;
    if (c.test_livello_id) return ClipboardCheck;
    return Inbox;
  };

  const get_color = (c: NotificaStaffRow["comunicazione"]) => {
    if (!c) return "text-muted-foreground bg-muted";
    if (c.gara_id) return "text-amber-600 bg-amber-50 dark:bg-amber-950/30";
    if (c.evento_straordinario_id) return "text-purple-600 bg-purple-50 dark:bg-purple-950/30";
    if (c.test_livello_id) return "text-blue-600 bg-blue-50 dark:bg-blue-950/30";
    return "text-muted-foreground bg-muted";
  };

  const handle_open = (n: NotificaStaffRow) => {
    if (!n.letto_at) mark_read.mutate(n.id);
    const c = n.comunicazione;
    if (!c) return;
    if (c.gara_id) navigate(`/gare/${c.gara_id}`);
    else if (c.test_livello_id) navigate(`/test`);
    else if (c.evento_straordinario_id) navigate(`/campi-eventi`);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-32">
        <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary" />
      </div>
    );
  }

  if (data.length === 0) {
    return (
      <div className="bg-card rounded-xl shadow-card p-12 text-center space-y-3">
        <Inbox className="w-12 h-12 text-muted-foreground/50 mx-auto" />
        <div>
          <h3 className="text-base font-semibold text-foreground">Nessuna iscrizione recente</h3>
          <p className="text-sm text-muted-foreground">
            Le notifiche di iscrizione degli atleti dall'app appariranno qui.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {data.map((n) => {
        const c = n.comunicazione;
        if (!c) return null;
        const Icon = get_icon(c);
        const color_cls = get_color(c);
        const non_letta = !n.letto_at;
        return (
          <div
            key={n.id}
            className={`bg-card rounded-xl shadow-card p-4 hover:shadow-card-hover transition-all ${
              non_letta ? "border-l-4 border-l-primary" : ""
            }`}
          >
            <div className="flex items-start gap-3">
              <div className={`w-10 h-10 rounded-lg flex items-center justify-center shrink-0 ${color_cls}`}>
                <Icon className="w-5 h-5" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-start justify-between gap-2">
                  <h3 className="font-semibold text-foreground text-sm leading-tight">
                    {c.titolo}
                    {non_letta && (
                      <Badge variant="default" className="ml-2 text-[10px] py-0 px-1.5 align-middle">
                        Nuovo
                      </Badge>
                    )}
                  </h3>
                  <p className="text-[11px] tabular-nums text-muted-foreground shrink-0">
                    {new Date(n.creato_at).toLocaleDateString("it-CH", {
                      day: "2-digit",
                      month: "2-digit",
                      year: "numeric",
                    })}
                  </p>
                </div>
                <p className="text-sm text-muted-foreground mt-1">{c.testo}</p>
                <div className="flex items-center gap-2 mt-3">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handle_open(n)}
                    className="h-8 text-xs"
                  >
                    <ExternalLink className="w-3.5 h-3.5 mr-1" />
                    Apri evento
                  </Button>
                  {non_letta && (
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => mark_read.mutate(n.id)}
                      className="h-8 text-xs"
                    >
                      Segna come letta
                    </Button>
                  )}
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => archive.mutate(n.id)}
                    className="h-8 text-xs ml-auto text-muted-foreground"
                  >
                    <Archive className="w-3.5 h-3.5 mr-1" />
                    Archivia
                  </Button>
                </div>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
};
