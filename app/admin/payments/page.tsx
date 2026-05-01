"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { format, startOfWeek, endOfWeek, startOfMonth, endOfMonth, subWeeks, subMonths } from "date-fns";
import { SERVICE_LABELS } from "@/lib/database.types";
import { Wallet, TrendingUp, Clock, CheckCircle, Search } from "lucide-react";

type Range = "this_week" | "last_week" | "this_month" | "last_month" | "all";

interface Payment {
  id: string;
  date: string;
  start_time: string;
  amount: number;
  service_type: string;
  payment_status: string;
  payment_method: string | null;
  payment_reference: string | null;
  status: string;
  clients: { name: string; phone: string } | null;
}

const RANGE_LABELS: { key: Range; label: string }[] = [
  { key: "this_week", label: "This Week" },
  { key: "last_week", label: "Last Week" },
  { key: "this_month", label: "This Month" },
  { key: "last_month", label: "Last Month" },
  { key: "all", label: "All Time" },
];

function getDateRange(range: Range): { from: string; to: string } | null {
  const now = new Date();
  if (range === "this_week") return {
    from: format(startOfWeek(now, { weekStartsOn: 0 }), "yyyy-MM-dd"),
    to: format(endOfWeek(now, { weekStartsOn: 0 }), "yyyy-MM-dd"),
  };
  if (range === "last_week") {
    const lw = subWeeks(now, 1);
    return {
      from: format(startOfWeek(lw, { weekStartsOn: 0 }), "yyyy-MM-dd"),
      to: format(endOfWeek(lw, { weekStartsOn: 0 }), "yyyy-MM-dd"),
    };
  }
  if (range === "this_month") return {
    from: format(startOfMonth(now), "yyyy-MM-dd"),
    to: format(endOfMonth(now), "yyyy-MM-dd"),
  };
  if (range === "last_month") {
    const lm = subMonths(now, 1);
    return {
      from: format(startOfMonth(lm), "yyyy-MM-dd"),
      to: format(endOfMonth(lm), "yyyy-MM-dd"),
    };
  }
  return null; // all time
}

