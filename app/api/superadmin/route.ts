import { NextResponse } from "next/server";

// Super-admin operations (create businesses, owner logins, settings, services,
// suspend/activate). Uses the Supabase service-role key server-side; every
// request must carry the access token of a user listed in super_admins.

const URL_ = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SVC = process.env.SUPABASE_SERVICE_ROLE_KEY;

const svcHeaders = {
  apikey: SVC || "",
  Authorization: `Bearer ${SVC}`,
  "Content-Type": "application/json",
};

async function rest(path: string, init?: RequestInit): Promise<{ ok: boolean; status: number; data: any }> {
  const res = await fetch(`${URL_}/rest/v1/${path}`, {
    ...init,
    headers: { ...svcHeaders, Prefer: "return=representation", ...(init?.headers || {}) },
  });
  const text = await res.text();
  let data: any = null;
  try { data = text ? JSON.parse(text) : null; } catch { data = text; }
  return { ok: res.ok, status: res.status, data };
}

// Verify the bearer token belongs to a super admin; returns their user id.
async function requireSuperAdmin(req: Request): Promise<string | null> {
  const token = (req.headers.get("authorization") || "").replace(/^Bearer\s+/i, "");
  if (!token || !SVC) return null;
  const uRes = await fetch(`${URL_}/auth/v1/user`, {
    headers: { apikey: SVC, Authorization: `Bearer ${token}` },
  });
  if (!uRes.ok) return null;
  const user = await uRes.json();
  if (!user?.id) return null;
  const { data } = await rest(`super_admins?user_id=eq.${user.id}&select=user_id`);
  return Array.isArray(data) && data.length > 0 ? user.id : null;
}

