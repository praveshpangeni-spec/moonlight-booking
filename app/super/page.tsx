"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { superCall, type SuperBiz } from "@/lib/super";
import { Building2, Power, AlertTriangle, ExternalLink } from "lucide-react";

// Platform overview. Intentionally shows NO business bookings/clients/revenue —
// that data belongs to each owner's own admin login.

export default function SuperOverview() {
  const [businesses, setBusinesses] = useState<SuperBiz[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    superCall("list")
      .then(d => setBusinesses(d.businesses || []))
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  const active = businesses.filter(b => b.status === "active");
  const suspended = businesses.filter(b => b.status === "suspended");

  const today = new Date().toISOString().slice(0, 10);
  const in14 = new Date(Date.now() + 14 * 86400000).toISOString().slice(0, 10);
  const expiring = businesses.filter(b => b.valid_until && b.valid_until >= today && b.valid_until <= in14);
  const expired  = businesses.filter(b => b.valid_until && b.valid_until < today && b.status === "active");

  // Setup gaps that block a business from working fully
  const gaps = businesses.map(b => {
    const missing: string[] = [];
    if (!b.settings?.whatsapp_number) missing.push("WhatsApp");
    if (!b.settings?.google_calendar_id) missing.push("Calendar");
    if (!b.settings?.esewa_id && !b.settings?.paypal_link) missing.push("Payments");
    if ((b.services || []).filter(s => s.active).length === 0) missing.push("Services");
    return { b, missing };
  }).filter(g => g.missing.length > 0);

  if (loading) return <div className="p-10 text-center text-slate-500">Loading…</div>;

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <h1 className="text-2xl font-bold text-white mb-1">Overview</h1>
      <p className="text-slate-500 text-sm mb-6">Platform health at a glance</p>

      {error && <p className="text-red-400 text-sm mb-4">{error}</p>}

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4 mb-8">
        {[
          { label: "Businesses", value: businesses.length, color: "purple" },
          { label: "Active", value: active.length, color: "green" },
          { label: "Suspended", value: suspended.length, color: "red" },
        ].map(({ label, value, color }) => (
          <div key={label} className={`cosmic-card p-4 border-l-2 ${
            color === "purple" ? "border-l-purple-500" :
            color === "green" ? "border-l-green-500" : "border-l-red-500"
          }`}>
            <p className="text-slate-500 text-xs mb-1">{label}</p>
            <p className={`text-3xl font-bold ${
              color === "purple" ? "text-purple-300" :
              color === "green" ? "text-green-400" : "text-red-400"
            }`}>{value}</p>
          </div>
        ))}
      </div>

      {/* Subscription attention */}
      {(expired.length > 0 || expiring.length > 0) && (
        <div className="cosmic-card p-5 mb-6 border border-amber-500/30">
          <p className="text-amber-400 text-sm font-semibold flex items-center gap-2 mb-3">
            <AlertTriangle size={15} /> Subscription attention
          </p>
          <div className="space-y-2">
            {expired.map(b => (
              <div key={b.id} className="flex items-center justify-between text-sm">
                <span className="text-slate-300">{b.name}</span>
                <span className="text-red-400 text-xs">expired {b.valid_until} — still active</span>
              </div>
            ))}
            {expiring.map(b => (
              <div key={b.id} className="flex items-center justify-between text-sm">
                <span className="text-slate-300">{b.name}</span>
                <span className="text-amber-400 text-xs">renews by {b.valid_until}</span>
              </div>
            ))}
          </div>
          <Link href="/super/subscriptions" className="text-purple-400 text-xs mt-3 inline-block hover:text-purple-300">
            Manage subscriptions →
          </Link>
        </div>
      )}

      {/* Setup gaps */}
      {gaps.length > 0 && (
        <div className="cosmic-card p-5 mb-6">
          <p className="text-slate-400 text-sm font-semibold mb-3">Incomplete setup</p>
          <div className="space-y-2">
            {gaps.map(({ b, missing }) => (
              <div key={b.id} className="flex items-center justify-between text-sm">
                <span className="text-slate-300">{b.name}</span>
                <span className="text-slate-500 text-xs">missing: {missing.join(", ")}</span>
              </div>
            ))}
          </div>
          <Link href="/super/businesses" className="text-purple-400 text-xs mt-3 inline-block hover:text-purple-300">
            Fix in Businesses →
          </Link>
        </div>
      )}

      {/* Business list (light) */}
      <div className="cosmic-card p-5">
        <div className="flex items-center justify-between mb-3">
          <p className="text-slate-400 text-sm font-semibold flex items-center gap-2">
            <Building2 size={15} /> All businesses
          </p>
          <Link href="/super/businesses" className="text-purple-400 text-xs hover:text-purple-300">Manage →</Link>
        </div>
        <div className="divide-y divide-[#1e2140]">
          {businesses.map(b => (
            <div key={b.id} className="flex items-center gap-3 py-2.5 text-sm">
              <div className="flex-1 min-w-0">
                <p className="text-slate-200 truncate">{b.name}</p>
                <p className="text-slate-600 text-xs">{b.owner_email || "no owner"} · since {b.created_at?.slice(0, 10)}</p>
              </div>
              <a href={`/b/${b.slug}`} target="_blank" className="text-slate-500 hover:text-purple-400 shrink-0" title="Booking page">
                <ExternalLink size={14} />
              </a>
              <span className={`text-xs px-2 py-0.5 rounded-full font-medium shrink-0 ${
                b.status === "active" ? "bg-green-500/20 text-green-400" : "bg-red-500/20 text-red-400"
              }`}>
                <Power size={10} className="inline mr-1" />{b.status}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
