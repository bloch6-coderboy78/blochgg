import React from "react";
import { UserProfile, SessionInfo } from "../types";
import { Video, Shield, User, LogOut, KeyRound, Sparkles, MessageSquare, Film } from "lucide-react";

interface HeaderProps {
  currentTab: "studio" | "gallery" | "chat" | "admin";
  onTabChange: (tab: "studio" | "gallery" | "chat" | "admin") => void;
  user: UserProfile | null;
  session: SessionInfo | null;
  activeProviderName: string;
  activeModel: string;
  onOpenAuth: (mode?: "login" | "admin" | "request") => void;
  onLogout: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  currentTab,
  onTabChange,
  user,
  session,
  activeProviderName,
  activeModel,
  onOpenAuth,
  onLogout,
}) => {
  return (
    <header className="border-b border-slate-800 bg-slate-900/80 backdrop-blur sticky top-0 z-40">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-4">
        {/* Logo & Provider Tag */}
        <div className="flex items-center gap-3">
          <button
            onClick={() => onTabChange("studio")}
            className="flex items-center gap-2.5 text-left group focus:outline-none"
          >
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-indigo-600 via-blue-600 to-cyan-400 flex items-center justify-center text-white shadow-lg shadow-indigo-500/20 group-hover:scale-105 transition-transform">
              <Video className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-extrabold text-base tracking-wider bg-gradient-to-r from-white via-slate-100 to-slate-400 bg-clip-text text-transparent">
                  BLOCH BOY
                </span>
                <span className="text-xs px-2 py-0.5 rounded-full bg-indigo-500/20 text-indigo-300 font-semibold border border-indigo-500/30 uppercase tracking-wider">
                  AI Video
                </span>
              </div>
              <p className="text-[11px] text-slate-400 hidden sm:block">
                Engine: <span className="text-cyan-400 font-medium">{activeProviderName}</span> ({activeModel})
              </p>
            </div>
          </button>
        </div>

        {/* Center Navigation */}
        <nav className="hidden md:flex items-center gap-1.5 bg-slate-950/60 p-1 rounded-xl border border-slate-800/80">
          <button
            onClick={() => onTabChange("studio")}
            className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-sm font-medium transition-all ${
              currentTab === "studio"
                ? "bg-indigo-600 text-white shadow-sm"
                : "text-slate-400 hover:text-slate-200 hover:bg-slate-800/50"
            }`}
          >
            <Sparkles className="w-4 h-4" />
            Video Studio
          </button>
          <button
            onClick={() => onTabChange("gallery")}
            className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-sm font-medium transition-all ${
              currentTab === "gallery"
                ? "bg-indigo-600 text-white shadow-sm"
                : "text-slate-400 hover:text-slate-200 hover:bg-slate-800/50"
            }`}
          >
            <Film className="w-4 h-4" />
            My Videos
          </button>
          <button
            onClick={() => onTabChange("chat")}
            className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-sm font-medium transition-all ${
              currentTab === "chat"
                ? "bg-indigo-600 text-white shadow-sm"
                : "text-slate-400 hover:text-slate-200 hover:bg-slate-800/50"
            }`}
          >
            <MessageSquare className="w-4 h-4" />
            AI Chat
          </button>
          {user?.role === "admin" && (
            <button
              onClick={() => onTabChange("admin")}
              className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-sm font-medium transition-all ${
                currentTab === "admin"
                  ? "bg-emerald-600 text-white shadow-sm"
                  : "text-emerald-400 hover:text-emerald-300 hover:bg-emerald-950/40"
              }`}
            >
              <Shield className="w-4 h-4" />
              Admin Portal
            </button>
          )}
        </nav>

        {/* Right Actions & User Pill */}
        <div className="flex items-center gap-2.5">
          {user ? (
            <div className="flex items-center gap-2 bg-slate-800/70 border border-slate-700/80 rounded-xl px-3 py-1.5">
              <div className="w-7 h-7 rounded-lg bg-indigo-500/20 text-indigo-400 flex items-center justify-center font-bold text-xs">
                {user.name ? user.name.slice(0, 2).toUpperCase() : user.email.slice(0, 2).toUpperCase()}
              </div>
              <div className="hidden sm:block text-left">
                <div className="flex items-center gap-1.5">
                  <span className="text-xs font-semibold text-slate-200 truncate max-w-[130px]">
                    {user.name || user.email.split("@")[0]}
                  </span>
                  {user.role === "admin" ? (
                    <span className="text-[10px] bg-emerald-500/20 text-emerald-300 px-1.5 py-0.5 rounded font-medium border border-emerald-500/30">
                      ADMIN
                    </span>
                  ) : user.status === "pending" ? (
                    <span className="text-[10px] bg-amber-500/20 text-amber-300 px-1.5 py-0.5 rounded font-medium border border-amber-500/30 animate-pulse">
                      PENDING
                    </span>
                  ) : (
                    <span className="text-[10px] bg-blue-500/20 text-blue-300 px-1.5 py-0.5 rounded font-medium border border-blue-500/30">
                      APPROVED
                    </span>
                  )}
                </div>
                <div className="text-[10px] text-slate-400">
                  {user.role === "admin" ? "Full Access" : `${user.videoGenerationsCount || 0}/${user.dailyLimit || 25} videos`}
                </div>
              </div>
              <button
                onClick={onLogout}
                title="Sign Out"
                className="text-slate-400 hover:text-rose-400 p-1 rounded-lg hover:bg-slate-700/50 transition-colors"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <button
                onClick={() => onOpenAuth("request")}
                className="hidden sm:flex items-center gap-1.5 text-xs font-semibold text-indigo-300 hover:text-white px-3 py-1.5 rounded-lg bg-indigo-950/60 hover:bg-indigo-900/80 border border-indigo-700/50 transition-all"
              >
                <KeyRound className="w-3.5 h-3.5" />
                Request Access
              </button>
              <button
                onClick={() => onOpenAuth("login")}
                className="flex items-center gap-1.5 text-xs font-semibold text-white px-3.5 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 shadow-sm shadow-indigo-600/30 transition-all"
              >
                <User className="w-3.5 h-3.5" />
                Sign In
              </button>
              <button
                onClick={() => onOpenAuth("admin")}
                title="Administrator Login"
                className="p-1.5 text-slate-400 hover:text-emerald-400 hover:bg-slate-800 rounded-lg border border-slate-800 transition-colors"
              >
                <Shield className="w-4 h-4" />
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Mobile sub-bar */}
      <div className="md:hidden flex items-center justify-around border-t border-slate-800/80 bg-slate-950/80 px-2 py-2">
        <button
          onClick={() => onTabChange("studio")}
          className={`flex items-center gap-1 text-xs px-2.5 py-1 rounded-md ${
            currentTab === "studio" ? "bg-indigo-600 text-white" : "text-slate-400"
          }`}
        >
          <Sparkles className="w-3.5 h-3.5" /> Studio
        </button>
        <button
          onClick={() => onTabChange("gallery")}
          className={`flex items-center gap-1 text-xs px-2.5 py-1 rounded-md ${
            currentTab === "gallery" ? "bg-indigo-600 text-white" : "text-slate-400"
          }`}
        >
          <Film className="w-3.5 h-3.5" /> Videos
        </button>
        <button
          onClick={() => onTabChange("chat")}
          className={`flex items-center gap-1 text-xs px-2.5 py-1 rounded-md ${
            currentTab === "chat" ? "bg-indigo-600 text-white" : "text-slate-400"
          }`}
        >
          <MessageSquare className="w-3.5 h-3.5" /> Chat
        </button>
        {user?.role === "admin" && (
          <button
            onClick={() => onTabChange("admin")}
            className={`flex items-center gap-1 text-xs px-2.5 py-1 rounded-md ${
              currentTab === "admin" ? "bg-emerald-600 text-white" : "text-emerald-400"
            }`}
          >
            <Shield className="w-3.5 h-3.5" /> Admin
          </button>
        )}
      </div>
    </header>
  );
};
