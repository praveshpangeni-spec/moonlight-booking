"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { Plus, ChevronDown, ChevronUp, Save, Trash2, Power, ExternalLink } from "lucide-react";

// Super-admin panel: create businesses, manage settings/services, suspend/activate.
// Only users in super_admins can see or use it (enforced server-side too).

interface Svc { id: string; key: string; name_en: string; name_ne: string | null; duration_minutes: number; price: number; active: boolean; }
interface Biz {
  id: string; slug: string; name: string; timezone: string; currency: string;
  status: string; plan: string; valid_until: string | null;
  owner_email: string | null;
  settings: any; services: Svc[];
}

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
  ownerEmail: "", ownerPassword: "",
  whatsapp_number: "", esewa_id: "", paypal_link: "", google_calendar_id: "",
};

export default function SuperAdminPage() {
  const [allowed, setAllowed] = useState<boolean | null>(null);
  const [businesses, setBusinesses] = useState<Biz[]>([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState({ ...DEFAULT_NEW });

  // Per-business edit buffers
  const [settingsBuf, setSettingsBuf] = useState<Record<string, any>>({});
  const [newSvc, setNewSvc] = useState({ key: "", name_en: "", duration_minutes: 60, price: 2500 });

  const call = async (action: string, payload: Record<string, unknown> = {}) => {
    const { data: { session } } = await supabase.auth.getSession();
    const res = await fetch("/api/superadmin", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${session?.access_token}` },
      body: JSON.stringify({ action, ...payload }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data?.error || "request failed");
    return data;
  };

  const load = async () => {
    setLoading(true);
    try {
      const data = await call("list");
      setBusinesses(data.businesses || []);
    } catch (e: any) { setError(e.message); }
    setLoading(false);
  };

  useEffect(() => {
    supabase.rpc("is_super_admin").then(({ data }) => {
      setAllowed(!!data);
      if (data) load();
    });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const run = async (fn: () => Promise<unknown>) => {
    setError(""); setBusy(true);
    try { await fn(); await load(); }
    catch (e: any) { setError(e.message); }
    setBusy(false);
  };

  const createBusiness = () => run(async () => {
    await call("create-business", {
      name: form.name, slug: form.slug, timezone: form.timezone, currency: form.currency,
      ownerEmail: form.ownerEmail, ownerPassword: form.ownerPassword,
      settings: {
        whatsapp_number: form.whatsapp_number || null,
        esewa_id: form.esewa_id || null,
        paypal_link: form.paypal_link || null,
        google_calendar_id: form.google_calendar_id || null,
      },
    });
    setForm({ ...DEFAULT_NEW });
    setShowAdd(false);
  });

  const toggleStatus = (b: Biz) => {
    const to = b.status === "active" ? "suspended" : "active";
    if (!confirm(`${to === "suspended" ? "Suspend" : "Activate"} ${b.name}? ${to === "suspended" ? "Their public page AND admin go offline." : ""}`)) return;
    run(() => call("set-status", { businessId: b.id, status: to }));
  };

  const saveSettings = (b: Biz) => run(() => call("update-settings", { businessId: b.id, settings: settingsBuf[b.id] || {} }));

  const saveService = (b: Biz, s: Svc) => run(() => call("upsert-service", { businessId: b.id, service: s }));
  const addService = (b: Biz) => run(async () => {
    await call("upsert-service", { businessId: b.id, service: newSvc });
    setNewSvc({ key: "", name_en: "", duration_minutes: 60, price: 2500 });
  });
  const removeService = (b: Biz, s: Svc) => {
    if (!confirm(`Delete service "${s.name_en}"?`)) return;
    run(() => call("delete-service", { serviceId: s.id }));
  };

  if (allowed === null) return <div className="p-10 text-center text-slate-500">Checking access…</div>;
  if (!allowed) return (
    <div className="p-10 text-center">
      <p className="text-red-400">Not authorized.</p>
      <p className="text-slate-600 text-sm mt-1">This page is for the platform owner only.</p>
    </div>
  );

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-white">Businesses</h1>
          <p className="text-slate-500 text-sm">Platform super-admin</p>
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

      {/* ── Add business form ── */}
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
            <Field label="WhatsApp Number">
              <input className={inputCls} placeholder="+977…" value={form.whatsapp_number}
                onChange={e => setForm(f => ({ ...f, whatsapp_number: e.target.value }))} />
            </Field>
            <Field label="eSewa ID">
              <input className={inputCls} value={form.esewa_id}
                onChange={e => setForm(f => ({ ...f, esewa_id: e.target.value }))} />
            </Field>
            <Field label="PayPal Link">
              <input className={inputCls} value={form.paypal_link}
                onChange={e => setForm(f => ({ ...f, paypal_link: e.target.value }))} />
            </Field>
            <Field label="Google Calendar ID (shared with service account)">
              <input className={inputCls} placeholder="their-gmail@gmail.com" value={form.google_calendar_id}
                onChange={e => setForm(f => ({ ...f, google_calendar_id: e.target.value }))} />
            </Field>
          </div>
          <p className="text-slate-600 text-xs mb-3">
            Creates the owner login, business, settings and two default services (editable after).
            Ask the owner to share their Google Calendar with the service account for calendar sync.
          </p>
          <button onClick={createBusiness} disabled={busy} className="btn-gold px-6">
            {busy ? "Creating…" : "Create Business"}
          </button>
        </div>
      )}

      {/* ── Business list ── */}
      {loading ? (
        <div className="text-center text-slate-500 py-10">Loading…</div>
      ) : (
        <div className="space-y-3">
          {businesses.map(b => {
            const isOpen = expanded === b.id;
            const st = settingsBuf[b.id] ?? b.settings ?? {};
            return (
              <div key={b.id} className="cosmic-card overflow-hidden">
                <button className="w-full p-4 text-left flex items-center gap-3 hover:bg-white/2 transition-all"
                  onClick={() => { setExpanded(isOpen ? null : b.id); setSettingsBuf(p => ({ ...p, [b.id]: { ...(b.settings || {}) } })); }}>
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
                    {/* actions */}
                    <div className="flex flex-wrap gap-2">
                      <a href={`/b/${b.slug}`} target="_blank"
                        className="flex items-center gap-1.5 text-xs font-semibold text-purple-300 bg-purple-500/10 border border-purple-500/30 px-3 py-1.5 rounded-lg hover:bg-purple-500/20 transition-all">
                        <ExternalLink size={13} /> Booking Page
                      </a>
                      <button onClick={() => toggleStatus(b)}
                        className={`flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg border transition-all ${
                          b.status === "active"
                            ? "text-red-400 bg-red-500/10 border-red-500/30 hover:bg-red-500/20"
                            : "text-green-400 bg-green-500/10 border-green-500/30 hover:bg-green-500/20"
                        }`}>
                        <Power size={13} /> {b.status === "active" ? "Suspend" : "Activate"}
                      </button>
                    </div>

                    {/* settings */}
                    <div>
                      <p className="text-slate-500 text-xs font-bold uppercase tracking-wider mb-2">Settings</p>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        {[
                          ["whatsapp_number", "WhatsApp Number"],
                          ["esewa_id", "eSewa ID"],
                          ["paypal_link", "PayPal Link"],
                          ["google_calendar_id", "Google Calendar ID"],
                          ["intl_usd_amount", "Intl USD Amount"],
                          ["intl_npr_amount", "Intl NPR Amount"],
                        ].map(([k, label]) => (
                          <Field key={k} label={label}>
                            <input className={inputCls} value={st[k] ?? ""}
                              onChange={e => setSettingsBuf(p => ({ ...p, [b.id]: { ...st, [k]: e.target.value } }))} />
                          </Field>
                        ))}
                      </div>
                      <button onClick={() => saveSettings(b)} disabled={busy}
                        className="mt-3 flex items-center gap-1.5 text-xs font-semibold text-purple-300 bg-purple-500/10 border border-purple-500/30 px-3 py-1.5 rounded-lg hover:bg-purple-500/20 transition-all">
                        <Save size={13} /> Save Settings
                      </button>
                    </div>

                    {/* services */}
                    <div>
                      <p className="text-slate-500 text-xs font-bold uppercase tracking-wider mb-2">Services</p>
                      <div className="space-y-2">
                        {b.services.map(s => (
                          <ServiceRow key={s.id} svc={s} busy={busy}
                            onSave={(updated) => saveService(b, updated)}
                            onDelete={() => removeService(b, s)} />
                        ))}
                        {/* add service */}
                        <div className="flex flex-wrap items-end gap-2 bg-[#0a0b1a] rounded-xl p-3">
                          <div className="flex-1 min-w-[100px]">
                            <label className="text-slate-600 text-[10px] block">key</label>
                            <input className={inputCls} placeholder="e.g. tarot" value={newSvc.key}
                              onChange={e => setNewSvc(v => ({ ...v, key: e.target.value }))} />
                          </div>
                          <div className="flex-1 min-w-[140px]">
                            <label className="text-slate-600 text-[10px] block">name</label>
                            <input className={inputCls} placeholder="Service name" value={newSvc.name_en}
                              onChange={e => setNewSvc(v => ({ ...v, name_en: e.target.value }))} />
                          </div>
                          <div className="w-20">
                            <label className="text-slate-600 text-[10px] block">min</label>
                            <input className={inputCls} type="number" value={newSvc.duration_minutes}
                              onChange={e => setNewSvc(v => ({ ...v, duration_minutes: parseInt(e.target.value) || 60 }))} />
                          </div>
                          <div className="w-24">
                            <label className="text-slate-600 text-[10px] block">price</label>
                            <input className={inputCls} type="number" value={newSvc.price}
                              onChange={e => setNewSvc(v => ({ ...v, price: parseInt(e.target.value) || 0 }))} />
                          </div>
                          <button onClick={() => addService(b)} disabled={busy || !newSvc.key || !newSvc.name_en}
                            className="text-xs font-semibold text-amber-400 bg-amber-500/10 border border-amber-500/30 px-3 py-2 rounded-lg hover:bg-amber-500/20 transition-all disabled:opacity-40">
                            <Plus size={13} />
                          </button>
                        </div>
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

function ServiceRow({ svc, busy, onSave, onDelete }: {
  svc: Svc; busy: boolean;
  onSave: (s: Svc) => void; onDelete: () => void;
}) {
  const [s, setS] = useState(svc);
  return (
    <div className="flex flex-wrap items-center gap-2 bg-[#0a0b1a] rounded-xl p-3">
      <span className="text-slate-600 text-xs w-24 truncate shrink-0">{s.key}</span>
      <input className={`${inputCls} flex-1 min-w-[140px]`} value={s.name_en}
        onChange={e => setS(v => ({ ...v, name_en: e.target.value }))} />
      <input className={`${inputCls} w-20`} type="number" value={s.duration_minutes}
        onChange={e => setS(v => ({ ...v, duration_minutes: parseInt(e.target.value) || 60 }))} />
      <input className={`${inputCls} w-24`} type="number" value={s.price}
        onChange={e => setS(v => ({ ...v, price: parseInt(e.target.value) || 0 }))} />
      <label className="flex items-center gap-1 text-xs text-slate-400">
        <input type="checkbox" checked={s.active}
          onChange={e => setS(v => ({ ...v, active: e.target.checked }))} />
        active
      </label>
      <button onClick={() => onSave(s)} disabled={busy}
        className="p-1.5 rounded-lg text-purple-400 hover:bg-purple-500/10 transition-all" title="Save">
        <Save size={14} />
      </button>
      <button onClick={onDelete} disabled={busy}
        className="p-1.5 rounded-lg text-red-400 hover:bg-red-500/10 transition-all" title="Delete">
        <Trash2 size={14} />
      </button>
    </div>
  );
}
