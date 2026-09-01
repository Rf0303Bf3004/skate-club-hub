import React, { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase, get_current_club_id } from "@/lib/supabase";
import { use_atleti, use_istruttori, use_stagioni } from "@/hooks/use-supabase-data";
import {
  ComunicazioneFormSection,
  empty_comunicazione_state,
  invia_comunicazione_evento,
  default_titolo_gala,
  default_testo_gala,
  type ComunicazioneFormState,
} from "@/components/comunicazioni/ComunicazioneFormSection";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import CampiInterClubSection from "@/components/campi/CampiInterClubSection";
import NuovoEventoDialog, { type SceltaNuovoEvento } from "@/components/eventi/NuovoEventoDialog";
import {
  Tent,
  MapPin,
  Users,
  Calendar as CalendarIcon,
  Trash2,
  Plus,
  Send,
  ChevronRight,
  Sparkles,
  Clock,
  Pencil,
} from "lucide-react";
import { toast } from "sonner";
import { usePermessiAzione } from "@/hooks/use-permessi-azione";
import NotaPermesso from "@/components/common/NotaPermesso";
import ConfirmButton from "@/components/common/ConfirmButton";

type EventoCampo = {
  id: string;
  club_id: string;
  stagione_id: string | null;
  nome: string;
  modalita: string;
  data_inizio: string | null;
  data_fine: string | null;
  luogo: string | null;
  descrizione: string | null;
  costo: number | null;
  contatti: string | null;
  note: string | null;
  multi_club?: boolean | null;
};

type SessioneCampo = {
  id: string;
  evento_campo_id: string;
  data: string;
  ora_inizio: string;
  ora_fine: string;
  titolo: string;
  istruttore_id: string | null;
  note: string | null;
};

type IscrizioneEvento = {
  id: string;
  evento_campo_id: string;
  atleta_id: string;
  stato: string;
};

const fmt_date = (d: string | null) => {
  if (!d) return "—";
  return new Date(d + "T00:00:00").toLocaleDateString("de-CH", { day: "2-digit", month: "2-digit", year: "numeric" });
};

