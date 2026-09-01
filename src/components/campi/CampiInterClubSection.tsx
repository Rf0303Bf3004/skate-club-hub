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
} from "@/hooks/use-campi-interclub";
import { use_atleti } from "@/hooks/use-supabase-data";
import { use_app_store_links } from "@/hooks/use-app-store-links";
import { stampa_schede_codice } from "@/lib/scheda-codice-html";
import OspitiImportWizard from "@/components/campi/OspitiImportWizard";
import { useAuth } from "@/lib/auth";
import { segnala_errore } from "@/lib/errori";
import { Checkbox } from "@/components/ui/checkbox";

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
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
} from "lucide-react";


const fmt_date = (d: string | null) =>
  d ? new Date(d + "T00:00:00").toLocaleDateString("de-CH", { day: "2-digit", month: "2-digit", year: "numeric" }) : "—";

/** Indirizzo pubblico che il club ospitato apre senza account. */
const link_ospite = (token: string) => `${window.location.origin}/campo-ospite/${token}`;


const stato_variant = (stato: string): "default" | "secondary" | "destructive" | "outline" => {
  if (stato === "accettato" || stato === "aperto") return "default";
  if (stato === "rifiutato" || stato === "ritirato") return "destructive";
  if (stato === "concluso" || stato === "chiuso") return "outline";
  return "secondary";
};

// ═══════════════════════════════ SEZIONE PRINCIPALE ═══════════════════════════════
interface CampiInterClubSectionProps {
  /** Apre subito la scheda di questo campo, sul tab dei club invitati. */
  campo_iniziale_id?: string | null;
  on_campo_iniziale_aperto?: () => void;
}

