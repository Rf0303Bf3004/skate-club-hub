import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { ChevronLeft, ChevronRight, CalendarDays } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { format_data_lunga, format_data } from "@/lib/format-data";
import { cn } from "@/lib/utils";

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

function iso_giorno(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

const CLASSI_LUOGO = ["bg-primary", "bg-accent"] as const;

const CalendarioPubblicoPage: React.FC = () => {
  const { t } = useTranslation("calendario");
  const { slug } = useParams<{ slug?: string }>();

  const [campo, set_campo] = useState("");
  const [codice, set_codice] = useState<string>(() => leggi_codice_salvato());
  const [errore_codice, set_errore_codice] = useState<TipoErrore | null>(null);

  /** Con lo slug nell'indirizzo non si digita nessun codice. */
  const tipo: "slug" | "club" | "atleta" | null = slug
    ? "slug"
    : codice.startsWith("CA-")
      ? "club"
      : codice.startsWith("AT-")
        ? "atleta"
        : null;

  /** Il club dello slug non esiste o ha spento il calendario pubblico. */
  const [slug_non_disponibile, set_slug_non_disponibile] = useState(false);

  // --- mesi disponibili ---
  const [mesi, set_mesi] = useState<RigaMese[] | null>(null);
  const [mesi_errore, set_mesi_errore] = useState<TipoErrore | null>(null);
  const [mesi_in_corso, set_mesi_in_corso] = useState(false);
  const [mese, set_mese] = useState<string>(() => iso_mese(new Date()));

  // --- righe del mese ---
  const [righe, set_righe] = useState<RigaSessione[] | null>(null);
  const [righe_errore, set_righe_errore] = useState<TipoErrore | null>(null);
  const [righe_in_corso, set_righe_in_corso] = useState(false);
  const [intestazione, set_intestazione] = useState<{ titolo: string; sotto: string }>({ titolo: "", sotto: "" });
  const [giorno_selezionato, set_giorno_selezionato] = useState<string | null>(null);
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
    set_intestazione({ titolo: "", sotto: "" });
    set_giorno_selezionato(null);
    set_mese(iso_mese(new Date()));
  }, []);

  // Carica i mesi disponibili per club e slug: è il database a dire dove
  // finisce l'attività pubblicata, e le frecce si fermano lì.
  useEffect(() => {
    if (!tipo || tipo === "atleta") return;
    let annullato = false;
    set_mesi_in_corso(true);
    set_mesi_errore(null);
    set_slug_non_disponibile(false);
    (async () => {
      const res =
        tipo === "slug"
          ? await supabase.rpc("calendario_pubblico_mesi_slug", { p_slug: slug })
          : await supabase.rpc("calendario_pubblico_mesi", { p_codice: codice });
      const data: unknown = res.data;
      const error: unknown = res.error;
      if (annullato) return;
      set_mesi_in_corso(false);
      if (error) {
        const tipo_err = tipo_errore(error);
        set_mesi(null);
        if (tipo_err === "codice") {
          if (tipo === "slug") {
            set_slug_non_disponibile(true);
          } else {
            set_errore_codice("codice");
            dimentica_codice();
            set_codice("");
          }
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
      if (lista.length > 0) {
        set_intestazione((prev) => ({
          titolo: lista[0].club ?? prev.titolo,
          sotto: lista[0].stagione ? t("stagione", { nome: lista[0].stagione }) : prev.sotto,
        }));
      }
    })();
    return () => {
      annullato = true;
    };
  }, [tipo, codice, slug, ricarica, t]);

  // Vista atleta: la funzione del database risponde al massimo su 62 giorni,
  // quindi si leggono il mese precedente, quello mostrato e il successivo.
  // I mesi trovati sono gli unici su cui le frecce si muovono.
  useEffect(() => {
    if (tipo !== "atleta") return;
    let annullato = false;
    set_righe_in_corso(true);
    set_righe_errore(null);
    (async () => {
      const precedente = sposta_mese(mese, -1);
      const successivo = sposta_mese(mese, 1);
      const [prima, dopo] = await Promise.all([
        supabase.rpc("programma_atleta_pubblico", {
          p_codice: codice,
          p_da: precedente,
          p_a: ultimo_giorno(mese),
        }),
        supabase.rpc("programma_atleta_pubblico", {
          p_codice: codice,
          p_da: mese,
          p_a: ultimo_giorno(successivo),
        }),
      ]);
      if (annullato) return;
      set_righe_in_corso(false);
      const error = prima.error ?? dopo.error;
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
      const tutte = [
        ...((prima.data ?? []) as RigaSessione[]),
        ...((dopo.data ?? []) as RigaSessione[]),
      ];
      const prefisso = mese.slice(0, 7);
      const del_mese = ((dopo.data ?? []) as RigaSessione[]).filter((r) => r.data.startsWith(prefisso));
      set_righe(del_mese);
      const trovati = new Map<string, number>();
      tutte.forEach((r) => {
        const m = `${r.data.slice(0, 7)}-01`;
        trovati.set(m, (trovati.get(m) ?? 0) + 1);
      });
      set_mesi((prev) => {
        const unione = new Map<string, number>();
        (prev ?? []).forEach((r) => unione.set(r.mese, r.sessioni));
        trovati.forEach((n, m) => unione.set(m, n));
        return Array.from(unione.entries())
          .sort((x, y) => x[0].localeCompare(y[0]))
          .map(([m, n]) => ({
            club: null,
            stagione: null,
            stagione_da: null,
            stagione_a: null,
            mese: m,
            sessioni: n,
          }));
      });
      // Un mese vuoto non deve cancellare l'intestazione già mostrata.
      const riferimento = del_mese[0] ?? tutte[0];
      set_intestazione((prev) => ({
        titolo: riferimento?.atleta ?? prev.titolo,
        sotto: riferimento?.club ?? prev.sotto,
      }));
    })();
    return () => {
      annullato = true;
    };
  }, [tipo, codice, mese, ricarica]);

  // Carica le righe del mese selezionato (club e slug).
  useEffect(() => {
    if (!tipo || tipo === "atleta") return;
    if (mesi === null || mesi.length === 0) {
      set_righe(null);
      return;
    }
    let annullato = false;
    set_righe_in_corso(true);
    set_righe_errore(null);
    (async () => {
      const parametri =
        tipo === "slug"
          ? { p_slug: slug, p_da: mese, p_a: ultimo_giorno(mese) }
          : { p_codice: codice, p_da: mese, p_a: ultimo_giorno(mese) };
      const fn = tipo === "slug" ? "calendario_pubblico_slug" : "calendario_pubblico";
      const { data, error } = await supabase.rpc(fn, parametri as never);
      if (annullato) return;
      set_righe_in_corso(false);
      if (error) {
        const tipo_err = tipo_errore(error);
        set_righe(null);
        if (tipo_err === "codice") {
          if (tipo === "slug") {
            set_slug_non_disponibile(true);
          } else {
            set_errore_codice("codice");
            dimentica_codice();
            set_codice("");
          }
        } else {
          set_righe_errore(tipo_err);
        }
        return;
      }
      const lista = (data ?? []) as RigaSessione[];
      set_righe(lista);
      // Un mese vuoto non deve cancellare l'intestazione già mostrata.
      const info = mesi?.[0];
      set_intestazione((prev) => ({
        titolo: info?.club ?? lista[0]?.club ?? prev.titolo,
        sotto: info?.stagione ? t("stagione", { nome: info.stagione }) : prev.sotto,
      }));
    })();
    return () => {
      annullato = true;
    };
  }, [tipo, codice, slug, mese, mesi, ricarica, t]);

  const mesi_disponibili = useMemo(() => (mesi ?? []).map((m) => m.mese), [mesi]);
  const puo_indietro = mesi_disponibili.some((m) => m < mese);
  const puo_avanti = mesi_disponibili.some((m) => m > mese);

  const vai = (delta: number) => {
    const candidati = delta < 0
      ? mesi_disponibili.filter((m) => m < mese)
      : mesi_disponibili.filter((m) => m > mese);
    if (candidati.length === 0) return;
    set_mese(delta < 0 ? candidati[candidati.length - 1] : candidati[0]);
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

  const righe_per_giorno = useMemo(() => new Map(per_giorno), [per_giorno]);

  useEffect(() => {
    if (righe === null) {
      set_giorno_selezionato(null);
      return;
    }
    const primo_giorno_attivo = per_giorno[0]?.[0] ?? null;
    set_giorno_selezionato((corrente) =>
      corrente?.startsWith(mese.slice(0, 7)) ? corrente : primo_giorno_attivo,
    );
  }, [mese, per_giorno, righe]);

  const celle_mese = useMemo(() => {
    const primo = new Date(`${mese}T00:00:00`);
    const giorni_nel_mese = new Date(primo.getFullYear(), primo.getMonth() + 1, 0).getDate();
    const riempimento_iniziale = (primo.getDay() + 6) % 7;
    const celle: Array<string | null> = Array.from({ length: riempimento_iniziale }, () => null);
    for (let giorno = 1; giorno <= giorni_nel_mese; giorno += 1) {
      celle.push(iso_giorno(new Date(primo.getFullYear(), primo.getMonth(), giorno)));
    }
    while (celle.length % 7 !== 0) celle.push(null);
    return celle;
  }, [mese]);

  const iniziali_giorni = useMemo(() => {
    const lunedi = new Date(2026, 0, 5);
    return Array.from({ length: 7 }, (_, indice) =>
      format_data(new Date(2026, 0, lunedi.getDate() + indice), { weekday: "narrow" }),
    );
  }, [t]);

  const luoghi = useMemo(() => {
    const distinti = new Map<string, string>();
    (righe ?? []).forEach((r) => {
      const chiave = r.pista ?? "__senza_luogo";
      if (!distinti.has(chiave)) distinti.set(chiave, r.pista ?? t("luogo_non_indicato"));
    });
    return Array.from(distinti.entries()).map(([chiave, etichetta], indice) => ({
      chiave,
      etichetta,
      classe: CLASSI_LUOGO[indice % CLASSI_LUOGO.length],
    }));
  }, [righe, t]);

  const classe_luogo = useMemo(
    () => new Map(luoghi.map((luogo) => [luogo.chiave, luogo.classe])),
    [luoghi],
  );
  const righe_giorno_selezionato = giorno_selezionato
    ? righe_per_giorno.get(giorno_selezionato) ?? []
    : [];
  const oggi = iso_giorno(new Date());

  const messaggio_errore = (e: TipoErrore) =>
    e === "freno" ? t("troppi_tentativi") : e === "codice" ? t("codice_non_riconosciuto") : t("errore_lettura");

  // --- indirizzo con nome del club non valido o calendario spento ---
  if (tipo === "slug" && slug_non_disponibile) {
    return (
      <div className="min-h-screen bg-muted/30 px-4 py-10">
        <div className="mx-auto w-full max-w-sm text-center">
          <CalendarDays className="mx-auto mb-3 h-8 w-8 text-muted-foreground" />
          <h1 className="text-lg font-semibold">{t("titolo")}</h1>
          <p className="mt-2 text-sm text-muted-foreground">{t("slug_non_disponibile")}</p>
        </div>
      </div>
    );
  }

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
        ) : tipo !== "atleta" && mesi !== null && mesi.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted-foreground">{t("nessun_mese")}</p>
        ) : per_giorno.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted-foreground">{t("mese_vuoto")}</p>
        ) : (
          <div className="space-y-4">
            <div>
              <div className="grid grid-cols-7" aria-hidden="true">
                {iniziali_giorni.map((iniziale, indice) => (
                  <div key={indice} className="py-2 text-center text-xs font-semibold uppercase text-muted-foreground">
                    {iniziale}
                  </div>
                ))}
              </div>
              <div className="grid grid-cols-7 overflow-hidden rounded-md border border-border bg-border gap-px">
                {celle_mese.map((data, indice) => {
                  if (!data) return <div key={`vuota-${indice}`} className="aspect-square min-h-10 bg-muted/30" aria-hidden="true" />;
                  const lista = righe_per_giorno.get(data) ?? [];
                  const selezionato = data === giorno_selezionato;
                  const odierno = data === oggi;
                  return (
                    <Button
                      key={data}
                      type="button"
                      variant="ghost"
                      onClick={() => set_giorno_selezionato(data)}
                      aria-pressed={selezionato}
                      aria-label={t("apri_giorno", { data: format_data_lunga(data), count: lista.length })}
                      className={cn(
                        "relative h-auto min-h-10 aspect-square min-w-0 flex-col justify-start gap-1 rounded-none bg-background px-1 py-1.5 hover:bg-muted",
                        selezionato && "z-10 bg-primary/10 ring-2 ring-inset ring-primary hover:bg-primary/10",
                        !selezionato && odierno && "ring-1 ring-inset ring-muted-foreground/60",
                      )}
                    >
                      <span className={cn("text-sm leading-none", odierno && "font-bold", !odierno && "font-normal")}>
                        {Number(data.slice(-2))}
                      </span>
                      {lista.length > 0 && (
                        <span className="flex max-w-full items-center justify-center gap-0.5" aria-hidden="true">
                          {lista.slice(0, 2).map((r, riga_indice) => (
                            <span
                              key={`${data}-${riga_indice}`}
                              className={cn("h-1.5 w-3 max-w-[30%] rounded-full", classe_luogo.get(r.pista ?? "__senza_luogo"))}
                            />
                          ))}
                          {lista.length > 2 && <span className="text-[10px] font-medium leading-none text-muted-foreground">+{lista.length - 2}</span>}
                        </span>
                      )}
                    </Button>
                  );
                })}
              </div>
            </div>

            {giorno_selezionato && (
              <Card>
                <CardContent className="space-y-2 p-3">
                  <p className="text-sm font-semibold capitalize">
                    {format_data_lunga(giorno_selezionato, {
                      weekday: "long",
                      day: "numeric",
                      month: "long",
                      year: "numeric",
                    })}
                  </p>
                  {righe_giorno_selezionato.length === 0 ? (
                    <p className="py-3 text-sm text-muted-foreground">{t("giorno_vuoto")}</p>
                  ) : (
                    <ul className="space-y-2">
                      {righe_giorno_selezionato.map((r, i) => (
                        <li key={`${giorno_selezionato}-${i}`} className="rounded-lg bg-muted/50 px-3 py-2">
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
                  )}
                </CardContent>
              </Card>
            )}

            <div className="space-y-2 border-t border-border pt-3" aria-label={t("legenda_luoghi")}>
              {luoghi.map((luogo) => (
                <div key={luogo.chiave} className="flex items-center gap-2 text-xs text-muted-foreground">
                  <span className={cn("h-2 w-5 shrink-0 rounded-full", luogo.classe)} aria-hidden="true" />
                  <span>{luogo.etichetta}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {tipo !== "slug" && (
          <div className="pt-2 text-center">
            <Button variant="ghost" size="sm" className="text-muted-foreground" onClick={esci}>
              {t("cambia_codice")}
            </Button>
          </div>
        )}
      </div>
    </div>
  );
};

export default CalendarioPubblicoPage;
