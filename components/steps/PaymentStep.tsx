"use client";

import { useState } from "react";
import { format } from "date-fns";
import { Loader2, Copy, Check } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { SERVICE_LABELS } from "@/lib/database.types";
import toast from "react-hot-toast";
import Image from "next/image";
import type { BookingData, Lang } from "@/app/page";

const ESEWA_NUMBER = "9849938289";
const WHATSAPP_NUMBER = "9779849938289";

interface Props {
  booking: BookingData;
  back: () => void;
  lang: Lang;
  onSuccess: (bookingId: string) => void;
}

export default function PaymentStep({ booking, back, lang, onSuccess }: Props) {
  const [submitting, setSubmitting] = useState(false);
  const [copied, setCopied] = useState(false);
  const [confirming, setConfirming] = useState(false); // shows confirm modal

  const serviceInfo = booking.service ? SERVICE_LABELS[booking.service] : null;

  const t = {
    summary: lang === "en" ? "Booking Summary" : "बुकिङ सारांश",
    service: lang === "en" ? "Service" : "सेवा",
    date: lang === "en" ? "Date" : "मिति",
    time: lang === "en" ? "Time" : "समय",
    duration: lang === "en" ? "Duration" : "अवधि",
    amount: lang === "en" ? "Amount to Pay" : "तिर्नु पर्ने रकम",
    scanQr: lang === "en" ? "Scan QR or send to number" : "QR स्क्यान गर्नुहोस् वा नम्बरमा पठाउनुहोस्",
    copied: lang === "en" ? "Copied!" : "कपी भयो!",
    confirmPayment: lang === "en" ? "I've Made the Payment" : "मैले भुक्तानी गरें",
    back: lang === "en" ? "Back" : "पछाडि",
    submitting: lang === "en" ? "Saving..." : "सुरक्षित गर्दै...",
    min: lang === "en" ? "min" : "मि",
    // Confirm modal
    confirmTitle: lang === "en" ? "Confirm Payment" : "भुक्तानी पुष्टि गर्नुहोस्",
    confirmMsg: lang === "en"
      ? `Have you sent NPR ${booking.amount?.toLocaleString()} to eSewa ${ESEWA_NUMBER}?`
      : `के तपाईंले eSewa ${ESEWA_NUMBER} मा NPR ${booking.amount?.toLocaleString()} पठाउनुभयो?`,
    yes: lang === "en" ? "Yes, I've Paid" : "हो, मैले तिरें",
    no: lang === "en" ? "No, Go Back" : "होइन, फर्कनुस्",
  };

  const formatTime = (t: string) => {
    const [h, m] = t.split(":").map(Number);
    const period = h >= 12 ? "PM" : "AM";
    const hour = h > 12 ? h - 12 : h === 0 ? 12 : h;
    return `${hour}:${m.toString().padStart(2, "0")} ${period}`;
  };

  const copyNumber = async () => {
    await navigator.clipboard.writeText(ESEWA_NUMBER);
    setCopied(true);
    toast.success(t.copied);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleSubmit = async () => {
    setConfirming(false);

    // Go to success page immediately — don't make client wait
    const tempId = crypto.randomUUID();
    onSuccess(tempId);

    // Save to DB silently in background
    try {
      // Build client payload — never send empty strings for optional fields
      const clientPayload = {
        name: booking.name.trim(),
        phone: booking.phone.trim(),
        birth_date: booking.birthDate,
        birth_time: booking.birthTime?.trim() || null,
        birth_place: booking.birthPlace.trim(),
        gender: booking.gender?.trim() || null,
        source: "web" as const,
      };

      // Try inserting client; if phone already exists, fetch the existing one
      let client: any = null;
      const { data: inserted, error: insertError } = await supabase
        .from("clients")
        .insert(clientPayload)
        .select()
        .single();

      if (insertError) {
        if (insertError.code === "23505") {
          // Duplicate phone — fetch existing client
          const { data: existing, error: fetchError } = await supabase
            .from("clients")
            .select("*")
            .eq("phone", clientPayload.phone)
            .single();
          if (fetchError || !existing) throw new Error("Could not find client: " + fetchError?.message);
          client = existing;
        } else {
          console.error("Client insert error:", insertError);
          throw new Error(insertError.message);
        }
      } else {
        client = inserted;
      }
      if (!client) throw new Error("No client found");

      const dateStr = format(booking.date!, "yyyy-MM-dd");
      const bookingPayload = {
        client_id: client.id,
        service_type: booking.service!,
        date: dateStr,
        start_time: booking.startTime!,
        duration_minutes: booking.durationMinutes,
        status: "pending" as const,
        amount: booking.amount,
        payment_status: "unpaid" as const,
        payment_method: "esewa" as const,
        source: "web" as const,
        client_notes: booking.notes?.trim() || null,
      };

      const { data: bk, error: bkError } = await supabase
        .from("bookings")
        .insert(bookingPayload)
        .select()
        .single();

      if (bkError) {
        console.error("Booking error:", bkError);
        throw new Error(bkError.message);
      }
      if (!bk) throw new Error("No booking returned");

    } catch (err: any) {
      // Log silently — client already sees success page
      console.error("Background save error:", err);
    }
  };

  return (
    <>
      <div className="space-y-4">
        {/* Booking Summary */}
        <div className="cosmic-card p-5">
          <h3 className="text-sm font-semibold text-slate-400 uppercase tracking-wider mb-3">
            {t.summary}
          </h3>
          <div className="space-y-2">
            {[
              { label: t.service, value: serviceInfo ? (lang === "en" ? serviceInfo.en : serviceInfo.ne) : "" },
              { label: t.date, value: booking.date ? format(booking.date, "MMMM d, yyyy") : "" },
              { label: t.time, value: booking.startTime ? formatTime(booking.startTime) : "" },
              { label: t.duration, value: `${booking.durationMinutes} ${t.min}` },
            ].map(({ label, value }) => (
              <div key={label} className="flex justify-between text-sm">
                <span className="text-slate-500">{label}</span>
                <span className="text-slate-200">{value}</span>
              </div>
            ))}
          </div>
          <div className="mt-4 bg-amber-500/10 border border-amber-500/30 rounded-xl px-4 py-3 text-center">
            <p className="text-slate-400 text-xs mb-1">{t.amount}</p>
            <p className="text-amber-400 font-bold text-3xl">
              NPR {booking.amount.toLocaleString()}
            </p>
          </div>
        </div>

        {/* eSewa Payment */}
        <div className="cosmic-card p-5">
          <p className="text-slate-300 text-sm text-center mb-4">{t.scanQr}</p>

          {/* QR Code */}
          <div className="flex justify-center mb-4">
            <div className="bg-white rounded-2xl p-3">
              <Image
                src="/Esewa.jpeg"
                alt="eSewa QR Code"
                width={200}
                height={200}
                className="rounded-xl"
              />
            </div>
          </div>

          {/* eSewa number */}
          <div className="flex items-center gap-3 bg-[#0a0b1a] border border-[#1e2140] rounded-xl px-4 py-3 mb-5">
            <div className="flex items-center gap-2 flex-1">
              <span className="text-green-400 font-bold text-sm">eSewa</span>
              <span className="text-white font-bold text-xl tracking-wider">{ESEWA_NUMBER}</span>
            </div>
            <button onClick={copyNumber} className="text-slate-400 hover:text-white transition-colors p-1">
              {copied ? <Check size={20} className="text-green-400" /> : <Copy size={20} />}
            </button>
          </div>

          <div className="flex gap-3">
            <button onClick={back} className="btn-ghost flex-1" disabled={submitting}>
              {t.back}
            </button>
            <button
              onClick={() => setConfirming(true)}
              className="btn-gold flex-1"
              disabled={submitting}
            >
              {submitting ? (
                <span className="flex items-center justify-center gap-2">
                  <Loader2 size={16} className="animate-spin" />
                  {t.submitting}
                </span>
              ) : (
                t.confirmPayment
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Confirm modal overlay */}
      {confirming && (
        <div className="fixed inset-0 z-50 flex items-center justify-center px-6"
          style={{ background: "rgba(5,6,15,0.85)", backdropFilter: "blur(6px)" }}>
          <div className="cosmic-card p-6 w-full max-w-sm text-center">
            <div className="text-4xl mb-3">💸</div>
            <h3 className="text-white font-bold text-lg mb-3">{t.confirmTitle}</h3>
            <p className="text-slate-400 text-sm mb-6">{t.confirmMsg}</p>
            <div className="flex gap-3">
              <button
                onClick={() => setConfirming(false)}
                className="btn-ghost flex-1"
              >
                {t.no}
              </button>
              <button
                onClick={handleSubmit}
                className="btn-gold flex-1"
              >
                {t.yes}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
