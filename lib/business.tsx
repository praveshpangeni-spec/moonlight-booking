"use client";

import { createContext, useContext, useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

// ── Tenant context for the admin ─────────────────────────────────────
// Resolves the logged-in owner's business (via business_users) and loads
// its settings + services. All admin pages read from this instead of
// hardcoded constants, and scope their queries by business.id.

export interface Business {
  id: string;
  slug: string;
  name: string;
  timezone: string;   // the business's storage timezone (Moonlight = America/Toronto)
  currency: string;
  status: "active" | "suspended";
  plan: string;
  valid_until: string | null;
}

export interface BusinessSettings {
  esewa_id: string | null;
  paypal_link: string | null;
  bank_details: string | null;
  whatsapp_number: string | null;
  wa_template: string | null;
  google_calendar_id: string | null;
  intl_usd_amount: number | null;
  intl_npr_amount: number | null;
}

export interface Service {
  id: string;
  key: string;
  name_en: string;
  name_ne: string | null;
  duration_minutes: number;
  price: number;
  active: boolean;
}

interface BusinessContextValue {
  biz: Business;
  settings: BusinessSettings;
  services: Service[];
  serviceByKey: (key: string) => Service | undefined;
}

const BusinessContext = createContext<BusinessContextValue | null>(null);

export function useBusiness(): BusinessContextValue {
  const ctx = useContext(BusinessContext);
  if (!ctx) throw new Error("useBusiness must be used inside BusinessProvider");
  return ctx;
}

export function BusinessProvider({ children }: { children: React.ReactNode }) {
  const [value, setValue] = useState<BusinessContextValue | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    const load = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return; // layout handles the login redirect

      const { data: bu } = await supabase
        .from("business_users").select("business_id")
        .eq("user_id", session.user.id).maybeSingle();
      if (!bu) { setError("This login is not linked to any business."); return; }

      const [{ data: biz }, { data: settings }, { data: services }] = await Promise.all([
        supabase.from("businesses").select("*").eq("id", bu.business_id).single(),
        supabase.from("business_settings").select("*").eq("business_id", bu.business_id).maybeSingle(),
        supabase.from("services").select("*").eq("business_id", bu.business_id).order("key"),
      ]);
      if (!biz) { setError("Business not found."); return; }

      setValue({
        biz: biz as Business,
        settings: (settings ?? {}) as BusinessSettings,
        services: (services ?? []) as Service[],
        serviceByKey: (key: string) => ((services ?? []) as Service[]).find(s => s.key === key),
      });
    };
    load();
  }, []);

  if (error) {
    return (
      <div className="min-h-screen bg-[#05060f] flex items-center justify-center p-6">
        <div className="cosmic-card p-8 text-center max-w-sm">
          <div className="text-3xl mb-3">✨</div>
          <p className="text-red-400 text-sm">{error}</p>
        </div>
      </div>
    );
  }

  if (!value) {
    return (
      <div className="min-h-screen bg-[#05060f] flex items-center justify-center">
        <div className="text-4xl animate-spin">✨</div>
      </div>
    );
  }

  // Suspension takes the admin offline (per design decision)
  if (value.biz.status === "suspended") {
    return (
      <div className="min-h-screen bg-[#05060f] flex items-center justify-center p-6">
        <div className="cosmic-card p-8 text-center max-w-sm">
          <div className="text-3xl mb-3">✨</div>
          <h2 className="text-white font-bold mb-2">Account Suspended</h2>
          <p className="text-slate-400 text-sm">
            {value.biz.name} is currently suspended. Please contact support to reactivate
            your subscription.
          </p>
        </div>
      </div>
    );
  }

  return <BusinessContext.Provider value={value}>{children}</BusinessContext.Provider>;
}
