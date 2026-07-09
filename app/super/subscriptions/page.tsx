"use client";

import { useEffect, useState } from "react";
import { superCall, type SuperBiz } from "@/lib/super";
import { Save, Power, CalendarPlus } from "lucide-react";

// Flat-fee subscription management: plan label, paid-until date, status.
// "Extend 1 month" is the quick action when a business pays.

const inputCls = "bg-[#0a0b1a] border border-[#1e2140] rounded-xl px-3 py-2 text-slate-200 text-sm outline-none focus:border-purple-500 transition-all";

function addMonths(dateStr: string | null, months: number): string {
  const base = dateStr && dateStr >= new Date().toISOString().slice(0, 10)
    ? new Date(dateStr + "T12:00:00")
    : new Date();
  base.setMonth(base.getMonth() + months);
  return base.toISOString().slice(0, 10);
}

export default function SubscriptionsPage() {
  const [businesses, setBusinesses] = useState<SuperBiz[]>([]);
  const [buf, setBuf] = useState<Record<string, { plan: string; valid_until: string }>>({});
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const load = async () => {
    setLoading(true);
    try {
      const list: SuperBiz[] = (await superCall("list")).businesses || [];
      setBusinesses(list);
      const b: Record<string, { plan: string; valid_until: string }> = {};
      for (const biz of list) b[biz.id] = { plan: biz.plan || "flat", valid_until: biz.valid_until || "" };
      setBuf(b);
    } catch (e: any) { setError(e.message); }
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const run = async (fn: () => Promise<unknown>, msg?: string) => {
    setError(""); setNotice(""); setBusy(true);
    try { await fn(); await load(); if (msg) setNotice(msg); }
    catch (e: any) { setError(e.message); }
    setBusy(false);
  };

  const save = (b: SuperBiz) => run(
    () => superCall("update-business", { businessId: b.id, fields: buf[b.id] }),
    `${b.name} updated.`,
  );

  const extend = (b: SuperBiz) => {
    const next = addMonths(b.valid_until, 1);
    run(async () => {
      await superCall("update-business", { businessId: b.id, fields: { valid_until: next } });
      if (b.status !== "active") await superCall("set-status", { businessId: b.id, status: "active" });
    }, `${b.name} paid until ${next}.`);
  };

  const toggleStatus = (b: SuperBiz) => {
    const to = b.status === "active" ? "suspended" : "active";
    if (!confirm(`${to === "suspended" ? "Suspend" : "Activate"} ${b.name}?`)) return;
    run(() => superCall("set-status", { businessId: b.id, status: to }));
  };

  const today = new Date().toISOString().slice(0, 10);

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <h1 className="text-2xl font-bold text-white mb-1">Subscriptions</h1>
      <p className="text-slate-500 text-sm mb-6">Flat fee · extend when a business pays · suspend when they don&apos;t</p>

      {error && <p className="text-red-400 text-sm mb-4">{error}</p>}
      {notice && <p className="text-green-400 text-sm mb-4">{notice}</p>}

      {loading ? (
        <div className="text-center text-slate-500 py-10">Loading…</div>
      ) : (
        <div className="space-y-3">
          {businesses.map(b => {
            const v = buf[b.id] || { plan: "flat", valid_until: "" };
            const overdue = b.valid_until && b.valid_until < today;
            return (
              <div key={b.id} className={`cosmic-card p-4 ${overdue && b.status === "active" ? "border border-amber-500/40" : ""}`}>
                <div className="flex flex-wrap items-center gap-3">
                  <div className="flex-1 min-w-[160px]">
                    <p className="text-white font-semibold">{b.name}</p>
                    <p className="text-slate-600 text-xs">{b.owner_email || "no owner"}</p>
                  </div>
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                    b.status === "active" ? "bg-green-500/20 text-green-400" : "bg-red-500/20 text-red-400"
                  }`}>{b.status}</span>
                  {overdue && <span className="text-amber-400 text-xs font-medium">payment overdue</span>}
                </div>

                <div className="flex flex-wrap items-end gap-2 mt-3">
                  <div>
                    <label className="text-slate-600 text-[10px] block mb-0.5">plan</label>
                    <input className={`${inputCls} w-24`} value={v.plan}
                      onChange={e => setBuf(p => ({ ...p, [b.id]: { ...v, plan: e.target.value } }))} />
                  </div>
                  <div>
                    <label className="text-slate-600 text-[10px] block mb-0.5">paid until</label>
                    <input className={inputCls} type="date" style={{ colorScheme: "dark" }} value={v.valid_until}
                      onChange={e => setBuf(p => ({ ...p, [b.id]: { ...v, valid_until: e.target.value } }))} />
                  </div>
                  <button onClick={() => save(b)} disabled={busy}
                    className="flex items-center gap-1.5 text-xs font-semibold text-purple-300 bg-purple-500/10 border border-purple-500/30 px-3 py-2 rounded-lg hover:bg-purple-500/20 transition-all">
                    <Save size={13} /> Save
                  </button>
                  <button onClick={() => extend(b)} disabled={busy}
                    className="flex items-center gap-1.5 text-xs font-semibold text-green-400 bg-green-500/10 border border-green-500/30 px-3 py-2 rounded-lg hover:bg-green-500/20 transition-all">
                    <CalendarPlus size={13} /> Extend 1 month
                  </button>
                  <button onClick={() => toggleStatus(b)} disabled={busy}
                    className={`flex items-center gap-1.5 text-xs font-semibold px-3 py-2 rounded-lg border transition-all ${
                      b.status === "active"
                        ? "text-red-400 bg-red-500/10 border-red-500/30 hover:bg-red-500/20"
                        : "text-green-400 bg-green-500/10 border-green-500/30 hover:bg-green-500/20"
                    }`}>
                    <Power size={13} /> {b.status === "active" ? "Suspend" : "Activate"}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
