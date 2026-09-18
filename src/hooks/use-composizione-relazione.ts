// Composizione della Relazione: quali moduli sono accesi e in che ordine.
// Si salva per club e stagione; quando una stagione non ha ancora una
// composizione, si riprende quella della stagione precedente più recente.

import { useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { segnala_errore } from "@/lib/errori";
import {
  MODULI, AREE_ORDINATE, MODULI_ASSEMBLEA, MODULI_COMITATO, MODULI_SPENTI_DI_DEFAULT,
  type ModuloRisultato, type Stagione,
} from "@/lib/relazione/moduli";
import { AREA_LABELS } from "@/lib/paragraphGenerator";
import type { TipoVoce, VoceComposizione } from "@/lib/pdfGenerator";

export interface VocePannello extends VoceComposizione {
  attivo: boolean;
  ordine: number;
  bloccato: boolean;
  sottotitolo?: string;
  stato_modulo?: ModuloRisultato["stato"];
  motivo?: string;
}

export type Preset = "completa" | "assemblea" | "comitato";

interface RigaPref {
  id?: string;
  sezione_tipo: string;
  sezione_id: string;
  attivo: boolean;
  ordine: number;
}

/** Ordine di partenza del documento. */
function ordineCanonico(): RigaPref[] {
  const righe: RigaPref[] = [
    { sezione_tipo: "sistema", sezione_id: "copertina", attivo: true, ordine: 0 },
    { sezione_tipo: "messaggio", sezione_id: "messaggio", attivo: true, ordine: 10 },
    { sezione_tipo: "sistema", sezione_id: "indice", attivo: true, ordine: 20 },
  ];
  AREE_ORDINATE.forEach((area, i) => {
    const base = 100 + i * 100;
    righe.push({ sezione_tipo: "sezione", sezione_id: area, attivo: true, ordine: base });
    MODULI.filter((m) => m.area === area).forEach((m, j) => {
      // Alcuni moduli sono lunghi da stampare: nascono spenti.
      righe.push({
        sezione_tipo: "modulo", sezione_id: m.id,
        attivo: !MODULI_SPENTI_DI_DEFAULT.has(m.id), ordine: base + j + 1,
      });
    });
  });
  righe.push({ sezione_tipo: "sistema", sezione_id: "chiusura", attivo: true, ordine: 9999 });
  return righe;
}

export function useComposizioneRelazione(
  club_id: string | undefined,
  stagione: Stagione | null,
  moduli: Record<string, ModuloRisultato> | undefined,
  blocchi: any[],
  allegati: any[],
) {
  const qc = useQueryClient();
  const chiave = ["relazione_composizione", club_id, stagione?.id];

  const query = useQuery({
    queryKey: chiave,
    enabled: !!club_id && !!stagione?.id,
    queryFn: async (): Promise<RigaPref[]> => {
      const { data, error } = await supabase
        .from("relazione_preferenze" as any).select("id,sezione_tipo,sezione_id,attivo,ordine")
        .eq("club_id", club_id!).eq("stagione_id", stagione!.id);
      if (error) throw error;
      let righe = (data ?? []) as any as RigaPref[];

      if (righe.length === 0) {
        // Nessuna composizione per questa stagione: si riprende l'ultima salvata.
        const { data: altre, error: err2 } = await supabase
          .from("relazione_preferenze" as any)
          .select("sezione_tipo,sezione_id,attivo,ordine,stagione_id,created_at")
          .eq("club_id", club_id!)
          .order("created_at", { ascending: false });
        if (err2) throw err2;
        const precedenti = (altre ?? []) as any[];
        const stagione_modello = precedenti.find((r) => r.stagione_id !== stagione!.id)?.stagione_id;
        const modello = stagione_modello
          ? precedenti.filter((r) => r.stagione_id === stagione_modello)
              .map((r) => ({
                sezione_tipo: r.sezione_tipo, sezione_id: r.sezione_id,
                attivo: r.attivo, ordine: r.ordine,
              }))
          : ordineCanonico();
        const { error: err3 } = await supabase
          .from("relazione_preferenze" as any)
          .insert(modello.map((m) => ({ ...m, club_id: club_id!, stagione_id: stagione!.id })));
        if (err3) throw err3;
        righe = modello;
      }
      return righe;
    },
  });

  const voci: VocePannello[] = useMemo(() => {
    const salvate = new Map((query.data ?? []).map((r) => [r.sezione_id, r]));
    const base = ordineCanonico();
    const lista: VocePannello[] = [];

    for (const r of base) {
      const salvata = salvate.get(r.sezione_id);
      const attivo = salvata ? salvata.attivo : r.attivo;
      const ordine = salvata ? salvata.ordine : r.ordine;
      if (r.sezione_tipo === "sistema") {
        lista.push({
          id: `sis:${r.sezione_id}`, tipo: "sistema", riferimento: r.sezione_id,
          titolo: r.sezione_id === "copertina" ? "Copertina" : r.sezione_id === "indice" ? "Indice" : "Chiusura",
          attivo, ordine, bloccato: true, sottotitolo: "Pagina di sistema",
        });
      } else if (r.sezione_tipo === "messaggio") {
        lista.push({
          id: "messaggio", tipo: "messaggio", riferimento: "messaggio",
          titolo: "Il messaggio del presidente", attivo, ordine, bloccato: false,
          sottotitolo: "Prima pagina dopo la copertina",
        });
      } else if (r.sezione_tipo === "sezione") {
        lista.push({
          id: `sez:${r.sezione_id}`, tipo: "sezione", riferimento: r.sezione_id,
          titolo: (AREA_LABELS as any)[r.sezione_id] ?? r.sezione_id,
          attivo, ordine, bloccato: false, sottotitolo: "Testo del capitolo",
        });
      } else if (r.sezione_tipo === "modulo") {
        const m = moduli?.[r.sezione_id];
        const def = MODULI.find((x) => x.id === r.sezione_id);
        lista.push({
          id: `mod:${r.sezione_id}`, tipo: "modulo", riferimento: r.sezione_id,
          titolo: m?.titolo ?? def?.titolo ?? r.sezione_id,
          // Se i dati non ci sono, il modulo si spegne da solo.
          attivo: attivo && m?.stato === "ok",
          ordine, bloccato: false,
          stato_modulo: m?.stato, motivo: m?.motivo,
          sottotitolo: def ? (AREA_LABELS as any)[def.area] : undefined,
        });
      }
    }

    for (const b of blocchi) {
      const salvata = salvate.get(`blocco:${b.id}`);
      lista.push({
        id: `blo:${b.id}`, tipo: "blocco", riferimento: b.id, titolo: b.titolo,
        attivo: salvata ? salvata.attivo : b.attivo !== false,
        ordine: salvata?.ordine ?? 900 + (b.ordine ?? 0),
        bloccato: false, sottotitolo: "Testo libero", payload: b,
      });
    }
    for (const a of allegati) {
      const salvata = salvate.get(`allegato:${a.id}`);
      lista.push({
        id: `all:${a.id}`, tipo: "allegato", riferimento: a.id, titolo: a.titolo,
        attivo: salvata ? salvata.attivo : a.attivo !== false,
        ordine: salvata?.ordine ?? 950 + (a.ordine ?? 0),
        bloccato: false, sottotitolo: "Allegato", payload: a,
      });
    }

    return lista.sort((x, y) => x.ordine - y.ordine);
  }, [query.data, moduli, blocchi, allegati]);

  const chiave_pref = (v: VocePannello) =>
    v.tipo === "blocco" ? `blocco:${v.riferimento}`
      : v.tipo === "allegato" ? `allegato:${v.riferimento}`
        : v.riferimento;

  const salva = async (righe: { sezione_tipo: string; sezione_id: string; attivo: boolean; ordine: number }[]) => {
    const { error } = await supabase
      .from("relazione_preferenze" as any)
      .upsert(
        righe.map((r) => ({ ...r, club_id: club_id!, stagione_id: stagione!.id })),
        { onConflict: "club_id,stagione_id,sezione_id" },
      );
    if (error) throw error;
  };

  const tipo_pref = (v: VocePannello) =>
    v.tipo === "blocco" ? "blocco" : v.tipo === "allegato" ? "allegato" : v.tipo;

  const m_toggle = useMutation({
    mutationFn: async ({ voce, attivo }: { voce: VocePannello; attivo: boolean }) => {
      await salva([{ sezione_tipo: tipo_pref(voce), sezione_id: chiave_pref(voce), attivo, ordine: voce.ordine }]);
    },
    onError: (e) => segnala_errore("Relazione", "Salvataggio della composizione", e),
    onSuccess: () => { qc.invalidateQueries({ queryKey: chiave }); },
  });

  const m_sposta = useMutation({
    mutationFn: async ({ voce, direzione }: { voce: VocePannello; direzione: -1 | 1 }) => {
      const mobili = voci.filter((v) => !v.bloccato);
      const idx = mobili.findIndex((v) => v.id === voce.id);
      const altro = mobili[idx + direzione];
      if (!altro) return;
      await salva([
        { sezione_tipo: tipo_pref(voce), sezione_id: chiave_pref(voce), attivo: voce.attivo, ordine: altro.ordine },
        { sezione_tipo: tipo_pref(altro), sezione_id: chiave_pref(altro), attivo: altro.attivo, ordine: voce.ordine },
      ]);
    },
    onError: (e) => segnala_errore("Relazione", "Spostamento del modulo", e),
    onSuccess: () => { qc.invalidateQueries({ queryKey: chiave }); },
  });

  const m_preset = useMutation({
    mutationFn: async (preset: Preset) => {
      const righe = voci
        .filter((v) => !v.bloccato)
        .map((v) => {
          let attivo = true;
          if (v.tipo === "modulo") {
            attivo = preset === "completa"
              ? true
              : preset === "assemblea"
                ? MODULI_ASSEMBLEA.has(v.riferimento)
                : MODULI_COMITATO.has(v.riferimento);
          } else if (v.tipo === "sezione") {
            attivo = preset !== "comitato";
          }
          return { sezione_tipo: tipo_pref(v), sezione_id: chiave_pref(v), attivo, ordine: v.ordine };
        });
      await salva(righe);
    },
    onError: (e) => segnala_errore("Relazione", "Applicazione della composizione pronta", e),
    onSuccess: () => { qc.invalidateQueries({ queryKey: chiave }); },
  });

  return {
    voci,
    is_loading: query.isLoading,
    is_error: query.isError,
    errore: query.error as any,
    ricarica: query.refetch,
    toggle: (voce: VocePannello, attivo: boolean) => m_toggle.mutate({ voce, attivo }),
    sposta: (voce: VocePannello, direzione: -1 | 1) => m_sposta.mutate({ voce, direzione }),
    applica_preset: (p: Preset) => m_preset.mutate(p),
    in_salvataggio: m_toggle.isPending || m_sposta.isPending || m_preset.isPending,
  };
}
