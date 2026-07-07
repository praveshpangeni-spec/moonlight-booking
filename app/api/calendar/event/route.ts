import { NextResponse } from "next/server";
import crypto from "crypto";

// Google Calendar sync for bookings, via a service account.
// Configure via env vars (Vercel → Project → Settings → Environment Variables):
//   GOOGLE_SA_EMAIL       — service account email (…@….iam.gserviceaccount.com)
//   GOOGLE_SA_PRIVATE_KEY — the service account's private_key (paste incl. the \n's)
//   GOOGLE_CALENDAR_ID    — the calendar to write to (your Gmail address for primary)
// Until all three are set, this route safely no-ops so bookings still work.
//
// Actions (POST body `action`):
//   (none)/"create" — create an event
//   "mark-paid"     — find the booking's event, flip title to Paid
//   "delete"        — find the booking's event and delete it
//   "update"        — find by original name+date+time, move to new date/time + title

const SA_EMAIL = process.env.GOOGLE_SA_EMAIL;
const SA_KEY = process.env.GOOGLE_SA_PRIVATE_KEY;
const CAL_ID = process.env.GOOGLE_CALENDAR_ID;
const EVENT_TZ = "America/Toronto"; // bookings are stored in Toronto time
const CAL_BASE = `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(CAL_ID || "")}/events`;

function base64url(input: Buffer | string): string {
  return Buffer.from(input).toString("base64").replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_");
}

// Sign a JWT with the service account key and exchange it for an access token.
async function getAccessToken(): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  const header = base64url(JSON.stringify({ alg: "RS256", typ: "JWT" }));
  const claim = base64url(JSON.stringify({
    iss: SA_EMAIL,
    scope: "https://www.googleapis.com/auth/calendar",
    aud: "https://oauth2.googleapis.com/token",
    exp: now + 3600,
    iat: now,
  }));
  const unsigned = `${header}.${claim}`;
  const key = (SA_KEY || "").replace(/\\n/g, "\n");
  const signature = crypto.createSign("RSA-SHA256").update(unsigned).sign(key);
  const jwt = `${unsigned}.${base64url(signature)}`;

  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion: jwt,
    }),
  });
  const data = await res.json();
  if (!data.access_token) throw new Error("Token error: " + JSON.stringify(data));
  return data.access_token as string;
}

const pad = (n: number) => String(n).padStart(2, "0");

// Compute event start/end dateTimes (Toronto local, no offset) from a booking.
function computeTimes(date: string, startTime: string, durationMinutes?: number) {
  const [h, m] = String(startTime).split(":").map(Number);
  const startMins = h * 60 + m;
  const endMins = startMins + (Number(durationMinutes) || 60);
  const startDateTime = `${date}T${pad(h)}:${pad(m)}:00`;
  let endDate = date;
  if (endMins >= 1440) {
    const d = new Date(`${date}T12:00:00`);
    d.setDate(d.getDate() + Math.floor(endMins / 1440));
    endDate = d.toISOString().slice(0, 10);
  }
  const endDateTime = `${endDate}T${pad(Math.floor((endMins % 1440) / 60))}:${pad(endMins % 60)}:00`;
  return { startDateTime, endDateTime };
}

// Find the booking's calendar event by name + exact start time (Toronto local).
async function findEvent(token: string, name: string, date: string, startTime: string): Promise<any | null> {
  const [hh, mm] = String(startTime).split(":").map(Number);
  const localStart = `${date}T${pad(hh)}:${pad(mm)}:00`;
  const lo = new Date(`${date}T00:00:00Z`); lo.setUTCDate(lo.getUTCDate() - 1);
  const hi = new Date(`${date}T00:00:00Z`); hi.setUTCDate(hi.getUTCDate() + 2);
  const listUrl = `${CAL_BASE}?` + new URLSearchParams({
    q: name || "",
    timeMin: lo.toISOString(),
    timeMax: hi.toISOString(),
    singleEvents: "true",
    maxResults: "50",
  });
  const res = await fetch(listUrl, { headers: { Authorization: `Bearer ${token}` } });
  const data = await res.json();
  const prefix = `Consultation - ${name}`;
  return (data.items || []).find((e: any) =>
    (e.summary || "").startsWith(prefix) && (e.start?.dateTime || "").startsWith(localStart)) || null;
}

