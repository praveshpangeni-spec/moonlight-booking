"use client";

import { useState, useEffect } from "react";
import type { Lang } from "@/app/page";

// ── Nepali month names ───────────────────────────────────────────────────────
const BS_MONTHS = [
  "बैशाख","जेठ","असार","साउन","भदौ","असोज",
  "कार्तिक","मंसिर","पुष","माघ","फागुन","चैत",
];
const BS_MONTHS_EN = [
  "Baisakh","Jestha","Ashadh","Shrawan","Bhadra","Ashwin",
  "Kartik","Mangsir","Poush","Magh","Falgun","Chaitra",
];
const AD_MONTHS_EN = [
  "January","February","March","April","May","June",
  "July","August","September","October","November","December",
];
const AD_MONTHS_NE = [
  "जनवरी","फेब्रुअरी","मार्च","अप्रिल","मे","जुन",
  "जुलाई","अगस्ट","सेप्टेम्बर","अक्टोबर","नोभेम्बर","डिसेम्बर",
];

// ── BS calendar data: days per month for 2000–2082 ──────────────────────────
// Reference: BS 1/1/2000 = AD 14/4/1943
const BS_CALENDAR: Record<number, number[]> = {
  2000:[30,32,31,32,31,30,30,30,29,30,29,31],
  2001:[31,31,32,31,31,31,30,29,30,29,30,30],
  2002:[31,31,32,32,31,30,30,29,30,29,30,30],
  2003:[31,32,31,32,31,30,30,30,29,29,30,31],
  2004:[30,32,31,32,31,30,30,30,29,30,29,31],
  2005:[31,31,32,31,31,31,30,29,30,29,30,30],
  2006:[31,31,32,32,31,30,30,29,30,29,30,30],
  2007:[31,32,31,32,31,30,30,30,29,29,30,31],
  2008:[31,31,31,32,31,31,29,30,29,30,29,31],
  2009:[31,31,32,31,31,31,30,29,30,29,30,30],
  2010:[31,31,32,32,31,30,30,29,30,29,30,30],
  2011:[31,32,31,32,31,30,30,30,29,29,30,31],
  2012:[31,31,31,32,31,31,29,30,29,30,29,31],
  2013:[31,31,32,31,31,31,30,29,30,29,30,30],
  2014:[31,31,32,32,31,30,30,29,30,29,30,30],
  2015:[31,32,31,32,31,30,30,30,29,29,30,31],
  2016:[31,31,31,32,31,31,29,30,29,30,29,31],
  2017:[31,31,32,31,31,31,30,29,30,29,30,30],
  2018:[31,32,31,32,31,30,30,29,30,29,30,30],
  2019:[31,32,31,32,31,30,30,30,29,29,30,31],
  2020:[31,31,31,32,31,31,29,30,29,30,29,31],
  2021:[31,31,32,31,31,31,30,29,30,29,30,30],
  2022:[31,31,32,32,31,30,30,29,30,29,30,30],
  2023:[31,32,31,32,31,30,30,30,29,29,30,31],
  2024:[31,31,31,32,31,31,29,30,29,30,29,31],
  2025:[31,31,32,31,31,31,30,29,30,29,30,30],
  2026:[31,31,32,32,31,30,30,29,30,29,30,30],
  2027:[31,32,31,32,31,30,30,30,29,29,30,31],
  2028:[31,31,31,32,31,31,30,29,29,30,29,31],
  2029:[31,31,32,31,31,31,30,29,30,29,30,30],
  2030:[31,32,31,32,31,30,30,30,29,30,29,31],
  2031:[31,31,32,31,31,31,30,29,30,29,30,30],
  2032:[31,31,32,32,31,30,30,29,30,29,30,30],
  2033:[31,32,31,32,31,30,30,30,29,29,30,31],
  2034:[30,32,31,32,31,30,30,30,29,30,29,31],
  2035:[31,31,32,31,31,31,30,29,30,29,30,30],
  2036:[31,31,32,32,31,30,30,29,30,29,30,30],
  2037:[31,32,31,32,31,30,30,30,29,29,30,31],
  2038:[31,31,31,32,31,31,29,30,30,29,29,31],
  2039:[31,31,32,31,31,31,30,29,30,29,30,30],
  2040:[31,31,32,32,31,30,30,29,30,29,30,30],
  2041:[31,32,31,32,31,30,30,30,29,29,30,31],
  2042:[31,31,31,32,31,31,29,30,29,30,29,31],
  2043:[31,31,32,31,31,31,30,29,30,29,30,30],
  2044:[31,31,32,32,31,30,30,29,30,29,30,30],
  2045:[31,32,31,32,31,30,30,30,29,29,30,31],
  2046:[31,31,31,32,31,31,29,30,29,30,29,31],
  2047:[31,31,32,31,31,31,30,29,30,29,30,30],
  2048:[31,31,32,32,31,30,30,29,30,29,30,30],
  2049:[31,32,31,32,31,30,30,30,29,29,30,30],
  2050:[31,32,31,32,31,30,30,30,29,30,29,31],
  2051:[31,31,32,31,31,31,30,29,30,29,30,30],
  2052:[31,31,32,32,31,30,30,29,30,29,30,30],
  2053:[31,32,31,32,31,30,30,30,29,29,30,31],
  2054:[31,31,31,32,31,31,29,30,30,29,29,31],
  2055:[31,31,32,31,31,31,30,29,30,29,30,30],
  2056:[31,31,32,32,31,30,30,29,30,29,30,30],
  2057:[31,32,31,32,31,30,30,30,29,29,30,31],
  2058:[31,31,31,32,31,31,29,30,29,30,29,31],
  2059:[31,31,32,31,31,31,30,29,30,29,30,30],
  2060:[31,31,32,32,31,30,30,29,30,29,30,30],
  2061:[31,32,31,32,31,30,30,30,29,29,30,31],
  2062:[31,31,31,32,31,31,30,29,29,30,29,31],
  2063:[31,31,32,31,31,31,30,29,30,29,30,30],
  2064:[31,31,32,32,31,30,30,29,30,29,30,30],
  2065:[31,32,31,32,31,30,30,30,29,29,30,31],
  2066:[31,31,31,32,31,31,30,29,29,30,29,31],
  2067:[31,31,32,31,31,31,30,29,30,29,30,30],
  2068:[31,31,32,32,31,30,30,29,30,29,30,30],
  2069:[31,32,31,32,31,30,30,30,29,29,30,31],
  2070:[31,31,31,32,31,31,29,30,29,30,29,31],
  2071:[31,31,32,31,31,31,30,29,30,29,30,30],
  2072:[31,32,31,32,31,30,30,29,30,29,30,30],
  2073:[31,32,31,32,31,30,30,30,29,29,30,30],
  2074:[31,31,32,31,31,31,30,30,29,29,30,31],
  2075:[31,31,32,31,32,30,30,29,30,29,30,30],
  2076:[31,32,31,32,31,30,30,30,29,29,30,31],
  2077:[31,31,31,32,31,31,30,29,29,30,30,30],
  2078:[31,31,32,31,31,31,30,29,30,29,30,30],
  2079:[31,31,32,32,31,30,30,29,30,29,30,30],
  2080:[31,32,31,32,31,30,30,30,29,29,30,31],
  2081:[31,31,31,32,31,31,29,30,29,30,29,31],
  2082:[31,31,32,31,31,31,30,29,30,29,30,30],
};

