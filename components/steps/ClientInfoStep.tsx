"use client";

import { useState } from "react";
import type { BookingData, Lang } from "@/app/page";
import BirthDatePicker from "@/components/BirthDatePicker";

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-slate-300 text-sm mb-1.5">{label}</label>
      {children}
    </div>
  );
}

function TimePicker({ value, onChange }: { value: string; onChange: (val: string) => void }) {
  const parseValue = (v: string) => {
    if (!v) return { hour: "", minute: "", period: "AM" };
    const [hStr, mStr] = v.split(":");
    const h = parseInt(hStr, 10);
    const period = h >= 12 ? "PM" : "AM";
    const hour12 = h === 0 ? 12 : h > 12 ? h - 12 : h;
    return { hour: String(hour12), minute: mStr || "00", period };
  };

  const parsed = parseValue(value);
  const [hour, setHour] = useState(parsed.hour);
  const [minute, setMinute] = useState(parsed.minute);
  const [period, setPeriod] = useState(parsed.period);

  const emit = (h: string, m: string, p: string) => {
    let h24 = parseInt(h, 10);
    if (isNaN(h24)) return;
    if (p === "AM" && h24 === 12) h24 = 0;
    if (p === "PM" && h24 !== 12) h24 += 12;
    onChange(`${String(h24).padStart(2, "0")}:${m.padStart(2, "0")}`);
  };

  const handleHour = (val: string) => {
    const n = val.replace(/\D/g, "");
    if (n === "" || (parseInt(n) >= 1 && parseInt(n) <= 12)) {
      setHour(n);
      if (n) emit(n, minute, period);
    }
  };

  const handleMinute = (val: string) => {
    const n = val.replace(/\D/g, "");
    if (n === "" || (parseInt(n) >= 0 && parseInt(n) <= 59)) {
      setMinute(n);
      if (n !== "") emit(hour || "12", n.padStart(2, "0"), period);
    }
  };

  const handlePeriod = (p: string) => {
    setPeriod(p);
    emit(hour || "12", minute || "00", p);
  };

  return (
    <div className="flex items-center gap-2 bg-[#0a0b1a] border border-[#1e2140] rounded-xl px-3 py-2 focus-within:border-purple-500 transition-all">
      <input
        className="w-10 bg-transparent text-center text-slate-200 text-lg font-semibold outline-none"
        value={hour}
        onChange={(e) => handleHour(e.target.value)}
        placeholder="12"
        maxLength={2}
        inputMode="numeric"
      />
      <span className="text-slate-500 text-lg font-bold">:</span>
      <input
        className="w-10 bg-transparent text-center text-slate-200 text-lg font-semibold outline-none"
        value={minute}
        onChange={(e) => handleMinute(e.target.value)}
        onBlur={() => setMinute((m) => m ? m.padStart(2, "0") : "")}
        placeholder="00"
        maxLength={2}
        inputMode="numeric"
      />
      <div className="flex gap-1 ml-1">
        {["AM", "PM"].map((p) => (
          <button
            key={p}
            type="button"
            onClick={() => handlePeriod(p)}
            className={`px-2 py-1 rounded-lg text-xs font-bold transition-all ${
              period === p ? "bg-purple-600 text-white" : "text-slate-500 hover:text-slate-300"
            }`}
          >
            {p}
          </button>
        ))}
      </div>
    </div>
  );
}

interface Props {
  booking: BookingData;
  update: (d: Partial<BookingData>) => void;
  next: () => void;
  back: () => void;
  lang: Lang;
}

