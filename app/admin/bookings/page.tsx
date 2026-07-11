"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { format } from "date-fns";
import { SERVICE_LABELS, type ServiceType } from "@/lib/database.types";
import { CheckCircle, Wallet, MessageCircle, ChevronDown, ChevronUp, Search, Plus, Pencil, Save, X, Trash2 } from "lucide-react";
import { COUNTRY_CODES, toWaNumber } from "@/lib/countries";
import { tzToTz, fmt12 as tzFmt12, getTzAbbr, todayIn, currentTimeIn } from "@/lib/timezone";
import { useBusiness } from "@/lib/business";
import BirthDatePicker from "@/components/BirthDatePicker";
import { addToCalendar, markCalendarPaid, deleteCalendarEvent, updateCalendarEvent } from "@/lib/calendar";
import { bookingWhatsappMessage } from "@/lib/whatsapp";

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
  currency: string | null;
  service_type: string;
  client_notes: string | null;
  admin_notes: string | null;
  clients: { id: string; name: string; phone: string; birth_date: string | null; birth_time: string | null; birth_place: string; current_location: string | null; gender: string | null } | null;
}

const STATUS_TABS: { key: Status; label: string }[] = [
  { key: "all", label: "All" },
  { key: "pending", label: "Pending" },
  { key: "confirmed", label: "Confirmed" },
  { key: "completed", label: "Completed" },
  { key: "cancelled", label: "Cancelled" },
];

const STATUS_COLOR: Record<string, string> = {
  pending:   "bg-amber-500/20 text-amber-400",
  confirmed: "bg-green-500/20 text-green-400",
  completed: "bg-slate-500/20 text-slate-400",
  cancelled: "bg-red-500/20 text-red-400",
};

const ACTIVE_SERVICES: ServiceType[] = ["birth_chart", "compatibility"];

// Only the timezones the admin actually works with.
const BOOKING_TIMEZONES = [
  { value: "America/Toronto", label: "Toronto (ET)" },
  { value: "Asia/Kathmandu", label: "Nepal (NPT)" },
  { value: "America/Denver",  label: "Colorado / Denver (MT)" },
];

// Payment methods offered.
const PAYMENT_METHODS = [
  { value: "esewa",         label: "eSewa" },
  { value: "paypal",        label: "PayPal" },
  { value: "bank_transfer", label: "Bank Transfer" },
];

const DEFAULT_ADD = {
  clientName: "", clientPhone: "", clientCountryCode: "+977",
  clientBirthDate: "", clientBirthDateLabel: "", clientBirthTime: "", clientBirthPlace: "",
  service: "birth_chart" as ServiceType,
  date: format(new Date(), "yyyy-MM-dd"),
  slotMode: "auto" as "auto" | "custom",  // "auto" = pick from availability, "custom" = manual time+duration
  startTime: "",
  duration: 60,
  amount: SERVICE_LABELS.birth_chart.price,
  currency: "NPR",
  status: "confirmed",
  paymentMethod: "esewa",
  paymentStatus: "unpaid",
  notes: "",
};

// Add minutes to an HH:MM time, wrapping within a 24h day (display only).
function addMinutesToTime(hhmm: string, mins: number): string {
  const [h, m] = hhmm.split(":").map(Number);
  let total = (((h * 60 + m + mins) % 1440) + 1440) % 1440;
  return `${Math.floor(total / 60).toString().padStart(2, "0")}:${(total % 60).toString().padStart(2, "0")}`;
}

function LabelRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="text-slate-500 text-xs mb-1 block">{label}</label>
      {children}
    </div>
  );
}

