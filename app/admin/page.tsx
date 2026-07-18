"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { format } from "date-fns";
import { SERVICE_LABELS } from "@/lib/database.types";
import { Clock, Wallet, RefreshCw, MessageCircle, CalendarDays } from "lucide-react";
import { toWaNumber } from "@/lib/countries";
import { bookingWhatsappMessage } from "@/lib/whatsapp";
import { todayIn, fmt12 as tzFmt12, tzToTz, getTzAbbr } from "@/lib/timezone";
import { useBusiness } from "@/lib/business";
import { adToBs } from "@/lib/nepali-date";

interface Booking {
  id: string;
  date: string;
  start_time: string;
  duration_minutes: number;
  status: string;
  payment_status: string;
  payment_method: string | null;
  amount: number;
  currency: string | null;
  service_type: string;
  clients: { name: string; phone: string; birth_date: string | null; birth_time: string | null; birth_place: string | null; current_location: string | null; gender: string | null } | null;
}

function addDays(dateStr: string, n: number): string {
  const d = new Date(dateStr + "T12:00:00");
  d.setDate(d.getDate() + n);
  return d.toISOString().slice(0, 10);
}

const STATUS_COLOR: Record<string, string> = {
  pending:   "bg-amber-500/20 text-amber-400",
  confirmed: "bg-green-500/20 text-green-400",
  completed: "bg-slate-500/20 text-slate-400",
  cancelled: "bg-red-500/20 text-red-400",
};