export async function POST(req: Request) {
  if (!SA_EMAIL || !SA_KEY || !CAL_ID) {
    return NextResponse.json({ skipped: true, reason: "calendar not configured" });
  }

  try {
    const body = await req.json();
    const { action, name, date, startTime, durationMinutes, service, notes, paymentStatus } = body;
    const payLabel = paymentStatus === "paid" ? "Paid" : "Unpaid";

    // ── mark-paid ────────────────────────────────────────────────────
    if (action === "mark-paid") {
      if (!date || !startTime) return NextResponse.json({ error: "missing date/time" }, { status: 400 });
      const token = await getAccessToken();
      const ev = await findEvent(token, name, date, startTime);
      if (!ev) return NextResponse.json({ ok: false, reason: "event not found" });
      const res = await fetch(`${CAL_BASE}/${ev.id}`, {
        method: "PATCH",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ summary: `Consultation - ${name} - Paid` }),
      });
      const d = await res.json();
      if (!res.ok) return NextResponse.json({ error: d }, { status: 500 });
      return NextResponse.json({ ok: true, id: d.id });
    }

    // ── delete ───────────────────────────────────────────────────────
    if (action === "delete") {
      if (!date || !startTime) return NextResponse.json({ error: "missing date/time" }, { status: 400 });
      const token = await getAccessToken();
      const ev = await findEvent(token, name, date, startTime);
      if (!ev) return NextResponse.json({ ok: false, reason: "event not found" });
      const res = await fetch(`${CAL_BASE}/${ev.id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok && res.status !== 410) { // 410 = already deleted
        return NextResponse.json({ error: await res.text() }, { status: 500 });
      }
      return NextResponse.json({ ok: true });
    }

    // ── update (reschedule / retitle) ────────────────────────────────
    if (action === "update") {
      const { origDate, origStartTime } = body;
      if (!origDate || !origStartTime || !date || !startTime) {
        return NextResponse.json({ error: "missing date/time" }, { status: 400 });
      }
      const token = await getAccessToken();
      const ev = await findEvent(token, name, origDate, origStartTime);
      if (!ev) return NextResponse.json({ ok: false, reason: "event not found" });
      const { startDateTime, endDateTime } = computeTimes(date, startTime, durationMinutes);
      const res = await fetch(`${CAL_BASE}/${ev.id}`, {
        method: "PATCH",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          summary: `Consultation - ${name} - ${payLabel}`,
          start: { dateTime: startDateTime, timeZone: EVENT_TZ },
          end: { dateTime: endDateTime, timeZone: EVENT_TZ },
        }),
      });
      const d = await res.json();
      if (!res.ok) return NextResponse.json({ error: d }, { status: 500 });
      return NextResponse.json({ ok: true, id: d.id });
    }

    // ── create (default) ─────────────────────────────────────────────
    if (!date || !startTime) return NextResponse.json({ error: "missing date/time" }, { status: 400 });
    const { startDateTime, endDateTime } = computeTimes(date, startTime, durationMinutes);
    const token = await getAccessToken();
    const res = await fetch(CAL_BASE, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        summary: `Consultation - ${name || "Client"} - ${payLabel}`,
        description: [service, notes].filter(Boolean).join("\n") || undefined,
        start: { dateTime: startDateTime, timeZone: EVENT_TZ },
        end: { dateTime: endDateTime, timeZone: EVENT_TZ },
      }),
    });
    const data = await res.json();
    if (!res.ok) return NextResponse.json({ error: data }, { status: 500 });
    return NextResponse.json({ ok: true, id: data.id, htmlLink: data.htmlLink });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
