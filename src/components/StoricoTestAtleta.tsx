import React from "react";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { supabase } from "@/lib/supabase";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { CheckCircle2, XCircle, Clock } from "lucide-react";

type Riga = {
  id: string;
  esito: string;
  note_istruttore: string | null;
  test_id: string;
  livello_accesso: string | null;
  livello_target: string | null;
  disciplina: string | null;
  test: {
    id: string;
    nome: string;
    data: string | null;
    tipo: string;
    luogo: string | null;
  } | null;
};

const ESITO_BADGE: Record<string, { key: string; cls: string; icon: React.ReactNode }> = {
  superato: { key: "storico_test.esito_superato", cls: "bg-green-100 text-green-800 border-green-200", icon: <CheckCircle2 className="w-3 h-3" /> },
  non_superato: { key: "storico_test.esito_non_superato", cls: "bg-destructive/10 text-destructive border-destructive/20", icon: <XCircle className="w-3 h-3" /> },
  in_attesa: { key: "storico_test.esito_in_attesa", cls: "bg-muted text-muted-foreground border-border", icon: <Clock className="w-3 h-3" /> },
};

interface Props {
  atleta_id: string;
}

export default function StoricoTestAtleta({ atleta_id }: Props) {
  const { t } = useTranslation("atleti");
  const { data: righe = [], isLoading } = useQuery({
    queryKey: ["storico_test_atleta", atleta_id],
    enabled: !!atleta_id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("test_livello_atleti")
        .select("id, esito, note_istruttore, test_id, livello_accesso, livello_target, disciplina, test:test_livello(id, nome, data, tipo, luogo)")
        .eq("atleta_id", atleta_id);
      if (error) throw error;
      const rows = (data ?? []) as unknown as Riga[];
      return rows.sort((a, b) => {
        const da = a.test?.data || "";
        const db = b.test?.data || "";
        return db.localeCompare(da);
      });
    },
  });

  if (isLoading) {
    return (
      <div className="flex justify-center py-8">
        <div className="h-6 w-6 animate-spin rounded-full border-b-2 border-primary" />
      </div>
    );
  }

  if (righe.length === 0) {
    return (
      <div className="bg-card rounded-xl shadow-card p-8 text-center text-muted-foreground text-sm">
        {t("storico_test.empty")}
      </div>
    );
  }

  return (
    <div className="bg-card rounded-xl shadow-card overflow-hidden">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>{t("storico_test.col_data")}</TableHead>
            <TableHead>{t("storico_test.col_test")}</TableHead>
            <TableHead>{t("storico_test.col_tipo")}</TableHead>
            <TableHead>{t("storico_test.col_livello")}</TableHead>
            <TableHead>{t("storico_test.col_risultato")}</TableHead>
            <TableHead>{t("storico_test.col_note")}</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {righe.map((r) => {
            const esito = ESITO_BADGE[r.esito] ?? ESITO_BADGE.in_attesa;
            return (
              <TableRow key={r.id}>
                <TableCell className="text-sm">
                  {r.test?.data ? new Date(r.test.data + "T00:00:00").toLocaleDateString("de-CH", { day: "2-digit", month: "2-digit", year: "numeric" }) : "—"}
                </TableCell>
                <TableCell className="font-medium text-sm">{r.test?.nome || "—"}</TableCell>
                <TableCell className="text-sm capitalize text-muted-foreground">{r.test?.tipo || "—"}</TableCell>
                <TableCell className="text-sm text-muted-foreground">
                  {r.livello_accesso || "?"} → {r.livello_target || "?"}
                  {r.disciplina ? <span className="ml-1 text-[10px] uppercase">({r.disciplina === "stile" ? "STI" : "ART"})</span> : null}
                </TableCell>
                <TableCell>
                  <Badge variant="outline" className={`gap-1 ${esito.cls}`}>
                    {esito.icon}
                    {t(esito.key)}
                  </Badge>
                </TableCell>
                <TableCell className="text-xs text-muted-foreground max-w-[200px] truncate">
                  {r.note_istruttore || "—"}
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}
