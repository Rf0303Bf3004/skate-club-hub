import React, { useMemo, useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { supabase } from "@/lib/supabase";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { toast } from "@/hooks/use-toast";

type ClubRow = { id: string; nome: string; prezzo_per_atleta_chf: number };

const SuperAdminListinoPage: React.FC = () => {
  const { t } = useTranslation("superadmin");
  const qc = useQueryClient();
  const [search, set_search] = useState("");
  const [dirty, set_dirty] = useState<Record<string, number>>({});

  const { data: clubs = [] } = useQuery({
    queryKey: ["sa_listino"],
    queryFn: async () => {
      const { data, error } = await supabase.from("clubs").select("id, nome, prezzo_per_atleta_chf").order("nome");
      if (error) throw error;
      return (data ?? []) as ClubRow[];
    },
  });

  useEffect(() => { set_dirty({}); }, [clubs]);

  const salva = useMutation({
    mutationFn: async ({ id, prezzo }: { id: string; prezzo: number }) => {
      const { error } = await supabase.from("clubs").update({ prezzo_per_atleta_chf: prezzo }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: (_d, v) => {
      toast({ title: t("listino.salvato") });
      set_dirty((s) => { const c = { ...s }; delete c[v.id]; return c; });
      qc.invalidateQueries({ queryKey: ["sa_listino"] });
      qc.invalidateQueries({ queryKey: ["sa_clubs"] });
    },
    onError: (e: any) => toast({ title: t("listino.errore"), description: String(e?.message ?? e), variant: "destructive" }),
  });

  const filtrati = useMemo(() => {
    const q = search.trim().toLowerCase();
    return clubs.filter((c) => !q || c.nome.toLowerCase().includes(q));
  }, [clubs, search]);

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold">{t("listino.title")}</h1>
        <p className="text-sm text-muted-foreground">{t("listino.subtitle")}</p>
      </div>
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <CardTitle>{t("dashboard.lista_club")}</CardTitle>
            <Input value={search} onChange={(e) => set_search(e.target.value)} placeholder={t("dashboard.cerca")} className="max-w-xs" />
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {filtrati.map((c) => {
              const val = dirty[c.id] ?? Number(c.prezzo_per_atleta_chf ?? 5);
              const cambiato = dirty[c.id] !== undefined && dirty[c.id] !== Number(c.prezzo_per_atleta_chf);
              return (
                <div key={c.id} className="flex items-center gap-3 p-3 border rounded-lg">
                  <div className="flex-1 font-medium">{c.nome}</div>
                  <Input
                    type="number" step="0.01" min={0} className="w-32"
                    value={val}
                    onChange={(e) => set_dirty((s) => ({ ...s, [c.id]: parseFloat(e.target.value) || 0 }))}
                  />
                  <span className="text-xs text-muted-foreground">CHF/atleta/mese</span>
                  <Button size="sm" disabled={!cambiato || salva.isPending}
                    onClick={() => salva.mutate({ id: c.id, prezzo: val })}>
                    {t("listino.salva")}
                  </Button>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default SuperAdminListinoPage;