const CampiInterClubSection: React.FC<CampiInterClubSectionProps> = ({
  campo_iniziale_id,
  on_campo_iniziale_aperto,
}) => {
  const { t } = useTranslation("events");
  const club_id = get_current_club_id();
  const { data: ospitati = [] } = use_campi_ospitati();
  const { data: invitati = [] } = use_campi_invitati();
  const rispondi = use_rispondi_invito_campo();
  const [campo_selezionato, set_campo_selezionato] = useState<EventoCampoInterClub | null>(null);
  const [tab_iniziale, set_tab_iniziale] = useState<string | undefined>(undefined);

  React.useEffect(() => {
    if (!campo_iniziale_id) return;
    const trovato = ospitati.find((c) => c.id === campo_iniziale_id);
    if (!trovato) return;
    set_campo_selezionato(trovato);
    set_tab_iniziale("club");
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
        tab_iniziale={tab_iniziale}
        on_back={() => {
          set_campo_selezionato(null);
          set_tab_iniziale(undefined);
        }}
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
                    {c.n_invitati === 0 ? (
                      <Button
                        size="sm"
                        className="mt-2 w-full"
                        onClick={(ev) => {
                          ev.stopPropagation();
                          set_campo_selezionato(c);
                          set_tab_iniziale("club");
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
                      {t(`campi_interclub.stati_partecipante.${partecipazione.stato}`)}
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

// ═══════════════════════════════ SCHEDA CAMPO ═══════════════════════════════
const CampoScheda: React.FC<{ campo: EventoCampoInterClub; is_ospitante: boolean; on_back: () => void }> = ({
  campo,
  is_ospitante,
  on_back,
}) => {
  const { t } = useTranslation("events");
  const { session } = useAuth();
  const is_superadmin = session?.ruolo === "superadmin";
  const { data: ospiti = [] } = use_atleti_ospiti_campo(is_ospitante ? campo.id : null);
  const { ios_store_url, android_store_url } = use_app_store_links();

  const [tab, set_tab] = useState("informazioni");

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

  const n_tab = 5 + (is_ospitante ? 1 : 0) + (is_superadmin ? 1 : 0);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <Button variant="ghost" onClick={on_back}>
            {t("campi_interclub.back")}
          </Button>
          <h2 className="text-2xl font-bold mt-2">{campo.nome}</h2>
          <p className="text-sm text-muted-foreground">
            {fmt_date(campo.data_inizio)} → {fmt_date(campo.data_fine)}
            {campo.luogo ? ` • ${campo.luogo}` : ""}
          </p>
        </div>
        {is_ospitante && (
          <Button variant="outline" size="sm" onClick={stampa_ospiti}>
            <Printer className="w-4 h-4 mr-1" />
            {t("campi_interclub.ospiti.stampa_schede", { count: ospiti.length })}
          </Button>
        )}
      </div>

      <Tabs value={tab} onValueChange={set_tab} className="space-y-4">
        <TabsList className="grid w-full" style={{ gridTemplateColumns: `repeat(${n_tab}, minmax(0, 1fr))` }}>
          <TabsTrigger value="informazioni">{t("campi_interclub.tabs.informazioni")}</TabsTrigger>
          <TabsTrigger value="gruppi">{t("campi_interclub.tabs.gruppi")}</TabsTrigger>
          <TabsTrigger value="club">{t("campi_interclub.tabs.club")}</TabsTrigger>
          <TabsTrigger value="atleti">{t("campi_interclub.tabs.atleti")}</TabsTrigger>
          <TabsTrigger value="adesioni">{t("campi_interclub.tabs.adesioni")}</TabsTrigger>
          {is_ospitante && <TabsTrigger value="fatturazione">{t("campi_interclub.tabs.fatturazione")}</TabsTrigger>}
          {is_superadmin && <TabsTrigger value="istruttori">{t("campi_interclub.tabs.istruttori")}</TabsTrigger>}
        </TabsList>

        <TabsContent value="informazioni">
          <TabInformazioni campo={campo} is_ospitante={is_ospitante} />
        </TabsContent>
        <TabsContent value="gruppi">
          <TabGruppi campo={campo} is_ospitante={is_ospitante} />
        </TabsContent>
        <TabsContent value="club">
          <TabClubPartecipanti campo={campo} is_ospitante={is_ospitante} />
        </TabsContent>
        <TabsContent value="atleti">
          <TabIscrizioniAtleti campo={campo} is_ospitante={is_ospitante} />
        </TabsContent>
        <TabsContent value="adesioni">
          <TabAdesioni campo={campo} />
        </TabsContent>
        {is_ospitante && (
          <TabsContent value="fatturazione">
            <TabFatturazioneOspiti campo={campo} />
          </TabsContent>
        )}

        {is_superadmin && (
          <TabsContent value="istruttori">
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <Construction className="w-4 h-4" /> {t("campi_interclub.istruttori.title")}
                </CardTitle>
                <CardDescription>{t("campi_interclub.istruttori.placeholder")}</CardDescription>
              </CardHeader>
            </Card>
          </TabsContent>
        )}
      </Tabs>
    </div>
  );

};

// ── Tab 1: informazioni ──────────────────────────────────────
const TabInformazioni: React.FC<{ campo: EventoCampoInterClub; is_ospitante: boolean }> = ({ campo, is_ospitante }) => {
  const { t } = useTranslation("events");
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
    <Card>
      <CardHeader>
        <CardTitle className="text-base">{t("campi_interclub.info.title")}</CardTitle>
        <CardDescription>{t("campi_interclub.info.description")}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <fieldset disabled={!is_ospitante} className="space-y-4">
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
          <Button onClick={salva} disabled={aggiorna.isPending}>
            {t("campi_interclub.info.salva")}
          </Button>
        </fieldset>
        {!is_ospitante && <p className="text-sm text-muted-foreground">{t("campi_interclub.solo_ospitante")}</p>}
      </CardContent>
    </Card>
  );
};

// ── Tab 2: gruppi ────────────────────────────────────────────
const TabGruppi: React.FC<{ campo: EventoCampoInterClub; is_ospitante: boolean }> = ({ campo, is_ospitante }) => {
  const { t } = useTranslation("events");
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
        {is_ospitante && (
          <Button size="sm" onClick={() => apri(null)}>
            <Plus className="w-4 h-4 mr-1" /> {t("campi_interclub.gruppi.nuovo")}
          </Button>
        )}
      </CardHeader>
      <CardContent>
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
                {is_ospitante && (
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
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => elimina.mutate({ id: g.id, evento_campo_id: campo.id })}
                    >
                      <Trash2 className="w-4 h-4 text-destructive" />
                    </Button>
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

// ── Tab 3: club partecipanti ─────────────────────────────────
const TabClubPartecipanti: React.FC<{ campo: EventoCampoInterClub; is_ospitante: boolean }> = ({
  campo,
  is_ospitante,
}) => {
  const { t } = useTranslation("events");
  const { data: partecipanti = [] } = use_campo_partecipanti(campo.id);
  const { data: clubs = [] } = use_clubs_opzioni();
  const invita = use_invita_club();
  const aggiorna = use_aggiorna_partecipante();
  const elimina = use_elimina_partecipante();
  const link = use_genera_link_club_ospite();
  const [open, set_open] = useState(false);
  const [import_per, set_import_per] = useState<CampoClubPartecipante | null>(null);
  const [fatt_per, set_fatt_per] = useState<CampoClubPartecipante | null>(null);
  const [ricerca_club, set_ricerca_club] = useState("");
  const [modalita_invito, set_modalita_invito] = useState<"esistente" | "esterno">("esistente");
  const [form, set_form] = useState({
    club_id: "",
    club_esterno_nome: "",
    quota_club: campo.quota_club_default != null ? String(campo.quota_club_default) : "",
    valido_dal: campo.data_inizio ?? "",
    valido_al: campo.data_fine ?? "",
  });

  const nome_partecipante = (p: CampoClubPartecipante) =>
    p.clubs?.nome || p.club_esterno_nome || t("campi_interclub.club.senza_nome");

  const crea_link = (p: CampoClubPartecipante) =>
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
          set_open(false);
        },
        onError: (e: any) => toast.error(e.message),
      },
    );

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
    return club_disponibili.filter((c) =>
      `${c.nome ?? ""} ${c.citta ?? ""}`.toLowerCase().includes(q),
    );
  }, [club_disponibili, ricerca_club]);

  const invito_valido =
    modalita_invito === "esistente" ? !!form.club_id : form.club_esterno_nome.trim().length > 0;

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <div>
          <CardTitle className="text-base">{t("campi_interclub.club.title")}</CardTitle>
          <CardDescription>{t("campi_interclub.club.description")}</CardDescription>
        </div>
        {is_ospitante && (
          <Button size="sm" onClick={() => set_open(true)}>
            <Plus className="w-4 h-4 mr-1" /> {t("campi_interclub.club.invita")}
          </Button>
        )}
      </CardHeader>
      <CardContent>
        {partecipanti.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-6">{t("campi_interclub.club.empty")}</p>
        ) : (
          <div className="space-y-2">
            {partecipanti.map((p) => (
              <div key={p.id} className="flex flex-wrap items-center justify-between gap-3 p-3 border rounded-lg">
                <div>
                  <p className="font-medium">
                    {nome_partecipante(p)}
                    {!p.club_id && (
                      <Badge variant="outline" className="ml-2">
                        {t("campi_interclub.club.esterno_badge")}
                      </Badge>
                    )}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {fmt_date(p.valido_dal)} → {fmt_date(p.valido_al)} •{" "}
                    {p.quota_club != null ? `CHF ${Number(p.quota_club).toFixed(2)}` : t("campi_interclub.club.senza_quota")}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant={stato_variant(p.stato)}>{t(`campi_interclub.stati_partecipante.${p.stato}`)}</Badge>
                  {is_ospitante ? (
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
                  ) : (
                    <Badge variant={p.stato_pagamento === "pagato" ? "default" : "secondary"}>
                      {t(`campi_interclub.stati_pagamento.${p.stato_pagamento ?? "non_pagato"}`)}
                    </Badge>
                  )}
                  {is_ospitante && (
                    <>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => set_import_per(p)}
                        title={t("campi_interclub.ospiti.importa")}
                      >
                        <Upload className="w-4 h-4 mr-1" /> {t("campi_interclub.ospiti.importa")}
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => set_fatt_per(p)}
                        title={t("campi_interclub.ospiti.dati_fatturazione")}
                      >
                        <FileText className="w-4 h-4 mr-1" /> {t("campi_interclub.ospiti.dati_fatturazione")}
                      </Button>
                      <Button variant="outline" size="sm" onClick={() => crea_link(p)} disabled={link.isPending}>
                        <Link2 className="w-4 h-4 mr-1" /> {t("campi_interclub.ospiti.genera_link")}
                      </Button>

                      <Select
                        value={p.stato}
                        onValueChange={(v) =>
                          aggiorna.mutate({ id: p.id, evento_campo_id: campo.id, patch: { stato: v } })
                        }
                      >
                        <SelectTrigger className="w-40">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {["invitato", "accettato", "rifiutato", "ritirato"].map((s) => (
                            <SelectItem key={s} value={s}>
                              {t(`campi_interclub.stati_partecipante.${s}`)}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => elimina.mutate({ id: p.id, evento_campo_id: campo.id })}
                      >
                        <Trash2 className="w-4 h-4 text-destructive" />
                      </Button>
                    </>
                  )}
                </div>
                {is_ospitante && p.token && (
                  <div className="w-full flex items-center gap-2 text-xs text-muted-foreground">
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
            ))}
          </div>
        )}
      </CardContent>

      <Dialog open={open} onOpenChange={set_open}>
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
            <Button variant="outline" onClick={() => set_open(false)}>
              {t("campi_interclub.annulla")}
            </Button>
            <Button onClick={conferma_invito} disabled={invita.isPending || !invito_valido}>
              {t("campi_interclub.club.invia_invito")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Importazione atleti ospiti da Excel */}
      <Dialog open={!!import_per} onOpenChange={(v) => !v && set_import_per(null)}>
        <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{t("campi_interclub.ospiti.importa_title")}</DialogTitle>
            <DialogDescription>
              {import_per ? nome_partecipante(import_per) : ""}
            </DialogDescription>
          </DialogHeader>
          {import_per && (
            <ImportOspitiBody
              campo={campo}
              partecipante={import_per}
              nome_club={nome_partecipante(import_per)}
            />
          )}
        </DialogContent>
      </Dialog>

      {/* Dati di fatturazione del club ospitato */}
      <Dialog open={!!fatt_per} onOpenChange={(v) => !v && set_fatt_per(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{t("campi_interclub.ospiti.dati_fatturazione")}</DialogTitle>
            <DialogDescription>{fatt_per ? nome_partecipante(fatt_per) : ""}</DialogDescription>
          </DialogHeader>
          {fatt_per && (
            <DatiFatturazioneForm
              campo={campo}
              partecipante={fatt_per}
              nome_club={nome_partecipante(fatt_per)}
              on_close={() => set_fatt_per(null)}
            />
          )}
        </DialogContent>
      </Dialog>
    </Card>
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

// ── Tab: fatturazione dei club ospiti ────────────────────────
const TabFatturazioneOspiti: React.FC<{ campo: EventoCampoInterClub }> = ({ campo }) => {
  const { t } = useTranslation("events");
  const { data: anteprime = [], isLoading } = use_anteprima_fatture_ospiti(campo.id);
  const emetti = use_genera_fattura_club_ospite();

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <Receipt className="w-4 h-4" /> {t("campi_interclub.fatturazione.title")}
        </CardTitle>
        <CardDescription>{t("campi_interclub.fatturazione.description")}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {isLoading ? (
          <p className="text-sm text-muted-foreground py-4 text-center">{t("campi_interclub.fatturazione.caricamento")}</p>
        ) : anteprime.length === 0 ? (
          <p className="text-sm text-muted-foreground py-6 text-center">{t("campi_interclub.fatturazione.empty")}</p>
        ) : (
          anteprime.map((a) => (
            <div key={a.riga_partecipazione} className="border rounded-lg p-3 space-y-2">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <p className="font-medium">{a.club_ospite}</p>
                  <p className="text-sm text-muted-foreground">
                    {t("campi_interclub.fatturazione.riepilogo", {
                      atleti: a.n_atleti,
                      righe: a.n_righe,
                      totale: Number(a.totale ?? 0).toFixed(2),
                    })}
                  </p>
                </div>
                {a.gia_fatturata ? (
                  <Badge variant="secondary">{t("campi_interclub.fatturazione.gia_fatturata")}</Badge>
                ) : (
                  <Button
                    size="sm"
                    disabled={!!a.avviso || emetti.isPending}
                    onClick={() =>
                      emetti.mutate(
                        { riga_partecipazione: a.riga_partecipazione, evento_campo_id: campo.id },
                        {
                          onSuccess: () => toast.success(t("campi_interclub.fatturazione.emessa")),
                          onError: (e) => segnala_errore("CampiInterClub", "Emissione fattura club ospite", e),
                        },
                      )
                    }
                  >
                    {t("campi_interclub.fatturazione.emetti")}
                  </Button>
                )}
              </div>
              {a.avviso && <p className="text-sm text-destructive">{a.avviso}</p>}
              {(a.righe ?? []).length > 0 && (
                <div className="text-sm divide-y border-t pt-2">
                  {(a.righe ?? []).map((r, i) => (
                    <div key={i} className="flex items-center justify-between py-1">
                      <span>
                        {r.descrizione} <span className="text-muted-foreground">• {r.atleta}</span>
                      </span>
                      <span className="font-mono">CHF {Number(r.importo ?? 0).toFixed(2)}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))
        )}
      </CardContent>
    </Card>
  );
};


// ── Tab 4: adesioni (matrice gruppo × club) ──────────────────
const TabAdesioni: React.FC<{ campo: EventoCampoInterClub }> = ({ campo }) => {
  const { t } = useTranslation("events");
  const { data: gruppi = [] } = use_campo_gruppi(campo.id);
  const { data: partecipanti = [] } = use_campo_partecipanti(campo.id);
  const { data: adesioni = [] } = use_campo_adesioni(campo.id);


  const colonne = useMemo(
    () => partecipanti.filter((p) => p.stato === "accettato"),
    [partecipanti],
  );
  const in_attesa = useMemo(() => partecipanti.filter((p) => p.stato === "invitato"), [partecipanti]);

  const chiave_colonna = (p: CampoClubPartecipante) => p.club_id ?? `esterno:${p.id}`;
  const nome_colonna = (p: CampoClubPartecipante) =>
    p.clubs?.nome || p.club_esterno_nome || t("campi_interclub.club.senza_nome");

  // Un club esterno non ha `club_id`: i suoi atleti ospiti sono anagrafati sotto il club
  // ospitante, quindi si contano per `club_provenienza`.
  const appartiene = (a: (typeof adesioni)[number], p: CampoClubPartecipante) =>
    p.club_id
      ? a.club_id === p.club_id
      : !!p.club_esterno_nome &&
        (a.atleta?.club_provenienza ?? "").trim().toLowerCase() === p.club_esterno_nome.trim().toLowerCase();

  const conta = (gruppo_id: string | null, p: CampoClubPartecipante) =>
    adesioni.filter((a) => a.campo_gruppo_id === gruppo_id && appartiene(a, p)).length;

  const righe = [...gruppi.map((g) => ({ id: g.id as string | null, nome: g.nome })), { id: null, nome: t("campi_interclub.adesioni.senza_gruppo") }];

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
                    <th key={chiave_colonna(p)} className="p-2 text-center whitespace-nowrap">
                      {nome_colonna(p)}
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
                      <td key={chiave_colonna(p)} className="p-2 text-center">
                        {conta(r.id, p)}
                      </td>
                    ))}
                    <td className="p-2 text-center font-semibold">{totale_riga(r.id)}</td>
                  </tr>
                ))}
                <tr className="font-semibold">
                  <td className="p-2">{t("campi_interclub.adesioni.totale")}</td>
                  {colonne.map((p) => (
                    <td key={chiave_colonna(p)} className="p-2 text-center">
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

      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t("campi_interclub.adesioni.in_attesa_title")}</CardTitle>
          <CardDescription>
            {t("campi_interclub.adesioni.in_attesa_desc", { count: in_attesa.length })}
          </CardDescription>
        </CardHeader>
        {in_attesa.length > 0 && (
          <CardContent className="flex flex-wrap gap-2">
            {in_attesa.map((p) => (
              <Badge key={p.id} variant="secondary">
                {nome_colonna(p)}
              </Badge>
            ))}
          </CardContent>
        )}
      </Card>
    </div>
  );
};

// ── Tab: iscrizioni atleti ───────────────────────────────────
const TabIscrizioniAtleti: React.FC<{ campo: EventoCampoInterClub; is_ospitante: boolean }> = ({
  campo,
  is_ospitante,
}) => {
  const { t } = useTranslation("events");
  const club_id = get_current_club_id();
  const { data: gruppi = [] } = use_campo_gruppi(campo.id);
  const { data: atleti = [] } = use_atleti();
  const { data: iscrizioni = [] } = use_campo_iscrizioni(campo.id);
  const toggle = use_toggle_iscrizione_campo();
  const aggiorna_gruppo = use_aggiorna_gruppo_iscrizione();
  const [ricerca, set_ricerca] = useState("");

  const per_atleta = useMemo(
    () => new Map(iscrizioni.map((i) => [i.atleta_id, i])),
    [iscrizioni],
  );

  const miei_atleti = useMemo(() => {
    const q = ricerca.trim().toLowerCase();
    return (atleti ?? [])
      .filter((a: any) => !q || `${a.cognome ?? ""} ${a.nome ?? ""}`.toLowerCase().includes(q))
      .sort((a: any, b: any) => `${a.cognome} ${a.nome}`.localeCompare(`${b.cognome} ${b.nome}`));
  }, [atleti, ricerca]);

  const altri_club = useMemo(
    () => iscrizioni.filter((i) => i.club_id && i.club_id !== club_id),
    [iscrizioni, club_id],
  );

  const nome_gruppo = (id: string | null) =>
    gruppi.find((g) => g.id === id)?.nome ?? t("campi_interclub.adesioni.senza_gruppo");

  const cambia_gruppo = (iscrizione_id: string, valore: string) =>
    aggiorna_gruppo.mutate(
      { id: iscrizione_id, campo_gruppo_id: valore === "nessuno" ? null : valore, evento_campo_id: campo.id },
      { onError: (e) => segnala_errore("CampiInterClub", "Aggiornamento gruppo iscrizione", e) },
    );

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t("campi_interclub.iscrizioni.title")}</CardTitle>
          <CardDescription>{t("campi_interclub.iscrizioni.description")}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <Input
            value={ricerca}
            onChange={(e) => set_ricerca(e.target.value)}
            placeholder={t("campi_interclub.iscrizioni.cerca_placeholder")}
          />
          {miei_atleti.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-6">{t("campi_interclub.iscrizioni.empty")}</p>
          ) : (
            <div className="space-y-2">
              {miei_atleti.map((a: any) => {
                const iscrizione = per_atleta.get(a.id);
                return (
                  <div key={a.id} className="flex flex-wrap items-center justify-between gap-3 p-3 border rounded-lg">
                    <div className="flex items-center gap-3">
                      <Checkbox
                        checked={!!iscrizione}
                        disabled={toggle.isPending}
                        onCheckedChange={() =>
                          toggle.mutate(
                            { evento_campo_id: campo.id, atleta_id: a.id, iscritto: !!iscrizione },
                            { onError: (e) => segnala_errore("CampiInterClub", "Iscrizione atleta al campo", e) },
                          )
                        }
                      />
                      <span className="font-medium">
                        {a.cognome} {a.nome}
                      </span>
                    </div>
                    {iscrizione && (
                      <Select
                        value={iscrizione.campo_gruppo_id ?? "nessuno"}
                        onValueChange={(v) => cambia_gruppo(iscrizione.id, v)}
                      >
                        <SelectTrigger className="w-56">
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
        </CardContent>
      </Card>

      {is_ospitante && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">{t("campi_interclub.iscrizioni.altri_title")}</CardTitle>
            <CardDescription>{t("campi_interclub.iscrizioni.altri_description")}</CardDescription>
          </CardHeader>
          <CardContent>
            {altri_club.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-6">
                {t("campi_interclub.iscrizioni.altri_empty")}
              </p>
            ) : (
              <div className="space-y-2">
                {altri_club.map((i) => (
                  <div key={i.id} className="flex flex-wrap items-center justify-between gap-3 p-3 border rounded-lg">
                    <span className="font-medium">
                      {i.atleta?.cognome || i.atleta?.nome
                        ? `${i.atleta?.cognome ?? ""} ${i.atleta?.nome ?? ""}`.trim()
                        : `${t("campi_interclub.iscrizioni.atleta")} ${i.atleta_id.slice(0, 8)}`}
                    </span>
                    <Select
                      value={i.campo_gruppo_id ?? "nessuno"}
                      onValueChange={(v) => cambia_gruppo(i.id, v)}
                    >
                      <SelectTrigger className="w-56">
                        <SelectValue placeholder={nome_gruppo(i.campo_gruppo_id)} />
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
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default CampiInterClubSection;
