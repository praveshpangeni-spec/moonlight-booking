"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { format } from "date-fns";
import { SERVICE_LABELS } from "@/lib/database.types";
import { CheckCircle, Clock, Wallet, RefreshCw, MessageCircle } from "lucide-react";

interface Booking {
  id: string;
  date: string;
  start_time: string;
  duration_minutes: number;
  status: string;
  payment_status: string;
  amount: number;
  service_type: string;
  clients: { name: string; phone: string } | null;
}

export default function AdminDashboard() {
  const [todayBookings, setTodayBookings] = useState<Booking[]>([]);
  const [stats, setStats] = useState({ today: 0, pending: 0, unpaid: 0 });
  const [loading, setLoading] = useState(true);

  const load = async () => {
    const today = format(new Date(), "yyyy-MM-dd");

    const [{ data: todayData }, { data: pending }, { data: unpaid }] = await Promise.all([
      supabase.from("bookings").select("*, clients(name, phone)").eq("date", today).neq("status", "cancelled").order("start_time"),
      supabase.from("bookings").select("id").eq("status", "pending"),
      supabase.from("bookings").select("id").eq("payment_status", "unpaid").neq("status", "cancelled"),
    ]);

    setTodayBookings((todayData as Booking[]) || []);
    setStats({ today: todayData?.length || 0, pending: pending?.length || 0, unpaid: unpaid?.length || 0 });
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const confirm = async (id: string) => {
    await supabase.from("bookings").update({ status: "confirmed" }).eq("id", id);
    load();
  };

  const markPaid = async (id: string) => {
    await supabase.from("bookings").update({ payment_status: "paid" }).eq("id", id);
    load();
  };

  const fmt12 = (t: string) => {
    const [h, m] = t.split(":").map(Number);
    return `${h > 12 ? h - 12 : h === 0 ? 12 : h}:${String(m).padStart(2, "0")} ${h >= 12 ? "PM" : "AM"}`;
  };

  const wa = (phone: string, name: string) => {
    const msg = encodeURIComponent(`नमस्ते ${name}! तपाईंको Moonlight Astrology मा सत्र पुष्टि भएको छ। 🌙`);
    window.open(`https://wa.me/977${phone.replace(/^0/, "")}?text=${msg}`, "_blank");
  };

  return (
    <div className="p-6 max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-white">Dashboard</h1>
          <p className="text-slate-500 text-sm">{format(new Date(), "EEEE, MMMM d, yyyy")}</p>
        </div>
        <button onClick={load} className="text-slate-400 hover:text-white transition-colors p-2 rounded-xl hover:bg-white/5">
          <RefreshCw size={18} />
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4 mb-8">
        {[
          { label: "Today's Sessions", value: stats.today, icon: Clock, color: "purple" },
          { label: "Pending Confirm", value: stats.pending, icon: Clock, color: "amber" },
          { label: "Awaiting Payment", value: stats.unpaid, icon: Wallet, color: "red" },
        ].map(({ label, value, icon: Icon, color }) => (
          <div key={label} className={`cosmic-card p-4 border-l-2 ${
            color === "purple" ? "border-l-purple-500" : color === "amber" ? "border-l-amber-500" : "border-l-red-500"
          }`}>
            <p className="text-slate-500 text-xs mb-1">{label}</p>
            <p className={`text-3xl font-bold ${
              color === "purple" ? "text-purple-300" : color === "amber" ? "text-amber-400" : "text-red-400"
            }`}>{value}</p>
          </div>
        ))}
      </div>

      {/* Today's sessions */}
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold text-white">Today's Sessions</h2>
        <span className="text-slate-500 text-sm">{format(new Date(), "MMM d")}</span>
      </div>

      {loading ? (
        <div className="cosmic-card p-12 text-center text-slate-500">Loading...</div>
      ) : todayBookings.length === 0 ? (
        <div className="cosmic-card p-12 text-center">
          <p className="text-slate-400 text-lg mb-1">No sessions today</p>
          <p className="text-slate-600 text-sm">Enjoy your day! 🌙</p>
        </div>
      ) : (
        <div className="space-y-3">
          {todayBookings.map((b) => {
            const service = SERVICE_LABELS[b.service_type as keyof typeof SERVICE_LABELS];
            return (
              <div key={b.id} className="cosmic-card p-4">
                <div className="flex items-start gap-4">
                  {/* Time */}
                  <div className="text-center min-w-[60px]">
                    <p className="text-purple-300 font-bold text-sm">{fmt12(b.start_time)}</p>
                    <p className="text-slate-600 text-xs">{b.duration_minutes}m</p>
                  </div>

                  {/* Info */}
                  <div className="flex-1">
                    <p className="text-white font-semibold">{b.clients?.name || "—"}</p>
                    <p className="text-slate-400 text-sm">{service?.ne || b.service_type}</p>
                  </div>

                  {/* Amount + badges */}
                  <div className="text-right space-y-1">
                    <p className="text-amber-400 font-bold">NPR {b.amount.toLocaleString()}</p>
                    <span className={`inline-block text-xs px-2 py-0.5 rounded-full font-medium ${
                      b.status === "confirmed" ? "bg-green-500/20 text-green-400" :
                      b.status === "completed" ? "bg-slate-500/20 text-slate-400" :
                      "bg-amber-500/20 text-amber-400"
                    }`}>
                      {b.status}
                    </span>
                    <span className={`block text-xs px-2 py-0.5 rounded-full font-medium ${
                      b.payment_status === "paid" ? "bg-green-500/20 text-green-400" : "bg-red-500/20 text-red-400"
                    }`}>
                      {b.payment_status}
                    </span>
                  </div>
                </div>

                {/* Action buttons */}
                <div className="flex gap-2 mt-3 pt-3 border-t border-[#1e2140]">
                  {b.status === "pending" && (
                    <button
                      onClick={() => confirm(b.id)}
                      className="flex items-center gap-1.5 text-xs font-semibold text-green-400 bg-green-500/10 border border-green-500/30 px-3 py-1.5 rounded-lg hover:bg-green-500/20 transition-all"
                    >
                      <CheckCircle size={13} /> Confirm
                    </button>
                  )}
                  {b.payment_status === "unpaid" && (
                    <button
                      onClick={() => markPaid(b.id)}
                      className="flex items-center gap-1.5 text-xs font-semibold text-amber-400 bg-amber-500/10 border border-amber-500/30 px-3 py-1.5 rounded-lg hover:bg-amber-500/20 transition-all"
                    >
                      <Wallet size={13} /> Mark Paid
                    </button>
                  )}
                  {b.clients?.phone && (
                    <button
                      onClick={() => wa(b.clients!.phone, b.clients!.name)}
                      className="flex items-center gap-1.5 text-xs font-semibold text-[#22c55e] bg-green-500/10 border border-green-500/30 px-3 py-1.5 rounded-lg hover:bg-green-500/20 transition-all ml-auto"
                    >
                      <MessageCircle size={13} /> WhatsApp
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
