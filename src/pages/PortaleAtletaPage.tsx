import { useEffect, useState } from "react";
import { useParams, useSearchParams } from "react-router-dom";
import { Loader2, User, Calendar as CalIcon, FileText, Trophy, BookOpen, AlertCircle, Check, GraduationCap, Medal } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "@/hooks/use-toast";
import { useTranslation } from "react-i18next";
import { use_contenuti_traduzioni } from "@/hooks/use-contenuti-traduzioni";
import { formatta_livelli_corso, is_apertura_totale, livello_dichiarato } from "@/lib/livelli-corso";
import DateInput from "@/components/forms/DateInput";

import { format_data } from "@/lib/format-data";
// Portale pubblico mobile-first: l'identificativo è il `codice_atleta` (AT-XXXX-XXXX).
// Tutto passa dalle funzioni del database `*_pubblico` / `*_pubblica` (client anon):
// nessuna edge function, quindi il Publish porta sempre la versione aggiornata.

import { supabase } from "@/lib/supabase";
import { segnala_errore } from "@/lib/errori";

type TabKey = "dati" | "calendario" | "comunicazioni" | "fatture" | "iscrivi" | "private" | "palmares";

type ErroreLettura = { messaggio: string; riprovabile: boolean };
const CODICI_CON_MESSAGGIO_DB = new Set(["53400", "23505", "P0001", "22023"]);
const FASCE = ["mattina", "pomeriggio", "sera"] as const;

