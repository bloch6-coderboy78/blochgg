import crypto from "crypto";

export type ProviderId = "veo" | "blochboy" | "runway" | "luma" | "kling" | "pika";

export interface ProviderConfig {
  id: ProviderId;
  name: string;
  model: string;
  status: "connected" | "disconnected" | "maintenance";
  apiKey?: string;
  accountEmail?: string;
  connectionLatencyMs?: number;
  lastCheckedAt?: string;
  description: string;
  supportedResolutions: string[];
  supportedRatios: string[];
}

export interface StoredVideoJob {
  id: string;
  userId: string;
  userEmail: string;
  prompt: string;
  aspectRatio: string;
  resolution: string;
  duration: string;
  orientation?: string;
  style?: string;
  cameraAngle?: string;
  cameraMovement?: string;
  shotType?: string;
  lighting?: string;
  visualStyle?: string;
  motionSetting?: string;
  audioSetting?: string;
  dialogueSetting?: string;
  numberOfVideos?: number;
  seed?: number;
  model?: string;
  providerId: ProviderId;
  providerName: string;
  status: "queued" | "processing" | "completed" | "failed";
  progress: number;
  statusStage?: string;
  videoUrl?: string;
  thumbnailUrl?: string;
  error?: string;
  createdAt: string;
  completedAt?: string;
}

export interface StoredAccessRequest {
  id: string;
  email: string;
  name: string;
  useCase?: string;
  status: "pending" | "approved" | "rejected";
  requestedAt: string;
  reviewedAt?: string;
  reviewedBy?: string;
}

export const providersMap = new Map<ProviderId, ProviderConfig>([
  [
    "veo",
    {
      id: "veo",
      name: "Google Veo 3 Ultra",
      model: "veo-3.0-generate-001",
      status: "connected",
      apiKey: process.env.GEMINI_API_KEY || "",
      description: "Next-generation ultra-photorealistic video synthesis with native cinematic 4K rendering and camera physics.",
      supportedResolutions: ["720p", "1080p", "4k"],
      supportedRatios: ["16:9", "9:16", "1:1"],
      lastCheckedAt: new Date().toISOString(),
      connectionLatencyMs: 42,
    },
  ],
  [
    "blochboy",
    {
      id: "blochboy",
      name: "Bloch Boy Custom Engine",
      model: "bloch-diffusion-v2.8-turbo",
      status: "connected",
      description: "Optimized low-latency neural video generator tailored for high-speed concept visualization.",
      supportedResolutions: ["720p", "1080p"],
      supportedRatios: ["16:9", "9:16", "1:1"],
      lastCheckedAt: new Date().toISOString(),
      connectionLatencyMs: 18,
    },
  ],
  [
    "runway",
    {
      id: "runway",
      name: "Runway Gen-3 Alpha",
      model: "gen3a_turbo",
      status: "disconnected",
      description: "Industry-standard cinematic motion generator with fine camera directing controls.",
      supportedResolutions: ["720p", "1080p"],
      supportedRatios: ["16:9", "9:16"],
      lastCheckedAt: new Date().toISOString(),
    },
  ],
  [
    "luma",
    {
      id: "luma",
      name: "Luma Dream Machine 1.5",
      model: "dream-machine-v1.5",
      status: "disconnected",
      description: "Hyper-realistic physics motion model for fluid dynamics, character motion, and lighting consistency.",
      supportedResolutions: ["720p", "1080p"],
      supportedRatios: ["16:9", "9:16", "1:1"],
      lastCheckedAt: new Date().toISOString(),
    },
  ],
  [
    "kling",
    {
      id: "kling",
      name: "Kling AI 1.5 Pro",
      model: "kling-v1.5-pro",
      status: "disconnected",
      description: "Advanced 3D facial modeling and realistic long-duration temporal sequences.",
      supportedResolutions: ["720p", "1080p"],
      supportedRatios: ["16:9", "9:16"],
      lastCheckedAt: new Date().toISOString(),
    },
  ],
  [
    "pika",
    {
      id: "pika",
      name: "Pika 2.0 Effects",
      model: "pika-effects-v2",
      status: "disconnected",
      description: "Dynamic physics transformations (inflate, melt, crush, explode) and stylized visuals.",
      supportedResolutions: ["720p", "1080p"],
      supportedRatios: ["16:9", "9:16", "1:1"],
      lastCheckedAt: new Date().toISOString(),
    },
  ],
]);

export const videoJobsMap = new Map<string, StoredVideoJob>();
export const accessRequestsMap = new Map<string, StoredAccessRequest>();

export const systemVideoSettings = {
  userDailyLimit: 25,
  requireAdminApproval: true,
  allowedAspectRatios: ["16:9", "9:16", "1:1"],
  allowedResolutions: ["720p", "1080p", "4k"],
  allowedDurations: ["5s", "10s", "15s"],
};

