import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Copy, Check, Printer, Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "@/hooks/use-toast";
import { use_qr_data_url } from "@/hooks/use-qr-data-url";
import { genera_qr_data_url } from "@/lib/qr";

interface Props {
  istruttore: { id: string; nome?: string; cognome?: string; codice_istruttore?: string | null };
}

/**
 * Consegna del codice istruttore: valore leggibile + QR (schermo e stampa).
 * Il codice serve solo a farsi riconoscere: i permessi restano quelli del ruolo.
 */
export default function CodiceIstruttoreCard({ istruttore }: Props) {
  const { t } = useTranslation("istruttori");
  const [copied, set_copied] = useState(false);
  const codice = istruttore.codice_istruttore || "";
  const qr_codice = use_qr_data_url(codice, 320);

  const copia = async () => {
    if (!codice) return;
    try {
      await navigator.clipboard.writeText(codice);
      set_copied(true);
      setTimeout(() => set_copied(false), 1800);
      toast({ title: t("codice_card.toast_copied") });
    } catch {
      toast({ title: t("codice_card.toast_copy_error"), variant: "destructive" });
    }
  };

  const scarica_qr = async () => {
    const data_url = await genera_qr_data_url(codice, 600);
    if (!data_url) return;
    const a = document.createElement("a");
    a.href = data_url;
    a.download = `qr-${codice}.png`;
    a.click();
  };

  const stampa = async () => {
    if (!codice) return;
    const w = window.open("", "_blank");
    if (!w) {
      toast({ title: t("codice_card.popup_blocked"), variant: "destructive" });
      return;
    }
    w.document.write("<!DOCTYPE html><html><body></body></html>");
    const qr = await genera_qr_data_url(codice, 600);
    const nome = `${istruttore.nome ?? ""} ${istruttore.cognome ?? ""}`.trim();
    const html = `<!DOCTYPE html><html lang="it"><head><meta charset="UTF-8">
<title>${codice}</title><style>
*{margin:0;padding:0;box-sizing:border-box;font-family:-apple-system,Helvetica,Arial,sans-serif;}
body{padding:40px;color:#0F172A;text-align:center;}
.card{border:1.5px solid #E2E8F0;border-radius:18px;padding:28px;max-width:520px;margin:0 auto;}
.nome{font-size:22px;font-weight:700;margin-bottom:6px;}
.label{font-size:10px;font-weight:800;text-transform:uppercase;letter-spacing:1.6px;color:#0284C7;margin:16px 0 8px;}
.codice{font-family:ui-monospace,Menlo,Consolas,monospace;font-size:34px;font-weight:900;letter-spacing:5px;padding:16px 22px;background:#F0F9FF;border:2px solid #BAE6FD;border-radius:14px;display:inline-block;}
img.qr{width:190px;height:190px;margin-top:14px;}
.hint{font-size:12px;color:#64748B;margin-top:16px;line-height:1.6;}
@media print{@page{size:A4;margin:10mm;}body{padding:0;}}
</style></head><body><div class="card">
<div class="nome">${nome}</div>
<div class="label">${t("codice_card.title")}</div>
<div class="codice">${codice}</div>
${qr ? `<div><img class="qr" src="${qr}" alt="QR ${codice}" /></div>` : ""}
<div class="hint">${t("codice_card.print_hint")}</div>
</div>
<script>window.onload=function(){setTimeout(function(){window.print();},300);};</script>
</body></html>`;
    w.document.open();
    w.document.write(html);
    w.document.close();
  };

  if (!codice) {
    return (
      <div className="rounded-xl border border-dashed border-border bg-muted/30 p-5 text-sm text-muted-foreground">
        {t("codice_card.not_assigned")}
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-primary/20 bg-primary/[0.03] p-5">
      <div className="flex items-start gap-5 flex-wrap">
        <div className="flex-1 min-w-[200px]">
          <div className="text-[10px] font-bold uppercase tracking-[1.6px] text-primary mb-1.5">
            {t("codice_card.title")}
          </div>
          <div className="font-mono text-2xl font-black tracking-[3px] text-foreground select-all">
            {codice}
          </div>
          <p className="text-xs text-muted-foreground mt-2 max-w-md leading-relaxed">
            {t("codice_card.description")}
          </p>
          <div className="flex flex-wrap gap-2 mt-4">
            <Button size="sm" variant="outline" onClick={copia} className="gap-1.5">
              {copied ? <Check className="w-4 h-4 text-green-600" /> : <Copy className="w-4 h-4" />}
              {copied ? t("codice_card.copied") : t("codice_card.copy_code")}
            </Button>
            <Button size="sm" variant="outline" onClick={stampa} className="gap-1.5">
              <Printer className="w-4 h-4" /> {t("codice_card.print_sheet")}
            </Button>
            <Button size="sm" variant="ghost" onClick={scarica_qr} className="gap-1.5">
              <Download className="w-4 h-4" /> {t("codice_card.download_png")}
            </Button>
          </div>
        </div>
        {qr_codice ? (
          <img
            src={qr_codice}
            alt={`QR ${codice}`}
            className="w-32 h-32 rounded-xl border bg-white"
          />
        ) : (
          <div className="w-32 h-32 rounded-xl border bg-muted animate-pulse" />
        )}
      </div>
    </div>
  );
}
