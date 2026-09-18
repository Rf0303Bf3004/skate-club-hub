import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Copy, Check, QrCode, Printer, Download, RefreshCw, ExternalLink, Plus, Trash2, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "@/hooks/use-toast";
import { supabase } from "@/lib/supabase";
import { use_app_store_links } from "@/hooks/use-app-store-links";
import { use_qr_data_url } from "@/hooks/use-qr-data-url";
import { genera_qr_data_url } from "@/lib/qr";
import { stampa_schede_codice } from "@/lib/scheda-codice-html";

interface Props {
  atleta: {
    id: string;
    nome?: string;
    cognome?: string;
    codice_atleta?: string | null;
    codice_atleta_2?: string | null;
    genitori_separati?: boolean | null;
    genitore1_nome?: string | null;
    genitore1_cognome?: string | null;
    genitore2_nome?: string | null;
    genitore2_cognome?: string | null;
  };
  on_updated?: (nuovo_codice: string) => void;
  on_updated_2?: (nuovo_codice: string | null) => void;
}

/** Un singolo codice: copia, QR, stampa, rigenerazione (ed eventuale revoca). */
function BloccoCodice({
  codice,
  nome_completo_atleta,
  etichetta,
  avvertenza,
  on_rigenera,
  on_revoca,
}: {
  codice: string;
  nome_completo_atleta: string;
  etichetta?: string;
  avvertenza?: string;
  on_rigenera: () => Promise<void>;
  on_revoca?: () => Promise<void>;
}) {
  const { t } = useTranslation("atleti");
  const [copied, set_copied] = useState(false);
  const [show_qr, set_show_qr] = useState(false);
  const [rigenerando, set_rigenerando] = useState(false);
  const [revocando, set_revocando] = useState(false);
  const [conferma_rigen, set_conferma_rigen] = useState(false);
  const [conferma_revoca, set_conferma_revoca] = useState(false);
  const { ios_store_url, android_store_url } = use_app_store_links();

  const qr_codice = use_qr_data_url(codice, 320);
  const qr_ios = use_qr_data_url(ios_store_url, 200);
  const qr_android = use_qr_data_url(android_store_url, 200);

  const copia = async () => {
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

  const stampa_scheda = async () => {
    const esito = await stampa_schede_codice(
      [{ nome_completo: nome_completo_atleta, codice }],
      { ios_store_url, android_store_url },
    );
    if (esito.popup_bloccato) {
      toast({ title: t("codice_card.popup_blocked"), variant: "destructive" });
    }
  };

  const rigenera = async () => {
    set_rigenerando(true);
    try {
      await on_rigenera();
      set_conferma_rigen(false);
    } finally {
      set_rigenerando(false);
    }
  };

  const revoca = async () => {
    if (!on_revoca) return;
    set_revocando(true);
    try {
      await on_revoca();
      set_conferma_revoca(false);
    } finally {
      set_revocando(false);
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex items-start justify-between gap-5 flex-wrap">
        <div className="flex-1 min-w-[200px]">
          <div className="text-[10px] font-bold uppercase tracking-[1.6px] text-primary mb-1.5">
            {etichetta ?? t("codice_card.title")}
          </div>
          <div className="font-mono text-2xl font-black tracking-[4px] text-foreground select-all break-all">
            {codice}
          </div>
        </div>
        {qr_codice ? (
          <img
            src={qr_codice}
            alt={`QR ${codice}`}
            className="w-32 h-32 rounded-xl border bg-white shrink-0"
          />
        ) : (
          <div className="w-32 h-32 rounded-xl border bg-muted animate-pulse shrink-0" />
        )}
      </div>

      <div className="flex flex-wrap gap-2">
        <Button size="sm" variant="outline" onClick={copia} className="gap-1.5">
          {copied ? <Check className="w-4 h-4 text-green-600" /> : <Copy className="w-4 h-4" />}
          {copied ? t("codice_card.copied") : t("codice_card.copy_code")}
        </Button>
        <Button size="sm" variant="outline" onClick={() => set_show_qr(true)} className="gap-1.5">
          <QrCode className="w-4 h-4" /> {t("codice_card.show_qr")}
        </Button>
        <Button size="sm" variant="outline" onClick={stampa_scheda} className="gap-1.5">
          <Printer className="w-4 h-4" /> {t("codice_card.print_sheet")}
        </Button>
        <Button
          size="sm"
          variant="ghost"
          onClick={() => set_conferma_rigen(true)}
          className="gap-1.5 text-muted-foreground hover:text-destructive"
          title={t("codice_card.regenerate_title")}
        >
          <RefreshCw className="w-3.5 h-3.5" /> {t("codice_card.regenerate")}
        </Button>
        {on_revoca && (
          <Button
            size="sm"
            variant="ghost"
            onClick={() => set_conferma_revoca(true)}
            className="gap-1.5 text-muted-foreground hover:text-destructive"
          >
            <Trash2 className="w-3.5 h-3.5" /> {t("codice_card.revoke")}
          </Button>
        )}
      </div>

      {avvertenza && (
        <p className="text-xs text-amber-700 dark:text-amber-400 flex items-start gap-1.5">
          <AlertTriangle className="w-3.5 h-3.5 mt-0.5 shrink-0" />
          <span>{avvertenza}</span>
        </p>
      )}

      {/* Dialog QR */}
      <Dialog open={show_qr} onOpenChange={set_show_qr}>
        <DialogContent className="max-w-sm max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <QrCode className="w-5 h-5 text-primary" /> {t("codice_card.qr_dialog_title")}
            </DialogTitle>
          </DialogHeader>
          <div className="text-center space-y-3">
            {qr_codice ? (
              <img src={qr_codice} alt={`QR ${codice}`} className="mx-auto rounded-xl border w-64 h-64" />
            ) : (
              <div className="mx-auto w-64 h-64 rounded-xl border bg-muted animate-pulse" />
            )}
            <div className="font-mono text-lg font-bold tracking-[3px]">{codice}</div>
            {etichetta && <p className="text-xs font-semibold text-foreground">{etichetta}</p>}
            <p className="text-xs text-muted-foreground">{t("codice_card.qr_dialog_hint")}</p>
            <Button onClick={scarica_qr} variant="outline" className="w-full gap-1.5">
              <Download className="w-4 h-4" /> {t("codice_card.download_png")}
            </Button>

            <div className="grid grid-cols-2 gap-3 border-t pt-3">
              {[
                { etichetta: t("codice_card.scan_ios"), url: ios_store_url, qr: qr_ios },
                { etichetta: t("codice_card.scan_android"), url: android_store_url, qr: qr_android },
              ].map((s) => (
                <div key={s.etichetta} className="space-y-1.5">
                  <p className="text-[11px] font-semibold text-foreground">{s.etichetta}</p>
                  {s.url && s.qr ? (
                    <img
                      src={s.qr}
                      alt={s.etichetta}
                      className="mx-auto rounded-lg border bg-white w-28 h-28"
                    />
                  ) : (
                    <div className="mx-auto w-28 h-28 rounded-lg border border-dashed flex items-center justify-center text-[10px] text-muted-foreground px-2 text-center">
                      {t("codice_card.link_unavailable")}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Conferma rigenerazione */}
      <Dialog open={conferma_rigen} onOpenChange={(o) => !rigenerando && set_conferma_rigen(o)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{t("codice_card.confirm_title")}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 text-sm">
            <p className="text-muted-foreground">{t("codice_card.confirm_desc", { codice })}</p>
            {avvertenza && <p className="text-xs text-amber-700 dark:text-amber-400">{avvertenza}</p>}
            <p className="text-xs text-muted-foreground">{t("codice_card.confirm_hint")}</p>
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="ghost" onClick={() => set_conferma_rigen(false)} disabled={rigenerando}>
                {t("codice_card.cancel")}
              </Button>
              <Button variant="destructive" onClick={rigenera} disabled={rigenerando} className="gap-1.5">
                <RefreshCw className={`w-4 h-4 ${rigenerando ? "animate-spin" : ""}`} />
                {rigenerando ? t("codice_card.regenerating") : t("codice_card.confirm_yes")}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Conferma revoca */}
      <Dialog open={conferma_revoca} onOpenChange={(o) => !revocando && set_conferma_revoca(o)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{t("codice_card.revoke_confirm_title")}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 text-sm">
            <p className="text-muted-foreground">{t("codice_card.revoke_confirm_desc")}</p>
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="ghost" onClick={() => set_conferma_revoca(false)} disabled={revocando}>
                {t("codice_card.cancel")}
              </Button>
              <Button variant="destructive" onClick={revoca} disabled={revocando} className="gap-1.5">
                <Trash2 className="w-4 h-4" />
                {revocando ? t("codice_card.revoking") : t("codice_card.revoke_yes")}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default function CodiceAtletaCard({ atleta, on_updated, on_updated_2 }: Props) {
  const { t } = useTranslation("atleti");
  const [creando, set_creando] = useState(false);
  const { ios_store_url, android_store_url } = use_app_store_links();

  const codice = atleta.codice_atleta || "";
  const codice_2 = atleta.codice_atleta_2 || "";
  const separati = !!atleta.genitori_separati;
  const nome_completo = `${atleta.nome ?? ""} ${atleta.cognome ?? ""}`.trim();

  const nome_genitore = (n?: string | null, c?: string | null, fallback = "") =>
    `${n ?? ""} ${c ?? ""}`.trim() || fallback;

  const etichetta_1 = nome_genitore(
    atleta.genitore1_nome, atleta.genitore1_cognome, t("codice_card.parent_1_fallback"),
  );
  const etichetta_2 = nome_genitore(
    atleta.genitore2_nome, atleta.genitore2_cognome, t("codice_card.parent_2_fallback"),
  );

  const rigenera_primo = async () => {
    try {
      const { data, error } = await supabase.rpc("genera_codice_atleta" as any);
      if (error) throw error;
      const nuovo = String(data);
      const { error: up_err } = await supabase.from("atleti").update({ codice_atleta: nuovo }).eq("id", atleta.id);
      if (up_err) throw up_err;
      toast({ title: t("codice_card.toast_regenerated"), description: nuovo });
      on_updated?.(nuovo);
    } catch (err: any) {
      toast({ title: t("codice_card.toast_regen_error"), description: err?.message, variant: "destructive" });
      throw err;
    }
  };

  const genera_secondo = async () => {
    const { data, error } = await supabase.rpc("genera_codice_secondo_genitore", { p_atleta: atleta.id });
    if (error) {
      toast({ title: t("codice_card.toast_second_error"), description: error.message, variant: "destructive" });
      throw error;
    }
    const nuovo = String(data);
    toast({ title: t("codice_card.toast_second_created"), description: nuovo });
    on_updated_2?.(nuovo);
  };

  const revoca_secondo = async () => {
    const { error } = await supabase.rpc("revoca_codice_secondo_genitore", { p_atleta: atleta.id });
    if (error) {
      toast({ title: t("codice_card.toast_second_error"), description: error.message, variant: "destructive" });
      throw error;
    }
    toast({ title: t("codice_card.toast_second_revoked") });
    on_updated_2?.(null);
  };

  const crea_secondo = async () => {
    set_creando(true);
    try {
      await genera_secondo();
    } catch { /* già segnalato */ }
    finally { set_creando(false); }
  };

  if (!codice) {
    return (
      <div className="rounded-xl border border-dashed border-border bg-muted/30 p-5 text-sm text-muted-foreground">
        {t("codice_card.not_assigned")}
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-primary/20 bg-primary/[0.03] p-5 space-y-4">
      <div>
        <div className="text-[10px] font-bold uppercase tracking-[1.6px] text-primary mb-1.5">
          {t("codice_card.title")}
        </div>
        <p className="text-xs text-muted-foreground max-w-md leading-relaxed">
          {t("codice_card.description")}
        </p>
      </div>

      <BloccoCodice
        codice={codice}
        nome_completo_atleta={nome_completo}
        etichetta={separati ? etichetta_1 : undefined}
        avvertenza={separati ? t("codice_card.warn_first") : undefined}
        on_rigenera={rigenera_primo}
      />

      {separati && (
        <div className="border-t border-primary/15 pt-4">
          {codice_2 ? (
            <BloccoCodice
              codice={codice_2}
              nome_completo_atleta={nome_completo}
              etichetta={etichetta_2}
              avvertenza={t("codice_card.warn_second")}
              on_rigenera={genera_secondo}
              on_revoca={revoca_secondo}
            />
          ) : (
            <div className="space-y-2">
              <div className="text-[10px] font-bold uppercase tracking-[1.6px] text-primary">
                {etichetta_2}
              </div>
              <p className="text-xs text-muted-foreground">{t("codice_card.second_missing")}</p>
              <Button size="sm" variant="outline" onClick={crea_secondo} disabled={creando} className="gap-1.5">
                <Plus className="w-4 h-4" />
                {creando ? t("codice_card.creating_second") : t("codice_card.create_second")}
              </Button>
            </div>
          )}
        </div>
      )}

      {/* Download app */}
      <div className="space-y-2 border-t border-primary/15 pt-3">
        <div className="text-[10px] font-bold uppercase tracking-[1.4px] text-primary">
          {t("codice_card.download_app")}
        </div>
        <div className="flex flex-wrap gap-2">
          {[
            { etichetta: t("codice_card.store_ios"), url: ios_store_url },
            { etichetta: t("codice_card.store_android"), url: android_store_url },
          ].map((s) => (
            <Button
              key={s.etichetta}
              size="sm"
              variant="outline"
              disabled={!s.url}
              onClick={() => s.url && window.open(s.url, "_blank", "noopener,noreferrer")}
              className="gap-1.5"
              title={s.url || t("codice_card.link_unavailable")}
            >
              {s.etichetta}
              {s.url ? (
                <ExternalLink className="w-3.5 h-3.5" />
              ) : (
                <span className="text-[10px] font-normal">{t("codice_card.link_unavailable_short")}</span>
              )}
            </Button>
          ))}
        </div>
      </div>
    </div>
  );
}
