"use client";

import { SERVICE_LABELS, type ServiceType } from "@/lib/database.types";
import type { BookingData, Lang } from "@/app/page";

const SERVICE_ICONS: Record<ServiceType, string> = {
  general: "🔮",
  birth_chart: "🌟",
  compatibility: "💑",
  career_finance: "💼",
  love_relationship: "❤️",
  yearly_forecast: "📅",
};

// Only these 3 are shown to clients
const ACTIVE_SERVICES: ServiceType[] = ["general", "birth_chart", "compatibility"];

interface Props {
  booking: BookingData;
  update: (d: Partial<BookingData>) => void;
  next: () => void;
  lang: Lang;
}

export default function ServiceStep({ booking, update, next, lang }: Props) {
  const select = (service: ServiceType) => {
    const info = SERVICE_LABELS[service];
    update({ service, durationMinutes: info.duration, amount: info.price });
  };

  const t = {
    title: lang === "en" ? "Choose Your Service" : "आफ्नो सेवा छान्नुहोस्",
    subtitle: lang === "en"
      ? "Select the type of reading you need"
      : "तपाईंलाई चाहिने परामर्शको प्रकार छान्नुहोस्",
    duration: lang === "en" ? "min session" : "मिनेट",
    price: lang === "en" ? "NPR" : "रु",
    continue: lang === "en" ? "Continue" : "अगाडि बढ्नुहोस्",
    select_prompt: lang === "en" ? "Please select a service" : "सेवा छान्नुहोस्",
  };

  return (
    <div className="cosmic-card p-6">
      <h2 className="text-xl font-semibold text-white mb-1">{t.title}</h2>
      <p className="text-slate-400 text-sm mb-6">{t.subtitle}</p>

      <div className="grid grid-cols-1 gap-3">
        {ACTIVE_SERVICES.map((key) => {
          const info = SERVICE_LABELS[key];
          const selected = booking.service === key;
          return (
            <button
              key={key}
              onClick={() => select(key)}
              className={`flex items-center gap-4 p-4 rounded-xl border text-left transition-all duration-200 ${
                selected
                  ? "border-purple-500 bg-purple-500/10"
                  : "border-[#1e2140] hover:border-[#2e3160] hover:bg-white/5"
              }`}
            >
              <span className="text-2xl">{SERVICE_ICONS[key]}</span>
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
              <div className="text-right shrink-0">
                <p className={`font-bold ${selected ? "text-amber-400" : "text-slate-300"}`}>
                  {t.price} {info.price.toLocaleString()}
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
