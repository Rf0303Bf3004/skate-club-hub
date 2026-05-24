import React, { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { supabase } from "@/lib/supabase";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "@/hooks/use-toast";
import { ArrowLeft } from "lucide-react";

const SuperAdminClubDetailPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const { t } = useTranslation("superadmin");
  const navigate = useNavigate();
  const qc = useQueryClient();
  const today = new Date().toISOString().slice(0, 10);
  const [prezzo, set_prezzo] = useState<number>(5);

  const { data: club } = useQuery({
    queryKey: ["sa_club_detail", id],
    enabled: !!id,
    queryFn: async () => {
      const { data, error } = await supabase.from("clubs")
        .select("id, nome, citta, indirizzo, email, telefono, prezzo_per_atleta_chf")
        .eq("id", id!).maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  useEffect(() => {
    if (club) set_prezzo(Number(club.prezzo_per_atleta_chf ?? 5));
  }, [club]);

  const { data: fatture = [] } = useQuery({
    queryKey: ["sa_club_fatture", id],
    enabled: !!id,
    queryFn: async () => {
      const { data, error } = await supabase.from("fatture_clubs" as any)
        .select("*").eq("club_id", id!).order("periodo", { ascending: false });
      if (error) throw error;
      return (data ?? []) as any[];
    },
  });

  const salva_prezzo = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("clubs").update({ prezzo_per_atleta_chf: prezzo }).eq("id", id!);
      if (error) throw error;
    },
    onSuccess: () => {
      toast({ title: t("listino.salvato") });
      qc.invalidateQueries({ queryKey: ["sa_club_detail", id] });
      qc.invalidateQueries({ queryKey: ["sa_clubs"] });
    },
    onError: (e: any) => toast({ title: t("listino.errore"), description: String(e?.message ?? e), variant: "destructive" }),
  });

  const toggle_pagata = useMutation({
    mutationFn: async (f: any) => {
      const { error } = await supabase.from("fatture_clubs" as any)
        .update({ pagata: !f.pagata, data_pagamento: !f.pagata ? today : null })
        .eq("id", f.id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["sa_club_fatture", id] }),
  });

  if (!club) return <div className="p-6 text-muted-foreground">…</div>;

  return (
    <div className="p-6 space-y-6">
      <Button variant="ghost" size="sm" onClick={() => navigate("/superadmin")}>
        <ArrowLeft className="w-4 h-4 mr-2" />{t("club_detail.torna")}
      </Button>
      <div>
        <h1 className="text-2xl font-bold">{club.nome}</h1>
        <p className="text-sm text-muted-foreground">{club.citta || "—"}</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card>
          <CardHeader><CardTitle>{t("club_detail.anagrafica")}</CardTitle></CardHeader>
          <CardContent className="space-y-1 text-sm">
            <div><b>Indirizzo:</b> {club.indirizzo || "—"}</div>
            <div><b>Email:</b> {club.email || "—"}</div>
            <div><b>Telefono:</b> {club.telefono || "—"}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle>{t("club_detail.prezzo_label")}</CardTitle></CardHeader>
          <CardContent className="flex items-center gap-3">
            <Input type="number" step="0.01" min={0} value={prezzo}
              onChange={(e) => set_prezzo(parseFloat(e.target.value) || 0)} className="w-32" />
            <Button onClick={() => salva_prezzo.mutate()} disabled={salva_prezzo.isPending}>{t("listino.salva")}</Button>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader><CardTitle>{t("club_detail.storico")}</CardTitle></CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left text-xs uppercase text-muted-foreground">
                  <th className="py-2 px-3">Periodo</th>
                  <th className="py-2 px-3 text-right">Atleti</th>
                  <th className="py-2 px-3 text-right">Importo</th>
                  <th className="py-2 px-3">Scadenza</th>
                  <th className="py-2 px-3">Stato</th>
                  <th className="py-2 px-3"></th>
                </tr>
              </thead>
              <tbody>
                {fatture.map((f) => {
                  const scaduta = !f.pagata && f.data_scadenza < today;
                  return (
                    <tr key={f.id} className="border-b">
                      <td className="py-2 px-3 font-medium">{f.periodo}</td>
                      <td className="py-2 px-3 text-right tabular-nums">{f.n_atleti}</td>
                      <td className="py-2 px-3 text-right tabular-nums">CHF {Number(f.importo_chf).toFixed(2)}</td>
                      <td className="py-2 px-3">{f.data_scadenza}</td>
                      <td className="py-2 px-3">
                        <Badge className={f.pagata ? "bg-emerald-100 text-emerald-800" : scaduta ? "bg-red-100 text-red-800" : "bg-amber-100 text-amber-800"}>
                          {f.pagata ? `Pagata ${f.data_pagamento ?? ""}` : scaduta ? "Scaduta" : "Da pagare"}
                        </Badge>
                      </td>
                      <td className="py-2 px-3 text-right">
                        <Button size="sm" variant="outline" onClick={() => toggle_pagata.mutate(f)}>
                          {f.pagata ? t("club_detail.annulla_pagamento") : t("club_detail.marca_pagata")}
                        </Button>
                      </td>
                    </tr>
                  );
                })}
                {fatture.length === 0 && (
                  <tr><td colSpan={6} className="py-8 text-center text-muted-foreground">{t("tabellone.nessuna")}</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default SuperAdminClubDetailPage;
