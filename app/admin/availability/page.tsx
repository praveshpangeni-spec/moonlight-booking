"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { format, addDays } from "date-fns";
import { Plus, Trash2, EyeOff, Eye } from "lucide-react";

interface Slot {
  id: string;
  date: string;
  start_time: string;
  end_time: string;
  is_blocked: boolean;
  note: string | null;
}

export default function AvailabilityPage() {
  const [slots, setSlots] = useState<Slot[]>([]);
  const [loading, setLoading] = useState(true);
  const [newDate, setNewDate] = useState(format(addDays(new Date(), 1), "yyyy-MM-dd"));
  const [newStart, setNewStart] = useState("10:00");
  const [newEnd, setNewEnd] = useState("17:00");
  const [newNote, setNewNote] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const load = async () => {
    const today = format(new Date(), "yyyy-MM-dd");
    const { data } = await supabase
      .from("availability")
      .select("*")
      .gte("date", today)
      .order("date")
      .order("start_time");
    setSlots((data as Slot[]) || []);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const addSlot = async () => {
    setError("");
    if (!newDate || !newStart || !newEnd) { setError("Fill in all fields"); return; }
    if (newStart >= newEnd) { setError("End time must be after start time"); return; }
    setSaving(true);
    const { error: err } = await supabase.from("availability").insert({
      date: newDate, start_time: newStart, end_time: newEnd,
      is_blocked: false, note: newNote || null,
    });
    if (err) setError(err.message);
    else { setNewNote(""); load(); }
    setSaving(false);
  };

  const deleteSlot = async (id: string) => {
    if (!confirm("Remove this availability window?")) return;
    await supabase.from("availability").delete().eq("id", id);
    load();
  };

  const toggleBlock = async (slot: Slot) => {
    await supabase.from("availability").update({ is_blocked: !slot.is_blocked }).eq("id", slot.id);
    load();
  };

  const fmt12 = (t: string) => {
    const [h, m] = t.split(":").map(Number);
    return `${h > 12 ? h - 12 : h === 0 ? 12 : h}:${String(m).padStart(2, "0")} ${h >= 12 ? "PM" : "AM"}`;
  };

  const grouped = slots.reduce<Record<string, Slot[]>>((acc, s) => {
    acc[s.date] = [...(acc[s.date] || []), s];
    return acc;
  }, {});

  return (
    <div className="p-6 max-w-3xl mx-auto">
      <h1 className="text-2xl font-bold text-white mb-6">Availability</h1>

      {/* Add window */}
      <div className="cosmic-card p-5 mb-6">
        <h2 className="text-white font-semibold mb-4 flex items-center gap-2">
          <Plus size={18} className="text-amber-400" /> Add Open Window
        </h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-3">
          <div className="md:col-span-2">
            <label className="text-slate-500 text-xs mb-1 block">Date</label>
            <input
              type="date"
              className="input-cosmic"
              value={newDate}
              onChange={e => setNewDate(e.target.value)}
              style={{ colorScheme: "dark" }}
              min={format(addDays(new Date(), 1), "yyyy-MM-dd")}
            />
          </div>
          <div>
            <label className="text-slate-500 text-xs mb-1 block">Start</label>
            <input type="time" className="input-cosmic" value={newStart}
              onChange={e => setNewStart(e.target.value)} style={{ colorScheme: "dark" }} />
          </div>
          <div>
            <label className="text-slate-500 text-xs mb-1 block">End</label>
            <input type="time" className="input-cosmic" value={newEnd}
              onChange={e => setNewEnd(e.target.value)} style={{ colorScheme: "dark" }} />
          </div>
        </div>
        <div className="mb-3">
          <label className="text-slate-500 text-xs mb-1 block">Note (optional)</label>
          <input className="input-cosmic" placeholder="e.g. Morning sessions"
            value={newNote} onChange={e => setNewNote(e.target.value)} />
        </div>
        {error && <p className="text-red-400 text-sm mb-3">{error}</p>}
        <button onClick={addSlot} disabled={saving} className="btn-gold px-6">
          {saving ? "Adding..." : "Add Window"}
        </button>
      </div>

      {/* Upcoming slots */}
      {loading ? (
        <div className="text-center text-slate-500 py-8">Loading...</div>
      ) : Object.keys(grouped).length === 0 ? (
        <div className="cosmic-card p-12 text-center">
          <p className="text-slate-400 mb-2">No upcoming availability</p>
          <p className="text-slate-600 text-sm">Add windows above so clients can book</p>
        </div>
      ) : (
        Object.entries(grouped).map(([date, daySlots]) => (
          <div key={date} className="mb-5">
            <p className="text-purple-300 text-xs font-bold uppercase tracking-wider mb-2">
              {format(new Date(date + "T00:00"), "EEEE, MMMM d")}
            </p>
            <div className="space-y-2">
              {daySlots.map(s => (
                <div key={s.id} className={`cosmic-card p-4 flex items-center gap-4 ${s.is_blocked ? "opacity-50" : ""}`}>
                  <div className="flex-1">
                    <p className="text-white font-semibold">{fmt12(s.start_time)} – {fmt12(s.end_time)}</p>
                    {s.note && <p className="text-slate-500 text-xs mt-0.5">{s.note}</p>}
                    {s.is_blocked && <span className="text-red-400 text-xs font-bold">BLOCKED</span>}
                  </div>
                  <button onClick={() => toggleBlock(s)}
                    className="p-2 rounded-lg hover:bg-white/5 transition-all text-slate-400 hover:text-amber-400">
                    {s.is_blocked ? <Eye size={17} /> : <EyeOff size={17} />}
                  </button>
                  <button onClick={() => deleteSlot(s.id)}
                    className="p-2 rounded-lg hover:bg-red-500/10 transition-all text-slate-400 hover:text-red-400">
                    <Trash2 size={17} />
                  </button>
                </div>
              ))}
            </div>
          </div>
        ))
      )}
    </div>
  );
}