// ── BS → AD conversion ───────────────────────────────────────────────────────
// Reference: BS 2000/1/1 = AD 1943/4/14
const BS_REF = { year: 2000, month: 1, day: 1 };
const AD_REF = new Date(1943, 3, 14); // month is 0-indexed

function bsToAd(bsYear: number, bsMonth: number, bsDay: number): string | null {
  try {
    // Count total days from reference
    let totalDays = 0;
    for (let y = BS_REF.year; y < bsYear; y++) {
      if (!BS_CALENDAR[y]) return null;
      totalDays += BS_CALENDAR[y].reduce((a, b) => a + b, 0);
    }
    for (let m = 1; m < bsMonth; m++) {
      totalDays += BS_CALENDAR[bsYear][m - 1];
    }
    totalDays += bsDay - 1;

    const adDate = new Date(AD_REF);
    adDate.setDate(adDate.getDate() + totalDays);

    const y = adDate.getFullYear();
    const mo = String(adDate.getMonth() + 1).padStart(2, "0");
    const d = String(adDate.getDate()).padStart(2, "0");
    return `${y}-${mo}-${d}`;
  } catch {
    return null;
  }
}

function getDaysInBsMonth(year: number, month: number): number {
  return BS_CALENDAR[year]?.[month - 1] ?? 30;
}

function getDaysInAdMonth(year: number, month: number): number {
  return new Date(year, month, 0).getDate();
}

// ── Props ─────────────────────────────────────────────────────────────────────
interface Props {
  value: string;          // stored as AD ISO "YYYY-MM-DD"
  onChange: (adDate: string, displayLabel: string) => void;
  lang: Lang;
}

