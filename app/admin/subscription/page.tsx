"use client";

import { useBusiness } from "@/lib/business";
import { BadgeCheck, CalendarClock, AlertTriangle } from "lucide-react";

// Read-only subscription view for the business owner.
export default function SubscriptionPage() {
  const { biz } = useBusiness();

  const today = new Date().toISOString().slice(0, 10);
  const daysLeft = biz.valid_until
    ? Math.ceil((new Date(biz.valid_until + "T12:00:00").getTime() - new Date(today + "T12:00:00").getTime()) / 86400000)
    : null;

  const state =
    biz.status !== "active" ? "suspended" :
    daysLeft === null ? "active" :
    daysLeft < 0 ? "overdue" :
    daysLeft <= 14 ? "renewing" : "active";

  return (
    <div className="p-6 max-w-lg mx-auto">
      <h1 className="text-2xl font-bold text-white mb-1">Subscription</h1>
      <p className="text-slate-500 text-sm mb-6">{biz.name}</p>

      <div className={`cosmic-card p-6 border-l-2 ${
        state === "active" ? "border-l-green-500" :
        state === "renewing" ? "border-l-amber-500" : "border-l-red-500"
      }`}>
        <div className="flex items-center gap-3 mb-5">
          {state === "active"
            ? <BadgeCheck size={22} className="text-green-400" />
            : state === "renewing"
              ? <CalendarClock size={22} className="text-amber-400" />
              : <AlertTriangle size={22} className="text-red-400" />}
          <div>
            <p className="text-white font-semibold capitalize">
              {state === "renewing" ? "Renewal due soon" : state === "overdue" ? "Payment overdue" : state}
            </p>
            <p className="text-slate-500 text-xs">Plan: {biz.plan || "flat"}</p>
          </div>
        </div>

        <div className="space-y-2 text-sm">
          <div className="flex justify-between">
            <span className="text-slate-500">Status</span>
            <span className={state === "active" ? "text-green-400" : state === "renewing" ? "text-amber-400" : "text-red-400"}>
              {biz.status}
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-500">Valid until</span>
            <span className="text-slate-200">{biz.valid_until || "—"}</span>
          </div>
          {daysLeft !== null && daysLeft >= 0 && (
            <div className="flex justify-between">
              <span className="text-slate-500">Days remaining</span>
              <span className="text-slate-200">{daysLeft}</span>
            </div>
          )}
        </div>
      </div>

      <p className="text-slate-600 text-xs mt-4">
        To renew or for any billing questions, please contact the platform administrator.
      </p>
    </div>
  );
}
