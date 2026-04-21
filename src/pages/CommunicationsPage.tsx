import React, { useState, useMemo } from 'react';
import { useI18n } from '@/lib/i18n';
import { use_comunicazioni, use_corsi } from '@/hooks/use-supabase-data';
import { use_crea_comunicazione } from '@/hooks/use-supabase-mutations';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Plus, MessageSquare, FileText, Pencil } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

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

const CommunicationsPage: React.FC = () => {
  const { t } = useI18n();
  const { data: comunicazioni = [], isLoading } = use_comunicazioni();
  const { data: corsi = [] } = use_corsi();
  const crea = use_crea_comunicazione();

  const [modal_open, set_modal_open] = useState(false);
  const [step, set_step] = useState<'choose' | 'template_pick' | 'form'>('choose');
  const [selected_template, set_selected_template] = useState<typeof TEMPLATES[0] | null>(null);
  const [placeholders, set_placeholders] = useState<Record<string, string>>({});
  const [titolo, set_titolo] = useState('');
  const [testo, set_testo] = useState('');
  const [tipo_destinatari, set_tipo_destinatari] = useState('tutti');
  const [corso_id, set_corso_id] = useState('');
  const [livello_categoria, set_livello_categoria] = useState('stellina_1_plus');

  const fill_placeholders = (text: string, vals: Record<string, string>) => {
    let result = text;
    Object.entries(vals).forEach(([k, v]) => {
      result = result.replace(new RegExp(`\\{${k}\\}`, 'g'), v || `{${k}}`);
    });
    return result;
  };

  const titolo_preview = useMemo(() => fill_placeholders(titolo, placeholders), [titolo, placeholders]);
  const testo_preview = useMemo(() => fill_placeholders(testo, placeholders), [testo, placeholders]);

  const open_new = () => {
    set_step('choose');
    set_selected_template(null);
    set_placeholders({});
    set_titolo('');
    set_testo('');
    set_tipo_destinatari('tutti');
    set_corso_id('');
    set_livello_categoria('stellina_1_plus');
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
    set_corso_id('');
    set_placeholders({});
    set_step('form');
  };

  const handle_submit = async () => {
    const final_titolo = fill_placeholders(titolo, placeholders);
    const final_testo = fill_placeholders(testo, placeholders);
    await crea.mutateAsync({
      titolo: final_titolo,
      testo: final_testo,
      tipo_destinatari,
      corso_id: tipo_destinatari === 'per_corso' ? corso_id : null,
    });
    set_modal_open(false);
  };

  const get_destinatari_label = (c: any) => {
    if (c.tipo_destinatari === 'tutti') return t('tutti');
    if (c.tipo_destinatari === 'solo_istruttori') return t('solo_istruttori');
    if (c.tipo_destinatari === 'per_corso') {
      const corso = corsi.find((co: any) => co.id === c.corso_id);
      return corso ? corso.nome : t('per_corso');
    }
    return t('per_atleta');
  };

  if (isLoading) return <div className="flex items-center justify-center h-64"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" /></div>;

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold tracking-tight text-foreground">{t('comunicazioni')}</h1>
        <Button className="bg-primary hover:bg-primary/90" onClick={open_new}><Plus className="w-4 h-4 mr-2" /> {t('nuova_comunicazione')}</Button>
      </div>
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
                <p className="text-xs tabular-nums text-muted-foreground">{c.data ? new Date(c.data + 'T00:00:00').toLocaleDateString('it-CH') : ''}</p>
                <Badge variant="secondary" className="text-xs mt-1">{get_destinatari_label(c)}</Badge>
              </div>
            </div>
          </div>
        ))}
      </div>

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

              <div>
                <Label className="text-xs">Destinatari</Label>
                <Select value={tipo_destinatari} onValueChange={set_tipo_destinatari}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="tutti">Tutti</SelectItem>
                    <SelectItem value="per_corso">Per corso</SelectItem>
                    <SelectItem value="solo_istruttori">Solo istruttori</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {tipo_destinatari === 'per_corso' && (
                <div>
                  <Label className="text-xs">Corso</Label>
                  <Select value={corso_id} onValueChange={set_corso_id}>
                    <SelectTrigger><SelectValue placeholder="Seleziona corso" /></SelectTrigger>
                    <SelectContent>
                      {corsi.map((c: any) => <SelectItem key={c.id} value={c.id}>{c.nome}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              )}

              <DialogFooter>
                <Button variant="outline" onClick={() => set_modal_open(false)}>Annulla</Button>
                <Button onClick={handle_submit} disabled={crea.isPending || !titolo_preview.trim() || !testo_preview.trim()}>
                  {crea.isPending ? '...' : 'Invia'}
                </Button>
              </DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default CommunicationsPage;
