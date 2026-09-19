import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import * as XLSX from "xlsx";
import { Download, AlertTriangle, Loader2, RefreshCw, XCircle } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/auth";
import { use_club } from "@/hooks/use-supabase-data";
import { usePermessiAzione } from "@/hooks/use-permessi-azione";
import NotaPermesso from "@/components/common/NotaPermesso";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { segnala_errore, messaggio_leggibile } from "@/lib/errori";

/**
 * Pagina "Esportazioni": ogni elenco del club scaricabile in Excel.
 * Sola lettura: legge inventario_export_club e esporta_club_entita.
 * Testi in italiano scritti qui, senza i18n: pagina nata per una demo.
 */

interface RigaInventario {
  gruppo: string;
  entita: string;
  etichetta: string;
  righe: number;
  errore: string | null;
}

function data_oggi(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function ripulisci(s: string): string {
  return String(s || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "") || "club";
}

/** Nome foglio Excel: max 31 caratteri, senza : \ / ? * [ ] e unico nel file. */
function nome_foglio(entita: string, usati: Set<string>): string {
  let base = String(entita || "foglio").replace(/[:\\/?*[\]]/g, "-").slice(0, 31) || "foglio";
  let nome = base;
  let n = 2;
  while (usati.has(nome)) {
    const suffisso = `~${n}`;
    nome = base.slice(0, 31 - suffisso.length) + suffisso;
    n += 1;
  }
  usati.add(nome);
  return nome;
}

export default function EsportazioniPage() {
  const { session } = useAuth();
  const club_id = session?.club_id;
  const { puo_gestire_fatture } = usePermessiAzione();
  const { data: club } = use_club();
  const [in_corso, set_in_corso] = useState<string | null>(null);
  const [tutto_in_corso, set_tutto_in_corso] = useState(false);
  const [avanzamento, set_avanzamento] = useState<{ fatti: number; totale: number } | null>(null);

  const { data: righe = [], isPending, isError, error, refetch, isRefetching } = useQuery({
    queryKey: ["inventario_export_club", club_id],
    enabled: !!club_id && !!puo_gestire_fatture,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("inventario_export_club" as any, { p_club: club_id });
      if (error) throw error;
      return (data ?? []) as RigaInventario[];
    },
  });

  const gruppi = useMemo(() => {
    const mappa = new Map<string, RigaInventario[]>();
    for (const r of righe) {
      const lista = mappa.get(r.gruppo) ?? [];
      lista.push(r);
      mappa.set(r.gruppo, lista);
    }
    return Array.from(mappa.entries());
  }, [righe]);

  const nome_club = ripulisci(club?.nome ?? "club");

  async function leggi_entita(entita: string): Promise<Record<string, unknown>[]> {
    const { data, error } = await supabase.rpc("esporta_club_entita" as any, {
      p_club: club_id,
      p_entita: entita,
    });
    if (error) throw error;
    return (Array.isArray(data) ? data : []) as Record<string, unknown>[];
  }

  async function scarica_uno(riga: RigaInventario) {
    set_in_corso(riga.entita);
    try {
      const dati = await leggi_entita(riga.entita);
      const ws = XLSX.utils.json_to_sheet(dati);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, nome_foglio(riga.entita, new Set()));
      XLSX.writeFile(wb, `${nome_club}-${ripulisci(riga.entita)}-${data_oggi()}.xlsx`);
    } catch (e) {
      segnala_errore("EsportazioniPage", `Esportazione di ${riga.etichetta}`, e, { entita: riga.entita });
    } finally {
      set_in_corso(null);
    }
  }

  async function scarica_tutto() {
    const da_fare = righe.filter((r) => !r.errore && Number(r.righe) > 0);
    if (da_fare.length === 0) return;
    set_tutto_in_corso(true);
    set_avanzamento({ fatti: 0, totale: da_fare.length });
    try {
      const wb = XLSX.utils.book_new();
      const usati = new Set<string>();
      let aggiunti = 0;
      for (let i = 0; i < da_fare.length; i++) {
        const riga = da_fare[i];
        const dati = await leggi_entita(riga.entita);
        XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(dati), nome_foglio(riga.entita, usati));
        aggiunti += 1;
        set_avanzamento({ fatti: i + 1, totale: da_fare.length });
      }
      if (aggiunti > 0) XLSX.writeFile(wb, `${nome_club}-tutto-${data_oggi()}.xlsx`);
    } catch (e) {
      segnala_errore("EsportazioniPage", "Esportazione completa", e);
    } finally {
      set_tutto_in_corso(false);
      set_avanzamento(null);
    }
  }

  if (!puo_gestire_fatture) {
    return (
      <div className="p-6">
        <NotaPermesso testo="Solo la segreteria e il presidente possono scaricare gli elenchi del club." />
      </div>
    );
  }

  const intestazione = (
    <div>
      <h1 className="text-2xl font-bold text-foreground">Esportazioni</h1>
      <p className="mt-1 text-muted-foreground">Ogni elenco del club, scaricabile in Excel</p>
    </div>
  );

  if (!club_id) {
    return (
      <div className="p-4 md:p-6 max-w-4xl mx-auto">
        {intestazione}
        <div className="mt-6 rounded-xl border border-amber-300 bg-amber-50 dark:bg-amber-950/20 p-4 text-sm text-amber-800 dark:text-amber-300">
          Nessun club è collegato a questa sessione. Esci e rientra, poi riprova.
        </div>
      </div>
    );
  }

  const scaricabili = righe.filter((r) => !r.errore && Number(r.righe) > 0).length;

  return (
    <div className="p-4 md:p-6 max-w-4xl mx-auto space-y-6">
      {intestazione}

      {isPending && (
        <div className="space-y-3">
          <Skeleton className="h-12 w-64 rounded-xl" />
          <Skeleton className="h-24 w-full rounded-xl" />
          <Skeleton className="h-24 w-full rounded-xl" />
        </div>
      )}

      {isError && (
        <div className="rounded-xl border border-destructive/40 bg-destructive/5 p-5 space-y-3">
          <div className="flex items-start gap-3">
            <XCircle className="w-5 h-5 text-destructive shrink-0 mt-0.5" />
            <div>
              <p className="font-medium text-destructive">L'elenco delle esportazioni non è disponibile</p>
              <p className="text-sm text-muted-foreground mt-1">
                {messaggio_leggibile(error)} Non significa che non ci sia niente da scaricare: semplicemente non sono riuscito a leggerlo.
              </p>
            </div>
          </div>
          <Button
            variant="outline"
            size="sm"
            className="gap-1.5"
            disabled={isRefetching}
            onClick={() => {
              refetch().catch((e) =>
                segnala_errore("EsportazioniPage", "Lettura elenco esportazioni", e, undefined, "avviso"),
              );
            }}
          >
            <RefreshCw className={`w-4 h-4 ${isRefetching ? "animate-spin" : ""}`} /> Riprova
          </Button>
        </div>
      )}

      {!isPending && !isError && (
        <>
          <div className="rounded-xl border border-border bg-card p-5 flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="font-medium text-foreground">Scarica tutto in un file solo</p>
              <p className="text-sm text-muted-foreground mt-0.5">
                {scaricabili > 0
                  ? `Un foglio per ogni elenco con almeno una riga: ${scaricabili} in tutto.`
                  : "Non c'è ancora nessun elenco con delle righe da scaricare."}
              </p>
            </div>
            <Button
              size="lg"
              className="gap-2"
              disabled={tutto_in_corso || scaricabili === 0}
              onClick={scarica_tutto}
            >
              {tutto_in_corso ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
              {tutto_in_corso && avanzamento
                ? `${avanzamento.fatti} di ${avanzamento.totale}`
                : "Scarica tutto in un file solo"}
            </Button>
          </div>

          {gruppi.map(([gruppo, lista]) => (
            <section key={gruppo} className="space-y-2">
              <h2 className="text-xs font-bold uppercase tracking-widest text-muted-foreground px-1">{gruppo}</h2>
              <ul className="space-y-2">
                {lista.map((r) => {
                  const vuota = !r.errore && Number(r.righe) === 0;
                  const questa = in_corso === r.entita;
                  return (
                    <li
                      key={r.entita}
                      className={`flex flex-wrap items-center gap-x-3 gap-y-2 rounded-xl border p-4 ${
                        r.errore ? "border-amber-300 bg-amber-50/60 dark:bg-amber-950/10" : "border-border bg-card"
                      }`}
                    >
                      {r.errore && <AlertTriangle className="w-5 h-5 text-amber-500 shrink-0" />}
                      <div className="flex-1 min-w-[12rem]">
                        <span className="font-medium text-foreground">{r.etichetta}</span>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          {r.errore
                            ? r.errore
                            : Number(r.righe) === 0
                              ? "nessuna riga"
                              : `${Number(r.righe)} righe`}
                        </p>
                      </div>
                      <Button
                        size="sm"
                        variant={vuota || r.errore ? "outline" : "default"}
                        className="gap-1.5"
                        disabled={!!r.errore || vuota || questa || tutto_in_corso}
                        onClick={() => scarica_uno(r)}
                      >
                        {questa ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
                        Scarica
                      </Button>
                    </li>
                  );
                })}
              </ul>
            </section>
          ))}
        </>
      )}
    </div>
  );
}
