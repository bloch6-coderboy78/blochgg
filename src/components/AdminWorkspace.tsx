import React, { useState, useEffect } from "react";
import { ProviderItem, AccessRequestItem, UserProfile, StoredVideoJob, SystemVideoSettings } from "../types";
import {
  Shield,
  Layers,
  Users,
  CheckCircle2,
  XCircle,
  RotateCw,
  Zap,
  Activity,
  Key,
  Server,
  Settings,
  Clock,
  AlertCircle,
  ExternalLink,
  ChevronRight,
  Sparkles,
} from "lucide-react";

interface AdminWorkspaceProps {
  onProviderChanged: () => void;
}

export const AdminWorkspace: React.FC<AdminWorkspaceProps> = ({ onProviderChanged }) => {
  const [activeTab, setActiveTab] = useState<"providers" | "requests" | "users" | "jobs" | "settings">("providers");

  const [stats, setStats] = useState<any>(null);
  const [providers, setProviders] = useState<ProviderItem[]>([]);
  const [accessRequests, setAccessRequests] = useState<AccessRequestItem[]>([]);
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [jobs, setJobs] = useState<StoredVideoJob[]>([]);
  const [settings, setSettings] = useState<SystemVideoSettings | null>(null);

  const [isLoading, setIsLoading] = useState(true);
  const [actionNotice, setActionNotice] = useState<string | null>(null);
  const [editingProvider, setEditingProvider] = useState<ProviderItem | null>(null);
  const [apiKeyInput, setApiKeyInput] = useState("");

  const getAuthHeader = (): Record<string, string> => {
    const token = localStorage.getItem("baloch_token");
    return token ? { Authorization: `Bearer ${token}` } : {};
  };

  const fetchAdminData = async () => {
    try {
      setIsLoading(true);
      const headers = { "Content-Type": "application/json", ...getAuthHeader() };

      const [statsRes, provRes, reqRes, userRes, jobsRes, setRes] = await Promise.all([
        fetch("/api/admin/video-stats", { headers }),
        fetch("/api/admin/providers", { headers }),
        fetch("/api/admin/access-requests", { headers }),
        fetch("/api/admin/users", { headers }),
        fetch("/api/admin/video-jobs", { headers }),
        fetch("/api/admin/settings", { headers }),
      ]);

      if (statsRes.ok) setStats(await statsRes.json());
      if (provRes.ok) {
        const d = await provRes.json();
        setProviders(d.providers || []);
      }
      if (reqRes.ok) {
        const d = await reqRes.json();
        setAccessRequests(d.accessRequests || []);
      }
      if (userRes.ok) {
        const d = await userRes.json();
        setUsers(d.users || []);
      }
      if (jobsRes.ok) {
        const d = await jobsRes.json();
        setJobs(d.jobs || []);
      }
      if (setRes.ok) {
        const d = await setRes.json();
        setSettings(d.settings);
      }
    } catch (err) {
      console.error("Admin data fetch error:", err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchAdminData();
  }, []);

  const handleSwitchProvider = async (providerId: string) => {
    try {
      const res = await fetch("/api/admin/providers/switch", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...getAuthHeader() },
        body: JSON.stringify({ providerId }),
      });
      if (res.ok) {
        const data = await res.json();
        setProviders(data.providers || []);
        setActionNotice(`Switched active provider to ${data.activeProvider}`);
        onProviderChanged();
        fetchAdminData();
      }
    } catch (err) {
      console.error("Switch error:", err);
    }
  };

  const handleTestProvider = async (id: string) => {
    try {
      setActionNotice(`Testing connection latency for ${id}...`);
      const res = await fetch(`/api/admin/providers/${id}/test`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...getAuthHeader() },
      });
      if (res.ok) {
        const data = await res.json();
        setActionNotice(data.message);
        fetchAdminData();
      }
    } catch (err) {
      console.error("Test error:", err);
    }
  };

  const handleSaveProviderConfig = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingProvider) return;

    try {
      const res = await fetch(`/api/admin/providers/${editingProvider.id}/config`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...getAuthHeader() },
        body: JSON.stringify({ apiKey: apiKeyInput }),
      });
      if (res.ok) {
        const data = await res.json();
        setProviders(data.providers || []);
        setActionNotice(data.message);
        setEditingProvider(null);
        setApiKeyInput("");
        fetchAdminData();
      }
    } catch (err) {
      console.error("Save config error:", err);
    }
  };

  const handleApproveRequest = async (id: string) => {
    try {
      const res = await fetch(`/api/admin/access-requests/${id}/approve`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...getAuthHeader() },
      });
      if (res.ok) {
        const data = await res.json();
        setActionNotice(data.message);
        fetchAdminData();
      }
    } catch (err) {
      console.error("Approve error:", err);
    }
  };

  const handleRejectRequest = async (id: string) => {
    try {
      const res = await fetch(`/api/admin/access-requests/${id}/reject`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...getAuthHeader() },
      });
      if (res.ok) {
        const data = await res.json();
        setActionNotice(data.message);
        fetchAdminData();
      }
    } catch (err) {
      console.error("Reject error:", err);
    }
  };

  const handleToggleUserStatus = async (id: string, currentStatus: string) => {
    const nextStatus = currentStatus === "approved" ? "rejected" : "approved";
    try {
      const res = await fetch(`/api/admin/users/${id}/status`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...getAuthHeader() },
        body: JSON.stringify({ status: nextStatus }),
      });
      if (res.ok) {
        setActionNotice(`User status updated to ${nextStatus}`);
        fetchAdminData();
      }
    } catch (err) {
      console.error("Status update error:", err);
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Header Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl sm:text-3xl font-black text-white flex items-center gap-2.5">
              <Shield className="w-7 h-7 text-emerald-400" />
              Admin Control Center
            </h1>
            <span className="text-xs bg-emerald-500/20 text-emerald-300 font-bold px-2 py-0.5 rounded-full border border-emerald-500/30">
              HIGH-ASSURANCE WORKSPACE
            </span>
          </div>
          <p className="text-sm text-slate-400 mt-1">
            Manage video generation providers, review creator access requests, and monitor production pipeline.
          </p>
        </div>
        <button
          onClick={fetchAdminData}
          className="flex items-center gap-1.5 px-3.5 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold rounded-xl border border-slate-700 transition-all self-start md:self-auto"
        >
          <RotateCw className="w-3.5 h-3.5" /> Refresh Data
        </button>
      </div>

      {/* Action Notification Toast */}
      {actionNotice && (
        <div className="mb-6 p-3.5 bg-indigo-950/80 border border-indigo-500/50 rounded-xl text-xs text-indigo-200 flex items-center justify-between shadow-lg">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-cyan-400 shrink-0" />
            <span>{actionNotice}</span>
          </div>
          <button
            onClick={() => setActionNotice(null)}
            className="text-slate-400 hover:text-white text-xs px-2"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Top Metric Cards */}
      {stats && (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 mb-8">
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-3.5">
            <div className="text-[11px] font-semibold text-slate-400 uppercase">Active Engine</div>
            <div className="text-base font-extrabold text-white mt-1 truncate">{stats.activeProvider}</div>
            <div className="text-[10px] text-emerald-400 mt-0.5">● {stats.activeProviderStatus}</div>
          </div>
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-3.5">
            <div className="text-[11px] font-semibold text-slate-400 uppercase">Pending Requests</div>
            <div className="text-xl font-extrabold text-amber-400 mt-1">{stats.pendingRequests}</div>
            <div className="text-[10px] text-slate-500 mt-0.5">Awaiting Review</div>
          </div>
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-3.5">
            <div className="text-[11px] font-semibold text-slate-400 uppercase">Approved Users</div>
            <div className="text-xl font-extrabold text-indigo-400 mt-1">{stats.approvedUsers}</div>
            <div className="text-[10px] text-slate-500 mt-0.5">Active Creators</div>
          </div>
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-3.5">
            <div className="text-[11px] font-semibold text-slate-400 uppercase">Completed Videos</div>
            <div className="text-xl font-extrabold text-emerald-400 mt-1">{stats.completedVideos}</div>
            <div className="text-[10px] text-slate-500 mt-0.5">Rendered MP4</div>
          </div>
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-3.5">
            <div className="text-[11px] font-semibold text-slate-400 uppercase">Processing Jobs</div>
            <div className="text-xl font-extrabold text-cyan-400 mt-1">{stats.processingJobs}</div>
            <div className="text-[10px] text-slate-500 mt-0.5">Active Diffusion</div>
          </div>
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-3.5">
            <div className="text-[11px] font-semibold text-slate-400 uppercase">Total Requests</div>
            <div className="text-xl font-extrabold text-slate-200 mt-1">{stats.totalGenerations}</div>
            <div className="text-[10px] text-slate-500 mt-0.5">Historical Jobs</div>
          </div>
        </div>
      )}

      {/* Navigation Sub-Tabs */}
      <div className="flex items-center gap-2 border-b border-slate-800 pb-3 mb-6 overflow-x-auto">
        <button
          onClick={() => setActiveTab("providers")}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all whitespace-nowrap ${
            activeTab === "providers"
              ? "bg-indigo-600 text-white shadow-md shadow-indigo-600/30"
              : "text-slate-400 hover:text-white hover:bg-slate-800/60"
          }`}
        >
          <Server className="w-4 h-4" /> Video Providers & Routing
        </button>
        <button
          onClick={() => setActiveTab("requests")}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all whitespace-nowrap ${
            activeTab === "requests"
              ? "bg-indigo-600 text-white shadow-md shadow-indigo-600/30"
              : "text-slate-400 hover:text-white hover:bg-slate-800/60"
          }`}
        >
          <Key className="w-4 h-4" /> Access Requests ({accessRequests.filter((r) => r.status === "pending").length})
        </button>
        <button
          onClick={() => setActiveTab("users")}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all whitespace-nowrap ${
            activeTab === "users"
              ? "bg-indigo-600 text-white shadow-md shadow-indigo-600/30"
              : "text-slate-400 hover:text-white hover:bg-slate-800/60"
          }`}
        >
          <Users className="w-4 h-4" /> Users & Quotas ({users.length})
        </button>
        <button
          onClick={() => setActiveTab("jobs")}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all whitespace-nowrap ${
            activeTab === "jobs"
              ? "bg-indigo-600 text-white shadow-md shadow-indigo-600/30"
              : "text-slate-400 hover:text-white hover:bg-slate-800/60"
          }`}
        >
          <Activity className="w-4 h-4" /> Video Pipeline ({jobs.length})
        </button>
        <button
          onClick={() => setActiveTab("settings")}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all whitespace-nowrap ${
            activeTab === "settings"
              ? "bg-indigo-600 text-white shadow-md shadow-indigo-600/30"
              : "text-slate-400 hover:text-white hover:bg-slate-800/60"
          }`}
        >
          <Settings className="w-4 h-4" /> System Settings
        </button>
      </div>

      {/* Tab 1: Providers Workspace */}
      {activeTab === "providers" && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {providers.map((p) => {
              const isActive = stats?.activeProvider === p.name;
              return (
                <div
                  key={p.id}
                  className={`bg-slate-900 rounded-2xl p-5 border transition-all flex flex-col justify-between ${
                    isActive
                      ? "border-indigo-500 shadow-xl shadow-indigo-500/10 ring-1 ring-indigo-500/30"
                      : "border-slate-800 hover:border-slate-700"
                  }`}
                >
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <div
                          className={`w-2.5 h-2.5 rounded-full ${
                            p.status === "connected" ? "bg-emerald-400" : "bg-slate-500"
                          }`}
                        />
                        <h3 className="font-bold text-sm text-white">{p.name}</h3>
                      </div>
                      {isActive && (
                        <span className="text-[10px] bg-indigo-500/20 text-indigo-300 font-bold px-2 py-0.5 rounded-full border border-indigo-500/30">
                          ACTIVE ROUTE
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-slate-400 leading-relaxed min-h-[48px]">
                      {p.description}
                    </p>
                    <div className="mt-4 pt-3 border-t border-slate-800/80 space-y-1.5 text-xs">
                      <div className="flex justify-between text-slate-400">
                        <span>Model Tag</span>
                        <span className="text-slate-200 font-mono text-[11px]">{p.model}</span>
                      </div>
                      <div className="flex justify-between text-slate-400">
                        <span>Status</span>
                        <span
                          className={`font-semibold capitalize ${
                            p.status === "connected" ? "text-emerald-400" : "text-slate-400"
                          }`}
                        >
                          {p.status} {p.connectionLatencyMs ? `(${p.connectionLatencyMs}ms)` : ""}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="mt-5 pt-3 border-t border-slate-800 flex items-center gap-2">
                    {!isActive ? (
                      <button
                        onClick={() => handleSwitchProvider(p.id)}
                        className="flex-1 py-1.5 px-3 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1.5"
                      >
                        <Zap className="w-3.5 h-3.5" /> Make Active
                      </button>
                    ) : (
                      <div className="flex-1 py-1.5 px-3 bg-indigo-950/60 border border-indigo-500/40 text-indigo-300 rounded-lg text-xs font-bold text-center">
                        Active Provider
                      </div>
                    )}
                    <button
                      onClick={() => handleTestProvider(p.id)}
                      title="Ping Latency Test"
                      className="py-1.5 px-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-xs transition-colors border border-slate-700"
                    >
                      <Activity className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => {
                        setEditingProvider(p);
                        setApiKeyInput("");
                      }}
                      title="Configure Credentials"
                      className="py-1.5 px-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-xs transition-colors border border-slate-700"
                    >
                      <Key className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Inline Edit Modal */}
          {editingProvider && (
            <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
              <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-base font-bold text-white flex items-center gap-2">
                    <Key className="w-4 h-4 text-indigo-400" />
                    Configure {editingProvider.name}
                  </h3>
                  <button
                    onClick={() => setEditingProvider(null)}
                    className="text-slate-400 hover:text-white text-xs"
                  >
                    ✕
                  </button>
                </div>
                <p className="text-xs text-slate-400">
                  Update provider API keys or bearer token. Secrets remain secure on the backend server.
                </p>
                <form onSubmit={handleSaveProviderConfig} className="space-y-4">
                  <div>
                    <label className="text-xs font-semibold text-slate-300 block mb-1">
                      API Key / Secret Token
                    </label>
                    <input
                      type="password"
                      value={apiKeyInput}
                      onChange={(e) => setApiKeyInput(e.target.value)}
                      placeholder="Enter provider key (e.g. sk-...)"
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500"
                    />
                  </div>
                  <div className="flex items-center justify-end gap-2 pt-2">
                    <button
                      type="button"
                      onClick={() => setEditingProvider(null)}
                      className="px-4 py-2 bg-slate-800 text-slate-300 hover:bg-slate-700 rounded-xl text-xs font-semibold"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-bold shadow-md shadow-indigo-600/30"
                    >
                      Save Configuration
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Tab 2: Access Requests */}
      {activeTab === "requests" && (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
          <div className="p-5 border-b border-slate-800">
            <h3 className="font-bold text-sm text-white">Creator Access Requests</h3>
            <p className="text-xs text-slate-400 mt-0.5">
              Approving an access request activates the user account and auto-logs them in immediately.
            </p>
          </div>
          {accessRequests.length === 0 ? (
            <div className="p-12 text-center text-slate-500 text-xs">No access requests submitted yet.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-950/60 text-slate-400 uppercase font-semibold text-[10px] border-b border-slate-800">
                  <tr>
                    <th className="px-5 py-3">Applicant</th>
                    <th className="px-5 py-3">Email Address</th>
                    <th className="px-5 py-3">Intended Use Case</th>
                    <th className="px-5 py-3">Requested At</th>
                    <th className="px-5 py-3">Status</th>
                    <th className="px-5 py-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/80">
                  {accessRequests.map((req) => (
                    <tr key={req.id} className="hover:bg-slate-800/30 transition-colors">
                      <td className="px-5 py-3.5 font-bold text-white">{req.name}</td>
                      <td className="px-5 py-3.5 text-slate-300 font-mono">{req.email}</td>
                      <td className="px-5 py-3.5 text-slate-400 max-w-xs truncate">{req.useCase}</td>
                      <td className="px-5 py-3.5 text-slate-500">{new Date(req.requestedAt).toLocaleString()}</td>
                      <td className="px-5 py-3.5">
                        <span
                          className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                            req.status === "approved"
                              ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/30"
                              : req.status === "rejected"
                              ? "bg-rose-500/20 text-rose-300 border border-rose-500/30"
                              : "bg-amber-500/20 text-amber-300 border border-amber-500/30"
                          }`}
                        >
                          {req.status}
                        </span>
                      </td>
                      <td className="px-5 py-3.5 text-right space-x-2">
                        {req.status === "pending" ? (
                          <>
                            <button
                              onClick={() => handleApproveRequest(req.id)}
                              className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-500 text-white rounded-md text-[11px] font-bold"
                            >
                              Approve
                            </button>
                            <button
                              onClick={() => handleRejectRequest(req.id)}
                              className="px-2.5 py-1 bg-rose-950/80 hover:bg-rose-900 text-rose-300 rounded-md text-[11px] font-semibold border border-rose-800"
                            >
                              Decline
                            </button>
                          </>
                        ) : (
                          <span className="text-[11px] text-slate-500">Reviewed</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Tab 3: Users */}
      {activeTab === "users" && (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
          <div className="p-5 border-b border-slate-800">
            <h3 className="font-bold text-sm text-white">Registered User Accounts</h3>
            <p className="text-xs text-slate-400 mt-0.5">
              Review roles, usage limits, and account activation statuses.
            </p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-950/60 text-slate-400 uppercase font-semibold text-[10px] border-b border-slate-800">
                <tr>
                  <th className="px-5 py-3">Account Name</th>
                  <th className="px-5 py-3">Email Address</th>
                  <th className="px-5 py-3">Role</th>
                  <th className="px-5 py-3">Status</th>
                  <th className="px-5 py-3">Generations / Quota</th>
                  <th className="px-5 py-3 text-right">Access Control</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/80">
                {users.map((u) => (
                  <tr key={u.id} className="hover:bg-slate-800/30 transition-colors">
                    <td className="px-5 py-3.5 font-bold text-white">{u.name || "User"}</td>
                    <td className="px-5 py-3.5 text-slate-300 font-mono">{u.email}</td>
                    <td className="px-5 py-3.5">
                      <span
                        className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                          u.role === "admin"
                            ? "bg-purple-500/20 text-purple-300 border border-purple-500/30"
                            : "bg-slate-800 text-slate-300"
                        }`}
                      >
                        {u.role}
                      </span>
                    </td>
                    <td className="px-5 py-3.5">
                      <span
                        className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                          u.status === "approved"
                            ? "text-emerald-400"
                            : u.status === "pending"
                            ? "text-amber-400"
                            : "text-rose-400"
                        }`}
                      >
                        {u.status}
                      </span>
                    </td>
                    <td className="px-5 py-3.5 text-slate-400">
                      {u.role === "admin" ? "Unlimited" : `${u.videoGenerationsCount || 0} / ${u.dailyLimit || 25}`}
                    </td>
                    <td className="px-5 py-3.5 text-right">
                      {u.role !== "admin" && (
                        <button
                          onClick={() => handleToggleUserStatus(u.id, u.status)}
                          className={`px-2.5 py-1 rounded-md text-[11px] font-semibold ${
                            u.status === "approved"
                              ? "bg-rose-950/60 hover:bg-rose-900 text-rose-300 border border-rose-800"
                              : "bg-emerald-600 hover:bg-emerald-500 text-white"
                          }`}
                        >
                          {u.status === "approved" ? "Suspend" : "Activate"}
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Tab 4: Jobs Pipeline */}
      {activeTab === "jobs" && (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
          <div className="p-5 border-b border-slate-800">
            <h3 className="font-bold text-sm text-white">Video Rendering Pipeline</h3>
            <p className="text-xs text-slate-400 mt-0.5">
              Real-time feed of all generation jobs across all active video providers.
            </p>
          </div>
          {jobs.length === 0 ? (
            <div className="p-12 text-center text-slate-500 text-xs">No video jobs queued yet.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-950/60 text-slate-400 uppercase font-semibold text-[10px] border-b border-slate-800">
                  <tr>
                    <th className="px-5 py-3">Prompt</th>
                    <th className="px-5 py-3">Provider</th>
                    <th className="px-5 py-3">Settings</th>
                    <th className="px-5 py-3">Progress</th>
                    <th className="px-5 py-3">Status</th>
                    <th className="px-5 py-3">Created</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/80">
                  {jobs.map((j) => (
                    <tr key={j.id} className="hover:bg-slate-800/30 transition-colors">
                      <td className="px-5 py-3.5 font-medium text-slate-200 max-w-sm truncate">
                        {j.prompt}
                      </td>
                      <td className="px-5 py-3.5 text-slate-300 font-semibold">{j.providerName}</td>
                      <td className="px-5 py-3.5 text-slate-400">
                        {j.aspectRatio} • {j.resolution} • {j.duration}
                      </td>
                      <td className="px-5 py-3.5">
                        <div className="w-24 bg-slate-800 rounded-full h-1.5 overflow-hidden">
                          <div
                            className="bg-indigo-500 h-full rounded-full"
                            style={{ width: `${j.progress}%` }}
                          />
                        </div>
                      </td>
                      <td className="px-5 py-3.5">
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                            j.status === "completed"
                              ? "bg-emerald-500/20 text-emerald-300"
                              : j.status === "failed"
                              ? "bg-rose-500/20 text-rose-300"
                              : "bg-indigo-500/20 text-indigo-300 animate-pulse"
                          }`}
                        >
                          {j.status}
                        </span>
                      </td>
                      <td className="px-5 py-3.5 text-slate-500">{new Date(j.createdAt).toLocaleTimeString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Tab 5: Settings */}
      {activeTab === "settings" && settings && (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 max-w-xl shadow-xl space-y-5">
          <h3 className="font-bold text-sm text-white">Global Studio Parameters</h3>
          <div className="space-y-4">
            <div>
              <label className="text-xs font-semibold text-slate-300 block mb-1">
                Default Creator Daily Limit
              </label>
              <input
                type="number"
                value={settings.userDailyLimit}
                onChange={(e) => setSettings({ ...settings, userDailyLimit: Number(e.target.value) })}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2 text-xs text-white"
              />
            </div>
            <div className="flex items-center justify-between p-3 bg-slate-950/60 rounded-xl border border-slate-800">
              <div>
                <div className="text-xs font-semibold text-slate-200">Require Administrator Approval</div>
                <div className="text-[11px] text-slate-400">
                  New creator registrations must be manually approved before generating video.
                </div>
              </div>
              <input
                type="checkbox"
                checked={settings.requireAdminApproval}
                onChange={(e) => setSettings({ ...settings, requireAdminApproval: e.target.checked })}
                className="w-4 h-4 rounded text-indigo-600 focus:ring-indigo-500 bg-slate-900 border-slate-700"
              />
            </div>
            <button
              onClick={async () => {
                await fetch("/api/admin/settings", {
                  method: "POST",
                  headers: { "Content-Type": "application/json", ...getAuthHeader() },
                  body: JSON.stringify(settings),
                });
                setActionNotice("System settings updated successfully");
              }}
              className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-bold shadow-md shadow-indigo-600/30"
            >
              Save System Settings
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
