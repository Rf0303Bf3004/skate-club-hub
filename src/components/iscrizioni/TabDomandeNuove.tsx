import React, { useState } from "react";
import { useTranslation } from "react-i18next";
import { Copy, Check, QrCode, Mail, X, Link2 } from "lucide-react";
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
  type Domanda,
} from "@/hooks/use-iscrizioni-stagione";
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
const LinkPubblico: React.FC<{ token: string | null }> = ({ token }) => {
  const { t } = useTranslation("atleti");
  const k = (s: string, o?: any) => t(`iscrizioni_stagione.${s}`, o as any) as string;
  const [copiato, set_copiato] = useState(false);
  const url = token ? `https://app.icearena.ch/iscriviti/${token}` : "";
  const qr = use_qr_data_url(url, 200);

  if (!token) {
    return (
      <div className="rounded-xl border border-dashed border-border p-4 text-sm text-muted-foreground">
        {k("domande.link_mancante")}
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
      </div>
      {qr ? (
        <img src={qr} alt={k("domande.qr_alt")} className="w-28 h-28 rounded-xl border bg-white" />
      ) : (
        <div className="w-28 h-28 rounded-xl border bg-muted animate-pulse" />
      )}
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
  const [nota, set_nota] = useState("");
  const [dialog_rifiuto, set_dialog_rifiuto] = useState(false);
  const [esito, set_esito] = useState<{ atleta_id: string; codice_atleta: string } | null>(null);
  const [benvenuto_inviato, set_benvenuto_inviato] = useState(false);
  const [rifiutata, set_rifiutata] = useState(false);
  const [avviso_inviato, set_avviso_inviato] = useState(false);

  const eta = eta_da(d.data_nascita);

  const on_approva = async () => {
    set_errore_livello(null);
    if (!livello) {
      set_errore_livello(k("domande.livello_obbligatorio"));
      return;
    }
    try {
      const r = await approva.mutateAsync({
        domanda_id: d.id,
        livello,
        categoria: categoria || null,
        note: nota.trim() || null,
      });
      set_esito(r);
    } catch (e) {
      // Il database rifiuta l'approvazione senza livello: lo diciamo con parole
      // normali sotto la tendina, non come errore tecnico.
      const msg = messaggio_leggibile(e).toLowerCase();
      if (msg.includes("livello")) set_errore_livello(k("domande.livello_obbligatorio"));
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
        <Button
          variant="outline"
          className="gap-1.5"
          disabled={email.isPending || benvenuto_inviato}
          onClick={async () => {
            try {
              const r = await email.mutateAsync({
                tipo: "benvenuto",
                atleta_id: esito.atleta_id,
                livello,
                email_famiglia: d.genitore1_email ?? "",
              });
              if (r.inviati > 0) {
                set_benvenuto_inviato(true);
                toast({ title: k("domande.benvenuto_inviato") });
              } else {
                toast({ title: k("domande.senza_email"), variant: "destructive" });
              }
            } catch (e) {
              segnala_errore("TabDomandeNuove", k("domande.invia_benvenuto"), e);
            }
          }}
        >
          <Mail className="w-4 h-4" />
          {benvenuto_inviato ? k("domande.benvenuto_inviato") : k("domande.invia_benvenuto")}
        </Button>
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
        <div>
          <h3 className="text-base font-semibold text-foreground">
            {d.cognome} {d.nome}
          </h3>
          <p className="text-xs text-muted-foreground">
            {eta != null ? k("domande.eta", { count: eta }) : k("domande.eta_sconosciuta")}
            {d.data_nascita ? ` · ${d.data_nascita}` : ""}
          </p>
        </div>
        {d.livello_dichiarato && (
          <Badge className="text-sm">{k("domande.livello_dichiarato")}: {d.livello_dichiarato}</Badge>
        )}
      </div>

      <div className="text-sm text-muted-foreground space-y-1">
        <p>
          {k("domande.genitore")}: {[d.genitore1_nome, d.genitore1_cognome].filter(Boolean).join(" ")}
        </p>
        <p>{d.genitore1_email} {d.genitore1_telefono ? `· ${d.genitore1_telefono}` : ""}</p>
      </div>

      {d.esperienza && (
        <p className="text-sm">
          <span className="font-medium">{k("domande.esperienza")}: </span>
          {d.esperienza}
        </p>
      )}
      {d.note_famiglia && (
        <p className="text-sm">
          <span className="font-medium">{k("domande.note_famiglia")}: </span>
          {d.note_famiglia}
        </p>
      )}

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
              <Select value={categoria} onValueChange={set_categoria}>
                <SelectTrigger className="h-10"><SelectValue placeholder={k("domande.scegli")} /></SelectTrigger>
                <SelectContent>
                  {CATEGORIE.map((c) => (
                    <SelectItem key={c} value={c}>{get_categoria_label(c)}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
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
        <LinkPubblico token={(club as any)?.iscrizioni_token ?? null} />
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
    </div>
  );
};

export default TabDomandeNuove;