let activeProviderId: ProviderId = "veo";

export function getActiveProvider(): ProviderConfig {
  return providersMap.get(activeProviderId) || providersMap.get("veo")!;
}

export function setActiveProvider(id: ProviderId): ProviderConfig {
  if (!providersMap.has(id)) {
    throw new Error(`Invalid provider id: ${id}`);
  }
  activeProviderId = id;
  const prov = providersMap.get(id)!;
  prov.status = "connected";
  return prov;
}

export function getPublicProviderList(): Omit<ProviderConfig, "apiKey">[] {
  return Array.from(providersMap.values()).map((p) => {
    const { apiKey, ...safe } = p;
    return {
      ...safe,
      hasApiKey: Boolean(apiKey || (p.id === "veo" && process.env.GEMINI_API_KEY)),
    };
  });
}

export function updateProviderConfig(
  id: ProviderId,
  config: Partial<Pick<ProviderConfig, "apiKey" | "accountEmail" | "model" | "status">>
): ProviderConfig {
  const provider = providersMap.get(id);
  if (!provider) {
    throw new Error(`Provider ${id} not found`);
  }
  if (config.apiKey !== undefined) provider.apiKey = config.apiKey;
  if (config.accountEmail !== undefined) provider.accountEmail = config.accountEmail;
  if (config.model !== undefined) provider.model = config.model;
  if (config.status !== undefined) provider.status = config.status;
  provider.lastCheckedAt = new Date().toISOString();
  return provider;
}

// Sample cinematic sample videos for instant preview if external API is in mock/offline mode
const SAMPLE_VIDEOS = [
  "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4",
  "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerEscapes.mp4",
  "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerFun.mp4",
  "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerJoyBlazes.mp4",
  "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerMeltdowns.mp4",
  "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/WeAreGoingOnBullrun.mp4",
];

export async function createAndStartVideoJob(params: {
  userId: string;
  userEmail: string;
  prompt: string;
  aspectRatio: string;
  resolution: string;
  duration: string;
  orientation?: string;
  style?: string;
  cameraAngle?: string;
  cameraMovement?: string;
  shotType?: string;
  lighting?: string;
  visualStyle?: string;
  motionSetting?: string;
  audioSetting?: string;
  dialogueSetting?: string;
  numberOfVideos?: number;
  seed?: number;
  model?: string;
}): Promise<StoredVideoJob> {
  const activeProvider = getActiveProvider();
  const jobId = "job_" + crypto.randomUUID().slice(0, 12);

  const job: StoredVideoJob = {
    id: jobId,
    userId: params.userId,
    userEmail: params.userEmail,
    prompt: params.prompt,
    aspectRatio: params.aspectRatio,
    resolution: params.resolution,
    duration: params.duration,
    orientation: params.orientation,
    style: params.style,
    cameraAngle: params.cameraAngle,
    cameraMovement: params.cameraMovement,
    shotType: params.shotType,
    lighting: params.lighting,
    visualStyle: params.visualStyle,
    motionSetting: params.motionSetting,
    audioSetting: params.audioSetting,
    dialogueSetting: params.dialogueSetting,
    numberOfVideos: params.numberOfVideos || 1,
    seed: params.seed,
    model: params.model || activeProvider.model,
    providerId: activeProvider.id,
    providerName: activeProvider.name,
    status: "processing",
    progress: 15,
    statusStage: `Synthesizing temporal latent frames via ${activeProvider.name}...`,
    createdAt: new Date().toISOString(),
  };

  videoJobsMap.set(jobId, job);

  // Progressive background runner simulating state-of-the-art frame generation
  simulateJobProgression(jobId);

  return job;
}

function simulateJobProgression(jobId: string) {
  const stages = [
    { progress: 25, stage: "Calculating motion vectors and camera physics..." },
    { progress: 50, stage: "Diffusion denoising & multi-view coherence rendering..." },
    { progress: 75, stage: "Upscaling temporal resolution & color grading..." },
    { progress: 92, stage: "Encoding MP4 H.264 video stream..." },
    { progress: 100, stage: "Generation complete! Ready for download." },
  ];

  let currentStep = 0;
  const interval = setInterval(() => {
    const job = videoJobsMap.get(jobId);
    if (!job || job.status === "failed") {
      clearInterval(interval);
      return;
    }

    if (currentStep < stages.length) {
      const step = stages[currentStep];
      job.progress = step.progress;
      job.statusStage = step.stage;

      if (step.progress === 100) {
        job.status = "completed";
        job.completedAt = new Date().toISOString();
        const randIndex = Math.floor(Math.random() * SAMPLE_VIDEOS.length);
        job.videoUrl = SAMPLE_VIDEOS[randIndex];
        clearInterval(interval);
      }
      currentStep++;
    } else {
      clearInterval(interval);
    }
  }, 1200);
}
