"use client";

import { useEffect, useState } from "react";
import { DayPicker } from "react-day-picker";
import "react-day-picker/dist/style.css";
import { format, isBefore, startOfDay, addDays } from "date-fns";
import { supabase } from "@/lib/supabase";
import { Loader2 } from "lucide-react";
import type { BookingData, Lang } from "@/app/page";
import { SERVICE_LABELS } from "@/lib/database.types";

interface AvailableSlot {
  startTime: string;
  endTime: string;
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
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(booking.date ?? undefined);
  const [slots, setSlots] = useState<AvailableSlot[]>([]);
  const [loading, setLoading] = useState(false);
  const [disabledDays, setDisabledDays] = useState<Date[]>([]);

  const t = {
    title: lang === "en" ? "Pick a Date & Time" : "मिति र समय छान्नुहोस्",
    subtitle: lang === "en" ? "Choose when you'd like your session" : "सत्र कहिले गर्ने छान्नुहोस्",
    available: lang === "en" ? "Available slots" : "उपलब्ध समय",
    no_slots: lang === "en" ? "No slots available on this day" : "यस दिन कुनै समय उपलब्ध छैन",
    back: lang === "en" ? "Back" : "पछाडि",
    continue: lang === "en" ? "Continue" : "अगाडि",
    select_slot: lang === "en" ? "Please select a time slot" : "समय छान्नुहोस्",
    loading: lang === "en" ? "Checking availability..." : "उपलब्धता जाँच गर्दै...",
  };

  useEffect(() => {
    if (!selectedDate) return;
    const fetchSlots = async () => {
      setLoading(true);
      setSlots([]);
      const dateStr = format(selectedDate, "yyyy-MM-dd");
      const duration = booking.durationMinutes;

      const { data: avail } = await supabase
        .from("availability")
        .select("*")
        .eq("date", dateStr)
        .eq("is_blocked", false);

      const { data: existing } = await supabase
        .from("bookings")
        .select("start_time, duration_minutes")
        .eq("date", dateStr)
        .neq("status", "cancelled");

      const bookedRanges = (existing || []).map((b) => {
        const [h, m] = b.start_time.split(":").map(Number);
        const start = h * 60 + m;
        return { start, end: start + b.duration_minutes };
      });

      const generated: AvailableSlot[] = [];
      for (const window of avail || []) {
        const [sh, sm] = window.start_time.split(":").map(Number);
        const [eh, em] = window.end_time.split(":").map(Number);
        let cur = sh * 60 + sm;
        const end = eh * 60 + em;
        while (cur + duration <= end) {
          const slotEnd = cur + duration;
          const conflict = bookedRanges.some(
            (b) => !(slotEnd <= b.start || cur >= b.end)
          );
          if (!conflict) {
            const fmt = (mins: number) => {
              const h = Math.floor(mins / 60).toString().padStart(2, "0");
              const m = (mins % 60).toString().padStart(2, "0");
              return `${h}:${m}`;
            };
            generated.push({
              startTime: fmt(cur),
              endTime: fmt(slotEnd),
              availabilityId: window.id,
            });
          }
          cur += 30;
        }
      }
      // Deduplicate by startTime (in case availability windows overlap)
      const seen = new Set<string>();
      const unique = generated.filter((s) => {
        if (seen.has(s.startTime)) return false;
        seen.add(s.startTime);
        return true;
      });

      setSlots(unique);
      setLoading(false);
    };
    fetchSlots();
  }, [selectedDate, booking.durationMinutes]);

  const handleDateSelect = (date: Date | undefined) => {
    setSelectedDate(date);
    update({ date: date ?? null, startTime: null });
  };

  const handleSlotSelect = (slot: AvailableSlot) => {
    update({ startTime: slot.startTime });
  };

  const formatTime = (t: string) => {
    const [h, m] = t.split(":").map(Number);
    const period = h >= 12 ? "PM" : "AM";
    const hour = h > 12 ? h - 12 : h === 0 ? 12 : h;
    return `${hour}:${m.toString().padStart(2, "0")} ${period}`;
  };

  const serviceInfo = booking.service ? SERVICE_LABELS[booking.service] : null;

  return (
    <div className="cosmic-card p-6">
      <h2 className="text-xl font-semibold text-white mb-1">{t.title}</h2>
      <p className="text-slate-400 text-sm mb-2">{t.subtitle}</p>

      {serviceInfo && (
        <div className="flex items-center gap-2 mb-4 bg-purple-500/10 border border-purple-500/30 rounded-xl px-3 py-2">
          <span className="text-purple-300 text-sm">
            {lang === "en" ? serviceInfo.en : serviceInfo.ne}
          </span>
          <span className="text-slate-500 text-xs">• {booking.durationMinutes} min</span>
        </div>
      )}

      {/* Calendar */}
      <div className="flex justify-center mb-4">
        <DayPicker
          mode="single"
          selected={selectedDate}
          onSelect={handleDateSelect}
          disabled={[
            { before: addDays(startOfDay(new Date()), 1) },
            ...disabledDays,
          ]}
          fromDate={addDays(new Date(), 1)}
          toDate={addDays(new Date(), 60)}
        />
      </div>

      {/* Time slots */}
      {selectedDate && (
        <div className="border-t border-[#1e2140] pt-4">
          <p className="text-slate-400 text-sm mb-3">{t.available}</p>
          {loading ? (
            <div className="flex items-center gap-2 text-slate-400 py-4 justify-center">
              <Loader2 size={16} className="animate-spin" />
              <span className="text-sm">{t.loading}</span>
            </div>
          ) : slots.length === 0 ? (
            <p className="text-slate-500 text-sm text-center py-4">{t.no_slots}</p>
          ) : (
            <div className="grid grid-cols-3 gap-2">
              {slots.map((slot) => {
                const selected = booking.startTime === slot.startTime;
                return (
                  <button
                    key={slot.startTime}
                    onClick={() => handleSlotSelect(slot)}
                    className={`py-2 px-3 rounded-xl text-sm transition-all ${
                      selected
                        ? "bg-purple-600 text-white border border-purple-500"
                        : "border border-[#1e2140] text-slate-300 hover:border-purple-500/50"
                    }`}
                  >
                    {formatTime(slot.startTime)}
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
