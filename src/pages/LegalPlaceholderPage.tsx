import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function LegalPlaceholderPage({ titolo }: { titolo: string }) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="w-full max-w-xl">
        <CardHeader>
          <CardTitle>{titolo}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm text-muted-foreground">
          <p>Versione finale in arrivo.</p>
          <p>Per info: <a className="text-primary underline" href="mailto:info@icearena.ch">info@icearena.ch</a></p>
          <p><a className="text-primary underline" href="/registrati">← Torna alla registrazione</a></p>
        </CardContent>
      </Card>
    </div>
  );
}
