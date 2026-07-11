"use client";

import { useEffect, useState } from "react";
import { superCall, type SuperBiz } from "@/lib/super";
import { Plus, ChevronDown, ChevronUp, Save, Power, ExternalLink, KeyRound, Link2, MessageCircle, ClipboardCopy } from "lucide-react";

// Create businesses + owner logins, share their links, manage status.
// Services and payment details are managed by each owner in their own
// admin (Setup tab) — not here.

const TZS = [
  { value: "Asia/Kathmandu", label: "Nepal (NPT)" },
  { value: "America/Toronto", label: "Toronto (ET)" },
  { value: "America/Denver", label: "Denver (MT)" },
];

const inputCls = "w-full bg-[#0a0b1a] border border-[#1e2140] rounded-xl px-3 py-2 text-slate-200 text-sm outline-none focus:border-purple-500 transition-all";

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="text-slate-500 text-xs mb-1 block">{label}</label>
      {children}
    </div>
  );
}

const DEFAULT_NEW = {
  name: "", slug: "", timezone: "Asia/Kathmandu", currency: "NPR",
  ownerEmail: "", ownerPassword: "", google_calendar_id: "",
};

function welcomeMessage(b: SuperBiz): string {
  const origin = window.location.origin;
  return `🪐 ${b.name} — Astro Booking

Your customer booking page (share this with clients):
${origin}/b/${b.slug}

Your admin panel:
${origin}/admin/login
Login: ${b.owner_email}

From the admin you can manage bookings, availability, and — in the Setup tab — your services, prices, eSewa number & QR, and PayPal link.`;
}

