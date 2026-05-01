"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { format } from "date-fns";
import { SERVICE_LABELS } from "@/lib/database.types";
import { Search, ChevronDown, ChevronUp, Phone, MapPin, Calendar, MessageCircle } from "lucide-react";

interface Client {
  id: string;
  name: string;
  phone: string;
  birth_date: string | null;
  birth_place: string | null;
  created_at: string;
}

interface Booking {
  id: string;
  date: string;
  start_time: string;
  duration_minutes: number;
  status: string;
  payment_status: string;
  amount: number;
  service_type: string;
}

interface ClientWithBookings extends Client {
  bookings?: Booking[];
}

export default function ClientsPage() {
  const [clients, setClients] = useState<ClientWithBookings[]>([]);
  const [search, setSearch] = useState("");
  const [expanded, setExpanded] = useState<string | null>(null);
  const [bookingMap, setBookingMap] = useState<Record<string, Booking[]>>({});
  const [loading, setLoading] = useState(true);
  const [loadingBookings, setLoadingBookings] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    const { data } = await supabase
      .from("clients")
      .select("*")
      .order("created_at", { ascending: false });
    setClients((data as ClientWithBookings[]) || []);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const loadBookings = async (clientId: string) => {
    if (bookingMap[clientId]) return; // already loaded
    setLoadingBookings(clientId);
    const { data } = await supabase
      .from("bookings")
      .select("id, date, start_time, duration_minutes, status, payment_status, amount, service_type")
      .eq("client_id", clientId)
      .order("date", { ascending: false });
    setBookingMap(prev => ({ ...prev, [clientId]: (data as Booking[]) || [] }));
    setLoadingBookings(null);
  };

  const toggle = (id: string) => {
    if (expanded === id) {
      setExpanded(null);
    } else {
      setExpanded(id);
      loadBookings(id);
    }
  };

  const fmt12 = (t: string) => {
    const [h, m] = t.split(":").map(Number);
    return `${h > 12 ? h - 12 : h === 0 ? 12 : h}:${String(m).padStart(2, "0")} ${h >= 12 ? "PM" : "AM"}`;
  };

  const filtered = clients.filter(c =>
    !search ||
    c.name.toLowerCase().includes(search.toLowerCase()) ||
    c.phone.includes(search)
  );

  const STATUS_COLOR: Record<string, string> = {
    pending: "bg-amber-500/20 text-amber-400",
    confirmed: "bg-green-500/20 text-green-400",
    completed: "bg-slate-500/20 text-slate-400",
    cancelled: "bg-red-500/20 text-red-400",
  };

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-white">Clients</h1>
        <span className="text-slate-500 text-sm">{clients.length} total</span>
      </div>

      {/* Search */}
      <div className="flex items-center gap-2 bg-[#0d0f1f] border border-[#1e2140] rounded-xl px-4 py-2.5 mb-5">
        <Search size={16} className="text-slate-500" />
        <input
          className="bg-transparent flex-1 text-slate-200 text-sm outline-none placeholder:text-slate-600"
          placeholder="Search by name or phone..."
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
      </div>

      {loading ? (
        <div className="text-center text-slate-500 py-12">Loading...</div>
      ) : filtered.length === 0 ? (
        <div className="cosmic-card p-12 text-center text-slate-500">No clients found</div>
      ) : (
        <div className="space-y-2">
          {filtered.map(c => {
            const isOpen = expanded === c.id;
            const sessionBookings = bookingMap[c.id] || [];
            const totalSpent = sessionBookings
              .filter(b => b.status !== "cancelled" && b.payment_status === "paid")
              .reduce((sum, b) => sum + b.amount, 0);
            const sessionCount = sessionBookings.filter(b => b.status !== "cancelled").length;

            return (
              <div key={c.id} className="cosmic-card overflow-hidden">
                <button
                  className="w-full p-4 text-left flex items-center gap-4 hover:bg-white/2 transition-all"
                  onClick={() => toggle(c.id)}
                >
                  {/* Avatar */}
                  <div className="w-10 h-10 rounded-full bg-purple-600/30 border border-purple-500/40 flex items-center justify-center shrink-0">
                    <span className="text-purple-300 font-bold text-sm">
                      {c.name.charAt(0).toUpperCase()}
                    </span>
                  </div>

                  {/* Name + phone */}
                  <div className="flex-1 min-w-0">
                    <p className="text-white font-semibold truncate">{c.name}</p>
                    <p className="text-slate-500 text-xs">{c.phone}</p>
                  </div>

                  {/* Stats */}
                  <div className="text-right shrink-0">
                    <p className="text-amber-400 text-sm font-bold">
                      {isOpen && bookingMap[c.id] ? `NPR ${totalSpent.toLocaleString()}` : ""}
                    </p>
                    <p className="text-slate-600 text-xs">
                      {format(new Date(c.created_at), "MMM d, yyyy")}
                    </p>
                  </div>

                  {isOpen ? <ChevronUp size={16} className="text-slate-500 shrink-0" /> : <ChevronDown size={16} className="text-slate-500 shrink-0" />}
                </button>

                {isOpen && (
                  <div className="px-4 pb-4 border-t border-[#1e2140] pt-3 space-y-4">
                    {/* Client details */}
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      <div className="flex items-center gap-2 text-sm text-slate-400">
                        <Phone size={14} className="text-purple-400 shrink-0" />
                        <span>{c.phone}</span>
                      </div>
                      {c.birth_date && (
                        <div className="flex items-center gap-2 text-sm text-slate-400">
                          <Calendar size={14} className="text-purple-400 shrink-0" />
                          <span>{c.birth_date}</span>
                        </div>
                      )}
                      {c.birth_place && (
                        <div className="flex items-center gap-2 text-sm text-slate-400">
                          <MapPin size={14} className="text-purple-400 shrink-0" />
                          <span className="truncate">{c.birth_place}</span>
                        </div>
                      )}
                    </div>

                    {/* WhatsApp + stats */}
                    <div className="flex items-center gap-3">
                      <a
                        href={`https://wa.me/977${c.phone.replace(/^0/, "")}?text=${encodeURIComponent(`नमस्ते ${c.name}!`)}`}
                        target="_blank"
                        className="flex items-center gap-1.5 text-xs font-semibold text-[#22c55e] bg-green-500/10 border border-green-500/30 px-3 py-1.5 rounded-lg hover:bg-green-500/20 transition-all"
                      >
                        <MessageCircle size={13} /> WhatsApp
                      </a>
                      {bookingMap[c.id] && (
                        <span className="text-slate-600 text-xs">
                          {sessionCount} session{sessionCount !== 1 ? "s" : ""} · NPR {totalSpent.toLocaleString()} paid
                        </span>
                      )}
                    </div>

                    {/* Booking history */}
                    <div>
                      <p className="text-slate-500 text-xs font-bold uppercase tracking-wider mb-2">Session History</p>
                      {loadingBookings === c.id ? (
                        <p className="text-slate-600 text-sm">Loading...</p>
                      ) : sessionBookings.length === 0 ? (
                        <p className="text-slate-600 text-sm">No sessions yet</p>
                      ) : (
                        <div className="space-y-1.5">
                          {sessionBookings.map(b => {
                            const service = SERVICE_LABELS[b.service_type as keyof typeof SERVICE_LABELS];
                            return (
                              <div key={b.id} className="flex items-center gap-3 bg-[#0a0b1a] rounded-xl px-3 py-2">
                                <div className="flex-1 min-w-0">
                                  <p className="text-slate-300 text-sm">
                                    {format(new Date(b.date), "MMM d, yyyy")} · {fmt12(b.start_time)}
                                  </p>
                                  <p className="text-slate-600 text-xs">{service?.ne || b.service_type} · {b.duration_minutes}m</p>
                                </div>
                                <span className="text-amber-400 text-xs font-bold shrink-0">
                                  NPR {b.amount.toLocaleString()}
                                </span>
                                <span className={`text-xs px-2 py-0.5 rounded-full font-medium shrink-0 ${STATUS_COLOR[b.status]}`}>
                                  {b.status}
                                </span>
                              </div>
                            );
                          })}
                        </div>
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