export default function PaymentsPage() {
  const [payments, setPayments] = useState<Payment[]>([]);
  const [range, setRange] = useState<Range>("this_month");
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    let q = supabase
      .from("bookings")
      .select("id, date, start_time, amount, service_type, payment_status, payment_method, payment_reference, status, clients(name, phone)")
      .neq("status", "cancelled")
      .order("date", { ascending: false })
      .order("start_time", { ascending: false });

    const dr = getDateRange(range);
    if (dr) q = q.gte("date", dr.from).lte("date", dr.to);

    const { data } = await q;
    setPayments((data as Payment[]) || []);
    setLoading(false);
  };

  useEffect(() => { load(); }, [range]);

  const markPaid = async (id: string) => {
    await supabase.from("bookings").update({ payment_status: "paid" }).eq("id", id);
    load();
  };

  const fmt12 = (t: string) => {
    const [h, m] = t.split(":").map(Number);
    return `${h > 12 ? h - 12 : h === 0 ? 12 : h}:${String(m).padStart(2, "0")} ${h >= 12 ? "PM" : "AM"}`;
  };

  const filtered = payments.filter(p =>
    !search ||
    p.clients?.name.toLowerCase().includes(search.toLowerCase()) ||
    p.clients?.phone.includes(search)
  );

  const totalRevenue = filtered.filter(p => p.payment_status === "paid").reduce((s, p) => s + p.amount, 0);
  const unpaidRevenue = filtered.filter(p => p.payment_status === "unpaid").reduce((s, p) => s + p.amount, 0);
  const paidCount = filtered.filter(p => p.payment_status === "paid").length;
  const unpaidCount = filtered.filter(p => p.payment_status === "unpaid").length;

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <h1 className="text-2xl font-bold text-white mb-6">Payments</h1>

      {/* Range tabs */}
      <div className="flex gap-2 mb-5 overflow-x-auto pb-1">
        {RANGE_LABELS.map(({ key, label }) => (
          <button
            key={key}
            onClick={() => setRange(key)}
            className={`px-4 py-1.5 rounded-xl text-sm font-semibold whitespace-nowrap transition-all ${
              range === key ? "bg-purple-600 text-white" : "bg-[#0d0f1f] border border-[#1e2140] text-slate-400 hover:text-slate-200"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
        <div className="cosmic-card p-4 border-l-2 border-l-green-500">
          <p className="text-slate-500 text-xs mb-1">Collected</p>
          <p className="text-green-400 text-2xl font-bold">NPR {totalRevenue.toLocaleString()}</p>
          <p className="text-slate-600 text-xs mt-0.5">{paidCount} session{paidCount !== 1 ? "s" : ""}</p>
        </div>
        <div className="cosmic-card p-4 border-l-2 border-l-red-500">
          <p className="text-slate-500 text-xs mb-1">Pending</p>
          <p className="text-red-400 text-2xl font-bold">NPR {unpaidRevenue.toLocaleString()}</p>
          <p className="text-slate-600 text-xs mt-0.5">{unpaidCount} session{unpaidCount !== 1 ? "s" : ""}</p>
        </div>
        <div className="cosmic-card p-4 border-l-2 border-l-amber-500">
          <p className="text-slate-500 text-xs mb-1">Total Expected</p>
          <p className="text-amber-400 text-2xl font-bold">NPR {(totalRevenue + unpaidRevenue).toLocaleString()}</p>
          <p className="text-slate-600 text-xs mt-0.5">{filtered.length} total</p>
        </div>
        <div className="cosmic-card p-4 border-l-2 border-l-purple-500">
          <p className="text-slate-500 text-xs mb-1">Collection Rate</p>
          <p className="text-purple-300 text-2xl font-bold">
            {filtered.length > 0 ? Math.round((paidCount / filtered.length) * 100) : 0}%
          </p>
          <p className="text-slate-600 text-xs mt-0.5">paid on time</p>
        </div>
      </div>

      {/* Search */}
      <div className="flex items-center gap-2 bg-[#0d0f1f] border border-[#1e2140] rounded-xl px-4 py-2.5 mb-4">
        <Search size={16} className="text-slate-500" />
        <input
          className="bg-transparent flex-1 text-slate-200 text-sm outline-none placeholder:text-slate-600"
          placeholder="Search by name or phone..."
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
      </div>

      {/* Payment list */}
      {loading ? (
        <div className="text-center text-slate-500 py-12">Loading...</div>
      ) : filtered.length === 0 ? (
        <div className="cosmic-card p-12 text-center text-slate-500">No payments found</div>
      ) : (
        <div className="space-y-2">
          {filtered.map(p => {
            const service = SERVICE_LABELS[p.service_type as keyof typeof SERVICE_LABELS];
            const isPaid = p.payment_status === "paid";
            return (
              <div key={p.id} className="cosmic-card p-4 flex items-center gap-4">
                {/* Status icon */}
                <div className={`w-9 h-9 rounded-full flex items-center justify-center shrink-0 ${
                  isPaid ? "bg-green-500/20" : "bg-red-500/20"
                }`}>
                  {isPaid
                    ? <CheckCircle size={17} className="text-green-400" />
                    : <Clock size={17} className="text-red-400" />
                  }
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <p className="text-white font-semibold truncate">{p.clients?.name || "—"}</p>
                  <p className="text-slate-500 text-xs">
                    {format(new Date(p.date), "MMM d, yyyy")} · {fmt12(p.start_time)} · {service?.ne || p.service_type}
                  </p>
                </div>

                {/* Amount + action */}
                <div className="flex items-center gap-3 shrink-0">
                  <div className="text-right">
                    <p className="text-amber-400 font-bold text-sm">NPR {p.amount.toLocaleString()}</p>
                    <span className={`text-xs font-medium ${isPaid ? "text-green-400" : "text-red-400"}`}>
                      {isPaid ? "paid" : "unpaid"}
                    </span>
                  </div>
                  {!isPaid && (
                    <button
                      onClick={() => markPaid(p.id)}
                      className="flex items-center gap-1.5 text-xs font-semibold text-amber-400 bg-amber-500/10 border border-amber-500/30 px-3 py-1.5 rounded-lg hover:bg-amber-500/20 transition-all"
                    >
                      <Wallet size={13} /> Mark Paid
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
