"use client";

import { useEffect, useRef, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useBusiness, type Service } from "@/lib/business";
import { Plus, Save, Trash2, Upload } from "lucide-react";

// Owner self-service setup: their services (product list) and payment details
// (eSewa number + QR, PayPal link, bank, WhatsApp, international amounts).

const inputCls = "w-full bg-[#0a0b1a] border border-[#1e2140] rounded-xl px-3 py-2 text-slate-200 text-sm outline-none focus:border-purple-500 transition-all";

function Field({ label, children, hint }: { label: string; children: React.ReactNode; hint?: string }) {
  return (
    <div>
      <label className="text-slate-500 text-xs mb-1 block">{label}</label>
      {children}
      {hint && <p className="text-slate-700 text-[11px] mt-1">{hint}</p>}
    </div>
  );
}

export default function SetupPage() {
  const { biz } = useBusiness();
  const [settings, setSettings] = useState<any>({});
  const [services, setServices] = useState<Service[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [newSvc, setNewSvc] = useState({ name_en: "", name_ne: "", duration_minutes: 60, price: 2500 });
  const fileRef = useRef<HTMLInputElement>(null);

  const load = async () => {
    setLoading(true);
    const [{ data: st }, { data: svcs }] = await Promise.all([
      supabase.from("business_settings").select("*").eq("business_id", biz.id).maybeSingle(),
      supabase.from("services").select("*").eq("business_id", biz.id).order("key"),
    ]);
    setSettings(st || {});
    setServices((svcs as Service[]) || []);
    setLoading(false);
  };

  useEffect(() => { load(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const run = async (fn: () => Promise<unknown>, msg?: string) => {
    setError(""); setNotice(""); setBusy(true);
    try { await fn(); await load(); if (msg) setNotice(msg); }
    catch (e: any) { setError(e.message); }
    setBusy(false);
  };

  // ── payment settings ─────────────────────────────────────────────
  const saveSettings = () => run(async () => {
    const patch = {
      esewa_id:        settings.esewa_id?.trim() || null,
      paypal_link:     settings.paypal_link?.trim() || null,
      bank_details:    settings.bank_details?.trim() || null,
      whatsapp_number: settings.whatsapp_number?.trim() || null,
      intl_usd_amount: settings.intl_usd_amount === "" || settings.intl_usd_amount == null ? null : Number(settings.intl_usd_amount),
      intl_npr_amount: settings.intl_npr_amount === "" || settings.intl_npr_amount == null ? null : Number(settings.intl_npr_amount),
    };
    const { error } = await supabase.from("business_settings").update(patch).eq("business_id", biz.id);
    if (error) throw new Error(error.message);
  }, "Payment settings saved.");

  // ── eSewa QR upload ──────────────────────────────────────────────
  const onQrFile = (file: File | undefined) => {
    if (!file) return;
    if (!file.type.startsWith("image/")) { setError("Please choose an image file"); return; }
    if (file.size > 2 * 1024 * 1024) { setError("Image must be under 2 MB"); return; }
    run(async () => {
      const path = `qr/${biz.id}`;
      const { error } = await supabase.storage.from("public-assets")
        .upload(path, file, { upsert: true, contentType: file.type });
      if (error) throw new Error(error.message);
      const url = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/public-assets/${path}?v=${Date.now()}`;
      const { error: uErr } = await supabase.from("business_settings")
        .update({ esewa_qr_url: url }).eq("business_id", biz.id);
      if (uErr) throw new Error(uErr.message);
    }, "QR code updated.");
  };

  const removeQr = () => run(async () => {
    const { error } = await supabase.from("business_settings")
      .update({ esewa_qr_url: null }).eq("business_id", biz.id);
    if (error) throw new Error(error.message);
  }, "QR removed.");

  // ── services ─────────────────────────────────────────────────────
  const saveService = (s: Service) => run(async () => {
    const { error } = await supabase.from("services").update({
      name_en: s.name_en.trim(),
      name_ne: s.name_ne?.trim() || null,
      duration_minutes: Number(s.duration_minutes) || 60,
      price: Number(s.price) || 0,
      active: s.active,
    } as never).eq("id", s.id);
    if (error) throw new Error(error.message);
  }, "Service saved.");

  const addService = () => run(async () => {
    const key = newSvc.name_en.trim().toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/(^_|_$)/g, "");
    if (!key) throw new Error("Enter a service name");
    const { error } = await supabase.from("services").insert({
      business_id: biz.id,
      key,
      name_en: newSvc.name_en.trim(),
      name_ne: newSvc.name_ne.trim() || null,
      duration_minutes: Number(newSvc.duration_minutes) || 60,
      price: Number(newSvc.price) || 0,
      active: true,
    } as never);
    if (error) throw new Error(error.code === "23505" ? "A service with a similar name already exists" : error.message);
    setNewSvc({ name_en: "", name_ne: "", duration_minutes: 60, price: 2500 });
  }, "Service added.");

  const deleteService = (s: Service) => {
    if (!confirm(`Delete "${s.name_en}"? Existing bookings keep their records.`)) return;
    run(async () => {
      const { error } = await supabase.from("services").delete().eq("id", s.id);
      if (error) throw new Error(error.message);
    }, "Service deleted.");
  };

  if (loading) return <div className="p-10 text-center text-slate-500">Loading…</div>;

  return (
    <div className="p-6 max-w-3xl mx-auto">
      <h1 className="text-2xl font-bold text-white mb-1">Setup</h1>
      <p className="text-slate-500 text-sm mb-6">Your services and payment details — shown on your booking page</p>

      {error && <p className="text-red-400 text-sm mb-4">{error}</p>}
      {notice && <p className="text-green-400 text-sm mb-4">{notice}</p>}

      {/* ── Services ── */}
      <div className="cosmic-card p-5 mb-6">
        <h2 className="text-white font-semibold mb-4">Services</h2>
        <div className="space-y-2">
          {services.map(s => <SvcRow key={s.id} svc={s} busy={busy} onSave={saveService} onDelete={() => deleteService(s)} />)}

          {/* add */}
          <div className="bg-[#0a0b1a] rounded-xl p-3">
            <p className="text-slate-600 text-[11px] mb-2">Add a new service</p>
            <div className="flex flex-wrap items-end gap-2">
              <div className="flex-1 min-w-[140px]">
                <label className="text-slate-600 text-[10px] block">Name (English)</label>
                <input className={inputCls} placeholder="e.g. Tarot Reading" value={newSvc.name_en}
                  onChange={e => setNewSvc(v => ({ ...v, name_en: e.target.value }))} />
              </div>
              <div className="flex-1 min-w-[120px]">
                <label className="text-slate-600 text-[10px] block">Name (नेपाली, optional)</label>
                <input className={inputCls} value={newSvc.name_ne}
                  onChange={e => setNewSvc(v => ({ ...v, name_ne: e.target.value }))} />
              </div>
              <div className="w-20">
                <label className="text-slate-600 text-[10px] block">Minutes</label>
                <input className={inputCls} type="number" value={newSvc.duration_minutes}
                  onChange={e => setNewSvc(v => ({ ...v, duration_minutes: parseInt(e.target.value) || 60 }))} />
              </div>
              <div className="w-24">
                <label className="text-slate-600 text-[10px] block">Price ({biz.currency})</label>
                <input className={inputCls} type="number" value={newSvc.price}
                  onChange={e => setNewSvc(v => ({ ...v, price: parseInt(e.target.value) || 0 }))} />
              </div>
              <button onClick={addService} disabled={busy || !newSvc.name_en.trim()}
                className="flex items-center gap-1 text-xs font-semibold text-amber-400 bg-amber-500/10 border border-amber-500/30 px-3 py-2 rounded-lg hover:bg-amber-500/20 transition-all disabled:opacity-40">
                <Plus size={13} /> Add
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* ── Payments ── */}
      <div className="cosmic-card p-5">
        <h2 className="text-white font-semibold mb-4">Payment Details</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-4">
          <Field label="eSewa ID / Number">
            <input className={inputCls} value={settings.esewa_id ?? ""}
              onChange={e => setSettings((p: any) => ({ ...p, esewa_id: e.target.value }))} />
          </Field>
          <Field label="PayPal Link" hint="e.g. your PayPal.me or payment link">
            <input className={inputCls} value={settings.paypal_link ?? ""}
              onChange={e => setSettings((p: any) => ({ ...p, paypal_link: e.target.value }))} />
          </Field>
          <Field label="WhatsApp Number" hint="Shown to clients in booking confirmations">
            <input className={inputCls} placeholder="+977…" value={settings.whatsapp_number ?? ""}
              onChange={e => setSettings((p: any) => ({ ...p, whatsapp_number: e.target.value }))} />
          </Field>
          <Field label="Bank Details (optional)">
            <input className={inputCls} value={settings.bank_details ?? ""}
              onChange={e => setSettings((p: any) => ({ ...p, bank_details: e.target.value }))} />
          </Field>
          <Field label="International price (USD)" hint="PayPal amount for clients outside Nepal">
            <input className={inputCls} type="number" value={settings.intl_usd_amount ?? ""}
              onChange={e => setSettings((p: any) => ({ ...p, intl_usd_amount: e.target.value }))} />
          </Field>
          <Field label="International price (NPR)" hint="eSewa amount for clients outside Nepal">
            <input className={inputCls} type="number" value={settings.intl_npr_amount ?? ""}
              onChange={e => setSettings((p: any) => ({ ...p, intl_npr_amount: e.target.value }))} />
          </Field>
        </div>

        {/* QR upload */}
        <div className="mb-4">
          <p className="text-slate-500 text-xs mb-2">eSewa QR Code</p>
          <div className="flex items-center gap-4">
            {settings.esewa_qr_url ? (
              <div className="bg-white rounded-xl p-2">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={settings.esewa_qr_url} alt="eSewa QR" width={110} height={110} className="rounded-lg" />
              </div>
            ) : (
              <div className="w-[110px] h-[110px] rounded-xl border border-dashed border-[#2e3160] flex items-center justify-center text-slate-700 text-xs text-center px-2">
                No QR uploaded
              </div>
            )}
            <div className="space-y-2">
              <input ref={fileRef} type="file" accept="image/*" className="hidden"
                onChange={e => onQrFile(e.target.files?.[0])} />
              <button onClick={() => fileRef.current?.click()} disabled={busy}
                className="flex items-center gap-1.5 text-xs font-semibold text-purple-300 bg-purple-500/10 border border-purple-500/30 px-3 py-1.5 rounded-lg hover:bg-purple-500/20 transition-all">
                <Upload size={13} /> {settings.esewa_qr_url ? "Replace QR" : "Upload QR"}
              </button>
              {settings.esewa_qr_url && (
                <button onClick={removeQr} disabled={busy}
                  className="flex items-center gap-1.5 text-xs font-semibold text-red-400 bg-red-500/10 border border-red-500/30 px-3 py-1.5 rounded-lg hover:bg-red-500/20 transition-all">
                  <Trash2 size={13} /> Remove
                </button>
              )}
            </div>
          </div>
        </div>

        <button onClick={saveSettings} disabled={busy} className="btn-gold px-6">
          {busy ? "Saving…" : "Save Payment Details"}
        </button>
      </div>
    </div>
  );
}

function SvcRow({ svc, busy, onSave, onDelete }: {
  svc: Service; busy: boolean;
  onSave: (s: Service) => void; onDelete: () => void;
}) {
  const [s, setS] = useState(svc);
  useEffect(() => { setS(svc); }, [svc]);
  return (
    <div className="flex flex-wrap items-center gap-2 bg-[#0a0b1a] rounded-xl p-3">
      <input className={`${inputCls} flex-1 min-w-[130px]`} value={s.name_en}
        onChange={e => setS(v => ({ ...v, name_en: e.target.value }))} />
      <input className={`${inputCls} flex-1 min-w-[110px]`} placeholder="नेपाली नाम" value={s.name_ne ?? ""}
        onChange={e => setS(v => ({ ...v, name_ne: e.target.value }))} />
      <input className={`${inputCls} w-20`} type="number" title="minutes" value={s.duration_minutes}
        onChange={e => setS(v => ({ ...v, duration_minutes: parseInt(e.target.value) || 60 }))} />
      <input className={`${inputCls} w-24`} type="number" title="price" value={s.price}
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
