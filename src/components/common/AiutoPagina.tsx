import React, { useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { HelpCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";

/**
 * Guida elementare della pagina corrente. Una chiave per pagina nel namespace
 * `aiuto` (`aiuto.pagine.<pagina>`): la prima riga è il titolo, ogni riga
 * successiva è un passo. Il testo si corregge dalla pagina Traduzioni.
 */
function chiave_pagina(pathname: string, tab: string | null): string | null {
  if (pathname === "/setup-club") {
    const t = tab ?? "club"; // stessa scheda predefinita di ClubSetupPage
    return t === "club" || t === "ghiaccio" || t === "fatturazione" ? `setup_club_${t}` : null;
  }
  const PAGINE: Record<string, string> = {
    "/utenti": "utenti",
    "/ruoli-permessi": "ruoli_permessi",
    "/stagioni": "stagioni",
    "/istruttori": "istruttori",
    "/corsi": "corsi",
    "/atleti": "atleti",
    "/griglia-ghiaccio": "griglia_ghiaccio",
    "/comunicazioni": "comunicazioni",
  };
  return PAGINE[pathname] ?? null;
}

const AiutoPagina: React.FC = () => {
  const { t, i18n } = useTranslation("aiuto");
  const location = useLocation();
  const [aperto, set_aperto] = useState(false);

  const chiave = chiave_pagina(location.pathname, new URLSearchParams(location.search).get("tab"));
  const lingua = (i18n.language ?? "it").slice(0, 2);
  const leggi = (lng: string): string => {
    if (!chiave) return "";
    const v = i18n.getResource(lng, "aiuto", `pagine.${chiave}`);
    return typeof v === "string" ? v.trim() : "";
  };
  const testo_lingua = leggi(lingua);
  const testo = testo_lingua || leggi("it");
  const solo_italiano = !testo_lingua && !!testo && lingua !== "it";
  const righe = testo.split("\n").map((r) => r.trim()).filter(Boolean);
  const [titolo, ...passi] = righe;

  return (
    <>
      <Button
        variant="ghost"
        size="sm"
        onClick={() => set_aperto(true)}
        className="h-8 gap-2 text-muted-foreground hover:text-foreground"
      >
        <HelpCircle className="w-4 h-4" />
        <span className="text-xs">{t("ui.pulsante")}</span>
      </Button>
      <Sheet open={aperto} onOpenChange={set_aperto}>
        <SheetContent side="right" className="w-full sm:max-w-md overflow-y-auto">
          <SheetHeader>
            <SheetTitle>{titolo ?? t("ui.titolo_pannello")}</SheetTitle>
            <SheetDescription>{t("ui.descrizione_pannello")}</SheetDescription>
          </SheetHeader>
          <div className="mt-4 space-y-4">
            {solo_italiano && (
              <p className="rounded-md border border-border bg-muted/50 px-3 py-2 text-xs text-muted-foreground">
                {t("ui.solo_italiano")}
              </p>
            )}
            {passi.length > 0 ? (
              <ol className="space-y-3">
                {passi.map((p, i) => (
                  <li key={i} className="flex gap-3 text-sm text-foreground">
                    <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-bold text-primary">
                      {i + 1}
                    </span>
                    <span className="pt-0.5">{p}</span>
                  </li>
                ))}
              </ol>
            ) : (
              <p className="text-sm text-muted-foreground">{t("ui.vuoto_guida")}</p>
            )}
            <div className="border-t border-border pt-4">
              <Button asChild variant="outline" size="sm" onClick={() => set_aperto(false)}>
                <Link to="/avvio">{t("ui.vai_procedura")}</Link>
              </Button>
            </div>
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
};

export default AiutoPagina;
