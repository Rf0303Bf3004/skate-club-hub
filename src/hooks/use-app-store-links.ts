import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";

export interface AppStoreLinks {
  ios_store_url: string;
  android_store_url: string;
}

/**
 * Unica fonte di verità per gli indirizzi degli store dell'app mobile.
 * Gestiti dal superadmin nella tabella `impostazioni_app_mobile`.
 * Se la riga manca o i campi sono vuoti, ritorna stringhe vuote.
 */
export function use_app_store_links() {
  const query = useQuery({
    queryKey: ["impostazioni_app_mobile"],
    queryFn: async (): Promise<AppStoreLinks> => {
      const { data } = await supabase
        .from("impostazioni_app_mobile")
        .select("ios_store_url, android_store_url")
        .limit(1)
        .maybeSingle();
      return {
        ios_store_url: (data?.ios_store_url ?? "").trim(),
        android_store_url: (data?.android_store_url ?? "").trim(),
      };
    },
    staleTime: 5 * 60 * 1000,
  });

  return {
    ios_store_url: query.data?.ios_store_url ?? "",
    android_store_url: query.data?.android_store_url ?? "",
    is_loading: query.isLoading,
  };
}
