import { Smartphone } from "lucide-react";
import AppMobileTab from "@/components/superadmin/AppMobileTab";

export default function SuperAdminAppMobilePage() {
  return (
    <div className="p-4 lg:p-8 space-y-6 max-w-5xl">
      <div className="flex items-center gap-3">
        <Smartphone className="w-6 h-6 text-primary" />
        <div>
          <h1 className="text-xl font-bold text-foreground">App Mobile</h1>
          <p className="text-xs text-muted-foreground">
            Gestisci i link agli store dell'app Ice Arena mostrati nella scheda genitori.
          </p>
        </div>
      </div>
      <AppMobileTab />
    </div>
  );
}
