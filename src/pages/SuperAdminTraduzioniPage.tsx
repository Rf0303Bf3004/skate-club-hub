import { Globe } from "lucide-react";
import TraduzioniTab from "@/components/superadmin/TraduzioniTab";

export default function SuperAdminTraduzioniPage() {
  return (
    <div className="p-4 lg:p-8 space-y-6">
      <div className="flex items-center gap-3">
        <Globe className="w-6 h-6 text-primary" />
        <div>
          <h1 className="text-xl font-bold text-foreground">Traduzioni</h1>
          <p className="text-xs text-muted-foreground">
            Modifica i testi dell'interfaccia in tutte le lingue supportate.
          </p>
        </div>
      </div>
      <TraduzioniTab />
    </div>
  );
}
