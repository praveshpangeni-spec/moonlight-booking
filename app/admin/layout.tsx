"use client";

import { useEffect, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import {
  LayoutDashboard, Calendar, Clock, Users, Wallet, LogOut, Menu, X,
} from "lucide-react";

const NAV = [
  { href: "/admin", label: "Dashboard", icon: LayoutDashboard },
  { href: "/admin/bookings", label: "Bookings", icon: Calendar },
  { href: "/admin/availability", label: "Availability", icon: Clock },
  { href: "/admin/clients", label: "Clients", icon: Users },
  { href: "/admin/payments", label: "Payments", icon: Wallet },
];

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [checking, setChecking] = useState(true);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session && pathname !== "/admin/login") router.push("/admin/login");
      setChecking(false);
    });
  }, []);

  if (pathname === "/admin/login") return <>{children}</>;
  if (checking) return (
    <div className="min-h-screen bg-cosmic-gradient flex items-center justify-center">
      <div className="text-4xl animate-spin">🌙</div>
    </div>
  );

  const signOut = async () => {
    await supabase.auth.signOut();
    router.push("/admin/login");
  };

  return (
    <div className="min-h-screen bg-[#05060f] flex">
      {/* Sidebar — desktop */}
      <aside className="hidden md:flex flex-col w-56 border-r border-[#1e2140] bg-[#0d0f1f] shrink-0">
        <div className="p-5 border-b border-[#1e2140]">
          <div className="text-2xl mb-1">🌙</div>
          <p className="text-white font-bold text-sm">Moonlight</p>
          <p className="text-amber-400 text-xs">Admin Panel</p>
        </div>
        <nav className="flex-1 p-3 space-y-1">
          {NAV.map(({ href, label, icon: Icon }) => {
            const active = pathname === href;
            return (
              <Link
                key={href}
                href={href}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all ${
                  active
                    ? "bg-purple-600/20 text-purple-300 border border-purple-600/30"
                    : "text-slate-400 hover:text-slate-200 hover:bg-white/5"
                }`}
              >
                <Icon size={17} />
                {label}
              </Link>
            );
          })}
        </nav>
        <div className="p-3 border-t border-[#1e2140]">
          <button
            onClick={signOut}
            className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm text-slate-500 hover:text-red-400 hover:bg-red-500/10 w-full transition-all"
          >
            <LogOut size={17} /> Sign Out
          </button>
        </div>
      </aside>

      {/* Mobile top bar */}
      <div className="md:hidden fixed top-0 left-0 right-0 z-50 bg-[#0d0f1f] border-b border-[#1e2140] px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-xl">🌙</span>
          <span className="text-white font-bold text-sm">Admin</span>
        </div>
        <button onClick={() => setOpen(!open)} className="text-slate-400">
          {open ? <X size={22} /> : <Menu size={22} />}
        </button>
      </div>

      {/* Mobile drawer */}
      {open && (
        <div className="md:hidden fixed inset-0 z-40 bg-black/60" onClick={() => setOpen(false)}>
          <div className="w-56 h-full bg-[#0d0f1f] border-r border-[#1e2140] p-4 pt-16" onClick={(e) => e.stopPropagation()}>
            <nav className="space-y-1">
              {NAV.map(({ href, label, icon: Icon }) => {
                const active = pathname === href;
                return (
                  <Link
                    key={href}
                    href={href}
                    onClick={() => setOpen(false)}
                    className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all ${
                      active ? "bg-purple-600/20 text-purple-300" : "text-slate-400 hover:text-slate-200"
                    }`}
                  >
                    <Icon size={17} /> {label}
                  </Link>
                );
              })}
              <button
                onClick={signOut}
                className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm text-slate-500 hover:text-red-400 w-full mt-4"
              >
                <LogOut size={17} /> Sign Out
              </button>
            </nav>
          </div>
        </div>
      )}

      {/* Main content */}
      <main className="flex-1 overflow-auto md:pt-0 pt-14">
        {children}
      </main>
    </div>
  );
}
