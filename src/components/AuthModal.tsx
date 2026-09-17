import React, { useState } from "react";
import { UserProfile } from "../types";
import { Shield, User, KeyRound, CheckCircle2, AlertCircle, ArrowRight, Zap, Sparkles } from "lucide-react";

interface AuthModalProps {
  isOpen: boolean;
  initialMode: "login" | "admin" | "request";
  onClose: () => void;
  onLoginSuccess: (user: UserProfile, token: string | null) => void;
}

export const AuthModal: React.FC<AuthModalProps> = ({
  isOpen,
  initialMode,
  onClose,
  onLoginSuccess,
}) => {
  const [mode, setMode] = useState<"login" | "admin" | "request">(initialMode);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [useCase, setUseCase] = useState("");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setSuccessMsg(null);
    setIsLoading(true);

    try {
      if (mode === "admin") {
        const res = await fetch("/api/auth/admin-login", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email: email.trim(), password }),
        });
        const data = await res.json();
        if (!res.ok) {
          setErrorMsg(data.error || "Administrator login failed");
          setIsLoading(false);
          return;
        }
        if (data.token) {
          localStorage.setItem("baloch_token", data.token);
        }
        onLoginSuccess(data.user, data.token);
        onClose();
      } else if (mode === "login") {
        const res = await fetch("/api/auth/login", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email: email.trim(), password }),
        });
        const data = await res.json();
        if (!res.ok) {
          setErrorMsg(data.error || "Login failed");
          setIsLoading(false);
          return;
        }
        if (data.token) {
          localStorage.setItem("baloch_token", data.token);
        }
        onLoginSuccess(data.user, data.token);
        onClose();
      } else {
        // Request Access
        const res = await fetch("/api/auth/request-access", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            email: email.trim(),
            name: name.trim() || undefined,
            useCase: useCase.trim() || undefined,
            password: password || undefined,
          }),
        });
        const data = await res.json();
        if (!res.ok) {
          setErrorMsg(data.error || "Failed to submit request");
          setIsLoading(false);
          return;
        }
        setSuccessMsg(data.message || "Access request submitted! An administrator will review your account.");
        if (data.user) {
          onLoginSuccess(data.user, data.token || null);
        }
      }
    } catch (err: any) {
      setErrorMsg(err.message || "Network communication error");
    } finally {
      setIsLoading(false);
    }
  };

  // Quick 1-Click Demo Logins
  const handleQuickAdmin = () => {
    setMode("admin");
    setEmail("blochboy@gmail.com");
    setPassword("03463619649");
  };

  const handleQuickUser = () => {
    setMode("login");
    setEmail("user@example.com");
    setPassword("user123456");
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-slate-900 border border-slate-800 rounded-3xl max-w-md w-full p-6 sm:p-8 shadow-2xl space-y-6 relative overflow-hidden">
        {/* Top Decorative accent */}
        <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-indigo-500 via-blue-500 to-cyan-400" />

        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-indigo-600/20 text-indigo-400 flex items-center justify-center border border-indigo-500/30">
              {mode === "admin" ? <Shield className="w-5 h-5 text-emerald-400" /> : <User className="w-5 h-5" />}
            </div>
            <div>
              <h3 className="font-extrabold text-base text-white">
                {mode === "admin" ? "Administrator Portal" : mode === "login" ? "Creator Sign In" : "Request Studio Access"}
              </h3>
              <p className="text-xs text-slate-400">BLOCH BOY AI VIDEO Platform</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-lg bg-slate-800 text-slate-400 hover:text-white flex items-center justify-center text-sm"
          >
            ✕
          </button>
        </div>

        {/* Mode Selector */}
        <div className="flex items-center gap-1 bg-slate-950 p-1 rounded-xl border border-slate-800">
          <button
            type="button"
            onClick={() => {
              setMode("login");
              setErrorMsg(null);
            }}
            className={`flex-1 py-1.5 text-xs font-semibold rounded-lg transition-all ${
              mode === "login" ? "bg-indigo-600 text-white shadow-sm" : "text-slate-400 hover:text-white"
            }`}
          >
            Sign In
          </button>
          <button
            type="button"
            onClick={() => {
              setMode("request");
              setErrorMsg(null);
            }}
            className={`flex-1 py-1.5 text-xs font-semibold rounded-lg transition-all ${
              mode === "request" ? "bg-indigo-600 text-white shadow-sm" : "text-slate-400 hover:text-white"
            }`}
          >
            Request Access
          </button>
          <button
            type="button"
            onClick={() => {
              setMode("admin");
              setErrorMsg(null);
            }}
            className={`flex-1 py-1.5 text-xs font-semibold rounded-lg transition-all ${
              mode === "admin" ? "bg-emerald-600 text-white shadow-sm" : "text-slate-400 hover:text-emerald-400"
            }`}
          >
            Admin
          </button>
        </div>

        {/* Notifications */}
        {errorMsg && (
          <div className="p-3 bg-rose-950/60 border border-rose-500/40 rounded-xl text-xs text-rose-200 flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
            <span>{errorMsg}</span>
          </div>
        )}
        {successMsg && (
          <div className="p-3 bg-emerald-950/60 border border-emerald-500/40 rounded-xl text-xs text-emerald-200 flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
            <span>{successMsg}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          {mode === "request" && (
            <div>
              <label className="text-xs font-semibold text-slate-300 block mb-1">Your Name</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Alex River"
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500"
              />
            </div>
          )}

          <div>
            <label className="text-xs font-semibold text-slate-300 block mb-1">
              {mode === "admin" ? "Admin Email Address" : "Email Address"}
            </label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder={mode === "admin" ? "blochboy@gmail.com" : "creator@example.com"}
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500"
            />
          </div>

          <div>
            <label className="text-xs font-semibold text-slate-300 block mb-1">Password</label>
            <input
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500"
            />
          </div>

          {mode === "request" && (
            <div>
              <label className="text-xs font-semibold text-slate-300 block mb-1">Intended Creative Project</label>
              <textarea
                value={useCase}
                onChange={(e) => setUseCase(e.target.value)}
                placeholder="e.g. Producing cinematic sci-fi shorts and advertising concepts with Veo 3 Ultra"
                rows={2}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500 resize-none"
              />
            </div>
          )}

          <button
            type="submit"
            disabled={isLoading}
            className={`w-full py-3 rounded-xl font-bold text-xs text-white shadow-lg transition-all flex items-center justify-center gap-2 ${
              mode === "admin"
                ? "bg-emerald-600 hover:bg-emerald-500 shadow-emerald-600/30"
                : "bg-indigo-600 hover:bg-indigo-500 shadow-indigo-600/30"
            }`}
          >
            {isLoading ? (
              "Authenticating..."
            ) : mode === "admin" ? (
              <>Sign In as Administrator <ArrowRight className="w-4 h-4" /></>
            ) : mode === "login" ? (
              <>Sign In to Studio <ArrowRight className="w-4 h-4" /></>
            ) : (
              <>Submit Access Request <Sparkles className="w-4 h-4" /></>
            )}
          </button>
        </form>

        {/* Quick Demo Fill Buttons for Instant Testing */}
        <div className="pt-4 border-t border-slate-800/80 space-y-2">
          <div className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider text-center">
            One-Click Demo Credentials
          </div>
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={handleQuickAdmin}
              className="p-2 bg-emerald-950/40 hover:bg-emerald-900/60 border border-emerald-500/30 rounded-xl text-[11px] text-emerald-300 font-semibold transition-all text-center"
            >
              Fill Admin Account
              <div className="text-[10px] text-emerald-400/80 font-normal">blochboy@gmail.com</div>
            </button>
            <button
              type="button"
              onClick={handleQuickUser}
              className="p-2 bg-indigo-950/40 hover:bg-indigo-900/60 border border-indigo-500/30 rounded-xl text-[11px] text-indigo-300 font-semibold transition-all text-center"
            >
              Fill Creator Account
              <div className="text-[10px] text-indigo-400/80 font-normal">user@example.com</div>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
