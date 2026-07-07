export interface CountryCode {
  code: string;
  flag: string;
  name: string;
}

export const COUNTRY_CODES: CountryCode[] = [
  { code: "+977", flag: "🇳🇵", name: "Nepal" },
  { code: "+1",   flag: "🇺🇸", name: "USA / Canada" },
  { code: "+44",  flag: "🇬🇧", name: "UK" },
  { code: "+61",  flag: "🇦🇺", name: "Australia" },
  { code: "+64",  flag: "🇳🇿", name: "New Zealand" },
  { code: "+91",  flag: "🇮🇳", name: "India" },
  { code: "+880", flag: "🇧🇩", name: "Bangladesh" },
  { code: "+92",  flag: "🇵🇰", name: "Pakistan" },
  { code: "+94",  flag: "🇱🇰", name: "Sri Lanka" },
  { code: "+65",  flag: "🇸🇬", name: "Singapore" },
  { code: "+60",  flag: "🇲🇾", name: "Malaysia" },
  { code: "+66",  flag: "🇹🇭", name: "Thailand" },
  { code: "+971", flag: "🇦🇪", name: "UAE" },
  { code: "+974", flag: "🇶🇦", name: "Qatar" },
  { code: "+966", flag: "🇸🇦", name: "Saudi Arabia" },
  { code: "+81",  flag: "🇯🇵", name: "Japan" },
  { code: "+82",  flag: "🇰🇷", name: "South Korea" },
  { code: "+86",  flag: "🇨🇳", name: "China" },
  { code: "+49",  flag: "🇩🇪", name: "Germany" },
  { code: "+33",  flag: "🇫🇷", name: "France" },
];

export interface Country {
  name: string;
  flag: string;
}

// Nepal first, then alphabetical. Used for location country selector.
export const COUNTRIES: Country[] = [
  { name: "Nepal",                  flag: "🇳🇵" },
  { name: "Afghanistan",            flag: "🇦🇫" },
  { name: "Australia",              flag: "🇦🇺" },
  { name: "Austria",                flag: "🇦🇹" },
  { name: "Bahrain",                flag: "🇧🇭" },
  { name: "Bangladesh",             flag: "🇧🇩" },
  { name: "Belgium",                flag: "🇧🇪" },
  { name: "Bhutan",                 flag: "🇧🇹" },
  { name: "Brazil",                 flag: "🇧🇷" },
  { name: "Canada",                 flag: "🇨🇦" },
  { name: "China",                  flag: "🇨🇳" },
  { name: "Denmark",                flag: "🇩🇰" },
  { name: "Egypt",                  flag: "🇪🇬" },
  { name: "Finland",                flag: "🇫🇮" },
  { name: "France",                 flag: "🇫🇷" },
  { name: "Germany",                flag: "🇩🇪" },
  { name: "Greece",                 flag: "🇬🇷" },
  { name: "Hong Kong",              flag: "🇭🇰" },
  { name: "Hungary",                flag: "🇭🇺" },
  { name: "India",                  flag: "🇮🇳" },
  { name: "Indonesia",              flag: "🇮🇩" },
  { name: "Ireland",                flag: "🇮🇪" },
  { name: "Israel",                 flag: "🇮🇱" },
  { name: "Italy",                  flag: "🇮🇹" },
  { name: "Japan",                  flag: "🇯🇵" },
  { name: "Jordan",                 flag: "🇯🇴" },
  { name: "Kuwait",                 flag: "🇰🇼" },
  { name: "Lebanon",                flag: "🇱🇧" },
  { name: "Malaysia",               flag: "🇲🇾" },
  { name: "Maldives",               flag: "🇲🇻" },
  { name: "Mexico",                 flag: "🇲🇽" },
  { name: "Myanmar",                flag: "🇲🇲" },
  { name: "Netherlands",            flag: "🇳🇱" },
  { name: "New Zealand",            flag: "🇳🇿" },
  { name: "Nigeria",                flag: "🇳🇬" },
  { name: "Norway",                 flag: "🇳🇴" },
  { name: "Oman",                   flag: "🇴🇲" },
  { name: "Pakistan",               flag: "🇵🇰" },
  { name: "Philippines",            flag: "🇵🇭" },
  { name: "Poland",                 flag: "🇵🇱" },
  { name: "Portugal",               flag: "🇵🇹" },
  { name: "Qatar",                  flag: "🇶🇦" },
  { name: "Romania",                flag: "🇷🇴" },
  { name: "Russia",                 flag: "🇷🇺" },
  { name: "Saudi Arabia",           flag: "🇸🇦" },
  { name: "Singapore",              flag: "🇸🇬" },
  { name: "South Korea",            flag: "🇰🇷" },
  { name: "Spain",                  flag: "🇪🇸" },
  { name: "Sri Lanka",              flag: "🇱🇰" },
  { name: "Sweden",                 flag: "🇸🇪" },
  { name: "Switzerland",            flag: "🇨🇭" },
  { name: "Taiwan",                 flag: "🇹🇼" },
  { name: "Thailand",               flag: "🇹🇭" },
  { name: "Turkey",                 flag: "🇹🇷" },
  { name: "Ukraine",                flag: "🇺🇦" },
  { name: "United Arab Emirates",   flag: "🇦🇪" },
  { name: "United Kingdom",         flag: "🇬🇧" },
  { name: "United States",          flag: "🇺🇸" },
  { name: "Vietnam",                flag: "🇻🇳" },
  { name: "Other",                  flag: "🌍" },
];

// Return a WhatsApp-safe number (no +) from a stored phone value.
export function toWaNumber(phone: string): string {
  return phone.startsWith("+") ? phone.slice(1) : `977${phone.replace(/^0/, "")}`;
}