export default function BookingsPage() {
  const { biz, settings, services, serviceByKey } = useBusiness();
  const bizAbbr = getTzAbbr(biz.timezone);
  const activeServices = services.filter(s => s.active);
  const svcPrice    = (key: string) => serviceByKey(key)?.price ?? SERVICE_LABELS[key as ServiceType]?.price ?? 0;
  const svcDuration = (key: string) => serviceByKey(key)?.duration_minutes ?? SERVICE_LABELS[key as ServiceType]?.duration ?? 60;
  const svcNameEn   = (key: string) => serviceByKey(key)?.name_en ?? SERVICE_LABELS[key as ServiceType]?.en ?? key;
  const bookingTimezones = BOOKING_TIMEZONES.some(z => z.value === biz.timezone)
    ? BOOKING_TIMEZONES
    : [{ value: biz.timezone, label: `Business (${getTzAbbr(biz.timezone)})` }, ...BOOKING_TIMEZONES];
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [filter, setFilter] = useState<Status>("all");
  const [search, setSearch] = useState("");
  const [expanded, setExpanded] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  // Add booking form
  const [showAdd, setShowAdd] = useState(false);
  const [addForm, setAddForm] = useState({ ...DEFAULT_ADD });
  const [addSaving, setAddSaving] = useState(false);
  const [addError, setAddError] = useState("");
  const [addAvailSlots, setAddAvailSlots] = useState<string[]>([]);
  const [addSlotsLoading, setAddSlotsLoading] = useState(false);
  const [addPreviewTz, setAddPreviewTz] = useState("America/Denver");
  // Timezone the admin enters/views slot times in (converted to Toronto for storage). Default Toronto (EDT).
  const [bookTz, setBookTz] = useState(biz.timezone);

  // Edit booking
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState({
    date: "", startTime: "", duration: "", status: "", paymentMethod: "", paymentStatus: "", amount: "", adminNotes: "",
    clientName: "", clientPhone: "", clientBirthDate: "", clientBirthTime: "", clientBirthPlace: "",
  });
  const [editSaving, setEditSaving] = useState(false);

  const load = async () => {
    setLoading(true);
    let q = supabase
      .from("bookings")
      .select("*, clients(id, name, phone, birth_date, birth_time, birth_place, current_location, gender)")
      .eq("business_id", biz.id)
      .order("date", { ascending: false })
      .order("start_time");
    if (filter !== "all") q = q.eq("status", filter);
    const { data } = await q;
    setBookings((data as Booking[]) || []);
    setLoading(false);
  };

  useEffect(() => { load(); }, [filter]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Workflow actions ────────────────────────────────────────────────
  const [confirmingPayment, setConfirmingPayment] = useState<string | null>(null);

  const confirmPayment = async (b: Booking) => {
    await supabase.from("bookings").update({ payment_status: "paid", status: "confirmed" }).eq("id", b.id);
    setConfirmingPayment(null);
    // Update the calendar event's title from Unpaid → Paid
    if (b.clients?.name) {
      markCalendarPaid({ name: b.clients.name, date: b.date, startTime: b.start_time, businessId: biz.id });
    }
    load();
  };

  const markDone = async (id: string) => {
    await supabase.from("bookings").update({ status: "completed" }).eq("id", id);
    load();
  };

  // Returns true when the consultation window has fully passed (Toronto time).
  const isPastConsultation = (b: Booking): boolean => {
    const nowDate = todayIn(biz.timezone);
    const nowTime = currentTimeIn(biz.timezone);
    if (b.date < nowDate) return true;
    if (b.date > nowDate) return false;
    const [h, m] = b.start_time.split(":").map(Number);
    const endMins = h * 60 + m + b.duration_minutes;
    const endH = Math.floor(endMins / 60).toString().padStart(2, "0");
    const endM = (endMins % 60).toString().padStart(2, "0");
    return nowTime >= `${endH}:${endM}`;
  };

  // Fetch available 60-min slots for the selected date, displayed in the chosen bookTz.
  // Availability is stored in Toronto time, so we query the Toronto date range that
  // covers the selected local day, then convert each slot into bookTz for display.
  useEffect(() => {
    if (!showAdd || !addForm.date) return;
    let cancelled = false;
    const fetchSlots = async () => {
      setAddSlotsLoading(true);
      setAddAvailSlots([]);
      setAddForm(f => ({ ...f, startTime: "" }));

      const fromDate = tzToTz(addForm.date, "00:00", bookTz, biz.timezone).date;
      const toDate   = tzToTz(addForm.date, "23:59", bookTz, biz.timezone).date;

      const [{ data: avail }, { data: existing }] = await Promise.all([
        supabase.from("availability").select("*").eq("business_id", biz.id)
          .gte("date", fromDate).lte("date", toDate).eq("is_blocked", false),
        supabase.from("bookings").select("date, start_time, duration_minutes").eq("business_id", biz.id)
          .gte("date", fromDate).lte("date", toDate).neq("status", "cancelled"),
      ]);
      if (cancelled) return;

      // Booked ranges per Toronto date (minutes from midnight)
      const bookedByDate: Record<string, { start: number; end: number }[]> = {};
      for (const b of existing || []) {
        const [h, m] = b.start_time.split(":").map(Number);
        const s = h * 60 + m;
        if (!bookedByDate[b.date]) bookedByDate[b.date] = [];
        bookedByDate[b.date].push({ start: s, end: s + b.duration_minutes });
      }

      const seen = new Set<string>();
      const slots: string[] = [];
      for (const win of avail || []) {
        const [sh, sm] = win.start_time.split(":").map(Number);
        const [eh, em] = win.end_time.split(":").map(Number);
        const bookedRanges = bookedByDate[win.date] || [];
        let cur = sh * 60 + sm;
        const winEnd = eh * 60 + em;
        while (cur + 60 <= winEnd) {
          const end = cur + 60;
          const conflict = bookedRanges.some(b => !(end <= b.start || cur >= b.end));
          if (!conflict) {
            const torontoTime = `${Math.floor(cur / 60).toString().padStart(2, "0")}:${(cur % 60).toString().padStart(2, "0")}`;
            const { date: localDate, time: localTime } = tzToTz(win.date, torontoTime, biz.timezone, bookTz);
            if (localDate === addForm.date && !seen.has(localTime)) {
              seen.add(localTime);
              slots.push(localTime);
            }
          }
          cur += 60;
        }
      }
      slots.sort();
      setAddAvailSlots(slots);
      setAddSlotsLoading(false);
    };
    fetchSlots();
    return () => { cancelled = true; };
  }, [addForm.date, showAdd, bookTz]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Add booking ────────────────────────────────────────────────────
  const handleAddServiceChange = (service: ServiceType) => {
    setAddForm(f => ({ ...f, service, amount: svcPrice(service), duration: svcDuration(service) }));
  };

  const handleAddBooking = async () => {
    setAddError("");
    const { clientName, clientPhone, clientCountryCode, clientBirthDate, clientBirthPlace, service, date, startTime } = addForm;
    if (!clientName.trim())        { setAddError("Client name is required"); return; }
    if (clientPhone.length < 6)    { setAddError("Valid phone number is required"); return; }
    if (!clientBirthDate)          { setAddError("Client birth date is required"); return; }
    if (!clientBirthPlace.trim())  { setAddError("Client birth place is required"); return; }
    if (!date || !startTime)       { setAddError("Date and start time are required"); return; }
    if (addForm.slotMode === "custom" && (!addForm.duration || addForm.duration < 5)) {
      setAddError("Enter a valid duration (minutes)"); return;
    }

    setAddSaving(true);
    try {
      const fullPhone = `${clientCountryCode}${clientPhone.replace(/\D/g, "")}`;

      // Find or create client
      let clientId: string;
      const { data: existing } = await supabase.from("clients").select("id").eq("phone", fullPhone).maybeSingle();

      if (existing) {
        clientId = existing.id;
      } else {
        const { data: newClient, error: cErr } = await supabase.from("clients")
          .insert({ business_id: biz.id, name: clientName.trim(), phone: fullPhone, birth_date: clientBirthDate, birth_time: addForm.clientBirthTime || null, birth_place: clientBirthPlace.trim(), source: "web" as const } as never)
          .select("id").single();
        if (cErr) { setAddError(cErr.message); setAddSaving(false); return; }
        clientId = newClient!.id;
      }

      // Convert the entered local (bookTz) date+time into business storage time
      const tor = tzToTz(addForm.date, addForm.startTime, bookTz, biz.timezone);
      const durationMinutes = addForm.slotMode === "custom"
        ? (addForm.duration || svcDuration(addForm.service))
        : svcDuration(addForm.service);

      // Create booking
      const { error: bErr } = await supabase.from("bookings").insert({
        business_id: biz.id,
        client_id: clientId,
        service_type: addForm.service,
        date: tor.date,
        start_time: tor.time,
        duration_minutes: durationMinutes,
        status: addForm.status as any,
        amount: addForm.amount,
        currency: addForm.currency,
        payment_status: addForm.paymentStatus as any,
        payment_method: addForm.paymentMethod as any,
        source: "web" as const,
        admin_notes: addForm.notes.trim() || null,
      });

      if (bErr) { setAddError(bErr.message); setAddSaving(false); return; }

      // Block the owner's Google Calendar (fire-and-forget)
      addToCalendar({
        name: clientName.trim(),
        date: tor.date,
        startTime: tor.time,
        durationMinutes,
        service: svcNameEn(addForm.service),
        notes: addForm.notes.trim() || undefined,
        paymentStatus: addForm.paymentStatus,
        businessId: biz.id,
      });

      setShowAdd(false);
      setAddForm({ ...DEFAULT_ADD });
      setBookTz(biz.timezone);
      load();
    } catch (e: any) {
      setAddError(e.message);
    }
    setAddSaving(false);
  };

  // ── Edit booking ───────────────────────────────────────────────────
  const startEdit = (b: Booking) => {
    setEditingId(b.id);
    setEditForm({
      date:             b.date,
      startTime:        b.start_time,
      duration:         String(b.duration_minutes),
      status:           b.status,
      paymentMethod:    b.payment_method || "esewa",
      paymentStatus:    b.payment_status,
      amount:           String(b.amount),
      adminNotes:       b.admin_notes || "",
      clientName:       b.clients?.name || "",
      clientPhone:      b.clients?.phone || "",
      clientBirthDate:  b.clients?.birth_date || "",
      clientBirthTime:  b.clients?.birth_time || "",
      clientBirthPlace: b.clients?.birth_place || "",
    });
  };

  const deleteBooking = async (b: Booking) => {
    const clientName = b.clients?.name ?? "this client";
    if (!confirm(`Permanently delete booking for ${clientName}? This cannot be undone.`)) return;
    await supabase.from("bookings").delete().eq("id", b.id);
    // Remove its calendar event
    if (b.clients?.name) {
      deleteCalendarEvent({ name: b.clients.name, date: b.date, startTime: b.start_time, businessId: biz.id });
    }
    setExpanded(null);
    load();
  };

  const handleSaveEdit = async (b: Booking) => {
    setEditSaving(true);
    const newDuration = parseInt(editForm.duration) || 60;
    await supabase.from("bookings").update({
      date:             editForm.date,
      start_time:       editForm.startTime,
      duration_minutes: newDuration,
      status:           editForm.status as any,
      payment_method:   editForm.paymentMethod as any,
      payment_status:   editForm.paymentStatus as any,
      amount:           parseInt(editForm.amount) || 0,
      admin_notes:      editForm.adminNotes.trim() || null,
    }).eq("id", b.id);

    // Update the linked client's details too
    if (b.clients?.id) {
      await supabase.from("clients").update({
        name:        editForm.clientName.trim(),
        phone:       editForm.clientPhone.trim(),
        birth_date:  editForm.clientBirthDate || null,
        birth_time:  editForm.clientBirthTime || null,
        birth_place: editForm.clientBirthPlace.trim() || null,
      }).eq("id", b.clients.id);
    }
    // Move / retitle its calendar event (found by original name + date + time)
    if (b.clients?.name) {
      updateCalendarEvent({
        name: b.clients.name,
        origDate: b.date,
        origStartTime: b.start_time,
        date: editForm.date,
        startTime: editForm.startTime,
        durationMinutes: newDuration,
        paymentStatus: editForm.paymentStatus,
        businessId: biz.id,
      });
    }
    setEditingId(null);
    setEditSaving(false);
    load();
  };

  // ── Helpers ────────────────────────────────────────────────────────
  const fmt12 = (t: string) => {
    const [h, m] = t.split(":").map(Number);
    return `${h > 12 ? h - 12 : h === 0 ? 12 : h}:${String(m).padStart(2, "0")} ${h >= 12 ? "PM" : "AM"}`;
  };

  const fmtAmount = (b: Booking) =>
    (b.currency || "NPR") === "USD"
      ? `$${b.amount.toLocaleString()}`
      : `NPR ${b.amount.toLocaleString()}`;

  const filtered = bookings.filter(b =>
    !search ||
    b.clients?.name.toLowerCase().includes(search.toLowerCase()) ||
    b.clients?.phone.includes(search)
  );

  const inputCls = "w-full bg-[#0a0b1a] border border-[#1e2140] rounded-xl px-3 py-2 text-slate-200 text-sm outline-none focus:border-purple-500 transition-all";
  const selectCls = `${inputCls}`;

  // Duration used for the time-preview end times
  const addDur = addForm.slotMode === "custom"
    ? (addForm.duration || 0)
    : svcDuration(addForm.service);

  // The chosen input timezone + the entered time converted to Toronto (for preview + storage)
  const bookTzAbbr = getTzAbbr(bookTz);
  const bookToronto = (addForm.date && addForm.startTime)
    ? tzToTz(addForm.date, addForm.startTime, bookTz, biz.timezone)
    : null;

  return (
    <div className="p-6 max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-white">Bookings</h1>
        <button
          onClick={() => { setShowAdd(p => !p); setAddError(""); setAddAvailSlots([]); setAddForm({ ...DEFAULT_ADD }); setBookTz(biz.timezone); }}
          className={`flex items-center gap-2 text-sm font-semibold px-4 py-2 rounded-xl border transition-all ${
            showAdd ? "border-purple-500 bg-purple-500/10 text-purple-300" : "border-[#1e2140] text-slate-300 hover:border-purple-500/40"
          }`}
        >
          <Plus size={15} /> New Booking
        </button>
      </div>

      {/* ── Add Booking Form ── */}
      {showAdd && (
        <div className="cosmic-card p-5 mb-6">
          <h2 className="text-white font-semibold mb-4 flex items-center gap-2">
            <Plus size={16} className="text-amber-400" /> Add Manual Booking
          </h2>

          {/* Client info */}
          <p className="text-slate-500 text-xs font-bold uppercase tracking-wider mb-3">Client</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-4">
            <LabelRow label="Name *">
              <input className={inputCls} placeholder="Full name" value={addForm.clientName}
                onChange={e => setAddForm(f => ({ ...f, clientName: e.target.value }))} />
            </LabelRow>
            <LabelRow label="Phone *">
              <div className="flex gap-2">
                <select className={`${selectCls} shrink-0`} style={{ colorScheme: "dark", width: "90px" }}
                  value={addForm.clientCountryCode}
                  onChange={e => setAddForm(f => ({ ...f, clientCountryCode: e.target.value }))}>
                  {COUNTRY_CODES.map(c => <option key={c.code} value={c.code}>{c.flag} {c.code}</option>)}
                </select>
                <input className={inputCls} type="tel" placeholder="Phone" inputMode="numeric"
                  value={addForm.clientPhone}
                  onChange={e => setAddForm(f => ({ ...f, clientPhone: e.target.value.replace(/\D/g, "").slice(0, 15) }))} />
              </div>
            </LabelRow>
            <div className="sm:col-span-2">
              <LabelRow label="Birth Date * (Nepali BS / English AD)">
                <BirthDatePicker
                  value={addForm.clientBirthDate}
                  lang="en"
                  onChange={(adDate, label) =>
                    setAddForm(f => ({ ...f, clientBirthDate: adDate, clientBirthDateLabel: label }))}
                />
                {addForm.clientBirthDateLabel && (
                  <p className="text-purple-300 text-xs mt-1">✓ {addForm.clientBirthDateLabel}</p>
                )}
              </LabelRow>
            </div>
            <LabelRow label="Birth Time (if known)">
              <input className={inputCls} type="time" style={{ colorScheme: "dark" }}
                value={addForm.clientBirthTime}
                onChange={e => setAddForm(f => ({ ...f, clientBirthTime: e.target.value }))} />
            </LabelRow>
            <LabelRow label="Birth Place *">
              <input className={inputCls} placeholder="City, District"
                value={addForm.clientBirthPlace}
                onChange={e => setAddForm(f => ({ ...f, clientBirthPlace: e.target.value }))} />
            </LabelRow>
          </div>

          {/* Booking info */}
          <p className="text-slate-500 text-xs font-bold uppercase tracking-wider mb-3">Session</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-3">
            <LabelRow label="Service">
              <select className={selectCls} style={{ colorScheme: "dark" }}
                value={addForm.service}
                onChange={e => handleAddServiceChange(e.target.value as ServiceType)}>
                {(activeServices.length > 0
                  ? activeServices.map(s => ({ key: s.key, label: s.name_en }))
                  : ACTIVE_SERVICES.map(s => ({ key: s, label: SERVICE_LABELS[s].en }))
                ).map(o => (
                  <option key={o.key} value={o.key}>{o.label}</option>
                ))}
              </select>
            </LabelRow>
            <LabelRow label="Amount">
              <div className="flex gap-2">
                <select className={`${selectCls} shrink-0`} style={{ colorScheme: "dark", width: "90px" }}
                  value={addForm.currency}
                  onChange={e => setAddForm(f => ({ ...f, currency: e.target.value }))}>
                  <option value="NPR">NPR</option>
                  <option value="USD">USD</option>
                </select>
                <input className={inputCls} type="number" value={addForm.amount}
                  onChange={e => setAddForm(f => ({ ...f, amount: parseInt(e.target.value) || 0 }))} />
              </div>
            </LabelRow>
            <LabelRow label="Date *">
              <input className={inputCls} type="date" style={{ colorScheme: "dark" }}
                value={addForm.date}
                onChange={e => setAddForm(f => ({ ...f, date: e.target.value }))} />
            </LabelRow>
            <LabelRow label="Time Zone">
              <select className={selectCls} style={{ colorScheme: "dark" }}
                value={bookTz}
                onChange={e => setBookTz(e.target.value)}>
                {bookingTimezones.map(z => (
                  <option key={z.value} value={z.value}>{z.label}</option>
                ))}
              </select>
            </LabelRow>
          </div>

          {/* Slot selection — pick an existing 1-hr slot, or book a custom slot */}
          <div className="mb-3">
            <div className="flex gap-1 bg-[#0a0b1a] border border-[#1e2140] rounded-xl p-1 w-fit mb-3">
              {([
                { key: "auto", label: "Available Slots" },
                { key: "custom", label: "Book a Slot" },
              ] as const).map(({ key, label }) => (
                <button key={key} type="button"
                  onClick={() => setAddForm(f => ({
                    ...f, slotMode: key, startTime: "",
                    duration: key === "custom" ? f.duration : SERVICE_LABELS[f.service].duration,
                  }))}
                  className={`px-4 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                    addForm.slotMode === key ? "bg-purple-600 text-white" : "text-slate-400 hover:text-slate-200"
                  }`}>
                  {label}
                </button>
              ))}
            </div>

            {addForm.slotMode === "auto" ? (
              <>
                <label className="text-slate-500 text-xs mb-2 block">Available Slots ({bookTzAbbr}) *</label>
                {addSlotsLoading ? (
                  <p className="text-slate-500 text-sm py-2">Loading slots…</p>
                ) : addAvailSlots.length === 0 ? (
                  <p className="text-slate-600 text-sm py-2">No availability set for this date.</p>
                ) : (
                  <div className="flex flex-wrap gap-2">
                    {addAvailSlots.map(t => (
                      <button key={t} type="button"
                        onClick={() => setAddForm(f => ({ ...f, startTime: t }))}
                        className={`px-4 py-2 rounded-xl text-sm font-medium border transition-all ${
                          addForm.startTime === t
                            ? "bg-purple-600 border-purple-500 text-white"
                            : "border-[#1e2140] text-slate-300 hover:border-purple-500/50 hover:bg-white/5"
                        }`}>
                        {tzFmt12(t)}
                      </button>
                    ))}
                  </div>
                )}
              </>
            ) : (
              <div className="grid grid-cols-2 gap-3">
                <LabelRow label={`Start Time (${bookTzAbbr}) *`}>
                  <input className={inputCls} type="time" style={{ colorScheme: "dark" }}
                    value={addForm.startTime}
                    onChange={e => setAddForm(f => ({ ...f, startTime: e.target.value }))} />
                </LabelRow>
                <LabelRow label="Duration (minutes) *">
                  <input className={inputCls} type="number" min={5} step={5} placeholder="e.g. 90"
                    value={addForm.duration}
                    onChange={e => setAddForm(f => ({ ...f, duration: parseInt(e.target.value) || 0 }))} />
                </LabelRow>
              </div>
            )}
          </div>

          {/* Timezone preview — shown once a slot / time is selected. All times derive
              from the Toronto storage time, so they're correct regardless of input zone. */}
          {addForm.date && addForm.startTime && bookToronto && (
            <div className="mb-4 p-3 rounded-xl bg-[#0a0b1a] border border-purple-500/20">
              <p className="text-slate-500 text-xs font-bold uppercase tracking-wider mb-2">
                Time Preview
                {addDur > 0 && <span className="text-slate-600 font-normal normal-case ml-1">· {addDur} min</span>}
              </p>
              <div className="space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-slate-400">Business ({bizAbbr})</span>
                  <span className="text-white font-mono">
                    {tzFmt12(bookToronto.time)} – {tzFmt12(addMinutesToTime(bookToronto.time, addDur))} {bizAbbr}
                  </span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-slate-400">Nepal (NPT)</span>
                  <span className="text-amber-400 font-mono">
                    {(() => {
                      const s = tzToTz(bookToronto.date, bookToronto.time, biz.timezone, "Asia/Kathmandu").time;
                      return `${tzFmt12(s)} – ${tzFmt12(addMinutesToTime(s, addDur))} NPT`;
                    })()}
                  </span>
                </div>
                <div className="flex items-center gap-3 text-sm pt-1 border-t border-[#1e2140]">
                  <select
                    className="bg-[#0d0f1f] border border-[#1e2140] rounded-lg px-2 py-1 text-slate-300 text-xs outline-none focus:border-purple-500 flex-1"
                    style={{ colorScheme: "dark", background: "#0d0f1f" }}
                    value={addPreviewTz}
                    onChange={e => setAddPreviewTz(e.target.value)}
                  >
                    {bookingTimezones.filter(z => z.value !== biz.timezone && z.value !== "Asia/Kathmandu").map(z => (
                      <option key={z.value} value={z.value}>{z.label}</option>
                    ))}
                  </select>
                  <span className="text-purple-300 font-mono shrink-0">
                    {(() => {
                      const s = tzToTz(bookToronto.date, bookToronto.time, biz.timezone, addPreviewTz).time;
                      return `${tzFmt12(s)} – ${tzFmt12(addMinutesToTime(s, addDur))} ${getTzAbbr(addPreviewTz)}`;
                    })()}
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* Payment & status */}
          <p className="text-slate-500 text-xs font-bold uppercase tracking-wider mb-3">Payment & Status</p>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-4">
            <LabelRow label="Booking Status">
              <select className={selectCls} style={{ colorScheme: "dark" }}
                value={addForm.status}
                onChange={e => setAddForm(f => ({ ...f, status: e.target.value }))}>
                <option value="pending">Pending</option>
                <option value="confirmed">Confirmed</option>
              </select>
            </LabelRow>
            <LabelRow label="Payment Method">
              <select className={selectCls} style={{ colorScheme: "dark" }}
                value={addForm.paymentMethod}
                onChange={e => setAddForm(f => ({ ...f, paymentMethod: e.target.value }))}>
                {PAYMENT_METHODS.map(p => (
                  <option key={p.value} value={p.value}>{p.label}</option>
                ))}
              </select>
            </LabelRow>
            <LabelRow label="Payment Status">
              <select className={selectCls} style={{ colorScheme: "dark" }}
                value={addForm.paymentStatus}
                onChange={e => setAddForm(f => ({ ...f, paymentStatus: e.target.value }))}>
                <option value="unpaid">Unpaid</option>
                <option value="paid">Paid</option>
              </select>
            </LabelRow>
          </div>

          <LabelRow label="Notes (optional)">
            <textarea className={`${inputCls} resize-none mb-3`} rows={2}
              placeholder="Any notes for this booking..."
              value={addForm.notes}
              onChange={e => setAddForm(f => ({ ...f, notes: e.target.value }))} />
          </LabelRow>

          {addError && <p className="text-red-400 text-sm mb-3">{addError}</p>}

          <div className="flex gap-3">
            <button onClick={() => { setShowAdd(false); setAddError(""); }} className="btn-ghost px-5">Cancel</button>
            <button onClick={handleAddBooking} disabled={addSaving} className="btn-gold px-6">
              {addSaving ? "Saving..." : "Save Booking"}
            </button>
          </div>
        </div>
      )}

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
          <button key={key} onClick={() => setFilter(key)}
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
            const isEditing = editingId === b.id;

            return (
              <div key={b.id} className="cosmic-card overflow-hidden">
                {/* Summary row */}
                <button
                  className="w-full p-4 text-left flex items-start gap-3 hover:bg-white/2 transition-all"
                  onClick={() => { setExpanded(isOpen ? null : b.id); if (isEditing) setEditingId(null); }}
                >
                  <div className="min-w-[96px] shrink-0">
                    <p className="text-slate-300 text-sm font-medium">{format(new Date(b.date + "T12:00"), "MMM d")}</p>
                    <p className="text-slate-600 text-xs">{format(new Date(b.date + "T12:00"), "yyyy")}</p>
                    <p className="text-purple-400 text-xs mt-1">{fmt12(b.start_time)} <span className="text-slate-500">{bizAbbr}</span></p>
                    {biz.timezone !== "Asia/Kathmandu" && (
                      <p className="text-amber-400/80 text-xs">{fmt12(tzToTz(b.date, b.start_time, biz.timezone, "Asia/Kathmandu").time)} <span className="text-slate-500">NPT</span></p>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-white font-semibold break-words">{b.clients?.name || "—"}</p>
                    <p className="text-slate-500 text-xs truncate mb-1.5">{service?.ne || b.service_type} · {b.duration_minutes}m</p>
                    <div className="flex items-center flex-wrap gap-1.5">
                      <span className="text-amber-400 font-bold text-sm">{fmtAmount(b)}</span>
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_COLOR[b.status]}`}>{b.status}</span>
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                        b.payment_status === "paid" ? "bg-green-500/20 text-green-400" : "bg-red-500/20 text-red-400"
                      }`}>{b.payment_status}</span>
                    </div>
                  </div>
                  <div className="shrink-0 pt-0.5">
                    {isOpen ? <ChevronUp size={16} className="text-slate-500" /> : <ChevronDown size={16} className="text-slate-500" />}
                  </div>
                </button>

                {/* Expanded detail */}
                {isOpen && (
                  <div className="px-4 pb-4 border-t border-[#1e2140] pt-3">
                    {/* Client details */}
                    {b.clients && !isEditing && (
                      <div className="bg-[#0a0b1a] rounded-xl p-3 mb-3">
                        <p className="text-slate-500 text-xs font-bold uppercase tracking-wider mb-2">Client Details</p>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-1.5 text-sm">
                          {([
                            ["Name", b.clients.name],
                            ["Phone", b.clients.phone],
                            ["Birth Date", b.clients.birth_date],
                            ["Birth Time", b.clients.birth_time ? fmt12(b.clients.birth_time) : null],
                            ["Birth Place", b.clients.birth_place],
                            ["Location", b.clients.current_location],
                            ["Gender", b.clients.gender],
                          ] as [string, string | null][]).filter(([, v]) => v).map(([label, v]) => (
                            <div key={label} className="flex justify-between gap-3">
                              <span className="text-slate-500">{label}</span>
                              <span className="text-slate-200 text-right">{v}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                    {b.client_notes && (
                      <div className="bg-[#0a0b1a] rounded-xl p-3 mb-3">
                        <p className="text-slate-500 text-xs mb-1">Client notes</p>
                        <p className="text-slate-300 text-sm">{b.client_notes}</p>
                      </div>
                    )}
                    {b.admin_notes && !isEditing && (
                      <div className="bg-purple-500/5 border border-purple-500/20 rounded-xl p-3 mb-3">
                        <p className="text-slate-500 text-xs mb-1">Admin notes</p>
                        <p className="text-slate-300 text-sm">{b.admin_notes}</p>
                      </div>
                    )}

                    {/* ── Edit form ── */}
                    {isEditing ? (
                      <div className="space-y-3">
                        {/* Client details */}
                        <p className="text-slate-500 text-xs font-bold uppercase tracking-wider">Client</p>
                        <div className="grid grid-cols-2 gap-3">
                          <LabelRow label="Name">
                            <input className={inputCls}
                              value={editForm.clientName} onChange={e => setEditForm(f => ({ ...f, clientName: e.target.value }))} />
                          </LabelRow>
                          <LabelRow label="Phone">
                            <input className={inputCls} type="tel"
                              value={editForm.clientPhone} onChange={e => setEditForm(f => ({ ...f, clientPhone: e.target.value }))} />
                          </LabelRow>
                          <LabelRow label="Birth Date">
                            <input className={inputCls} type="date" style={{ colorScheme: "dark" }}
                              value={editForm.clientBirthDate} onChange={e => setEditForm(f => ({ ...f, clientBirthDate: e.target.value }))} />
                          </LabelRow>
                          <LabelRow label="Birth Time">
                            <input className={inputCls} type="time" style={{ colorScheme: "dark" }}
                              value={editForm.clientBirthTime} onChange={e => setEditForm(f => ({ ...f, clientBirthTime: e.target.value }))} />
                          </LabelRow>
                          <LabelRow label="Birth Place">
                            <input className={inputCls} placeholder="City, District"
                              value={editForm.clientBirthPlace} onChange={e => setEditForm(f => ({ ...f, clientBirthPlace: e.target.value }))} />
                          </LabelRow>
                        </div>

                        {/* Session details */}
                        <p className="text-slate-500 text-xs font-bold uppercase tracking-wider pt-1">Session</p>
                        <div className="grid grid-cols-2 gap-3">
                          <LabelRow label="Date">
                            <input className={inputCls} type="date" style={{ colorScheme: "dark" }}
                              value={editForm.date} onChange={e => setEditForm(f => ({ ...f, date: e.target.value }))} />
                          </LabelRow>
                          <LabelRow label="Start Time">
                            <input className={inputCls} type="time" style={{ colorScheme: "dark" }}
                              value={editForm.startTime} onChange={e => setEditForm(f => ({ ...f, startTime: e.target.value }))} />
                          </LabelRow>
                          <LabelRow label="Duration (min)">
                            <input className={inputCls} type="number"
                              value={editForm.duration} onChange={e => setEditForm(f => ({ ...f, duration: e.target.value }))} />
                          </LabelRow>
                          <LabelRow label="Amount (NPR)">
                            <input className={inputCls} type="number"
                              value={editForm.amount} onChange={e => setEditForm(f => ({ ...f, amount: e.target.value }))} />
                          </LabelRow>
                          <LabelRow label="Status">
                            <select className={selectCls} style={{ colorScheme: "dark" }}
                              value={editForm.status} onChange={e => setEditForm(f => ({ ...f, status: e.target.value }))}>
                              <option value="pending">Pending</option>
                              <option value="confirmed">Confirmed</option>
                              <option value="completed">Completed</option>
                              <option value="cancelled">Cancelled</option>
                            </select>
                          </LabelRow>
                          <LabelRow label="Payment Status">
                            <select className={selectCls} style={{ colorScheme: "dark" }}
                              value={editForm.paymentStatus} onChange={e => setEditForm(f => ({ ...f, paymentStatus: e.target.value }))}>
                              <option value="unpaid">Unpaid</option>
                              <option value="paid">Paid</option>
                            </select>
                          </LabelRow>
                          <LabelRow label="Payment Method">
                            <select className={selectCls} style={{ colorScheme: "dark" }}
                              value={editForm.paymentMethod} onChange={e => setEditForm(f => ({ ...f, paymentMethod: e.target.value }))}>
                              {PAYMENT_METHODS.map(p => (
                                <option key={p.value} value={p.value}>{p.label}</option>
                              ))}
                            </select>
                          </LabelRow>
                        </div>
                        <LabelRow label="Admin Notes">
                          <textarea className={`${inputCls} resize-none`} rows={2}
                            value={editForm.adminNotes} onChange={e => setEditForm(f => ({ ...f, adminNotes: e.target.value }))} />
                        </LabelRow>
                        <div className="flex gap-2 pt-1">
                          <button onClick={() => setEditingId(null)}
                            className="flex items-center gap-1.5 text-xs font-semibold text-slate-400 bg-white/5 border border-[#1e2140] px-3 py-1.5 rounded-lg hover:bg-white/10 transition-all">
                            <X size={13} /> Cancel
                          </button>
                          <button onClick={() => handleSaveEdit(b)} disabled={editSaving}
                            className="flex items-center gap-1.5 text-xs font-semibold text-purple-300 bg-purple-500/10 border border-purple-500/30 px-3 py-1.5 rounded-lg hover:bg-purple-500/20 transition-all">
                            <Save size={13} /> {editSaving ? "Saving..." : "Save Changes"}
                          </button>
                        </div>
                      </div>
                    ) : (
                      /* ── Workflow actions ── */
                      <div className="flex flex-wrap items-center gap-2">

                        {/* 1. Payment Confirmed — shown until payment is received */}
                        {b.payment_status !== "paid" && (
                          confirmingPayment === b.id ? (
                            <>
                              <span className="text-slate-400 text-xs">Payment received?</span>
                              <button onClick={() => confirmPayment(b)}
                                className="flex items-center gap-1 text-xs font-semibold text-green-400 bg-green-500/10 border border-green-500/30 px-3 py-1.5 rounded-lg hover:bg-green-500/20 transition-all">
                                <CheckCircle size={13} /> Yes
                              </button>
                              <button onClick={() => setConfirmingPayment(null)}
                                className="flex items-center gap-1 text-xs font-semibold text-slate-400 bg-white/5 border border-[#1e2140] px-3 py-1.5 rounded-lg hover:bg-white/10 transition-all">
                                <X size={13} /> No
                              </button>
                            </>
                          ) : (
                            <button onClick={() => setConfirmingPayment(b.id)}
                              className="flex items-center gap-1.5 text-xs font-semibold text-amber-400 bg-amber-500/10 border border-amber-500/30 px-3 py-1.5 rounded-lg hover:bg-amber-500/20 transition-all">
                              <Wallet size={13} /> Payment Confirmed
                            </button>
                          )
                        )}

                        {/* 2. Consultation Done — only available after the allotted time has passed */}
                        {isPastConsultation(b) && b.status !== "completed" && (
                          <button onClick={() => { if (confirm(`Mark consultation for ${b.clients?.name ?? "client"} as done?`)) markDone(b.id); }}
                            className="flex items-center gap-1.5 text-xs font-semibold text-purple-400 bg-purple-500/10 border border-purple-500/30 px-3 py-1.5 rounded-lg hover:bg-purple-500/20 transition-all">
                            <CheckCircle size={13} /> Consultation Done
                          </button>
                        )}

                        {/* Utility: Edit */}
                        <button onClick={() => startEdit(b)}
                          className="flex items-center gap-1.5 text-xs font-semibold text-slate-300 bg-white/5 border border-[#1e2140] px-3 py-1.5 rounded-lg hover:bg-white/10 transition-all">
                          <Pencil size={13} /> Edit
                        </button>

                        {/* Utility: Delete */}
                        <button onClick={() => deleteBooking(b)}
                          className="flex items-center gap-1.5 text-xs font-semibold text-red-400 bg-red-500/10 border border-red-500/30 px-3 py-1.5 rounded-lg hover:bg-red-500/20 transition-all">
                          <Trash2 size={13} /> Delete
                        </button>

                        {/* Utility: WhatsApp */}
                        {b.clients?.phone && (
                          <a href={`https://wa.me/${toWaNumber(b.clients.phone)}?text=${encodeURIComponent(bookingWhatsappMessage(b.clients.name, b.date, b.start_time, { whatsappNumber: settings.whatsapp_number, template: settings.wa_template, storageTz: biz.timezone, businessName: biz.name }))}`}
                            target="_blank"
                            className="flex items-center gap-1.5 text-xs font-semibold text-[#22c55e] bg-green-500/10 border border-green-500/30 px-3 py-1.5 rounded-lg hover:bg-green-500/20 transition-all ml-auto">
                            <MessageCircle size={13} /> WhatsApp
                          </a>
                        )}
                      </div>
                    )}
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
