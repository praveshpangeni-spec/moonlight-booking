import { tzToTz, TORONTO_TZ } from "@/lib/timezone";

// Fallbacks for the default (Moonlight) business when no settings are passed.
const DEFAULT_WA = "+1 (437) 898-4606";
const NEPAL_TZ = "Asia/Kathmandu";

export interface WaOptions {
  whatsappNumber?: string | null; // business's WhatsApp number
  template?: string | null;       // custom template with {name} {date} {day} {time} {number}
  storageTz?: string | null;      // tz the booking date/time is stored in (business tz)
  businessName?: string | null;   // used in the default template
  birthDate?: string | null;      // client's DOB (AD yyyy-MM-dd) — appended for confirmation
  birthDateBs?: string | null;    // DOB in BS
  birthTime?: string | null;
  birthPlace?: string | null;
}

const DAYS_NE = ["आइतबार", "सोमबार", "मंगलबार", "बुधबार", "बिहीबार", "शुक्रबार", "शनिबार"];
const MONTHS_EN = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

// 6 → ६ (Nepali/Devanagari digits)
function toNe(s: string | number): string {
  return String(s).replace(/[0-9]/g, (d) => "०१२३४५६७८९"[Number(d)]);
}

// 7 → "7th"
function ordinal(n: number): string {
  const s = ["th", "st", "nd", "rd"];
  const v = n % 100;
  return `${n}${s[(v - 20) % 10] || s[v] || s[0]}`;
}

// Nepali part-of-day prefix for a 24h hour.
function partOfDay(h: number): string {
  if (h >= 4 && h < 12) return "बिहान";
  if (h >= 12 && h < 16) return "दिउँसो";
  if (h >= 16 && h < 19) return "साँझ";
  return "राति";
}

// "HH:MM" (Nepal) → e.g. "बिहान ५ बजे" / "साँझ ६ बजे"
function nepaliTime(hhmm: string): string {
  const [h, m] = hhmm.split(":").map(Number);
  const h12 = h % 12 === 0 ? 12 : h % 12;
  const clock = m === 0 ? toNe(h12) : `${toNe(h12)}:${toNe(String(m).padStart(2, "0"))}`;
  return `${partOfDay(h)} ${clock} बजे`;
}

// Post-booking confirmation message. Takes the client's name plus the booking's
// stored date + start time (in the business's storage tz), with the appointment
// expressed in Nepal time — date in English, day/time in Nepali.
export function bookingWhatsappMessage(
  name: string,
  storedDate: string,
  storedStartTime: string,
  opts: WaOptions = {},
): string {
  const firstName = (name || "").trim().split(/\s+/)[0] || "";
  const fromTz = opts.storageTz || TORONTO_TZ;
  const { date, time } = tzToTz(storedDate, storedStartTime, fromTz, NEPAL_TZ);
  const [y, mo, d] = date.split("-").map(Number);
  const dayNe = DAYS_NE[new Date(Date.UTC(y, mo - 1, d)).getUTCDay()];
  const dateEn = `${MONTHS_EN[mo - 1]} ${ordinal(d)}`;
  const timeNe = nepaliTime(time);
  const waNumber = opts.whatsappNumber || DEFAULT_WA;
  const bizName = opts.businessName || "Astro Booking";

  // Birth-detail confirmation block (appended to either template)
  const birthLines: string[] = [];
  if (opts.birthDate) birthLines.push(`जन्म मिति: ${opts.birthDate}${opts.birthDateBs ? ` (${opts.birthDateBs})` : ""}`);
  if (opts.birthTime) birthLines.push(`जन्म समय: ${opts.birthTime}`);
  if (opts.birthPlace) birthLines.push(`जन्म स्थान: ${opts.birthPlace}`);
  const birthBlock = birthLines.length
    ? `\n\nतपाईंको जन्म विवरण (कृपया पुष्टि गर्नुहोस्):\n${birthLines.join("\n")}`
    : "";

  if (opts.template) {
    return opts.template
      .replaceAll("{name}", firstName)
      .replaceAll("{date}", dateEn)
      .replaceAll("{day}", dayNe)
      .replaceAll("{time}", timeNe)
      .replaceAll("{number}", waNumber) + birthBlock;
  }

  return `नमस्ते ${firstName} ज्यु , ${bizName} ✨🌟 मा विश्वास गर्नुभएकोमा तपाईंलाई धेरै-धेरै धन्यवाद। तपाईंको Appointment यही ${dateEn}, ${dayNe} (नेपाली समय अनुसार ${timeNe}) तय गरिएको छ। कृपया निर्धारित समयमा मलाई मेरो WhatsApp Number ${waNumber}  मा message गर्नुहोला🙏🏻तपाईंको धैर्यताको लागि धन्यवाद! 🙏🏻🌟 ${bizName} — guidance to your soul’s path🙏🏻${birthBlock}`;
}
