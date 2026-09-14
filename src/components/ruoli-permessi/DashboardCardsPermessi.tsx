import React, { useMemo, useState } from "react";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/lib/supabase";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "@/hooks/use-toast";
import { Save, RotateCcw, LayoutDashboard } from "lucide-react";
import { Button } from "@/components/ui/button";
import ConfirmButton from "@/components/common/ConfirmButton";
import { Switch } from "@/components/ui/switch";
import { useTranslation } from "react-i18next";
import {
  CARDS,
  GRUPPI,
  RUOLI_DASHBOARD,
  CARDS_DEFAULT_PER_RUOLO,
  card_visibile_di_default,
  type GruppoDashboard,
} from "@/config/dashboardCards";

const DashboardCardsPermessi: React.FC = () => {
  const { t } = useTranslation("settings");
  const { session } = useAuth();
  const qc = useQueryClient();
  const club_id = session?.club_id;
  const [saving, set_saving] = useState(false);
  const [matrix, set_matrix] = useState<Record<string, Record<string, boolean>>>({});

  const { data: righe, isLoading, isError, refetch } = useQuery({
    queryKey: ["dashboard_card_permessi_admin", club_id],
    enabled: !!club_id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("dashboard_card_permessi")
        .select("ruolo, codice_card, visibile")
        .eq("club_id", club_id!);
      if (error) throw error;
      return data ?? [];
    },
  });

  // La matrice si popola dai dati, non dentro la queryFn: al rientro da cache
  // la queryFn non rigira e lo stato resterebbe vuoto.
  React.useEffect(() => {
    if (!righe) return;
    const m: Record<string, Record<string, boolean>> = {};
    for (const r of RUOLI_DASHBOARD) {
      m[r.codice] = {};
      for (const c of CARDS) {
        const row = righe.find((x) => x.ruolo === r.codice && x.codice_card === c.codice);
        // Nessuna riga = mai configurato: valgono i valori di partenza.
        m[r.codice][c.codice] = row ? !!row.visibile : card_visibile_di_default(r.codice, c.codice);
      }
    }
    set_matrix(m);
  }, [righe]);

  const cards_per_gruppo = useMemo(() => {
    const map = new Map<GruppoDashboard, typeof CARDS>();
    for (const g of GRUPPI) map.set(g.codice, []);
    for (const c of CARDS) map.get(c.gruppo)!.push(c);
    return map;
  }, []);

  const toggle = (ruolo: string, codice_card: string) => {
    set_matrix((prev) => ({
      ...prev,
      [ruolo]: { ...prev[ruolo], [codice_card]: !prev[ruolo]?.[codice_card] },
    }));
  };

  const salva = async () => {
    if (!club_id) return;
    set_saving(true);
    try {
      const rows = RUOLI_DASHBOARD.flatMap((r) =>
        CARDS.map((c) => ({
          club_id,
          ruolo: r.codice,
          codice_card: c.codice,
          visibile: matrix[r.codice]?.[c.codice] ?? card_visibile_di_default(r.codice, c.codice),
        })),
      );
      const { error } = await supabase
        .from("dashboard_card_permessi")
        .upsert(rows, { onConflict: "club_id,ruolo,codice_card" });
      if (error) throw error;
      // Righe con codici che non esistono più: via, o restano in tabella e
      // fanno risultare «configurato» anche dove non lo è.
      const { error: err_vecchie } = await supabase
        .from("dashboard_card_permessi")
        .delete()
        .eq("club_id", club_id)
        .not("codice_card", "in", `(${TUTTI_I_CODICI.join(",")})`);
      if (err_vecchie) throw err_vecchie;
      qc.invalidateQueries({ queryKey: ["dashboard_card_permessi_admin"] });
      qc.invalidateQueries({ queryKey: ["dashboard_card_permessi_self"] });
      toast({ title: t("roles.dashboard_cards.toast_saved_title"), description: t("roles.dashboard_cards.toast_saved_desc") });
    } catch (err: any) {
      toast({ title: t("roles.dashboard_cards.toast_error"), description: err?.message, variant: "destructive" });
    } finally {
      set_saving(false);
    }
  };

  const ripristina = async () => {
    if (!club_id) return;
    set_saving(true);
    try {
      const { error: err_del } = await supabase.from("dashboard_card_permessi").delete().eq("club_id", club_id);
      if (err_del) throw err_del;
      const m: Record<string, Record<string, boolean>> = {};
      const rows = RUOLI_DASHBOARD.flatMap((r) => {
        m[r.codice] = {};
        const def = CARDS_DEFAULT_PER_RUOLO[r.codice] ?? [];
        return CARDS.map((c) => {
          const visibile = def.includes(c.codice);
          m[r.codice][c.codice] = visibile;
          return { club_id, ruolo: r.codice, codice_card: c.codice, visibile };
        });
      });
      const { error } = await supabase
        .from("dashboard_card_permessi")
        .upsert(rows, { onConflict: "club_id,ruolo,codice_card" });
      if (error) throw error;
      set_matrix(m);
      qc.invalidateQueries({ queryKey: ["dashboard_card_permessi_admin"] });
      qc.invalidateQueries({ queryKey: ["dashboard_card_permessi_self"] });
      toast({ title: t("roles.dashboard_cards.toast_reset_done") });
    } catch (err: any) {
      toast({ title: t("roles.dashboard_cards.toast_error"), description: err?.message, variant: "destructive" });
    } finally {
      set_saving(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-32">
        <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary" />
      </div>
    );
  }

  if (isError) {
    return (
      <div className="rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 space-y-2">
        <p className="text-sm text-amber-900">{t("roles.dashboard_cards.errore_lettura")}</p>
        <Button size="sm" variant="outline" onClick={() => refetch()}>
          {t("roles.dashboard_cards.riprova")}
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
        <div className="flex items-center gap-3">
          <LayoutDashboard className="w-5 h-5 text-primary" />
          <div>
            <h2 className="text-lg font-bold text-foreground">{t("roles.dashboard_cards.title")}</h2>
            <p className="text-xs text-muted-foreground">
              {t("roles.dashboard_cards.subtitle")}
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          <ConfirmButton
            titolo={t("roles.dashboard_cards.reset_confirm_title")}
            descrizione={t("roles.dashboard_cards.reset_confirm_desc")}
            conferma_label={t("roles.dashboard_cards.reset_confirm_cta")}
            on_conferma={() => { void ripristina(); }}
          >
            <Button variant="outline" size="sm" disabled={saving} className="gap-2">
              <RotateCcw className="w-4 h-4" />
              {t("roles.dashboard_cards.reset")}
            </Button>
          </ConfirmButton>
          <Button size="sm" onClick={salva} disabled={saving} className="gap-2">
            <Save className="w-4 h-4" />
            {saving ? t("roles.dashboard_cards.saving") : t("roles.dashboard_cards.save")}
          </Button>
        </div>
      </div>

      <div className="rounded-xl border border-blue-200 bg-blue-50 px-4 py-3">
        <p className="text-xs text-blue-800">{t("roles.dashboard_cards.effetto_reale")}</p>
        <p className="text-xs text-blue-800 mt-1">{t("roles.dashboard_cards.presidente_a_parte")}</p>
      </div>

      <div className="bg-card rounded-xl shadow-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px]">
            <thead>
              <tr className="border-b border-border bg-muted/30">
                <th className="text-left px-4 py-3 text-xs font-bold text-muted-foreground uppercase tracking-wide w-[42%]">{t("roles.dashboard_cards.column_card")}</th>
                {RUOLI_DASHBOARD.map((r) => (
                  <th key={r.codice} className="text-center px-3 py-3 text-xs font-bold text-muted-foreground uppercase tracking-wide">
                    {t(r.chiave_label)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {GRUPPI.map((gruppo) => {
                const gruppo_cards = cards_per_gruppo.get(gruppo.codice) ?? [];
                return (
                  <React.Fragment key={gruppo.codice}>
                    <tr className={`border-b ${gruppo.classi_intestazione}`}>
                      <td colSpan={1 + RUOLI_DASHBOARD.length} className="px-4 py-2 text-xs font-bold uppercase tracking-wide">
                        {t(gruppo.chiave_label)}
                      </td>
                    </tr>
                    {gruppo_cards.map((c, idx) => (
                      <tr key={c.codice} className={`border-b border-border/50 ${idx % 2 === 0 ? "bg-background" : "bg-muted/10"}`}>
                        <td className="px-4 py-2.5">
                          <div className="text-sm font-medium text-foreground">
                            {t(`roles.dashboard_cards.cards.${c.codice}.titolo`)}
                          </div>
                          <div className="text-xs text-muted-foreground">
                            {t(`roles.dashboard_cards.cards.${c.codice}.descrizione`)}
                          </div>
                          {!c.destinazione && (
                            <div className="text-[11px] text-muted-foreground/80 mt-0.5">
                              {t("roles.dashboard_cards.non_cliccabile")}
                            </div>
                          )}
                        </td>
                        {RUOLI_DASHBOARD.map((r) => (
                          <td key={r.codice} className="px-3 py-2.5 text-center">
                            <div className="inline-flex">
                              <Switch
                                checked={matrix[r.codice]?.[c.codice] ?? false}
                                onCheckedChange={() => toggle(r.codice, c.codice)}
                              />
                            </div>
                          </td>
                        ))}
                      </tr>
                    ))}
                  </React.Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
        <p className="text-xs text-blue-600">
          {t("roles.dashboard_cards.note")}
        </p>
      </div>
    </div>
  );
};

export default DashboardCardsPermessi;
