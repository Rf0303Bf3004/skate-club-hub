import { useState } from "react";
import { Copy, Check, QrCode, Printer, Download, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "@/hooks/use-toast";
import { supabase } from "@/lib/supabase";

interface Props {
  atleta: { id: string; nome?: string; cognome?: string; codice_atleta?: string | null };
  on_updated?: (nuovo_codice: string) => void;
}

function qr_url(codice: string, size = 320) {
  return `https://api.qrserver.com/v1/create-qr-code/?size=${size}x${size}&margin=8&data=${encodeURIComponent(codice)}`;
}

export default function CodiceAtletaCard({ atleta, on_updated }: Props) {
  const [copied, set_copied] = useState(false);
  const [show_qr, set_show_qr] = useState(false);
  const [rigenerando, set_rigenerando] = useState(false);
  const [conferma_rigen, set_conferma_rigen] = useState(false);

  const codice = atleta.codice_atleta || "";

  const copia = async () => {
    if (!codice) return;
    try {
      await navigator.clipboard.writeText(codice);
      set_copied(true);
      setTimeout(() => set_copied(false), 1800);
      toast({ title: "✅ Codice copiato" });
    } catch {
      toast({ title: "Impossibile copiare", variant: "destructive" });
    }
  };

  const scarica_qr = () => {
    if (!codice) return;
    const a = document.createElement("a");
    a.href = qr_url(codice, 600);
    a.download = `qr-${codice}.png`;
    a.target = "_blank";
    a.click();
  };

  const stampa_scheda = () => {
    if (!codice) return;
    const nome_completo = `${atleta.nome ?? ""} ${atleta.cognome ?? ""}`.trim();
    const html = `<!DOCTYPE html><html lang="it"><head><meta charset="UTF-8"><title>Codice atleta ${codice}</title>
<style>
*{margin:0;padding:0;box-sizing:border-box;font-family:-apple-system,Helvetica,Arial,sans-serif;}
body{padding:48px;color:#0F172A;}
.brand{display:flex;align-items:center;gap:12px;margin-bottom:32px;}
.brand-icon{font-size:34px;}
.brand-name{font-size:20px;font-weight:800;}
.brand-sub{font-size:11px;color:#64748B;}
.card{border:1.5px solid #E2E8F0;border-radius:18px;padding:36px;text-align:center;max-width:560px;margin:0 auto;}
.atleta{font-size:22px;font-weight:700;margin-bottom:6px;}
.label{font-size:10px;font-weight:800;text-transform:uppercase;letter-spacing:1.6px;color:#0284C7;margin:24px 0 10px;}
.codice{font-family:ui-monospace,Menlo,Consolas,monospace;font-size:38px;font-weight:900;letter-spacing:6px;color:#0F172A;padding:18px 24px;background:#F0F9FF;border:2px solid #BAE6FD;border-radius:14px;display:inline-block;}
img.qr{width:220px;height:220px;margin-top:18px;}
ol{text-align:left;max-width:420px;margin:28px auto 0;font-size:13px;line-height:1.7;color:#334155;}
ol li::marker{color:#0284C7;font-weight:700;}
.footer{margin-top:28px;font-size:10px;color:#94A3B8;text-align:center;}
@media print{@page{margin:0;size:A4;}body{padding:24mm;}}
</style></head><body>
<div class="brand"><div class="brand-icon">⛸️</div><div><div class="brand-name">Ice Arena</div><div class="brand-sub">Codice atleta per app mobile</div></div></div>
<div class="card">
  <div class="atleta">${nome_completo || "Atleta"}</div>
  <div class="label">Codice personale</div>
  <div class="codice">${codice}</div>
  <div><img class="qr" src="${qr_url(codice, 440)}" alt="QR ${codice}" /></div>
  <ol>
    <li>Scarica l'app <strong>Ice Arena</strong> dallo store.</li>
    <li>Apri l'app e tocca <strong>Inserisci codice</strong>.</li>
    <li>Digita o scansiona <strong>${codice}</strong>.</li>
    <li>Il profilo dell'atleta verrà collegato al dispositivo.</li>
  </ol>
</div>
<div class="footer">Codice permanente — non scade. In caso di smarrimento, il club può rigenerarlo dalla scheda atleta.</div>
<script>window.onload=function(){setTimeout(function(){window.print();},300);};</script>
</body></html>`;
    const w = window.open("", "_blank");
    if (w) { w.document.write(html); w.document.close(); }
  };

  const rigenera = async () => {
    set_rigenerando(true);
    try {
      const { data, error } = await supabase.rpc("genera_codice_atleta" as any);
      if (error) throw error;
      const nuovo = String(data);
      const { error: up_err } = await supabase.from("atleti").update({ codice_atleta: nuovo }).eq("id", atleta.id);
      if (up_err) throw up_err;
      toast({ title: "🔄 Codice rigenerato", description: nuovo });
      on_updated?.(nuovo);
      set_conferma_rigen(false);
    } catch (err: any) {
      toast({ title: "Errore rigenerazione", description: err?.message, variant: "destructive" });
    } finally {
      set_rigenerando(false);
    }
  };

  if (!codice) {
    return (
      <div className="rounded-xl border border-dashed border-border bg-muted/30 p-5 text-sm text-muted-foreground">
        Codice atleta non ancora assegnato. Salva l'atleta per generarlo automaticamente.
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-primary/20 bg-primary/[0.03] p-5 space-y-4">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <div className="text-[10px] font-bold uppercase tracking-[1.6px] text-primary mb-1.5">
            Codice atleta per app mobile
          </div>
          <div className="font-mono text-2xl font-black tracking-[4px] text-foreground select-all">
            {codice}
          </div>
          <p className="text-xs text-muted-foreground mt-2 max-w-md leading-relaxed">
            Comunica questo codice ai genitori. Lo useranno una sola volta nell'app Ice Arena per
            collegare il dispositivo al profilo dell'atleta. Il codice è <strong>permanente</strong>.
          </p>
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        <Button size="sm" variant="outline" onClick={copia} className="gap-1.5">
          {copied ? <Check className="w-4 h-4 text-green-600" /> : <Copy className="w-4 h-4" />}
          {copied ? "Copiato" : "Copia codice"}
        </Button>
        <Button size="sm" variant="outline" onClick={() => set_show_qr(true)} className="gap-1.5">
          <QrCode className="w-4 h-4" /> Mostra QR
        </Button>
        <Button size="sm" variant="outline" onClick={stampa_scheda} className="gap-1.5">
          <Printer className="w-4 h-4" /> Stampa scheda genitori
        </Button>
        <Button
          size="sm"
          variant="ghost"
          onClick={() => set_conferma_rigen(true)}
          className="gap-1.5 text-muted-foreground hover:text-destructive"
          title="Rigenera codice (es. codice compromesso)"
        >
          <RefreshCw className="w-3.5 h-3.5" /> Rigenera
        </Button>
      </div>

      {/* Dialog QR */}
      <Dialog open={show_qr} onOpenChange={set_show_qr}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <QrCode className="w-5 h-5 text-primary" /> QR codice atleta
            </DialogTitle>
          </DialogHeader>
          <div className="text-center space-y-3">
            <img src={qr_url(codice, 320)} alt={`QR ${codice}`} className="mx-auto rounded-xl border" />
            <div className="font-mono text-lg font-bold tracking-[3px]">{codice}</div>
            <p className="text-xs text-muted-foreground">
              Scansiona o digita il codice nell'app Ice Arena.
            </p>
            <Button onClick={scarica_qr} variant="outline" className="w-full gap-1.5">
              <Download className="w-4 h-4" /> Scarica PNG
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Conferma rigenerazione */}
      <Dialog open={conferma_rigen} onOpenChange={(o) => !rigenerando && set_conferma_rigen(o)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Rigenerare il codice atleta?</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 text-sm">
            <p className="text-muted-foreground">
              Il codice attuale <span className="font-mono font-bold text-foreground">{codice}</span> non
              funzionerà più. I dispositivi già collegati dovranno re-inserire il nuovo codice.
            </p>
            <p className="text-xs text-muted-foreground">
              Procedi solo se il codice è stato compromesso o smarrito.
            </p>
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="ghost" onClick={() => set_conferma_rigen(false)} disabled={rigenerando}>
                Annulla
              </Button>
              <Button variant="destructive" onClick={rigenera} disabled={rigenerando} className="gap-1.5">
                <RefreshCw className={`w-4 h-4 ${rigenerando ? "animate-spin" : ""}`} />
                {rigenerando ? "Rigenero..." : "Sì, rigenera"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
