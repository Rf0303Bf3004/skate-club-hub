import React, { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { get_current_club_id } from "@/lib/supabase";
import {
  use_campi_ospitati,
  use_campi_invitati,
  use_rispondi_invito_campo,
  use_aggiorna_campo,
  use_campo_gruppi,
  use_salva_gruppo,
  use_elimina_gruppo,
  use_riordina_gruppi,
  use_campo_partecipanti,
  use_clubs_opzioni,
  use_invita_club,
  use_aggiorna_partecipante,
  use_elimina_partecipante,
  use_campo_adesioni,
  use_campo_iscrizioni,
  use_toggle_iscrizione_campo,
  use_aggiorna_gruppo_iscrizione,
  use_atleti_ospiti_campo,
  use_registra_atleti_ospiti,
  use_anteprima_fatture_ospiti,
  use_genera_fattura_club_ospite,
  use_genera_link_club_ospite,
  STATI_CAMPO,
  type EventoCampoInterClub,
  type CampoGruppo,
  type CampoClubPartecipante,
  type IscrizioneCampo,
} from "@/hooks/use-campi-interclub";
import { use_atleti } from "@/hooks/use-supabase-data";
import { use_app_store_links } from "@/hooks/use-app-store-links";
import { stampa_schede_codice } from "@/lib/scheda-codice-html";
import OspitiImportWizard from "@/components/campi/OspitiImportWizard";
import {
  COLORE_CLUB_OSPITANTE,
  colore_club_per_indice,
  stile_pastiglia_club,
} from "@/lib/colori-club-campo";
import { useAuth } from "@/lib/auth";
import { segnala_errore } from "@/lib/errori";
import { Checkbox } from "@/components/ui/checkbox";
import { usePermessiAzione } from "@/hooks/use-permessi-azione";
import ConfirmButton from "@/components/common/ConfirmButton";
import NotaPermesso from "@/components/common/NotaPermesso";

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import {
  Users,
  Plus,
  Trash2,
  ChevronRight,
  ChevronDown,
  ArrowUp,
  ArrowDown,
  Check,
  X,
  Building2,
  MapPin,
  Construction,
  Upload,
  Printer,
  Link2,
  Receipt,
  FileText,
  Pencil,
} from "lucide-react";

const fmt_date = (d: string | null) =>
  d ? new Date(d + "T00:00:00").toLocaleDateString("de-CH", { day: "2-digit", month: "2-digit", year: "numeric" }) : "—";

const anno_nascita = (d?: string | null) => (d ? new Date(d + "T00:00:00").getFullYear() : null);

/** Indirizzo pubblico che il club ospitato apre senza account. */
const link_ospite = (token: string) => `${window.location.origin}/campo-ospite/${token}`;

const stato_variant = (stato: string): "default" | "secondary" | "destructive" | "outline" => {
  if (stato === "accettato" || stato === "aperto") return "default";
  if (stato === "rifiutato" || stato === "ritirato") return "destructive";
  if (stato === "concluso" || stato === "chiuso") return "outline";
  return "secondary";
};

/** Stato dell'invito scritto a parole, non in codice. */
const stato_invito_parole = (stato: string) => {
  if (stato === "accettato") return "Ha accettato";
  if (stato === "rifiutato") return "Ha rifiutato";
  if (stato === "ritirato") return "Si è ritirato";
  return "Invitato";
};

const nome_club_partecipante = (p: CampoClubPartecipante) =>
  p.clubs?.nome || p.club_esterno_nome || "Club senza nome";

const livello_atleta = (a: any) =>
  a?.livello_dichiarato || a?.carriera_artistica || a?.carriera_stile || a?.livello_attuale || null;

// ═══════════════════════════════ SEZIONE PRINCIPALE ═══════════════════════════════
interface CampiInterClubSectionProps {
  /** Apre subito la scheda di questo campo. */
  campo_iniziale_id?: string | null;
  on_campo_iniziale_aperto?: () => void;
}

const CampiInterClubSection: React.FC<CampiInterClubSectionProps> = ({
  campo_iniziale_id,
  on_campo_iniziale_aperto,
}) => {
  const { t } = useTranslation("events");
  const { puo_gestire_sportivo } = usePermessiAzione();
  const club_id = get_current_club_id();
  const { data: ospitati = [] } = use_campi_ospitati();
  const { data: invitati = [] } = use_campi_invitati();
  const rispondi = use_rispondi_invito_campo();
  const [campo_selezionato, set_campo_selezionato] = useState<EventoCampoInterClub | null>(null);

  React.useEffect(() => {
    if (!campo_iniziale_id) return;
    const trovato = ospitati.find((c) => c.id === campo_iniziale_id);
    if (!trovato) return;
    set_campo_selezionato(trovato);
    on_campo_iniziale_aperto?.();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [campo_iniziale_id, ospitati]);

  if (campo_selezionato) {
    const aggiornato =
      ospitati.find((c) => c.id === campo_selezionato.id) ??
      invitati.find((i) => i.evento?.id === campo_selezionato.id)?.evento ??
      campo_selezionato;
    return (
      <CampoScheda
        campo={aggiornato}
        is_ospitante={aggiornato.club_id === club_id}
        on_back={() => set_campo_selezionato(null)}
      />
    );
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Building2 className="w-5 h-5" /> {t("campi_interclub.ospito.title")}
          </CardTitle>
          <CardDescription>{t("campi_interclub.ospito.description")}</CardDescription>
        </CardHeader>
        <CardContent>
          {ospitati.length === 0 ? (
            <p className="text-sm text-muted-foreground py-6 text-center">{t("campi_interclub.ospito.empty")}</p>
          ) : (
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
              {ospitati.map((c) => (
                <Card
                  key={c.id}
                  className="cursor-pointer hover:border-primary transition-colors"
                  onClick={() => set_campo_selezionato(c)}
                >
                  <CardHeader className="pb-2">
                    <CardTitle className="text-base flex items-center justify-between gap-2">
                      <span className="truncate">{c.nome}</span>
                      <Badge variant={stato_variant(c.stato)}>{t(`campi_interclub.stati.${c.stato}`)}</Badge>
                    </CardTitle>
                    <CardDescription>
                      {fmt_date(c.data_inizio)} → {fmt_date(c.data_fine)}
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="text-sm space-y-1">
                    {c.luogo && (
                      <p className="text-muted-foreground">
                        <MapPin className="w-3 h-3 inline mr-1" />
                        {c.luogo}
                      </p>
                    )}
                    {c.scadenza_adesioni && (
                      <p className="text-muted-foreground">
                        {t("campi_interclub.info.scadenza_adesioni")}: {fmt_date(c.scadenza_adesioni)}
                      </p>
                    )}
                    <p className="text-muted-foreground">
                      <Users className="w-3 h-3 inline mr-1" />
                      {c.n_invitati} invitati • {c.n_accettati} hanno accettato
                    </p>
                    {c.n_invitati === 0 && puo_gestire_sportivo ? (
                      <Button
                        size="sm"
                        className="mt-2 w-full"
                        onClick={(ev) => {
                          ev.stopPropagation();
                          set_campo_selezionato(c);
                        }}
                      >
                        <Plus className="w-4 h-4 mr-1" /> Invita club
                      </Button>
                    ) : (
                      <Button variant="ghost" size="sm" className="mt-1 -mx-2 w-full justify-end">
                        <ChevronRight className="w-4 h-4" />
                      </Button>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="w-5 h-5" /> {t("campi_interclub.invitato.title")}
          </CardTitle>
          <CardDescription>{t("campi_interclub.invitato.description")}</CardDescription>
        </CardHeader>
        <CardContent>
          {invitati.length === 0 ? (
            <p className="text-sm text-muted-foreground py-6 text-center">{t("campi_interclub.invitato.empty")}</p>
          ) : (
            <div className="space-y-3">
              {invitati.map(({ partecipazione, evento }) => (
                <div
                  key={partecipazione.id}
                  className="flex flex-wrap items-center justify-between gap-3 p-3 border rounded-lg"
                >
                  <div>
                    <p className="font-medium">{evento?.nome ?? t("campi_interclub.invitato.campo_sconosciuto")}</p>
                    <p className="text-sm text-muted-foreground">
                      {fmt_date(evento?.data_inizio ?? null)} → {fmt_date(evento?.data_fine ?? null)}
                      {evento?.luogo ? ` • ${evento.luogo}` : ""}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant={stato_variant(partecipazione.stato)}>
                      {stato_invito_parole(partecipazione.stato)}
                    </Badge>
                    {partecipazione.stato === "invitato" && (
                      <>
                        <Button
                          size="sm"
                          disabled={rispondi.isPending}
                          onClick={() =>
                            rispondi.mutate(
                              { id: partecipazione.id, accetta: true },
                              { onSuccess: () => toast.success(t("campi_interclub.invitato.accettato_toast")) },
                            )
                          }
                        >
                          <Check className="w-4 h-4 mr-1" /> {t("campi_interclub.invitato.accetta")}
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={rispondi.isPending}
                          onClick={() =>
                            rispondi.mutate(
                              { id: partecipazione.id, accetta: false },
                              { onSuccess: () => toast.success(t("campi_interclub.invitato.rifiutato_toast")) },
                            )
                          }
                        >
                          <X className="w-4 h-4 mr-1" /> {t("campi_interclub.invitato.rifiuta")}
                        </Button>
                      </>
                    )}
                    {partecipazione.stato === "accettato" && evento && (
                      <Button size="sm" variant="outline" onClick={() => set_campo_selezionato(evento)}>
                        {t("campi_interclub.invitato.apri")} <ChevronRight className="w-4 h-4 ml-1" />
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

// ═══════════════════════════════ SCHEDA CAMPO (pagina unica) ═══════════════════════════════
const CampoScheda: React.FC<{
  campo: EventoCampoInterClub;
  is_ospitante: boolean;
  on_back: () => void;
}> = ({ campo, is_ospitante, on_back }) => {
  const { t } = useTranslation("events");
  const { session } = useAuth();
  const is_superadmin = session?.ruolo === "superadmin";
  const { data: ospiti = [] } = use_atleti_ospiti_campo(is_ospitante ? campo.id : null);
  const { ios_store_url, android_store_url } = use_app_store_links();

  const stampa_ospiti = async () => {
    const elenco = ospiti
      .filter((o) => o.codice_atleta)
      .map((o) => ({
        nome_completo: `${o.cognome ?? ""} ${o.nome ?? ""}`.trim(),
        codice: o.codice_atleta as string,
      }));
    if (elenco.length === 0) {
      toast.error(t("campi_interclub.ospiti.nessuno_da_stampare"));
      return;
    }
    const res = await stampa_schede_codice(elenco, { ios_store_url, android_store_url });
    if (!res.ok) toast.error(t("campi_interclub.ospiti.stampa_bloccata"));
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Button variant="ghost" onClick={on_back}>
          {t("campi_interclub.back")}
        </Button>
        {is_ospitante && (
          <Button variant="outline" size="sm" onClick={stampa_ospiti}>
            <Printer className="w-4 h-4 mr-1" />
            {t("campi_interclub.ospiti.stampa_schede", { count: ospiti.length })}
          </Button>
        )}
      </div>

      <FasciaCampo campo={campo} is_ospitante={is_ospitante} />

      <SezioneChiPartecipa campo={campo} is_ospitante={is_ospitante} />

      <SezioneGruppi campo={campo} is_ospitante={is_ospitante} />

      {is_superadmin && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Construction className="w-4 h-4" /> {t("campi_interclub.istruttori.title")}
            </CardTitle>
            <CardDescription>{t("campi_interclub.istruttori.placeholder")}</CardDescription>
          </CardHeader>
        </Card>
      )}
    </div>
  );
};

// ── Fascia compatta del campo, cliccabile per modificare ─────
const FasciaCampo: React.FC<{ campo: EventoCampoInterClub; is_ospitante: boolean }> = ({ campo, is_ospitante }) => {
  const [aperto, set_aperto] = useState(false);

  return (
    <Card>
      <div className="flex items-start justify-between gap-3 p-4">
        <button
          type="button"
          className="text-left min-w-0 flex-1"
          onClick={() => set_aperto((v) => !v)}
          aria-expanded={aperto}
        >
          <div className="flex items-center gap-2 min-w-0">
            <span className="font-semibold text-lg truncate">{campo.nome}</span>
            <Badge variant={stato_variant(campo.stato)}>{campo.stato}</Badge>
          </div>
          <p className="text-sm text-muted-foreground truncate">
            {fmt_date(campo.data_inizio)} → {fmt_date(campo.data_fine)}
            {campo.luogo ? ` • ${campo.luogo}` : ""}
            {campo.quota_atleta != null ? ` • CHF ${Number(campo.quota_atleta).toFixed(2)} per atleta` : ""}
            {campo.quota_club_default != null
              ? ` • CHF ${Number(campo.quota_club_default).toFixed(2)} per club`
              : ""}
          </p>
        </button>
        <Button variant="ghost" size="sm" onClick={() => set_aperto((v) => !v)}>
          <Pencil className="w-4 h-4 mr-1" />
          {aperto ? "Chiudi" : "Modifica"}
        </Button>
      </div>
      {aperto && (
        <div className="border-t">
          <FormInformazioni campo={campo} is_ospitante={is_ospitante} />
        </div>
      )}
    </Card>
  );
};

// ── Modulo informazioni del campo ────────────────────────────
const FormInformazioni: React.FC<{ campo: EventoCampoInterClub; is_ospitante: boolean }> = ({
  campo,
  is_ospitante,
}) => {
  const { t } = useTranslation("events");
  const { puo_gestire_sportivo } = usePermessiAzione();
  const aggiorna = use_aggiorna_campo();
  const [form, set_form] = useState({
    nome: campo.nome ?? "",
    stato: campo.stato ?? "bozza",
    data_inizio: campo.data_inizio ?? "",
    data_fine: campo.data_fine ?? "",
    scadenza_adesioni: campo.scadenza_adesioni ?? "",
    luogo: campo.luogo ?? "",
    quota_atleta: campo.quota_atleta != null ? String(campo.quota_atleta) : "",
    quota_club_default: campo.quota_club_default != null ? String(campo.quota_club_default) : "",
    contatti: campo.contatti ?? "",
    descrizione: campo.descrizione ?? "",
    note: campo.note ?? "",
  });

  const salva = () =>
    aggiorna.mutate(
      {
        id: campo.id,
        patch: {
          nome: form.nome.trim(),
          stato: form.stato,
          data_inizio: form.data_inizio || null,
          data_fine: form.data_fine || null,
          scadenza_adesioni: form.scadenza_adesioni || null,
          luogo: form.luogo || null,
          quota_atleta: form.quota_atleta === "" ? null : Number(form.quota_atleta),
          quota_club_default: form.quota_club_default === "" ? null : Number(form.quota_club_default),
          contatti: form.contatti || null,
          descrizione: form.descrizione || null,
          note: form.note || null,
        },
      },
      {
        onSuccess: () => toast.success(t("campi_interclub.info.salvato_toast")),
        onError: (e: any) => toast.error(e.message),
      },
    );

  return (
    <CardContent className="space-y-4 pt-4">
      {is_ospitante && !puo_gestire_sportivo && (
        <NotaPermesso testo="Non hai i permessi per modificare le informazioni del campo." />
      )}
      <fieldset disabled={!is_ospitante || !puo_gestire_sportivo} className="space-y-4">
        <div className="grid md:grid-cols-2 gap-4">
          <div>
            <Label>{t("campi_interclub.info.nome")}</Label>
            <Input value={form.nome} onChange={(e) => set_form({ ...form, nome: e.target.value })} />
          </div>
          <div>
            <Label>{t("campi_interclub.info.stato")}</Label>
            <Select value={form.stato} onValueChange={(v) => set_form({ ...form, stato: v })}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {STATI_CAMPO.map((s) => (
                  <SelectItem key={s} value={s}>
                    {t(`campi_interclub.stati.${s}`)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>{t("campi_interclub.info.data_inizio")}</Label>
            <Input
              type="date"
              value={form.data_inizio}
              onChange={(e) => set_form({ ...form, data_inizio: e.target.value })}
            />
          </div>
          <div>
            <Label>{t("campi_interclub.info.data_fine")}</Label>
            <Input
              type="date"
              value={form.data_fine}
              onChange={(e) => set_form({ ...form, data_fine: e.target.value })}
            />
          </div>
          <div>
            <Label>{t("campi_interclub.info.scadenza_adesioni")}</Label>
            <Input
              type="date"
              value={form.scadenza_adesioni}
              onChange={(e) => set_form({ ...form, scadenza_adesioni: e.target.value })}
            />
          </div>
          <div>
            <Label>{t("campi_interclub.info.luogo")}</Label>
            <Input value={form.luogo} onChange={(e) => set_form({ ...form, luogo: e.target.value })} />
          </div>
          <div>
            <Label>{t("campi_interclub.info.quota_atleta")}</Label>
            <Input
              type="number"
              step="0.05"
              value={form.quota_atleta}
              onChange={(e) => set_form({ ...form, quota_atleta: e.target.value })}
            />
          </div>
          <div>
            <Label>{t("campi_interclub.info.quota_club_default")}</Label>
            <Input
              type="number"
              step="0.05"
              value={form.quota_club_default}
              onChange={(e) => set_form({ ...form, quota_club_default: e.target.value })}
            />
          </div>
          <div className="md:col-span-2">
            <Label>{t("campi_interclub.info.contatti")}</Label>
            <Input value={form.contatti} onChange={(e) => set_form({ ...form, contatti: e.target.value })} />
          </div>
          <div className="md:col-span-2">
            <Label>{t("campi_interclub.info.descrizione")}</Label>
            <Textarea value={form.descrizione} onChange={(e) => set_form({ ...form, descrizione: e.target.value })} />
          </div>
          <div className="md:col-span-2">
            <Label>{t("campi_interclub.info.note")}</Label>
            <Textarea value={form.note} onChange={(e) => set_form({ ...form, note: e.target.value })} />
          </div>
        </div>
        {puo_gestire_sportivo && (
          <Button onClick={salva} disabled={aggiorna.isPending}>
            {t("campi_interclub.info.salva")}
          </Button>
        )}
      </fieldset>
      {!is_ospitante && <p className="text-sm text-muted-foreground">{t("campi_interclub.solo_ospitante")}</p>}
    </CardContent>
  );
};

// ═══════════════════ CHI PARTECIPA: una riga per club ═══════════════════
const SezioneChiPartecipa: React.FC<{ campo: EventoCampoInterClub; is_ospitante: boolean }> = ({
  campo,
  is_ospitante,
}) => {
  const { t } = useTranslation("events");
  const { puo_gestire_sportivo } = usePermessiAzione();
  const club_id = get_current_club_id();
  const { data: partecipanti = [] } = use_campo_partecipanti(campo.id);
  const { data: iscrizioni = [] } = use_campo_iscrizioni(campo.id);
  const { data: anteprime = [] } = use_anteprima_fatture_ospiti(is_ospitante ? campo.id : null);
  const [aperto, set_aperto] = useState<string | null>(null);
  const [invito_aperto, set_invito_aperto] = useState(false);

  // Colore stabile: ordine di invito (i partecipanti arrivano già ordinati per invitato_at).
  const colore_di = useMemo(() => {
    const m = new Map<string, string>();
    partecipanti.forEach((p, i) => m.set(p.id, colore_club_per_indice(i)));
    return m;
  }, [partecipanti]);

  const nostri_iscritti = useMemo(
    () => iscrizioni.filter((i) => !i.atleta?.ospite_di_campo_id && i.club_id === campo.club_id),
    [iscrizioni, campo.club_id],
  );

  const iscritti_di = (p: CampoClubPartecipante) => {
    const nome_p = nome_club_partecipante(p).trim().toLowerCase();
    return iscrizioni.filter((i) => {
      const prov = (i.atleta?.club_provenienza ?? "").trim().toLowerCase();
      if (i.atleta?.ospite_di_campo_id) return !!nome_p && prov === nome_p;
      if (p.club_id) return i.atleta?.club_id === p.club_id && p.club_id !== campo.club_id;
      return !!nome_p && prov === nome_p;
    });
  };

  const anteprima_di = (p: CampoClubPartecipante) =>
    anteprime.find((a) => a.riga_partecipazione === p.id) ?? null;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <Users className="w-4 h-4" /> Chi partecipa
        </CardTitle>
        <CardDescription>
          Un club per riga: quanti atleti ha iscritto, se ha accettato e quanto deve. Apri la riga per vedere gli
          atleti e le azioni di quel club.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-2">
        {is_ospitante && !puo_gestire_sportivo && (
          <NotaPermesso testo="Non hai i permessi per invitare o gestire i club partecipanti." />
        )}

        {/* Il nostro club, sempre per primo */}
        <RigaContenitore
          colore={COLORE_CLUB_OSPITANTE}
          aperto={aperto === "nostro"}
          on_toggle={() => set_aperto(aperto === "nostro" ? null : "nostro")}
          titolo={is_ospitante ? "Il nostro club" : "Il nostro club (invitato)"}
          sottotitolo={
            <>
              <span>
                {nostri_iscritti.length} {nostri_iscritti.length === 1 ? "atleta" : "atleti"}
              </span>
              <span className="text-muted-foreground">
                {is_ospitante ? "Organizza il campo" : "Partecipa al campo"}
              </span>
            </>
          }
        >
          <IscrizioniNostroClub campo={campo} />
        </RigaContenitore>

        {partecipanti.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-6">{t("campi_interclub.club.empty")}</p>
        ) : (
          partecipanti.map((p) => {
            const atleti_club = iscritti_di(p);
            const ant = anteprima_di(p);
            return (
              <RigaClubPartecipante
                key={p.id}
                campo={campo}
                partecipante={p}
                colore={colore_di.get(p.id) ?? COLORE_CLUB_OSPITANTE}
                is_ospitante={is_ospitante}
                iscritti={atleti_club}
                anteprima={ant}
                aperto={aperto === p.id}
                on_toggle={() => set_aperto(aperto === p.id ? null : p.id)}
              />
            );
          })
        )}

        {is_ospitante && puo_gestire_sportivo && (
          <Button variant="outline" className="w-full" onClick={() => set_invito_aperto(true)}>
            <Plus className="w-4 h-4 mr-1" /> {t("campi_interclub.club.invita")}
          </Button>
        )}
      </CardContent>

      <DialogInvitaClub campo={campo} open={invito_aperto} on_open_change={set_invito_aperto} />
    </Card>
  );
};

// ── Contenitore di una riga apribile con barretta di colore ──
const RigaContenitore: React.FC<{
  colore: string;
  aperto: boolean;
  on_toggle: () => void;
  titolo: React.ReactNode;
  sottotitolo: React.ReactNode;
  azioni?: React.ReactNode;
  children: React.ReactNode;
}> = ({ colore, aperto, on_toggle, titolo, sottotitolo, azioni, children }) => (
  <div className="rounded-lg border overflow-hidden">
    <div className="flex items-stretch">
      <div className="w-1.5 shrink-0" style={{ backgroundColor: colore }} aria-hidden />
      <button
        type="button"
        className="flex-1 min-w-0 text-left p-3 hover:bg-muted/50 transition-colors"
        onClick={on_toggle}
        aria-expanded={aperto}
      >
        <div className="flex items-center gap-2 min-w-0">
          {aperto ? <ChevronDown className="w-4 h-4 shrink-0" /> : <ChevronRight className="w-4 h-4 shrink-0" />}
          <span className="font-medium truncate">{titolo}</span>
        </div>
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm pl-6">{sottotitolo}</div>
      </button>
      {azioni && <div className="flex items-center gap-2 p-3 shrink-0">{azioni}</div>}
    </div>
    {aperto && <div className="border-t p-3 bg-muted/30">{children}</div>}
  </div>
);

// ── Riga di un club invitato ─────────────────────────────────
const RigaClubPartecipante: React.FC<{
  campo: EventoCampoInterClub;
  partecipante: CampoClubPartecipante;
  colore: string;
  is_ospitante: boolean;
  iscritti: IscrizioneCampo[];
  anteprima: {
    riga_partecipazione: string;
    totale: number;
    gia_fatturata: boolean;
    avviso: string | null;
    n_atleti: number;
  } | null;
  aperto: boolean;
  on_toggle: () => void;
}> = ({ campo, partecipante: p, colore, is_ospitante, iscritti, anteprima, aperto, on_toggle }) => {
  const { t } = useTranslation("events");
  const { puo_gestire_sportivo } = usePermessiAzione();
  const aggiorna = use_aggiorna_partecipante();
  const elimina = use_elimina_partecipante();
  const link = use_genera_link_club_ospite();
  const emetti = use_genera_fattura_club_ospite();
  const [import_aperto, set_import_aperto] = useState(false);
  const [fatt_aperto, set_fatt_aperto] = useState(false);

  const nome = nome_club_partecipante(p);
  const puo_scrivere = is_ospitante && puo_gestire_sportivo;

  const crea_link = () =>
    link.mutate(
      { riga_partecipazione: p.id, evento_campo_id: campo.id },
      {
        onSuccess: (token) => {
          navigator.clipboard?.writeText(link_ospite(token));
          toast.success(t("campi_interclub.ospiti.link_copiato"));
        },
        onError: (e) => segnala_errore("CampiInterClub", "Generazione link club ospite", e),
      },
    );

  return (
    <>
      <RigaContenitore
        colore={colore}
        aperto={aperto}
        on_toggle={on_toggle}
        titolo={
          <>
            {nome}
            {!p.club_id && (
              <Badge variant="outline" className="ml-2">
                {t("campi_interclub.club.esterno_badge")}
              </Badge>
            )}
          </>
        }
        sottotitolo={
          <>
            <span className="inline-flex items-center rounded-md px-1.5 py-0.5 text-xs font-semibold leading-none" style={stile_pastiglia_club(colore)}>
              {iscritti.length} {iscritti.length === 1 ? "atleta" : "atleti"}
            </span>
            <span className="text-muted-foreground">{stato_invito_parole(p.stato)}</span>
            {is_ospitante && anteprima && (
              <span className="text-muted-foreground">
                Deve CHF {Number(anteprima.totale ?? 0).toFixed(2)}
              </span>
            )}
          </>
        }
        azioni={
          is_ospitante && anteprima ? (
            anteprima.gia_fatturata ? (
              <Badge variant="secondary">{t("campi_interclub.fatturazione.gia_fatturata")}</Badge>
            ) : Number(anteprima.totale ?? 0) > 0 && puo_scrivere ? (
              <Button
                size="sm"
                disabled={!!anteprima.avviso || emetti.isPending}
                title={anteprima.avviso ?? undefined}
                onClick={() =>
                  emetti.mutate(
                    { riga_partecipazione: p.id, evento_campo_id: campo.id },
                    {
                      onSuccess: () => toast.success(t("campi_interclub.fatturazione.emessa")),
                      onError: (e) => segnala_errore("CampiInterClub", "Emissione fattura club ospite", e),
                    },
                  )
                }
              >
                <Receipt className="w-4 h-4 mr-1" /> Emetti fattura
              </Button>
            ) : null
          ) : null
        }
      >
        <div className="space-y-3">
          {anteprima?.avviso && <p className="text-sm text-destructive">{anteprima.avviso}</p>}

          {iscritti.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nessun atleta iscritto da questo club.</p>
          ) : (
            <div className="divide-y rounded-md border bg-background">
              {iscritti
                .slice()
                .sort((a, b) =>
                  `${a.atleta?.cognome ?? ""} ${a.atleta?.nome ?? ""}`.localeCompare(
                    `${b.atleta?.cognome ?? ""} ${b.atleta?.nome ?? ""}`,
                  ),
                )
                .map((i) => (
                  <div key={i.id} className="flex flex-wrap items-center justify-between gap-2 px-3 py-2 text-sm">
                    <span className="flex items-center gap-2">
                      <span
                        className="inline-block w-2 h-2 rounded-full shrink-0"
                        style={{ backgroundColor: colore }}
                        aria-hidden
                      />
                      <span className="font-medium">
                        {`${i.atleta?.cognome ?? ""} ${i.atleta?.nome ?? ""}`.trim() ||
                          `${t("campi_interclub.iscrizioni.atleta")} ${i.atleta_id.slice(0, 8)}`}
                      </span>
                      <span className="text-muted-foreground">{nome}</span>
                    </span>
                    <span className="text-muted-foreground">
                      {anno_nascita(i.atleta?.data_nascita) ?? "—"}
                      {livello_atleta(i.atleta) ? ` • ${livello_atleta(i.atleta)}` : ""}
                    </span>
                  </div>
                ))}
            </div>
          )}

          {puo_scrivere && (
            <div className="flex flex-wrap items-center gap-2">
              <Button variant="outline" size="sm" onClick={() => set_import_aperto(true)}>
                <Upload className="w-4 h-4 mr-1" /> {t("campi_interclub.ospiti.importa")}
              </Button>
              <Button variant="outline" size="sm" onClick={() => set_fatt_aperto(true)}>
                <FileText className="w-4 h-4 mr-1" /> {t("campi_interclub.ospiti.dati_fatturazione")}
              </Button>
              <Button variant="outline" size="sm" onClick={crea_link} disabled={link.isPending}>
                <Link2 className="w-4 h-4 mr-1" /> {t("campi_interclub.ospiti.genera_link")}
              </Button>
              <Select
                value={p.stato}
                onValueChange={(v) => aggiorna.mutate({ id: p.id, evento_campo_id: campo.id, patch: { stato: v } })}
              >
                <SelectTrigger className="w-44">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {["invitato", "accettato", "rifiutato", "ritirato"].map((s) => (
                    <SelectItem key={s} value={s}>
                      {stato_invito_parole(s)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select
                value={p.stato_pagamento ?? "non_pagato"}
                onValueChange={(v) =>
                  aggiorna.mutate({ id: p.id, evento_campo_id: campo.id, patch: { stato_pagamento: v } })
                }
              >
                <SelectTrigger className="w-40">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {["non_pagato", "parziale", "pagato"].map((s) => (
                    <SelectItem key={s} value={s}>
                      {t(`campi_interclub.stati_pagamento.${s}`)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <ConfirmButton
                titolo={`Rimuovere "${nome}" dal campo?`}
                descrizione="Il club perderà l'accesso al campo e ai relativi dati di iscrizione."
                conferma_label="Rimuovi club"
                on_conferma={() => elimina.mutate({ id: p.id, evento_campo_id: campo.id })}
              >
                <Button variant="ghost" size="icon">
                  <Trash2 className="w-4 h-4 text-destructive" />
                </Button>
              </ConfirmButton>
            </div>
          )}

          <p className="text-xs text-muted-foreground">
            {fmt_date(p.valido_dal)} → {fmt_date(p.valido_al)} •{" "}
            {p.quota_club != null
              ? `CHF ${Number(p.quota_club).toFixed(2)}`
              : t("campi_interclub.club.senza_quota")}
          </p>

          {is_ospitante && p.token && (
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <code className="truncate">{link_ospite(p.token)}</code>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  navigator.clipboard?.writeText(link_ospite(p.token as string));
                  toast.success(t("campi_interclub.ospiti.link_copiato"));
                }}
              >
                {t("campi_interclub.ospiti.copia")}
              </Button>
            </div>
          )}
        </div>
      </RigaContenitore>

      {/* Importazione atleti ospiti da Excel */}
      <Dialog open={import_aperto} onOpenChange={set_import_aperto}>
        <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{t("campi_interclub.ospiti.importa_title")}</DialogTitle>
            <DialogDescription>{nome}</DialogDescription>
          </DialogHeader>
          <ImportOspitiBody campo={campo} partecipante={p} nome_club={nome} />
        </DialogContent>
      </Dialog>

      {/* Dati di fatturazione del club ospitato */}
      <Dialog open={fatt_aperto} onOpenChange={set_fatt_aperto}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{t("campi_interclub.ospiti.dati_fatturazione")}</DialogTitle>
            <DialogDescription>{nome}</DialogDescription>
          </DialogHeader>
          <DatiFatturazioneForm
            campo={campo}
            partecipante={p}
            nome_club={nome}
            on_close={() => set_fatt_aperto(false)}
          />
        </DialogContent>
      </Dialog>
    </>
  );
};

// ── Iscrizione degli atleti del nostro club ──────────────────
const IscrizioniNostroClub: React.FC<{ campo: EventoCampoInterClub }> = ({ campo }) => {
  const { t } = useTranslation("events");
  const { puo_gestire_sportivo } = usePermessiAzione();
  const { data: gruppi = [] } = use_campo_gruppi(campo.id);
  const { data: atleti = [] } = use_atleti();
  const { data: iscrizioni = [] } = use_campo_iscrizioni(campo.id);
  const toggle = use_toggle_iscrizione_campo();
  const aggiorna_gruppo = use_aggiorna_gruppo_iscrizione();
  const [ricerca, set_ricerca] = useState("");

  const per_atleta = useMemo(() => new Map(iscrizioni.map((i) => [i.atleta_id, i])), [iscrizioni]);

  const nostri = useMemo(() => {
    const q = ricerca.trim().toLowerCase();
    return (atleti ?? [])
      .filter((a: any) => !a.ospite_di_campo_id)
      .filter((a: any) => !q || `${a.cognome ?? ""} ${a.nome ?? ""}`.toLowerCase().includes(q))
      .sort((a: any, b: any) => `${a.cognome} ${a.nome}`.localeCompare(`${b.cognome} ${b.nome}`));
  }, [atleti, ricerca]);

  const cambia_gruppo = (iscrizione_id: string, valore: string) =>
    aggiorna_gruppo.mutate(
      { id: iscrizione_id, campo_gruppo_id: valore === "nessuno" ? null : valore, evento_campo_id: campo.id },
      { onError: (e) => segnala_errore("CampiInterClub", "Aggiornamento gruppo iscrizione", e) },
    );

  return (
    <div className="space-y-3">
      {!puo_gestire_sportivo && <NotaPermesso testo="Non hai i permessi per iscrivere gli atleti al campo." />}
      <Input
        value={ricerca}
        onChange={(e) => set_ricerca(e.target.value)}
        placeholder={t("campi_interclub.iscrizioni.cerca_placeholder")}
      />
      {nostri.length === 0 ? (
        <p className="text-sm text-muted-foreground text-center py-4">{t("campi_interclub.iscrizioni.empty")}</p>
      ) : (
        <div className="divide-y rounded-md border bg-background max-h-96 overflow-y-auto">
          {nostri.map((a: any) => {
            const iscrizione = per_atleta.get(a.id);
            return (
              <div key={a.id} className="flex flex-wrap items-center justify-between gap-3 px-3 py-2">
                <div className="flex items-center gap-3">
                  <Checkbox
                    checked={!!iscrizione}
                    disabled={toggle.isPending || !puo_gestire_sportivo}
                    onCheckedChange={() =>
                      toggle.mutate(
                        { evento_campo_id: campo.id, atleta_id: a.id, iscritto: !!iscrizione },
                        { onError: (e) => segnala_errore("CampiInterClub", "Iscrizione atleta al campo", e) },
                      )
                    }
                  />
                  <span className="font-medium text-sm">
                    {a.cognome} {a.nome}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {anno_nascita(a.data_nascita) ?? "—"}
                    {livello_atleta(a) ? ` • ${livello_atleta(a)}` : ""}
                  </span>
                </div>
                {iscrizione && puo_gestire_sportivo && gruppi.length > 0 && (
                  <Select
                    value={iscrizione.campo_gruppo_id ?? "nessuno"}
                    onValueChange={(v) => cambia_gruppo(iscrizione.id, v)}
                  >
                    <SelectTrigger className="w-52">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="nessuno">{t("campi_interclub.adesioni.senza_gruppo")}</SelectItem>
                      {gruppi.map((g) => (
                        <SelectItem key={g.id} value={g.id}>
                          {g.nome}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

// ── Dialogo: invita un club ──────────────────────────────────
const DialogInvitaClub: React.FC<{
  campo: EventoCampoInterClub;
  open: boolean;
  on_open_change: (v: boolean) => void;
}> = ({ campo, open, on_open_change }) => {
  const { t } = useTranslation("events");
  const { data: partecipanti = [] } = use_campo_partecipanti(campo.id);
  const { data: clubs = [] } = use_clubs_opzioni();
  const invita = use_invita_club();
  const [ricerca_club, set_ricerca_club] = useState("");
  const [modalita_invito, set_modalita_invito] = useState<"esistente" | "esterno">("esistente");
  const [form, set_form] = useState({
    club_id: "",
    club_esterno_nome: "",
    quota_club: campo.quota_club_default != null ? String(campo.quota_club_default) : "",
    valido_dal: campo.data_inizio ?? "",
    valido_al: campo.data_fine ?? "",
  });

  const club_gia_invitati = useMemo(
    () => new Set(partecipanti.map((p) => p.club_id).filter(Boolean) as string[]),
    [partecipanti],
  );
  const club_disponibili = useMemo(
    () => clubs.filter((c) => c.id !== campo.club_id && !club_gia_invitati.has(c.id)),
    [clubs, campo.club_id, club_gia_invitati],
  );
  const club_filtrati = useMemo(() => {
    const q = ricerca_club.trim().toLowerCase();
    if (!q) return club_disponibili;
    return club_disponibili.filter((c) => `${c.nome ?? ""} ${c.citta ?? ""}`.toLowerCase().includes(q));
  }, [club_disponibili, ricerca_club]);

  const invito_valido =
    modalita_invito === "esistente" ? !!form.club_id : form.club_esterno_nome.trim().length > 0;

  const conferma_invito = () =>
    invita.mutate(
      {
        evento_campo_id: campo.id,
        club_id: modalita_invito === "esistente" ? form.club_id || null : null,
        club_esterno_nome: modalita_invito === "esterno" ? form.club_esterno_nome.trim() || null : null,
        quota_club: form.quota_club === "" ? null : Number(form.quota_club),
        valido_dal: form.valido_dal || campo.data_inizio || new Date().toISOString().slice(0, 10),
        valido_al: form.valido_al || campo.data_fine || new Date().toISOString().slice(0, 10),
      },
      {
        onSuccess: () => {
          toast.success(t("campi_interclub.club.invitato_toast"));
          on_open_change(false);
        },
        onError: (e: any) => toast.error(e.message),
      },
    );

  return (
    <Dialog open={open} onOpenChange={on_open_change}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t("campi_interclub.club.dialog_title")}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <Label>{t("campi_interclub.club.modalita")}</Label>
            <Select value={modalita_invito} onValueChange={(v) => set_modalita_invito(v as "esistente" | "esterno")}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="esistente">{t("campi_interclub.club.modalita_esistente")}</SelectItem>
                <SelectItem value="esterno">{t("campi_interclub.club.modalita_esterno")}</SelectItem>
              </SelectContent>
            </Select>
          </div>
          {modalita_invito === "esistente" ? (
            <div>
              <Label>{t("campi_interclub.club.club_label")}</Label>
              {club_disponibili.length === 0 ? (
                <p className="text-sm text-muted-foreground py-2">
                  {t("campi_interclub.club.nessun_club_disponibile")}
                </p>
              ) : (
                <>
                  {club_disponibili.length > 8 && (
                    <Input
                      className="mb-2"
                      value={ricerca_club}
                      onChange={(e) => set_ricerca_club(e.target.value)}
                      placeholder={t("campi_interclub.club.cerca_placeholder")}
                    />
                  )}
                  <Select value={form.club_id} onValueChange={(v) => set_form({ ...form, club_id: v })}>
                    <SelectTrigger>
                      <SelectValue placeholder={t("campi_interclub.club.club_placeholder")} />
                    </SelectTrigger>
                    <SelectContent>
                      {club_filtrati.length === 0 ? (
                        <div className="px-2 py-3 text-sm text-muted-foreground">
                          {t("campi_interclub.club.nessun_risultato")}
                        </div>
                      ) : (
                        club_filtrati.map((c) => (
                          <SelectItem key={c.id} value={c.id}>
                            {c.nome}
                            {c.citta ? ` (${c.citta})` : ""}
                          </SelectItem>
                        ))
                      )}
                    </SelectContent>
                  </Select>
                </>
              )}
            </div>
          ) : (
            <div>
              <Label>{t("campi_interclub.club.esterno_label")}</Label>
              <Input
                value={form.club_esterno_nome}
                onChange={(e) => set_form({ ...form, club_esterno_nome: e.target.value })}
                placeholder={t("campi_interclub.club.esterno_placeholder")}
              />
            </div>
          )}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>{t("campi_interclub.club.valido_dal")}</Label>
              <Input
                type="date"
                value={form.valido_dal}
                onChange={(e) => set_form({ ...form, valido_dal: e.target.value })}
              />
            </div>
            <div>
              <Label>{t("campi_interclub.club.valido_al")}</Label>
              <Input
                type="date"
                value={form.valido_al}
                onChange={(e) => set_form({ ...form, valido_al: e.target.value })}
              />
            </div>
          </div>
          <div>
            <Label>{t("campi_interclub.club.quota_club")}</Label>
            <Input
              type="number"
              step="0.05"
              value={form.quota_club}
              onChange={(e) => set_form({ ...form, quota_club: e.target.value })}
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => on_open_change(false)}>
            {t("campi_interclub.annulla")}
          </Button>
          <Button onClick={conferma_invito} disabled={invita.isPending || !invito_valido}>
            {t("campi_interclub.club.invia_invito")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

// ── Corpo dialog importazione ospiti ─────────────────────────
const ImportOspitiBody: React.FC<{
  campo: EventoCampoInterClub;
  partecipante: CampoClubPartecipante;
  nome_club: string;
}> = ({ campo, partecipante, nome_club }) => {
  const { t } = useTranslation("events");
  const { data: gruppi = [] } = use_campo_gruppi(campo.id);
  const registra = use_registra_atleti_ospiti();
  const [gruppo, set_gruppo] = useState<string>("nessuno");

  return (
    <div className="space-y-4">
      {gruppi.length > 0 && (
        <div>
          <Label>{t("campi_interclub.ospiti.gruppo_default")}</Label>
          <Select value={gruppo} onValueChange={set_gruppo}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="nessuno">{t("campi_interclub.adesioni.senza_gruppo")}</SelectItem>
              {gruppi.map((g) => (
                <SelectItem key={g.id} value={g.id}>
                  {g.nome}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}
      <OspitiImportWizard
        consenti_manuale
        on_submit={(elenco) =>
          registra.mutateAsync({
            evento_campo_id: campo.id,
            club_provenienza: partecipante.club_esterno_nome || nome_club,
            elenco,
            campo_gruppo_id: gruppo === "nessuno" ? null : gruppo,
          })
        }
      />
    </div>
  );
};

// ── Dati di fatturazione del club ospitato ───────────────────
const DatiFatturazioneForm: React.FC<{
  campo: EventoCampoInterClub;
  partecipante: CampoClubPartecipante;
  nome_club: string;
  on_close: () => void;
}> = ({ campo, partecipante, nome_club, on_close }) => {
  const { t } = useTranslation("events");
  const aggiorna = use_aggiorna_partecipante();
  const [form, set_form] = useState({
    fatt_ragione_sociale: partecipante.fatt_ragione_sociale ?? nome_club,
    fatt_indirizzo: partecipante.fatt_indirizzo ?? "",
    fatt_cap: partecipante.fatt_cap ?? "",
    fatt_citta: partecipante.fatt_citta ?? "",
    fatt_paese_iso: partecipante.fatt_paese_iso ?? "CH",
    fatt_email: partecipante.fatt_email ?? "",
    fatt_referente: partecipante.fatt_referente ?? "",
  });

  const salva = () =>
    aggiorna.mutate(
      { id: partecipante.id, evento_campo_id: campo.id, patch: { ...form } },
      {
        onSuccess: () => {
          toast.success(t("campi_interclub.ospiti.fatt_salvata"));
          on_close();
        },
        onError: (e) => segnala_errore("CampiInterClub", "Salvataggio dati fatturazione club ospite", e),
      },
    );

  const campi: { key: keyof typeof form; label: string }[] = [
    { key: "fatt_ragione_sociale", label: t("campi_interclub.ospiti.fatt_ragione_sociale") },
    { key: "fatt_indirizzo", label: t("campi_interclub.ospiti.fatt_indirizzo") },
    { key: "fatt_cap", label: t("campi_interclub.ospiti.fatt_cap") },
    { key: "fatt_citta", label: t("campi_interclub.ospiti.fatt_citta") },
    { key: "fatt_paese_iso", label: t("campi_interclub.ospiti.fatt_paese_iso") },
    { key: "fatt_email", label: t("campi_interclub.ospiti.fatt_email") },
    { key: "fatt_referente", label: t("campi_interclub.ospiti.fatt_referente") },
  ];

  return (
    <div className="space-y-3">
      <div className="grid sm:grid-cols-2 gap-3">
        {campi.map((c) => (
          <div key={c.key} className={c.key === "fatt_ragione_sociale" || c.key === "fatt_indirizzo" ? "sm:col-span-2" : ""}>
            <Label>{c.label}</Label>
            <Input value={form[c.key]} onChange={(e) => set_form({ ...form, [c.key]: e.target.value })} />
          </div>
        ))}
      </div>
      <DialogFooter>
        <Button variant="outline" onClick={on_close}>
          {t("campi_interclub.annulla")}
        </Button>
        <Button onClick={salva} disabled={aggiorna.isPending}>
          {t("campi_interclub.salva")}
        </Button>
      </DialogFooter>
    </div>
  );
};

// ═══════════════════ GRUPPI (nascosti finché non servono) ═══════════════════
const SezioneGruppi: React.FC<{ campo: EventoCampoInterClub; is_ospitante: boolean }> = ({ campo, is_ospitante }) => {
  const { data: gruppi = [] } = use_campo_gruppi(campo.id);
  const [mostra, set_mostra] = useState(false);

  const visibile = mostra || gruppi.length > 0;

  if (!visibile) {
    return (
      <button
        type="button"
        className="text-sm text-muted-foreground underline underline-offset-4 hover:text-foreground"
        onClick={() => set_mostra(true)}
      >
        Dividi gli atleti in gruppi
      </button>
    );
  }

  return (
    <div className="space-y-4">
      <ElencoGruppi campo={campo} is_ospitante={is_ospitante} />
      <MatriceGruppiClub campo={campo} />
    </div>
  );
};

const ElencoGruppi: React.FC<{ campo: EventoCampoInterClub; is_ospitante: boolean }> = ({ campo, is_ospitante }) => {
  const { t } = useTranslation("events");
  const { puo_gestire_sportivo } = usePermessiAzione();
  const { data: gruppi = [] } = use_campo_gruppi(campo.id);
  const salva = use_salva_gruppo();
  const elimina = use_elimina_gruppo();
  const riordina = use_riordina_gruppi();
  const [open, set_open] = useState(false);
  const [in_modifica, set_in_modifica] = useState<CampoGruppo | null>(null);
  const [form, set_form] = useState({ nome: "", criterio: "", capienza_max: "" });

  const apri = (g: CampoGruppo | null) => {
    set_in_modifica(g);
    set_form({
      nome: g?.nome ?? "",
      criterio: g?.criterio ?? "",
      capienza_max: g?.capienza_max != null ? String(g.capienza_max) : "",
    });
    set_open(true);
  };

  const conferma = () =>
    salva.mutate(
      {
        id: in_modifica?.id,
        evento_campo_id: campo.id,
        nome: form.nome.trim(),
        criterio: form.criterio.trim() || null,
        capienza_max: form.capienza_max === "" ? null : Number(form.capienza_max),
        ordine: in_modifica?.ordine ?? gruppi.length + 1,
      },
      {
        onSuccess: () => {
          toast.success(t("campi_interclub.gruppi.salvato_toast"));
          set_open(false);
        },
        onError: (e: any) => toast.error(e.message),
      },
    );

  const sposta = (index: number, delta: number) => {
    const nuovo = [...gruppi];
    const target = index + delta;
    if (target < 0 || target >= nuovo.length) return;
    [nuovo[index], nuovo[target]] = [nuovo[target], nuovo[index]];
    riordina.mutate({ gruppi: nuovo, evento_campo_id: campo.id });
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <div>
          <CardTitle className="text-base">{t("campi_interclub.gruppi.title")}</CardTitle>
          <CardDescription>{t("campi_interclub.gruppi.description")}</CardDescription>
        </div>
        {is_ospitante && puo_gestire_sportivo && (
          <Button size="sm" onClick={() => apri(null)}>
            <Plus className="w-4 h-4 mr-1" /> {t("campi_interclub.gruppi.nuovo")}
          </Button>
        )}
      </CardHeader>
      <CardContent>
        {is_ospitante && !puo_gestire_sportivo && (
          <NotaPermesso testo="Non hai i permessi per creare o modificare i gruppi." />
        )}
        {gruppi.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-6">{t("campi_interclub.gruppi.empty")}</p>
        ) : (
          <div className="space-y-2">
            {gruppi.map((g, index) => (
              <div key={g.id} className="flex items-center justify-between gap-3 p-3 border rounded-lg">
                <div className="min-w-0">
                  <p className="font-medium">{g.nome}</p>
                  <p className="text-sm text-muted-foreground truncate">
                    {g.criterio || t("campi_interclub.gruppi.senza_criterio")}
                    {g.capienza_max != null ? ` • ${t("campi_interclub.gruppi.capienza")}: ${g.capienza_max}` : ""}
                  </p>
                </div>
                {is_ospitante && puo_gestire_sportivo && (
                  <div className="flex items-center gap-1 shrink-0">
                    <Button variant="ghost" size="icon" onClick={() => sposta(index, -1)} disabled={index === 0}>
                      <ArrowUp className="w-4 h-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => sposta(index, 1)}
                      disabled={index === gruppi.length - 1}
                    >
                      <ArrowDown className="w-4 h-4" />
                    </Button>
                    <Button variant="ghost" size="sm" onClick={() => apri(g)}>
                      {t("campi_interclub.gruppi.modifica")}
                    </Button>
                    <ConfirmButton
                      titolo={`Eliminare il gruppo "${g.nome}"?`}
                      descrizione="Gli atleti iscritti a questo gruppo resteranno iscritti al campo, ma senza gruppo."
                      conferma_label="Elimina gruppo"
                      on_conferma={() => elimina.mutate({ id: g.id, evento_campo_id: campo.id })}
                    >
                      <Button variant="ghost" size="icon">
                        <Trash2 className="w-4 h-4 text-destructive" />
                      </Button>
                    </ConfirmButton>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </CardContent>

      <Dialog open={open} onOpenChange={set_open}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {in_modifica ? t("campi_interclub.gruppi.dialog_modifica") : t("campi_interclub.gruppi.dialog_nuovo")}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>{t("campi_interclub.gruppi.nome")}</Label>
              <Input value={form.nome} onChange={(e) => set_form({ ...form, nome: e.target.value })} />
            </div>
            <div>
              <Label>{t("campi_interclub.gruppi.criterio")}</Label>
              <Input
                value={form.criterio}
                onChange={(e) => set_form({ ...form, criterio: e.target.value })}
                placeholder={t("campi_interclub.gruppi.criterio_placeholder")}
              />
            </div>
            <div>
              <Label>{t("campi_interclub.gruppi.capienza")}</Label>
              <Input
                type="number"
                value={form.capienza_max}
                onChange={(e) => set_form({ ...form, capienza_max: e.target.value })}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => set_open(false)}>
              {t("campi_interclub.annulla")}
            </Button>
            <Button onClick={conferma} disabled={salva.isPending || !form.nome.trim()}>
              {t("campi_interclub.salva")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
};

// ── Griglia gruppi × club (ex "Adesioni") ────────────────────
const MatriceGruppiClub: React.FC<{ campo: EventoCampoInterClub }> = ({ campo }) => {
  const { t } = useTranslation("events");
  const { data: gruppi = [] } = use_campo_gruppi(campo.id);
  const { data: partecipanti = [] } = use_campo_partecipanti(campo.id);
  const { data: adesioni = [] } = use_campo_adesioni(campo.id);

  const colore_di = useMemo(() => {
    const m = new Map<string, string>();
    partecipanti.forEach((p, i) => m.set(p.id, colore_club_per_indice(i)));
    return m;
  }, [partecipanti]);

  const colonne = useMemo(() => partecipanti.filter((p) => p.stato === "accettato"), [partecipanti]);
  const in_attesa = useMemo(() => partecipanti.filter((p) => p.stato === "invitato"), [partecipanti]);

  // Gli atleti ospiti sono anagrafati sotto il club ospitante: si abbinano per
  // nome del club di provenienza, come fa il database.
  const appartiene = (a: (typeof adesioni)[number], p: CampoClubPartecipante) => {
    const nome_p = nome_club_partecipante(p).trim().toLowerCase();
    const prov = (a.atleta?.club_provenienza ?? "").trim().toLowerCase();
    if (a.atleta?.ospite_di_campo_id) return !!nome_p && prov === nome_p;
    return p.club_id ? a.club_id === p.club_id : !!nome_p && prov === nome_p;
  };

  const conta = (gruppo_id: string | null, p: CampoClubPartecipante) =>
    adesioni.filter((a) => a.campo_gruppo_id === gruppo_id && appartiene(a, p)).length;

  const righe = [
    ...gruppi.map((g) => ({ id: g.id as string | null, nome: g.nome })),
    { id: null, nome: t("campi_interclub.adesioni.senza_gruppo") },
  ];

  const totale_colonna = (p: CampoClubPartecipante) => adesioni.filter((a) => appartiene(a, p)).length;
  const totale_riga = (gruppo_id: string | null) => adesioni.filter((a) => a.campo_gruppo_id === gruppo_id).length;

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t("campi_interclub.adesioni.title")}</CardTitle>
          <CardDescription>{t("campi_interclub.adesioni.description")}</CardDescription>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          {colonne.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-6">{t("campi_interclub.adesioni.empty")}</p>
          ) : (
            <table className="w-full text-sm border-collapse">
              <thead>
                <tr className="border-b">
                  <th className="text-left p-2">{t("campi_interclub.adesioni.gruppo")}</th>
                  {colonne.map((p) => (
                    <th key={p.id} className="p-2 text-center whitespace-nowrap">
                      <span className="inline-flex items-center gap-2">
                        <span
                          className="inline-block w-2.5 h-2.5 rounded-sm"
                          style={{ backgroundColor: colore_di.get(p.id) }}
                          aria-hidden
                        />
                        {nome_club_partecipante(p)}
                      </span>
                    </th>
                  ))}
                  <th className="p-2 text-center font-semibold">{t("campi_interclub.adesioni.totale")}</th>
                </tr>
              </thead>
              <tbody>
                {righe.map((r) => (
                  <tr key={r.id ?? "senza_gruppo"} className="border-b">
                    <td className="p-2">{r.nome}</td>
                    {colonne.map((p) => (
                      <td key={p.id} className="p-2 text-center">
                        {conta(r.id, p)}
                      </td>
                    ))}
                    <td className="p-2 text-center font-semibold">{totale_riga(r.id)}</td>
                  </tr>
                ))}
                <tr className="font-semibold">
                  <td className="p-2">{t("campi_interclub.adesioni.totale")}</td>
                  {colonne.map((p) => (
                    <td key={p.id} className="p-2 text-center">
                      {totale_colonna(p)}
                    </td>
                  ))}
                  <td className="p-2 text-center">{adesioni.length}</td>
                </tr>
              </tbody>
            </table>
          )}
        </CardContent>
      </Card>

      {in_attesa.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">{t("campi_interclub.adesioni.in_attesa_title")}</CardTitle>
            <CardDescription>
              {t("campi_interclub.adesioni.in_attesa_desc", { count: in_attesa.length })}
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-2">
            {in_attesa.map((p) => (
              <Badge key={p.id} variant="secondary">
                {nome_club_partecipante(p)}
              </Badge>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default CampiInterClubSection;
