import React from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/auth";
import { use_club } from "@/hooks/use-supabase-data";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { FileText, Plus, Pencil, Trash2, RotateCcw, FileEdit } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { PacchettoFormDialog, type PacchettoFormValues } from "@/components/sponsor/PacchettoFormDialog";
import { PitchTextEditorDialog, type SezionePitch } from "@/components/sponsor/PitchTextEditorDialog";
import { PitchPDFPreview } from "@/components/sponsor/PitchPDFPreview";
import { useKpiPitch } from "@/lib/kpiPitch";
import { format_chf, type PitchData, type PacchettoSponsor } from "@/lib/pitchPDF";

const SEZIONI: SezionePitch[] = ["intro", "storia", "audience", "call_to_action", "contatti"];

export default function PacchettiSponsorPage() {
  const { session } = useAuth();
  const club_id = session?.club_id;
  const qc = useQueryClient();
  const { data: club } = use_club();

  const { data: pacchetti = [] } = useQuery({
    queryKey: ["pacchetti_sponsor", club_id],
    enabled: !!club_id,
    queryFn: async () => {
      const { data } = await supabase
        .from("pacchetti_sponsor" as any)
        .select("*")
        .eq("club_id", club_id)
        .order("ordine", { ascending: true });
      return (data ?? []) as any[];
    },
  });

  const { data: overrides_rows = [] } = useQuery({
    queryKey: ["pitch_overrides", club_id],
    enabled: !!club_id,
    queryFn: async () => {
      const { data } = await supabase
        .from("pitch_template_overrides" as any)
        .select("sezione, testo")
        .eq("club_id", club_id);
      return (data ?? []) as any[];
    },
  });

  const overrides_map = React.useMemo(() => {
    const m: Record<SezionePitch, string> = { intro: "", storia: "", audience: "", call_to_action: "", contatti: "" };
    for (const r of overrides_rows) if (SEZIONI.includes(r.sezione)) m[r.sezione as SezionePitch] = r.testo ?? "";
    return m;
  }, [overrides_rows]);

  const { data: identity } = useQuery({
    queryKey: ["club_identity_pitch", club_id],
    enabled: !!club_id,
    queryFn: async () => {
      const { data } = await supabase.from("club_identity").select("*").eq("club_id", club_id).maybeSingle();
      return data;
    },
  });

  const { data: categorie_target = [] } = useQuery({
    queryKey: ["sponsor_categorie_cercate", club_id],
    enabled: !!club_id,
    queryFn: async () => {
      const { data } = await supabase
        .from("sponsor_categorie_cercate" as any)
        .select("categoria")
        .eq("club_id", club_id);
      return ((data ?? []) as any[]).map((r) => r.categoria as string).filter(Boolean);
    },
  });

  // Conteggio posti occupati per pacchetto (sponsor attivi collegati)
  const { data: posti_per_pacchetto = {} } = useQuery({
    queryKey: ["sponsor_posti_per_pacchetto", club_id],
    enabled: !!club_id,
    queryFn: async () => {
      const { data } = await supabase
        .from("sponsor" as any)
        .select("pacchetto_id")
        .eq("club_id", club_id)
        .eq("attivo", true);
      const m: Record<string, number> = {};
      for (const r of (data ?? []) as any[]) {
        if (r.pacchetto_id) m[r.pacchetto_id] = (m[r.pacchetto_id] ?? 0) + 1;
      }
      return m;
    },
  });

  const kpi_q = useKpiPitch(club_id);

  const [dlg_open, set_dlg_open] = React.useState(false);
  const [dlg_initial, set_dlg_initial] = React.useState<Partial<PacchettoFormValues> | undefined>(undefined);
  const [text_open, set_text_open] = React.useState(false);
  const [pdf_open, set_pdf_open] = React.useState(false);

  const upsert_mut = useMutation({
    mutationFn: async (v: PacchettoFormValues) => {
      const benefits = v.benefits_text.split("\n").map((s) => s.trim()).filter(Boolean);
      const payload: any = {
        club_id,
        livello: v.livello.trim(),
        nome_visualizzato: v.nome_visualizzato.trim(),
        prezzo_annuo: v.prezzo_annuo,
        ordine: v.ordine,
        colore_brand: v.colore_brand,
        benefits,
        max_sponsor_disponibili: v.max_sponsor_disponibili,
        attivo: v.attivo,
      };
      if (v.id) {
        const { error } = await supabase.from("pacchetti_sponsor" as any).update(payload).eq("id", v.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("pacchetti_sponsor" as any).insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["pacchetti_sponsor", club_id] });
      set_dlg_open(false);
      toast({ title: "Pacchetto salvato" });
    },
    onError: (e: any) => toast({ title: "Errore", description: e.message, variant: "destructive" }),
  });

  const toggle_mut = useMutation({
    mutationFn: async ({ id, attivo }: { id: string; attivo: boolean }) => {
      const { error } = await supabase.from("pacchetti_sponsor" as any).update({ attivo }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["pacchetti_sponsor", club_id] }),
  });

  const del_mut = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("pacchetti_sponsor" as any).delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["pacchetti_sponsor", club_id] });
      toast({ title: "Pacchetto eliminato" });
    },
  });

  const reset_mut = useMutation({
    mutationFn: async () => {
      const { error: e1 } = await supabase.from("pacchetti_sponsor" as any).delete().eq("club_id", club_id);
      if (e1) throw e1;
      const { error: e2 } = await supabase.rpc("seed_pacchetti_sponsor_default" as any, { p_club_id: club_id });
      if (e2) throw e2;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["pacchetti_sponsor", club_id] });
      toast({ title: "Pacchetti ripristinati ai default" });
    },
    onError: (e: any) => toast({ title: "Errore", description: e.message, variant: "destructive" }),
  });

  const save_overrides_mut = useMutation({
    mutationFn: async (v: Record<SezionePitch, string>) => {
      const rows = SEZIONI.map((s) => ({ club_id, sezione: s, testo: v[s] ?? "" }));
      const { error } = await supabase.from("pitch_template_overrides" as any).upsert(rows, { onConflict: "club_id,sezione" });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["pitch_overrides", club_id] });
      set_text_open(false);
      toast({ title: "Testi salvati" });
    },
    onError: (e: any) => toast({ title: "Errore", description: e.message, variant: "destructive" }),
  });

  const pitch_data: PitchData | null = React.useMemo(() => {
    if (!club) return null;
    const pacchetti_pdf: PacchettoSponsor[] = (pacchetti as any[]).map((p) => ({
      id: p.id,
      livello: p.livello,
      nome_visualizzato: p.nome_visualizzato,
      prezzo_annuo: Number(p.prezzo_annuo),
      ordine: p.ordine,
      colore_brand: p.colore_brand,
      benefits: Array.isArray(p.benefits) ? p.benefits : [],
      max_sponsor_disponibili: p.max_sponsor_disponibili ?? null,
      attivo: p.attivo,
      posti_occupati: (posti_per_pacchetto as Record<string, number>)[p.id] ?? 0,
    }));
    return {
      club: {
        nome: club.nome,
        logo_url: (club as any).logo_url,
        colore_primario: (club as any).colore_primario,
        citta: (club as any).citta,
        sito_web: (club as any).sito_web,
        email: (club as any).email,
      },
      identity: identity ?? null,
      kpi: kpi_q.data ?? null,
      pacchetti: pacchetti_pdf,
      categorie_target,
      overrides: overrides_map,
      anno_stagione: new Date().getFullYear(),
    };
  }, [club, pacchetti, identity, kpi_q.data, posti_per_pacchetto, categorie_target, overrides_map]);

  const apri_modifica = (p: any) => {
    set_dlg_initial({
      id: p.id,
      livello: p.livello,
      nome_visualizzato: p.nome_visualizzato,
      prezzo_annuo: Number(p.prezzo_annuo),
      ordine: p.ordine,
      colore_brand: p.colore_brand,
      benefits_text: (Array.isArray(p.benefits) ? p.benefits : []).join("\n"),
      max_sponsor_disponibili: p.max_sponsor_disponibili ?? null,
      attivo: p.attivo,
    });
    set_dlg_open(true);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Pacchetti Sponsor</h1>
          <p className="text-muted-foreground text-sm">Configura i pacchetti e genera il Pitch PDF per i tuoi sponsor potenziali.</p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <Button variant="outline" size="sm" onClick={() => set_text_open(true)}>
            <FileEdit className="w-4 h-4 mr-2" /> Modifica testo Pitch
          </Button>
          <Button variant="outline" size="sm" onClick={() => { if (confirm("Ripristinare i 3 pacchetti default? Quelli attuali saranno eliminati.")) reset_mut.mutate(); }}>
            <RotateCcw className="w-4 h-4 mr-2" /> Reset ai default
          </Button>
          <Button size="sm" onClick={() => { set_dlg_initial(undefined); set_dlg_open(true); }}>
            <Plus className="w-4 h-4 mr-2" /> Aggiungi pacchetto
          </Button>
          <Button size="sm" className="bg-primary" onClick={() => set_pdf_open(true)}>
            <FileText className="w-4 h-4 mr-2" /> Genera Pitch Sponsor
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {(pacchetti as any[]).map((p) => {
          const occ = (posti_per_pacchetto as Record<string, number>)[p.id] ?? 0;
          const max = p.max_sponsor_disponibili;
          return (
            <Card key={p.id} className="p-4 flex flex-col gap-3">
              <div className="flex items-center justify-between">
                <span className="px-2 py-1 rounded text-xs font-bold text-white" style={{ backgroundColor: p.colore_brand }}>
                  {p.livello.toUpperCase()}
                </span>
                <Switch checked={p.attivo} onCheckedChange={(c) => toggle_mut.mutate({ id: p.id, attivo: c })} />
              </div>
              <div>
                <h3 className="font-bold text-lg">{p.nome_visualizzato}</h3>
                <p className="text-2xl font-bold text-primary">{format_chf(Number(p.prezzo_annuo))}<span className="text-xs text-muted-foreground font-normal">/anno</span></p>
              </div>
              <ul className="text-sm space-y-1 flex-1">
                {(Array.isArray(p.benefits) ? p.benefits : []).map((b: string, i: number) => (
                  <li key={i} className="flex gap-2"><span className="text-primary">•</span><span>{b}</span></li>
                ))}
              </ul>
              <div className="text-xs text-muted-foreground">
                {max != null ? `${occ} / ${max} sponsor collegati` : `${occ} sponsor collegati (illimitato)`}
              </div>
              <div className="flex gap-2 pt-2 border-t">
                <Button size="sm" variant="outline" className="flex-1" onClick={() => apri_modifica(p)}>
                  <Pencil className="w-3 h-3 mr-1" /> Modifica
                </Button>
                <Button size="sm" variant="ghost" className="text-destructive" onClick={() => { if (confirm("Eliminare il pacchetto?")) del_mut.mutate(p.id); }}>
                  <Trash2 className="w-4 h-4" />
                </Button>
              </div>
            </Card>
          );
        })}
        {pacchetti.length === 0 && (
          <Card className="p-8 col-span-full text-center text-muted-foreground">
            Nessun pacchetto configurato. Usa "Reset ai default" per creare Gold/Silver/Bronze.
          </Card>
        )}
      </div>

      <PacchettoFormDialog
        open={dlg_open}
        on_open_change={set_dlg_open}
        initial={dlg_initial}
        on_save={(v) => upsert_mut.mutate(v)}
        saving={upsert_mut.isPending}
      />
      <PitchTextEditorDialog
        open={text_open}
        on_open_change={set_text_open}
        initial={overrides_map}
        on_save={(v) => save_overrides_mut.mutate(v)}
        saving={save_overrides_mut.isPending}
      />
      <PitchPDFPreview open={pdf_open} on_open_change={set_pdf_open} data={pitch_data} />
    </div>
  );
}
