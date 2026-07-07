"use client";

import { useState } from "react";
import { format } from "date-fns";
import { Loader2, Copy, Check } from "lucide-react";
import { getTzAbbr, fmt12 } from "@/lib/timezone";
import { supabase } from "@/lib/supabase";
import { SERVICE_LABELS } from "@/lib/database.types";
import { addToCalendar } from "@/lib/calendar";
import toast from "react-hot-toast";
import Image from "next/image";
import type { BookingData, Lang } from "@/lib/booking-types";
import { usePublicBiz } from "@/lib/public-biz";

// Fallbacks (Moonlight's original values) when business_settings are empty
const FALLBACK = {
  esewa: "9849938289",
  paypal: "https://paypal.com/ncp/payment/VML8HKWNUAKD6",
  usd: 75,
  nprIntl: 11250,
};

type PayMethod = "esewa" | "paypal";

interface Props {
  booking: BookingData;
  back: () => void;
  lang: Lang;
  onSuccess: (bookingId: string) => void;
}

export default function PaymentStep({ booking, back, lang, onSuccess }: Props) {
  const { biz, settings } = usePublicBiz();
  // Use the explicit country field set from the dropdown in ClientInfoStep
  const isNepal = booking.country === "Nepal";

  // Per-business payment settings
  const esewaNumber = settings.esewa_id || FALLBACK.esewa;
  const paypalLink  = settings.paypal_link || FALLBACK.paypal;
  const usdAmount   = Number(settings.intl_usd_amount ?? FALLBACK.usd);
  const nprIntl     = Number(settings.intl_npr_amount ?? FALLBACK.nprIntl);
  const nprNepal    = booking.amount || 2500; // the selected service's price

  const [payMethod, setPayMethod] = useState<PayMethod>(isNepal ? "esewa" : "paypal");
  const [submitting, setSubmitting]   = useState(false);
  const [copiedEsewa, setCopiedEsewa] = useState(false);
  const [copiedPayPal, setCopiedPayPal] = useState(false);
  const [confirming, setConfirming]   = useState(false);

  const serviceInfo = booking.service ? SERVICE_LABELS[booking.service] : null;
  const displayTime = booking.localStartTime ?? booking.startTime ?? "";
  const tzAbbr      = booking.userTz ? getTzAbbr(booking.userTz) : "ET";

  // Amount shown / stored — depends on method and Nepal vs international
  const nprAmount = isNepal ? nprNepal : nprIntl;
  const displayAmount = payMethod === "paypal"
    ? `$${usdAmount} USD`
    : `NPR ${nprAmount.toLocaleString()}`;
  const storeAmount = payMethod === "paypal" ? usdAmount : nprAmount;

  const t = {
    summary:        lang === "en" ? "Booking Summary"           : "बुकिङ सारांश",
    service:        lang === "en" ? "Service"                   : "सेवा",
    date:           lang === "en" ? "Date"                      : "मिति",
    time:           lang === "en" ? "Time"                      : "समय",
    duration:       lang === "en" ? "Duration"                  : "अवधि",
    amountLabel:    lang === "en" ? "Amount to Pay"             : "तिर्नु पर्ने रकम",
    chooseMethod:   lang === "en" ? "Choose Payment Method"     : "भुक्तानी विधि छान्नुहोस्",
    scanQr:         lang === "en" ? "Scan QR or send to number" : "QR स्क्यान वा नम्बरमा पठाउनुहोस्",
    sendPayPal:     lang === "en" ? "Send payment via PayPal"   : "PayPal मार्फत भुक्तानी पठाउनुहोस्",
    copied:         lang === "en" ? "Copied!"                   : "कपी भयो!",
    confirmPayment: lang === "en" ? "I've Made the Payment"     : "मैले भुक्तानी गरें",
    back:           lang === "en" ? "Back"                      : "पछाडि",
    submitting:     lang === "en" ? "Saving..."                 : "सुरक्षित गर्दै...",
    min:            lang === "en" ? "min"                       : "मि",
    confirmTitle:   lang === "en" ? "Confirm Payment"           : "भुक्तानी पुष्टि गर्नुहोस्",
    confirmMsg:     lang === "en"
      ? payMethod === "paypal"
          ? `Have you sent $${usdAmount} to PayPal (${paypalLink})?`
          : `Have you sent NPR ${nprAmount.toLocaleString()} to eSewa ${esewaNumber}?`
      : payMethod === "paypal"
          ? `के तपाईंले PayPal मार्फत $${usdAmount} पठाउनुभयो?`
          : `के तपाईंले eSewa ${esewaNumber} मा NPR ${nprAmount.toLocaleString()} पठाउनुभयो?`,
    yes:            lang === "en" ? "Yes, I've Paid"            : "हो, मैले तिरें",
    no:             lang === "en" ? "No, Go Back"               : "होइन, फर्कनुस्",
  };

  const copyEsewa = async () => {
    await navigator.clipboard.writeText(esewaNumber);
    setCopiedEsewa(true);
    toast.success(t.copied);
    setTimeout(() => setCopiedEsewa(false), 2000);
  };

  const copyPayPal = async () => {
    await navigator.clipboard.writeText(paypalLink);
    setCopiedPayPal(true);
    toast.success(t.copied);
    setTimeout(() => setCopiedPayPal(false), 2000);
  };

  const handleSubmit = async () => {
    setConfirming(false);
    const tempId = crypto.randomUUID();
    onSuccess(tempId);

    try {
      const clientPayload = {
        name:             booking.name.trim(),
        phone:            booking.phone.trim(),
        birth_date:       booking.birthDate,
        birth_time:       booking.birthTime?.trim() || null,
        birth_place:      booking.birthPlace.trim(),
        gender:           booking.gender?.trim() || null,
        current_location: booking.currentLocation?.trim() || null,
        source:           "web" as const,
        business_id:      biz.id,
      };

      // Anon users cannot SELECT clients (RLS), so avoid INSERT..RETURNING:
      // generate the id locally; on duplicate phone resolve via a narrow RPC.
      let clientId: string = crypto.randomUUID();
      const { error: insertError } = await supabase
        .from("clients").insert({ id: clientId, ...clientPayload } as never);

      if (insertError) {
        if (insertError.code === "23505") {
          const { data: existingId, error: rpcError } = await supabase
            .rpc("get_client_id_by_phone", { p_phone: clientPayload.phone, p_business: biz.id });
          if (rpcError || !existingId) throw new Error("Could not find client: " + rpcError?.message);
          clientId = existingId as string;
        } else {
          throw new Error(insertError.message);
        }
      }

      const dateStr = booking.dbDate ?? format(booking.date!, "yyyy-MM-dd");
      const { error: bkError } = await supabase.from("bookings").insert({
        business_id:      biz.id,
        client_id:        clientId,
        service_type:     booking.service!,
        date:             dateStr,
        start_time:       booking.startTime!,
        duration_minutes: booking.durationMinutes,
        status:           "pending" as const,
        amount:           storeAmount,
        currency:         payMethod === "paypal" ? "USD" : "NPR",
        payment_status:   "unpaid" as const,
        payment_method:   payMethod,
        source:           "web" as const,
        client_notes:     booking.notes?.trim() || null,
      });

      if (bkError) throw new Error(bkError.message);

      // Block the owner's Google Calendar (fire-and-forget)
      addToCalendar({
        name: booking.name.trim(),
        date: dateStr,
        startTime: booking.startTime!,
        durationMinutes: booking.durationMinutes,
        service: serviceInfo ? serviceInfo.en : undefined,
        notes: booking.notes?.trim() || undefined,
        paymentStatus: "unpaid",
        businessId: biz.id,
      });
    } catch (err: any) {
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
              { label: t.service,  value: serviceInfo ? (lang === "en" ? serviceInfo.en : serviceInfo.ne) : "" },
              { label: t.date,     value: booking.date ? format(booking.date, "MMMM d, yyyy") : "" },
              { label: t.time,     value: displayTime ? `${fmt12(displayTime)} ${tzAbbr}` : "" },
              { label: t.duration, value: `${booking.durationMinutes} ${t.min}` },
            ].map(({ label, value }) => (
              <div key={label} className="flex justify-between text-sm">
                <span className="text-slate-500">{label}</span>
                <span className="text-slate-200">{value}</span>
              </div>
            ))}
          </div>
          <div className="mt-4 bg-amber-500/10 border border-amber-500/30 rounded-xl px-4 py-3 text-center">
            <p className="text-slate-400 text-xs mb-1">{t.amountLabel}</p>
            <p className="text-amber-400 font-bold text-3xl">{displayAmount}</p>
          </div>
        </div>

        {/* Payment Method — international customers get a choice */}
        {!isNepal && (
          <div className="cosmic-card p-5">
            <p className="text-slate-400 text-sm font-semibold mb-3">{t.chooseMethod}</p>
            <div className="grid grid-cols-2 gap-3">
              <button
                onClick={() => setPayMethod("paypal")}
                className={`p-4 rounded-xl border text-center transition-all ${
                  payMethod === "paypal"
                    ? "border-blue-500 bg-blue-500/10"
                    : "border-[#1e2140] hover:border-blue-500/40 hover:bg-white/3"
                }`}
              >
                <p className={`font-bold text-sm ${payMethod === "paypal" ? "text-blue-300" : "text-slate-300"}`}>
                  PayPal
                </p>
                <p className={`font-bold text-xl mt-1 ${payMethod === "paypal" ? "text-blue-400" : "text-slate-400"}`}>
                  ${usdAmount} USD
                </p>
              </button>
              <button
                onClick={() => setPayMethod("esewa")}
                className={`p-4 rounded-xl border text-center transition-all ${
                  payMethod === "esewa"
                    ? "border-green-500 bg-green-500/10"
                    : "border-[#1e2140] hover:border-green-500/40 hover:bg-white/3"
                }`}
              >
                <p className={`font-bold text-sm ${payMethod === "esewa" ? "text-green-300" : "text-slate-300"}`}>
                  eSewa
                </p>
                <p className={`font-bold text-xl mt-1 ${payMethod === "esewa" ? "text-green-400" : "text-slate-400"}`}>
                  NPR {nprAmount.toLocaleString()}
                </p>
              </button>
            </div>
          </div>
        )}

        {/* Payment Details */}
        <div className="cosmic-card p-5">
          {payMethod === "paypal" ? (
            /* ── PayPal ── */
            <>
              <p className="text-slate-300 text-sm text-center mb-4">{t.sendPayPal}</p>
              <div className="bg-[#0a0b1a] border border-[#1e2140] rounded-xl px-4 py-4 mb-4 text-center">
                <p className="text-slate-500 text-xs mb-2">PayPal.me link</p>
                <p className="text-blue-400 font-bold text-base break-all">{paypalLink}</p>
                <button onClick={copyPayPal} className="mt-3 flex items-center gap-2 text-slate-400 hover:text-white transition-colors text-xs mx-auto">
                  {copiedPayPal ? <Check size={14} className="text-green-400" /> : <Copy size={14} />}
                  {copiedPayPal ? t.copied : (lang === "en" ? "Copy link" : "लिङ्क कपी गर्नुहोस्")}
                </button>
              </div>
              <div className="bg-blue-500/5 border border-blue-500/20 rounded-xl px-4 py-3 mb-5 text-center">
                <p className="text-slate-400 text-xs">
                  {lang === "en"
                    ? `Send exactly $${usdAmount} USD · Add your name in the note`
                    : `ठ्याक्कै $${usdAmount} USD पठाउनुहोस् · नोटमा आफ्नो नाम लेख्नुहोस्`}
                </p>
              </div>
            </>
          ) : (
            /* ── eSewa ── */
            <>
              <p className="text-slate-300 text-sm text-center mb-4">{t.scanQr}</p>
              {biz.slug === "moonlight" && (
                <div className="flex justify-center mb-4">
                  <div className="bg-white rounded-2xl p-3">
                    <Image src="/Esewa.jpeg" alt="eSewa QR Code" width={200} height={200} className="rounded-xl" />
                  </div>
                </div>
              )}
              <div className="flex items-center gap-3 bg-[#0a0b1a] border border-[#1e2140] rounded-xl px-4 py-3 mb-5">
                <div className="flex items-center gap-2 flex-1">
                  <span className="text-green-400 font-bold text-sm">eSewa</span>
                  <span className="text-white font-bold text-xl tracking-wider">{esewaNumber}</span>
                </div>
                <button onClick={copyEsewa} className="text-slate-400 hover:text-white transition-colors p-1">
                  {copiedEsewa ? <Check size={20} className="text-green-400" /> : <Copy size={20} />}
                </button>
              </div>
            </>
          )}

          <div className="flex gap-3">
            <button onClick={back} className="btn-ghost flex-1" disabled={submitting}>
              {t.back}
            </button>
            <button onClick={() => setConfirming(true)} className="btn-gold flex-1" disabled={submitting}>
              {submitting ? (
                <span className="flex items-center justify-center gap-2">
                  <Loader2 size={16} className="animate-spin" />
                  {t.submitting}
                </span>
              ) : t.confirmPayment}
            </button>
          </div>
        </div>
      </div>

      {/* Confirm modal */}
      {confirming && (
        <div className="fixed inset-0 z-50 flex items-center justify-center px-6"
          style={{ background: "rgba(5,6,15,0.85)", backdropFilter: "blur(6px)" }}>
          <div className="cosmic-card p-6 w-full max-w-sm text-center">
            <div className="text-4xl mb-3">{payMethod === "paypal" ? "💳" : "💸"}</div>
            <h3 className="text-white font-bold text-lg mb-3">{t.confirmTitle}</h3>
            <p className="text-slate-400 text-sm mb-6">{t.confirmMsg}</p>
            <div className="flex gap-3">
              <button onClick={() => setConfirming(false)} className="btn-ghost flex-1">{t.no}</button>
              <button onClick={handleSubmit} className="btn-gold flex-1">{t.yes}</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
