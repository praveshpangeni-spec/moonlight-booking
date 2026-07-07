"use client";

import { createContext, useContext, useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import type { Business, BusinessSettings, Service } from "@/lib/business";

// ── Public (anon) tenant context for /b/[slug] booking pages ─────────
// RLS only exposes ACTIVE businesses to anon, so a suspended business
// naturally resolves to "not found" — taking its public page offline.

interface PublicBizValue {
  biz: Business;
  settings: BusinessSettings;
  services: Service[];
}

const PublicBizContext = createContext<PublicBizValue | null>(null);

export function usePublicBiz(): PublicBizValue {
  const ctx = useContext(PublicBizContext);
  if (!ctx) throw new Error("usePublicBiz must be used inside PublicBizProvider");
  return ctx;
}

export function PublicBizProvider({ slug, children }: { slug: string; children: React.ReactNode }) {
  const [value, setValue] = useState<PublicBizValue | null>(null);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    const load = async () => {
      const { data: biz } = await supabase
        .from("businesses").select("*").eq("slug", slug).maybeSingle();
      if (!biz) { setNotFound(true); return; }

      const [{ data: settings }, { data: services }] = await Promise.all([
        supabase.from("business_settings").select("*").eq("business_id", biz.id).maybeSingle(),
        supabase.from("services").select("*").eq("business_id", biz.id).eq("active", true).order("key"),
      ]);

      setValue({
        biz: biz as Business,
        settings: (settings ?? {}) as BusinessSettings,
        services: (services ?? []) as Service[],
      });
    };
    load();
  }, [slug]);

  if (notFound) {
    return (
      <div className="min-h-screen bg-cosmic-gradient flex items-center justify-center px-6">
        <div className="cosmic-card p-8 text-center max-w-sm">
          <div className="text-4xl mb-3">🌙</div>
          <h2 className="text-white font-bold text-lg mb-2">Booking Unavailable</h2>
          <p className="text-slate-400 text-sm">
            This booking page doesn&apos;t exist or is currently offline.
          </p>
        </div>
      </div>
    );
  }

  if (!value) {
    return (
      <div className="min-h-screen bg-cosmic-gradient flex items-center justify-center">
        <div className="text-4xl animate-spin">🌙</div>
      </div>
    );
  }

  return <PublicBizContext.Provider value={value}>{children}</PublicBizContext.Provider>;
}
