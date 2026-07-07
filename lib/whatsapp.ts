import { torontoToTz } from "@/lib/timezone";

// Admin/business WhatsApp number shown to clients.
const ADMIN_WA = "+1 (437) 898-4606";
const NEPAL_TZ = "Asia/Kathmandu";

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
// Toronto date + start time (as stored), with date in English and day/time in Nepali.
export function bookingWhatsappMessage(name: string, torontoDate: string, torontoStartTime: string): string {
  const firstName = (name || "").trim().split(/\s+/)[0] || "";
  const { date, time } = torontoToTz(torontoDate, torontoStartTime, NEPAL_TZ);
  const [y, mo, d] = date.split("-").map(Number);
  const dayNe = DAYS_NE[new Date(Date.UTC(y, mo - 1, d)).getUTCDay()];
  const dateEn = `${MONTHS_EN[mo - 1]} ${ordinal(d)}`;
  const timeNe = nepaliTime(time);

  return `नमस्ते ${firstName} ज्यु , Moonlight Astrology ✨🌙 मा विश्वास गर्नुभएकोमा तपाईंलाई धेरै-धेरै धन्यवाद। तपाईंको Appointment यही ${dateEn}, ${dayNe} (नेपाली समय अनुसार ${timeNe}) तय गरिएको छ। कृपया निर्धारित समयमा मलाई मेरो WhatsApp Number ${ADMIN_WA}  मा message गर्नुहोला🙏🏻तपाईंको धैर्यताको लागि धन्यवाद! 🙏🏻🌙 Moonlight Astrology — guidance to your soul’s path🙏🏻`;
}
