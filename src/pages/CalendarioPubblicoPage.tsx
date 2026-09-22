import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { ChevronLeft, ChevronRight, CalendarDays } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { format_data_lunga, format_data } from "@/lib/format-data";

const CHIAVE_CODICE = "calendario_pubblico_codice";

/** Maiuscolo, niente spazi, trattini nelle posizioni giuste (XX-XXXX-XXXX). */
export function normalizza_codice_pubblico(raw: string): string {
  const compact = (raw || "").toUpperCase().replace(/[^A-Z0-9]/g, "");
  if (compact.length <= 2) return compact;
  let out = `${compact.slice(0, 2)}-${compact.slice(2, 6)}`;
  if (compact.length > 6) out += `-${compact.slice(6, 10)}`;
  return out;
}

function leggi_codice_salvato(): string {
  try {
    return localStorage.getItem(CHIAVE_CODICE) ?? "";
  } catch {
    return "";
  }
}

function salva_codice(codice: string) {
  try {
    localStorage.setItem(CHIAVE_CODICE, codice);
  } catch {
    /* navigazione privata: si prosegue senza memoria */
  }
}

function dimentica_codice() {
  try {
    localStorage.removeItem(CHIAVE_CODICE);
  } catch {
    /* niente da dimenticare */
  }
}

type TipoErrore = "codice" | "freno" | "lettura";

function tipo_errore(error: unknown): TipoErrore {
  const code = (error as { code?: string } | null)?.code;
  if (code === "P0002") return "codice";
  if (code === "53400") return "freno";
  return "lettura";
}

interface RigaMese {
  club: string | null;
  stagione: string | null;
  stagione_da: string | null;
  stagione_a: string | null;
  mese: string;
  sessioni: number;
}

interface RigaSessione {
  club?: string | null;
  atleta?: string | null;
  data: string;
  ora_inizio: string | null;
  ora_fine: string | null;
  attivita: string | null;
  pista: string | null;
  nota?: string | null;
}

