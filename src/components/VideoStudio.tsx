import React, { useState, useEffect } from "react";
import { StoredVideoJob, UserProfile } from "../types";
import {
  Sparkles,
  Play,
  Pause,
  Download,
  RotateCw,
  Camera,
  Layers,
  Clock,
  Sliders,
  AlertCircle,
  CheckCircle2,
  Tv,
  Film,
  Zap,
} from "lucide-react";

interface VideoStudioProps {
  user: UserProfile | null;
  activeProviderName: string;
  activeModel: string;
  onOpenAuth: (mode?: "login" | "admin" | "request") => void;
  onVideoCompleted: (video: StoredVideoJob) => void;
}

const PROMPT_SUGGESTIONS = [
  "Cinematic aerial drone shot of futuristic Tokyo skyline in heavy rain with neon reflections, 8k resolution, photorealistic",
  "Slow motion macro shot of water droplet splashing into a glowing bioluminescent pool, highly detailed 4k",
  "Vintage 1970s Super 8 film footage of an astronaut walking in a field of red flowers on Mars, atmospheric haze",
  "Golden eagle soaring through snow-capped alpine peaks at golden hour, dynamic tracking camera motion",
  "Cyberpunk street food vendor cooking under rainy holographic signs, steam rising, shallow depth of field",
];