export default function BirthDatePicker({ value, onChange, lang }: Props) {
  const [system, setSystem] = useState<"AD" | "BS">("BS");

  // AD fields
  const [adYear, setAdYear] = useState("");
  const [adMonth, setAdMonth] = useState("");
  const [adDay, setAdDay] = useState("");

  // BS fields
  const [bsYear, setBsYear] = useState("");
  const [bsMonth, setBsMonth] = useState("");
  const [bsDay, setBsDay] = useState("");

  const adYears = Array.from({ length: 71 }, (_, i) => String(1950 + i)); // 1950–2020
  const bsYears = Array.from({ length: 83 }, (_, i) => String(2000 + i)); // 2000–2082 ≈ 1943–2025 AD

  const adMonths = lang === "en" ? AD_MONTHS_EN : AD_MONTHS_NE;
  const bsMonths = BS_MONTHS; // always Nepali

  const adDaysCount = adYear && adMonth ? getDaysInAdMonth(Number(adYear), Number(adMonth)) : 31;
  const bsDaysCount = bsYear && bsMonth ? getDaysInBsMonth(Number(bsYear), Number(bsMonth)) : 30;

  const adDays = Array.from({ length: adDaysCount }, (_, i) => String(i + 1));
  const bsDays = Array.from({ length: bsDaysCount }, (_, i) => String(i + 1));

  // Emit when all 3 fields filled
  useEffect(() => {
    if (system === "AD" && adYear && adMonth && adDay) {
      const iso = `${adYear}-${adMonth.padStart(2, "0")}-${adDay.padStart(2, "0")}`;
      onChange(iso, `${adDay} ${AD_MONTHS_EN[Number(adMonth) - 1]} ${adYear} AD`);
    }
  }, [adYear, adMonth, adDay, system]);

  useEffect(() => {
    if (system === "BS" && bsYear && bsMonth && bsDay) {
      const adIso = bsToAd(Number(bsYear), Number(bsMonth), Number(bsDay));
      if (adIso) {
        const label = `${bsDay} ${BS_MONTHS[Number(bsMonth) - 1]} ${bsYear} BS`;
        onChange(adIso, label);
      }
    }
  }, [bsYear, bsMonth, bsDay, system]);

  const switchSystem = (s: "AD" | "BS") => {
    setSystem(s);
    setAdYear(""); setAdMonth(""); setAdDay("");
    setBsYear(""); setBsMonth(""); setBsDay("");
    onChange("", "");
  };

  const sel =
    "bg-[#0a0b1a] border border-[#1e2140] rounded-xl px-3 py-2.5 text-slate-200 text-sm outline-none w-full appearance-none focus:border-purple-500 transition-all cursor-pointer";

  return (
    <div className="space-y-2">
      {/* AD / BS toggle */}
      <div className="flex gap-1 bg-[#0a0b1a] border border-[#1e2140] rounded-xl p-1 w-fit">
        {(["BS", "AD"] as const).map((s) => (
          <button
            key={s}
            type="button"
            onClick={() => switchSystem(s)}
            className={`px-4 py-1.5 rounded-lg text-sm font-semibold transition-all ${
              system === s ? "bg-purple-600 text-white" : "text-slate-400 hover:text-slate-200"
            }`}
          >
            {s}
          </button>
        ))}
      </div>

      {/* Date selects */}
      {system === "BS" ? (
        <div className="grid grid-cols-3 gap-2">
          {/* Year */}
          <div>
            <p className="text-slate-500 text-xs mb-1">{lang === "en" ? "Year" : "वर्ष"}</p>
            <select className={sel} value={bsYear} onChange={(e) => { setBsYear(e.target.value); setBsMonth(""); setBsDay(""); }}>
              <option value="">—</option>
              {bsYears.map((y) => <option key={y} value={y}>{y}</option>)}
            </select>
          </div>
          {/* Month */}
          <div>
            <p className="text-slate-500 text-xs mb-1">{lang === "en" ? "Month" : "महिना"}</p>
            <select className={sel} value={bsMonth} onChange={(e) => { setBsMonth(e.target.value); setBsDay(""); }} disabled={!bsYear}>
              <option value="">—</option>
              {bsMonths.map((m, i) => (
                <option key={i} value={String(i + 1)}>{m}</option>
              ))}
            </select>
          </div>
          {/* Day */}
          <div>
            <p className="text-slate-500 text-xs mb-1">{lang === "en" ? "Day" : "गते"}</p>
            <select className={sel} value={bsDay} onChange={(e) => setBsDay(e.target.value)} disabled={!bsMonth}>
              <option value="">—</option>
              {bsDays.map((d) => <option key={d} value={d}>{d}</option>)}
            </select>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-3 gap-2">
          {/* Year */}
          <div>
            <p className="text-slate-500 text-xs mb-1">{lang === "en" ? "Year" : "वर्ष"}</p>
            <select className={sel} value={adYear} onChange={(e) => { setAdYear(e.target.value); setAdMonth(""); setAdDay(""); }}>
              <option value="">—</option>
              {adYears.map((y) => <option key={y} value={y}>{y}</option>)}
            </select>
          </div>
          {/* Month */}
          <div>
            <p className="text-slate-500 text-xs mb-1">{lang === "en" ? "Month" : "महिना"}</p>
            <select className={sel} value={adMonth} onChange={(e) => { setAdMonth(e.target.value); setAdDay(""); }} disabled={!adYear}>
              <option value="">—</option>
              {adMonths.map((m, i) => (
                <option key={i} value={String(i + 1)}>{m}</option>
              ))}
            </select>
          </div>
          {/* Day */}
          <div>
            <p className="text-slate-500 text-xs mb-1">{lang === "en" ? "Day" : "गते"}</p>
            <select className={sel} value={adDay} onChange={(e) => setAdDay(e.target.value)} disabled={!adMonth}>
              <option value="">—</option>
              {adDays.map((d) => <option key={d} value={d}>{d}</option>)}
            </select>
          </div>
        </div>
      )}
    </div>
  );
}
