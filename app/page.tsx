"use client";

import { useState } from "react";
import StepIndicator from "@/components/StepIndicator";
import ServiceStep from "@/components/steps/ServiceStep";
import SlotStep from "@/components/steps/SlotStep";
import ClientInfoStep from "@/components/steps/ClientInfoStep";
import PaymentStep from "@/components/steps/PaymentStep";
import SuccessScreen from "@/components/SuccessScreen";
import StarField from "@/components/StarField";
import LanguageToggle from "@/components/LanguageToggle";
import type { ServiceType } from "@/lib/database.types";

export type Lang = "en" | "ne";

export interface BookingData {
  service: ServiceType | null;
  date: Date | null;
  startTime: string | null;
  durationMinutes: number;
  amount: number;
  name: string;
  phone: string;
  birthDate: string;
  birthTime: string;
  birthPlace: string;
  gender: string;
  notes: string;
}

const INITIAL_BOOKING: BookingData = {
  service: null,
  date: null,
  startTime: null,
  durationMinutes: 60,
  amount: 0,
  name: "",
  phone: "",
  birthDate: "",
  birthTime: "",
  birthPlace: "",
  gender: "",
  notes: "",
};

const STEPS = {
  en: ["Service", "Date & Time", "Your Info", "Payment"],
  ne: ["सेवा", "मिति र समय", "विवरण", "भुक्तानी"],
};

export default function BookingPage() {
  const [step, setStep] = useState(0);
  const [lang, setLang] = useState<Lang>("ne");
  const [booking, setBooking] = useState<BookingData>(INITIAL_BOOKING);
  const [bookingId, setBookingId] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  const update = (data: Partial<BookingData>) => setBooking((prev) => ({ ...prev, ...data }));

  const next = () => setStep((s) => Math.min(s + 1, 3));
  const back = () => setStep((s) => Math.max(s - 1, 0));

  if (done && bookingId) {
    return <SuccessScreen booking={booking} bookingId={bookingId} lang={lang} />;
  }

  return (
    <div className="min-h-screen bg-cosmic-gradient relative overflow-hidden">
      <StarField />

      <div className="relative z-10 max-w-lg mx-auto px-4 py-8">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="flex items-center justify-between mb-4">
            <div />
            <LanguageToggle lang={lang} setLang={setLang} />
          </div>
          <div className="text-5xl mb-2">🌙</div>
          <h1 className="text-2xl font-display font-bold text-white">Moonlight Astrology</h1>
          <p className="text-amber-400 text-sm mt-1">
            {lang === "en" ? "Astrology for Better Life" : "राम्रो जीवनका लागि ज्योतिष"}
          </p>
        </div>

        {/* Step indicator */}
        <StepIndicator steps={STEPS[lang]} currentStep={step} />

        {/* Step content */}
        <div className="mt-6">
          {step === 0 && (
            <ServiceStep booking={booking} update={update} next={next} lang={lang} />
          )}
          {step === 1 && (
            <SlotStep booking={booking} update={update} next={next} back={back} lang={lang} />
          )}
          {step === 2 && (
            <ClientInfoStep booking={booking} update={update} next={next} back={back} lang={lang} />
          )}
          {step === 3 && (
            <PaymentStep
              booking={booking}
              back={back}
              lang={lang}
              onSuccess={(id) => {
                setBookingId(id);
                setDone(true);
              }}
            />
          )}
        </div>

        {/* Footer */}
        <p className="text-center text-slate-600 text-xs mt-8">
          {lang === "en"
            ? "Questions? WhatsApp us directly"
            : "प्रश्न छ? हामीलाई WhatsApp गर्नुहोस्"}
        </p>
      </div>
    </div>
  );
}
