import React, { useState } from "react";
import { useTranslation } from "react-i18next";
import { Copy, Check, QrCode, Mail, X, Link2, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "@/hooks/use-toast";
import { segnala_errore, messaggio_leggibile } from "@/lib/errori";
import { use_club } from "@/hooks/use-supabase-data";
import { use_qr_data_url } from "@/hooks/use-qr-data-url";
import CodiceAtletaCard from "@/components/CodiceAtletaCard";
import {
  use_domande_iscrizione,
  use_approva_domanda,
  use_rifiuta_domanda,
  use_invia_email_iscrizioni,
  use_rigenera_token_iscrizioni,
  use_domande_approvate_recenti,
  use_rimanda_benvenuto,
  type Domanda,
} from "@/hooks/use-iscrizioni-stagione";
import { format_data, format_data_ora } from "@/lib/format-data";
import { CATEGORIE, LIVELLI_AMATORI, LIVELLI_CARRIERA, get_categoria_label } from "@/lib/atleta-livello";

const LIVELLI_ASSEGNABILI = ["Pulcini", ...LIVELLI_AMATORI, ...LIVELLI_CARRIERA];

const eta_da = (data_nascita: string | null): number | null => {
  if (!data_nascita) return null;
  const d = new Date(`${data_nascita}T00:00:00`);
  if (Number.isNaN(d.getTime())) return null;
  const oggi = new Date();
  let anni = oggi.getFullYear() - d.getFullYear();
  const m = oggi.getMonth() - d.getMonth();
  if (m < 0 || (m === 0 && oggi.getDate() < d.getDate())) anni--;
  return anni;
};

/** Il link pubblico del club, con copia e QR. */
const LinkPubblico: React.FC<{ token: string | null; puo_gestire: boolean }> = ({ token, puo_gestire }) => {
  const { t } = useTranslation("atleti");
  const k = (s: string, o?: any) => t(`iscrizioni_stagione.${s}`, o as any) as string;
  const [copiato, set_copiato] = useState(false);
  const [dialog_rigenera, set_dialog_rigenera] = useState(false);
  const rigenera = use_rigenera_token_iscrizioni();
  const url = token ? `https://app.icearena.ch/iscriviti/${token}` : "";
  const qr = use_qr_data_url(url, 200);

  const bottone_rigenera = puo_gestire ? (
    <Button size="sm" variant="outline" className="gap-1.5 mt-1" onClick={() => set_dialog_rigenera(true)}>
      <RefreshCw className="w-4 h-4" />
      {k("domande.rigenera_link")}
    </Button>
  ) : null;

  const dialogo = (
    <Dialog open={dialog_rigenera} onOpenChange={(o) => !rigenera.isPending && set_dialog_rigenera(o)}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{k("domande.rigenera_titolo")}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3 text-sm">
          <p className="text-muted-foreground">{k("domande.rigenera_testo")}</p>
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={() => set_dialog_rigenera(false)} disabled={rigenera.isPending}>
              {k("comune.annulla")}
            </Button>
            <Button
              variant="destructive"
              disabled={rigenera.isPending}
              onClick={async () => {
                try {
                  await rigenera.mutateAsync();
                  toast({ title: k("domande.rigenera_ok") });
                  set_dialog_rigenera(false);
                } catch (e) {
                  segnala_errore("TabDomandeNuove", k("domande.rigenera_link"), e);
                }
              }}
            >
              {k("comune.conferma")}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );

  if (!token) {
    return (
      <div className="rounded-xl border border-dashed border-border p-4 text-sm text-muted-foreground space-y-2">
        <p>{k("domande.link_mancante")}</p>
        {bottone_rigenera}
        {dialogo}
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-primary/20 bg-primary/[0.03] p-4 flex flex-wrap items-center gap-4">
      <div className="flex-1 min-w-[220px] space-y-1">
        <p className="text-[10px] font-bold uppercase tracking-[1.4px] text-primary flex items-center gap-1.5">
          <Link2 className="w-3.5 h-3.5" /> {k("domande.link_pubblico")}
        </p>
        <p className="text-sm font-mono break-all select-all">{url}</p>
        <Button
          size="sm"
          variant="outline"
          className="gap-1.5 mt-1"
          onClick={async () => {
            try {
              await navigator.clipboard.writeText(url);
              set_copiato(true);
              setTimeout(() => set_copiato(false), 1800);
            } catch {
              toast({ title: k("domande.copia_errore"), variant: "destructive" });
            }
          }}
        >
          {copiato ? <Check className="w-4 h-4 text-emerald-600" /> : <Copy className="w-4 h-4" />}
          {copiato ? k("domande.copiato") : k("domande.copia")}
        </Button>
        {bottone_rigenera && <span className="ml-2 inline-block">{bottone_rigenera}</span>}
      </div>
      {qr ? (
        <img src={qr} alt={k("domande.qr_alt")} className="w-28 h-28 rounded-xl border bg-white" />
      ) : (
        <div className="w-28 h-28 rounded-xl border bg-muted animate-pulse" />
      )}
      {dialogo}
    </div>
  );
};

const Gruppo: React.FC<{ titolo: string; children: React.ReactNode }> = ({ titolo, children }) => (
  <div className="rounded-lg border border-border p-3 space-y-1.5">
    <p className="text-[10px] font-bold uppercase tracking-[1.4px] text-muted-foreground">{titolo}</p>
    <dl className="space-y-1">{children}</dl>
  </div>
);

/** Un campo vuoto non si nasconde: si mostra «non indicato» in grigio. */
const Voce: React.FC<{ label: string; valore: string | null | undefined; vuoto: string; multilinea?: boolean }> = ({
  label, valore, vuoto, multilinea,
}) => {
  const v = typeof valore === "string" ? valore.trim() : "";
  return (
    <div className="grid grid-cols-[minmax(0,40%)_1fr] gap-2 text-sm">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className={v ? `text-foreground break-words ${multilinea ? "whitespace-pre-line" : ""}` : "text-muted-foreground/70 italic"}>
        {v || vuoto}
      </dd>
    </div>
  );
};

type Traduci = (s: string, o?: any) => string;

/** Motivo leggibile scritto dal server sulla domanda. */
function testo_motivo(motivo: string | null, k: Traduci): string {
  if (motivo === "senza_email") return k("domande.benvenuto_senza_email");
  if (motivo === "provider_email_non_configurato") return k("domande.benvenuto_provider");
  return k("domande.benvenuto_fallito");
}

/** Una riga per ogni approvazione, con lo stato della mail registrato nel database. */
const ApprovateRecenti: React.FC<{ puo_gestire: boolean }> = ({ puo_gestire }) => {
  const { t } = useTranslation("atleti");
  const k = (s: string, o?: any) => t(`iscrizioni_stagione.${s}`, o as any) as string;
  const q = use_domande_approvate_recenti();
  const rimanda = use_rimanda_benvenuto();

  React.useEffect(() => {
    if (q.isError) segnala_errore("TabDomandeNuove", k("domande.approvate_recenti"), q.error, undefined, "avviso");
  }, [q.isError]);

  if (q.isError) {
    return (
      <div className="rounded-lg border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900 flex items-center justify-between gap-3">
        <span>{k("domande.approvate_errore")}</span>
        <Button size="sm" variant="outline" onClick={() => q.refetch()}>{k("domande.riprova")}</Button>
      </div>
    );
  }
  if (!q.isSuccess || q.data.length === 0) return null;

  return (
    <div className="rounded-xl border border-border p-4 space-y-2">
      <p className="text-[10px] font-bold uppercase tracking-[1.4px] text-muted-foreground">{k("domande.approvate_recenti")}</p>
      <ul className="divide-y divide-border">
        {q.data.map((r) => {
          const s = r.mail_benvenuto_stato;
          const quando_tentativo = r.mail_benvenuto_ultimo_tentativo
            ? format_data_ora(new Date(r.mail_benvenuto_ultimo_tentativo))
            : null;
          let testo: string;
          let classe = "text-destructive";
          if (s === "inviata") {
            testo = k("domande.benvenuto_inviato_il", {
              quando: format_data_ora(new Date(r.mail_benvenuto_inviata_at ?? r.mail_benvenuto_ultimo_tentativo ?? "")),
            });
            classe = "text-emerald-700";
          } else if (s === "da_inviare") {
            testo = r.mail_benvenuto_motivo
              ? k("domande.benvenuto_in_riprova", {
                  motivo: testo_motivo(r.mail_benvenuto_motivo, k),
                  count: r.mail_benvenuto_tentativi,
                })
              : k("domande.benvenuto_in_coda");
            classe = "text-amber-700";
          } else if (s === "senza_indirizzo" || s === "fallita") {
            testo = k("domande.benvenuto_fallito_il", {
              quando: quando_tentativo ?? "—",
              motivo: testo_motivo(r.mail_benvenuto_motivo, k),
            });
          } else {
            testo = k("domande.benvenuto_mai");
          }
          const puo_rimandare = puo_gestire && s !== "inviata" && s !== "da_inviare";
          return (
            <li key={r.id} className="py-2 flex flex-wrap items-center gap-3 text-sm">
              <span className="font-medium flex-1 min-w-[160px]">{r.nome} {r.cognome}</span>
              <span className="text-xs text-muted-foreground">
                {r.gestita_il ? k("domande.approvata_il", { quando: format_data_ora(new Date(r.gestita_il)) }) : null}
              </span>
              <span className={classe}>{testo}</span>
              {puo_rimandare && (
                <Button
                  size="sm"
                  variant="outline"
                  className="gap-1.5"
                  disabled={rimanda.isPending}
                  onClick={async () => {
                    try {
                      await rimanda.mutateAsync(r.id);
                      toast({ title: k("domande.benvenuto_in_coda") });
                    } catch (e) {
                      segnala_errore("TabDomandeNuove", k("domande.rimanda_benvenuto"), e, { domanda_id: r.id });
                    }
                  }}
                >
                  <Mail className="w-4 h-4" />
                  {k("domande.rimanda_benvenuto")}
                </Button>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
};

const SchedaDomanda: React.FC<{ d: Domanda; puo_gestire: boolean }> = ({ d, puo_gestire }) => {
  const { t } = useTranslation("atleti");
  const k = (s: string, o?: any) => t(`iscrizioni_stagione.${s}`, o as any) as string;

  const approva = use_approva_domanda();
  const rifiuta = use_rifiuta_domanda();
  const email = use_invia_email_iscrizioni();

  const [livello, set_livello] = useState("");
  const [categoria, set_categoria] = useState("");
  const [errore_livello, set_errore_livello] = useState<string | null>(null);
  const [errore_categoria, set_errore_categoria] = useState<string | null>(null);
  const [nota, set_nota] = useState("");
  const [dialog_rifiuto, set_dialog_rifiuto] = useState(false);
  const [esito, set_esito] = useState<{ atleta_id: string; codice_atleta: string; benvenuto: EsitoBenvenuto } | null>(null);
  const [benvenuto_inviato, set_benvenuto_inviato] = useState(false);
  const [rifiutata, set_rifiutata] = useState(false);
  const [avviso_inviato, set_avviso_inviato] = useState(false);

  const eta = eta_da(d.data_nascita);
  const kd = (s: string, o?: any) => k(`domande.dettaglio.${s}`, o);
  const nv = kd("non_indicato");
  const si_no = (v: boolean | null) => (v == null ? null : v ? kd("si") : kd("no"));

  const on_approva = async () => {
    set_errore_livello(null);
    set_errore_categoria(null);
    if (!livello) {
      set_errore_livello(k("domande.livello_obbligatorio"));
      if (!categoria) set_errore_categoria(k("domande.categoria_obbligatoria"));
      return;
    }
    // Senza categoria il database ripiegherebbe su "amatori": un'anagrafica
    // storta dal primo giorno. Si chiede sempre.
    if (!categoria) {
      set_errore_categoria(k("domande.categoria_obbligatoria"));
      return;
    }
    try {
      const r = await approva.mutateAsync({
        domanda_id: d.id,
        livello,
        categoria,
        note: nota.trim() || null,
        email_famiglia: d.genitore1_email ?? "",
      });
      set_esito(r);
      set_benvenuto_inviato(r.benvenuto.stato === "inviata");
      avvisa_esito_benvenuto(r.benvenuto, `${d.nome} ${d.cognome}`, k);
    } catch (e) {
      // Il database rifiuta l'approvazione senza livello: lo diciamo con parole
      // normali sotto la tendina, non come errore tecnico.
      const msg = messaggio_leggibile(e).toLowerCase();
      if (msg.includes("livello")) set_errore_livello(k("domande.livello_obbligatorio"));
      else if (msg.includes("categoria")) set_errore_categoria(k("domande.categoria_obbligatoria"));
      else segnala_errore("TabDomandeNuove", k("domande.approva"), e, { domanda_id: d.id });
    }
  };

  const on_rifiuta = async () => {
    try {
      await rifiuta.mutateAsync({ domanda_id: d.id, note: nota.trim() || null });
      set_rifiutata(true);
      set_dialog_rifiuto(false);
    } catch (e) {
      segnala_errore("TabDomandeNuove", k("domande.rifiuta"), e, { domanda_id: d.id });
    }
  };

  if (esito) {
    return (
      <div className="rounded-xl border border-emerald-200 bg-emerald-50/60 p-5 space-y-4">
        <h3 className="text-sm font-semibold text-emerald-800">
          {k("domande.approvata_titolo", { nome: `${d.nome} ${d.cognome}` })}
        </h3>
        <CodiceAtletaCard
          atleta={{
            id: esito.atleta_id,
            nome: d.nome,
            cognome: d.cognome,
            codice_atleta: esito.codice_atleta,
          }}
        />
        <p className={benvenuto_inviato ? "text-sm text-emerald-800" : "text-sm text-destructive font-medium"}>
          {benvenuto_inviato ? k("domande.benvenuto_inviato") : testo_esito_benvenuto(esito.benvenuto, k)}
        </p>
        {!benvenuto_inviato && (
          <Button
            variant="outline"
            className="gap-1.5"
            disabled={email.isPending}
            onClick={async () => {
              const r = await invia_benvenuto({
                atleta_id: esito.atleta_id,
                livello,
                email_famiglia: d.genitore1_email ?? "",
              });
              set_esito({ ...esito, benvenuto: r });
              set_benvenuto_inviato(r.stato === "inviata");
              avvisa_esito_benvenuto(r, `${d.nome} ${d.cognome}`, k);
            }}
          >
            <Mail className="w-4 h-4" />
            {k("domande.rimanda_benvenuto")}
          </Button>
        )}
      </div>
    );
  }

  if (rifiutata) {
    return (
      <div className="rounded-xl border border-border bg-muted/30 p-5 space-y-3">
        <h3 className="text-sm font-semibold text-foreground">
          {k("domande.rifiutata_titolo", { nome: `${d.nome} ${d.cognome}` })}
        </h3>
        <Button
          variant="outline"
          className="gap-1.5"
          disabled={email.isPending || avviso_inviato}
          onClick={async () => {
            try {
              const r = await email.mutateAsync({
                tipo: "domanda_rifiutata",
                domanda_id: d.id,
                note: nota.trim(),
              });
              if (r.inviati > 0) {
                set_avviso_inviato(true);
                toast({ title: k("domande.avviso_inviato") });
              } else {
                toast({ title: k("domande.senza_email"), variant: "destructive" });
              }
            } catch (e) {
              segnala_errore("TabDomandeNuove", k("domande.avvisa_famiglia"), e);
            }
          }}
        >
          <Mail className="w-4 h-4" />
          {avviso_inviato ? k("domande.avviso_inviato") : k("domande.avvisa_famiglia")}
        </Button>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-border bg-card p-5 space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <h3 className="text-base font-semibold text-foreground">
          {d.cognome} {d.nome}
        </h3>
        <p className="text-xs text-muted-foreground">
          {kd("ricevuta_il", { data: format_data_ora(d.created_at) })}
        </p>
      </div>

      <div className="grid md:grid-cols-2 gap-4">
        <Gruppo titolo={kd("sez_atleta")}>
          <Voce label={kd("nome")} valore={d.nome} vuoto={nv} />
          <Voce label={kd("cognome")} valore={d.cognome} vuoto={nv} />
          <Voce
            label={kd("data_nascita")}
            valore={d.data_nascita ? `${format_data(`${d.data_nascita}T00:00:00`)}${eta != null ? ` · ${kd("eta_anni", { count: eta })}` : ""}` : null}
            vuoto={nv}
          />
          <Voce label={kd("sesso")} valore={d.sesso === "F" || d.sesso === "M" ? kd(`sesso_${d.sesso}`) : d.sesso} vuoto={nv} />
        </Gruppo>
        <Gruppo titolo={kd("sez_famiglia")}>
          <Voce label={kd("genitore")} valore={[d.genitore1_nome, d.genitore1_cognome].filter(Boolean).join(" ") || null} vuoto={nv} />
          <Voce label={kd("email")} valore={d.genitore1_email} vuoto={nv} />
          <Voce label={kd("telefono")} valore={d.genitore1_telefono} vuoto={nv} />
          <Voce label={kd("indirizzo")} valore={d.genitore1_indirizzo} vuoto={nv} />
          <Voce label={kd("cap")} valore={d.genitore1_cap} vuoto={nv} />
          <Voce label={kd("localita")} valore={d.genitore1_citta} vuoto={nv} />
          <Voce label={kd("cantone")} valore={d.genitore1_cantone} vuoto={nv} />
          <Voce
            label={kd("paese")}
            valore={d.genitore1_paese_iso === "CH" || d.genitore1_paese_iso === "IT" ? kd(`paese_${d.genitore1_paese_iso}`) : d.genitore1_paese_iso}
            vuoto={nv}
          />
        </Gruppo>
        <Gruppo titolo={kd("sez_dichiara")}>
          <Voce label={kd("livello_dichiarato")} valore={d.livello_dichiarato} vuoto={nv} />
          <Voce label={kd("esperienza")} valore={d.esperienza} vuoto={nv} multilinea />
          <Voce label={kd("club_provenienza")} valore={d.club_provenienza} vuoto={nv} />
          <Voce label={kd("note_famiglia")} valore={d.note_famiglia} vuoto={nv} multilinea />
        </Gruppo>
        <div className="space-y-4">
          <Gruppo titolo={kd("sez_scelte")}>
            <Voce label={kd("consenso_foto_video")} valore={si_no(d.consenso_foto_video)} vuoto={nv} />
            <Voce label={kd("partecipa_gare")} valore={si_no(d.partecipa_gare)} vuoto={nv} />
            <Voce label={kd("intende_test_livello")} valore={si_no(d.intende_test_livello)} vuoto={nv} />
          </Gruppo>
          <Gruppo titolo={kd("sez_contratto")}>
            <Voce
              label={kd("contratto")}
              valore={d.contratto_accettato_at ? kd("contratto_accettato", { data: format_data_ora(d.contratto_accettato_at) }) : kd("contratto_non_accettato")}
              vuoto={nv}
            />
          </Gruppo>
        </div>
      </div>

      {puo_gestire && (
        <div className="border-t border-border pt-4 space-y-3">
          <div className="grid sm:grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground">{k("domande.livello_assegnato")}</label>
              <Select value={livello} onValueChange={(v) => { set_livello(v); set_errore_livello(null); }}>
                <SelectTrigger className="h-10"><SelectValue placeholder={k("domande.scegli")} /></SelectTrigger>
                <SelectContent>
                  {LIVELLI_ASSEGNABILI.map((l) => (
                    <SelectItem key={l} value={l}>{l}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {errore_livello && <p className="text-xs text-destructive">{errore_livello}</p>}
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground">{k("domande.categoria")}</label>
              <Select value={categoria} onValueChange={(v) => { set_categoria(v); set_errore_categoria(null); }}>
                <SelectTrigger className="h-10"><SelectValue placeholder={k("domande.scegli")} /></SelectTrigger>
                <SelectContent>
                  {CATEGORIE.map((c) => (
                    <SelectItem key={c} value={c}>{get_categoria_label(c)}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {errore_categoria && <p className="text-xs text-destructive">{errore_categoria}</p>}
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            <Button
              className="h-10 bg-emerald-600 hover:bg-emerald-700"
              disabled={approva.isPending}
              onClick={on_approva}
            >
              <Check className="w-4 h-4 mr-1" />
              {k("domande.approva")}
            </Button>
            <Button
              variant="destructive"
              className="h-10"
              disabled={rifiuta.isPending}
              onClick={() => set_dialog_rifiuto(true)}
            >
              <X className="w-4 h-4 mr-1" />
              {k("domande.rifiuta")}
            </Button>
          </div>
        </div>
      )}

      <Dialog open={dialog_rifiuto} onOpenChange={(o) => !rifiuta.isPending && set_dialog_rifiuto(o)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{k("domande.rifiuta")}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 text-sm">
            <Textarea
              value={nota}
              onChange={(e) => set_nota(e.target.value)}
              placeholder={k("domande.nota_facoltativa")}
              rows={4}
            />
            <div className="flex justify-end gap-2">
              <Button variant="ghost" onClick={() => set_dialog_rifiuto(false)} disabled={rifiuta.isPending}>
                {k("comune.annulla")}
              </Button>
              <Button variant="destructive" onClick={on_rifiuta} disabled={rifiuta.isPending}>
                {k("comune.conferma")}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

const TabDomandeNuove: React.FC<{ puo_gestire: boolean }> = ({ puo_gestire }) => {
  const { t } = useTranslation("atleti");
  const k = (s: string, o?: any) => t(`iscrizioni_stagione.${s}`, o as any) as string;
  const { data: club, isError: err_club } = use_club();
  const domande = use_domande_iscrizione();

  return (
    <div className="space-y-5">
      {err_club ? (
        <div className="rounded-lg border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900">
          {k("domande.errore_club")}
        </div>
      ) : (
        <LinkPubblico token={(club as any)?.iscrizioni_token ?? null} puo_gestire={puo_gestire} />
      )}

      {domande.isLoading && (
        <div className="flex items-center justify-center h-40">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
        </div>
      )}

      {domande.isError && (
        <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-6 text-center space-y-3">
          <p className="text-sm text-destructive">{k("domande.errore_lettura")}</p>
          <Button variant="outline" onClick={() => domande.refetch()}>{k("comune.riprova")}</Button>
        </div>
      )}

      {!domande.isLoading && !domande.isError && (domande.data ?? []).length === 0 && (
        <div className="text-center py-12 border rounded-lg border-dashed border-border">
          <QrCode className="w-8 h-8 mx-auto mb-2 text-muted-foreground/30" />
          <p className="text-sm text-muted-foreground">{k("domande.nessuna")}</p>
        </div>
      )}

      {(domande.data ?? []).map((d) => (
        <SchedaDomanda key={d.id} d={d} puo_gestire={puo_gestire} />
      ))}

      <ApprovateRecenti puo_gestire={puo_gestire} />
    </div>
  );
};

export default TabDomandeNuove;
