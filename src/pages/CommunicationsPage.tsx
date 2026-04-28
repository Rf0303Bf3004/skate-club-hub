import React, { useState, useMemo } from 'react';
import { useI18n } from '@/lib/i18n';
import { use_atleti, use_comunicazioni, use_corsi, use_istruttori } from '@/hooks/use-supabase-data';
import { use_crea_comunicazione } from '@/hooks/use-supabase-mutations';
import { supabase, get_current_club_id } from '@/lib/supabase';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Plus, MessageSquare, FileText, Pencil, Check, ChevronsUpDown, CalendarIcon, X } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { Calendar } from '@/components/ui/calendar';
import { cn } from '@/lib/utils';

const TEMPLATES = [
  {
    id: 'benvenuto',
    nome: 'Benvenuto stagione',
    titolo: 'Benvenuto alla stagione {anno}!',
    testo: 'Siamo felici di darvi il benvenuto alla nuova stagione sportiva {anno}. Il calendario corsi è disponibile nell\'app. Per qualsiasi informazione non esitate a contattarci.',
    tipo_destinatari: 'tutti',
    placeholders: ['anno'],
  },
  {
    id: 'corso_annullato',
    nome: 'Corso annullato',
    titolo: 'Corso annullato — {data}',
    testo: 'Vi informiamo che il corso {nome_corso} di {data} è annullato. Ci scusiamo per l\'inconveniente.',
    tipo_destinatari: 'per_corso',
    placeholders: ['data', 'nome_corso'],
  },
  {
    id: 'pista_chiusa',
    nome: 'Pista chiusa',
    titolo: 'Pista chiusa — {data}',
    testo: 'La pista sarà chiusa {data} per {motivo}. Tutti i corsi previsti sono annullati.',
    tipo_destinatari: 'tutti',
    placeholders: ['data', 'motivo'],
  },
  {
    id: 'gara',
    nome: 'Comunicazione gara',
    titolo: 'Gara — {nome_gara}',
    testo: 'Vi ricordiamo la gara {nome_gara} in programma il {data} a {luogo}. Gli atleti convocati riceveranno comunicazione separata.',
    tipo_destinatari: 'tutti',
    placeholders: ['nome_gara', 'data', 'luogo'],
  },
  {
    id: 'cambio_orario',
    nome: 'Cambio orario',
    titolo: 'Cambio orario — {corso}',
    testo: 'Il corso {corso} cambia orario: dal {data} si terrà alle {nuovo_orario} invece di {vecchio_orario}.',
    tipo_destinatari: 'per_corso',
    placeholders: ['corso', 'data', 'nuovo_orario', 'vecchio_orario'],
  },
];

const PLACEHOLDER_LABELS: Record<string, string> = {
  anno: 'Anno (es. 2026)',
  data: 'Data',
  nome_corso: 'Nome corso',
  motivo: 'Motivo',
  nome_gara: 'Nome gara',
  luogo: 'Luogo',
  corso: 'Nome corso',
  nuovo_orario: 'Nuovo orario',
  vecchio_orario: 'Vecchio orario',
};

const LIVELLI_ORDER: Record<string, number> = {
  Pulcini: 0,
  'Stellina 1': 1,
  'Stellina 2': 2,
  'Stellina 3': 3,
  'Stellina 4': 4,
  Interbronzo: 5,
  Bronzo: 6,
  Interargento: 7,
  Argento: 8,
  Interoro: 9,
  Oro: 10,
};

const SOGLIE_LIVELLO: Record<string, number> = {
  pulcini_only: 0,
  stellina_1_plus: 1,
  bronzo_plus: 6,
  argento_plus: 8,
  oro_plus: 10,
};

