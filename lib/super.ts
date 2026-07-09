import { supabase } from "@/lib/supabase";

// Call the super-admin API with the current session's token.
export async function superCall(action: string, payload: Record<string, unknown> = {}) {
  const { data: { session } } = await supabase.auth.getSession();
  const res = await fetch("/api/superadmin", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${session?.access_token}` },
    body: JSON.stringify({ action, ...payload }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data?.error || "request failed");
  return data;
}

export interface SuperSvc {
  id: string; key: string; name_en: string; name_ne: string | null;
  duration_minutes: number; price: number; active: boolean;
}

export interface SuperBiz {
  id: string; slug: string; name: string; timezone: string; currency: string;
  status: string; plan: string; valid_until: string | null; created_at: string;
  owner_email: string | null;
  settings: any; services: SuperSvc[];
}
