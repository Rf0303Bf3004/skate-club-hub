import i18n from "@/i18n";
import { genera_qr_data_url } from "@/lib/qr";

const tc = (key: string, opts?: Record<string, unknown>) =>
  i18n.t(`codice_card.${key}`, { ns: "atleti", ...(opts ?? {}) }) as string;

export interface SchedaCodiceAtleta {
  nome_completo: string;
  codice: string;
}

export interface StoreLinks {
  ios_store_url: string;
  android_store_url: string;
}

const escape_html = (v: string) =>
  (v ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

const STILE = `
*{margin:0;padding:0;box-sizing:border-box;font-family:-apple-system,Helvetica,Arial,sans-serif;}
body{padding:48px;color:#0F172A;}
.scheda + .scheda{page-break-before:always;}
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
.stores{display:flex;gap:16px;margin-top:28px;justify-content:center;}
.store{flex:1;max-width:220px;border:1.5px solid #E2E8F0;border-radius:14px;padding:14px;text-align:center;page-break-inside:avoid;}
.store-title{font-size:11px;font-weight:800;color:#1E2761;margin-bottom:8px;}
.store-qr{width:130px;height:130px;}
.store-link{font-size:7.5px;color:#64748B;word-break:break-all;margin-top:6px;}
.store-todo{font-size:10px;color:#94A3B8;padding:36px 6px;}
.footer{margin-top:28px;font-size:10px;color:#94A3B8;text-align:center;}
@media print{@page{margin:0;size:A4;}body{padding:24mm;}}
`;

const box_store = (etichetta: string, url: string, qr: string) =>
  url && qr
    ? `<div class="store"><div class="store-title">${escape_html(etichetta)}</div><img class="store-qr" src="${qr}" alt="QR ${escape_html(etichetta)}" /><div class="store-link">${escape_html(url)}</div></div>`
    : `<div class="store"><div class="store-title">${escape_html(etichetta)}</div><div class="store-todo">${tc("link_unavailable")}</div></div>`;

/** HTML di una singola scheda (senza <html>/<style>), con QR già in data URL. */
function build_scheda_html(
  atleta: SchedaCodiceAtleta,
  qr_codice: string,
  store: StoreLinks,
  qr_ios: string,
  qr_android: string,
): string {
  const codice = escape_html(atleta.codice);
  return `<div class="scheda">
<div class="brand"><div class="brand-icon">⛸️</div><div><div class="brand-name">${tc("print_brand")}</div><div class="brand-sub">${tc("print_brand_sub")}</div></div></div>
<div class="card">
  <div class="atleta">${escape_html(atleta.nome_completo) || tc("print_athlete_fallback")}</div>
  <div class="label">${tc("print_personal_code")}</div>
  <div class="codice">${codice}</div>
  <div>${qr_codice ? `<img class="qr" src="${qr_codice}" alt="QR ${codice}" />` : ""}</div>
  <ol>
    <li>${tc("print_step_1")}</li>
    <li>${tc("print_step_2")}</li>
    <li>${tc("print_step_3", { codice: atleta.codice })}</li>
    <li>${tc("print_step_4")}</li>
  </ol>
  <div class="label">${tc("download_app")}</div>
  <div class="stores">
    ${box_store(tc("store_ios"), store.ios_store_url, qr_ios)}
    ${box_store(tc("store_android"), store.android_store_url, qr_android)}
  </div>
</div>
<div class="footer">${tc("print_footer")}</div>
</div>`;
}

/**
 * Costruisce e apre in stampa un unico documento con una scheda per pagina.
 * Tutti i QR sono generati localmente come data URL prima dell'apertura,
 * quindi la stampa non dipende dalla rete.
 */
export async function stampa_schede_codice(
  atleti: SchedaCodiceAtleta[],
  store: StoreLinks,
): Promise<void> {
  const validi = atleti.filter((a) => a.codice);
  if (validi.length === 0) return;

  const [qr_ios, qr_android] = await Promise.all([
    genera_qr_data_url(store.ios_store_url, 200),
    genera_qr_data_url(store.android_store_url, 200),
  ]);
  const qr_codici = await Promise.all(validi.map((a) => genera_qr_data_url(a.codice, 200)));

  const corpo = validi
    .map((a, i) => build_scheda_html(a, qr_codici[i], store, qr_ios, qr_android))
    .join("\n");

  const titolo =
    validi.length === 1 ? `Codice atleta ${validi[0].codice}` : `Schede atleti (${validi.length})`;

  const html = `<!DOCTYPE html><html lang="it"><head><meta charset="UTF-8"><title>${escape_html(titolo)}</title>
<style>${STILE}</style></head><body>
${corpo}
<script>window.onload=function(){setTimeout(function(){window.print();},300);};</script>
</body></html>`;

  const w = window.open("", "_blank");
  if (w) {
    w.document.write(html);
    w.document.close();
  }
}
