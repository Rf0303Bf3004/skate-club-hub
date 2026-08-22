import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useTranslation } from "react-i18next";

export default function LegalPlaceholderPage({ titolo }: { titolo: string }) {
  const { t } = useTranslation("common");
  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="w-full max-w-xl">
        <CardHeader>
          <CardTitle>{titolo}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm text-muted-foreground">
          <p>{t("legal.coming_soon")}</p>
          <p>{t("legal.info")}: <a className="text-primary underline" href="mailto:info@icearena.ch">info@icearena.ch</a></p>
          <p><a className="text-primary underline" href="/registrati">{t("legal.back_register")}</a></p>
        </CardContent>
      </Card>
    </div>
  );
}
