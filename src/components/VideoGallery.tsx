import React, { useState, useEffect } from "react";
import { StoredVideoJob } from "../types";
import { Film, Download, Trash2, Play, Pause, Calendar, Layers, Clock, Sparkles } from "lucide-react";

interface VideoGalleryProps {
  onGoToStudio: () => void;
}

export const VideoGallery: React.FC<VideoGalleryProps> = ({ onGoToStudio }) => {
  const [videos, setVideos] = useState<StoredVideoJob[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedVideo, setSelectedVideo] = useState<StoredVideoJob | null>(null);

  const fetchVideos = async () => {
    try {
      setIsLoading(true);
      const res = await fetch("/api/video/my-videos");
      if (res.ok) {
        const data = await res.json();
        setVideos(data.videos || []);
      }
    } catch (err) {
      console.warn("Failed to fetch gallery:", err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchVideos();
  }, []);

  const handleDelete = async (id: string) => {
    try {
      const res = await fetch(`/api/video/my-videos/${id}`, { method: "DELETE" });
      if (res.ok) {
        setVideos((prev) => prev.filter((v) => v.id !== id));
        if (selectedVideo?.id === id) {
          setSelectedVideo(null);
        }
      }
    } catch (err) {
      console.error("Delete error:", err);
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
        <div>
          <h1 className="text-2xl sm:text-3xl font-black text-white flex items-center gap-2.5">
            <Film className="w-7 h-7 text-indigo-400" />
            My Generated Videos
          </h1>
          <p className="text-sm text-slate-400 mt-1">
            Access, download, and review your historical AI video creations.
          </p>
        </div>
        <button
          onClick={onGoToStudio}
          className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-bold shadow-lg shadow-indigo-600/30 transition-all self-start sm:self-auto"
        >
          <Sparkles className="w-4 h-4" /> Create New Video
        </button>
      </div>

      {isLoading ? (
        <div className="py-24 text-center text-slate-400 space-y-3">
          <div className="w-8 h-8 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-xs">Loading your video library...</p>
        </div>
      ) : videos.length === 0 ? (
        <div className="bg-slate-900/60 border border-slate-800/80 rounded-2xl p-12 text-center max-w-md mx-auto space-y-4">
          <div className="w-16 h-16 rounded-2xl bg-indigo-950/50 border border-indigo-500/20 text-indigo-400 flex items-center justify-center mx-auto">
            <Film className="w-8 h-8" />
          </div>
          <div>
            <h3 className="text-base font-bold text-slate-200">No Videos Yet</h3>
            <p className="text-xs text-slate-400 mt-1">
              You have not produced any videos in this session. Head to the studio to synthesize your first cinematic shot!
            </p>
          </div>
          <button
            onClick={onGoToStudio}
            className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold rounded-xl shadow-lg shadow-indigo-600/20 transition-all inline-flex items-center gap-2"
          >
            <Sparkles className="w-4 h-4" /> Open Video Studio
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {videos.map((vid) => (
            <div
              key={vid.id}
              className="bg-slate-900 border border-slate-800 hover:border-slate-700 rounded-2xl overflow-hidden shadow-xl transition-all group flex flex-col"
            >
              {/* Video Player / Container */}
              <div className="relative bg-slate-950 aspect-video overflow-hidden">
                {vid.videoUrl ? (
                  <video
                    src={vid.videoUrl}
                    controls
                    preload="metadata"
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-slate-600">
                    <Film className="w-10 h-10" />
                  </div>
                )}
                <div className="absolute top-2.5 left-2.5 flex items-center gap-1.5">
                  <span className="text-[10px] bg-slate-900/90 backdrop-blur text-white px-2 py-0.5 rounded-md font-semibold border border-slate-700">
                    {vid.aspectRatio}
                  </span>
                  <span className="text-[10px] bg-slate-900/90 backdrop-blur text-indigo-300 px-2 py-0.5 rounded-md font-semibold border border-indigo-500/30 uppercase">
                    {vid.resolution}
                  </span>
                </div>
              </div>

              {/* Info Details */}
              <div className="p-4 flex-1 flex flex-col justify-between space-y-3">
                <div>
                  <p className="text-xs text-slate-200 font-medium line-clamp-2 leading-relaxed">
                    "{vid.prompt}"
                  </p>
                  <div className="mt-2.5 flex flex-wrap items-center gap-3 text-[11px] text-slate-400">
                    <span className="flex items-center gap-1">
                      <Clock className="w-3 h-3 text-slate-500" /> {vid.duration}
                    </span>
                    <span className="flex items-center gap-1">
                      <Layers className="w-3 h-3 text-slate-500" /> {vid.providerName}
                    </span>
                    <span className="flex items-center gap-1">
                      <Calendar className="w-3 h-3 text-slate-500" />
                      {new Date(vid.createdAt).toLocaleDateString()}
                    </span>
                  </div>
                </div>

                <div className="pt-3 border-t border-slate-800/80 flex items-center justify-between gap-2">
                  <a
                    href={`/api/video/download/${vid.id}`}
                    download={`video-${vid.id}.mp4`}
                    className="flex-1 text-center py-2 px-3 bg-slate-800 hover:bg-slate-700 text-white rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors border border-slate-700/60"
                  >
                    <Download className="w-3.5 h-3.5 text-cyan-400" /> Download MP4
                  </a>
                  <button
                    onClick={() => handleDelete(vid.id)}
                    title="Delete Video"
                    className="p-2 text-slate-400 hover:text-rose-400 hover:bg-slate-800 rounded-lg transition-colors border border-slate-800"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