function format_date_label(value: string) {
  if (!value) return '';
  return new Date(`${value}T00:00:00`).toLocaleDateString('de-CH', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

function get_atleta_livello_label(atleta: any) {
  return atleta?.carriera_artistica || atleta?.carriera_stile || atleta?.percorso_amatori || 'Pulcini';
}

function get_atleta_livello_rank(atleta: any) {
  return LIVELLI_ORDER[get_atleta_livello_label(atleta)] ?? 0;
}

type RecipientPreviewRow = {
  atleta_id: string;
  nome: string;
  cognome: string;
  livello: string;
  corsi: string[];
};

const CommunicationsPage: React.FC = () => {
  const { t } = useI18n();
  const { data: comunicazioni = [], isLoading } = use_comunicazioni();
  const { data: corsi = [] } = use_corsi();
  const { data: atleti = [] } = use_atleti();
  const { data: istruttori = [] } = use_istruttori();
  const crea = use_crea_comunicazione();

  const [modal_open, set_modal_open] = useState(false);
  const [step, set_step] = useState<'choose' | 'template_pick' | 'form'>('choose');
  const [selected_template, set_selected_template] = useState<typeof TEMPLATES[0] | null>(null);
  const [placeholders, set_placeholders] = useState<Record<string, string>>({});
  const [titolo, set_titolo] = useState('');
  const [testo, set_testo] = useState('');
  const [tipo_destinatari, set_tipo_destinatari] = useState('tutti');
  const [corsi_ids, set_corsi_ids] = useState<string[]>([]);
  const [livello_categoria, set_livello_categoria] = useState('stellina_1_plus');
  const [giorno_data, set_giorno_data] = useState('');
  const [istruttore_id, set_istruttore_id] = useState('');
  const [istruttore_data, set_istruttore_data] = useState('');
  const [corsi_popover_open, set_corsi_popover_open] = useState(false);
  const [recipient_preview, set_recipient_preview] = useState<RecipientPreviewRow[]>([]);
  const [selected_recipient_ids, set_selected_recipient_ids] = useState<string[]>([]);
  const [preview_loaded, set_preview_loaded] = useState(false);
  const [is_resolving_recipients, set_is_resolving_recipients] = useState(false);
  const [atleti_specifici_ids, set_atleti_specifici_ids] = useState<string[]>([]);
  const [atleta_search, set_atleta_search] = useState('');

  // Evento collegato (gara | gala | test | nessuno)
  const [tipo_evento_collegato, set_tipo_evento_collegato] = useState<'nessuno' | 'gara' | 'gala' | 'test'>('nessuno');
  const [evento_collegato_id, set_evento_collegato_id] = useState<string>('');
  const [gare_future, set_gare_future] = useState<any[]>([]);
  const [gale_future, set_gale_future] = useState<any[]>([]);
  const [test_futuri, set_test_futuri] = useState<any[]>([]);

  React.useEffect(() => {
    if (!modal_open) return;
    const today_iso = new Date().toISOString().split('T')[0];
    const club_id = get_current_club_id();
    (async () => {
      const [g_res, ev_res, tl_res] = await Promise.all([
        supabase.from('gare_calendario').select('id, nome, data').eq('club_id', club_id).eq('archiviata', false).gte('data', today_iso).order('data', { ascending: true }),
        supabase.from('eventi_straordinari').select('id, titolo, data').eq('club_id', club_id).gte('data', today_iso).order('data', { ascending: true }),
        supabase.from('test_livello').select('id, nome, data').eq('club_id', club_id).gte('data', today_iso).order('data', { ascending: true }),
      ]);
      set_gare_future(g_res.data ?? []);
      set_gale_future(ev_res.data ?? []);
      set_test_futuri(tl_res.data ?? []);
    })();
  }, [modal_open]);

  const fill_placeholders = (text: string, vals: Record<string, string>) => {
    let result = text;
    Object.entries(vals).forEach(([k, v]) => {
      result = result.replace(new RegExp(`\\{${k}\\}`, 'g'), v || `{${k}}`);
    });
    return result;
  };

  const titolo_preview = useMemo(() => fill_placeholders(titolo, placeholders), [titolo, placeholders]);
  const testo_preview = useMemo(() => fill_placeholders(testo, placeholders), [testo, placeholders]);
  const corsi_by_id = useMemo(() => Object.fromEntries(corsi.map((corso: any) => [corso.id, corso])), [corsi]);
  const atleti_by_id = useMemo(() => Object.fromEntries(atleti.map((atleta: any) => [atleta.id, atleta])), [atleti]);
  const instructor_by_id = useMemo(() => Object.fromEntries(istruttori.map((istruttore: any) => [istruttore.id, istruttore])), [istruttori]);

  const reset_recipient_preview = () => {
    set_recipient_preview([]);
    set_selected_recipient_ids([]);
    set_preview_loaded(false);
  };

  const toggle_corso = (id: string) => {
    reset_recipient_preview();
    set_corsi_ids((current) => current.includes(id) ? current.filter((item) => item !== id) : [...current, id]);
  };

  const level_count = useMemo(() => {
    if (tipo_destinatari !== 'per_livello') return 0;
    return atleti.filter((atleta: any) => {
      const rank = get_atleta_livello_rank(atleta);
      if (livello_categoria === 'pulcini_only') return rank === 0;
      return rank >= (SOGLIE_LIVELLO[livello_categoria] ?? 0);
    }).length;
  }, [atleti, livello_categoria, tipo_destinatari]);

  const static_count = tipo_destinatari === 'tutti' ? atleti.length : level_count;
  const preview_selected_count = selected_recipient_ids.length;
  const preview_total_count = recipient_preview.length;

  const resolve_recipients = async (): Promise<RecipientPreviewRow[]> => {
    const merge_rows = (rows: Array<{ atleta_id: string; corso_label: string }>) => {
      const grouped = new Map<string, RecipientPreviewRow>();
      rows.forEach(({ atleta_id, corso_label }) => {
        const atleta = atleti_by_id[atleta_id];
        if (!atleta) return;
        const existing = grouped.get(atleta_id) ?? {
          atleta_id,
          nome: atleta.nome,
          cognome: atleta.cognome,
          livello: get_atleta_livello_label(atleta),
          corsi: [],
        };
        if (!existing.corsi.includes(corso_label)) existing.corsi.push(corso_label);
        grouped.set(atleta_id, existing);
      });

      return Array.from(grouped.values()).sort((a, b) => {
        const cognome_cmp = a.cognome.localeCompare(b.cognome, 'it');
        if (cognome_cmp !== 0) return cognome_cmp;
        return a.nome.localeCompare(b.nome, 'it');
      });
    };

    if (tipo_destinatari === 'per_corsi') {
      const valid_corsi_ids = corsi_ids.filter(Boolean);
      if (valid_corsi_ids.length === 0) return [];
      const { data: iscrizioni, error } = await supabase
        .from('iscrizioni_corsi')
        .select('corso_id, atleta_id, attiva')
        .in('corso_id', valid_corsi_ids);
      if (error) throw error;

      return merge_rows(
        (iscrizioni ?? [])
          .filter((item: any) => item.attiva !== false)
          .map((item: any) => ({
            atleta_id: item.atleta_id,
            corso_label: corsi_by_id[item.corso_id]?.nome || 'Corso',
          })),
      );
    }

    if (tipo_destinatari === 'per_giorno') {
      if (!giorno_data) return [];
      const club_corso_ids = corsi.map((corso: any) => corso.id);
      const [planning_corsi_res, planning_private_res] = await Promise.all([
        supabase.from('planning_corsi_settimana').select('corso_id, data, annullato').eq('data', giorno_data).eq('annullato', false),
        supabase.from('planning_private_settimana').select('lezione_privata_id, data, annullato').eq('data', giorno_data).eq('annullato', false),
      ]);
      if (planning_corsi_res.error) throw planning_corsi_res.error;
      if (planning_private_res.error) throw planning_private_res.error;

      const course_ids = Array.from(new Set((planning_corsi_res.data ?? []).map((row: any) => row.corso_id).filter((id: string) => club_corso_ids.includes(id))));
      const private_ids = Array.from(new Set((planning_private_res.data ?? []).map((row: any) => row.lezione_privata_id).filter(Boolean)));

      const [iscrizioni_res, lezioni_res, lezioni_atlete_res] = await Promise.all([
        course_ids.length
          ? supabase.from('iscrizioni_corsi').select('corso_id, atleta_id, attiva').in('corso_id', course_ids)
          : Promise.resolve({ data: [], error: null } as any),
        private_ids.length
          ? supabase.from('lezioni_private').select('id').eq('club_id', corsi[0]?.club_id ?? '').in('id', private_ids)
          : Promise.resolve({ data: [], error: null } as any),
        private_ids.length
          ? supabase.from('lezioni_private_atlete').select('lezione_id, atleta_id').in('lezione_id', private_ids)
          : Promise.resolve({ data: [], error: null } as any),
      ]);
      if (iscrizioni_res.error) throw iscrizioni_res.error;
      if (lezioni_res.error) throw lezioni_res.error;
      if (lezioni_atlete_res.error) throw lezioni_atlete_res.error;

      const valid_private_ids = new Set((lezioni_res.data ?? []).map((row: any) => row.id));

      return merge_rows([
        ...(iscrizioni_res.data ?? [])
          .filter((item: any) => item.attiva !== false)
          .map((item: any) => ({ atleta_id: item.atleta_id, corso_label: corsi_by_id[item.corso_id]?.nome || 'Corso' })),
        ...(lezioni_atlete_res.data ?? [])
          .filter((item: any) => valid_private_ids.has(item.lezione_id))
          .map((item: any) => ({ atleta_id: item.atleta_id, corso_label: 'Lezione privata' })),
      ]);
    }

    if (tipo_destinatari === 'per_istruttore') {
      if (!istruttore_id || !istruttore_data) return [];
      const club_corso_ids = corsi.filter((corso: any) => (corso.istruttori_ids ?? []).includes(istruttore_id)).map((corso: any) => corso.id);
      const [planning_corsi_res, planning_private_res] = await Promise.all([
        supabase
          .from('planning_corsi_settimana')
          .select('corso_id, data, istruttore_id, annullato')
          .eq('data', istruttore_data)
          .eq('istruttore_id', istruttore_id)
          .eq('annullato', false),
        supabase
          .from('planning_private_settimana')
          .select('lezione_privata_id, data, istruttore_id, annullato')
          .eq('data', istruttore_data)
          .eq('istruttore_id', istruttore_id)
          .eq('annullato', false),
      ]);
      if (planning_corsi_res.error) throw planning_corsi_res.error;
      if (planning_private_res.error) throw planning_private_res.error;

      const course_ids = Array.from(new Set((planning_corsi_res.data ?? []).map((row: any) => row.corso_id).filter((id: string) => club_corso_ids.includes(id))));
      const private_ids = Array.from(new Set((planning_private_res.data ?? []).map((row: any) => row.lezione_privata_id).filter(Boolean)));

      const [iscrizioni_res, lezioni_res, lezioni_atlete_res] = await Promise.all([
        course_ids.length
          ? supabase.from('iscrizioni_corsi').select('corso_id, atleta_id, attiva').in('corso_id', course_ids)
          : Promise.resolve({ data: [], error: null } as any),
        private_ids.length
          ? supabase.from('lezioni_private').select('id').eq('club_id', corsi[0]?.club_id ?? '').eq('istruttore_id', istruttore_id).in('id', private_ids)
          : Promise.resolve({ data: [], error: null } as any),
        private_ids.length
          ? supabase.from('lezioni_private_atlete').select('lezione_id, atleta_id').in('lezione_id', private_ids)
          : Promise.resolve({ data: [], error: null } as any),
      ]);
      if (iscrizioni_res.error) throw iscrizioni_res.error;
      if (lezioni_res.error) throw lezioni_res.error;
      if (lezioni_atlete_res.error) throw lezioni_atlete_res.error;

      const valid_private_ids = new Set((lezioni_res.data ?? []).map((row: any) => row.id));

      return merge_rows([
        ...(iscrizioni_res.data ?? [])
          .filter((item: any) => item.attiva !== false)
          .map((item: any) => ({ atleta_id: item.atleta_id, corso_label: corsi_by_id[item.corso_id]?.nome || 'Corso' })),
        ...(lezioni_atlete_res.data ?? [])
          .filter((item: any) => valid_private_ids.has(item.lezione_id))
          .map((item: any) => ({ atleta_id: item.atleta_id, corso_label: 'Lezione privata' })),
      ]);
    }

    return [];
  };

  const open_new = () => {
    set_step('choose');
    set_selected_template(null);
    set_placeholders({});
    set_titolo('');
    set_testo('');
    set_tipo_destinatari('tutti');
    set_corsi_ids([]);
    set_livello_categoria('stellina_1_plus');
    set_giorno_data('');
    set_istruttore_id('');
    set_istruttore_data('');
    set_tipo_evento_collegato('nessuno');
    set_evento_collegato_id('');
    reset_recipient_preview();
    set_modal_open(true);
  };

  const pick_template = (tpl: typeof TEMPLATES[0]) => {
    set_selected_template(tpl);
    set_titolo(tpl.titolo);
    set_testo(tpl.testo);
    set_tipo_destinatari(tpl.tipo_destinatari);
    set_placeholders({});
    set_step('form');
  };

  const start_custom = () => {
    set_selected_template(null);
    set_titolo('');
    set_testo('');
    set_tipo_destinatari('tutti');
    set_corsi_ids([]);
    set_giorno_data('');
    set_istruttore_id('');
    set_istruttore_data('');
    set_tipo_evento_collegato('nessuno');
    set_evento_collegato_id('');
    set_placeholders({});
    reset_recipient_preview();
    set_step('form');
  };

  const handle_preview_recipients = async () => {
    set_is_resolving_recipients(true);
    try {
      const recipients = await resolve_recipients();
      set_recipient_preview(recipients);
      set_selected_recipient_ids(recipients.map((item) => item.atleta_id));
      set_preview_loaded(true);
    } finally {
      set_is_resolving_recipients(false);
    }
  };

  const handle_submit = async () => {
    const final_titolo = fill_placeholders(titolo, placeholders);
    const final_testo = fill_placeholders(testo, placeholders);
    const evt_id = tipo_evento_collegato !== 'nessuno' && evento_collegato_id ? evento_collegato_id : null;
    await crea.mutateAsync({
      titolo: final_titolo,
      testo: final_testo,
      tipo_destinatari,
      corso_id: null,
      livello_categoria: tipo_destinatari === 'per_livello' ? livello_categoria : null,
      atleta_ids_manuali: ['per_corsi', 'per_giorno', 'per_istruttore'].includes(tipo_destinatari) ? selected_recipient_ids : null,
      gara_id: tipo_evento_collegato === 'gara' ? evt_id : null,
      evento_straordinario_id: tipo_evento_collegato === 'gala' ? evt_id : null,
      test_livello_id: tipo_evento_collegato === 'test' ? evt_id : null,
    });
    set_modal_open(false);
  };

  const LIVELLO_LABELS: Record<string, string> = {
    pulcini_only: 'Solo Pulcini',
    stellina_1_plus: 'Stellina 1 in su',
    bronzo_plus: 'Bronzo in su',
    argento_plus: 'Argento in su',
    oro_plus: 'Oro',
  };

  const get_destinatari_label = (c: any) => {
    const td = c.tipo_destinatari;
    if (td === 'tutti') return t('tutti');
    if (td === 'solo_istruttori') return t('solo_istruttori');
    if (td === 'per_corso' || td === 'corso') {
      const corso = corsi.find((co: any) => co.id === c.corso_id);
      return corso ? `Corso: ${corso.nome}` : t('per_corso');
    }
    if (td === 'per_atleta' || td === 'atleta') return t('per_atleta');
    if (td === 'agonisti') return 'Agonisti';
    if (td === 'per_livello') return 'Per livello';
    if (td === 'manuale') return 'Selezione filtrata';
    if (td === 'per_corsi') return 'Per corsi';
    if (td === 'per_giorno') return 'Per giorno';
    if (td === 'per_istruttore') return 'Per istruttore';
    return td || '—';
  };

  const get_data_label = (c: any) => {
    const iso = (c.stato === 'inviata' && c.inviata_at) ? c.inviata_at : (c.created_at || (c.data ? c.data + 'T00:00:00' : null));
    if (!iso) return '';
    return new Date(iso).toLocaleDateString('de-CH', { day: '2-digit', month: '2-digit', year: 'numeric' });
  };

  if (isLoading) return <div className="flex items-center justify-center h-64"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" /></div>;

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold tracking-tight text-foreground">{t('comunicazioni')}</h1>
        <Button className="bg-primary hover:bg-primary/90" onClick={open_new}><Plus className="w-4 h-4 mr-2" /> {t('nuova_comunicazione')}</Button>
      </div>
      {comunicazioni.length === 0 ? (
        <div className="bg-card rounded-xl shadow-card p-12 text-center space-y-4">
          <MessageSquare className="w-12 h-12 text-muted-foreground/50 mx-auto" />
          <div className="space-y-1">
            <h3 className="text-base font-semibold text-foreground">Nessuna comunicazione</h3>
            <p className="text-sm text-muted-foreground">Crea la tua prima comunicazione per atleti, genitori o iscritti ai corsi.</p>
          </div>
          <Button onClick={open_new} className="bg-primary hover:bg-primary/90">
            <Plus className="w-4 h-4 mr-2" /> {t('nuova_comunicazione')}
          </Button>
        </div>
      ) : (
        <div className="space-y-4">
          {comunicazioni.map((c: any) => (
            <div key={c.id} className="bg-card rounded-xl shadow-card p-5 hover:shadow-card-hover transition-shadow">
              <div className="flex items-start justify-between gap-4">
                <div className="flex gap-3">
                  <MessageSquare className="w-5 h-5 text-accent shrink-0 mt-0.5" />
                  <div>
                    <h3 className="font-semibold text-foreground">{c.titolo}</h3>
                    <p className="text-sm text-muted-foreground mt-1 line-clamp-2">{c.testo}</p>
                  </div>
                </div>
                <div className="text-right shrink-0">
                  <p className="text-xs tabular-nums text-muted-foreground">{get_data_label(c)}</p>
                  <Badge variant="secondary" className="text-xs mt-1">{get_destinatari_label(c)}</Badge>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      <Dialog open={modal_open} onOpenChange={(o) => !o && set_modal_open(false)}>
        <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{t('nuova_comunicazione')}</DialogTitle>
          </DialogHeader>

          {step === 'choose' && (
            <div className="space-y-3">
              <button onClick={() => set_step('template_pick')}
                className="w-full flex items-center gap-3 p-4 rounded-xl border border-border hover:border-primary/40 transition-colors text-left">
                <FileText className="w-5 h-5 text-primary flex-shrink-0" />
                <div>
                  <p className="font-semibold text-foreground">Da template</p>
                  <p className="text-xs text-muted-foreground">Scegli tra 5 template predefiniti</p>
                </div>
              </button>
              <button onClick={start_custom}
                className="w-full flex items-center gap-3 p-4 rounded-xl border border-border hover:border-primary/40 transition-colors text-left">
                <Pencil className="w-5 h-5 text-primary flex-shrink-0" />
                <div>
                  <p className="font-semibold text-foreground">Personalizzata</p>
                  <p className="text-xs text-muted-foreground">Scrivi una comunicazione libera</p>
                </div>
              </button>
            </div>
          )}

          {step === 'template_pick' && (
            <div className="space-y-2">
              {TEMPLATES.map((tpl) => (
                <button key={tpl.id} onClick={() => pick_template(tpl)}
                  className="w-full text-left p-3 rounded-xl border border-border hover:border-primary/40 transition-colors space-y-1">
                  <p className="font-semibold text-foreground text-sm">{tpl.nome}</p>
                  <p className="text-xs text-muted-foreground line-clamp-2">{tpl.testo}</p>
                  <Badge variant="secondary" className="text-[10px]">{tpl.tipo_destinatari === 'tutti' ? 'Tutti' : 'Per corso'}</Badge>
                </button>
              ))}
              <Button variant="ghost" size="sm" onClick={() => set_step('choose')} className="text-xs">← Indietro</Button>
            </div>
          )}

          {step === 'form' && (
            <div className="space-y-4">
              {/* Placeholder inputs */}
              {selected_template && selected_template.placeholders.length > 0 && (
                <div className="space-y-2 p-3 bg-muted/30 rounded-xl">
                  <p className="text-xs font-bold text-muted-foreground uppercase tracking-wide">Compila i campi</p>
                  {selected_template.placeholders.map((ph) => (
                    <div key={ph}>
                      <Label className="text-xs">{PLACEHOLDER_LABELS[ph] || ph}</Label>
                      <Input
                        value={placeholders[ph] || ''}
                        onChange={(e) => set_placeholders(p => ({ ...p, [ph]: e.target.value }))}
                        placeholder={PLACEHOLDER_LABELS[ph]}
                      />
                    </div>
                  ))}
                </div>
              )}

              <div>
                <Label className="text-xs">Titolo</Label>
                <Input value={selected_template ? titolo_preview : titolo}
                  onChange={(e) => set_titolo(e.target.value)}
                  readOnly={!!selected_template} />
              </div>

              <div>
                <Label className="text-xs">Testo</Label>
                <textarea
                  value={selected_template ? testo_preview : testo}
                  onChange={(e) => set_testo(e.target.value)}
                  readOnly={!!selected_template}
                  rows={4}
                  className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40 resize-none"
                />
              </div>

              <div className="space-y-3">
                <div>
                  <Label className="text-xs">Destinatari</Label>
                  <Select
                    value={tipo_destinatari}
                    onValueChange={(value) => {
                      set_tipo_destinatari(value);
                      reset_recipient_preview();
                    }}
                  >
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="tutti">Tutto il club</SelectItem>
                      <SelectItem value="per_corsi">Per corso</SelectItem>
                      <SelectItem value="per_livello">Per livello</SelectItem>
                      <SelectItem value="atleti">Atleti specifici</SelectItem>
                      <SelectItem value="per_giorno">Per giorno (data specifica)</SelectItem>
                      <SelectItem value="per_istruttore">Per istruttore</SelectItem>
                      <SelectItem value="solo_istruttori">Solo istruttori</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {(tipo_destinatari === 'tutti' || tipo_destinatari === 'per_livello') && (
                  <div className="rounded-lg border border-border bg-muted/20 px-3 py-2 text-xs text-muted-foreground">
                    <span className="font-medium text-foreground">{static_count}</span> atleti
                  </div>
                )}
              </div>

              {/* Tipo evento collegato (gara / galà / test livello) */}
              <div className="space-y-2 rounded-xl border border-border p-3">
                <Label className="text-xs">{t('comunicazioni_tipo_evento_collegato')}</Label>
                <Select
                  value={tipo_evento_collegato}
                  onValueChange={(value) => {
                    set_tipo_evento_collegato(value as any);
                    set_evento_collegato_id('');
                  }}
                >
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="nessuno">{t('comunicazioni_evento_nessuno')}</SelectItem>
                    <SelectItem value="gara">{t('comunicazioni_evento_gara')}</SelectItem>
                    <SelectItem value="gala">{t('comunicazioni_evento_gala')}</SelectItem>
                    <SelectItem value="test">{t('comunicazioni_evento_test')}</SelectItem>
                  </SelectContent>
                </Select>

                {tipo_evento_collegato === 'gara' && (
                  <Select value={evento_collegato_id} onValueChange={set_evento_collegato_id}>
                    <SelectTrigger><SelectValue placeholder={t('comunicazioni_seleziona_gara')} /></SelectTrigger>
                    <SelectContent>
                      {gare_future.length === 0 ? (
                        <div className="px-3 py-2 text-xs text-muted-foreground">—</div>
                      ) : (
                        gare_future.map((g) => (
                          <SelectItem key={g.id} value={g.id}>{g.nome} — {format_date_label(g.data)}</SelectItem>
                        ))
                      )}
                    </SelectContent>
                  </Select>
                )}

                {tipo_evento_collegato === 'gala' && (
                  <Select value={evento_collegato_id} onValueChange={set_evento_collegato_id}>
                    <SelectTrigger><SelectValue placeholder={t('comunicazioni_seleziona_gala')} /></SelectTrigger>
                    <SelectContent>
                      {gale_future.length === 0 ? (
                        <div className="px-3 py-2 text-xs text-muted-foreground">—</div>
                      ) : (
                        gale_future.map((e) => (
                          <SelectItem key={e.id} value={e.id}>{e.titolo} — {format_date_label(e.data)}</SelectItem>
                        ))
                      )}
                    </SelectContent>
                  </Select>
                )}

                {tipo_evento_collegato === 'test' && (
                  <Select value={evento_collegato_id} onValueChange={set_evento_collegato_id}>
                    <SelectTrigger><SelectValue placeholder={t('comunicazioni_seleziona_test')} /></SelectTrigger>
                    <SelectContent>
                      {test_futuri.length === 0 ? (
                        <div className="px-3 py-2 text-xs text-muted-foreground">—</div>
                      ) : (
                        test_futuri.map((tl) => (
                          <SelectItem key={tl.id} value={tl.id}>{tl.nome} — {format_date_label(tl.data)}</SelectItem>
                        ))
                      )}
                    </SelectContent>
                  </Select>
                )}
              </div>

              {tipo_destinatari === 'per_corsi' && (
                <div className="space-y-3 rounded-xl border border-border p-3">
                  <div className="space-y-2">
                    <Label className="text-xs">Per corsi</Label>
                    <Popover open={corsi_popover_open} onOpenChange={set_corsi_popover_open}>
                      <PopoverTrigger asChild>
                        <Button variant="outline" className="w-full justify-between font-normal">
                          <span className="truncate text-left">
                            {corsi_ids.length > 0 ? `${corsi_ids.length} corsi selezionati` : 'Seleziona uno o più corsi'}
                          </span>
                          <ChevronsUpDown className="h-4 w-4 opacity-50" />
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-[420px] p-0" align="start">
                        <Command>
                          <div className="flex items-center justify-between border-b px-3 py-2">
                            <Button type="button" variant="ghost" size="sm" onClick={() => { set_corsi_ids(corsi.map((c: any) => c.id)); reset_recipient_preview(); }}>
                              Seleziona tutti
                            </Button>
                            <Button type="button" variant="ghost" size="sm" onClick={() => { set_corsi_ids([]); reset_recipient_preview(); }}>
                              Deseleziona tutti
                            </Button>
                          </div>
                          <CommandInput placeholder="Cerca corso..." />
                          <CommandList>
                            <CommandEmpty>Nessun corso trovato.</CommandEmpty>
                            <CommandGroup>
                              {corsi.map((corso: any) => {
                                const checked = corsi_ids.includes(corso.id);
                                return (
                                  <CommandItem key={corso.id} value={corso.nome} onSelect={() => toggle_corso(corso.id)}>
                                    <Checkbox checked={checked} className="mr-2" />
                                    <span className="flex-1 truncate">{corso.nome}</span>
                                    {checked ? <Check className="h-4 w-4 text-primary" /> : null}
                                  </CommandItem>
                                );
                              })}
                            </CommandGroup>
                          </CommandList>
                        </Command>
                      </PopoverContent>
                    </Popover>
                  </div>

                  {corsi_ids.length > 0 && (
                    <div className="flex flex-wrap gap-2">
                      {corsi_ids.map((id) => (
                        <Badge key={id} variant="secondary" className="gap-1 pr-1">
                          <span>{corsi_by_id[id]?.nome || 'Corso'}</span>
                          <button type="button" className="rounded-sm p-0.5 hover:bg-accent" onClick={() => toggle_corso(id)}>
                            <X className="h-3 w-3" />
                          </button>
                        </Badge>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {tipo_destinatari === 'per_giorno' && (
                <div className="space-y-2 rounded-xl border border-border p-3">
                  <Label className="text-xs">Data</Label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button variant="outline" className={cn('w-full justify-start text-left font-normal', !giorno_data && 'text-muted-foreground')}>
                        <CalendarIcon className="h-4 w-4" />
                        {giorno_data ? format_date_label(giorno_data) : 'Seleziona data'}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar
                        mode="single"
                        selected={giorno_data ? new Date(`${giorno_data}T00:00:00`) : undefined}
                        onSelect={(date) => {
                          set_giorno_data(date ? date.toISOString().split('T')[0] : '');
                          reset_recipient_preview();
                        }}
                        initialFocus
                        className={cn('p-3 pointer-events-auto')}
                      />
                    </PopoverContent>
                  </Popover>
                </div>
              )}

              {tipo_destinatari === 'per_istruttore' && (
                <div className="grid gap-3 rounded-xl border border-border p-3 md:grid-cols-2">
                  <div>
                    <Label className="text-xs">Istruttore</Label>
                    <Select value={istruttore_id} onValueChange={(value) => { set_istruttore_id(value); reset_recipient_preview(); }}>
                      <SelectTrigger><SelectValue placeholder="Seleziona istruttore" /></SelectTrigger>
                      <SelectContent>
                        {istruttori.map((istruttore: any) => (
                          <SelectItem key={istruttore.id} value={istruttore.id}>{istruttore.cognome} {istruttore.nome}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label className="text-xs">Data</Label>
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button variant="outline" className={cn('w-full justify-start text-left font-normal', !istruttore_data && 'text-muted-foreground')}>
                          <CalendarIcon className="h-4 w-4" />
                          {istruttore_data ? format_date_label(istruttore_data) : 'Seleziona data'}
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0" align="start">
                        <Calendar
                          mode="single"
                          selected={istruttore_data ? new Date(`${istruttore_data}T00:00:00`) : undefined}
                          onSelect={(date) => {
                            set_istruttore_data(date ? date.toISOString().split('T')[0] : '');
                            reset_recipient_preview();
                          }}
                          initialFocus
                          className={cn('p-3 pointer-events-auto')}
                        />
                      </PopoverContent>
                    </Popover>
                  </div>
                </div>
              )}

              {tipo_destinatari === 'per_livello' && (
                <div className="space-y-2">
                  <div>
                    <Label className="text-xs">Livello destinatari</Label>
                    <Select value={livello_categoria} onValueChange={set_livello_categoria}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="pulcini_only">Solo Pulcini (comunicazioni operative)</SelectItem>
                        <SelectItem value="stellina_1_plus">Stellina 1 in su</SelectItem>
                        <SelectItem value="bronzo_plus">Bronzo in su</SelectItem>
                        <SelectItem value="argento_plus">Argento in su</SelectItem>
                        <SelectItem value="oro_plus">Oro</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <p className="text-[11px] text-muted-foreground leading-snug">
                    Il filtro usa il livello tecnico massimo dell'atleta (artistico o stile). I Pulcini ricevono solo se selezioni esplicitamente "Solo Pulcini".
                  </p>
                </div>
              )}

              {tipo_destinatari === 'atleti' && (
                <div className="space-y-2 rounded-xl border border-border p-3">
                  <Label className="text-xs">Atleti specifici</Label>
                  <Input
                    placeholder="Cerca per nome, cognome o livello…"
                    value={atleta_search}
                    onChange={(e) => set_atleta_search(e.target.value)}
                  />
                  <div className="flex justify-between">
                    <Button type="button" variant="ghost" size="sm" onClick={() => set_atleti_specifici_ids(atleti.map((a: any) => a.id))}>
                      Seleziona tutti
                    </Button>
                    <Button type="button" variant="ghost" size="sm" onClick={() => set_atleti_specifici_ids([])}>
                      Deseleziona
                    </Button>
                  </div>
                  <div className="max-h-64 overflow-y-auto space-y-1 border rounded-md p-2 bg-background">
                    {(() => {
                      const q = atleta_search.trim().toLowerCase();
                      const lista = atleti
                        .filter((a: any) => {
                          if (!q) return true;
                          const liv = get_atleta_livello_label(a).toLowerCase();
                          return (
                            `${a.cognome} ${a.nome}`.toLowerCase().includes(q) ||
                            `${a.nome} ${a.cognome}`.toLowerCase().includes(q) ||
                            liv.includes(q)
                          );
                        })
                        .sort((a: any, b: any) => `${a.cognome} ${a.nome}`.localeCompare(`${b.cognome} ${b.nome}`, 'it'));
                      if (lista.length === 0) return <p className="text-xs text-muted-foreground px-2 py-1">Nessun atleta trovato.</p>;
                      return lista.map((a: any) => {
                        const checked = atleti_specifici_ids.includes(a.id);
                        return (
                          <label key={a.id} className="flex items-center gap-2 px-2 py-1 rounded hover:bg-muted cursor-pointer text-sm">
                            <Checkbox
                              checked={checked}
                              onCheckedChange={(v) => {
                                set_atleti_specifici_ids((cur) => v ? [...cur, a.id] : cur.filter((x) => x !== a.id));
                              }}
                            />
                            <span className="flex-1">{a.cognome} {a.nome}</span>
                            <Badge variant="outline" className="text-[10px]">{get_atleta_livello_label(a)}</Badge>
                          </label>
                        );
                      });
                    })()}
                  </div>
                  <p className="text-[11px] text-muted-foreground">{atleti_specifici_ids.length} atleti selezionati</p>
                </div>
              )}


              {['per_corsi', 'per_giorno', 'per_istruttore'].includes(tipo_destinatari) && preview_loaded && (
                <div className="space-y-3 rounded-xl border border-border p-3">
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-sm font-medium text-foreground">{preview_selected_count} di {preview_total_count} atleti riceveranno la comunicazione</p>
                    <div className="flex gap-2">
                      <Button type="button" variant="ghost" size="sm" onClick={() => set_selected_recipient_ids(recipient_preview.map((item) => item.atleta_id))}>Tutti</Button>
                      <Button type="button" variant="ghost" size="sm" onClick={() => set_selected_recipient_ids([])}>Nessuno</Button>
                    </div>
                  </div>
                  <div className="max-h-64 space-y-2 overflow-y-auto pr-1">
                    {recipient_preview.map((item) => {
                      const checked = selected_recipient_ids.includes(item.atleta_id);
                      return (
                        <label key={item.atleta_id} className="flex items-start gap-3 rounded-lg border border-border px-3 py-2">
                          <Checkbox
                            checked={checked}
                            onCheckedChange={(value) => {
                              set_selected_recipient_ids((current) => value ? [...current, item.atleta_id] : current.filter((id) => id !== item.atleta_id));
                            }}
                          />
                          <div className="min-w-0 flex-1">
                            <p className="text-sm font-medium text-foreground">{item.cognome} {item.nome}</p>
                            <p className="text-xs text-muted-foreground">{item.livello} · {item.corsi.join(', ')}</p>
                          </div>
                        </label>
                      );
                    })}
                  </div>
                </div>
              )}

              <DialogFooter>
                <Button variant="outline" onClick={() => set_modal_open(false)}>Annulla</Button>
                {['per_corsi', 'per_giorno', 'per_istruttore'].includes(tipo_destinatari) ? (
                  preview_loaded ? (
                    <Button
                      onClick={handle_submit}
                      disabled={crea.isPending || !titolo_preview.trim() || !testo_preview.trim() || selected_recipient_ids.length === 0}
                    >
                      {crea.isPending ? '...' : 'Invia ora'}
                    </Button>
                  ) : (
                    <Button
                      onClick={handle_preview_recipients}
                      disabled={
                        is_resolving_recipients ||
                        !titolo_preview.trim() ||
                        !testo_preview.trim() ||
                        (tipo_destinatari === 'per_corsi' && corsi_ids.length === 0) ||
                        (tipo_destinatari === 'per_giorno' && !giorno_data) ||
                        (tipo_destinatari === 'per_istruttore' && (!istruttore_id || !istruttore_data))
                      }
                    >
                      {is_resolving_recipients ? '...' : 'Vedi destinatari'}
                    </Button>
                  )
                ) : (
                  <Button onClick={handle_submit} disabled={crea.isPending || !titolo_preview.trim() || !testo_preview.trim()}>
                    {crea.isPending ? '...' : 'Invia'}
                  </Button>
                )}
              </DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default CommunicationsPage;
