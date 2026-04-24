import React, { useState } from "react";
import { ShieldCheck } from "lucide-react";
import { useAuth } from "../context/AuthContext";

export function LoginPage() {
  const { login } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setLoading(true);
    setError(null);
    try {
      await login(email, password);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Authentication failed";
      setError(message.replace(/^API .*?: \d+\s*/, ""));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6">
      <div className="w-full max-w-md bg-white border border-slate-200 rounded-2xl p-7 shadow-sm">
        <div className="flex items-center gap-3 mb-5">
          <div className="h-9 w-9 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center">
            <ShieldCheck size={18} />
          </div>
          <div>
            <h1 className="text-slate-900 text-lg font-semibold">AuraStack Secure Login</h1>
            <p className="text-xs text-slate-500">Role-based access for workflows and operations</p>
          </div>
        </div>

        <form className="space-y-3" onSubmit={submit}>
          <input
            className="w-full h-11 px-3 rounded-lg border border-slate-200 text-sm"
            placeholder="Work Email"
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            required
          />
          <input
            className="w-full h-11 px-3 rounded-lg border border-slate-200 text-sm"
            placeholder="Password"
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            required
            minLength={8}
          />
          {error && <p className="text-xs text-red-600">{error}</p>}
          <button
            type="submit"
            disabled={loading}
            className="w-full h-11 rounded-lg bg-emerald-600 text-white text-sm font-medium disabled:opacity-60"
          >
            {loading ? "Please wait..." : "Login"}
          </button>
        </form>
      </div>
    </div>
  );
}