function iso_mese(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-01`;
}

function ultimo_giorno(mese_iso: string): string {
  const d = new Date(`${mese_iso}T00:00:00`);
  const fine = new Date(d.getFullYear(), d.getMonth() + 1, 0);
  return `${fine.getFullYear()}-${String(fine.getMonth() + 1).padStart(2, "0")}-${String(fine.getDate()).padStart(2, "0")}`;
}

function sposta_mese(mese_iso: string, delta: number): string {
  const d = new Date(`${mese_iso}T00:00:00`);
  return iso_mese(new Date(d.getFullYear(), d.getMonth() + delta, 1));
}

function ora_breve(v: string | null): string {
  return (v ?? "").slice(0, 5);
}

const CalendarioPubblicoPage: React.FC = () => {
  const { t } = useTranslation("calendario");

  const [campo, set_campo] = useState("");
  const [codice, set_codice] = useState<string>(() => leggi_codice_salvato());
  const [errore_codice, set_errore_codice] = useState<TipoErrore | null>(null);

  const tipo = codice.startsWith("CA-") ? "club" : codice.startsWith("AT-") ? "atleta" : null;

  // --- mesi disponibili (solo vista club) ---
  const [mesi, set_mesi] = useState<RigaMese[] | null>(null);
  const [mesi_errore, set_mesi_errore] = useState<TipoErrore | null>(null);
  const [mesi_in_corso, set_mesi_in_corso] = useState(false);
  const [mese, set_mese] = useState<string>(() => iso_mese(new Date()));

  // --- righe del mese ---
  const [righe, set_righe] = useState<RigaSessione[] | null>(null);
  const [righe_errore, set_righe_errore] = useState<TipoErrore | null>(null);
  const [righe_in_corso, set_righe_in_corso] = useState(false);
  const [intestazione, set_intestazione] = useState<{ titolo: string; sotto: string }>({ titolo: "", sotto: "" });
  const [ricarica, set_ricarica] = useState(0);

  const esci = useCallback(() => {
    dimentica_codice();
    set_codice("");
    set_campo("");
    set_mesi(null);
    set_righe(null);
    set_mesi_errore(null);
    set_righe_errore(null);
    set_errore_codice(null);
    set_mese(iso_mese(new Date()));
  }, []);

  // Carica i mesi disponibili per la vista club.
  useEffect(() => {
    if (tipo !== "club") {
      set_mesi(null);
      set_mesi_errore(null);
      return;
    }
    let annullato = false;
    set_mesi_in_corso(true);
    set_mesi_errore(null);
    (async () => {
      const { data, error } = await supabase.rpc("calendario_pubblico_mesi", { p_codice: codice });
      if (annullato) return;
      set_mesi_in_corso(false);
      if (error) {
        const tipo_err = tipo_errore(error);
        set_mesi(null);
        if (tipo_err === "codice") {
          set_errore_codice("codice");
          dimentica_codice();
          set_codice("");
        } else {
          set_mesi_errore(tipo_err);
        }
        return;
      }
      const lista = (data ?? []) as RigaMese[];
      set_mesi(lista);
      if (lista.length > 0) {
        const oggi = iso_mese(new Date());
        const scelto = lista.some((m) => m.mese === oggi)
          ? oggi
          : lista.find((m) => m.mese > oggi)?.mese ?? lista[lista.length - 1].mese;
        set_mese(scelto);
      }
    })();
    return () => {
      annullato = true;
    };
  }, [tipo, codice, ricarica]);

  // Carica le righe del mese selezionato.
  useEffect(() => {
    if (!tipo) {
      set_righe(null);
      return;
    }
    if (tipo === "club" && (mesi === null || mesi.length === 0)) {
      set_righe(null);
      return;
    }
    let annullato = false;
    set_righe_in_corso(true);
    set_righe_errore(null);
    (async () => {
      const fn = tipo === "club" ? "calendario_pubblico" : "programma_atleta_pubblico";
      const { data, error } = await supabase.rpc(fn, {
        p_codice: codice,
        p_da: mese,
        p_a: ultimo_giorno(mese),
      });
      if (annullato) return;
      set_righe_in_corso(false);
      if (error) {
        const tipo_err = tipo_errore(error);
        set_righe(null);
        if (tipo_err === "codice") {
          set_errore_codice("codice");
          dimentica_codice();
          set_codice("");
        } else {
          set_righe_errore(tipo_err);
        }
        return;
      }
      const lista = (data ?? []) as RigaSessione[];
      set_righe(lista);
      if (tipo === "club") {
        const info = mesi?.[0];
        set_intestazione({
          titolo: info?.club ?? lista[0]?.club ?? "",
          sotto: info?.stagione ? t("stagione", { nome: info.stagione }) : "",
        });
      } else {
        set_intestazione({
          titolo: lista[0]?.atleta ?? "",
          sotto: lista[0]?.club ?? "",
        });
      }
    })();
    return () => {
      annullato = true;
    };
  }, [tipo, codice, mese, mesi, ricarica, t]);

  const mesi_disponibili = useMemo(() => (mesi ?? []).map((m) => m.mese), [mesi]);
  const puo_indietro =
    tipo === "club"
      ? mesi_disponibili.some((m) => m < mese)
      : true;
  const puo_avanti =
    tipo === "club"
      ? mesi_disponibili.some((m) => m > mese)
      : true;

  const vai = (delta: number) => {
    if (tipo === "club") {
      const candidati = delta < 0
        ? mesi_disponibili.filter((m) => m < mese)
        : mesi_disponibili.filter((m) => m > mese);
      if (candidati.length === 0) return;
      set_mese(delta < 0 ? candidati[candidati.length - 1] : candidati[0]);
      return;
    }
    set_mese(sposta_mese(mese, delta));
  };

  const per_giorno = useMemo(() => {
    const m = new Map<string, RigaSessione[]>();
    (righe ?? []).forEach((r) => {
      const lista = m.get(r.data) ?? [];
      lista.push(r);
      m.set(r.data, lista);
    });
    return Array.from(m.entries()).sort((a, b) => a[0].localeCompare(b[0]));
  }, [righe]);

  const messaggio_errore = (e: TipoErrore) =>
    e === "freno" ? t("troppi_tentativi") : e === "codice" ? t("codice_non_riconosciuto") : t("errore_lettura");

  // --- schermata del codice ---
  if (!tipo) {
    return (
      <div className="min-h-screen bg-muted/30 px-4 py-10">
        <div className="mx-auto w-full max-w-sm">
          <div className="mb-6 flex flex-col items-center gap-2 text-center">
            <CalendarDays className="h-8 w-8 text-primary" />
            <h1 className="text-xl font-semibold">{t("titolo")}</h1>
            <p className="text-sm text-muted-foreground">{t("intro")}</p>
          </div>
          <Card>
            <CardContent className="space-y-4 pt-6">
              <div className="space-y-2">
                <Label htmlFor="codice_pubblico">{t("campo_label")}</Label>
                <input
                  id="codice_pubblico"
                  value={campo}
                  onChange={(e) => {
                    set_campo(normalizza_codice_pubblico(e.target.value));
                    set_errore_codice(null);
                  }}
                  placeholder={t("campo_placeholder")}
                  maxLength={12}
                  autoComplete="off"
                  className="h-14 w-full rounded-2xl border-2 border-input bg-background text-center font-mono text-xl uppercase tracking-[0.2em] focus:border-primary focus:outline-none"
                />
              </div>
              {errore_codice && (
                <p className="text-sm font-medium text-destructive">{messaggio_errore(errore_codice)}</p>
              )}
              <Button
                className="h-12 w-full"
                onClick={() => {
                  const pulito = normalizza_codice_pubblico(campo);
                  if (!pulito.startsWith("CA-") && !pulito.startsWith("AT-")) {
                    set_errore_codice("codice");
                    return;
                  }
                  set_errore_codice(null);
                  salva_codice(pulito);
                  set_codice(pulito);
                }}
              >
                {t("apri")}
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  const errore_pagina = mesi_errore ?? righe_errore;
  const in_corso = mesi_in_corso || righe_in_corso;

  return (
    <div className="min-h-screen bg-muted/30 px-3 py-6">
      <div className="mx-auto w-full max-w-2xl space-y-4">
        <header className="space-y-1 text-center">
          <h1 className="text-lg font-semibold">{intestazione.titolo}</h1>
          {intestazione.sotto && <p className="text-sm text-muted-foreground">{intestazione.sotto}</p>}
        </header>

        <div className="flex items-center justify-between gap-2">
          <Button variant="outline" size="icon" onClick={() => vai(-1)} disabled={!puo_indietro} aria-label={t("mese_precedente")} title={t("mese_precedente")}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <span className="text-sm font-medium capitalize">
            {format_data(mese, { month: "long", year: "numeric" })}
          </span>
          <Button variant="outline" size="icon" onClick={() => vai(1)} disabled={!puo_avanti} aria-label={t("mese_successivo")} title={t("mese_successivo")}>
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>

        {errore_pagina ? (
          <Card>
            <CardContent className="space-y-3 pt-6 text-center">
              <p className="text-sm font-medium text-destructive">{messaggio_errore(errore_pagina)}</p>
              <Button variant="outline" onClick={() => set_ricarica((n) => n + 1)}>
                {t("riprova")}
              </Button>
            </CardContent>
          </Card>
        ) : in_corso ? (
          <p className="py-8 text-center text-sm text-muted-foreground">{t("caricamento")}</p>
        ) : tipo === "club" && mesi !== null && mesi.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted-foreground">{t("nessun_mese")}</p>
        ) : per_giorno.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted-foreground">{t("mese_vuoto")}</p>
        ) : (
          <div className="space-y-3">
            {per_giorno.map(([data, lista]) => (
              <Card key={data}>
                <CardContent className="space-y-2 p-3">
                  <p className="text-sm font-semibold capitalize">{format_data_lunga(data)}</p>
                  <ul className="space-y-2">
                    {lista.map((r, i) => (
                      <li key={`${data}-${i}`} className="rounded-lg bg-muted/50 px-3 py-2">
                        <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
                          <span className="font-mono text-sm font-semibold">
                            {ora_breve(r.ora_inizio)}–{ora_breve(r.ora_fine)}
                          </span>
                          <span className="text-sm">{r.attivita}</span>
                          {r.pista && <span className="text-xs text-muted-foreground">{r.pista}</span>}
                        </div>
                        {r.nota && (
                          <p className="mt-1 rounded bg-primary/10 px-2 py-1 text-xs text-foreground">
                            <span className="font-semibold">{t("nota")}: </span>
                            {r.nota}
                          </p>
                        )}
                      </li>
                    ))}
                  </ul>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        <div className="pt-2 text-center">
          <Button variant="ghost" size="sm" className="text-muted-foreground" onClick={esci}>
            {t("cambia_codice")}
          </Button>
        </div>
      </div>
    </div>
  );
};

export default CalendarioPubblicoPage;
