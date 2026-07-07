export const TORONTO_TZ = 'America/Toronto';

export const COMMON_TIMEZONES = [
  { value: 'America/Toronto',   label: 'Toronto / New York (ET)' },
  { value: 'America/Chicago',   label: 'Chicago / Mexico City (CT)' },
  { value: 'America/Denver',    label: 'Denver (MT)' },
  { value: 'America/Vancouver', label: 'Vancouver / Los Angeles (PT)' },
  { value: 'America/Halifax',   label: 'Halifax (AT)' },
  { value: 'America/St_Johns',  label: "St. John's (NT)" },
  { value: 'America/Sao_Paulo', label: 'São Paulo (BRT)' },
  { value: 'UTC',               label: 'UTC' },
  { value: 'Europe/London',     label: 'London (GMT/BST)' },
  { value: 'Europe/Paris',      label: 'Paris / Berlin (CET)' },
  { value: 'Europe/Istanbul',   label: 'Istanbul (TRT)' },
  { value: 'Europe/Moscow',     label: 'Moscow (MSK)' },
  { value: 'Asia/Dubai',        label: 'Dubai (GST)' },
  { value: 'Asia/Kolkata',      label: 'India (IST)' },
  { value: 'Asia/Kathmandu',    label: 'Nepal (NPT)' },
  { value: 'Asia/Dhaka',        label: 'Dhaka (BST)' },
  { value: 'Asia/Bangkok',      label: 'Bangkok (ICT)' },
  { value: 'Asia/Singapore',    label: 'Singapore (SGT)' },
  { value: 'Asia/Shanghai',     label: 'China (CST)' },
  { value: 'Asia/Tokyo',        label: 'Tokyo (JST)' },
  { value: 'Asia/Seoul',        label: 'Seoul (KST)' },
  { value: 'Australia/Perth',   label: 'Perth (AWST)' },
  { value: 'Australia/Sydney',  label: 'Sydney / Melbourne (AEST/AEDT)' },
  { value: 'Pacific/Auckland',  label: 'Auckland (NZST/NZDT)' },
];

// Cache formatters — Intl.DateTimeFormat is expensive to construct; reuse by TZ key.
const _fmtCache = new Map<string, Intl.DateTimeFormat>();
function _fmt(tz: string): Intl.DateTimeFormat {
  let f = _fmtCache.get(tz);
  if (!f) {
    f = new Intl.DateTimeFormat('en-CA', {
      timeZone: tz,
      year: 'numeric', month: '2-digit', day: '2-digit',
      hour: '2-digit', minute: '2-digit', hour12: false,
    });
    _fmtCache.set(tz, f);
  }
  return f;
}

// Normalize to HH:MM — Supabase time columns return HH:MM:SS which
// produces an invalid ISO string ("T10:00:00:00Z") and crashes formatToParts.
function normalizeTime(t: string): string {
  return t.length > 5 ? t.slice(0, 5) : t;
}

// Convert a naive date+time string in `fromTz` to a UTC Date object.
// Algorithm: treat dateStr+timeStr as UTC to get a naive epoch, then measure
// how far off that is from the tz's actual local representation, and correct.
function tzToUtcDate(dateStr: string, timeStr: string, fromTz: string): Date {
  const naiveUtc = new Date(`${dateStr}T${normalizeTime(timeStr)}:00Z`);
  const parts = _fmt(fromTz).formatToParts(naiveUtc);
  const get = (type: string) => parts.find(p => p.type === type)?.value ?? '0';
  let h = parseInt(get('hour'));
  if (h === 24) h = 0;
  const localAsUtc = new Date(Date.UTC(
    parseInt(get('year')), parseInt(get('month')) - 1, parseInt(get('day')), h, parseInt(get('minute')), 0,
  ));
  return new Date(naiveUtc.getTime() + (naiveUtc.getTime() - localAsUtc.getTime()));
}

// Convert a UTC Date to { date: 'yyyy-MM-dd', time: 'HH:mm' } in a target timezone.
export function utcToTz(utcDate: Date, tz: string): { date: string; time: string } {
  const parts = _fmt(tz).formatToParts(utcDate);
  const get = (type: string) => parts.find(p => p.type === type)?.value ?? '00';
  let hour = get('hour');
  if (hour === '24') hour = '00';
  return {
    date: `${get('year')}-${get('month')}-${get('day')}`,
    time: `${hour}:${get('minute')}`,
  };
}

// Convert Toronto-stored date+time to another timezone.
export function torontoToTz(dateStr: string, timeStr: string, targetTz: string) {
  return utcToTz(tzToUtcDate(dateStr, timeStr, TORONTO_TZ), targetTz);
}

// Convert date+time in any timezone to Toronto storage format.
export function tzToToronto(dateStr: string, timeStr: string, fromTz: string) {
  return utcToTz(tzToUtcDate(dateStr, timeStr, fromTz), TORONTO_TZ);
}

// Short timezone abbreviation for display (e.g. "EDT", "AEST").
export function getTzAbbr(tz: string): string {
  try {
    return new Intl.DateTimeFormat('en-US', { timeZone: tz, timeZoneName: 'short' })
      .formatToParts(new Date())
      .find(p => p.type === 'timeZoneName')?.value ?? tz;
  } catch { return tz; }
}

// 'yyyy-MM-dd' for today in a given timezone.
export function todayIn(tz: string): string {
  return utcToTz(new Date(), tz).date;
}

// 'yyyy-MM-dd' for tomorrow in a given timezone.
export function tomorrowIn(tz: string): string {
  const { date } = utcToTz(new Date(), tz);
  const [y, m, d] = date.split('-').map(Number);
  return utcToTz(new Date(Date.UTC(y, m - 1, d + 1)), tz).date;
}

// Current 'HH:mm' in a given timezone.
export function currentTimeIn(tz: string): string {
  return utcToTz(new Date(), tz).time;
}

// Format 'HH:mm' or 'HH:mm:ss' → '2:30 PM' style.
export function fmt12(t: string): string {
  const [h, m] = t.split(':').map(Number);
  return `${h > 12 ? h - 12 : h === 0 ? 12 : h}:${String(m).padStart(2, '0')} ${h >= 12 ? 'PM' : 'AM'}`;
}