export const VideoStudio: React.FC<VideoStudioProps> = ({
  user,
  activeProviderName,
  activeModel,
  onOpenAuth,
  onVideoCompleted,
}) => {
  const [prompt, setPrompt] = useState("");
  const [aspectRatio, setAspectRatio] = useState<"16:9" | "9:16" | "1:1">("16:9");
  const [resolution, setResolution] = useState<"720p" | "1080p" | "4k">("1080p");
  const [duration, setDuration] = useState<"5s" | "10s" | "15s">("5s");
  const [cameraMovement, setCameraMovement] = useState("Slow Pan");
  const [lighting, setLighting] = useState("Cinematic Neon");
  const [visualStyle, setVisualStyle] = useState("Photorealistic 35mm");

  const [activeJob, setActiveJob] = useState<StoredVideoJob | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isPlaying, setIsPlaying] = useState(true);

  // Poll active job status
  useEffect(() => {
    if (!activeJob || activeJob.status === "completed" || activeJob.status === "failed") {
      return;
    }

    const interval = setInterval(async () => {
      try {
        const res = await fetch(`/api/video/jobs/${activeJob.id}`);
        if (res.ok) {
          const data = await res.json();
          if (data.job) {
            setActiveJob(data.job);
            if (data.job.status === "completed") {
              onVideoCompleted(data.job);
            }
          }
        }
      } catch (err) {
        console.warn("Polling error:", err);
      }
    }, 1200);

    return () => clearInterval(interval);
  }, [activeJob, onVideoCompleted]);

  const handleGenerate = async () => {
    if (!prompt.trim()) {
      setErrorMessage("Please enter a video prompt description");
      return;
    }

    setErrorMessage(null);
    setIsSubmitting(true);

    try {
      const res = await fetch("/api/video/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prompt: prompt.trim(),
          aspectRatio,
          resolution,
          duration,
          cameraMovement,
          lighting,
          visualStyle,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        if (data.requiresAuth || data.requiresApproval) {
          setErrorMessage(data.error);
          onOpenAuth(data.requiresApproval ? "request" : "login");
        } else {
          setErrorMessage(data.error || "Failed to generate video");
        }
        setIsSubmitting(false);
        return;
      }

      if (data.job) {
        setActiveJob(data.job);
      }
    } catch (err: any) {
      setErrorMessage(err.message || "Network error submitting video job");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Hero Header */}
      <div className="mb-8">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-white flex items-center gap-3">
              <span>AI Video Studio</span>
              <span className="text-xs font-semibold px-2.5 py-1 rounded-md bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 flex items-center gap-1.5">
                <Zap className="w-3.5 h-3.5 text-indigo-400" />
                {activeProviderName}
              </span>
            </h1>
            <p className="text-sm text-slate-400 mt-1">
              Produce cinematic AI video with photorealistic rendering, temporal coherence, and camera directing physics.
            </p>
          </div>

          {user && user.status === "pending" && (
            <div className="bg-amber-950/40 border border-amber-500/40 rounded-xl p-3 flex items-center gap-3">
              <AlertCircle className="w-5 h-5 text-amber-400 shrink-0" />
              <div className="text-xs text-amber-200">
                <span className="font-semibold">Access Pending Review:</span> An admin will activate your full generation quota shortly.
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Left Column: Input and Directing Parameters */}
        <div className="lg:col-span-7 space-y-6">
          {/* Prompt Box */}
          <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-5 shadow-xl">
            <div className="flex items-center justify-between mb-2">
              <label className="text-sm font-semibold text-slate-200 flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-indigo-400" />
                Describe Your Scene
              </label>
              <span className="text-xs text-slate-500">{prompt.length}/500 chars</span>
            </div>
            <textarea
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder="e.g. Ultra-detailed drone tracking shot over a foggy cyberpunk metropolis at twilight, neon reflections in rainwater, cinematic 4k..."
              rows={4}
              maxLength={500}
              className="w-full bg-slate-950/80 border border-slate-800 rounded-xl p-3.5 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all resize-none"
            />

            {/* Quick Inspiration Pills */}
            <div className="mt-3">
              <div className="text-xs font-medium text-slate-400 mb-1.5 flex items-center gap-1">
                <Film className="w-3 h-3 text-slate-400" /> Quick Inspiration:
              </div>
              <div className="flex flex-wrap gap-1.5">
                {PROMPT_SUGGESTIONS.map((s, idx) => (
                  <button
                    key={idx}
                    onClick={() => setPrompt(s)}
                    className="text-[11px] bg-slate-800/80 hover:bg-slate-700/80 text-slate-300 hover:text-white px-2.5 py-1 rounded-lg border border-slate-700/50 transition-colors truncate max-w-full text-left"
                  >
                    {s.slice(0, 48)}...
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Directing & Technical Settings */}
          <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-5 shadow-xl space-y-5">
            <div className="flex items-center justify-between border-b border-slate-800/80 pb-3">
              <h2 className="text-sm font-bold text-slate-200 flex items-center gap-2">
                <Sliders className="w-4 h-4 text-indigo-400" />
                Cinematography Directing
              </h2>
              <span className="text-xs text-slate-400">Model: {activeModel}</span>
            </div>

            {/* Aspect Ratio */}
            <div>
              <label className="text-xs font-semibold text-slate-300 mb-2 flex items-center gap-1.5">
                <Tv className="w-3.5 h-3.5 text-slate-400" /> Aspect Ratio
              </label>
              <div className="grid grid-cols-3 gap-2.5">
                {(["16:9", "9:16", "1:1"] as const).map((ratio) => (
                  <button
                    key={ratio}
                    onClick={() => setAspectRatio(ratio)}
                    className={`py-2.5 px-3 rounded-xl text-xs font-semibold border flex flex-col items-center justify-center gap-1 transition-all ${
                      aspectRatio === ratio
                        ? "bg-indigo-600 border-indigo-500 text-white shadow-md shadow-indigo-600/30"
                        : "bg-slate-950/60 border-slate-800 text-slate-300 hover:bg-slate-800 hover:border-slate-700"
                    }`}
                  >
                    <span className="text-sm font-bold">{ratio}</span>
                    <span className="text-[10px] text-slate-400 font-normal">
                      {ratio === "16:9" ? "Landscape / Cinema" : ratio === "9:16" ? "Portrait / Reels" : "Square"}
                    </span>
                  </button>
                ))}
              </div>
            </div>

            {/* Resolution & Duration */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="text-xs font-semibold text-slate-300 mb-2 flex items-center gap-1.5">
                  <Layers className="w-3.5 h-3.5 text-slate-400" /> Resolution
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {(["720p", "1080p", "4k"] as const).map((res) => (
                    <button
                      key={res}
                      onClick={() => setResolution(res)}
                      className={`py-2 px-2.5 rounded-lg text-xs font-semibold border uppercase transition-all ${
                        resolution === res
                          ? "bg-indigo-600 border-indigo-500 text-white"
                          : "bg-slate-950/60 border-slate-800 text-slate-300 hover:bg-slate-800"
                      }`}
                    >
                      {res}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-300 mb-2 flex items-center gap-1.5">
                  <Clock className="w-3.5 h-3.5 text-slate-400" /> Clip Duration
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {(["5s", "10s", "15s"] as const).map((dur) => (
                    <button
                      key={dur}
                      onClick={() => setDuration(dur)}
                      className={`py-2 px-2.5 rounded-lg text-xs font-semibold border transition-all ${
                        duration === dur
                          ? "bg-indigo-600 border-indigo-500 text-white"
                          : "bg-slate-950/60 border-slate-800 text-slate-300 hover:bg-slate-800"
                      }`}
                    >
                      {dur}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Camera Motion & Lighting */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="text-[11px] font-semibold text-slate-300 mb-1.5 block">Camera Motion</label>
                <select
                  value={cameraMovement}
                  onChange={(e) => setCameraMovement(e.target.value)}
                  className="w-full bg-slate-950/80 border border-slate-800 rounded-lg px-2.5 py-2 text-xs text-slate-200 focus:outline-none focus:border-indigo-500"
                >
                  <option>Static Direct</option>
                  <option>Slow Pan</option>
                  <option>Fast Tracking</option>
                  <option>Orbit 360</option>
                  <option>Dolly Zoom</option>
                  <option>FPV Drone Dive</option>
                </select>
              </div>

              <div>
                <label className="text-[11px] font-semibold text-slate-300 mb-1.5 block">Lighting Scheme</label>
                <select
                  value={lighting}
                  onChange={(e) => setLighting(e.target.value)}
                  className="w-full bg-slate-950/80 border border-slate-800 rounded-lg px-2.5 py-2 text-xs text-slate-200 focus:outline-none focus:border-indigo-500"
                >
                  <option>Cinematic Neon</option>
                  <option>Golden Hour Sunset</option>
                  <option>Moody Rim Light</option>
                  <option>Studio Softbox</option>
                  <option>Natural Daylight</option>
                  <option>Midnight Cyberpunk</option>
                </select>
              </div>

              <div>
                <label className="text-[11px] font-semibold text-slate-300 mb-1.5 block">Visual Preset</label>
                <select
                  value={visualStyle}
                  onChange={(e) => setVisualStyle(e.target.value)}
                  className="w-full bg-slate-950/80 border border-slate-800 rounded-lg px-2.5 py-2 text-xs text-slate-200 focus:outline-none focus:border-indigo-500"
                >
                  <option>Photorealistic 35mm</option>
                  <option>Hyper-Detailed CGI</option>
                  <option>Retro 80s VHS</option>
                  <option>Anamorphic Cinema</option>
                  <option>Anime Shonen Style</option>
                </select>
              </div>
            </div>

            {/* Error Display */}
            {errorMessage && (
              <div className="p-3 bg-rose-950/50 border border-rose-500/40 rounded-xl text-xs text-rose-200 flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
                <span>{errorMessage}</span>
              </div>
            )}

            {/* Action Button */}
            <button
              onClick={handleGenerate}
              disabled={Boolean(isSubmitting || activeJob?.status === "processing")}
              className="w-full py-3.5 px-6 rounded-xl bg-gradient-to-r from-indigo-600 via-blue-600 to-cyan-500 hover:from-indigo-500 hover:to-cyan-400 text-white font-bold text-sm shadow-lg shadow-indigo-600/30 flex items-center justify-center gap-2.5 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
            >
              {isSubmitting || (activeJob && activeJob.status === "processing") ? (
                <>
                  <RotateCw className="w-4 h-4 animate-spin" />
                  Generating Video ({activeJob?.progress || 15}%)...
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4" />
                  Generate AI Video ({resolution.toUpperCase()} • {duration})
                </>
              )}
            </button>
          </div>
        </div>

        {/* Right Column: Video Monitor & Output */}
        <div className="lg:col-span-5">
          <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-5 shadow-xl sticky top-24">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-sm font-bold text-slate-200 flex items-center gap-2">
                <Camera className="w-4 h-4 text-indigo-400" />
                Live Studio Output
              </h2>
              {activeJob && (
                <span
                  className={`text-[10px] px-2 py-0.5 rounded-full font-bold uppercase tracking-wider ${
                    activeJob.status === "completed"
                      ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/30"
                      : activeJob.status === "failed"
                      ? "bg-rose-500/20 text-rose-300 border border-rose-500/30"
                      : "bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 animate-pulse"
                  }`}
                >
                  {activeJob.status}
                </span>
              )}
            </div>

            {/* Stage / Video Display */}
            <div
              className={`relative w-full rounded-xl overflow-hidden bg-slate-950 border border-slate-800 flex items-center justify-center ${
                aspectRatio === "9:16" ? "aspect-[9/16] max-h-[520px]" : aspectRatio === "1:1" ? "aspect-square" : "aspect-video"
              }`}
            >
              {activeJob?.status === "completed" && activeJob.videoUrl ? (
                <div className="relative w-full h-full group">
                  <video
                    src={activeJob.videoUrl}
                    controls
                    autoPlay
                    loop
                    className="w-full h-full object-cover"
                  />
                  <div className="absolute top-3 right-3 flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                    <a
                      href={`/api/video/download/${activeJob.id}`}
                      download={`veo-video-${activeJob.id}.mp4`}
                      className="bg-slate-900/90 hover:bg-slate-800 text-white p-2 rounded-lg text-xs font-semibold shadow-md flex items-center gap-1.5 border border-slate-700"
                    >
                      <Download className="w-3.5 h-3.5 text-cyan-400" /> Download
                    </a>
                  </div>
                </div>
              ) : activeJob?.status === "processing" ? (
                <div className="p-6 text-center space-y-4 max-w-sm">
                  <div className="relative w-16 h-16 mx-auto">
                    <div className="absolute inset-0 rounded-full border-4 border-indigo-500/20 border-t-indigo-500 animate-spin" />
                    <div className="absolute inset-2 rounded-full border-4 border-cyan-400/20 border-b-cyan-400 animate-spin" />
                    <Sparkles className="absolute inset-0 m-auto w-6 h-6 text-indigo-400 animate-pulse" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-slate-100">Rendering Neural Frames</h3>
                    <p className="text-xs text-slate-400 mt-1 min-h-[32px]">
                      {activeJob.statusStage || "Synthesizing multi-view vectors..."}
                    </p>
                  </div>
                  {/* Progress Bar */}
                  <div className="space-y-1.5">
                    <div className="w-full bg-slate-800 rounded-full h-2 overflow-hidden">
                      <div
                        className="bg-gradient-to-r from-indigo-500 to-cyan-400 h-full rounded-full transition-all duration-300"
                        style={{ width: `${activeJob.progress}%` }}
                      />
                    </div>
                    <div className="flex justify-between text-[10px] text-slate-400">
                      <span>{activeJob.providerName}</span>
                      <span className="font-semibold text-slate-200">{activeJob.progress}%</span>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="p-8 text-center text-slate-500 space-y-3">
                  <div className="w-14 h-14 rounded-2xl bg-slate-900 border border-slate-800 flex items-center justify-center mx-auto text-slate-600">
                    <Film className="w-7 h-7" />
                  </div>
                  <div>
                    <h4 className="text-sm font-medium text-slate-300">Ready for Production</h4>
                    <p className="text-xs text-slate-500 mt-1">
                      Enter your prompt and click Generate to synthesize a high-definition video clip.
                    </p>
                  </div>
                </div>
              )}
            </div>

            {/* Video Metadata Box */}
            {activeJob && (
              <div className="mt-4 p-3 bg-slate-950/60 rounded-xl border border-slate-800/80 space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-slate-400">Engine / Provider</span>
                  <span className="text-slate-200 font-semibold">{activeJob.providerName}</span>
                </div>
                <div className="flex items-center justify-between text-xs">
                  <span className="text-slate-400">Format & Duration</span>
                  <span className="text-slate-200 font-medium">
                    {activeJob.aspectRatio} • {activeJob.resolution} • {activeJob.duration}
                  </span>
                </div>
                {activeJob.status === "completed" && (
                  <div className="pt-2 border-t border-slate-800 flex items-center justify-between gap-2">
                    <div className="flex items-center gap-1.5 text-emerald-400 text-xs font-semibold">
                      <CheckCircle2 className="w-4 h-4" /> Ready to stream
                    </div>
                    <a
                      href={`/api/video/download/${activeJob.id}`}
                      download
                      className="text-xs bg-indigo-600 hover:bg-indigo-500 text-white font-semibold px-3 py-1.5 rounded-lg flex items-center gap-1 transition-colors"
                    >
                      <Download className="w-3.5 h-3.5" /> Save MP4
                    </a>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
