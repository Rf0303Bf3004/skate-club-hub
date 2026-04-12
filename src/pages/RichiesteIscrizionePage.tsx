import React, { useState, useMemo } from "react";
import { use_richieste_iscrizione, use_atleti, use_corsi } from "@/hooks/use-supabase-data";
import { use_gestisci_richiesta } from "@/hooks/use-supabase-mutations";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Check, X, Clock, Search, MessageSquare, ClipboardList } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "@/hooks/use-toast";

type Filtro = "tutte" | "in_attesa" | "approvata" | "rifiutata";

const RichiesteIscrizionePage: React.FC = () => {
  const { session } = useAuth();
  const { data: richieste = [], isLoading: isLoadingRichieste, isError } = use_richieste_iscrizione();
  const { data: atleti = [], isLoading: isLoadingAtleti } = use_atleti();
  const { data: corsi = [], isLoading: isLoadingCorsi } = use_corsi();
  const isLoading = isLoadingRichieste || isLoadingAtleti || isLoadingCorsi;
  const gestisci = use_gestisci_richiesta();

  const [filtro, set_filtro] = useState<Filtro>("in_attesa");
  const [query, set_query] = useState("");
  const [modal, set_modal] = useState<{ richiesta: any; azione: "approvata" | "rifiutata" } | null>(null);
  const [note_risposta, set_note_risposta] = useState("");

  const get_atleta = (id: string) => atleti.find((a: any) => a.id === id);
  const get_corso = (id: string) => corsi.find((c: any) => c.id === id);

  const filtered = useMemo(() => {
    const q = query.toLowerCase();
    return richieste
      .filter((r: any) => filtro === "tutte" || r.stato === filtro)
      .filter((r: any) => {
        if (!q) return true;
        const a = get_atleta(r.atleta_id);
        const c = get_corso(r.corso_id);
        const name = a ? `${a.nome} ${a.cognome}` : "";
        const corso_nome = c?.nome || "";
        return name.toLowerCase().includes(q) || corso_nome.toLowerCase().includes(q);
      });
  }, [richieste, filtro, query, atleti, corsi]);

  const counts = useMemo(() => {
    const c = { in_attesa: 0, approvata: 0, rifiutata: 0 };
    richieste.forEach((r: any) => {
      if (r.stato in c) c[r.stato as keyof typeof c]++;
    });
    return c;
  }, [richieste]);

  const open_modal = (richiesta: any, azione: "approvata" | "rifiutata") => {
    set_note_risposta("");
    set_modal({ richiesta, azione });
  };

  const conferma = async () => {
    if (!modal) return;
    const r = modal.richiesta;
    const atleta = get_atleta(r.atleta_id);
    const corso = get_corso(r.corso_id);
    try {
      await gestisci.mutateAsync({
        richiesta_id: r.id,
        azione: modal.azione,
        atleta_id: r.atleta_id,
        atleta_nome: atleta ? `${atleta.nome} ${atleta.cognome}` : "Atleta",
        corso_id: r.corso_id,
        corso_nome: corso?.nome || "Corso",
        note_risposta,
        gestita_da: session?.email || "",
      });
      toast({ title: modal.azione === "approvata" ? "Richiesta approvata" : "Richiesta rifiutata" });
      set_modal(null);
    } catch {
      toast({ title: "Errore", variant: "destructive" });
    }
  };

  const stato_badge = (stato: string) => {
    if (stato === "in_attesa") return <Badge variant="outline" className="border-amber-300 bg-amber-50 text-amber-600"><Clock className="w-3 h-3 mr-1" />In attesa</Badge>;
    if (stato === "approvata") return <Badge className="bg-emerald-100 text-emerald-700 border-emerald-200"><Check className="w-3 h-3 mr-1" />Approvata</Badge>;
    return <Badge variant="destructive"><X className="w-3 h-3 mr-1" />Rifiutata</Badge>;
  };

  // Separate pending from handled
  const pendenti = filtered.filter((r: any) => r.stato === "in_attesa");
  const gestite = filtered.filter((r: any) => r.stato !== "in_attesa");

  const render_card = (r: any) => {
    const atleta = get_atleta(r.atleta_id);
    const corso = get_corso(r.corso_id);
    return (
      <div key={r.id} className="bg-card rounded-xl border border-border p-4 hover:shadow-md transition-shadow">
        <div className="flex items-center justify-between gap-4">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-semibold text-foreground">
                {atleta ? `${atleta.cognome} ${atleta.nome}` : (r.atleta_id ?? "").slice(0, 8)}
              </span>
              <span className="text-muted-foreground">→</span>
              <span className="text-sm font-medium text-primary">{corso?.nome || (r.corso_id ?? "").slice(0, 8)}</span>
            </div>
            {r.note_richiesta && (
              <p className="text-xs text-muted-foreground mt-1 line-clamp-1">"{r.note_richiesta}"</p>
            )}
            <p className="text-xs text-muted-foreground mt-1">
              {new Date(r.created_at).toLocaleDateString("it-CH", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" })}
            </p>
            {r.stato !== "in_attesa" && r.note_risposta && (
              <p className="text-xs text-muted-foreground mt-1 italic">Risposta: {r.note_risposta}</p>
            )}
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {stato_badge(r.stato)}
            {r.stato === "in_attesa" && (
              <>
                <Button size="sm" variant="outline" className="border-emerald-200 text-emerald-600 hover:bg-emerald-50" onClick={() => open_modal(r, "approvata")}>
                  <Check className="w-4 h-4" />
                </Button>
                <Button size="sm" variant="outline" className="border-destructive/20 text-destructive hover:bg-destructive/5" onClick={() => open_modal(r, "rifiutata")}>
                  <X className="w-4 h-4" />
                </Button>
              </>
            )}
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-primary/10">
            <ClipboardList className="w-5 h-5 text-primary" />
          </div>
          <div>
            <h1 className="text-xl font-bold tracking-tight text-foreground">Richieste Iscrizione</h1>
            <p className="text-sm text-muted-foreground">Gestisci le richieste di iscrizione ai corsi</p>
          </div>
        </div>
        {counts.in_attesa > 0 && (
          <Badge className="bg-amber-100 text-amber-700 text-sm px-3 py-1">
            {counts.in_attesa} in attesa
          </Badge>
        )}
      </div>

      {/* Loading */}
      {isLoading && (
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
        </div>
      )}

      {/* Error */}
      {isError && (
        <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-6 text-center">
          <p className="text-sm text-destructive">Errore nel caricamento delle richieste.</p>
        </div>
      )}

      {/* Content */}
      {!isLoading && !isError && (
        <>
          {/* Filters */}
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex gap-1 bg-muted/40 p-1 rounded-xl">
              {([
                { key: "in_attesa", label: "In attesa", count: counts.in_attesa },
                { key: "approvata", label: "Approvate", count: counts.approvata },
                { key: "rifiutata", label: "Rifiutate", count: counts.rifiutata },
                { key: "tutte", label: "Tutte", count: richieste.length },
              ] as const).map((f) => (
                <button
                  key={f.key}
                  onClick={() => set_filtro(f.key)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                    filtro === f.key ? "bg-background shadow text-foreground" : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {f.label} ({f.count})
                </button>
              ))}
            </div>
            <div className="relative flex-1 min-w-[200px] max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                value={query}
                onChange={(e) => set_query(e.target.value)}
                placeholder="Cerca atleta o corso..."
                className="pl-9 h-9"
              />
            </div>
          </div>

          {/* Empty state */}
          {richieste.length === 0 && (
            <div className="text-center py-16 border rounded-lg border-dashed border-border">
              <MessageSquare className="w-10 h-10 mx-auto mb-3 text-muted-foreground/30" />
              <p className="text-sm font-medium text-muted-foreground">Nessuna richiesta di iscrizione</p>
              <p className="text-xs text-muted-foreground mt-1">Le richieste inviate dai genitori appariranno qui.</p>
            </div>
          )}

          {/* Pending section */}
          {(filtro === "tutte" || filtro === "in_attesa") && pendenti.length > 0 && (
            <div className="space-y-3">
              <h2 className="text-sm font-semibold text-foreground flex items-center gap-2">
                <Clock className="w-4 h-4 text-amber-500" />
                Da gestire ({pendenti.length})
              </h2>
              {pendenti.map(render_card)}
            </div>
          )}

          {/* Handled section */}
          {(filtro === "tutte" || filtro === "approvata" || filtro === "rifiutata") && gestite.length > 0 && (
            <div className="space-y-3">
              <h2 className="text-sm font-semibold text-muted-foreground flex items-center gap-2">
                <Check className="w-4 h-4" />
                Già gestite ({gestite.length})
              </h2>
              {gestite.map(render_card)}
            </div>
          )}

          {/* Filtered empty */}
          {richieste.length > 0 && filtered.length === 0 && (
            <div className="text-center py-12 border rounded-lg border-dashed border-border">
              <p className="text-sm text-muted-foreground">Nessuna richiesta corrispondente ai filtri.</p>
            </div>
          )}
        </>
      )}

      {/* Confirmation modal */}
      {modal && (
        <Dialog open onOpenChange={() => set_modal(null)}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>
                {modal.azione === "approvata" ? "Approva richiesta" : "Rifiuta richiesta"}
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-3">
              <p className="text-sm text-muted-foreground">
                {modal.azione === "approvata"
                  ? "L'atleta verrà iscritto al corso e riceverà una comunicazione di conferma."
                  : "L'atleta riceverà una comunicazione di rifiuto."}
              </p>
              <div>
                <Label className="text-xs">Note (opzionale)</Label>
                <Input
                  value={note_risposta}
                  onChange={(e) => set_note_risposta(e.target.value)}
                  placeholder={modal.azione === "rifiutata" ? "Motivo del rifiuto..." : "Note aggiuntive..."}
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => set_modal(null)}>Annulla</Button>
              <Button
                onClick={conferma}
                disabled={gestisci.isPending}
                className={modal.azione === "approvata" ? "bg-emerald-600 hover:bg-emerald-700" : ""}
                variant={modal.azione === "rifiutata" ? "destructive" : "default"}
              >
                {gestisci.isPending ? "..." : modal.azione === "approvata" ? "Approva" : "Rifiuta"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
};

export default RichiesteIscrizionePage;
