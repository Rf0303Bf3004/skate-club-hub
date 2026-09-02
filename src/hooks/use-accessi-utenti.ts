import { useQuery } from "@tanstack/react-query";
import { supabase, get_current_club_id } from "@/lib/supabase";

/** Mappa user_id → email degli account del club (per mostrare il legame scheda ↔ accesso). */
export function use_email_utenti_club() {
  const club_id = get_current_club_id();
  return useQuery({
    queryKey: ["email_utenti_club", club_id],
    enabled: !!club_id,
    queryFn: async () => {
      const mappa = new Map<string, string>();
      const { data: righe, error } = await supabase
        .from("utenti_club")
        .select("user_id")
        .eq("club_id", club_id);
      if (error || !righe?.length) return mappa;
      const { data: sess } = await supabase.auth.getSession();
      const r = await supabase.functions.invoke("manage-user", {
        body: { action: "list_auth_info", club_id, user_ids: righe.map((x: any) => x.user_id) },
        headers: sess.session ? { Authorization: `Bearer ${sess.session.access_token}` } : {},
      });
      const users = (r.data as any)?.users as Record<string, { email: string | null }> | undefined;
      for (const [uid, info] of Object.entries(users ?? {})) {
        if (info?.email) mappa.set(uid, info.email);
      }
      return mappa;
    },
  });
}