function oggi_iso(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

const PortaleAtletaPage: React.FC = () => {
  const { t } = useTranslation("portale");
  const { t: t_corsi } = useTranslation("corsi");
  const { token: token_param } = useParams<{ token: string }>();
  const [search_params] = useSearchParams();
  const token = token_param || search_params.get("token") || "";
  const [loading, set_loading] = useState(true);
  const [atleta, set_atleta] = useState<any | null>(null);
  const [errore, set_errore] = useState<string | null>(null);
  const [tab, set_tab] = useState<TabKey>("dati");

  const [eventi_calendario, set_eventi_calendario] = useState<any[]>([]);
  const [comunicazioni, set_comunicazioni] = useState<any[]>([]);
  const [fatture, set_fatture] = useState<any[]>([]);
  const [corsi_disponibili, set_corsi_disponibili] = useState<any[]>([]);
  const [iscrizioni_attive, set_iscrizioni_attive] = useState<Set<string>>(new Set());
  const [richieste_inviate, set_richieste_inviate] = useState<Set<string>>(new Set());
  const [private_righe, set_private_righe] = useState<any[]>([]);
  const [palmares, set_palmares] = useState<any[]>([]);
  const [istruttori, set_istruttori] = useState<{ istruttore_id: string; nome: string }[]>([]);
  const [busy_id, set_busy_id] = useState<string | null>(null);
  // Stato della lettura della scheda aperta (avvisi, corsi, private): tre stati distinti.
  const [errore_lettura, set_errore_lettura] = useState<ErroreLettura | null>(null);
  const [caricato, set_caricato] = useState(false);
  const [tentativo, set_tentativo] = useState(0);

  // Modulo lezione privata
  const [lp_data, set_lp_data] = useState("");
  const [lp_fascia, set_lp_fascia] = useState("");
  const [lp_istruttore, set_lp_istruttore] = useState("");
  const [lp_note, set_lp_note] = useState("");
  const [lp_invio, set_lp_invio] = useState(false);

  const { traduci } = use_contenuti_traduzioni(
    "comunicazioni",
    comunicazioni.map((c: any) => c?.comunicazione_id).filter(Boolean),
  );

  /** Traduce un errore delle funzioni DB in un messaggio per la famiglia. */
  const interpreta_errore = (err: any, generico: string): ErroreLettura => {
    const codice = err?.code ?? null;
    if (codice === "P0002") return { messaggio: t("atleta_page.corsi_errore_codice"), riprovabile: false };
    if (codice && CODICI_CON_MESSAGGIO_DB.has(codice)) return { messaggio: err?.message || generico, riprovabile: false };
    return { messaggio: generico, riprovabile: true };
  };

  useEffect(() => {
    (async () => {
      if (!token) {
        set_errore(t("atleta_page.link_non_valido"));
        set_loading(false);
        return;
      }
      try {
        const { data, error } = await supabase.rpc("scheda_atleta_pubblica", { p_codice: token });
        if (error) throw error;
        const riga = Array.isArray(data) ? data[0] : data;
        if (!riga) throw Object.assign(new Error("scheda_vuota"), { code: "P0002" });
        set_atleta(riga);
      } catch (err: any) {
        const codice = err?.code ?? null;
        set_errore(
          codice === "P0002" ? t("atleta_page.corsi_errore_codice")
          : codice === "53400" ? (err?.message || t("atleta_page.errore_caricamento"))
          : t("atleta_page.errore_caricamento"),
        );
        if (codice !== "P0002") segnala_errore("PortaleAtletaPage", t("atleta_page.errore_caricamento"), err, { azione: "scheda" });
      } finally {
        set_loading(false);
      }
    })();
  }, [token]);

  useEffect(() => {
    if (!atleta) return;
    let annullato = false;
    set_errore_lettura(null);
    set_caricato(false);
    (async () => {
      if (tab === "dati") return;
      const generico =
        tab === "comunicazioni" ? t("atleta_page.errore_avvisi")
        : tab === "private" ? t("atleta_page.errore_private")
        : tab === "calendario" ? t("atleta_page.errore_calendario")
        : tab === "fatture" ? t("atleta_page.errore_fatture")
        : tab === "palmares" ? t("atleta_page.errore_palmares")
        : t("atleta_page.errore_corsi");
      try {
        if (tab === "calendario") {
          const { data, error } = await supabase.rpc("calendario_atleta_pubblico", { p_codice: token, p_giorni: 60 });
          if (error) throw error;
          if (!annullato) set_eventi_calendario((data ?? []) as any[]);
        } else if (tab === "fatture") {
          const { data, error } = await supabase.rpc("fatture_atleta_pubblico", { p_codice: token });
          if (error) throw error;
          if (!annullato) set_fatture((data ?? []) as any[]);
        } else if (tab === "palmares") {
          const { data, error } = await supabase.rpc("palmares_atleta_pubblico", { p_codice: token });
          if (error) throw error;
          if (!annullato) set_palmares((data ?? []) as any[]);
        } else if (tab === "comunicazioni") {
          const { data, error } = await supabase.rpc("comunicazioni_atleta_pubblico", { p_codice: token });
          if (error) throw error;
          if (!annullato) set_comunicazioni((data ?? []) as any[]);
        } else if (tab === "iscrivi") {
          const { data, error } = await supabase.rpc("corsi_atleta_pubblico", { p_codice: token });
          if (error) throw error;
          const righe = (data ?? []) as any[];
          if (annullato) return;
          set_corsi_disponibili(righe);
          set_iscrizioni_attive(new Set(righe.filter((r) => r.iscritto).map((r) => r.corso_id)));
          set_richieste_inviate(new Set(righe.filter((r) => r.richiesta_in_attesa).map((r) => r.corso_id)));
        } else if (tab === "private") {
          const [lp, ist] = await Promise.all([
            supabase.rpc("lezioni_private_atleta_pubblico", { p_codice: token }),
            supabase.rpc("istruttori_club_pubblico", { p_codice: token }),
          ]);
          if (lp.error) throw lp.error;
          if (ist.error) throw ist.error;
          if (annullato) return;
          set_private_righe((lp.data ?? []) as any[]);
          set_istruttori((ist.data ?? []) as any[]);
        }
        if (!annullato) set_caricato(true);
      } catch (err: any) {
        if (annullato) return;
        const esito = interpreta_errore(err, generico);
        set_errore_lettura(esito);
        await segnala_errore("PortaleAtletaPage", esito.messaggio, err, { tab, token_presente: !!token }, "avviso");
      }
    })();
    return () => { annullato = true; };
  }, [tab, atleta, token, tentativo]);

  const handle_rsvp = async (destinatario_id: string, risposta: "si" | "no") => {
    set_busy_id(destinatario_id);
    try {
      const { error } = await supabase.rpc("rsvp_atleta_pubblico", {
        p_codice: token, p_destinatario: destinatario_id, p_risposta: risposta,
      });
      if (error) throw error;
      set_comunicazioni((prev) =>
        prev.map((c) =>
          c.destinatario_id === destinatario_id
            ? { ...c, rsvp_risposta: risposta, rsvp_at: new Date().toISOString() }
            : c,
        ),
      );
      toast({ title: t("atleta_page.risposta_inviata", { risposta: risposta === "si" ? t("atleta_page.si") : t("atleta_page.no") }) });
    } catch (err: any) {
      const esito = interpreta_errore(err, t("atleta_page.errore_rsvp"));
      toast({ title: t("atleta_page.errore"), description: esito.messaggio, variant: "destructive" });
      segnala_errore("PortaleAtletaPage", esito.messaggio, err, { azione: "rsvp" }, "avviso");
    } finally {
      set_busy_id(null);
    }
  };

  const handle_richiedi_iscrizione = async (corso: any) => {
    set_busy_id(corso.corso_id);
    try {
      const { error } = await supabase.rpc("richiedi_iscrizione_pubblica", { p_codice: token, p_corso: corso.corso_id });
      if (error) throw error;
      set_richieste_inviate((prev) => new Set([...prev, corso.corso_id]));
      toast({ title: t("atleta_page.richiesta_inviata_titolo"), description: t("atleta_page.richiesta_inviata_desc", { nome_corso: corso.nome }) });
    } catch (err: any) {
      const esito = interpreta_errore(err, t("atleta_page.errore_richiesta"));
      toast({ title: t("atleta_page.errore"), description: esito.messaggio, variant: "destructive" });
      segnala_errore("PortaleAtletaPage", esito.messaggio, err, { azione: "richiedi_iscrizione" }, "avviso");
    } finally {
      set_busy_id(null);
    }
  };

  const lp_data_valida = !!lp_data && lp_data >= oggi_iso();

  const handle_richiedi_privata = async () => {
    if (!lp_data_valida) return;
    set_lp_invio(true);
    try {
      const { error } = await supabase.rpc("richiedi_lezione_privata_pubblica", {
        p_codice: token,
        p_data: lp_data,
        p_fascia: lp_fascia || null,
        p_note: lp_note.trim() || null,
        p_istruttore: lp_istruttore || null,
      } as any);
      if (error) throw error;
      toast({ title: t("atleta_page.privata_inviata") });
      set_lp_data(""); set_lp_fascia(""); set_lp_istruttore(""); set_lp_note("");
      set_tentativo((n) => n + 1);
    } catch (err: any) {
      const esito = interpreta_errore(err, t("atleta_page.errore_richiesta"));
      toast({ title: t("atleta_page.errore"), description: esito.messaggio, variant: "destructive" });
      segnala_errore("PortaleAtletaPage", esito.messaggio, err, { azione: "richiedi_privata" }, "avviso");
    } finally {
      set_lp_invio(false);
    }
  };

  const testo_prezzo = (corso: any): { importo: string | null; suffisso: string } => {
    const mensile = Number(corso.costo_mensile);
    const annuale = Number(corso.costo_annuale);
    if (mensile > 0) return { importo: `CHF ${mensile.toFixed(2)}`, suffisso: t("atleta_page.mese_suffisso") };
    if (annuale > 0) return { importo: `CHF ${annuale.toFixed(2)}`, suffisso: t("atleta_page.anno_suffisso") };
    return { importo: null, suffisso: t("atleta_page.prezzo_da_definire") };
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (errore || !atleta) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-6">
        <div className="max-w-sm w-full bg-card border border-border rounded-2xl p-6 text-center space-y-3 shadow-card">
          <AlertCircle className="w-12 h-12 text-destructive mx-auto" />
          <h1 className="text-lg font-bold text-foreground">{t("atleta_page.accesso_non_disponibile")}</h1>
          <p className="text-sm text-muted-foreground">
            {errore ?? t("atleta_page.link_non_valido_contatta")}
          </p>
        </div>
      </div>
    );
  }

  const nome_completo = `${atleta.nome} ${atleta.cognome}`.trim();
  // Riga di riepilogo in testa alla scheda Iscriviti: nome, club, categoria e livello
  // letti dalla prima riga della RPC `corsi_atleta_pubblico`.
  const riga_riepilogo = corsi_disponibili[0] ?? null;
  const iniziali = `${atleta.nome?.[0] ?? ""}${atleta.cognome?.[0] ?? ""}`.toUpperCase();

  const tabs: { key: TabKey; label: string; icon: any }[] = [
    { key: "dati", label: t("atleta_page.tab_atleta"), icon: User },
    { key: "calendario", label: t("atleta_page.tab_agenda"), icon: CalIcon },
    { key: "comunicazioni", label: t("atleta_page.tab_avvisi"), icon: BookOpen },
    { key: "fatture", label: t("atleta_page.tab_fatture"), icon: FileText },
    { key: "iscrivi", label: t("atleta_page.tab_iscriviti"), icon: Trophy },
    { key: "private", label: t("atleta_page.tab_private"), icon: GraduationCap },
    { key: "palmares", label: t("atleta_page.tab_palmares"), icon: Medal },
  ];

  return (
    <div className="min-h-screen bg-background pb-24">
      <header className="bg-primary text-primary-foreground px-4 py-5 sm:px-6">
        <div className="max-w-2xl mx-auto flex items-center gap-3">
          <div className="w-12 h-12 rounded-full bg-primary-foreground/15 flex items-center justify-center text-lg font-bold">
            {iniziali || "?"}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs uppercase tracking-wider text-primary-foreground/70">{t("atleta_page.header_titolo")}</p>
            <h1 className="text-base sm:text-lg font-bold truncate">{nome_completo}</h1>
            {atleta.club_nome && <p className="text-xs text-primary-foreground/80 truncate">{atleta.club_nome}</p>}
          </div>
        </div>
      </header>

      <nav className="sticky top-0 z-10 bg-card border-b border-border overflow-x-auto">
        <div className="max-w-2xl mx-auto flex">
          {tabs.map((t) => {
            const Icon = t.icon;
            const active = tab === t.key;
            return (
              <button
                key={t.key}
                onClick={() => set_tab(t.key)}
                className={`flex-1 min-w-[72px] flex flex-col items-center gap-1 py-2.5 text-xs font-medium transition-colors ${
                  active
                    ? "text-primary border-b-2 border-primary"
                    : "text-muted-foreground border-b-2 border-transparent"
                }`}
              >
                <Icon className="w-4 h-4" />
                {t.label}
              </button>
            );
          })}
        </div>
      </nav>

      <main className="max-w-2xl mx-auto px-4 py-5 sm:px-6 space-y-4">
        {tab === "dati" && (
          <div className="space-y-4">
            <div className="bg-card border border-border rounded-xl p-4 shadow-card">
              <h2 className="text-sm font-bold text-foreground mb-3">{t("atleta_page.dati_anagrafici")}</h2>
              <dl className="space-y-2 text-sm">
                <Row label={t("atleta_page.nome")}>{nome_completo}</Row>
                <Row label={t("atleta_page.data_nascita")}>
                  {atleta.data_nascita
                    ? format_data(new Date(atleta.data_nascita + "T00:00:00"), { day: "2-digit", month: "2-digit", year: "numeric" })
                    : "—"}
                </Row>
                <Row label={t("atleta_page.indirizzo")}>
                  {[atleta.indirizzo, [atleta.cap, atleta.citta].filter(Boolean).join(" "), atleta.cantone].filter(Boolean).join(", ") || "—"}
                </Row>
                <Row label={t("atleta_page.telefono")}>{atleta.telefono || "—"}</Row>
                <Row label={t("atleta_page.categoria")}>{atleta.categoria || "—"}</Row>
              </dl>
            </div>

            <div className="bg-card border border-border rounded-xl p-4 shadow-card">
              <h2 className="text-sm font-bold text-foreground mb-3">{t("atleta_page.livello_tecnico")}</h2>
              <div className="flex flex-wrap gap-2">
                {atleta.livello_amatori && <Badge variant="outline">{t("atleta_page.amatori_label")}: {atleta.livello_amatori}</Badge>}
                {atleta.livello_artistica && <Badge variant="outline">{t("atleta_page.artistica_label")}: {atleta.livello_artistica}</Badge>}
                {atleta.livello_stile && <Badge variant="outline">{t("atleta_page.stile_label")}: {atleta.livello_stile}</Badge>}
                {!atleta.livello_amatori && !atleta.livello_artistica && !atleta.livello_stile && atleta.livello_attuale && (
                  <Badge variant="outline">{atleta.livello_attuale}</Badge>
                )}
                {!atleta.livello_amatori && !atleta.livello_artistica && !atleta.livello_stile && !atleta.livello_attuale && (
                  <p className="text-sm text-muted-foreground">{t("atleta_page.nessun_livello")}</p>
                )}
              </div>
            </div>

            {(atleta.licenza_numero || atleta.licenza_disciplina) && (
              <div className="bg-card border border-border rounded-xl p-4 shadow-card">
                <h2 className="text-sm font-bold text-foreground mb-3">{t("atleta_page.licenza_sis_titolo")}</h2>
                <dl className="space-y-2 text-sm">
                  <Row label={t("atleta_page.numero")}>{atleta.licenza_numero || "—"}</Row>
                  <Row label={t("atleta_page.disciplina")}>{atleta.licenza_disciplina || "—"}</Row>
                  <Row label={t("atleta_page.categoria")}>{atleta.licenza_categoria || "—"}</Row>
                  <Row label={t("atleta_page.validita")}>
                    {atleta.licenza_validita
                      ? format_data(new Date(String(atleta.licenza_validita).slice(0, 10) + "T00:00:00"), { day: "2-digit", month: "2-digit", year: "numeric" })
                      : "—"}
                  </Row>
                </dl>
              </div>
            )}
          </div>
        )}

        {tab === "calendario" && (
          <div className="space-y-3">
            <h2 className="text-sm font-bold text-foreground">{t("atleta_page.prossimi_impegni")}</h2>
            {errore_lettura ? (
              <BoxErrore errore={errore_lettura} etichetta={t("atleta_page.riprova")} on_riprova={() => set_tentativo((n) => n + 1)} />
            ) : !caricato ? (
              <Caricamento />
            ) : eventi_calendario.length === 0 ? (
              <EmptyState icon={CalIcon} text={t("atleta_page.nessun_impegno_futuro")} />
            ) : (
              eventi_calendario.map((e, i) => (
                <div key={i} className="bg-card border border-border rounded-xl p-3 shadow-card flex gap-3">
                  <div className="flex flex-col items-center justify-center bg-primary/10 text-primary rounded-lg px-3 py-2 min-w-[60px]">
                    <span className="text-xs uppercase font-bold">
                      {format_data(new Date(e.data + "T00:00:00"), { month: "short" })}
                    </span>
                    <span className="text-xl font-black leading-none">
                      {new Date(e.data + "T00:00:00").getDate()}
                    </span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-foreground truncate">{e.titolo}</p>
                    <p className="text-xs text-muted-foreground">
                      {e.tipo}
                      {e.ora_inizio && ` · ${e.ora_inizio.slice(0, 5)}`}
                      {e.ora_fine && ` - ${e.ora_fine.slice(0, 5)}`}
                    </p>
                    {e.luogo && <p className="text-xs text-muted-foreground mt-0.5 truncate">📍 {e.luogo}</p>}
                    {e.nota && <p className="text-xs text-muted-foreground mt-0.5 whitespace-pre-wrap">{e.nota}</p>}
                  </div>
                </div>
              ))
            )}
          </div>
        )}

        {tab === "comunicazioni" && (
          <div className="space-y-3">
            <h2 className="text-sm font-bold text-foreground">{t("atleta_page.avvisi_dal_club")}</h2>
            {errore_lettura ? (
              <BoxErrore errore={errore_lettura} etichetta={t("atleta_page.riprova")} on_riprova={() => set_tentativo((n) => n + 1)} />
            ) : !caricato ? (
              <Caricamento />
            ) : comunicazioni.length === 0 ? (
              <EmptyState icon={BookOpen} text={t("atleta_page.nessun_avviso")} />
            ) : (
              comunicazioni.map((c) => {
                const gia_risposto = !!c.rsvp_risposta;
                const scaduta = !!c.rsvp_scadenza && new Date(c.rsvp_scadenza).getTime() < Date.now();
                return (
                  <div key={c.destinatario_id} className={`bg-card border rounded-xl p-4 shadow-card ${c.urgente ? "border-destructive border-2" : "border-border"}`}>
                    {c.urgente && (
                      <Badge variant="destructive" className="mb-2">{t("atleta_page.urgente")}</Badge>
                    )}
                    <div className="flex items-start justify-between gap-2 mb-1.5">
                      <h3 className="text-sm font-bold text-foreground">{traduci(c.comunicazione_id, "titolo", c.titolo)}</h3>
                      <span className="text-[10px] text-muted-foreground whitespace-nowrap">
                        {c.creato_at ? format_data(new Date(c.creato_at), { day: "2-digit", month: "2-digit", year: "numeric" }) : ""}
                      </span>
                    </div>
                    <p className="text-sm text-muted-foreground whitespace-pre-wrap">
                      {traduci(c.comunicazione_id, "testo", c.testo)}
                    </p>
                    {c.richiede_rsvp && (
                      <div className="mt-3 pt-3 border-t border-border space-y-2">
                        {c.rsvp_scadenza && (
                          <p className={`text-xs ${scaduta ? "text-destructive font-medium" : "text-muted-foreground"}`}>
                            {t(scaduta ? "atleta_page.rsvp_scaduta" : "atleta_page.rsvp_entro", {
                              data: format_data(new Date(c.rsvp_scadenza), { day: "2-digit", month: "2-digit", year: "numeric" }),
                            })}
                          </p>
                        )}
                        {gia_risposto ? (
                          <div className="flex items-center gap-2 text-sm">
                            <Check className="w-4 h-4 text-success" />
                            <span className="text-muted-foreground">
                              {t("atleta_page.risposto_label")} <strong className="text-foreground">{c.rsvp_risposta === "si" ? t("atleta_page.si") : t("atleta_page.no")}</strong>
                            </span>
                          </div>
                        ) : (
                          <div className="flex gap-2">
                            <Button size="sm" className="flex-1 bg-success hover:bg-success/90 text-success-foreground" onClick={() => handle_rsvp(c.destinatario_id, "si")} disabled={scaduta || busy_id === c.destinatario_id}>
                              {t("atleta_page.si_partecipo")}
                            </Button>
                            <Button size="sm" variant="outline" className="flex-1" onClick={() => handle_rsvp(c.destinatario_id, "no")} disabled={scaduta || busy_id === c.destinatario_id}>
                              {t("atleta_page.no_button")}
                            </Button>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>
        )}

        {tab === "fatture" && (
          <div className="space-y-3">
            <h2 className="text-sm font-bold text-foreground">{t("atleta_page.le_tue_fatture")}</h2>
            {errore_lettura ? (
              <BoxErrore errore={errore_lettura} etichetta={t("atleta_page.riprova")} on_riprova={() => set_tentativo((n) => n + 1)} />
            ) : !caricato ? (
              <Caricamento />
            ) : fatture.length === 0 ? (
              <EmptyState icon={FileText} text={t("atleta_page.nessuna_fattura")} />
            ) : (
              fatture.map((f) => (
                <div key={f.fattura_id} className="bg-card border border-border rounded-xl p-4 shadow-card">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <p className="text-xs text-muted-foreground">{f.numero || t("atleta_page.fattura_label")}</p>
                      <p className="text-sm font-semibold text-foreground truncate">{f.descrizione || f.tipo}</p>
                      <p className="text-xs text-muted-foreground mt-1">
                        {f.data_emissione
                          ? format_data(new Date(f.data_emissione + "T00:00:00"), { day: "2-digit", month: "2-digit", year: "numeric" })
                          : ""}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-base font-bold text-foreground tabular-nums">CHF {Number(f.importo || 0).toFixed(2)}</p>
                      <Badge className={f.pagata ? "bg-success/15 text-success border-success/30" : "bg-warning/15 text-warning border-warning/30"} variant="outline">
                        {f.pagata ? t("atleta_page.pagata") : t("atleta_page.da_pagare")}
                      </Badge>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        )}

        {tab === "iscrivi" && (
          <div className="space-y-3">
            <h2 className="text-sm font-bold text-foreground">{t("atleta_page.corsi_disponibili")}</h2>
            <p className="text-xs text-muted-foreground">
              {t("atleta_page.corsi_disponibili_desc")}
            </p>
            {errore_lettura ? (
              <BoxErrore errore={errore_lettura} etichetta={t("atleta_page.riprova")} on_riprova={() => set_tentativo((n) => n + 1)} />
            ) : !caricato ? (
              <Caricamento />
            ) : (
              <>
                {riga_riepilogo && (
                  <div className="bg-card border border-border rounded-xl p-4 shadow-card">
                    <dl className="space-y-2 text-sm">
                      <Row label={t("atleta_page.nome")}>{riga_riepilogo.atleta}</Row>
                      <Row label={t("atleta_page.club_label")}>{riga_riepilogo.club}</Row>
                      <Row label={t("atleta_page.categoria")}>{riga_riepilogo.categoria || "—"}</Row>
                      <Row label={t("atleta_page.livello_label")}>{riga_riepilogo.livello || "—"}</Row>
                    </dl>
                  </div>
                )}
                {corsi_disponibili.length === 0 ? (
                  <EmptyState icon={Trophy} text={t("atleta_page.corsi_vuoto_livello", { nome: nome_completo })} />
                ) : (
                  corsi_disponibili.map((corso) => {
                    const gia_iscritto = iscrizioni_attive.has(corso.corso_id);
                    const richiesta = richieste_inviate.has(corso.corso_id);
                    const prezzo = testo_prezzo(corso);
                    const posti = corso.posti_liberi == null ? null : Number(corso.posti_liberi);
                    return (
                  <div key={corso.corso_id} className="bg-card border border-border rounded-xl p-4 shadow-card">
                    <div className="flex items-start justify-between gap-3 mb-2">
                      <div className="flex-1 min-w-0">
                        <h3 className="text-sm font-bold text-foreground">{corso.nome}</h3>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          {corso.giorno || t("atleta_page.da_posizionare")}
                          {corso.ora_inizio && ` · ${corso.ora_inizio.slice(0, 5)}`}
                          {corso.ora_fine && ` - ${corso.ora_fine.slice(0, 5)}`}
                        </p>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          {t("atleta_page.istruttore_label")}: {corso.istruttori || t("atleta_page.istruttore_da_definire")}
                        </p>
                        {posti != null && (
                          <p className={`text-xs mt-0.5 ${posti <= 0 ? "text-destructive font-medium" : "text-muted-foreground"}`}>
                            {posti <= 0 ? t("atleta_page.completo") : t("atleta_page.posti_liberi", { count: posti })}
                          </p>
                        )}
                        {corso.richiede_approvazione && (
                          <p className="text-xs text-warning mt-0.5">{t("atleta_page.serve_approvazione")}</p>
                        )}
                        {livello_dichiarato(corso.livello_richiesto) && !is_apertura_totale(corso.livello_richiesto) && (
                          <Badge variant="outline" className="mt-2 text-[10px]">
                            {t("atleta_page.livello_label")}: {formatta_livelli_corso(corso.livello_richiesto, t_corsi)}
                          </Badge>
                        )}
                      </div>
                      <div className="text-right">
                        {prezzo.importo && <p className="text-sm font-bold text-primary tabular-nums">{prezzo.importo}</p>}
                        <p className="text-[10px] text-muted-foreground">{prezzo.suffisso}</p>
                      </div>
                    </div>
                    {gia_iscritto ? (
                      <Button disabled variant="outline" className="w-full" size="sm">
                        <Check className="w-4 h-4 mr-1" /> {t("atleta_page.gia_iscritto")}
                      </Button>
                    ) : richiesta ? (
                      <Button disabled variant="outline" className="w-full" size="sm">{t("atleta_page.richiesta_in_attesa")}</Button>
                    ) : (
                      <Button className="w-full" size="sm" onClick={() => handle_richiedi_iscrizione(corso)} disabled={busy_id === corso.corso_id}>
                        {busy_id === corso.corso_id ? <Loader2 className="w-4 h-4 animate-spin" /> : t("atleta_page.richiedi_iscrizione")}
                      </Button>
                    )}
                  </div>
                );
                  })
                )}
              </>
            )}
          </div>
        )}
        {tab === "private" && (
          <div className="space-y-3">
            <h2 className="text-sm font-bold text-foreground">{t("atleta_page.private_titolo")}</h2>
            {errore_lettura ? (
              <BoxErrore errore={errore_lettura} etichetta={t("atleta_page.riprova")} on_riprova={() => set_tentativo((n) => n + 1)} />
            ) : !caricato ? (
              <Caricamento />
            ) : (
              <>
                {private_righe.length === 0 ? (
                  <EmptyState icon={GraduationCap} text={t("atleta_page.private_vuoto")} />
                ) : (
                  [...private_righe]
                    .sort((x, y) => Number(y.genere === "richiesta" && y.stato === "in_attesa") - Number(x.genere === "richiesta" && x.stato === "in_attesa"))
                    .map((r) => {
                      const in_attesa = r.genere === "richiesta" && r.stato === "in_attesa";
                      return (
                        <div key={`${r.genere}-${r.riga_id}`} className={`bg-card border rounded-xl p-4 shadow-card ${in_attesa ? "border-warning border-2" : "border-border"}`}>
                          <div className="flex items-start justify-between gap-2">
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-bold text-foreground">
                                {r.genere === "richiesta" ? t("atleta_page.privata_richiesta") : t("atleta_page.privata_lezione")}
                              </p>
                              <p className="text-xs text-muted-foreground mt-0.5">
                                {r.data ? format_data(new Date(r.data + "T00:00:00"), { weekday: "short", day: "2-digit", month: "2-digit", year: "numeric" }) : "—"}
                                {r.ora_inizio && ` · ${r.ora_inizio.slice(0, 5)}`}
                                {r.ora_fine && ` - ${r.ora_fine.slice(0, 5)}`}
                              </p>
                              <p className="text-xs text-muted-foreground">
                                {t("atleta_page.istruttore_label")}: {r.istruttore || t("atleta_page.indifferente")}
                              </p>
                              {r.note && <p className="text-xs text-muted-foreground mt-1 whitespace-pre-wrap">{r.note}</p>}
                              {r.note_risposta && (
                                <p className="text-xs text-foreground mt-1 whitespace-pre-wrap">{t("atleta_page.risposta_club")}: {r.note_risposta}</p>
                              )}
                            </div>
                            <div className="text-right space-y-1">
                              {r.stato && (
                                <Badge variant="outline" className={in_attesa ? "bg-warning/15 text-warning border-warning/30" : ""}>
                                  {t(`atleta_page.stato_${r.stato}`, { defaultValue: r.stato })}
                                </Badge>
                              )}
                              {Number(r.costo) > 0 && <p className="text-xs font-bold tabular-nums">CHF {Number(r.costo).toFixed(2)}</p>}
                            </div>
                          </div>
                        </div>
                      );
                    })
                )}

                <div className="bg-card border border-border rounded-xl p-4 shadow-card space-y-3">
                  <h3 className="text-sm font-bold text-foreground">{t("atleta_page.privata_nuova")}</h3>
                  <div className="space-y-1">
                    <label className="text-xs text-muted-foreground">{t("atleta_page.privata_data")}</label>
                    <DateInput value={lp_data} onChange={set_lp_data} min_year={new Date().getFullYear()} max_year={new Date().getFullYear() + 1} />
                    {lp_data && !lp_data_valida && (
                      <p className="text-xs text-destructive">{t("atleta_page.privata_data_passata")}</p>
                    )}
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs text-muted-foreground">{t("atleta_page.privata_fascia")}</label>
                    <select className="w-full h-9 rounded-md border border-input bg-background px-2 text-sm" value={lp_fascia} onChange={(e) => set_lp_fascia(e.target.value)}>
                      <option value="">{t("atleta_page.indifferente")}</option>
                      {FASCE.map((f) => <option key={f} value={f}>{t(`atleta_page.fascia_${f}`)}</option>)}
                    </select>
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs text-muted-foreground">{t("atleta_page.istruttore_label")}</label>
                    <select className="w-full h-9 rounded-md border border-input bg-background px-2 text-sm" value={lp_istruttore} onChange={(e) => set_lp_istruttore(e.target.value)}>
                      <option value="">{t("atleta_page.indifferente")}</option>
                      {istruttori.map((i) => <option key={i.istruttore_id} value={i.istruttore_id}>{i.nome}</option>)}
                    </select>
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs text-muted-foreground">{t("atleta_page.privata_note")}</label>
                    <Textarea value={lp_note} onChange={(e) => set_lp_note(e.target.value)} rows={3} />
                  </div>
                  <Button className="w-full" size="sm" disabled={!lp_data_valida || lp_invio} onClick={handle_richiedi_privata}>
                    {lp_invio ? <Loader2 className="w-4 h-4 animate-spin" /> : t("atleta_page.privata_invia")}
                  </Button>
                </div>
              </>
            )}
          </div>
        )}
        {tab === "palmares" && (
          <div className="space-y-3">
            <h2 className="text-sm font-bold text-foreground">{t("atleta_page.palmares_titolo", { nome: nome_completo })}</h2>
            {errore_lettura ? (
              <BoxErrore errore={errore_lettura} etichetta={t("atleta_page.riprova")} on_riprova={() => set_tentativo((n) => n + 1)} />
            ) : !caricato ? (
              <Caricamento />
            ) : palmares.length === 0 ? (
              <EmptyState icon={Medal} text={t("atleta_page.palmares_vuoto")} />
            ) : (
              palmares.map((r) => (
                <div key={r.stagione} className={`bg-card rounded-xl p-4 shadow-card border ${r.stagione_attiva ? "border-primary border-2" : "border-border"}`}>
                  <div className="flex items-center justify-between gap-2 mb-2">
                    <h3 className="text-sm font-bold text-foreground">{r.stagione}</h3>
                    {r.stagione_attiva && <Badge>{t("atleta_page.stagione_in_corso")}</Badge>}
                  </div>
                  <div className="grid grid-cols-3 gap-2 text-center mb-2">
                    <div><p className="text-lg">🥇</p><p className="text-sm font-bold tabular-nums">{r.oro ?? 0}</p></div>
                    <div><p className="text-lg">🥈</p><p className="text-sm font-bold tabular-nums">{r.argento ?? 0}</p></div>
                    <div><p className="text-lg">🥉</p><p className="text-sm font-bold tabular-nums">{r.bronzo ?? 0}</p></div>
                  </div>
                  <dl className="space-y-1 text-sm">
                    <Row label={t("atleta_page.partecipazioni")}>{r.partecipazioni ?? 0}</Row>
                    <Row label={t("atleta_page.miglior_punteggio")}>{r.miglior_punteggio != null ? Number(r.miglior_punteggio).toFixed(2) : "—"}</Row>
                    <Row label={t("atleta_page.miglior_posizione")}>{r.miglior_posizione != null ? `${r.miglior_posizione}°` : "—"}</Row>
                  </dl>
                </div>
              ))
            )}
          </div>
        )}
      </main>
    </div>
  );
};

const Row: React.FC<{ label: string; children: React.ReactNode }> = ({ label, children }) => (
  <div className="flex justify-between gap-3 border-b border-border/50 last:border-0 pb-2 last:pb-0">
    <dt className="text-muted-foreground text-xs uppercase tracking-wide">{label}</dt>
    <dd className="text-foreground font-medium text-right break-words">{children}</dd>
  </div>
);

const EmptyState: React.FC<{ icon: any; text: string }> = ({ icon: Icon, text }) => (
  <div className="bg-card border border-dashed border-border rounded-xl p-8 text-center">
    <Icon className="w-10 h-10 text-muted-foreground/50 mx-auto mb-2" />
    <p className="text-sm text-muted-foreground">{text}</p>
  </div>
);

const BoxErrore: React.FC<{ errore: ErroreLettura; etichetta: string; on_riprova: () => void }> = ({ errore, etichetta, on_riprova }) => (
  <div className="bg-card border border-destructive/40 rounded-xl p-4 space-y-2 text-sm">
    <p className="text-destructive font-medium">{errore.messaggio}</p>
    {errore.riprovabile && <Button size="sm" variant="outline" onClick={on_riprova}>{etichetta}</Button>}
  </div>
);

const Caricamento: React.FC = () => (
  <div className="flex justify-center py-6"><Loader2 className="w-5 h-5 animate-spin text-primary" /></div>
);

export default PortaleAtletaPage;