// ═══════════════════════════════════════════════════════════
// PAGINA EVENTI UNIFICATA
// ═══════════════════════════════════════════════════════════
const EventiPage = () => {
  const { t } = useTranslation("events");
  const { puo_gestire_sportivo } = usePermessiAzione();
  const club_id = get_current_club_id();
  const navigate = useNavigate();
  const [search_params, set_search_params] = useSearchParams();
  const [tab, setTab] = useState("campi");
  const [nuovo_open, set_nuovo_open] = useState(false);

  // richieste dal dialogo "+ Nuovo"
  const [apri_campo, set_apri_campo] = useState<null | { multi_club: boolean }>(null);
  const [apri_gala, set_apri_gala] = useState(false);
  const [campo_interclub_id, set_campo_interclub_id] = useState<string | null>(null);

  const { data: eventi = [] } = useQuery({
    queryKey: ["eventi_campi", club_id],
    enabled: !!club_id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("eventi_campi" as any)
        .select("*")
        .eq("club_id", club_id)
        .order("data_inizio", { ascending: false });
      if (error) throw error;
      return (data ?? []) as unknown as EventoCampo[];
    },
  });

  const eventi_interni = eventi.filter((e) => e.modalita === "interno");
  const eventi_esterni = eventi.filter((e) => e.modalita === "esterno");

  const gestisci_scelta = (scelta: SceltaNuovoEvento) => {
    if (scelta === "gara") {
      navigate("/gare");
      return;
    }
    if (scelta === "gala") {
      setTab("gala");
      set_apri_gala(true);
      return;
    }
    setTab("campi");
    set_apri_campo({ multi_club: scelta === "campo_interclub" });
  };

  // Apertura da link esterno: /eventi?nuovo=campo|campo_interclub|gala
  useEffect(() => {
    const nuovo = search_params.get("nuovo");
    if (!nuovo) return;
    gestisci_scelta(nuovo as SceltaNuovoEvento);
    search_params.delete("nuovo");
    set_search_params(search_params, { replace: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search_params]);

  const vai_a_inviti = (evento_id: string) => {
    set_campo_interclub_id(evento_id);
    setTab("interclub");
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-3xl font-bold text-primary flex items-center gap-3">
            <Tent className="w-8 h-8" /> {t("eventi_unificati.page_title", "Eventi")}
          </h1>
          <p className="text-muted-foreground mt-1">
            {t("eventi_unificati.page_subtitle", "Campi, stage, galà e spettacoli del club.")}
          </p>
        </div>
        {puo_gestire_sportivo ? (
          <Button size="lg" onClick={() => set_nuovo_open(true)}>
            <Plus className="w-5 h-5 mr-2" /> {t("eventi_unificati.new_button", "Nuovo")}
          </Button>
        ) : (
          <NotaPermesso testo="Non hai i permessi per creare nuovi eventi." />
        )}
      </div>

      <Tabs value={tab} onValueChange={setTab} className="space-y-4">
        <TabsList className="grid grid-cols-3 w-full">
          <TabsTrigger value="campi" className="gap-2">
            <Tent className="w-4 h-4" /> {t("eventi_unificati.tab_campi", "Campi e stage")}
          </TabsTrigger>
          <TabsTrigger value="gala" className="gap-2">
            <Sparkles className="w-4 h-4" /> {t("eventi_unificati.tab_gala", "Galà e spettacoli")}
          </TabsTrigger>
          <TabsTrigger value="interclub" className="gap-2">
            <Users className="w-4 h-4" /> {t("campi_interclub.tab_label")}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="campi" className="space-y-6">
          <CampoInternoSection
            eventi={eventi_interni}
            apri_nuovo={apri_campo}
            on_chiudi_nuovo={() => set_apri_campo(null)}
            on_vai_a_inviti={vai_a_inviti}
          />
          <CampoEsternoSection eventi={eventi_esterni} />
        </TabsContent>
        <TabsContent value="gala">
          <GalaSpettacoliSection apri_nuovo={apri_gala} on_chiudi_nuovo={() => set_apri_gala(false)} />
        </TabsContent>
        <TabsContent value="interclub">
          <CampiInterClubSection
            campo_iniziale_id={campo_interclub_id}
            on_campo_iniziale_aperto={() => set_campo_interclub_id(null)}
          />
        </TabsContent>
      </Tabs>

      <NuovoEventoDialog open={nuovo_open} onOpenChange={set_nuovo_open} on_scelta={gestisci_scelta} />
    </div>
  );
};

// ═══════════════════════════════════════════════════════════
// CAMPO INTERNO: mini-stagione con planning dedicato
// ═══════════════════════════════════════════════════════════
const CampoInternoSection: React.FC<{
  eventi: EventoCampo[];
  apri_nuovo?: null | { multi_club: boolean };
  on_chiudi_nuovo?: () => void;
  on_vai_a_inviti?: (evento_id: string) => void;
}> = ({ eventi, apri_nuovo, on_chiudi_nuovo, on_vai_a_inviti }) => {
  const { t } = useTranslation("events");
  const { puo_gestire_sportivo } = usePermessiAzione();
  const club_id = get_current_club_id();
  const qc = useQueryClient();
  const { data: stagioni = [] } = use_stagioni();
  const [open, setOpen] = useState(false);
  const [multi_club, set_multi_club] = useState(false);
  const [selected, setSelected] = useState<EventoCampo | null>(null);
  const [form, setForm] = useState({ nome: "", data_inizio: "", data_fine: "", luogo: "", descrizione: "", costo: "0", stagione_id: "" });

  useEffect(() => {
    if (apri_nuovo) {
      set_multi_club(apri_nuovo.multi_club);
      setSelected(null);
      setOpen(true);
    }
  }, [apri_nuovo]);

  const chiudi_dialog = (v: boolean) => {
    setOpen(v);
    if (!v) {
      set_multi_club(false);
      on_chiudi_nuovo?.();
    }
  };

  const create = useMutation({
    mutationFn: async () => {
      const payload: any = {
        club_id,
        nome: form.nome.trim() || t("campi_eventi.interno.name_placeholder_fallback"),
        modalita: "interno",
        data_inizio: form.data_inizio || null,
        data_fine: form.data_fine || null,
        luogo: form.luogo,
        descrizione: form.descrizione,
        costo: parseFloat(form.costo) || 0,
        stagione_id: form.stagione_id || null,
        multi_club,
      };
      const { data, error } = await supabase.from("eventi_campi" as any).insert(payload).select().single();
      if (error) throw error;
      return data as any;
    },
    onSuccess: (nuovo) => {
      qc.invalidateQueries({ queryKey: ["eventi_campi"] });
      qc.invalidateQueries({ queryKey: ["campi_interclub_ospitati"] });
      toast.success(t("campi_eventi.interno.created_toast"));
      const era_multi = multi_club;
      chiudi_dialog(false);
      setForm({ nome: "", data_inizio: "", data_fine: "", luogo: "", descrizione: "", costo: "0", stagione_id: "" });
      if (era_multi && nuovo?.id) on_vai_a_inviti?.(nuovo.id as string);
    },
    onError: (e: any) => toast.error(e.message),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("eventi_campi" as any).delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["eventi_campi"] });
      toast.success(t("campi_eventi.interno.deleted_toast"));
      setSelected(null);
    },
  });

  const abilita_interclub = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("eventi_campi" as any).update({ multi_club: true }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: (_d, id) => {
      qc.invalidateQueries({ queryKey: ["eventi_campi"] });
      qc.invalidateQueries({ queryKey: ["campi_interclub_ospitati"] });
      on_vai_a_inviti?.(id);
    },
    onError: (e: any) => toast.error(e.message),
  });

  if (selected) {
    return (
      <CampoInternoDettaglio
        evento={selected}
        onBack={() => setSelected(null)}
        onDelete={() => remove.mutate(selected.id)}
        on_aggiungi_club={puo_gestire_sportivo ? () => abilita_interclub.mutate(selected.id) : undefined}
        puo_gestire={puo_gestire_sportivo}
      />
    );
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <div>
          <CardTitle>{t("campi_eventi.interno.title")}</CardTitle>
          <CardDescription>{t("campi_eventi.interno.description")}</CardDescription>
        </div>
        {puo_gestire_sportivo && (
          <Button onClick={() => setOpen(true)}><Plus className="w-4 h-4 mr-2" /> {t("campi_eventi.interno.new_button")}</Button>
        )}
      </CardHeader>
      <CardContent>
        {!puo_gestire_sportivo && (
          <div className="mb-3"><NotaPermesso testo="Non hai i permessi per creare o modificare i campi interni." /></div>
        )}
        {eventi.length === 0 ? (
          <p className="text-sm text-muted-foreground py-8 text-center">{t("campi_eventi.interno.empty")}</p>
        ) : (
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
            {eventi.map((e) => (
              <Card key={e.id} className="cursor-pointer hover:border-primary transition-colors" onClick={() => setSelected(e)}>
                <CardHeader>
                  <CardTitle className="text-base flex items-center justify-between gap-2">
                    <span className="truncate">{e.nome}</span>
                    <Badge variant="secondary">
                      {e.multi_club ? t("eventi_unificati.badge_interclub", "Inter-club") : t("campi_eventi.interno.badge")}
                    </Badge>
                  </CardTitle>
                  <CardDescription>
                    {fmt_date(e.data_inizio)} → {fmt_date(e.data_fine)}
                  </CardDescription>
                </CardHeader>
                <CardContent className="text-sm space-y-1">
                  {e.luogo && <p className="text-muted-foreground"><MapPin className="w-3 h-3 inline mr-1" />{e.luogo}</p>}
                  {e.costo ? <p className="font-medium">CHF {Number(e.costo).toFixed(2)}</p> : null}
                  <Button variant="ghost" size="sm" className="mt-2 -mx-2"><ChevronRight className="w-4 h-4 ml-auto" /></Button>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </CardContent>

      <Dialog open={open} onOpenChange={chiudi_dialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {multi_club
                ? t("eventi_unificati.campo_interclub_dialog_title", "Nuovo campo con altri club")
                : t("campi_eventi.interno.dialog_title")}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div><Label>{t("campi_eventi.interno.name_label")}</Label><Input value={form.nome} onChange={(e) => setForm({ ...form, nome: e.target.value })} placeholder={t("campi_eventi.interno.name_placeholder")} /></div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>{t("campi_eventi.interno.start_date_label")}</Label><Input type="date" value={form.data_inizio} onChange={(e) => setForm({ ...form, data_inizio: e.target.value })} /></div>
              <div><Label>{t("campi_eventi.interno.end_date_label")}</Label><Input type="date" value={form.data_fine} onChange={(e) => setForm({ ...form, data_fine: e.target.value })} /></div>
            </div>
            <div><Label>{t("campi_eventi.interno.place_label")}</Label><Input value={form.luogo} onChange={(e) => setForm({ ...form, luogo: e.target.value })} /></div>
            <div><Label>{t("campi_eventi.interno.cost_label")}</Label><Input type="number" value={form.costo} onChange={(e) => setForm({ ...form, costo: e.target.value })} /></div>
            <div>
              <Label>{t("campi_eventi.interno.season_label")}</Label>
              <Select value={form.stagione_id} onValueChange={(v) => setForm({ ...form, stagione_id: v })}>
                <SelectTrigger><SelectValue placeholder={t("campi_eventi.interno.season_placeholder")} /></SelectTrigger>
                <SelectContent>
                  {stagioni.map((s: any) => <SelectItem key={s.id} value={s.id}>{s.nome}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div><Label>{t("campi_eventi.interno.description_label")}</Label><Textarea value={form.descrizione} onChange={(e) => setForm({ ...form, descrizione: e.target.value })} /></div>
            {multi_club && (
              <p className="text-xs text-muted-foreground">
                {t("eventi_unificati.campo_interclub_hint", "Dopo il salvataggio si apre la schermata per invitare i club ospiti.")}
              </p>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => chiudi_dialog(false)}>{t("campi_eventi.interno.cancel")}</Button>
            <Button onClick={() => create.mutate()} disabled={create.isPending}>{t("campi_eventi.interno.create")}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
};

// Dettaglio Campo Interno: planning, iscrizioni
const CampoInternoDettaglio: React.FC<{
  evento: EventoCampo;
  onBack: () => void;
  onDelete: () => void;
  on_aggiungi_club?: () => void;
  puo_gestire: boolean;
}> = ({ evento, onBack, onDelete, on_aggiungi_club, puo_gestire }) => {
  const { t } = useTranslation("events");
  const qc = useQueryClient();
  const { data: istruttori = [] } = use_istruttori();
  const { data: atleti = [] } = use_atleti();

  const { data: sessioni = [] } = useQuery({
    queryKey: ["sessioni_campo", evento.id],
    queryFn: async () => {
      const { data, error } = await supabase.from("sessioni_campo" as any).select("*").eq("evento_campo_id", evento.id).order("data").order("ora_inizio");
      if (error) throw error;
      return (data ?? []) as unknown as SessioneCampo[];
    },
  });

  const { data: iscrizioni = [] } = useQuery({
    queryKey: ["iscrizioni_eventi_campi", evento.id],
    queryFn: async () => {
      const { data, error } = await supabase.from("iscrizioni_eventi_campi" as any).select("*").eq("evento_campo_id", evento.id);
      if (error) throw error;
      return (data ?? []) as unknown as IscrizioneEvento[];
    },
  });

  const [openSess, setOpenSess] = useState(false);
  const [sessForm, setSessForm] = useState({ data: "", ora_inizio: "09:00", ora_fine: "11:00", titolo: "", istruttore_id: "", note: "" });

  const addSess = useMutation({
    mutationFn: async () => {
      const payload: any = { ...sessForm, evento_campo_id: evento.id, istruttore_id: sessForm.istruttore_id || null };
      const { error } = await supabase.from("sessioni_campo" as any).insert(payload);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["sessioni_campo", evento.id] });
      toast.success(t("campi_eventi.detail.session_added_toast"));
      setOpenSess(false);
      setSessForm({ data: "", ora_inizio: "09:00", ora_fine: "11:00", titolo: "", istruttore_id: "", note: "" });
    },
  });

  const delSess = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("sessioni_campo" as any).delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["sessioni_campo", evento.id] }),
  });

  const toggleIscr = useMutation({
    mutationFn: async ({ atleta_id, iscritto }: { atleta_id: string; iscritto: boolean }) => {
      if (iscritto) {
        const { error } = await supabase.from("iscrizioni_eventi_campi" as any).delete().eq("evento_campo_id", evento.id).eq("atleta_id", atleta_id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("iscrizioni_eventi_campi" as any).insert({ evento_campo_id: evento.id, atleta_id });
        if (error) throw error;
      }
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["iscrizioni_eventi_campi", evento.id] }),
  });

  const iscritti_ids = new Set(iscrizioni.map((i) => i.atleta_id));

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <Button variant="ghost" onClick={onBack}>{t("campi_eventi.detail.back")}</Button>
          <h2 className="text-2xl font-bold mt-2">{evento.nome}</h2>
          <p className="text-sm text-muted-foreground">{fmt_date(evento.data_inizio)} → {fmt_date(evento.data_fine)} {evento.luogo && `• ${evento.luogo}`}</p>
        </div>
        <div className="flex gap-2">
          {puo_gestire && on_aggiungi_club && (
            <Button variant="outline" size="sm" onClick={on_aggiungi_club}>
              <Users className="w-4 h-4 mr-2" />
              {evento.multi_club
                ? t("eventi_unificati.gestisci_club", "Gestisci club invitati")
                : t("eventi_unificati.aggiungi_club", "Aggiungi altri club")}
            </Button>
          )}
          {puo_gestire && (
            <ConfirmButton
              titolo={`Eliminare l'evento "${evento.nome}"?`}
              descrizione="Questa azione elimina anche le sessioni e le iscrizioni collegate."
              conferma_label="Elimina evento"
              on_conferma={onDelete}
            >
              <Button variant="destructive" size="sm">
                <Trash2 className="w-4 h-4 mr-2" /> {t("campi_eventi.detail.delete_button")}
              </Button>
            </ConfirmButton>
          )}
        </div>
      </div>
      {!puo_gestire && (
        <NotaPermesso testo="Non hai i permessi per modificare questo campo, le sue sessioni o le iscrizioni club." />
      )}

      <div className="grid lg:grid-cols-2 gap-4">
        {/* Planning sessioni */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <div><CardTitle className="text-base">{t("campi_eventi.detail.planning_title")}</CardTitle><CardDescription>{t("campi_eventi.detail.planning_desc", { count: sessioni.length })}</CardDescription></div>
            {puo_gestire && (
              <Button size="sm" onClick={() => setOpenSess(true)}><Plus className="w-4 h-4 mr-1" /> {t("campi_eventi.detail.session_button")}</Button>
            )}
          </CardHeader>
          <CardContent>
            {sessioni.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">{t("campi_eventi.detail.no_sessions")}</p>
            ) : (
              <div className="space-y-2">
                {sessioni.map((s) => {
                  const istr = istruttori.find((i: any) => i.id === s.istruttore_id);
                  return (
                    <div key={s.id} className="flex items-center justify-between p-3 rounded-md border bg-muted/30">
                      <div className="text-sm">
                        <p className="font-medium">{s.titolo || t("campi_eventi.detail.session_default_title")} • {fmt_date(s.data)}</p>
                        <p className="text-xs text-muted-foreground">{s.ora_inizio?.slice(0, 5)}–{s.ora_fine?.slice(0, 5)} {istr && `• ${istr.nome} ${istr.cognome}`}</p>
                      </div>
                      {puo_gestire && (
                        <ConfirmButton
                          titolo={`Eliminare la sessione "${s.titolo || t("campi_eventi.detail.session_default_title")}"?`}
                          conferma_label="Elimina sessione"
                          on_conferma={() => delSess.mutate(s.id)}
                        >
                          <Button variant="ghost" size="icon"><Trash2 className="w-4 h-4 text-destructive" /></Button>
                        </ConfirmButton>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Iscrizioni atleti */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">{t("campi_eventi.detail.enrollments_title")}</CardTitle>
            <CardDescription>{t("campi_eventi.detail.enrollments_desc", { count: iscritti_ids.size, total: atleti.length })}</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="max-h-96 overflow-y-auto space-y-1">
              {atleti.map((a: any) => {
                const isc = iscritti_ids.has(a.id);
                return (
                  <div key={a.id} className="flex items-center justify-between p-2 rounded hover:bg-muted/50">
                    <span className="text-sm">{a.cognome} {a.nome}</span>
                    <Button
                      size="sm"
                      variant={isc ? "default" : "outline"}
                      disabled={!puo_gestire}
                      onClick={() => puo_gestire && toggleIscr.mutate({ atleta_id: a.id, iscritto: isc })}
                    >
                      {isc ? t("campi_eventi.detail.enrolled") : t("campi_eventi.detail.enroll")}
                    </Button>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      </div>

      <Dialog open={openSess} onOpenChange={setOpenSess}>
        <DialogContent>
          <DialogHeader><DialogTitle>{t("campi_eventi.detail.session_dialog_title")}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div><Label>{t("campi_eventi.detail.session_title_label")}</Label><Input value={sessForm.titolo} onChange={(e) => setSessForm({ ...sessForm, titolo: e.target.value })} placeholder={t("campi_eventi.detail.session_title_placeholder")} /></div>
            <div><Label>{t("campi_eventi.detail.date_label")}</Label><Input type="date" value={sessForm.data} onChange={(e) => setSessForm({ ...sessForm, data: e.target.value })} /></div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>{t("campi_eventi.detail.start_time_label")}</Label><Input type="time" value={sessForm.ora_inizio} onChange={(e) => setSessForm({ ...sessForm, ora_inizio: e.target.value })} /></div>
              <div><Label>{t("campi_eventi.detail.end_time_label")}</Label><Input type="time" value={sessForm.ora_fine} onChange={(e) => setSessForm({ ...sessForm, ora_fine: e.target.value })} /></div>
            </div>
            <div>
              <Label>{t("campi_eventi.detail.instructor_label")}</Label>
              <Select value={sessForm.istruttore_id} onValueChange={(v) => setSessForm({ ...sessForm, istruttore_id: v })}>
                <SelectTrigger><SelectValue placeholder={t("campi_eventi.detail.instructor_placeholder")} /></SelectTrigger>
                <SelectContent>
                  {istruttori.map((i: any) => <SelectItem key={i.id} value={i.id}>{i.nome} {i.cognome}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div><Label>{t("campi_eventi.detail.notes_label")}</Label><Textarea value={sessForm.note} onChange={(e) => setSessForm({ ...sessForm, note: e.target.value })} /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpenSess(false)}>{t("campi_eventi.detail.cancel")}</Button>
            <Button onClick={() => addSess.mutate()} disabled={!sessForm.data || addSess.isPending}>{t("campi_eventi.detail.add")}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

// ═══════════════════════════════════════════════════════════
// CAMPO ESTERNO: scheda info + comunicazione famiglie
// ═══════════════════════════════════════════════════════════
const CampoEsternoSection: React.FC<{ eventi: EventoCampo[] }> = ({ eventi }) => {
  const { t } = useTranslation("events");
  const { puo_gestire_sportivo } = usePermessiAzione();
  const club_id = get_current_club_id();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ nome: "", data_inizio: "", data_fine: "", luogo: "", descrizione: "", costo: "0", contatti: "" });

  const create = useMutation({
    mutationFn: async () => {
      const payload: any = {
        club_id,
        nome: form.nome.trim() || t("campi_eventi.esterno.name_placeholder_fallback"),
        modalita: "esterno",
        data_inizio: form.data_inizio || null,
        data_fine: form.data_fine || null,
        luogo: form.luogo,
        descrizione: form.descrizione,
        costo: parseFloat(form.costo) || 0,
        contatti: form.contatti,
      };
      const { error } = await supabase.from("eventi_campi" as any).insert(payload);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["eventi_campi"] });
      toast.success(t("campi_eventi.esterno.created_toast"));
      setOpen(false);
      setForm({ nome: "", data_inizio: "", data_fine: "", luogo: "", descrizione: "", costo: "0", contatti: "" });
    },
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("eventi_campi" as any).delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["eventi_campi"] }),
  });

  const inviaComunicazione = useMutation({
    mutationFn: async (e: EventoCampo) => {
      const titolo = t("campi_eventi.esterno.communication_title_prefix", { name: e.nome });
      const testo = [
        t("campi_eventi.esterno.communication_intro"),
        ``,
        t("campi_eventi.esterno.communication_place_label", { place: e.luogo || "—" }),
        t("campi_eventi.esterno.communication_dates_label", { start: fmt_date(e.data_inizio), end: fmt_date(e.data_fine) }),
        e.costo ? t("campi_eventi.esterno.communication_cost_label", { cost: Number(e.costo).toFixed(2) }) : ``,
        e.contatti ? t("campi_eventi.esterno.communication_contacts_label", { contacts: e.contatti }) : ``,
        ``,
        e.descrizione || ``,
      ].filter(Boolean).join("\n");

      const { error } = await supabase.from("comunicazioni").insert({
        club_id,
        titolo,
        testo,
        corpo: testo,
        tipo: "evento",
        tipo_destinatari: "tutti",
      } as any);
      if (error) throw error;
    },
    onSuccess: () => toast.success(t("campi_eventi.esterno.communication_sent_toast")),
    onError: (err: any) => toast.error(err.message),
  });

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <div>
          <CardTitle>{t("campi_eventi.esterno.title")}</CardTitle>
          <CardDescription>{t("campi_eventi.esterno.description")}</CardDescription>
        </div>
        {puo_gestire_sportivo && (
          <Button onClick={() => setOpen(true)}><Plus className="w-4 h-4 mr-2" /> {t("campi_eventi.esterno.new_button")}</Button>
        )}
      </CardHeader>
      <CardContent>
        {!puo_gestire_sportivo && (
          <div className="mb-3"><NotaPermesso testo="Non hai i permessi per creare o eliminare campi esterni." /></div>
        )}
        {eventi.length === 0 ? (
          <p className="text-sm text-muted-foreground py-8 text-center">{t("campi_eventi.esterno.empty")}</p>
        ) : (
          <div className="space-y-3">
            {eventi.map((e) => (
              <Card key={e.id}>
                <CardContent className="p-4 flex flex-col md:flex-row md:items-center gap-4">
                  <div className="flex-1 space-y-1">
                    <div className="flex items-center gap-2">
                      <h3 className="font-semibold">{e.nome}</h3>
                      <Badge variant="outline">{t("campi_eventi.esterno.badge")}</Badge>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      <CalendarIcon className="w-3 h-3 inline mr-1" />{fmt_date(e.data_inizio)} → {fmt_date(e.data_fine)}
                      {e.luogo && <> • <MapPin className="w-3 h-3 inline" /> {e.luogo}</>}
                    </p>
                    {e.descrizione && <p className="text-sm">{e.descrizione}</p>}
                    {e.costo ? <p className="text-sm font-medium">CHF {Number(e.costo).toFixed(2)}</p> : null}
                    {e.contatti && <p className="text-xs text-muted-foreground">📞 {e.contatti}</p>}
                  </div>
                  <div className="flex gap-2">
                    <Button size="sm" variant="outline" onClick={() => inviaComunicazione.mutate(e)}>
                      <Send className="w-4 h-4 mr-1" /> {t("campi_eventi.esterno.send_communication_button")}
                    </Button>
                    {puo_gestire_sportivo && (
                      <ConfirmButton
                        titolo={`Eliminare il campo "${e.nome}"?`}
                        conferma_label="Elimina campo"
                        on_conferma={() => remove.mutate(e.id)}
                      >
                        <Button size="sm" variant="ghost">
                          <Trash2 className="w-4 h-4 text-destructive" />
                        </Button>
                      </ConfirmButton>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </CardContent>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>{t("campi_eventi.esterno.dialog_title")}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div><Label>{t("campi_eventi.esterno.name_label")}</Label><Input value={form.nome} onChange={(e) => setForm({ ...form, nome: e.target.value })} placeholder={t("campi_eventi.esterno.name_placeholder")} /></div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>{t("campi_eventi.esterno.start_date_label")}</Label><Input type="date" value={form.data_inizio} onChange={(e) => setForm({ ...form, data_inizio: e.target.value })} /></div>
              <div><Label>{t("campi_eventi.esterno.end_date_label")}</Label><Input type="date" value={form.data_fine} onChange={(e) => setForm({ ...form, data_fine: e.target.value })} /></div>
            </div>
            <div><Label>{t("campi_eventi.esterno.place_label")}</Label><Input value={form.luogo} onChange={(e) => setForm({ ...form, luogo: e.target.value })} /></div>
            <div><Label>{t("campi_eventi.esterno.cost_label")}</Label><Input type="number" value={form.costo} onChange={(e) => setForm({ ...form, costo: e.target.value })} /></div>
            <div><Label>{t("campi_eventi.esterno.contacts_label")}</Label><Input value={form.contatti} onChange={(e) => setForm({ ...form, contatti: e.target.value })} placeholder={t("campi_eventi.esterno.contacts_placeholder")} /></div>
            <div><Label>{t("campi_eventi.esterno.description_label")}</Label><Textarea value={form.descrizione} onChange={(e) => setForm({ ...form, descrizione: e.target.value })} /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>{t("campi_eventi.esterno.cancel")}</Button>
            <Button onClick={() => create.mutate()} disabled={create.isPending}>{t("campi_eventi.esterno.create")}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
};

// ═══════════════════════════════════════════════════════════
// GALÀ & SPETTACOLI: eventi_straordinari + workflow unificato
// ═══════════════════════════════════════════════════════════
type EventoStraordinario = {
  id: string;
  club_id: string;
  stagione_id: string | null;
  titolo: string;
  tipo: string;
  data: string;
  ora_inizio: string | null;
  ora_fine: string | null;
  luogo: string | null;
  descrizione: string | null;
};

const TIPI_EVENTO = ["gala", "saggio", "spettacolo", "festa", "altro"] as const;

const GalaSpettacoliSection: React.FC<{ apri_nuovo?: boolean; on_chiudi_nuovo?: () => void }> = ({
  apri_nuovo,
  on_chiudi_nuovo,
}) => {
  const { t } = useTranslation("events");
  const { puo_gestire_sportivo } = usePermessiAzione();
  const TIPI_EVENTO_LABEL: Record<string, string> = {
    gala: t("campi_eventi.gala.type_gala"),
    saggio: t("campi_eventi.gala.type_saggio"),
    spettacolo: t("campi_eventi.gala.type_spettacolo"),
    festa: t("campi_eventi.gala.type_festa"),
    altro: t("campi_eventi.gala.type_altro"),
  };
  const club_id = get_current_club_id();
  const qc = useQueryClient();
  const { data: stagioni = [] } = use_stagioni();
  const { data: atleti_lista = [] } = use_atleti();
  const [open, setOpen] = useState(false);
  const [editing_id, set_editing_id] = useState<string | null>(null);
  const [form, setForm] = useState({
    titolo: "",
    tipo_evento: "gala" as string,
    tipo_evento_altro: "",
    data: "",
    ora_inizio: "",
    ora_fine: "",
    luogo: "",
    descrizione: "",
    stagione_id: "",
  });
  const [com_state, set_com_state] = useState<ComunicazioneFormState>(() => empty_comunicazione_state());
  const [com_touched, set_com_touched] = useState(false);

  const corsi_lista_q = useQuery({
    queryKey: ["corsi_attivi_per_com", club_id],
    enabled: !!club_id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("corsi")
        .select("id, nome")
        .eq("club_id", club_id)
        .eq("attivo", true)
        .order("nome");
      if (error) throw error;
      return data ?? [];
    },
  });

  const { data: eventi = [] } = useQuery({
    queryKey: ["eventi_straordinari_gala", club_id],
    enabled: !!club_id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("eventi_straordinari")
        .select("*")
        .eq("club_id", club_id)
        .order("data", { ascending: false });
      if (error) throw error;
      return (data ?? []) as unknown as EventoStraordinario[];
    },
  });

  // Auto-sync comunicazione precompilata (solo in creazione)
  React.useEffect(() => {
    if (com_touched || editing_id) return;
    set_com_state((p) => ({
      ...p,
      titolo: default_titolo_gala(form.titolo),
      testo: default_testo_gala(form.titolo, form.data, form.ora_inizio || null, form.luogo || null),
    }));
  }, [form.titolo, form.data, form.ora_inizio, form.luogo, com_touched, editing_id]);

  const handle_com_change = (next: ComunicazioneFormState) => {
    if (next.titolo !== com_state.titolo || next.testo !== com_state.testo) set_com_touched(true);
    set_com_state(next);
  };

  const reset_form = () => {
    set_editing_id(null);
    setForm({
      titolo: "", tipo_evento: "gala", tipo_evento_altro: "",
      data: "", ora_inizio: "", ora_fine: "", luogo: "", descrizione: "",
      stagione_id: "",
    });
    set_com_state(empty_comunicazione_state());
    set_com_touched(false);
  };

  useEffect(() => {
    if (apri_nuovo) {
      reset_form();
      setOpen(true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [apri_nuovo]);

  const chiudi_dialog = (v: boolean) => {
    setOpen(v);
    if (!v) {
      reset_form();
      on_chiudi_nuovo?.();
    }
  };

  const apri_modifica = (e: EventoStraordinario) => {
    const noto = (TIPI_EVENTO as readonly string[]).includes(e.tipo);
    set_editing_id(e.id);
    setForm({
      titolo: e.titolo ?? "",
      tipo_evento: noto ? e.tipo : "altro",
      tipo_evento_altro: noto ? "" : (e.tipo ?? ""),
      data: e.data ?? "",
      ora_inizio: e.ora_inizio?.slice(0, 5) ?? "",
      ora_fine: e.ora_fine?.slice(0, 5) ?? "",
      luogo: e.luogo ?? "",
      descrizione: e.descrizione ?? "",
      stagione_id: e.stagione_id ?? "",
    });
    set_com_state(empty_comunicazione_state());
    set_com_touched(false);
    setOpen(true);
  };

  const save = useMutation({
    mutationFn: async () => {
      if (!form.titolo.trim() || !form.data) throw new Error(t("campi_eventi.gala.missing_fields_error"));
      const tipo_finale = form.tipo_evento === "altro" && form.tipo_evento_altro.trim()
        ? form.tipo_evento_altro.trim().toLowerCase()
        : form.tipo_evento;

      const payload: any = {
        club_id,
        titolo: form.titolo.trim(),
        tipo: tipo_finale,
        data: form.data,
        ora_inizio: form.ora_inizio || null,
        ora_fine: form.ora_fine || null,
        luogo: form.luogo,
        descrizione: form.descrizione,
        stagione_id: form.stagione_id || null,
      };

      if (editing_id) {
        const { error } = await supabase.from("eventi_straordinari").update(payload).eq("id", editing_id);
        if (error) throw error;
        return;
      }

      const { data: nuovo, error } = await supabase
        .from("eventi_straordinari")
        .insert(payload)
        .select()
        .single();
      if (error) throw error;

      if (com_state.invia && nuovo) {
        await invia_comunicazione_evento(supabase, {
          club_id: club_id!,
          state: com_state,
          fk: { evento_straordinario_id: (nuovo as any).id },
        });
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["eventi_straordinari_gala"] });
      qc.invalidateQueries({ queryKey: ["eventi_straordinari"] });
      qc.invalidateQueries({ queryKey: ["comunicazioni"] });
      toast.success(
        editing_id
          ? t("eventi_unificati.gala_updated_toast", "Evento aggiornato")
          : com_state.invia
            ? t("campi_eventi.gala.created_toast_with_comm")
            : t("campi_eventi.gala.created_toast"),
      );
      chiudi_dialog(false);
    },
    onError: (e: any) => toast.error(e.message),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      await supabase.from("iscrizioni_eventi" as any).delete().eq("evento_id", id);
      const { error } = await supabase.from("eventi_straordinari").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["eventi_straordinari_gala"] });
      toast.success(t("campi_eventi.gala.deleted_toast"));
    },
    onError: (e: any) => toast.error(e.message),
  });

  const componi_testo_post = (e: EventoStraordinario) => ({
    titolo: default_titolo_gala(e.titolo),
    testo: default_testo_gala(e.titolo, e.data, e.ora_inizio, e.luogo),
  });

  const invia_comunicazione_post = useMutation({
    mutationFn: async (e: EventoStraordinario) => {
      const { titolo, testo } = componi_testo_post(e);
      const { error } = await supabase.from("comunicazioni").insert({
        club_id,
        titolo,
        testo,
        corpo: testo,
        tipo: "evento",
        tipo_destinatari: "tutti",
        evento_straordinario_id: e.id,
        stato: "inviata",
        inviata_at: new Date().toISOString(),
      } as any);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["comunicazioni"] });
      toast.success(t("campi_eventi.gala.post_comm_sent_toast"));
    },
    onError: (err: any) => toast.error(err.message),
  });

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <div>
          <CardTitle>{t("campi_eventi.gala.title")}</CardTitle>
          <CardDescription>{t("campi_eventi.gala.description")}</CardDescription>
        </div>
        {puo_gestire_sportivo && (
          <Button onClick={() => { reset_form(); setOpen(true); }}><Plus className="w-4 h-4 mr-2" /> {t("campi_eventi.gala.new_button")}</Button>
        )}
      </CardHeader>
      <CardContent>
        {!puo_gestire_sportivo && (
          <div className="mb-3"><NotaPermesso testo="Non hai i permessi per creare, modificare o eliminare eventi." /></div>
        )}
        {eventi.length === 0 ? (
          <p className="text-sm text-muted-foreground py-8 text-center">{t("campi_eventi.gala.empty")}</p>
        ) : (
          <div className="space-y-3">
            {eventi.map((e) => (
              <Card key={e.id}>
                <CardContent className="p-4 flex flex-col md:flex-row md:items-center gap-4">
                  <div className="flex-1 space-y-1">
                    <div className="flex items-center gap-2">
                      <h3 className="font-semibold">{e.titolo}</h3>
                      <Badge variant="secondary"><Sparkles className="w-3 h-3 mr-1" /> {TIPI_EVENTO_LABEL[e.tipo] ?? e.tipo}</Badge>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      <CalendarIcon className="w-3 h-3 inline mr-1" />{fmt_date(e.data)}
                      {e.ora_inizio && <> • <Clock className="w-3 h-3 inline" /> {e.ora_inizio.slice(0, 5)}{e.ora_fine ? `–${e.ora_fine.slice(0, 5)}` : ""}</>}
                      {e.luogo && <> • <MapPin className="w-3 h-3 inline" /> {e.luogo}</>}
                    </p>
                    {e.descrizione && <p className="text-sm">{e.descrizione}</p>}
                  </div>
                  <div className="flex gap-2">
                    {puo_gestire_sportivo && (
                      <Button size="sm" variant="outline" onClick={() => apri_modifica(e)}>
                        <Pencil className="w-4 h-4 mr-1" /> {t("eventi_unificati.edit", "Modifica")}
                      </Button>
                    )}
                    <Button size="sm" variant="outline" onClick={() => invia_comunicazione_post.mutate(e)} disabled={invia_comunicazione_post.isPending}>
                      <Send className="w-4 h-4 mr-1" /> {t("campi_eventi.gala.communicate_button")}
                    </Button>
                    {puo_gestire_sportivo && (
                      <ConfirmButton
                        titolo={`Eliminare l'evento "${e.titolo}"?`}
                        conferma_label="Elimina evento"
                        on_conferma={() => remove.mutate(e.id)}
                      >
                        <Button size="sm" variant="ghost">
                          <Trash2 className="w-4 h-4 text-destructive" />
                        </Button>
                      </ConfirmButton>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </CardContent>

      <Dialog open={open} onOpenChange={chiudi_dialog}>
        <DialogContent className="max-h-[85vh] overflow-y-auto max-w-xl">
          <DialogHeader>
            <DialogTitle>
              {editing_id ? t("eventi_unificati.gala_edit_title", "Modifica evento") : t("campi_eventi.gala.dialog_title")}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div><Label>{t("campi_eventi.gala.title_label")}</Label><Input value={form.titolo} onChange={(e) => setForm({ ...form, titolo: e.target.value })} placeholder={t("campi_eventi.gala.title_placeholder")} /></div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>{t("campi_eventi.gala.event_type_label")}</Label>
                <Select value={form.tipo_evento} onValueChange={(v) => setForm({ ...form, tipo_evento: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {TIPI_EVENTO.map((tp) => (
                      <SelectItem key={tp} value={tp}>{TIPI_EVENTO_LABEL[tp]}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              {form.tipo_evento === "altro" && (
                <div>
                  <Label>{t("campi_eventi.gala.other_type_label")}</Label>
                  <Input value={form.tipo_evento_altro} onChange={(e) => setForm({ ...form, tipo_evento_altro: e.target.value })} placeholder={t("campi_eventi.gala.other_type_placeholder")} />
                </div>
              )}
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div><Label>{t("campi_eventi.gala.date_label")}</Label><Input type="date" value={form.data} onChange={(e) => setForm({ ...form, data: e.target.value })} /></div>
              <div><Label>{t("campi_eventi.gala.start_time_label")}</Label><Input type="time" value={form.ora_inizio} onChange={(e) => setForm({ ...form, ora_inizio: e.target.value })} /></div>
              <div><Label>{t("campi_eventi.gala.end_time_label")}</Label><Input type="time" value={form.ora_fine} onChange={(e) => setForm({ ...form, ora_fine: e.target.value })} /></div>
            </div>
            <div><Label>{t("campi_eventi.gala.place_label")}</Label><Input value={form.luogo} onChange={(e) => setForm({ ...form, luogo: e.target.value })} placeholder={t("campi_eventi.gala.place_placeholder")} /></div>
            <div>
              <Label>{t("campi_eventi.gala.season_label")}</Label>
              <Select value={form.stagione_id} onValueChange={(v) => setForm({ ...form, stagione_id: v })}>
                <SelectTrigger><SelectValue placeholder={t("campi_eventi.gala.season_placeholder")} /></SelectTrigger>
                <SelectContent>
                  {stagioni.map((s: any) => <SelectItem key={s.id} value={s.id}>{s.nome}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div><Label>{t("campi_eventi.gala.description_label")}</Label><Textarea value={form.descrizione} onChange={(e) => setForm({ ...form, descrizione: e.target.value })} placeholder={t("campi_eventi.gala.description_placeholder")} /></div>

            {!editing_id && (
              <ComunicazioneFormSection
                state={com_state}
                onChange={handle_com_change}
                corsi={(corsi_lista_q.data ?? []).map((c: any) => ({ id: c.id, label: c.nome }))}
                atleti={atleti_lista.map((a: any) => ({
                  id: a.id,
                  label: `${a.cognome} ${a.nome}`,
                  livello: a.carriera_artistica || a.carriera_stile || a.livello_attuale || "Pulcini",
                }))}
              />
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => chiudi_dialog(false)}>{t("campi_eventi.gala.cancel")}</Button>
            <Button
              onClick={() => save.mutate()}
              disabled={save.isPending || !form.titolo.trim() || !form.data || (form.tipo_evento === "altro" && !form.tipo_evento_altro.trim())}
            >
              {editing_id
                ? t("eventi_unificati.save", "Salva")
                : com_state.invia
                  ? <><Send className="w-4 h-4 mr-1" /> {t("campi_eventi.gala.create_and_communicate")}</>
                  : t("campi_eventi.gala.create")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
};

export default EventiPage;
