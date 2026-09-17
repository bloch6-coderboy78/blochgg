import React, { useState, useEffect } from "react";
import { UserProfile, SessionInfo, StoredVideoJob } from "./types";
import { Header } from "./components/Header";
import { VideoStudio } from "./components/VideoStudio";
import { VideoGallery } from "./components/VideoGallery";
import { AiChat } from "./components/AiChat";
import { AdminWorkspace } from "./components/AdminWorkspace";
import { AuthModal } from "./components/AuthModal";

export function App() {
  const [currentTab, setCurrentTab] = useState<"studio" | "gallery" | "chat" | "admin">("studio");
  const [user, setUser] = useState<UserProfile | null>(null);
  const [session, setSession] = useState<SessionInfo | null>(null);
  const [activeProviderName, setActiveProviderName] = useState<string>("Google Veo 3 Ultra");
  const [activeModel, setActiveModel] = useState<string>("veo-3.0-generate-001");

  const [isAuthModalOpen, setIsAuthModalOpen] = useState<boolean>(false);
  const [authModalMode, setAuthModalMode] = useState<"login" | "admin" | "request">("login");

  // Fetch session & configuration
  const fetchSession = async () => {
    try {
      const token = localStorage.getItem("baloch_token");
      const headers: Record<string, string> = {};
      if (token) {
        headers["Authorization"] = `Bearer ${token}`;
      }

      const res = await fetch("/api/session", { headers });
      if (res.ok) {
        const data = await res.json();
        setSession(data.session);
        if (data.user) {
          setUser(data.user);
        }
      }

      const configRes = await fetch("/api/video/config");
      if (configRes.ok) {
        const cfg = await configRes.json();
        if (cfg.activeProviderName) setActiveProviderName(cfg.activeProviderName);
        if (cfg.activeModel) setActiveModel(cfg.activeModel);
      }
    } catch (err) {
      console.warn("Session fetch warning:", err);
    }
  };

  useEffect(() => {
    fetchSession();
  }, []);

  // Real-time approval polling if account status is pending
  useEffect(() => {
    if (user?.status !== "pending") return;

    const interval = setInterval(async () => {
      try {
        const res = await fetch(`/api/auth/check-approval?email=${encodeURIComponent(user.email)}`);
        if (res.ok) {
          const data = await res.json();
          if (data.approved && data.user) {
            setUser(data.user);
            if (data.token) {
              localStorage.setItem("baloch_token", data.token);
            }
          }
        }
      } catch (err) {
        console.warn("Approval check error:", err);
      }
    }, 2500);

    return () => clearInterval(interval);
  }, [user]);

  const handleOpenAuth = (mode: "login" | "admin" | "request" = "login") => {
    setAuthModalMode(mode);
    setIsAuthModalOpen(true);
  };

  const handleLogout = async () => {
    try {
      await fetch("/api/auth/logout", { method: "POST" });
    } catch {
      // ignore
    }
    localStorage.removeItem("baloch_token");
    setUser(null);
    if (currentTab === "admin") {
      setCurrentTab("studio");
    }
    fetchSession();
  };

  const handleLoginSuccess = (newUser: UserProfile, token: string | null) => {
    setUser(newUser);
    if (token) {
      localStorage.setItem("baloch_token", token);
    }
    if (newUser.role === "admin") {
      setCurrentTab("admin");
    }
    fetchSession();
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans">
      <Header
        currentTab={currentTab}
        onTabChange={setCurrentTab}
        user={user}
        session={session}
        activeProviderName={activeProviderName}
        activeModel={activeModel}
        onOpenAuth={handleOpenAuth}
        onLogout={handleLogout}
      />

      <main className="flex-1">
        {currentTab === "studio" && (
          <VideoStudio
            user={user}
            activeProviderName={activeProviderName}
            activeModel={activeModel}
            onOpenAuth={handleOpenAuth}
            onVideoCompleted={() => {
              // video finished
            }}
          />
        )}

        {currentTab === "gallery" && (
          <VideoGallery onGoToStudio={() => setCurrentTab("studio")} />
        )}

        {currentTab === "chat" && <AiChat session={session} />}

        {currentTab === "admin" && (
          <AdminWorkspace
            onProviderChanged={() => {
              fetchSession();
            }}
          />
        )}
      </main>

      <AuthModal
        isOpen={isAuthModalOpen}
        initialMode={authModalMode}
        onClose={() => setIsAuthModalOpen(false)}
        onLoginSuccess={handleLoginSuccess}
      />
    </div>
  );
}
export default App;
