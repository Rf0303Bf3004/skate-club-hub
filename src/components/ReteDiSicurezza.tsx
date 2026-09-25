import { Component, type ErrorInfo, type ReactNode } from "react";
import { AlertTriangle } from "lucide-react";
import i18n from "@/i18n";
import { Button } from "@/components/ui/button";
import { segnala_errore } from "@/lib/errori";

/**
 * Rete di sicurezza: cattura gli errori di render dei figli e mostra, al posto
 * del bianco, cosa si è interrotto con il messaggio tecnico visibile.
 * Registra l'accaduto in `errori_applicativi` una volta sola per errore
 * (componentDidCatch gira una volta per ogni errore catturato).
 * Per rimontarla al cambio pagina, passarle una `key` diversa.
 */
interface Props {
  children: ReactNode;
  /** Dove si trova la rete, per distinguere le righe nel registro. */
  dove: string;
}

interface Stato {
  errore: Error | null;
}

export default class ReteDiSicurezza extends Component<Props, Stato> {
  state: Stato = { errore: null };

  static getDerivedStateFromError(errore: Error): Stato {
    return { errore };
  }

  componentDidCatch(errore: Error, info: ErrorInfo) {
    void segnala_errore(
      this.props.dove,
      i18n.t("common:rete_sicurezza.operazione"),
      errore,
      {
        stack: errore.stack ?? null,
        component_stack: info.componentStack ?? null,
      },
      "errore",
    );
  }

  render() {
    const { errore } = this.state;
    if (!errore) return this.props.children;

    const testo_tecnico = `${errore.name}: ${errore.message}`;

    return (
      <div role="alert" className="flex min-h-[50vh] w-full items-center justify-center p-6">
        <div className="w-full max-w-xl space-y-4 rounded-lg border border-destructive/30 bg-card p-6 shadow-sm">
          <div className="flex items-start gap-3">
            <AlertTriangle className="mt-0.5 h-6 w-6 flex-shrink-0 text-destructive" />
            <div className="space-y-1">
              <p className="font-semibold text-foreground">{i18n.t("common:rete_sicurezza.titolo")}</p>
              <p className="text-sm text-muted-foreground">{i18n.t("common:rete_sicurezza.testo")}</p>
            </div>
          </div>
          <div className="space-y-1">
            <p className="text-xs font-medium text-muted-foreground">{i18n.t("common:rete_sicurezza.dettaglio_tecnico")}</p>
            <pre className="max-h-40 overflow-auto whitespace-pre-wrap break-words rounded-md border border-border bg-muted px-3 py-2 font-mono text-xs text-foreground">
              {testo_tecnico}
            </pre>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button onClick={() => window.location.reload()}>{i18n.t("common:rete_sicurezza.ricarica")}</Button>
            <Button variant="outline" onClick={() => window.location.assign("/")}>
              {i18n.t("common:rete_sicurezza.torna_home")}
            </Button>
          </div>
        </div>
      </div>
    );
  }
}