export default function SuperBusinessesPage() {
  const [businesses, setBusinesses] = useState<SuperBiz[]>([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState({ ...DEFAULT_NEW });
  const [calBuf, setCalBuf] = useState<Record<string, string>>({});

  const load = async () => {
    setLoading(true);
    try { setBusinesses((await superCall("list")).businesses || []); }
    catch (e: any) { setError(e.message); }
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const run = async (fn: () => Promise<unknown>, msg?: string) => {
    setError(""); setNotice(""); setBusy(true);
    try { await fn(); await load(); if (msg) setNotice(msg); }
    catch (e: any) { setError(e.message); }
    setBusy(false);
  };

  const createBusiness = () => run(async () => {
    await superCall("create-business", {
      name: form.name, slug: form.slug, timezone: form.timezone, currency: form.currency,
      ownerEmail: form.ownerEmail, ownerPassword: form.ownerPassword,
      settings: { google_calendar_id: form.google_calendar_id || null },
    });
    setForm({ ...DEFAULT_NEW });
    setShowAdd(false);
  }, "Business created. Use Share to send them their links.");

  const toggleStatus = (b: SuperBiz) => {
    const to = b.status === "active" ? "suspended" : "active";
    if (!confirm(`${to === "suspended" ? "Suspend" : "Activate"} ${b.name}?${to === "suspended" ? " Their public page AND admin go offline." : ""}`)) return;
    run(() => superCall("set-status", { businessId: b.id, status: to }));
  };

  const resetPassword = (b: SuperBiz) => {
    const pw = prompt(`New password for ${b.owner_email} (min 8 chars):`);
    if (!pw) return;
    if (pw.length < 8) { setError("Password must be at least 8 characters"); return; }
    run(async () => {
      await superCall("reset-owner-password", { businessId: b.id, newPassword: pw });
    }, `Password updated for ${b.owner_email}.`);
  };

  const saveCalendar = (b: SuperBiz) => run(
    () => superCall("update-settings", { businessId: b.id, settings: { google_calendar_id: calBuf[b.id] ?? "" } }),
    "Calendar ID saved.",
  );

  // ── sharing ────────────────────────────────────────────────────────
  const copy = async (text: string, what: string) => {
    setError(""); setNotice("");
    try { await navigator.clipboard.writeText(text); setNotice(`${what} copied to clipboard.`); }
    catch { setError("Could not copy — long-press to copy manually."); }
  };

  const shareWhatsApp = (b: SuperBiz) => {
    window.open(`https://wa.me/?text=${encodeURIComponent(welcomeMessage(b))}`, "_blank");
  };

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-white">Businesses</h1>
          <p className="text-slate-500 text-sm">Owners manage their own services & payments in their admin&apos;s Setup tab</p>
        </div>
        <button
          onClick={() => setShowAdd(p => !p)}
          className={`flex items-center gap-2 text-sm font-semibold px-4 py-2 rounded-xl border transition-all ${
            showAdd ? "border-purple-500 bg-purple-500/10 text-purple-300" : "border-[#1e2140] text-slate-300 hover:border-purple-500/40"
          }`}
        >
          <Plus size={15} /> Add Business
        </button>
      </div>

      {error && <p className="text-red-400 text-sm mb-4">{error}</p>}
      {notice && <p className="text-green-400 text-sm mb-4">{notice}</p>}

      {/* ── Add business ── */}
      {showAdd && (
        <div className="cosmic-card p-5 mb-6">
          <h2 className="text-white font-semibold mb-4">New Business</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-3">
            <Field label="Business Name *">
              <input className={inputCls} value={form.name}
                onChange={e => setForm(f => ({ ...f, name: e.target.value, slug: f.slug || e.target.value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "") }))} />
            </Field>
            <Field label="Slug * (URL: /b/slug)">
              <input className={inputCls} value={form.slug}
                onChange={e => setForm(f => ({ ...f, slug: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, "") }))} />
            </Field>
            <Field label="Time Zone">
              <select className={inputCls} style={{ colorScheme: "dark" }} value={form.timezone}
                onChange={e => setForm(f => ({ ...f, timezone: e.target.value }))}>
                {TZS.map(z => <option key={z.value} value={z.value}>{z.label}</option>)}
              </select>
            </Field>
            <Field label="Currency">
              <select className={inputCls} style={{ colorScheme: "dark" }} value={form.currency}
                onChange={e => setForm(f => ({ ...f, currency: e.target.value }))}>
                <option value="NPR">NPR</option><option value="USD">USD</option><option value="CAD">CAD</option>
              </select>
            </Field>
            <Field label="Owner Login Email *">
              <input className={inputCls} type="email" value={form.ownerEmail}
                onChange={e => setForm(f => ({ ...f, ownerEmail: e.target.value }))} />
            </Field>
            <Field label="Owner Password * (min 8)">
              <input className={inputCls} type="text" value={form.ownerPassword}
                onChange={e => setForm(f => ({ ...f, ownerPassword: e.target.value }))} />
            </Field>
            <Field label="Google Calendar ID (optional)">
              <input className={inputCls} placeholder="their-gmail@gmail.com" value={form.google_calendar_id}
                onChange={e => setForm(f => ({ ...f, google_calendar_id: e.target.value }))} />
            </Field>
          </div>
          <p className="text-slate-600 text-xs mb-3">
            Creates the owner login + two starter services. The owner sets their own
            services, prices, eSewa/PayPal and QR in their admin&apos;s Setup tab.
          </p>
          <button onClick={createBusiness} disabled={busy} className="btn-gold px-6">
            {busy ? "Creating…" : "Create Business"}
          </button>
        </div>
      )}

      {/* ── List ── */}
      {loading ? (
        <div className="text-center text-slate-500 py-10">Loading…</div>
      ) : (
        <div className="space-y-3">
          {businesses.map(b => {
            const isOpen = expanded === b.id;
            return (
              <div key={b.id} className="cosmic-card overflow-hidden">
                <button className="w-full p-4 text-left flex items-center gap-3 hover:bg-white/2 transition-all"
                  onClick={() => { setExpanded(isOpen ? null : b.id); setCalBuf(p => ({ ...p, [b.id]: b.settings?.google_calendar_id || "" })); }}>
                  <div className="flex-1 min-w-0">
                    <p className="text-white font-semibold">{b.name}</p>
                    <p className="text-slate-500 text-xs">/b/{b.slug} · {b.timezone} · {b.owner_email || "no owner"}</p>
                  </div>
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium shrink-0 ${
                    b.status === "active" ? "bg-green-500/20 text-green-400" : "bg-red-500/20 text-red-400"
                  }`}>{b.status}</span>
                  {isOpen ? <ChevronUp size={16} className="text-slate-500 shrink-0" /> : <ChevronDown size={16} className="text-slate-500 shrink-0" />}
                </button>

                {isOpen && (
                  <div className="px-4 pb-4 border-t border-[#1e2140] pt-3 space-y-4">
                    {/* ── Share with the owner ── */}
                    <div>
                      <p className="text-slate-500 text-xs font-bold uppercase tracking-wider mb-2">Share</p>
                      <div className="flex flex-wrap gap-2">
                        <button onClick={() => shareWhatsApp(b)}
                          className="flex items-center gap-1.5 text-xs font-semibold text-[#22c55e] bg-green-500/10 border border-green-500/30 px-3 py-1.5 rounded-lg hover:bg-green-500/20 transition-all">
                          <MessageCircle size={13} /> Share via WhatsApp
                        </button>
                        <button onClick={() => copy(welcomeMessage(b), "Welcome message")}
                          className="flex items-center gap-1.5 text-xs font-semibold text-purple-300 bg-purple-500/10 border border-purple-500/30 px-3 py-1.5 rounded-lg hover:bg-purple-500/20 transition-all">
                          <ClipboardCopy size={13} /> Copy Welcome Message
                        </button>
                        <button onClick={() => copy(`${window.location.origin}/b/${b.slug}`, "Booking link")}
                          className="flex items-center gap-1.5 text-xs font-semibold text-amber-400 bg-amber-500/10 border border-amber-500/30 px-3 py-1.5 rounded-lg hover:bg-amber-500/20 transition-all">
                          <Link2 size={13} /> Copy Booking Link
                        </button>
                        <button onClick={() => copy(`${window.location.origin}/admin/login`, "Admin link")}
                          className="flex items-center gap-1.5 text-xs font-semibold text-slate-300 bg-white/5 border border-[#1e2140] px-3 py-1.5 rounded-lg hover:bg-white/10 transition-all">
                          <Link2 size={13} /> Copy Admin Link
                        </button>
                        <a href={`/b/${b.slug}`} target="_blank"
                          className="flex items-center gap-1.5 text-xs font-semibold text-slate-300 bg-white/5 border border-[#1e2140] px-3 py-1.5 rounded-lg hover:bg-white/10 transition-all">
                          <ExternalLink size={13} /> Open Booking Page
                        </a>
                      </div>
                    </div>

                    {/* ── Manage ── */}
                    <div>
                      <p className="text-slate-500 text-xs font-bold uppercase tracking-wider mb-2">Manage</p>
                      <div className="flex flex-wrap gap-2 mb-3">
                        <button onClick={() => resetPassword(b)}
                          className="flex items-center gap-1.5 text-xs font-semibold text-amber-400 bg-amber-500/10 border border-amber-500/30 px-3 py-1.5 rounded-lg hover:bg-amber-500/20 transition-all">
                          <KeyRound size={13} /> Reset Owner Password
                        </button>
                        <button onClick={() => toggleStatus(b)}
                          className={`flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg border transition-all ${
                            b.status === "active"
                              ? "text-red-400 bg-red-500/10 border-red-500/30 hover:bg-red-500/20"
                              : "text-green-400 bg-green-500/10 border-green-500/30 hover:bg-green-500/20"
                          }`}>
                          <Power size={13} /> {b.status === "active" ? "Suspend" : "Activate"}
                        </button>
                      </div>
                      <div className="flex items-end gap-2">
                        <div className="flex-1">
                          <Field label="Google Calendar ID (shared with the platform service account)">
                            <input className={inputCls} placeholder="their-gmail@gmail.com" value={calBuf[b.id] ?? ""}
                              onChange={e => setCalBuf(p => ({ ...p, [b.id]: e.target.value }))} />
                          </Field>
                        </div>
                        <button onClick={() => saveCalendar(b)} disabled={busy}
                          className="flex items-center gap-1.5 text-xs font-semibold text-purple-300 bg-purple-500/10 border border-purple-500/30 px-3 py-2 rounded-lg hover:bg-purple-500/20 transition-all">
                          <Save size={13} /> Save
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