export default function ClientInfoStep({ booking, update, next, back, lang }: Props) {
  const [name, setName] = useState(booking.name);
  const [phone, setPhone] = useState(booking.phone);
  const [birthDate, setBirthDate] = useState(booking.birthDate);
  const [birthDateLabel, setBirthDateLabel] = useState("");
  const [birthTime, setBirthTime] = useState(booking.birthTime);
  const [birthPlace, setBirthPlace] = useState(booking.birthPlace);
  const [gender, setGender] = useState(booking.gender);
  const [notes, setNotes] = useState(booking.notes);

  const t = {
    title: lang === "en" ? "Your Details" : "तपाईंको विवरण",
    subtitle: lang === "en"
      ? "We need your birth details for the reading"
      : "पठनका लागि तपाईंको जन्म विवरण चाहिन्छ",
    name: lang === "en" ? "Full Name *" : "पूरा नाम *",
    namePh: lang === "en" ? "Your name" : "तपाईंको नाम",
    phone: lang === "en" ? "Phone Number (WhatsApp) *" : "फोन नम्बर (WhatsApp) *",
    phonePh: lang === "en" ? "98XXXXXXXX (10 digits)" : "१० अंकको नम्बर",
    birthDate: lang === "en" ? "Birth Date *" : "जन्म मिति *",
    birthTime: lang === "en" ? "Birth Time (if known)" : "जन्म समय (थाहा छ भने)",
    birthPlace: lang === "en" ? "Birth Place *" : "जन्म स्थान *",
    birthPlacePh: lang === "en" ? "City, District" : "सहर, जिल्ला",
    gender: lang === "en" ? "Gender" : "लिङ्ग",
    male: lang === "en" ? "Male" : "पुरुष",
    female: lang === "en" ? "Female" : "महिला",
    other: lang === "en" ? "Other" : "अन्य",
    notes: lang === "en" ? "Any specific questions? (optional)" : "कुनै विशेष प्रश्न? (वैकल्पिक)",
    notesPh: lang === "en"
      ? "Tell us what you'd like to focus on..."
      : "के बारेमा जान्न चाहनुहुन्छ...",
    back: lang === "en" ? "Back" : "पछाडि",
    continue: lang === "en" ? "Continue to Payment" : "भुक्तानीतर्फ",
  };

  const validate = () => {
    if (!name.trim())
      return lang === "en" ? "Please enter your name" : "नाम लेख्नुहोस्";
    const digits = phone.replace(/\D/g, "");
    if (digits.length !== 10)
      return lang === "en" ? "Phone number must be exactly 10 digits" : "फोन नम्बर १० अंकको हुनुपर्छ";
    if (!birthDate)
      return lang === "en" ? "Please select your birth date" : "जन्म मिति छान्नुहोस्";
    if (!birthPlace.trim())
      return lang === "en" ? "Enter your birth place" : "जन्म स्थान लेख्नुहोस्";
    return null;
  };

  const handlePhone = (val: string) => {
    // Only allow digits, max 10
    const digits = val.replace(/\D/g, "").slice(0, 10);
    setPhone(digits);
  };

  const handleNext = () => {
    const err = validate();
    if (err) { alert(err); return; }
    update({ name, phone, birthDate, birthTime, birthPlace, gender, notes });
    next();
  };

  return (
    <div className="cosmic-card p-6">
      <h2 className="text-xl font-semibold text-white mb-1">{t.title}</h2>
      <p className="text-slate-400 text-sm mb-6">{t.subtitle}</p>

      <div className="space-y-4">
        <Field label={t.name}>
          <input
            className="input-cosmic"
            placeholder={t.namePh}
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
        </Field>

        <Field label={t.phone}>
          <div className="relative">
            <input
              className="input-cosmic pr-16"
              type="tel"
              placeholder={t.phonePh}
              value={phone}
              onChange={(e) => handlePhone(e.target.value)}
              inputMode="numeric"
              maxLength={10}
            />
            <span className={`absolute right-4 top-1/2 -translate-y-1/2 text-xs font-semibold ${
              phone.length === 10 ? "text-green-400" : "text-slate-600"
            }`}>
              {phone.length}/10
            </span>
          </div>
        </Field>

        <Field label={t.birthDate}>
          <BirthDatePicker
            value={birthDate}
            onChange={(adDate, label) => {
              setBirthDate(adDate);
              setBirthDateLabel(label);
            }}
            lang={lang}
          />
          {birthDateLabel ? (
            <p className="text-purple-300 text-xs mt-1">✓ {birthDateLabel}</p>
          ) : null}
        </Field>

        <Field label={t.birthTime}>
          <TimePicker value={birthTime} onChange={setBirthTime} />
        </Field>

        <Field label={t.birthPlace}>
          <input
            className="input-cosmic"
            placeholder={t.birthPlacePh}
            value={birthPlace}
            onChange={(e) => setBirthPlace(e.target.value)}
          />
        </Field>

        <Field label={t.gender}>
          <div className="flex gap-2">
            {[
              { val: "male", label: t.male },
              { val: "female", label: t.female },
              { val: "other", label: t.other },
            ].map(({ val, label }) => (
              <button
                key={val}
                onClick={() => setGender(val)}
                className={`flex-1 py-2 px-3 rounded-xl border text-sm transition-all ${
                  gender === val
                    ? "border-purple-500 bg-purple-500/10 text-purple-300"
                    : "border-[#1e2140] text-slate-400 hover:border-[#2e3160]"
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </Field>

        <Field label={t.notes}>
          <textarea
            className="input-cosmic resize-none"
            rows={3}
            placeholder={t.notesPh}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
          />
        </Field>
      </div>

      <div className="flex gap-3 mt-6">
        <button onClick={back} className="btn-ghost flex-1">{t.back}</button>
        <button onClick={handleNext} className="btn-gold flex-1">{t.continue} →</button>
      </div>
    </div>
  );
}
