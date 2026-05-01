"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { format } from "date-fns";
import { SERVICE_LABELS } from "@/lib/database.types";
import { CheckCircle, XCircle, Wallet, MessageCircle, ChevronDown, ChevronUp, Search } from "lucide-react";

type Status = "all" | "pending" | "confirmed" | "completed" | "cancelled";

interface Booking {
  id: string;
  date: string;
  start_time: string;
  duration_minutes: number;
  status: string;
  payment_status: string;
  payment_method: string | null;
  payment_reference: string | null;
  amount: number;
  service_type: string;
  client_notes: string | null;
  clients: { name: string; phone: string; birth_place: string } | null;
}

const STATUS_TABS: { key: Status; label: string }[] = [
  { key: "all", label: "All" },
  { key: "pending", label: "Pending" },
  { key: "confirmed", label: "Confirmed" },
  { key: "completed", label: "Completed" },
  { key: "cancelled", label: "Cancelled" },
];

const STATUS_COLOR: Record<string, string> = {
  pending: "bg-amber-500/20 text-amber-400",
  confirmed: "bg-green-500/20 text-green-400",
  completed: "bg-slate-500/20 text-slate-400",
  cancelled: "bg-red-500/20 text-red-400",
};

export default function BookingsPage() {
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [filter, setFilter] = useState<Status>("all");
  const [search, setSearch] = useState("");
  const [expanded, setExpanded] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    let q = supabase
      .from("bookings")
      .select("*, clients(name, phone, birth_place)")
      .order("date", { ascending: false })
      .order("start_time");

    if (filter !== "all") q = q.eq("status", filter);

    const { data } = await q;
    setBookings((data as Booking[]) || []);
    setLoading(false);
  };

  useEffect(() => { load(); }, [filter]);

  const updateStatus = async (id: string, status: string) => {
    await supabase.from("bookings").update({ status }).eq("id", id);
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

  const filtered = bookings.filter(b =>
    !search ||
    b.clients?.name.toLowerCase().includes(search.toLowerCase()) ||
    b.clients?.phone.includes(search)
  );

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <h1 className="text-2xl font-bold text-white mb-6">Bookings</h1>

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

      {/* Status tabs */}
      <div className="flex gap-2 mb-5 overflow-x-auto pb-1">
        {STATUS_TABS.map(({ key, label }) => (
          <button
            key={key}
            onClick={() => setFilter(key)}
            className={`px-4 py-1.5 rounded-xl text-sm font-semibold whitespace-nowrap transition-all ${
              filter === key ? "bg-purple-600 text-white" : "bg-[#0d0f1f] border border-[#1e2140] text-slate-400 hover:text-slate-200"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="text-center text-slate-500 py-12">Loading...</div>
      ) : filtered.length === 0 ? (
        <div className="cosmic-card p-12 text-center text-slate-500">No bookings found</div>
      ) : (
        <div className="space-y-2">
          {filtered.map(b => {
            const service = SERVICE_LABELS[b.service_type as keyof typeof SERVICE_LABELS];
            const isOpen = expanded === b.id;
            return (
              <div key={b.id} className="cosmic-card overflow-hidden">
                <button
                  className="w-full p-4 text-left flex items-center gap-4 hover:bg-white/2 transition-all"
                  onClick={() => setExpanded(isOpen ? null : b.id)}
                >
                  <div className="min-w-[90px]">
                    <p className="text-slate-300 text-sm font-medium">{format(new Date(b.date), "MMM d, yyyy")}</p>
                    <p className="text-purple-400 text-xs">{fmt12(b.start_time)} · {b.duration_minutes}m</p>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-white font-semibold truncate">{b.clients?.name || "—"}</p>
                    <p className="text-slate-500 text-xs truncate">{service?.ne || b.service_type}</p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className="text-amber-400 font-bold text-sm">NPR {b.amount.toLocaleString()}</span>
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_COLOR[b.status]}`}>
                      {b.status}
                    </span>
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                      b.payment_status === "paid" ? "bg-green-500/20 text-green-400" : "bg-red-500/20 text-red-400"
                    }`}>
                      {b.payment_status}
                    </span>
                    {isOpen ? <ChevronUp size={16} className="text-slate-500" /> : <ChevronDown size={16} className="text-slate-500" />}
                  </div>
                </button>

                {isOpen && (
                  <div className="px-4 pb-4 border-t border-[#1e2140] pt-3 space-y-3">
                    {b.client_notes && (
                      <div className="bg-[#0a0b1a] rounded-xl p-3">
                        <p className="text-slate-500 text-xs mb-1">Client notes</p>
                        <p className="text-slate-300 text-sm">{b.client_notes}</p>
                      </div>
                    )}
                    <div className="flex flex-wrap gap-2">
                      {b.status === "pending" && (
                        <button onClick={() => updateStatus(b.id, "confirmed")}
                          className="flex items-center gap-1.5 text-xs font-semibold text-green-400 bg-green-500/10 border border-green-500/30 px-3 py-1.5 rounded-lg hover:bg-green-500/20 transition-all">
                          <CheckCircle size={13} /> Confirm
                        </button>
                      )}
                      {b.status === "confirmed" && (
                        <button onClick={() => updateStatus(b.id, "completed")}
                          className="flex items-center gap-1.5 text-xs font-semibold text-purple-400 bg-purple-500/10 border border-purple-500/30 px-3 py-1.5 rounded-lg hover:bg-purple-500/20 transition-all">
                          <CheckCircle size={13} /> Mark Done
                        </button>
                      )}
                      {b.payment_status === "unpaid" && (
                        <button onClick={() => markPaid(b.id)}
                          className="flex items-center gap-1.5 text-xs font-semibold text-amber-400 bg-amber-500/10 border border-amber-500/30 px-3 py-1.5 rounded-lg hover:bg-amber-500/20 transition-all">
                          <Wallet size={13} /> Mark Paid
                        </button>
                      )}
                      {b.status !== "cancelled" && (
                        <button onClick={() => { if (confirm("Cancel this booking?")) updateStatus(b.id, "cancelled"); }}
                          className="flex items-center gap-1.5 text-xs font-semibold text-red-400 bg-red-500/10 border border-red-500/30 px-3 py-1.5 rounded-lg hover:bg-red-500/20 transition-all">
                          <XCircle size={13} /> Cancel
                        </button>
                      )}
                      {b.clients?.phone && (
                        <a href={`https://wa.me/977${b.clients.phone.replace(/^0/, "")}?text=${encodeURIComponent(`नमस्ते ${b.clients.name}!`)}`}
                          target="_blank"
                          className="flex items-center gap-1.5 text-xs font-semibold text-[#22c55e] bg-green-500/10 border border-green-500/30 px-3 py-1.5 rounded-lg hover:bg-green-500/20 transition-all ml-auto">
                          <MessageCircle size={13} /> WhatsApp
                        </a>
                      )}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
