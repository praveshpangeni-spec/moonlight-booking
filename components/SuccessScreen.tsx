"use client";

import { format } from "date-fns";
import { SERVICE_LABELS } from "@/lib/database.types";
import type { BookingData, Lang } from "@/app/page";

const WHATSAPP_NUMBER = "9779849938289";

interface Props {
  booking: BookingData;
  bookingId: string;
  lang: Lang;
}

export default function SuccessScreen({ booking, lang }: Props) {
  const serviceInfo = booking.service ? SERVICE_LABELS[booking.service] : null;

  const formatTime = (t: string) => {
    const [h, m] = t.split(":").map(Number);
    const period = h >= 12 ? "PM" : "AM";
    const hour = h > 12 ? h - 12 : h === 0 ? 12 : h;
    return `${hour}:${m.toString().padStart(2, "0")} ${period}`;
  };

  const waMessage = encodeURIComponent(
    lang === "en"
      ? `Hello! I just made a payment for a session on Moonlight Astrology.\nName: ${booking.name}\nService: ${serviceInfo?.en}\nDate: ${booking.date ? format(booking.date, "MMMM d, yyyy") : ""}\nTime: ${booking.startTime ? formatTime(booking.startTime) : ""}`
      : `नमस्ते! मैले Moonlight Astrology मा भुक्तानी गरें।\nनाम: ${booking.name}\nसेवा: ${serviceInfo?.ne}\nमिति: ${booking.date ? format(booking.date, "MMMM d, yyyy") : ""}\nसमय: ${booking.startTime ? formatTime(booking.startTime) : ""}`
  );

  const t = {
    confirmed: lang === "en" ? "Thank You! 🙏" : "धन्यवाद! 🙏",
    subtitle: lang === "en"
      ? "Once your payment is confirmed, we will reach out to you on WhatsApp."
      : "तपाईंको भुक्तानी पुष्टि भएपछि हामी तपाईंलाई WhatsApp मा सम्पर्क गर्नेछौं।",
    details: lang === "en" ? "Your Booking Details" : "तपाईंको बुकिङ विवरण",
    service: lang === "en" ? "Service" : "सेवा",
    date: lang === "en" ? "Date" : "मिति",
    time: lang === "en" ? "Time" : "समय",
    duration: lang === "en" ? "Duration" : "अवधि",
    amount: lang === "en" ? "Amount Paid" : "तिरेको रकम",
    whatsapp: lang === "en" ? "Message us on WhatsApp" : "WhatsApp मा सम्पर्क गर्नुहोस्",
    note: lang === "en"
      ? "Screenshot this page for your records"
      : "यो पेज स्क्रिनसट गरेर राख्नुहोस्",
    min: lang === "en" ? "min" : "मि",
  };

  return (
    <div className="min-h-screen bg-cosmic-gradient relative flex items-center justify-center px-4 py-8">
      <div className="max-w-lg w-full text-center">

        {/* Icon */}
        <div className="text-7xl mb-3 animate-bounce">🌙</div>
        <div className="text-4xl mb-4">✨</div>

        {/* Title */}
        <h1 className="text-3xl font-bold text-white mb-3">{t.confirmed}</h1>
        <p className="text-slate-300 text-base mb-8 leading-relaxed">{t.subtitle}</p>

        {/* Details card */}
        <div className="cosmic-card p-5 text-left mb-6">
          <h3 className="text-slate-400 text-sm font-semibold uppercase tracking-wider mb-3">
            {t.details}
          </h3>
          <div className="space-y-2">
            {[
              { label: t.service, value: serviceInfo ? (lang === "en" ? serviceInfo.en : serviceInfo.ne) : "" },
              { label: t.date, value: booking.date ? format(booking.date, "MMMM d, yyyy") : "" },
              { label: t.time, value: booking.startTime ? formatTime(booking.startTime) : "" },
              { label: t.duration, value: `${booking.durationMinutes} ${t.min}` },
              { label: t.amount, value: `NPR ${booking.amount.toLocaleString()}` },
            ].map(({ label, value }) => (
              <div key={label} className="flex justify-between text-sm">
                <span className="text-slate-500">{label}</span>
                <span className="text-slate-200 font-medium">{value}</span>
              </div>
            ))}
          </div>
        </div>

        {/* WhatsApp button */}
        <a
          href={`https://wa.me/${WHATSAPP_NUMBER}?text=${waMessage}`}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center justify-center gap-2 bg-green-600 hover:bg-green-500 text-white font-semibold rounded-xl px-6 py-4 transition-all w-full mb-4"
        >
          <svg viewBox="0 0 24 24" className="w-5 h-5 fill-current">
            <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z" />
          </svg>
          {t.whatsapp}
        </a>

        <p className="text-slate-600 text-xs">{t.note}</p>
      </div>
    </div>
  );
}
