"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";
import { Plus, Trash2, EyeOff, Eye, Globe, RefreshCw, Repeat2 } from "lucide-react";
import {
  COMMON_TIMEZONES, tzToTz,
  todayIn, tomorrowIn, currentTimeIn,
  fmt12, getTzAbbr,
} from "@/lib/timezone";
import { useBusiness } from "@/lib/business";

const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

interface Slot {
  id: string;
  date: string;
  start_time: string;
  end_time: string;
  is_blocked: boolean;
  note: string | null;
}

interface DisplaySlot {
  slot: Slot;
  displayDate: string;
  displayStart: string;
  displayEnd: string;
}

// Add days to a yyyy-MM-dd string without Date timezone pitfalls
function addDaysToDate(dateStr: string, n: number): string {
  const d = new Date(dateStr + "T12:00:00");
  d.setDate(d.getDate() + n);
  return d.toISOString().slice(0, 10);
}

function getDayOfWeek(dateStr: string): number {
  return new Date(dateStr + "T12:00:00").getDay(); // 0 = Sun
}

export default function AvailabilityPage() {
  const { biz } = useBusiness();
  const bizAbbr = getTzAbbr(biz.timezone);
  const [adminTz, setAdminTz] = useState(biz.timezone);
  const [nowStr, setNowStr] = useState("");

  const [slots, setSlots] = useState<Slot[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const [newDate, setNewDate] = useState(() => tomorrowIn(biz.timezone));
  const [newStart, setNewStart] = useState("10:00");
  const [newEnd, setNewEnd] = useState("17:00");
  const [newNote, setNewNote] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  // Repeat state
  const [repeatEnabled, setRepeatEnabled] = useState(false);
  const [repeatDays, setRepeatDays] = useState<Set<number>>(new Set());
  const [repeatUntil, setRepeatUntil] = useState("");

  useEffect(() => {
    const tick = () => setNowStr(currentTimeIn(adminTz));
    tick();
    const id = setInterval(tick, 30000);
    return () => clearInterval(id);
  }, [adminTz]);

  useEffect(() => {
    setNewDate(tomorrowIn(adminTz));
    setError("");
  }, [adminTz]);

  // When repeat is toggled on, pre-fill "until" to 4 weeks out and pre-select the start day
  useEffect(() => {
    if (repeatEnabled) {
      setRepeatUntil(addDaysToDate(newDate, 27));
      setRepeatDays(new Set([getDayOfWeek(newDate)]));
    }
  }, [repeatEnabled]); // eslint-disable-line react-hooks/exhaustive-deps

  const load = useCallback(async (quiet = false) => {
    if (quiet) setRefreshing(true); else setLoading(true);
    const queryFrom = tzToTz(todayIn(adminTz), "00:00", adminTz, biz.timezone).date;
    const { data } = await supabase
      .from("availability")
      .select("*")
      .eq("business_id", biz.id)
      .gte("date", queryFrom)
      .order("date")
      .order("start_time");
    setSlots((data as Slot[]) || []);
    setLoading(false);
    setRefreshing(false);
  }, [adminTz]);

  useEffect(() => { load(); }, [load]);

  const toggleRepeatDay = (day: number) => {
    setRepeatDays(prev => {
      const next = new Set(prev);
      next.has(day) ? next.delete(day) : next.add(day);
      return next;
    });
  };

  // Compute how many dates will be inserted (for preview in button)
  const repeatDateCount = useMemo(() => {
    if (!repeatEnabled || repeatDays.size === 0 || !repeatUntil || repeatUntil < newDate) return 0;
    let count = 0;
    let cur = newDate;
    while (cur <= repeatUntil) {
      if (repeatDays.has(getDayOfWeek(cur))) count++;
      cur = addDaysToDate(cur, 1);
    }
    return count;
  }, [repeatEnabled, repeatDays, newDate, repeatUntil]);

  const addSlot = async () => {
    setError("");
    if (!newDate || !newStart || !newEnd) { setError("Fill in all fields"); return; }
    if (newStart >= newEnd) { setError("End time must be after start"); return; }

    // Build list of local dates to insert
    let dates: string[] = [];
    if (repeatEnabled) {
      if (repeatDays.size === 0) { setError("Select at least one day of the week"); return; }
      if (!repeatUntil || repeatUntil < newDate) { setError("'Repeat until' must be on or after the start date"); return; }
      let cur = newDate;
      while (cur <= repeatUntil) {
        if (repeatDays.has(getDayOfWeek(cur))) dates.push(cur);
        cur = addDaysToDate(cur, 1);
      }
      if (dates.length === 0) { setError("No dates in that range match the selected days"); return; }
    } else {
      dates = [newDate];
    }

    // Convert each date and build records
    const records: { business_id: string; date: string; start_time: string; end_time: string; is_blocked: boolean; note: string | null }[] = [];
    for (const date of dates) {
      const torontoStart = tzToTz(date, newStart, adminTz, biz.timezone);
      const torontoEnd   = tzToTz(date, newEnd,   adminTz, biz.timezone);
      if (torontoStart.date !== torontoEnd.date) {
        setError(`Window on ${date} crosses midnight (business time). Split into two windows.`);
        return;
      }
      if (torontoStart.time >= torontoEnd.time) {
        setError(`After converting to business time on ${date}, end is not after start.`);
        return;
      }
      records.push({
        business_id: biz.id,
        date: torontoStart.date,
        start_time: torontoStart.time,
        end_time: torontoEnd.time,
        is_blocked: false,
        note: newNote || null,
      });
    }

    setSaving(true);
    const { error: err } = await supabase.from("availability").insert(records as never);
    if (err) setError(err.message);
    else { setNewNote(""); load(true); }
    setSaving(false);
  };

  const deleteSlot = async (id: string) => {
    if (!confirm("Remove this availability window?")) return;
    await supabase.from("availability").delete().eq("id", id);
    load(true);
  };

  const toggleBlock = async (slot: Slot) => {
    await supabase.from("availability").update({ is_blocked: !slot.is_blocked }).eq("id", slot.id);
    load(true);
  };

  const grouped = useMemo(() =>
    slots.reduce<Record<string, DisplaySlot[]>>((acc, slot) => {
      const { date: displayDate, time: displayStart } = tzToTz(slot.date, slot.start_time, biz.timezone, adminTz);
      const { time: displayEnd } = tzToTz(slot.date, slot.end_time, biz.timezone, adminTz);
      if (!acc[displayDate]) acc[displayDate] = [];
      acc[displayDate].push({ slot, displayDate, displayStart, displayEnd });
      return acc;
    }, {}),
  [slots, adminTz]);

  const sortedDays = useMemo(
    () => Object.entries(grouped).sort(([a], [b]) => a.localeCompare(b)),
    [grouped],
  );

  const tzAbbr = getTzAbbr(adminTz);
  const isTorontoTz = adminTz === biz.timezone;

  const previewToronto =
    !isTorontoTz && newDate && newStart && newEnd
      ? {
          start: tzToTz(newDate, newStart, adminTz, biz.timezone),
          end:   tzToTz(newDate, newEnd,   adminTz, biz.timezone),
        }
      : null;

  return (
    <div className="p-6 max-w-3xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-white">Availability</h1>
        <button
          onClick={() => load(true)}
          disabled={refreshing}
          className={`p-2 rounded-xl hover:bg-white/5 transition-all text-slate-400 hover:text-white ${refreshing ? "animate-spin text-purple-400" : ""}`}
        >
          <RefreshCw size={17} />
        </button>
      </div>

      <div className="cosmic-card p-4 mb-6 flex flex-col sm:flex-row sm:items-center gap-3">
        <div className="flex items-center gap-2 text-slate-400 shrink-0">
          <Globe size={16} className="text-purple-400" />
          <span className="text-sm">Admin timezone</span>
        </div>
        <select
          className="input-cosmic flex-1 text-sm"
          value={adminTz}
          onChange={e => setAdminTz(e.target.value)}
          style={{ colorScheme: "dark" }}
        >
          {COMMON_TIMEZONES.map(tz => (
            <option key={tz.value} value={tz.value}>{tz.label}</option>
          ))}
        </select>
        {nowStr && (
          <span className="text-amber-400 text-sm font-mono whitespace-nowrap">
            {fmt12(nowStr)} {tzAbbr}
          </span>
        )}
      </div>

      {/* ── Add Window Form ── */}
      <div className="cosmic-card p-5 mb-6">
        <h2 className="text-white font-semibold mb-4 flex items-center gap-2">
          <Plus size={18} className="text-amber-400" /> Add Open Window
        </h2>
        <p className="text-slate-500 text-xs mb-3">
          Enter times in <span className="text-purple-300">{tzAbbr}</span>. They will be stored as business time ({bizAbbr}).
        </p>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-3">
          <div className="md:col-span-2">
            <label className="text-slate-500 text-xs mb-1 block">
              {repeatEnabled ? "Start Date" : "Date"} ({tzAbbr})
            </label>
            <input
              type="date"
              className="input-cosmic"
              value={newDate}
              onChange={e => setNewDate(e.target.value)}
              style={{ colorScheme: "dark" }}
              min={tomorrowIn(adminTz)}
            />
          </div>
          <div>
            <label className="text-slate-500 text-xs mb-1 block">Start ({tzAbbr})</label>
            <input type="time" className="input-cosmic" value={newStart}
              onChange={e => setNewStart(e.target.value)} style={{ colorScheme: "dark" }} />
          </div>
          <div>
            <label className="text-slate-500 text-xs mb-1 block">End ({tzAbbr})</label>
            <input type="time" className="input-cosmic" value={newEnd}
              onChange={e => setNewEnd(e.target.value)} style={{ colorScheme: "dark" }} />
          </div>
        </div>

        {previewToronto && (
          <div className="mb-3 px-3 py-2 rounded-xl bg-purple-500/10 border border-purple-500/20 text-xs text-slate-400">
            Saves as business time:&nbsp;
            <span className="text-purple-300 font-mono">
              {previewToronto.start.date} &nbsp;{fmt12(previewToronto.start.time)} &ndash; {fmt12(previewToronto.end.time)} {bizAbbr}
            </span>
          </div>
        )}

        {/* ── Repeat toggle ── */}
        <div className="border border-[#1e2140] rounded-xl p-3 mb-3">
          <button
            type="button"
            onClick={() => setRepeatEnabled(p => !p)}
            className={`flex items-center gap-2 text-sm font-medium transition-colors ${repeatEnabled ? "text-amber-400" : "text-slate-400 hover:text-slate-200"}`}
          >
            <Repeat2 size={15} />
            Repeat on days of the week
            <span className={`ml-1 w-8 h-4 rounded-full transition-colors flex items-center ${repeatEnabled ? "bg-amber-500" : "bg-slate-700"}`}>
              <span className={`w-3 h-3 rounded-full bg-white mx-0.5 transition-transform ${repeatEnabled ? "translate-x-4" : "translate-x-0"}`} />
            </span>
          </button>

          {repeatEnabled && (
            <div className="mt-3 space-y-3">
              {/* Day picker */}
              <div>
                <p className="text-slate-600 text-xs mb-2">Repeat on</p>
                <div className="flex gap-1.5 flex-wrap">
                  {DAYS.map((day, i) => (
                    <button
                      key={day}
                      type="button"
                      onClick={() => toggleRepeatDay(i)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all border ${
                        repeatDays.has(i)
                          ? "bg-amber-500/20 border-amber-500 text-amber-300"
                          : "border-[#2e3160] text-slate-500 hover:border-slate-500 hover:text-slate-300"
                      }`}
                    >
                      {day}
                    </button>
                  ))}
                </div>
              </div>

              {/* Until date */}
              <div>
                <label className="text-slate-500 text-xs mb-1 block">Repeat until</label>
                <input
                  type="date"
                  className="input-cosmic"
                  value={repeatUntil}
                  onChange={e => setRepeatUntil(e.target.value)}
                  style={{ colorScheme: "dark" }}
                  min={newDate}
                />
              </div>

              {/* Count preview */}
              {repeatDateCount > 0 && (
                <p className="text-amber-400 text-xs">
                  Will add <span className="font-bold">{repeatDateCount}</span> window{repeatDateCount !== 1 ? "s" : ""}
                </p>
              )}
            </div>
          )}
        </div>

        <div className="mb-3">
          <label className="text-slate-500 text-xs mb-1 block">Note (optional)</label>
          <input className="input-cosmic" placeholder="e.g. Morning sessions"
            value={newNote} onChange={e => setNewNote(e.target.value)} />
        </div>
        {error && <p className="text-red-400 text-sm mb-3">{error}</p>}
        <button onClick={addSlot} disabled={saving} className="btn-gold px-6">
          {saving
            ? "Adding..."
            : repeatEnabled && repeatDateCount > 0
              ? `Add ${repeatDateCount} Window${repeatDateCount !== 1 ? "s" : ""}`
              : "Add Window"}
        </button>
      </div>

      {loading ? (
        <div className="text-center text-slate-500 py-8">Loading...</div>
      ) : sortedDays.length === 0 ? (
        <div className="cosmic-card p-12 text-center">
          <p className="text-slate-400 mb-2">No upcoming availability</p>
          <p className="text-slate-600 text-sm">Add windows above so clients can book</p>
        </div>
      ) : (
        <div className={refreshing ? "opacity-60 pointer-events-none transition-opacity" : "transition-opacity"}>
          {sortedDays.map(([displayDate, daySlots]) => (
            <div key={displayDate} className="mb-5">
              <p className="text-purple-300 text-xs font-bold uppercase tracking-wider mb-2">
                {new Date(displayDate + "T12:00:00").toLocaleDateString("en-US", {
                  weekday: "long", month: "long", day: "numeric",
                })}
                <span className="text-slate-600 normal-case font-normal ml-2">({tzAbbr})</span>
              </p>
              <div className="space-y-2">
                {daySlots.map(({ slot, displayStart, displayEnd }) => (
                  <div
                    key={slot.id}
                    className={`cosmic-card p-4 flex items-center gap-4 ${slot.is_blocked ? "opacity-50" : ""}`}
                  >
                    <div className="flex-1">
                      <p className="text-white font-semibold">
                        {fmt12(displayStart)} &ndash; {fmt12(displayEnd)}
                        <span className="text-slate-600 text-xs font-normal ml-2">{tzAbbr}</span>
                      </p>
                      {!isTorontoTz && (
                        <p className="text-slate-600 text-xs mt-0.5">
                          {fmt12(slot.start_time)} &ndash; {fmt12(slot.end_time)} {bizAbbr}
                        </p>
                      )}
                      {slot.note && <p className="text-slate-500 text-xs mt-0.5">{slot.note}</p>}
                      {slot.is_blocked && <span className="text-red-400 text-xs font-bold">BLOCKED</span>}
                    </div>
                    <button
                      onClick={() => toggleBlock(slot)}
                      className="p-2 rounded-lg hover:bg-white/5 transition-all text-slate-400 hover:text-amber-400"
                      title={slot.is_blocked ? "Unblock" : "Block"}
                    >
                      {slot.is_blocked ? <Eye size={17} /> : <EyeOff size={17} />}
                    </button>
                    <button
                      onClick={() => deleteSlot(slot.id)}
                      className="p-2 rounded-lg hover:bg-red-500/10 transition-all text-slate-400 hover:text-red-400"
                      title="Delete"
                    >
                      <Trash2 size={17} />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