export async function POST(req: Request) {
  if (!SVC) return NextResponse.json({ error: "service key not configured" }, { status: 500 });

  const admin = await requireSuperAdmin(req);
  if (!admin) return NextResponse.json({ error: "not authorized" }, { status: 403 });

  try {
    const body = await req.json();
    const { action } = body;

    // ── list all businesses with settings/services/owner ─────────────
    if (action === "list") {
      const [{ data: businesses }, { data: settings }, { data: services }, { data: owners }] = await Promise.all([
        rest("businesses?select=*&order=created_at"),
        rest("business_settings?select=*"),
        rest("services?select=*&order=key"),
        rest("business_users?select=user_id,business_id"),
      ]);
      // resolve owner emails
      const emails: Record<string, string> = {};
      for (const o of owners || []) {
        const uRes = await fetch(`${URL_}/auth/v1/admin/users/${o.user_id}`, { headers: svcHeaders });
        if (uRes.ok) emails[o.business_id] = (await uRes.json())?.email || "";
      }
      return NextResponse.json({
        businesses: (businesses || []).map((b: any) => ({
          ...b,
          settings: (settings || []).find((s: any) => s.business_id === b.id) || null,
          services: (services || []).filter((s: any) => s.business_id === b.id),
          owner_email: emails[b.id] || null,
        })),
      });
    }

    // ── create business (+ owner login + settings + default services) ─
    if (action === "create-business") {
      const { name, slug, timezone, currency, ownerEmail, ownerPassword, settings: st } = body;
      if (!name?.trim() || !slug?.trim()) return NextResponse.json({ error: "name and slug required" }, { status: 400 });
      if (!/^[a-z0-9-]{2,40}$/.test(slug)) return NextResponse.json({ error: "slug must be lowercase letters, numbers, hyphens" }, { status: 400 });
      if (!ownerEmail?.trim() || !ownerPassword || ownerPassword.length < 8) {
        return NextResponse.json({ error: "owner email + password (min 8 chars) required" }, { status: 400 });
      }

      // 1. owner auth user
      const uRes = await fetch(`${URL_}/auth/v1/admin/users`, {
        method: "POST",
        headers: svcHeaders,
        body: JSON.stringify({ email: ownerEmail.trim(), password: ownerPassword, email_confirm: true }),
      });
      const user = await uRes.json();
      if (!uRes.ok || !user?.id) {
        return NextResponse.json({ error: "auth user: " + (user?.msg || user?.message || JSON.stringify(user)) }, { status: 400 });
      }

      // 2. business
      const bRes = await rest("businesses", {
        method: "POST",
        body: JSON.stringify({
          slug: slug.trim(), name: name.trim(),
          timezone: timezone || "Asia/Kathmandu",
          currency: currency || "NPR",
          status: "active", plan: "flat",
        }),
      });
      if (!bRes.ok) return NextResponse.json({ error: "business: " + JSON.stringify(bRes.data) }, { status: 400 });
      const biz = bRes.data[0];

      // 3. owner link + settings + default services
      await rest("business_users", { method: "POST", body: JSON.stringify({ user_id: user.id, business_id: biz.id, role: "owner" }) });
      await rest("business_settings", {
        method: "POST",
        body: JSON.stringify({
          business_id: biz.id,
          esewa_id: st?.esewa_id || null,
          paypal_link: st?.paypal_link || null,
          bank_details: st?.bank_details || null,
          whatsapp_number: st?.whatsapp_number || null,
          google_calendar_id: st?.google_calendar_id || null,
          intl_usd_amount: st?.intl_usd_amount ?? 75,
          intl_npr_amount: st?.intl_npr_amount ?? 11250,
        }),
      });
      await rest("services", {
        method: "POST",
        body: JSON.stringify([
          { business_id: biz.id, key: "birth_chart", name_en: "Detailed Consultation", name_ne: "विस्तृत परामर्श", duration_minutes: 60, price: 2500 },
          { business_id: biz.id, key: "compatibility", name_en: "Guna Milan", name_ne: "गुण मिलान", duration_minutes: 60, price: 2500 },
        ]),
      });

      return NextResponse.json({ ok: true, business: biz });
    }

    // ── activate / suspend ────────────────────────────────────────────
    if (action === "set-status") {
      const { businessId, status } = body;
      if (!businessId || !["active", "suspended"].includes(status)) {
        return NextResponse.json({ error: "businessId + status required" }, { status: 400 });
      }
      const r = await rest(`businesses?id=eq.${businessId}`, { method: "PATCH", body: JSON.stringify({ status }) });
      if (!r.ok) return NextResponse.json({ error: JSON.stringify(r.data) }, { status: 400 });
      return NextResponse.json({ ok: true });
    }

    // ── update business fields (name, tz, currency, plan, valid_until) ─
    if (action === "update-business") {
      const { businessId, fields } = body;
      const allowed = ["name", "timezone", "currency", "plan", "valid_until", "logo_url"];
      const patch: Record<string, unknown> = {};
      for (const k of allowed) if (k in (fields || {})) patch[k] = fields[k] === "" ? null : fields[k];
      if (!businessId || Object.keys(patch).length === 0) return NextResponse.json({ error: "nothing to update" }, { status: 400 });
      const r = await rest(`businesses?id=eq.${businessId}`, { method: "PATCH", body: JSON.stringify(patch) });
      if (!r.ok) return NextResponse.json({ error: JSON.stringify(r.data) }, { status: 400 });
      return NextResponse.json({ ok: true });
    }

    // ── update settings ──────────────────────────────────────────────
    if (action === "update-settings") {
      const { businessId, settings: st } = body;
      if (!businessId) return NextResponse.json({ error: "businessId required" }, { status: 400 });
      const allowed = ["esewa_id", "paypal_link", "bank_details", "whatsapp_number", "wa_template", "google_calendar_id", "intl_usd_amount", "intl_npr_amount"];
      const patch: Record<string, unknown> = {};
      for (const k of allowed) if (k in (st || {})) patch[k] = st[k] === "" ? null : st[k];
      const r = await rest(`business_settings?business_id=eq.${businessId}`, { method: "PATCH", body: JSON.stringify(patch) });
      if (!r.ok) return NextResponse.json({ error: JSON.stringify(r.data) }, { status: 400 });
      // Row might not exist yet (defensive) — create it
      if (Array.isArray(r.data) && r.data.length === 0) {
        await rest("business_settings", { method: "POST", body: JSON.stringify({ business_id: businessId, ...patch }) });
      }
      return NextResponse.json({ ok: true });
    }

    // ── upsert a service ─────────────────────────────────────────────
    if (action === "upsert-service") {
      const { businessId, service } = body;
      if (!businessId || !service?.key) return NextResponse.json({ error: "businessId + service.key required" }, { status: 400 });
      const row = {
        business_id: businessId,
        key: String(service.key).toLowerCase().replace(/[^a-z0-9_]/g, "_"),
        name_en: service.name_en || service.key,
        name_ne: service.name_ne || null,
        duration_minutes: Number(service.duration_minutes) || 60,
        price: Number(service.price) || 0,
        active: service.active !== false,
      };
      const r = await rest("services?on_conflict=business_id,key", {
        method: "POST",
        headers: { Prefer: "resolution=merge-duplicates,return=representation" },
        body: JSON.stringify(row),
      });
      if (!r.ok) return NextResponse.json({ error: JSON.stringify(r.data) }, { status: 400 });
      return NextResponse.json({ ok: true });
    }

    // ── delete a service ─────────────────────────────────────────────
    if (action === "delete-service") {
      const { serviceId } = body;
      if (!serviceId) return NextResponse.json({ error: "serviceId required" }, { status: 400 });
      const r = await rest(`services?id=eq.${serviceId}`, { method: "DELETE" });
      if (!r.ok) return NextResponse.json({ error: JSON.stringify(r.data) }, { status: 400 });
      return NextResponse.json({ ok: true });
    }

    return NextResponse.json({ error: "unknown action" }, { status: 400 });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
