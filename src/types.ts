export type ProviderId = "veo" | "blochboy" | "runway" | "luma" | "kling" | "pika";

export interface ProviderItem {
  id: ProviderId;
  name: string;
  model: string;
  status: "connected" | "disconnected" | "maintenance";
  description: string;
  supportedResolutions: string[];
  supportedRatios: string[];
  hasApiKey: boolean;
  connectionLatencyMs?: number;
  lastCheckedAt?: string;
  accountEmail?: string;
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

export interface UserProfile {
  id: string;
  email: string;
  role: "user" | "admin";
  status: "pending" | "approved" | "rejected";
  name?: string;
  createdAt: string;
  videoGenerationsCount?: number;
  dailyLimit?: number;
}

export interface SessionInfo {
  id: string;
  token: string;
  userId?: string | null;
  userEmail?: string | null;
  isAnonymous: boolean;
  ipHash: string;
  userAgent?: string;
  createdAt: string;
  lastActiveAt: string;
  expiresAt: string;
  messageCount: number;
}

export interface AccessRequestItem {
  id: string;
  email: string;
  name: string;
  useCase?: string;
  status: "pending" | "approved" | "rejected";
  requestedAt: string;
  reviewedAt?: string;
  reviewedBy?: string;
}

export interface SystemVideoSettings {
  userDailyLimit: number;
  requireAdminApproval: boolean;
  allowedAspectRatios: string[];
  allowedResolutions: string[];
  allowedDurations: string[];
}

export interface ChatMessage {
  id: string;
  sessionId: string;
  userId?: string | null;
  role: "user" | "assistant" | "system";
  content: string;
  model: string;
  usage?: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
    estimatedCostUsd: number;
  };
  createdAt: string;
}
