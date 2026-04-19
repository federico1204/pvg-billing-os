"use client";
import { useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Eye, EyeOff, Shield, KeyRound } from "lucide-react";

export default function LoginPage() {
  const [step, setStep] = useState<"password" | "2fa">("password");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const codeRef = useRef<HTMLInputElement>(null);
  const router = useRouter();

  async function handlePassword(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");
    const res = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password }),
    });
    const data = await res.json();
    if (!res.ok) {
      setError("Invalid password");
      setLoading(false);
      return;
    }
    if (data.step === "2fa") {
      setStep("2fa");
      setLoading(false);
      setTimeout(() => codeRef.current?.focus(), 100);
    } else {
      router.push("/dashboard");
    }
  }

  async function handle2FA(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");
    const res = await fetch("/api/auth/verify-2fa", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ code }),
    });
    if (res.ok) {
      router.push("/dashboard");
    } else {
      const data = await res.json();
      setError(data.error || "Invalid code");
      setCode("");
      setLoading(false);
      setTimeout(() => codeRef.current?.focus(), 50);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-zinc-950">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <div className="w-12 h-12 rounded-xl bg-green-600 flex items-center justify-center text-white font-bold text-xl mx-auto mb-4">P</div>
          <h1 className="text-2xl font-bold text-white">PVG Billing OS</h1>
          <p className="text-zinc-400 text-sm mt-1">Pura Vida Growth · Internal Tool</p>
        </div>

        {step === "password" ? (
          <form onSubmit={handlePassword} className="bg-zinc-900 border border-zinc-800 rounded-xl p-6 space-y-4">
            <div>
              <Label htmlFor="password">Password</Label>
              <div className="relative">
                <Input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  placeholder="Enter admin password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  autoFocus
                  className="pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-200 transition-colors"
                  tabIndex={-1}
                >
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>
            {error && <p className="text-red-400 text-sm">{error}</p>}
            <Button type="submit" disabled={loading} className="w-full">
              {loading ? "Checking…" : "Continue"}
            </Button>
          </form>
        ) : (
          <form onSubmit={handle2FA} className="bg-zinc-900 border border-zinc-800 rounded-xl p-6 space-y-4">
            <div className="flex items-center gap-3 pb-2 border-b border-zinc-800">
              <div className="w-8 h-8 rounded-lg bg-blue-600/20 flex items-center justify-center">
                <Shield size={15} className="text-blue-400" />
              </div>
              <div>
                <p className="text-sm font-medium text-white">Two-Factor Verification</p>
                <p className="text-xs text-zinc-500">Open Google Authenticator and enter the 6-digit code</p>
              </div>
            </div>
            <div>
              <Label htmlFor="code" className="flex items-center gap-1.5">
                <KeyRound size={12} className="text-zinc-500" />
                Authenticator Code
              </Label>
              <Input
                ref={codeRef}
                id="code"
                type="text"
                inputMode="numeric"
                pattern="\d{6}"
                maxLength={6}
                placeholder="000000"
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
                required
                className="text-center text-xl tracking-[0.5em] font-mono"
                autoComplete="one-time-code"
              />
            </div>
            {error && <p className="text-red-400 text-sm">{error}</p>}
            <Button type="submit" disabled={loading || code.length !== 6} className="w-full">
              {loading ? "Verifying…" : "Sign in"}
            </Button>
            <button
              type="button"
              onClick={() => { setStep("password"); setError(""); setCode(""); }}
              className="w-full text-xs text-zinc-500 hover:text-zinc-300 transition-colors text-center"
            >
              ← Back to password
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
