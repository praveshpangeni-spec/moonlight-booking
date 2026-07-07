// Fire-and-forget: ask the server to add a booking to the owner's Google Calendar.
// Never throws and never blocks the booking flow — if the calendar isn't configured
// or the request fails, the booking still succeeds.
export function addToCalendar(payload: {
  name: string;
  date: string;          // Toronto yyyy-MM-dd
  startTime: string;     // Toronto HH:MM
  durationMinutes: number;
  service?: string;
  notes?: string;
  paymentStatus?: string; // "paid" | "unpaid"
  businessId?: string;    // multi-tenant: which business's calendar
}): void {
  try {
    fetch("/api/calendar/event", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      keepalive: true, // still sends if the page navigates (e.g. to the success screen)
    }).catch(() => {});
  } catch {
    /* ignore */
  }
}

// Internal: fire-and-forget POST to the calendar route.
function post(payload: Record<string, unknown>): void {
  try {
    fetch("/api/calendar/event", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      keepalive: true,
    }).catch(() => {});
  } catch {
    /* ignore */
  }
}

// Flip a booking's existing calendar event title to "Paid" (matched by name + start time).
export function markCalendarPaid(payload: {
  name: string;
  date: string;      // stored yyyy-MM-dd (business tz)
  startTime: string; // stored HH:MM (business tz)
  businessId?: string;
}): void {
  post({ action: "mark-paid", ...payload });
}

// Delete a booking's calendar event (matched by name + start time).
export function deleteCalendarEvent(payload: {
  name: string;
  date: string;
  startTime: string;
  businessId?: string;
}): void {
  post({ action: "delete", ...payload });
}

// Move / retitle a booking's calendar event when the booking is edited.
// Found by the ORIGINAL name+date+time, then updated to the new date/time/title.
export function updateCalendarEvent(payload: {
  name: string;
  origDate: string;
  origStartTime: string;
  date: string;            // new Toronto date
  startTime: string;       // new Toronto HH:MM
  durationMinutes: number;
  paymentStatus?: string;  // "paid" | "unpaid"
  businessId?: string;
}): void {
  post({ action: "update", ...payload });
}
