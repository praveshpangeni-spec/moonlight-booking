"use client";

import { SERVICE_LABELS, type ServiceType } from "@/lib/database.types";
import type { BookingData, Lang } from "@/lib/booking-types";
import { usePublicBiz } from "@/lib/public-biz";

const SERVICE_ICONS: Record<string, string> = {
  general: "🔮",
  birth_chart: "🌟",
  compatibility: "💑",
  career_finance: "💼",
  love_relationship: "❤️",
  yearly_forecast: "📅",
};

// Fallback if the business has no services rows yet
const FALLBACK_SERVICES: ServiceType[] = ["birth_chart", "compatibility"];

interface Props {
  booking: BookingData;
  update: (d: Partial<BookingData>) => void;
  next: () => void;
  lang: Lang;
}

export default function ServiceStep({ booking, update, next, lang }: Props) {
  const { services } = usePublicBiz();

  // Business services (from DB) or the hardcoded fallback
  const offered = services.length > 0
    ? services.map(s => ({
        key: s.key,
        en: s.name_en,
        ne: s.name_ne || s.name_en,
        duration: s.duration_minutes,
        price: Number(s.price),
      }))
    : FALLBACK_SERVICES.map(key => ({
        key,
        en: SERVICE_LABELS[key].en,
        ne: SERVICE_LABELS[key].ne,
        duration: SERVICE_LABELS[key].duration,
        price: SERVICE_LABELS[key].price,
      }));

  const select = (key: string) => {
    const info = offered.find(o => o.key === key)!;
    update({ service: key as ServiceType, durationMinutes: info.duration, amount: info.price });
  };

  const t = {
    title:         lang === "en" ? "Choose Your Service"                        : "आफ्नो सेवा छान्नुहोस्",
    subtitle:      lang === "en" ? "Select the type of reading you need"        : "तपाईंलाई चाहिने परामर्शको प्रकार छान्नुहोस्",
    duration:      lang === "en" ? "min session"                                : "मिनेट",
    continue:      lang === "en" ? "Continue"                                   : "अगाडि बढ्नुहोस्",
    select_prompt: lang === "en" ? "Please select a service"                   : "सेवा छान्नुहोस्",
  };

  return (
    <div className="cosmic-card p-6">
      <h2 className="text-xl font-semibold text-white mb-1">{t.title}</h2>
      <p className="text-slate-400 text-sm mb-6">{t.subtitle}</p>

      <div className="grid grid-cols-1 gap-3">
        {offered.map((info) => {
          const selected = booking.service === info.key;
          return (
            <button
              key={info.key}
              onClick={() => select(info.key)}
              className={`flex items-center gap-4 p-4 rounded-xl border text-left transition-all duration-200 ${
                selected
                  ? "border-purple-500 bg-purple-500/10"
                  : "border-[#1e2140] hover:border-[#2e3160] hover:bg-white/5"
              }`}
            >
              <span className="text-2xl">{SERVICE_ICONS[info.key] || "🔮"}</span>
              <div className="flex-1 min-w-0">
                <p className={`font-medium ${selected ? "text-purple-300" : "text-slate-200"}`}>
                  {lang === "en" ? info.en : info.ne}
                </p>
                {lang === "ne" && (
                  <p className="text-slate-500 text-xs mt-0.5">{info.en}</p>
                )}
                <p className="text-slate-500 text-xs mt-1">
                  {info.duration} {t.duration}
                </p>
              </div>
              {selected && (
                <div className="w-5 h-5 rounded-full bg-purple-600 flex items-center justify-center shrink-0">
                  <div className="w-2 h-2 rounded-full bg-white" />
                </div>
              )}
            </button>
          );
        })}
      </div>

      <button
        onClick={() => booking.service ? next() : alert(t.select_prompt)}
        className="btn-gold w-full mt-6"
      >
        {t.continue} →
      </button>
    </div>
  );
}