export default function AdminDashboard() {
  const { biz, settings } = useBusiness();
  const bizAbbr = getTzAbbr(biz.timezone);
  const [weekBookings, setWeekBookings] = useState<Booking[]>([]);
  const [detail, setDetail] = useState<Booking | null>(null);
  const [stats, setStats] = useState({ today: 0, pending: 0, unpaid: 0 });
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    const today = todayIn(biz.timezone);
    const weekEnd = addDays(today, 6);

    const [{ data: week }, { data: pending }, { data: unpaid }] = await Promise.all([
      supabase
        .from("bookings")
        .select("*, clients(name, phone, birth_date, birth_time, birth_place, current_location, gender)")
        .eq("business_id", biz.id)
        .gte("date", today)
        .lte("date", weekEnd)
        .neq("status", "cancelled")
        .order("date")
        .order("start_time"),
      supabase.from("bookings").select("id").eq("business_id", biz.id).eq("status", "pending"),
      supabase.from("bookings").select("id").eq("business_id", biz.id).eq("payment_status", "unpaid").neq("status", "cancelled"),
    ]);

    const all = (week as Booking[]) || [];
    setWeekBookings(all);
    setStats({
      today:   all.filter(b => b.date === today).length,
      pending: pending?.length || 0,
      unpaid:  unpaid?.length || 0,
    });
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const wa = (b: Booking) => {
    if (!b.clients?.phone) return;
    const msg = encodeURIComponent(bookingWhatsappMessage(b.clients.name, b.date, b.start_time, {
      whatsappNumber: settings.whatsapp_number,
      template: settings.wa_template,
      storageTz: biz.timezone,
      businessName: biz.name,
      birthDate: b.clients.birth_date,
      birthDateBs: b.clients.birth_date ? adToBs(b.clients.birth_date) : null,
      birthTime: b.clients.birth_time,
      birthPlace: b.clients.birth_place,
    }));
    window.open(`https://wa.me/${toWaNumber(b.clients.phone)}?text=${msg}`, "_blank");
  };

  const today = todayIn(biz.timezone);

  // Build 7-day list with labels
  const weekDays = Array.from({ length: 7 }, (_, i) => {
    const dateStr = addDays(today, i);
    const jsDate = new Date(dateStr + "T12:00:00");
    const dayLabel =
      i === 0 ? "Today" :
      i === 1 ? "Tomorrow" :
      format(jsDate, "EEEE");
    const dateLabel = format(jsDate, "MMM d");
    return { dateStr, dayLabel, dateLabel, isToday: i === 0 };
  });

  // Group by date
  const byDate: Record<string, Booking[]> = {};
  for (const b of weekBookings) {
    if (!byDate[b.date]) byDate[b.date] = [];
    byDate[b.date].push(b);
  }

  const amtDisplay = (b: Booking) =>
    (b.currency || (b.payment_method === "paypal" ? "USD" : "NPR")) === "USD"
      ? `$${b.amount.toLocaleString()}`
      : `NPR ${b.amount.toLocaleString()}`;

  return (
    <div className="p-6 max-w-4xl mx-auto">
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
          { label: "Today's Sessions", value: stats.today, color: "purple" },
          { label: "Pending Confirm",  value: stats.pending, color: "amber" },
          { label: "Awaiting Payment", value: stats.unpaid,  color: "red" },
        ].map(({ label, value, color }) => (
          <div key={label} className={`cosmic-card p-4 border-l-2 ${
            color === "purple" ? "border-l-purple-500" :
            color === "amber"  ? "border-l-amber-500"  : "border-l-red-500"
          }`}>
            <p className="text-slate-500 text-xs mb-1">{label}</p>
            <p className={`text-3xl font-bold ${
              color === "purple" ? "text-purple-300" :
              color === "amber"  ? "text-amber-400"  : "text-red-400"
            }`}>{value}</p>
          </div>
        ))}
      </div>

      {/* Week schedule */}
      <div className="flex items-center gap-2 mb-5">
        <CalendarDays size={18} className="text-amber-400" />
        <h2 className="text-lg font-semibold text-white">This Week</h2>
      </div>

      {loading ? (
        <div className="cosmic-card p-12 text-center text-slate-500">Loading...</div>
      ) : (
        <div className="space-y-4">
          {weekDays.map(({ dateStr, dayLabel, dateLabel, isToday }) => {
            const dayBookings = byDate[dateStr] || [];
            return (
              <div key={dateStr} className={`cosmic-card overflow-hidden ${isToday ? "border border-purple-500/40" : ""}`}>
                {/* Day header */}
                <div className={`flex items-center justify-between px-4 py-3 ${
                  isToday ? "bg-purple-500/10" : "bg-white/2"
                }`}>
                  <div className="flex items-center gap-3">
                    <span className={`font-bold text-sm ${isToday ? "text-purple-300" : "text-slate-300"}`}>
                      {dayLabel}
                    </span>
                    <span className="text-slate-600 text-xs">{dateLabel}</span>
                  </div>
                  {dayBookings.length > 0 ? (
                    <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${
                      isToday ? "bg-purple-500/20 text-purple-300" : "bg-white/10 text-slate-400"
                    }`}>
                      {dayBookings.length} session{dayBookings.length !== 1 ? "s" : ""}
                    </span>
                  ) : (
                    <span className="text-slate-700 text-xs">free</span>
                  )}
                </div>

                {/* Bookings */}
                {dayBookings.length > 0 && (
                  <div className="divide-y divide-[#1e2140]">
                    {dayBookings.map((b) => {
                      const service = SERVICE_LABELS[b.service_type as keyof typeof SERVICE_LABELS];
                      return (
                        <div key={b.id} className="flex items-center gap-2 px-3 py-3 hover:bg-white/2 transition-all cursor-pointer" onClick={() => setDetail(b)}>
                          {/* Time */}
                          <div className="min-w-[80px] shrink-0 leading-tight">
                            <p className="text-white font-bold text-xs">{tzFmt12(b.start_time)} <span className="text-slate-500 font-normal">{bizAbbr}</span></p>
                            {biz.timezone !== "Asia/Kathmandu" && (
                              <p className="text-amber-400/80 text-[11px]">{tzFmt12(tzToTz(b.date, b.start_time, biz.timezone, "Asia/Kathmandu").time)} <span className="text-slate-500">NPT</span></p>
                            )}
                            <p className="text-slate-600 text-[11px]">{b.duration_minutes} min</p>
                          </div>

                          {/* Client + service */}
                          <div className="flex-1 min-w-0">
                            <p className="text-slate-200 font-semibold text-sm leading-tight break-words">{b.clients?.name || "—"}</p>
                            <p className="text-slate-500 text-[11px] truncate">{service?.en || b.service_type}</p>
                          </div>

                          {/* Amount + status badges (pushed right) */}
                          <div className="flex flex-col items-end gap-0.5 shrink-0 ml-auto">
                            <span className="text-amber-400 text-xs font-bold whitespace-nowrap">{amtDisplay(b)}</span>
                            <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${STATUS_COLOR[b.status] || STATUS_COLOR.pending}`}>
                              {b.status}
                            </span>
                            <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${
                              b.payment_status === "paid" ? "bg-green-500/20 text-green-400" : "bg-red-500/20 text-red-400"
                            }`}>
                              {b.payment_status}
                            </span>
                          </div>

                          {/* WhatsApp */}
                          {b.clients?.phone && (
                            <button
                              onClick={(e) => { e.stopPropagation(); wa(b); }}
                              className="shrink-0 p-1.5 rounded-lg text-slate-500 hover:text-green-400 hover:bg-green-500/10 transition-all"
                              title="WhatsApp"
                            >
                              <MessageCircle size={14} />
                            </button>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Booking detail modal */}
      {detail && (
        <div className="fixed inset-0 z-50 flex items-center justify-center px-5"
          style={{ background: "rgba(5,6,15,0.85)", backdropFilter: "blur(6px)" }}
          onClick={() => setDetail(null)}>
          <div className="cosmic-card p-5 w-full max-w-sm" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-white font-bold">{detail.clients?.name || "Booking"}</h3>
              <button onClick={() => setDetail(null)} className="text-slate-500 hover:text-white text-xl leading-none">×</button>
            </div>
            <div className="space-y-2 text-sm">
              {([
                ["Service", SERVICE_LABELS[detail.service_type as keyof typeof SERVICE_LABELS]?.en || detail.service_type],
                ["Date", detail.date],
                ["Time", `${tzFmt12(detail.start_time)} ${bizAbbr} · ${detail.duration_minutes} min`],
                ["Phone", detail.clients?.phone],
                ["Birth Date", detail.clients?.birth_date],
                ["Birth Date (BS)", detail.clients?.birth_date ? adToBs(detail.clients.birth_date) : null],
                ["Birth Time", detail.clients?.birth_time ? tzFmt12(detail.clients.birth_time) : null],
                ["Birth Place", detail.clients?.birth_place],
                ["Location", detail.clients?.current_location],
                ["Gender", detail.clients?.gender],
                ["Amount", amtDisplay(detail)],
                ["Status", `${detail.status} · ${detail.payment_status}`],
              ] as [string, string | null | undefined][]).filter(([, v]) => v).map(([label, v]) => (
                <div key={label} className="flex justify-between gap-3">
                  <span className="text-slate-500">{label}</span>
                  <span className="text-slate-200 text-right">{v}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
