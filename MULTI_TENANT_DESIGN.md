# Multi-Tenant Transition — Design Doc

**Status:** Draft v1 (for review — no code changes yet)
**App:** `moonlight-booking` (Next.js 16 + Supabase + Vercel)
**Author:** Claude + Pravesh

---

## 1. Goal

Turn the current **single-business** astrology booking app into a **multi-business**
platform where several astrologers each run their own bookings, availability,
clients, payments, and calendar — fully isolated from one another — on one shared
codebase and database.

---

## 2. Current state (single-tenant)

Everything today assumes exactly one business ("Moonlight"):

- **DB (Supabase project `jgyonbhwcxssjybhegrr`):** tables `clients`, `availability`,
  `bookings`. No notion of "which business".
- **Auth:** one shared admin login.
- **Hardcoded per-business values** scattered in code:
  - eSewa number, PayPal link — `components/steps/PaymentStep.tsx`
  - WhatsApp number + Nepali message template — `lib/whatsapp.ts`
  - Service names / prices / durations — `lib/database.types.ts` (`SERVICE_LABELS`)
  - Google Calendar — one service account, one calendar (`app/api/calendar/event`)
  - **Time zone** — stored in `America/Toronto` throughout (`lib/timezone.ts`)
- **Public booking page:** served at `/`.
- **Admin:** `/admin/*`, installed as an iOS PWA.

---

## 3. Decisions (agreed)

| Question | Decision |
|---|---|
| Onboarding | **Manual** — Pravesh creates each business (no public signup) |
| Public booking URL | **Path-based** — `/b/[slug]` |
| Time zones | **All same per business** (e.g. all Nepal); no cross-tz logic |
| Billing | **Subscription** — start manual, automate (Stripe) later |

---

## 4. Target architecture

### 4.1 Data model

```
businesses
  id, slug (unique), name, timezone (default 'Asia/Kathmandu'),
  currency (default 'NPR'), logo_url,
  status ('active' | 'suspended'), plan, valid_until, created_at

business_users
  user_id (Supabase auth uid) → business_id     -- who owns/manages what

business_settings
  business_id, esewa_id, paypal_link, bank_details,
  whatsapp_number, wa_template, google_calendar_id

services
  business_id, key, name_en, name_ne, duration_minutes, price, active

clients       + business_id
availability  + business_id
bookings      + business_id
```

- Each business is internally consistent in **one time zone** (stored on `businesses`).
  Moonlight = `America/Toronto`; new Nepal businesses = `Asia/Kathmandu`.
  No cross-tenant timezone math needed.

### 4.2 Isolation (RLS)

Row-Level Security on every tenant table:

- **Admin/owner:** can only read/write rows where
  `business_id = (the business linked to their auth uid via business_users)`.
- **Public (anon):** may read a business's `services` + `availability` and insert
  `clients`/`bookings` **for a specific `business_id`** (resolved from the `/b/[slug]`
  page), nothing else.

### 4.3 Routing

- `/b/[slug]` — public booking page for one business (loads that business's
  services, availability, payment + WhatsApp settings by slug).
- `/` — keep working for **Moonlight** (redirect to `/b/moonlight`) so existing
  links / QR codes don't break. Optionally becomes a simple landing page later.
- `/admin/*` — unchanged surface; every query becomes tenant-scoped to the
  logged-in owner's business. Each owner installs their own PWA and logs in with
  their own account.

### 4.4 Per-business configuration

Move all hardcoded constants into `business_settings` / `services`:

- Payments go to **each business's own** eSewa / PayPal / bank — not a shared account.
- WhatsApp number + message template per business.
- Services, prices, durations per business.
- Branding (name, logo) per business.

### 4.5 Google Calendar (per business)

Reuse the existing service-account integration with **no new OAuth work**:

- Each business shares their Google Calendar with the existing service account
  (`moonlight-booking@moonlight-501614.iam.gserviceaccount.com`) with
  "Make changes to events".
- Store their `calendar_id` in `business_settings`.
- The calendar API route picks the calendar by the booking's `business_id`.
- (Optional future: per-business Google OAuth so owners connect their own account.)

### 4.6 Billing (manual first)

- `businesses.status` / `plan` / `valid_until` control access.
- You mark a business `active` when they pay; `suspended` blocks their admin
  (and optionally their public page).
- Automated **Stripe** subscription + self-serve checkout added later without rework.

---

## 5. Migration plan (phased)

**Phase 1 — Tenant foundation (highest care; app is live)**
- Add `businesses`, `business_users`, and `business_id` to the 3 tables.
- **Backfill** all existing rows into a single "Moonlight" business
  (tz = `America/Toronto`).
- Link the current admin user to Moonlight in `business_users`.
- Enable RLS + policies; verify the live booking + admin flows still work.

**Phase 2 — Tenant-scope the admin & config**
- Every admin query filters by `business_id`.
- Move eSewa/PayPal/WhatsApp/template/services/calendar into
  `business_settings`/`services`.

**Phase 3 — Public booking per business**
- `/b/[slug]` route; keep `/` → Moonlight.

**Phase 4 — Super-admin**
- A page (only for you) to create businesses and toggle subscription status.

**Phase 5 — Automated billing (Stripe)** — later.

---

## 6. Risks & mitigations

- **Live app taking real bookings.** Do everything on a branch; take a Supabase
  backup before the Phase 1 migration; test the full public + admin flow before
  switching over.
- **RLS mistakes** could either leak data across businesses or break the anon
  booking insert. Write explicit policies + test as anon and as each owner.
- **Backfill correctness** — every existing client/availability/booking must land
  under Moonlight with the right `business_id` before RLS is enforced.
- **Existing shared links** to `/` — preserve via redirect.
- **Supabase tier** — real multi-business use needs a paid Supabase plan
  (current setup uses a free-tier account with a 2-project cap and 7-day pause).

---

## 7. Out of scope (for now)

- Self-serve signup / onboarding UI (onboarding is manual).
- Per-business subdomains or custom domains (path-based only).
- Cross-timezone scheduling logic (each business is single-timezone).
- Automated Stripe billing (manual activation first).

---

## 8. Resolved questions (2026-07-07)

1. Moonlight stays on Toronto time; new businesses default to Nepal. ✔
2. Suspension takes **both** the public booking page **and** the admin offline. ✔
3. Billing = **flat fee** (single plan). ✔
4. **One owner login per business.** ✔

## 9. Implementation log

- **Phase 1 started 2026-07-07.** Safety approach: all DB changes are additive;
  `business_id` columns get `DEFAULT <moonlight id>` so the live app's inserts
  keep working untouched and are auto-tagged. Existing RLS policies unchanged;
  tenant-scoped policies land at switchover. Code work on branch `multi-tenant`.
