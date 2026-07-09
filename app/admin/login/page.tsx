"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { Loader2 } from "lucide-react";

export default function AdminLogin() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const router = useRouter();

  const login = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      setError(error.message);
      setLoading(false);
      return;
    }
    // Super admins go to the platform panel; business owners to their admin.
    const { data: isSuper } = await supabase.rpc("is_super_admin");
    router.push(isSuper ? "/super" : "/admin");
  };

  return (
    <div className="min-h-screen bg-[#05060f] flex items-center justify-center px-4">
      <div className="w-full max-w-xs">
        <div className="text-center mb-10">
          <div className="text-4xl mb-4">🌙</div>
          <h1 className="text-lg font-semibold text-white tracking-wide">Sign in</h1>
        </div>

        <form onSubmit={login} className="space-y-3">
          <input
            className="input-cosmic"
            type="email"
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoComplete="email"
            required
          />
          <input
            className="input-cosmic"
            type="password"
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="current-password"
            required
          />
          {error && <p className="text-red-400 text-xs px-1">{error}</p>}
          <button type="submit" className="btn-gold w-full" disabled={loading}>
            {loading ? (
              <span className="flex items-center justify-center gap-2">
                <Loader2 size={15} className="animate-spin" /> Signing in
              </span>
            ) : "Continue"}
          </button>
        </form>
      </div>
    </div>
  );
}
