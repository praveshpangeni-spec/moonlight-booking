"use client";

import { useEffect, useState } from "react";
import { DayPicker } from "react-day-picker";
import "react-day-picker/dist/style.css";
import { format, addDays, startOfDay } from "date-fns";
import { supabase } from "@/lib/supabase";
import { Loader2, Globe, ChevronDown } from "lucide-react";
import type { BookingData, Lang } from "@/lib/booking-types";
import { usePublicBiz } from "@/lib/public-biz";
import { SERVICE_LABELS } from "@/lib/database.types";
import {
  COMMON_TIMEZONES, tzToTz,
  getTzAbbr, fmt12,
} from "@/lib/timezone";

interface AvailableSlot {
  startTime: string;      // Toronto HH:mm → stored in DB
  localStartTime: string; // User's local HH:mm → display only
  dbDate: string;         // Toronto yyyy-MM-dd → stored in DB
  availabilityId: string;
}

interface Props {
  booking: BookingData;
  update: (d: Partial<BookingData>) => void;
  next: () => void;
  back: () => void;
  lang: Lang;
}

export default function SlotStep({ booking, update, next, back, lang }: Props) {
  const { biz, services } = usePublicBiz();
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(booking.date ?? undefined);
  const [slots, setSlots] = useState<AvailableSlot[]>([]);
  const [loading, setLoading] = useState(false);
  const [userTz, setUserTz] = useState(biz.timezone);
  const [showTzPicker, setShowTzPicker] = useState(false);
  const [tzDetected, setTzDetected] = useState(false);

  // Detect browser timezone on mount
  useEffect(() => {
    try {
      const detected = Intl.DateTimeFormat().resolvedOptions().timeZone;
      if (detected) {
        setUserTz(detected);
        update({ userTz: detected });
      }
    } catch { /* fall back to Toronto */ }
    setTzDetected(true);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const t = {
    title:       lang === "en" ? "Pick a Date & Time"           : "मिति र समय छान्नुहोस्",
    subtitle:    lang === "en" ? "Choose when you'd like your session" : "सत्र कहिले गर्ने छान्नुहोस्",
    available:   lang === "en" ? "Available slots"              : "उपलब्ध समय",
    no_slots:    lang === "en" ? "No slots available on this day" : "यस दिन कुनै समय उपलब्ध छैन",
    back:        lang === "en" ? "Back"                         : "पछाडि",
    continue:    lang === "en" ? "Continue"                     : "अगाडि",
    select_slot: lang === "en" ? "Please select a time slot"   : "समय छान्नुहोस्",
    loading:     lang === "en" ? "Checking availability..."    : "उपलब्धता जाँच गर्दै...",
    your_tz:     lang === "en" ? "Your timezone"               : "तपाईंको समय क्षेत्र",
    change:      lang === "en" ? "Change"                      : "परिवर्तन",
  };

  useEffect(() => {
    if (!selectedDate || !tzDetected) return;
    const fetchSlots = async () => {
      setLoading(true);
      setSlots([]);

      const selectedDateStr = format(selectedDate, "yyyy-MM-dd");
      const duration = booking.durationMinutes;

      // Find the Toronto date range that covers the user's selected local day
      const torontoRangeStart = tzToTz(selectedDateStr, "00:00", userTz, biz.timezone).date;
      const torontoRangeEnd   = tzToTz(selectedDateStr, "23:59", userTz, biz.timezone).date;

      const [{ data: avail }, { data: existing }] = await Promise.all([
        supabase.from("availability").select("*")
          .eq("business_id", biz.id)
          .gte("date", torontoRangeStart)
          .lte("date", torontoRangeEnd)
          .eq("is_blocked", false),
        supabase.from("bookings").select("date, start_time, duration_minutes")
          .eq("business_id", biz.id)
          .gte("date", torontoRangeStart)
          .lte("date", torontoRangeEnd)
          .neq("status", "cancelled"),
      ]);

      // Build booked ranges per Toronto date (in minutes from midnight)
      const bookedByDate: Record<string, { start: number; end: number }[]> = {};
      for (const b of existing || []) {
        const [h, m] = b.start_time.split(":").map(Number);
        const start = h * 60 + m;
        if (!bookedByDate[b.date]) bookedByDate[b.date] = [];
        bookedByDate[b.date].push({ start, end: start + b.duration_minutes });
      }

      const generated: AvailableSlot[] = [];

      for (const window of avail || []) {
        const [sh, sm] = window.start_time.split(":").map(Number);
        const [eh, em] = window.end_time.split(":").map(Number);
        const bookedRanges = bookedByDate[window.date] || [];
        let cur = sh * 60 + sm;
        const winEnd = eh * 60 + em;

        while (cur + duration <= winEnd) {
          const slotEnd = cur + duration;
          const conflict = bookedRanges.some(b => !(slotEnd <= b.start || cur >= b.end));

          if (!conflict) {
            const fmtMins = (mins: number) => {
              const h = Math.floor(mins / 60).toString().padStart(2, "0");
              const m = (mins % 60).toString().padStart(2, "0");
              return `${h}:${m}`;
            };
            const torontoTime = fmtMins(cur);
            // Convert Toronto time → user's local timezone
            const { date: localDate, time: localTime } = tzToTz(window.date, torontoTime, biz.timezone, userTz);
            // Only include slots that actually fall on the user's selected local date
            if (localDate === selectedDateStr) {
              generated.push({
                startTime:      torontoTime,
                localStartTime: localTime,
                dbDate:         window.date,
                availabilityId: window.id,
              });
            }
          }
          cur += 60;
        }
      }

      // Sort by local display time
      generated.sort((a, b) => a.localStartTime.localeCompare(b.localStartTime));

      // Deduplicate by localStartTime
      const seen = new Set<string>();
      setSlots(generated.filter(s => {
        if (seen.has(s.localStartTime)) return false;
        seen.add(s.localStartTime);
        return true;
      }));
      setLoading(false);
    };
    fetchSlots();
  }, [selectedDate, booking.durationMinutes, userTz, tzDetected]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleDateSelect = (date: Date | undefined) => {
    setSelectedDate(date);
    update({ date: date ?? null, startTime: null, dbDate: null, localStartTime: null });
  };

  const handleSlotSelect = (slot: AvailableSlot) => {
    update({
      startTime:      slot.startTime,
      dbDate:         slot.dbDate,
      localStartTime: slot.localStartTime,
    });
  };

  const handleTzChange = (tz: string) => {
    setUserTz(tz);
    update({ userTz: tz, startTime: null, dbDate: null, localStartTime: null });
    setShowTzPicker(false);
    setSelectedDate(undefined);
    update({ date: null });
  };

  const tzAbbr = getTzAbbr(userTz);
  const isTorontoTz = userTz === biz.timezone;
  const svcRow = booking.service ? services.find(s => s.key === booking.service) : null;
  const serviceInfo = svcRow
    ? { en: svcRow.name_en, ne: svcRow.name_ne || svcRow.name_en }
    : booking.service ? SERVICE_LABELS[booking.service] : null;

  return (
    <div className="cosmic-card p-6">
      <h2 className="text-xl font-semibold text-white mb-1">{t.title}</h2>
      <p className="text-slate-400 text-sm mb-3">{t.subtitle}</p>

      {serviceInfo && (
        <div className="flex items-center gap-2 mb-3 bg-purple-500/10 border border-purple-500/30 rounded-xl px-3 py-2">
          <span className="text-purple-300 text-sm">
            {lang === "en" ? serviceInfo.en : serviceInfo.ne}
          </span>
          <span className="text-slate-500 text-xs">• {booking.durationMinutes} min</span>
        </div>
      )}

      {/* Timezone indicator */}
      <div className="mb-4">
        <button
          onClick={() => setShowTzPicker(p => !p)}
          className="flex items-center gap-2 text-xs text-slate-400 hover:text-slate-200 transition-colors"
        >
          <Globe size={13} className="text-purple-400" />
          <span>{t.your_tz}: <span className="text-purple-300">{tzAbbr}</span></span>
          {!isTorontoTz && (
            <span className="text-slate-600">
              ({COMMON_TIMEZONES.find(t => t.value === userTz)?.label ?? userTz})
            </span>
          )}
          <ChevronDown size={13} className={`transition-transform ${showTzPicker ? "rotate-180" : ""}`} />
        </button>

        {showTzPicker && (
          <div className="mt-2">
            <select
              className="input-cosmic w-full text-sm"
              value={userTz}
              onChange={e => handleTzChange(e.target.value)}
              style={{ colorScheme: "dark" }}
            >
              {COMMON_TIMEZONES.map(tz => (
                <option key={tz.value} value={tz.value}>{tz.label}</option>
              ))}
            </select>
            <p className="text-slate-600 text-xs mt-1">
              Times shown in your selected timezone. Changing will reset your date selection.
            </p>
          </div>
        )}
      </div>

      {/* Calendar */}
      <div className="flex justify-center mb-4">
        <DayPicker
          mode="single"
          selected={selectedDate}
          onSelect={handleDateSelect}
          disabled={[{ before: addDays(startOfDay(new Date()), 1) }]}
          fromDate={addDays(new Date(), 1)}
          toDate={addDays(new Date(), 60)}
        />
      </div>

      {/* Time slots */}
      {selectedDate && (
        <div className="border-t border-[#1e2140] pt-4">
          <div className="flex items-center justify-between mb-3">
            <p className="text-slate-400 text-sm">{t.available}</p>
            <span className="text-xs text-slate-600">{tzAbbr}</span>
          </div>
          {loading ? (
            <div className="flex items-center gap-2 text-slate-400 py-4 justify-center">
              <Loader2 size={16} className="animate-spin" />
              <span className="text-sm">{t.loading}</span>
            </div>
          ) : slots.length === 0 ? (
            <p className="text-slate-500 text-sm text-center py-4">{t.no_slots}</p>
          ) : (
            <div className="grid grid-cols-3 gap-2">
              {slots.map(slot => {
                const selected = booking.startTime === slot.startTime && booking.dbDate === slot.dbDate;
                return (
                  <button
                    key={`${slot.dbDate}-${slot.startTime}`}
                    onClick={() => handleSlotSelect(slot)}
                    className={`py-2 px-3 rounded-xl text-sm transition-all ${
                      selected
                        ? "bg-purple-600 text-white border border-purple-500"
                        : "border border-[#1e2140] text-slate-300 hover:border-purple-500/50"
                    }`}
                  >
                    {fmt12(slot.localStartTime)}
                  </button>
                );
              })}
            </div>
          )}
        </div>
      )}

      <div className="flex gap-3 mt-6">
        <button onClick={back} className="btn-ghost flex-1">{t.back}</button>
        <button
          onClick={() => (booking.date && booking.startTime ? next() : alert(t.select_slot))}
          className="btn-gold flex-1"
        >
          {t.continue} →
        </button>
      </div>
    </div>
  );
}
