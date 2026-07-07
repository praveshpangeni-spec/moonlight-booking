"use client";

import { useParams } from "next/navigation";
import { PublicBizProvider } from "@/lib/public-biz";
import PublicBookingApp from "@/components/PublicBookingApp";

// Per-business public booking page: /b/moonlight, /b/<any-slug>, …
export default function BusinessBookingPage() {
  const params = useParams<{ slug: string }>();
  const slug = (params?.slug || "").toLowerCase();

  return (
    <PublicBizProvider slug={slug}>
      <PublicBookingApp />
    </PublicBizProvider>
  );
}
