import React, { useState, useMemo, useEffect } from "react";
import { Navigate } from "react-router-dom";
import { use_richieste_iscrizione, use_atleti, use_corsi } from "@/hooks/use-supabase-data";
import { use_gestisci_richiesta } from "@/hooks/use-supabase-mutations";
import { useAuth } from "@/lib/auth";
import { usePermessiSezioniMatrix } from "@/hooks/usePermessi";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Check, X, Clock, Search, MessageSquare, ClipboardList, ChevronLeft, ChevronRight, Archive } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "@/hooks/use-toast";

type Filtro = "tutte" | "in_attesa" | "approvata" | "rifiutata" | "archivio";

const GIORNI_ARCHIVIO = 30;
const PAGE_SIZES = [25, 50, 100];

const RichiesteIscrizionePage: React.FC = () => {
  const { session } = useAuth();
  const { visibile_set, is_admin_like, is_loading: is_loading_permessi } = usePermessiSezioniMatrix();
  const allowed = is_admin_like || visibile_set.has("richieste_iscrizione");
  const { data: richieste = [], isLoading: isLoadingRichieste, isError } = use_richieste_iscrizione();
  const { data: atleti = [], isLoading: isLoadingAtleti } = use_atleti();
  const { data: corsi = [], isLoading: isLoadingCorsi } = use_corsi();
  const isLoading = isLoadingRichieste || isLoadingAtleti || isLoadingCorsi;
  const gestisci = use_gestisci_richiesta();

  const [filtro, set_filtro] = useState<Filtro>("in_attesa");
  const [query, set_query] = useState("");
  const [filtro_corso, set_filtro_corso] = useState<string>("tutti");
  const [filtro_periodo, set_filtro_periodo] = useState<string>("tutto");
  const [page, set_page] = useState(1);
  const [page_size, set_page_size] = useState(25);
  const [selezione, set_selezione] = useState<string[]>([]);
  const [modal, set_modal] = useState<{ richieste: any[]; azione: "approvata" | "rifiutata" } | null>(null);
  const [note_risposta, set_note_risposta] = useState("");

  const get_atleta = (id: string) => atleti.find((a: any) => a.id === id);
  const get_corso = (id: string) => corsi.find((c: any) => c.id === id);

  const limite_archivio = useMemo(() => {
    const d = new Date();
    d.setDate(d.getDate() - GIORNI_ARCHIVIO);
    return d.getTime();
  }, []);

  const is_archiviata = (r: any) =>
    r.stato !== "in_attesa" && new Date(r.created_at).getTime() < limite_archivio;

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const ora = Date.now();
    const giorni_periodo = filtro_periodo === "7" ? 7 : filtro_periodo === "30" ? 30 : filtro_periodo === "90" ? 90 : null;
    return richieste
      .filter((r: any) => (filtro === "archivio" ? is_archiviata(r) : !is_archiviata(r)))
      .filter((r: any) => filtro === "tutte" || filtro === "archivio" || r.stato === filtro)
      .filter((r: any) => filtro_corso === "tutti" || r.corso_id === filtro_corso)
      .filter((r: any) => {
        if (!giorni_periodo) return true;
        return new Date(r.created_at).getTime() >= ora - giorni_periodo * 86400000;
      })
      .filter((r: any) => {
        if (!q) return true;
        const a = get_atleta(r.atleta_id);
        const c = get_corso(r.corso_id);
        const name = a ? `${a.nome} ${a.cognome}` : "";
        return name.toLowerCase().includes(q) || (c?.nome || "").toLowerCase().includes(q);
      })
      .sort((a: any, b: any) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
  }, [richieste, filtro, query, filtro_corso, filtro_periodo, atleti, corsi, limite_archivio]);

  const counts = useMemo(() => {
    const c = { in_attesa: 0, approvata: 0, rifiutata: 0, attive: 0, archivio: 0 };
    richieste.forEach((r: any) => {
      if (is_archiviata(r)) {
        c.archivio++;
        return;
      }
      c.attive++;
      if (r.stato in c) c[r.stato as keyof typeof c]++;
    });
    return c;
  }, [richieste, limite_archivio]);

  const total_pages = Math.max(1, Math.ceil(filtered.length / page_size));
  const page_corrente = Math.min(page, total_pages);
  const pagina = filtered.slice((page_corrente - 1) * page_size, page_corrente * page_size);

  useEffect(() => {
    set_page(1);
    set_selezione([]);
  }, [filtro, query, filtro_corso, filtro_periodo, page_size]);

  const pendenti_pagina = pagina.filter((r: any) => r.stato === "in_attesa");
  const tutte_selezionate = pendenti_pagina.length > 0 && pendenti_pagina.every((r: any) => selezione.includes(r.id));

  const toggle_tutte = () => {
    if (tutte_selezionate) set_selezione([]);
    else set_selezione(pendenti_pagina.map((r: any) => r.id));
  };

  const toggle_uno = (id: string) => {
    set_selezione((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  };

  const open_modal = (lista: any[], azione: "approvata" | "rifiutata") => {
    set_note_risposta("");
    set_modal({ richieste: lista, azione });
  };

  const conferma = async () => {
    if (!modal) return;
    let ok = 0;
    let ko = 0;
    for (const r of modal.richieste) {
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
        ok++;
      } catch {
        ko++;
      }
    }
    toast({
      title: ko === 0
        ? `${ok} richiest${ok === 1 ? "a" : "e"} ${modal.azione === "approvata" ? "approvate" : "rifiutate"}`.replace("richiesta approvate", "richiesta approvata").replace("richiesta rifiutate", "richiesta rifiutata")
        : `${ok} completate, ${ko} errori`,
      variant: ko > 0 ? "destructive" : undefined,
    });
    set_selezione([]);
    set_modal(null);
  };

  const stato_badge = (stato: string) => {
    if (stato === "in_attesa") return <Badge variant="outline" className="border-amber-300 bg-amber-50 text-amber-600"><Clock className="w-3 h-3 mr-1" />In attesa</Badge>;
    if (stato === "approvata") return <Badge className="bg-emerald-100 text-emerald-700 border-emerald-200"><Check className="w-3 h-3 mr-1" />Approvata</Badge>;
    return <Badge variant="destructive"><X className="w-3 h-3 mr-1" />Rifiutata</Badge>;
  };

  const render_riga = (r: any) => {
    const atleta = get_atleta(r.atleta_id);
    const corso = get_corso(r.corso_id);
    const selezionata = selezione.includes(r.id);
    return (
      <tr key={r.id} className={`border-b border-border last:border-0 ${selezionata ? "bg-primary/5" : "hover:bg-muted/40"}`}>
        <td className="p-3 w-10">
          {r.stato === "in_attesa" && (
            <Checkbox checked={selezionata} onCheckedChange={() => toggle_uno(r.id)} className="h-5 w-5" />
          )}
        </td>
        <td className="p-3">
          <div className="font-medium text-foreground truncate">
            {atleta ? `${atleta.cognome} ${atleta.nome}` : (r.atleta_id ?? "").slice(0, 8)}
          </div>
          {r.note_richiesta && <p className="text-xs text-muted-foreground line-clamp-1">"{r.note_richiesta}"</p>}
        </td>
        <td className="p-3 text-sm text-primary font-medium truncate">{corso?.nome || (r.corso_id ?? "").slice(0, 8)}</td>
        <td className="p-3 text-xs text-muted-foreground whitespace-nowrap">
          {new Date(r.created_at).toLocaleDateString("de-CH", { day: "numeric", month: "short", year: "numeric" })}
        </td>
        <td className="p-3">
          {stato_badge(r.stato)}
          {r.stato !== "in_attesa" && r.note_risposta && (
            <p className="text-xs text-muted-foreground italic mt-1 line-clamp-1">{r.note_risposta}</p>
          )}
        </td>
        <td className="p-3 text-right whitespace-nowrap">
          {r.stato === "in_attesa" && (
            <div className="inline-flex gap-2">
              <Button size="sm" variant="outline" className="h-9 w-9 p-0 border-emerald-200 text-emerald-600 hover:bg-emerald-50" onClick={() => open_modal([r], "approvata")}>
                <Check className="w-4 h-4" />
              </Button>
              <Button size="sm" variant="outline" className="h-9 w-9 p-0 border-destructive/20 text-destructive hover:bg-destructive/5" onClick={() => open_modal([r], "rifiutata")}>
                <X className="w-4 h-4" />
              </Button>
            </div>
          )}
        </td>
      </tr>
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
          <Badge className="bg-amber-100 text-amber-700 text-sm px-3 py-1">{counts.in_attesa} in attesa</Badge>
        )}
      </div>

      {isLoading && (
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
        </div>
      )}

      {isError && (
        <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-6 text-center">
          <p className="text-sm text-destructive">Errore nel caricamento delle richieste.</p>
        </div>
      )}

      {!isLoading && !isError && (
        <>
          {/* Filters */}
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex gap-1 bg-muted/40 p-1 rounded-xl flex-wrap">
              {([
                { key: "in_attesa", label: "In attesa", count: counts.in_attesa },
                { key: "approvata", label: "Approvate", count: counts.approvata },
                { key: "rifiutata", label: "Rifiutate", count: counts.rifiutata },
                { key: "tutte", label: "Tutte", count: counts.attive },
                { key: "archivio", label: "Archivio", count: counts.archivio },
              ] as const).map((f) => (
                <button
                  key={f.key}
                  onClick={() => set_filtro(f.key)}
                  className={`px-3 py-2 rounded-lg text-xs font-medium transition-colors ${
                    filtro === f.key ? "bg-background shadow text-foreground" : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {f.key === "archivio" && <Archive className="w-3 h-3 mr-1 inline" />}
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
                className="pl-9 h-10"
              />
              {query && (
                <button onClick={() => set_query("")} className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 text-muted-foreground hover:text-foreground">
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>

            <Select value={filtro_corso} onValueChange={set_filtro_corso}>
              <SelectTrigger className="h-10 w-[190px]"><SelectValue placeholder="Corso" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="tutti">Tutti i corsi</SelectItem>
                {corsi.map((c: any) => (
                  <SelectItem key={c.id} value={c.id}>{c.nome}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={filtro_periodo} onValueChange={set_filtro_periodo}>
              <SelectTrigger className="h-10 w-[160px]"><SelectValue placeholder="Periodo" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="tutto">Tutto il periodo</SelectItem>
                <SelectItem value="7">Ultimi 7 giorni</SelectItem>
                <SelectItem value="30">Ultimi 30 giorni</SelectItem>
                <SelectItem value="90">Ultimi 90 giorni</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Bulk bar */}
          {selezione.length > 0 && (
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-primary/30 bg-primary/5 p-3">
              <span className="text-sm font-medium text-foreground">{selezione.length} selezionate</span>
              <div className="flex gap-2">
                <Button variant="outline" className="h-10" onClick={() => set_selezione([])}>Annulla selezione</Button>
                <Button
                  className="h-10 bg-emerald-600 hover:bg-emerald-700"
                  onClick={() => open_modal(filtered.filter((r: any) => selezione.includes(r.id)), "approvata")}
                >
                  <Check className="w-4 h-4 mr-1" />Approva selezionate
                </Button>
                <Button
                  variant="destructive"
                  className="h-10"
                  onClick={() => open_modal(filtered.filter((r: any) => selezione.includes(r.id)), "rifiutata")}
                >
                  <X className="w-4 h-4 mr-1" />Rifiuta selezionate
                </Button>
              </div>
            </div>
          )}

          {/* Empty state */}
          {richieste.length === 0 && (
            <div className="text-center py-16 border rounded-lg border-dashed border-border">
              <MessageSquare className="w-10 h-10 mx-auto mb-3 text-muted-foreground/30" />
              <p className="text-sm font-medium text-muted-foreground">Nessuna richiesta di iscrizione</p>
              <p className="text-xs text-muted-foreground mt-1">Le richieste inviate dai genitori appariranno qui.</p>
            </div>
          )}

          {/* Table */}
          {filtered.length > 0 && (
            <div className="rounded-xl border border-border overflow-hidden bg-card">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-muted/50 text-xs text-muted-foreground">
                    <tr>
                      <th className="p-3 w-10 text-left">
                        {pendenti_pagina.length > 0 && (
                          <Checkbox checked={tutte_selezionate} onCheckedChange={toggle_tutte} className="h-5 w-5" />
                        )}
                      </th>
                      <th className="p-3 text-left font-medium">Atleta</th>
                      <th className="p-3 text-left font-medium">Corso</th>
                      <th className="p-3 text-left font-medium">Data</th>
                      <th className="p-3 text-left font-medium">Stato</th>
                      <th className="p-3" />
                    </tr>
                  </thead>
                  <tbody>{pagina.map(render_riga)}</tbody>
                </table>
              </div>

              {/* Pagination */}
              <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border p-3">
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <span>
                    {(page_corrente - 1) * page_size + 1}–{Math.min(page_corrente * page_size, filtered.length)} di {filtered.length}
                  </span>
                  <Select value={String(page_size)} onValueChange={(v) => set_page_size(Number(v))}>
                    <SelectTrigger className="h-9 w-[110px]"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {PAGE_SIZES.map((s) => (
                        <SelectItem key={s} value={String(s)}>{s} per pagina</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex items-center gap-2">
                  <Button variant="outline" className="h-10 w-10 p-0" disabled={page_corrente <= 1} onClick={() => set_page(page_corrente - 1)}>
                    <ChevronLeft className="w-4 h-4" />
                  </Button>
                  <span className="text-xs text-muted-foreground">Pagina {page_corrente} di {total_pages}</span>
                  <Button variant="outline" className="h-10 w-10 p-0" disabled={page_corrente >= total_pages} onClick={() => set_page(page_corrente + 1)}>
                    <ChevronRight className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            </div>
          )}

          {richieste.length > 0 && filtered.length === 0 && (
            <div className="text-center py-12 border rounded-lg border-dashed border-border">
              <p className="text-sm text-muted-foreground">Nessuna richiesta corrispondente ai filtri.</p>
            </div>
          )}
        </>
      )}

      {/* Confirmation modal */}
      {modal && (
        <Dialog open onOpenChange={() => !gestisci.isPending && set_modal(null)}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>
                {modal.azione === "approvata" ? "Approva richieste" : "Rifiuta richieste"}
                {modal.richieste.length > 1 ? ` (${modal.richieste.length})` : ""}
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-3">
              <p className="text-sm text-muted-foreground">
                {modal.azione === "approvata"
                  ? `${modal.richieste.length > 1 ? "Gli atleti verranno iscritti" : "L'atleta verrà iscritto"} al corso e riceveranno una comunicazione di conferma.`
                  : `${modal.richieste.length > 1 ? "Gli atleti riceveranno" : "L'atleta riceverà"} una comunicazione di rifiuto.`}
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
              <Button variant="outline" onClick={() => set_modal(null)} disabled={gestisci.isPending}>Annulla</Button>
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
