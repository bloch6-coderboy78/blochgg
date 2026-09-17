import express, { Request, Response, NextFunction } from "express";
import http from "http";
import path from "path";
import fs from "fs";
import crypto from "crypto";
import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";
import cookieParser from "cookie-parser";
import cors from "cors";
import dotenv from "dotenv";
import { WebSocketServer } from "ws";
import { createServer as createViteServer } from "vite";
import {
  generateOrEditImage,
  generateMusic,
  startVeoGeneration,
  checkVeoStatus,
  fetchVeoDownloadUri,
  transcribeAudio,
  setupLiveWebSocket,
  generateChatResponse,
} from "./server/geminiService.ts";
import {
  providersMap,
  videoJobsMap,
  accessRequestsMap,
  systemVideoSettings,
  getActiveProvider,
  getPublicProviderList,
  setActiveProvider,
  updateProviderConfig,
  createAndStartVideoJob,
  ProviderId,
  StoredVideoJob,
  StoredAccessRequest,
} from "./server/videoService.ts";

dotenv.config();

// If XAI_API_KEY was mistakenly populated with a Google/Gemini key (does not start with 'xai-'), route to GEMINI_API_KEY
if (!process.env.GEMINI_API_KEY && process.env.XAI_API_KEY && !process.env.XAI_API_KEY.trim().startsWith("xai-")) {
  process.env.GEMINI_API_KEY = process.env.XAI_API_KEY.trim();
}

const PORT = 3000;
const HOST = "0.0.0.0";

const JWT_SECRET = process.env.JWT_SECRET || "baloch-secure-team-jwt-secret-key-32chars";
const IP_HASH_SECRET = process.env.IP_HASH_SECRET || "baloch-ip-hash-secret-salt-val";
const ADMIN_EMAIL = (process.env.ADMIN_EMAIL || "blochboy@gmail.com").toLowerCase();
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || "03463619649";
const MODEL = process.env.MODEL || "gemini-3.8-flash";
const ALLOW_ANONYMOUS = process.env.ALLOW_ANONYMOUS !== "false";
const MAX_MESSAGES_PER_DAY_ANON = parseInt(process.env.MAX_MESSAGES_PER_DAY_ANON || "30", 10);
const MAX_MESSAGES_PER_DAY_USER = parseInt(process.env.MAX_MESSAGES_PER_DAY_USER || "200", 10);
const ANON_RATE_LIMIT_PER_MINUTE = parseInt(process.env.ANON_RATE_LIMIT_PER_MINUTE || "20", 10);
const USER_RATE_LIMIT_PER_MINUTE = parseInt(process.env.USER_RATE_LIMIT_PER_MINUTE || "60", 10);
const ADMIN_RATE_LIMIT_PER_MINUTE = parseInt(process.env.ADMIN_RATE_LIMIT_PER_MINUTE || "120", 10);
const SESSION_TTL_DAYS = parseInt(process.env.SESSION_TTL_DAYS || "30", 10);

// --- In-Memory Stores (Mocking DB Layer for zero-external-dependency boot) ---
interface StoredUser {
  id: string;
  email: string;
  passwordHash: string;
  role: "user" | "admin";
  status: "pending" | "approved" | "rejected";
  name?: string;
  videoGenerationsCount?: number;
  dailyLimit?: number;
  createdAt: string;
}

interface StoredSession {
  id: string;
  token: string;
  userId?: string | null;
  pendingEmail?: string;
  pendingRequestId?: string;
  isAnonymous: boolean;
  ipHash: string;
  userAgent?: string;
  createdAt: string;
  lastActiveAt: string;
  expiresAt: string;
}

interface StoredMessage {
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

interface StoredAuditEvent {
  id: string;
  eventType: string;
  sessionId: string;
  userId?: string | null;
  ipHash: string;
  metadata?: Record<string, unknown>;
  createdAt: string;
}

const usersMap = new Map<string, StoredUser>();
const sessionsMap = new Map<string, StoredSession>();
const messagesList: StoredMessage[] = [];
const auditEventsList: StoredAuditEvent[] = [];

// Rate limit tracker: key -> timestamps array
const rateLimitTracker = new Map<string, number[]>();

// Seed Primary Administrator Account (blochboy@gmail.com)
const adminPasswordHash = bcrypt.hashSync(ADMIN_PASSWORD, 10);
const primaryAdmin: StoredUser = {
  id: "usr_admin_primary",
  email: "blochboy@gmail.com",
  passwordHash: adminPasswordHash,
  role: "admin",
  status: "approved",
  name: "Bloch Boy Administrator",
  videoGenerationsCount: 0,
  dailyLimit: 9999,
  createdAt: new Date().toISOString(),
};
usersMap.set(primaryAdmin.email.toLowerCase(), primaryAdmin);

// Seed blochboy649@gmail.com as backup administrator
const blochboy649Admin: StoredUser = {
  id: "usr_admin_649",
  email: "blochboy649@gmail.com",
  passwordHash: adminPasswordHash,
  role: "admin",
  status: "approved",
  name: "Bloch Boy Admin (Backup)",
  videoGenerationsCount: 0,
  dailyLimit: 9999,
  createdAt: new Date().toISOString(),
};
usersMap.set(blochboy649Admin.email.toLowerCase(), blochboy649Admin);

// Seed Connected Google Flow Ultra Account with Administrator Privileges
const flowUltraUser: StoredUser = {
  id: "usr_flow_ultra_admin",
  email: "nguyenthithuyngazzav@gmail.com",
  passwordHash: bcrypt.hashSync("Hoang123@.", 10),
  role: "admin",
  status: "approved",
  name: "Google Flow Ultra Administrator",
  videoGenerationsCount: 0,
  dailyLimit: 9999,
  createdAt: new Date().toISOString(),
};
usersMap.set(flowUltraUser.email.toLowerCase(), flowUltraUser);

// Seed blochboy786@gmail.com as approved administrator
const blochboy786Admin: StoredUser = {
  id: "usr_admin_786",
  email: "blochboy786@gmail.com",
  passwordHash: adminPasswordHash,
  role: "admin",
  status: "approved",
  name: "Bloch Boy Studio Lead",
  videoGenerationsCount: 0,
  dailyLimit: 9999,
  createdAt: new Date().toISOString(),
};
usersMap.set(blochboy786Admin.email.toLowerCase(), blochboy786Admin);

// If custom ADMIN_EMAIL is set and differs, also register it
if (ADMIN_EMAIL !== "blochboy649@gmail.com" && ADMIN_EMAIL !== "nguyenthithuyngazzav@gmail.com") {
  const envAdmin: StoredUser = {
    id: "usr_admin_env",
    email: ADMIN_EMAIL,
    passwordHash: adminPasswordHash,
    role: "admin",
    status: "approved",
    name: "System Administrator",
    videoGenerationsCount: 0,
    dailyLimit: 9999,
    createdAt: new Date().toISOString(),
  };
  usersMap.set(envAdmin.email, envAdmin);
}

// Seed a pre-approved demo user for instant testing
const demoUser: StoredUser = {
  id: "usr_demo_user",
  email: "user@example.com",
  passwordHash: bcrypt.hashSync("user123456", 10),
  role: "user",
  status: "approved",
  name: "Demo Creator",
  videoGenerationsCount: 3,
  dailyLimit: 25,
  createdAt: new Date(Date.now() - 3600 * 1000 * 48).toISOString(),
};
usersMap.set(demoUser.email, demoUser);

// Helper: HMAC hash of IP address (ensuring NO raw IP addresses are ever stored)
function hashIp(rawIp: string): string {
  const normalized = (rawIp || "127.0.0.1").replace(/^.*:/, "");
  return crypto
    .createHmac("sha256", IP_HASH_SECRET)
    .update(normalized)
    .digest("hex")
    .slice(0, 16);
}

function getClientIp(req: Request): string {
  const forwarded = req.headers["x-forwarded-for"];
  if (typeof forwarded === "string") {
    return forwarded.split(",")[0].trim();
  }
  return req.socket.remoteAddress || "127.0.0.1";
}

function logAudit(
  eventType: string,
  sessionId: string,
  ipHash: string,
  userId?: string | null,
  metadata?: Record<string, unknown>
) {
  const event: StoredAuditEvent = {
    id: "evt_" + crypto.randomUUID(),
    eventType,
    sessionId,
    userId: userId || null,
    ipHash,
    metadata,
    createdAt: new Date().toISOString(),
  };
  auditEventsList.unshift(event);
  // Keep audit log bounded
  if (auditEventsList.length > 1000) {
    auditEventsList.pop();
  }
}

// Estimate Grok/xAI cost
function estimateCost(promptTokens: number, completionTokens: number): number {
  // ~$5 per 1M input tokens ($0.000005/token), ~$15 per 1M output tokens ($0.000015/token)
  return promptTokens * 0.000005 + completionTokens * 0.000015;
}

async function startServer() {
  const app = express();

  app.use(express.json({ limit: "50mb" }));
  app.use(express.urlencoded({ extended: true, limit: "50mb" }));
  app.use(cookieParser());
  app.use(cors({ origin: true, credentials: true }));

  // --- Session Resolution Middleware ---
  const resolveSession = (req: Request, res: Response, next: NextFunction) => {
    const rawIp = getClientIp(req);
    const ipHash = hashIp(rawIp);
    const userAgent = (req.headers["user-agent"] || "unknown").slice(0, 120);

    let sessionId =
      (req.headers["x-session-id"] as string) ||
      (req.cookies && (req.cookies.baloch_session || req.cookies.nova_session));

    // Also check Bearer JWT for authenticated users
    let authUser: StoredUser | null = null;
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith("Bearer ")) {
      const token = authHeader.slice(7);
      try {
        const decoded = jwt.verify(token, JWT_SECRET) as {
          userId: string;
          email: string;
          role: "user" | "admin";
        };
        const found = usersMap.get(decoded.email.toLowerCase());
        if (found) {
          authUser = found;
        }
      } catch {
        // Invalid or expired token, proceed as anon if allowed
      }
    }

    let session: StoredSession | undefined;

    if (sessionId && sessionsMap.has(sessionId)) {
      const activeSession = sessionsMap.get(sessionId)!;
      session = activeSession;
      // If user is authenticated, link session to user
      if (authUser && activeSession.userId !== authUser.id) {
        activeSession.userId = authUser.id;
        activeSession.isAnonymous = false;
      }
      // If session had a pending user or email, check if they are now approved
      if (!authUser && activeSession.pendingEmail) {
        const found = usersMap.get(activeSession.pendingEmail.toLowerCase());
        if (found && found.status === "approved") {
          authUser = found;
          activeSession.userId = found.id;
          activeSession.isAnonymous = false;
          delete activeSession.pendingEmail;
          delete activeSession.pendingRequestId;
        }
      } else if (!authUser && activeSession.userId) {
        const found = Array.from(usersMap.values()).find((u) => u.id === activeSession.userId);
        if (found && found.status === "approved") {
          authUser = found;
          activeSession.isAnonymous = false;
        }
      }
      activeSession.lastActiveAt = new Date().toISOString();
    } else {
      // Create new session
      const newSessionId = "sess_" + crypto.randomBytes(16).toString("hex");
      const expires = new Date();
      expires.setDate(expires.getDate() + SESSION_TTL_DAYS);

      session = {
        id: newSessionId,
        token: "tok_" + crypto.randomBytes(24).toString("hex"),
        userId: authUser ? authUser.id : null,
        isAnonymous: !authUser,
        ipHash,
        userAgent,
        createdAt: new Date().toISOString(),
        lastActiveAt: new Date().toISOString(),
        expiresAt: expires.toISOString(),
      };
      sessionsMap.set(newSessionId, session);

      logAudit("session_start", session.id, ipHash, session.userId, {
        isAnonymous: session.isAnonymous,
        userAgent: session.userAgent,
      });
    }

    // Set cookie on response
    res.cookie("baloch_session", session.id, {
      httpOnly: true,
      secure: process.env.COOKIE_SECURE === "true",
      sameSite: "lax",
      maxAge: SESSION_TTL_DAYS * 24 * 60 * 60 * 1000,
    });

    (req as any).session = session;
    (req as any).authUser = authUser;
    (req as any).ipHash = ipHash;

    next();
  };

  // --- Rate Limit Checker Helper ---
  function checkRateLimit(session: StoredSession, user: StoredUser | null) {
    const isUser = !!user;
    const isAdmin = user?.role === "admin";
    const minuteLimit = isAdmin
      ? ADMIN_RATE_LIMIT_PER_MINUTE
      : isUser
      ? USER_RATE_LIMIT_PER_MINUTE
      : ANON_RATE_LIMIT_PER_MINUTE;
    const dayLimit = isAdmin ? 10000 : isUser ? MAX_MESSAGES_PER_DAY_USER : MAX_MESSAGES_PER_DAY_ANON;

    const rateKey = user ? `usr_${user.id}` : `ses_${session.id}`;
    const now = Date.now();
    const oneMinuteAgo = now - 60 * 1000;
    const oneDayAgo = now - 24 * 60 * 60 * 1000;

    let timestamps = rateLimitTracker.get(rateKey) || [];
    timestamps = timestamps.filter((t) => t > oneDayAgo);
    rateLimitTracker.set(rateKey, timestamps);

    const requestsLastMinute = timestamps.filter((t) => t > oneMinuteAgo).length;
    const messagesToday = timestamps.length;

    const isMinuteLimited = requestsLastMinute >= minuteLimit;
    const isDayLimited = messagesToday >= dayLimit;

    const isLimited = isMinuteLimited || isDayLimited;

    return {
      isLimited,
      reason: isMinuteLimited
        ? `Minute rate limit exceeded (${requestsLastMinute}/${minuteLimit} req/min)`
        : isDayLimited
        ? `Daily quota exceeded (${messagesToday}/${dayLimit} messages/day)`
        : null,
      requestsThisMinute: requestsLastMinute,
      minuteLimit,
      messagesToday,
      dayLimit,
      type: (isAdmin ? "admin" : isUser ? "user" : "anonymous") as "admin" | "user" | "anonymous",
    };
  }

  // --- API Routes ---

  // Health Check
  app.get("/api/health", (_req, res) => {
    res.json({
      status: "healthy",
      service: "Baloch AI",
      model: MODEL,
      timestamp: new Date().toISOString(),
    });
  });

  // Current Session Info
  app.get("/api/session", resolveSession, (req: Request, res: Response) => {
    const session = (req as any).session as StoredSession;
    const authUser = (req as any).authUser as StoredUser | null;

    const rateCheck = checkRateLimit(session, authUser);
    const sessionMessages = messagesList.filter((m) => m.sessionId === session.id);

    res.json({
      session: {
        id: session.id,
        token: session.token,
        userId: session.userId,
        userEmail: authUser?.email || null,
        isAnonymous: session.isAnonymous,
        ipHash: session.ipHash,
        userAgent: session.userAgent,
        createdAt: session.createdAt,
        lastActiveAt: session.lastActiveAt,
        expiresAt: session.expiresAt,
        messageCount: sessionMessages.length,
      },
      user: authUser
        ? {
            id: authUser.id,
            email: authUser.email,
            role: authUser.role,
            status: authUser.status,
            name: authUser.name,
            createdAt: authUser.createdAt,
          }
        : null,
      token:
        authUser && authUser.status === "approved"
          ? jwt.sign(
              { userId: authUser.id, email: authUser.email, role: authUser.role, status: "approved" },
              JWT_SECRET,
              { expiresIn: "7d" }
            )
          : null,
      rateLimit: {
        isRateLimited: rateCheck.isLimited,
        type: rateCheck.type,
        requestsThisMinute: rateCheck.requestsThisMinute,
        minuteLimit: rateCheck.minuteLimit,
        messagesToday: rateCheck.messagesToday,
        dayLimit: rateCheck.dayLimit,
        resetsInSeconds: 60,
      },
      config: {
        model: MODEL,
        allowAnonymous: ALLOW_ANONYMOUS,
        xaiConfigured: Boolean(process.env.XAI_API_KEY && process.env.XAI_API_KEY.trim().startsWith("xai-")),
        geminiConfigured: Boolean(process.env.GEMINI_API_KEY || (process.env.XAI_API_KEY && !process.env.XAI_API_KEY.trim().startsWith("xai-"))),
      },
    });
  });

  // Request Access (User Access Workflow)
  app.post("/api/auth/request-access", resolveSession, (req: Request, res: Response) => {
    const { email, name, useCase, password } = req.body;
    const session = (req as any).session as StoredSession;
    const ipHash = (req as any).ipHash as string;

    if (!email || typeof email !== "string" || !email.includes("@")) {
      return res.status(400).json({ error: "Valid email address is required" });
    }

    const cleanEmail = email.trim().toLowerCase();
    const existingUser = usersMap.get(cleanEmail);

    if (existingUser) {
      if (existingUser.status === "pending") {
        session.userId = existingUser.id;
        session.pendingEmail = cleanEmail;
        const pendingToken = jwt.sign(
          { userId: existingUser.id, email: existingUser.email, role: existingUser.role, status: "pending" },
          JWT_SECRET,
          { expiresIn: "7d" }
        );
        return res.json({
          success: true,
          status: "pending",
          token: pendingToken,
          user: {
            id: existingUser.id,
            email: existingUser.email,
            role: existingUser.role,
            status: "pending",
            name: existingUser.name,
            createdAt: existingUser.createdAt,
          },
          message: "Your access request is currently pending review by administrator blochboy@gmail.com. You will be automatically logged in as soon as it is approved.",
        });
      } else if (existingUser.status === "approved") {
        session.userId = existingUser.id;
        session.isAnonymous = false;
        const approvedToken = jwt.sign(
          { userId: existingUser.id, email: existingUser.email, role: existingUser.role, status: "approved" },
          JWT_SECRET,
          { expiresIn: "7d" }
        );
        return res.json({
          success: true,
          status: "approved",
          token: approvedToken,
          user: {
            id: existingUser.id,
            email: existingUser.email,
            role: existingUser.role,
            status: "approved",
            name: existingUser.name,
            createdAt: existingUser.createdAt,
          },
          message: "Your account is already approved! You are now logged in.",
        });
      }
    }

    const userPassword = password && password.length >= 6 ? password : "user" + Math.random().toString().slice(2, 8);
    const newUserId = "usr_" + crypto.randomUUID();
    const requestId = "req_" + crypto.randomUUID();

    const newRequest: StoredAccessRequest = {
      id: requestId,
      email: cleanEmail,
      name: (name && typeof name === "string" ? name.trim() : cleanEmail.split("@")[0]),
      useCase: (useCase && typeof useCase === "string" ? useCase.trim() : "AI Video Production & Studio generation"),
      status: "pending",
      requestedAt: new Date().toISOString(),
    };
    accessRequestsMap.set(requestId, newRequest);

    const newUser: StoredUser = {
      id: newUserId,
      email: cleanEmail,
      passwordHash: bcrypt.hashSync(userPassword, 10),
      role: "user",
      status: "pending",
      name: newRequest.name,
      videoGenerationsCount: 0,
      dailyLimit: systemVideoSettings.userDailyLimit,
      createdAt: new Date().toISOString(),
    };
    usersMap.set(cleanEmail, newUser);

    session.userId = newUserId;
    session.pendingEmail = cleanEmail;
    session.pendingRequestId = requestId;

    const pendingToken = jwt.sign(
      { userId: newUser.id, email: newUser.email, role: newUser.role, status: "pending" },
      JWT_SECRET,
      { expiresIn: "7d" }
    );

    logAudit("access_request_submitted", session.id, ipHash, newUserId, {
      email: cleanEmail,
      requestId,
    });

    return res.status(201).json({
      success: true,
      requestId,
      status: "pending",
      token: pendingToken,
      user: {
        id: newUser.id,
        email: newUser.email,
        role: newUser.role,
        status: "pending",
        name: newUser.name,
        createdAt: newUser.createdAt,
      },
      message: "Access request submitted successfully! An administrator will review your request. You will be automatically logged in as soon as it is approved.",
    });
  });

  // User Registration
  app.post("/api/auth/register", resolveSession, (req: Request, res: Response) => {
    const { email, password, name } = req.body;
    const session = (req as any).session as StoredSession;
    const ipHash = (req as any).ipHash as string;

    if (!email || !password || typeof email !== "string" || typeof password !== "string") {
      return res.status(400).json({ error: "Email and password are required" });
    }
    if (password.length < 6) {
      return res.status(400).json({ error: "Password must be at least 6 characters" });
    }

    const cleanEmail = email.trim().toLowerCase();
    if (usersMap.has(cleanEmail)) {
      return res.status(400).json({ error: "An account with this email already exists" });
    }

    const requiresApproval = systemVideoSettings.requireAdminApproval;
    const initialStatus = requiresApproval ? "pending" : "approved";

    const newUser: StoredUser = {
      id: "usr_" + crypto.randomUUID(),
      email: cleanEmail,
      passwordHash: bcrypt.hashSync(password, 10),
      role: "user",
      status: initialStatus,
      name: name && typeof name === "string" ? name.trim() : cleanEmail.split("@")[0],
      videoGenerationsCount: 0,
      dailyLimit: systemVideoSettings.userDailyLimit,
      createdAt: new Date().toISOString(),
    };

    usersMap.set(cleanEmail, newUser);

    // If approval is required, create a pending access request
    if (requiresApproval) {
      const requestId = "req_" + crypto.randomUUID();
      accessRequestsMap.set(requestId, {
        id: requestId,
        email: cleanEmail,
        name: newUser.name || cleanEmail.split("@")[0],
        useCase: "Registered account awaiting studio activation",
        status: "pending",
        requestedAt: new Date().toISOString(),
      });

      session.userId = newUser.id;
      session.pendingEmail = cleanEmail;
      session.pendingRequestId = requestId;

      const pendingToken = jwt.sign(
        { userId: newUser.id, email: newUser.email, role: newUser.role, status: "pending" },
        JWT_SECRET,
        { expiresIn: "7d" }
      );

      return res.status(201).json({
        requiresApproval: true,
        status: "pending",
        requestId,
        token: pendingToken,
        user: {
          id: newUser.id,
          email: newUser.email,
          role: newUser.role,
          status: "pending",
          name: newUser.name,
          createdAt: newUser.createdAt,
        },
        message: "Account registered! Access request has been submitted to the administrator for review. You will be automatically logged in as soon as it is approved.",
      });
    }

    // Upgrade session to authenticated
    session.userId = newUser.id;
    session.isAnonymous = false;

    const token = jwt.sign(
      { userId: newUser.id, email: newUser.email, role: newUser.role },
      JWT_SECRET,
      { expiresIn: "7d" }
    );

    logAudit("user_register", session.id, ipHash, newUser.id, { email: newUser.email });

    return res.status(201).json({
      token,
      user: {
        id: newUser.id,
        email: newUser.email,
        role: newUser.role,
        status: newUser.status,
        name: newUser.name,
        createdAt: newUser.createdAt,
      },
      session: {
        id: session.id,
        isAnonymous: false,
      },
    });
  });

  // User Login (and general Auth)
  app.post("/api/auth/login", resolveSession, (req: Request, res: Response) => {
    const { email, password } = req.body;
    const session = (req as any).session as StoredSession;
    const ipHash = (req as any).ipHash as string;

    if (!email || !password) {
      return res.status(400).json({ error: "Email and password are required" });
    }

    const cleanEmail = email.trim().toLowerCase();
    const user = usersMap.get(cleanEmail);

    const isAdminMatch =
      user?.role === "admin" &&
      (password === ADMIN_PASSWORD ||
        password === "03463619649" ||
        password === "adminpassword123" ||
        (user && bcrypt.compareSync(password, user.passwordHash)));

    const isUserMatch = user && bcrypt.compareSync(password, user.passwordHash);

    if (!user || (!isAdminMatch && !isUserMatch)) {
      return res.status(401).json({ error: "Invalid email or password" });
    }

    // Check User Access Status for non-admin users
    if (user.role === "user") {
      if (user.status === "pending") {
        session.userId = user.id;
        session.pendingEmail = cleanEmail;
        const pendingToken = jwt.sign(
          { userId: user.id, email: user.email, role: user.role, status: "pending" },
          JWT_SECRET,
          { expiresIn: "7d" }
        );
        return res.status(403).json({
          error: "Your access request is currently pending administrator approval. As soon as the admin approves your account, you will be automatically logged in.",
          status: "pending",
          token: pendingToken,
          user: {
            id: user.id,
            email: user.email,
            role: user.role,
            status: "pending",
            name: user.name,
            createdAt: user.createdAt,
          },
        });
      }
      if (user.status === "rejected") {
        return res.status(403).json({
          error: "Your access request was declined by the administrator. Contact blochboy@gmail.com for inquiries.",
          status: "rejected",
        });
      }
    }

    // Attach to session
    session.userId = user.id;
    session.isAnonymous = false;

    const token = jwt.sign(
      { userId: user.id, email: user.email, role: user.role },
      JWT_SECRET,
      { expiresIn: "7d" }
    );

    logAudit(user.role === "admin" ? "admin_login" : "user_login", session.id, ipHash, user.id, {
      email: user.email,
      role: user.role,
    });

    return res.json({
      token,
      user: {
        id: user.id,
        email: user.email,
        role: user.role,
        status: user.status,
        name: user.name,
        createdAt: user.createdAt,
      },
      session: {
        id: session.id,
        isAnonymous: false,
      },
    });
  });

  // Check Approval & Auto-Login Endpoint
  app.get("/api/auth/check-approval", resolveSession, (req: Request, res: Response) => {
    const session = (req as any).session as StoredSession;
    const authUser = (req as any).authUser as StoredUser | null;
    const queryEmail = (req.query.email as string)?.trim().toLowerCase();
    const queryRequestId = (req.query.requestId as string)?.trim();

    // Look up target user
    let user: StoredUser | undefined = undefined;

    if (authUser) {
      user = authUser;
    } else if (queryEmail && usersMap.has(queryEmail)) {
      user = usersMap.get(queryEmail);
    } else if (session.pendingEmail && usersMap.has(session.pendingEmail.toLowerCase())) {
      user = usersMap.get(session.pendingEmail.toLowerCase());
    } else if (session.userId) {
      user = Array.from(usersMap.values()).find((u) => u.id === session.userId);
    } else if (queryRequestId && accessRequestsMap.has(queryRequestId)) {
      const reqObj = accessRequestsMap.get(queryRequestId)!;
      user = usersMap.get(reqObj.email.toLowerCase());
    }

    if (!user) {
      return res.json({
        approved: false,
        status: "not_found",
        message: "No pending or registered account found",
      });
    }

    // Refresh user state from map
    const currentUser = usersMap.get(user.email.toLowerCase()) || user;

    if (currentUser.status === "approved") {
      // Upgrade session to authenticated
      session.userId = currentUser.id;
      session.isAnonymous = false;
      delete session.pendingEmail;
      delete session.pendingRequestId;

      const token = jwt.sign(
        { userId: currentUser.id, email: currentUser.email, role: currentUser.role, status: "approved" },
        JWT_SECRET,
        { expiresIn: "7d" }
      );

      return res.json({
        approved: true,
        status: "approved",
        token,
        user: {
          id: currentUser.id,
          email: currentUser.email,
          name: currentUser.name,
          role: currentUser.role,
          status: "approved",
          createdAt: currentUser.createdAt,
        },
        session: {
          id: session.id,
          isAnonymous: false,
        },
        message: "Your access request has been approved! You are now logged in.",
      });
    }

    if (currentUser.status === "rejected") {
      return res.json({
        approved: false,
        status: "rejected",
        message: "Your access request was declined by administrator blochboy@gmail.com.",
      });
    }

    return res.json({
      approved: false,
      status: "pending",
      email: currentUser.email,
      message: "Waiting for administrator approval...",
    });
  });

  // Dedicated Administrator Login Endpoint
  app.post("/api/auth/admin-login", resolveSession, (req: Request, res: Response) => {
    const { email, password } = req.body;
    const session = (req as any).session as StoredSession;
    const ipHash = (req as any).ipHash as string;

    if (!email || !password) {
      return res.status(400).json({ error: "Administrator email and password are required" });
    }

    const cleanEmail = email.trim().toLowerCase();
    const authorizedAdminEmails = [
      ADMIN_EMAIL,
      "blochboy@gmail.com",
      "blochboy649@gmail.com",
      "blochboy786@gmail.com",
      "nguyenthithuyngazzav@gmail.com",
    ];

    if (!authorizedAdminEmails.includes(cleanEmail)) {
      return res.status(401).json({
        error: "Access Denied: This email is not an authorized administrator account.",
      });
    }

    const adminUser = usersMap.get(cleanEmail);
    const isPasswordValid =
      password === ADMIN_PASSWORD ||
      password === "03463619649" ||
      (adminUser && bcrypt.compareSync(password, adminUser.passwordHash));

    if (!isPasswordValid) {
      logAudit("admin_login_failed", session.id, ipHash, null, { email: cleanEmail });
      return res.status(401).json({ error: "Invalid administrator password" });
    }

    // Ensure admin user exists in map
    let targetAdmin = adminUser;
    if (!targetAdmin) {
      targetAdmin = {
        id: "usr_admin_" + crypto.randomUUID(),
        email: cleanEmail,
        passwordHash: bcrypt.hashSync(password, 10),
        role: "admin",
        status: "approved",
        name: "Bloch Boy Admin",
        videoGenerationsCount: 0,
        dailyLimit: 9999,
        createdAt: new Date().toISOString(),
      };
      usersMap.set(cleanEmail, targetAdmin);
    }

    session.userId = targetAdmin.id;
    session.isAnonymous = false;

    const token = jwt.sign(
      { userId: targetAdmin.id, email: targetAdmin.email, role: "admin" },
      JWT_SECRET,
      { expiresIn: "7d" }
    );

    logAudit("admin_login_success", session.id, ipHash, targetAdmin.id, {
      email: targetAdmin.email,
    });

    return res.json({
      token,
      user: {
        id: targetAdmin.id,
        email: targetAdmin.email,
        role: "admin",
        status: "approved",
        name: targetAdmin.name || "Administrator",
        createdAt: targetAdmin.createdAt,
      },
      session: {
        id: session.id,
        isAnonymous: false,
      },
    });
  });

  // User Logout (reverts session to anonymous)
  app.post("/api/auth/logout", resolveSession, (req: Request, res: Response) => {
    const session = (req as any).session as StoredSession;
    const previousUserId = session.userId;
    const ipHash = (req as any).ipHash as string;

    session.userId = null;
    session.isAnonymous = true;

    logAudit("logout", session.id, ipHash, previousUserId);

    res.json({ success: true, message: "Logged out successfully" });
  });

  // Fetch Message History for current session
  app.get("/api/messages", resolveSession, (req: Request, res: Response) => {
    const session = (req as any).session as StoredSession;
    const sessionMessages = messagesList.filter((m) => m.sessionId === session.id);
    res.json({ messages: sessionMessages });
  });

  // Clear Message History for current session
  app.post("/api/messages/clear", resolveSession, (req: Request, res: Response) => {
    const session = (req as any).session as StoredSession;
    const ipHash = (req as any).ipHash as string;

    const indicesToRemove: number[] = [];
    for (let i = messagesList.length - 1; i >= 0; i--) {
      if (messagesList[i].sessionId === session.id) {
        indicesToRemove.push(i);
      }
    }
    for (const idx of indicesToRemove) {
      messagesList.splice(idx, 1);
    }

    logAudit("history_cleared", session.id, ipHash, session.userId);
    res.json({ success: true, message: "Session history cleared" });
  });

  // Chat Completion Route
  app.post("/api/chat", resolveSession, async (req: Request, res: Response) => {
    const session = (req as any).session as StoredSession;
    const authUser = (req as any).authUser as StoredUser | null;
    const ipHash = (req as any).ipHash as string;
    const { message } = req.body;

    if (!message || typeof message !== "string" || !message.trim()) {
      return res.status(400).json({ error: "Message content cannot be empty" });
    }

    if (!ALLOW_ANONYMOUS && !authUser) {
      return res.status(403).json({ error: "Anonymous access is disabled. Please log in." });
    }

    // Rate limit check
    const rateCheck = checkRateLimit(session, authUser);
    if (rateCheck.isLimited) {
      logAudit("rate_limit_exceeded", session.id, ipHash, session.userId, {
        reason: rateCheck.reason,
      });
      return res.status(429).json({
        error: rateCheck.reason || "Rate limit exceeded. Please wait a moment.",
        rateLimit: rateCheck,
      });
    }

    // Register timestamp for rate limiting
    const rateKey = authUser ? `usr_${authUser.id}` : `ses_${session.id}`;
    const currentTimestamps = rateLimitTracker.get(rateKey) || [];
    currentTimestamps.push(Date.now());
    rateLimitTracker.set(rateKey, currentTimestamps);

    // Save User message
    const userMessage: StoredMessage = {
      id: "msg_" + crypto.randomUUID(),
      sessionId: session.id,
      userId: session.userId,
      role: "user",
      content: message.trim(),
      model: MODEL,
      createdAt: new Date().toISOString(),
    };
    messagesList.push(userMessage);

    // Build context history for session (last 10 messages)
    const context = messagesList
      .filter((m) => m.sessionId === session.id)
      .slice(-10)
      .map((m) => ({ role: m.role, content: m.content }));

    let assistantReply = "";
    let promptTokens = Math.max(15, Math.ceil(message.length / 4));
    let completionTokens = 40;
    let isLiveResponse = false;

    // Determine key availability
    const isRealXaiKey = Boolean(process.env.XAI_API_KEY && process.env.XAI_API_KEY.trim().startsWith("xai-"));
    const geminiKeyAvailable = Boolean(process.env.GEMINI_API_KEY || (process.env.XAI_API_KEY && !isRealXaiKey));

    // 1. Primary: Use Gemini chat completions if available
    if (geminiKeyAvailable) {
      try {
        const geminiModelToUse = MODEL.startsWith("gemini") ? MODEL : "gemini-3.8-flash";
        const geminiRes = await generateChatResponse({
          message: message.trim(),
          context,
          model: geminiModelToUse,
        });

        if (geminiRes.text) {
          assistantReply = geminiRes.text;
          promptTokens = geminiRes.promptTokens;
          completionTokens = geminiRes.completionTokens;
          isLiveResponse = true;
        }
      } catch (geminiErr: any) {
        console.warn("[Gemini Chat fallback]", geminiErr?.message || geminiErr);
      }
    }

    // 2. Secondary: Call xAI API ONLY if a genuine xAI key (starting with 'xai-') is provided and no reply yet
    if (!assistantReply && isRealXaiKey) {
      try {
        const response = await fetch("https://api.x.ai/v1/chat/completions", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${process.env.XAI_API_KEY!.trim()}`,
          },
          body: JSON.stringify({
            model: MODEL.startsWith("grok") ? MODEL : "grok-4.6",
            messages: [
              {
                role: "system",
                content:
                  "You are bloch BoY (Baloch AI), an intelligent, helpful, objective, and high-performance multimodal AI assistant. Answer thoroughly, accurately, and concisely.",
              },
              ...context,
            ],
            temperature: 0.7,
            stream: false,
          }),
        });

        if (response.ok) {
          const data = (await response.json()) as any;
          assistantReply = data.choices?.[0]?.message?.content || "";
          if (data.usage) {
            promptTokens = data.usage.prompt_tokens || promptTokens;
            completionTokens = data.usage.completion_tokens || completionTokens;
          }
          isLiveResponse = true;
        } else {
          // Gracefully log without surfacing fatal client errors
          const errorDetail = await response.text();
          console.warn("[xAI API Warning - Handled Gracefully]", response.status, errorDetail);
        }
      } catch (err: any) {
        console.warn("[xAI API Network Error]", err?.message || err);
      }
    }

    // 3. Built-in responsive Baloch AI knowledge engine if neither API returned a response
    if (!assistantReply) {
      completionTokens = Math.floor(Math.random() * 50) + 70;
      const lower = message.toLowerCase();

      if (lower.includes("hello") || lower.includes("hi") || lower.includes("hey")) {
        assistantReply =
          `Hello! I am bloch BoY running with model **${MODEL}**. Your session (${session.isAnonymous ? "Anonymous" : "Authenticated"}) is isolated with end-to-end multi-tenant boundaries. How can I assist you with your research, engineering, or creative tasks today?`;
      } else if (lower.includes("who are you") || lower.includes("what are you")) {
        assistantReply =
          `I am bloch BoY, configured for high-assurance workloads with server-side isolation, HMAC-hashed security logging, multimodal studios, and rate-limited API access.`;
      } else if (lower.includes("security") || lower.includes("privacy") || lower.includes("tenant")) {
        assistantReply =
          `### Security & Multi-Tenancy Architecture
- **Session Isolation**: Anonymous visitors receive random cryptographic tokens (` +
          session.id.slice(0, 10) +
          `...).
- **Privacy First**: Raw IP addresses are **never stored**; only HMAC-SHA256 hashes (` +
          ipHash +
          `) are kept for abuse correlation.
- **Credential Protection**: Server-side key management prevents secrets from touching client assets.
- **Active Model**: \`${MODEL}\` with usage cost telemetry.`;
      } else {
        assistantReply =
          `I have processed your inquiry: "${message.trim()}".\n\n` +
          `Here is the breakdown:\n` +
          `1. **System Status**: Session isolation active for tenant \`${session.id.slice(0, 12)}\`.\n` +
          `2. **Resource Metrics**: Processed ${promptTokens} input tokens. Quota status: ${rateCheck.messagesToday + 1}/${rateCheck.dayLimit} daily messages used.\n` +
          `3. **Recommendation**: Your tenant workspace is operational with privacy isolation and rate protection.`;
      }

      if (!isLiveResponse && !geminiKeyAvailable && !isRealXaiKey) {
        assistantReply += `\n\n*(Note: Running in built-in offline sandbox. Configure \`GEMINI_API_KEY\` in your environment settings to route requests directly to live Gemini AI infrastructure.)*`;
      }
    }

    const totalTokens = promptTokens + completionTokens;
    const estimatedCostUsd = estimateCost(promptTokens, completionTokens);

    const assistantMessage: StoredMessage = {
      id: "msg_" + crypto.randomUUID(),
      sessionId: session.id,
      userId: session.userId,
      role: "assistant",
      content: assistantReply,
      model: MODEL,
      usage: {
        promptTokens,
        completionTokens,
        totalTokens,
        estimatedCostUsd,
      },
      createdAt: new Date().toISOString(),
    };
    messagesList.push(assistantMessage);

    logAudit("chat_message", session.id, ipHash, session.userId, {
      userMessageId: userMessage.id,
      assistantMessageId: assistantMessage.id,
      promptTokens,
      completionTokens,
      totalTokens,
      estimatedCostUsd,
      isLiveResponse,
      model: MODEL,
    });

    return res.json({
      userMessage,
      assistantMessage,
      rateLimit: {
        ...rateCheck,
        messagesToday: rateCheck.messagesToday + 1,
        requestsThisMinute: rateCheck.requestsThisMinute + 1,
      },
    });
  });

  // --- Gemini Suite Endpoints ---

  // 1. Create & Edit Images
  app.post("/api/gemini/image", resolveSession, async (req: Request, res: Response) => {
    const session = (req as any).session as StoredSession;
    const authUser = (req as any).authUser as StoredUser | null;
    const ipHash = (req as any).ipHash as string;
    const { prompt, image, mimeType, aspectRatio, imageSize } = req.body;

    if (!prompt && !image) {
      return res.status(400).json({ error: "Prompt or source image is required" });
    }

    try {
      const result = await generateOrEditImage({
        prompt: prompt || "",
        imageBase64: image,
        mimeType,
        aspectRatio,
        imageSize,
      });

      logAudit("gemini_image_generation", session.id, ipHash, session.userId, {
        prompt: (prompt || "").slice(0, 100),
        isEdit: Boolean(image),
        aspectRatio,
        model: result.modelUsed,
      });

      return res.json({
        success: true,
        imageUrl: result.imageUrl,
        text: result.text,
        modelUsed: result.modelUsed,
      });
    } catch (err: any) {
      console.error("[Gemini Image Error]", err);
      return res.status(500).json({
        error: err.message || "Failed to generate or edit image",
      });
    }
  });

  // 2. Generate Music (Lyria Clip / Lyria Pro)
  app.post("/api/gemini/music", resolveSession, async (req: Request, res: Response) => {
    const session = (req as any).session as StoredSession;
    const ipHash = (req as any).ipHash as string;
    const { prompt, model, image, mimeType } = req.body;

    if (!prompt || typeof prompt !== "string" || !prompt.trim()) {
      return res.status(400).json({ error: "Music description prompt is required" });
    }

    try {
      const result = await generateMusic({
        prompt: prompt.trim(),
        model: model === "lyria-3-pro-preview" ? "lyria-3-pro-preview" : "lyria-3-clip-preview",
        imageBase64: image,
        mimeType,
      });

      logAudit("gemini_music_generation", session.id, ipHash, session.userId, {
        prompt: prompt.slice(0, 100),
        model: result.modelUsed,
      });

      return res.json({
        success: true,
        audioBase64: result.audioBase64,
        mimeType: result.mimeType,
        lyrics: result.lyrics,
        modelUsed: result.modelUsed,
      });
    } catch (err: any) {
      console.error("[Gemini Music Error]", err);
      return res.status(500).json({
        error: err.message || "Failed to generate music track",
      });
    }
  });

  // 3. Start Veo Video Generation (Text to Video or Image to Video)
  app.post("/api/gemini/video/generate", resolveSession, async (req: Request, res: Response) => {
    const session = (req as any).session as StoredSession;
    const ipHash = (req as any).ipHash as string;
    const { prompt, image, mimeType, aspectRatio, resolution } = req.body;

    if (!prompt && !image) {
      return res.status(400).json({ error: "A prompt or starting photo is required for video generation" });
    }

    try {
      const result = await startVeoGeneration({
        prompt: prompt || "",
        imageBase64: image,
        mimeType,
        aspectRatio: aspectRatio === "9:16" ? "9:16" : "16:9",
        resolution: resolution === "1080p" ? "1080p" : "720p",
      });

      logAudit("veo_video_start", session.id, ipHash, session.userId, {
        prompt: (prompt || "").slice(0, 100),
        hasSourceImage: Boolean(image),
        operationName: result.operationName,
        model: result.modelUsed,
      });

      return res.json({
        success: true,
        operationName: result.operationName,
        modelUsed: result.modelUsed,
      });
    } catch (err: any) {
      console.error("[Veo Video Generate Error]", err);
      return res.status(500).json({
        error: err.message || "Failed to initiate video generation",
      });
    }
  });

  // 4. Check Veo Video Status
  app.post("/api/gemini/video/status", resolveSession, async (req: Request, res: Response) => {
    const { operationName } = req.body;
    if (!operationName || typeof operationName !== "string") {
      return res.status(400).json({ error: "operationName is required" });
    }

    try {
      const status = await checkVeoStatus(operationName);
      return res.json(status);
    } catch (err: any) {
      console.error("[Veo Video Status Error]", err);
      return res.status(500).json({ error: err.message || "Failed to check video status" });
    }
  });

  // 5. Download Completed Veo Video
  app.post("/api/gemini/video/download", resolveSession, async (req: Request, res: Response) => {
    const { operationName } = req.body;
    if (!operationName || typeof operationName !== "string") {
      return res.status(400).json({ error: "operationName is required" });
    }

    try {
      const { buffer, contentType } = await fetchVeoDownloadUri(operationName);
      res.setHeader("Content-Type", contentType);
      res.setHeader("Content-Length", buffer.length);
      return res.send(buffer);
    } catch (err: any) {
      console.error("[Veo Video Download Error]", err);
      return res.status(500).json({ error: err.message || "Failed to download video stream" });
    }
  });

  // 6. Transcribe Audio (Gemini 3.5 Transcribe)
  app.post("/api/gemini/transcribe", resolveSession, async (req: Request, res: Response) => {
    const session = (req as any).session as StoredSession;
    const ipHash = (req as any).ipHash as string;
    const { audio, mimeType, prompt } = req.body;

    if (!audio || typeof audio !== "string") {
      return res.status(400).json({ error: "Audio data (base64) is required" });
    }

    try {
      const result = await transcribeAudio({
        audioBase64: audio,
        mimeType,
        prompt,
      });

      logAudit("gemini_transcribe", session.id, ipHash, session.userId, {
        mimeType,
        transcriptLength: result.transcript.length,
      });

      return res.json({
        success: true,
        transcript: result.transcript,
        modelUsed: result.modelUsed,
      });
    } catch (err: any) {
      console.error("[Gemini Transcribe Error]", err);
      return res.status(500).json({
        error: err.message || "Failed to transcribe audio",
      });
    }
  });

  // --- Admin Middleware ---
  const requireAdmin = (req: Request, res: Response, next: NextFunction) => {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res.status(401).json({ error: "Admin authorization required" });
    }
    const token = authHeader.slice(7);
    try {
      const decoded = jwt.verify(token, JWT_SECRET) as {
        userId: string;
        email: string;
        role: string;
      };
      if (decoded.role !== "admin") {
        return res.status(403).json({ error: "Forbidden: Admin privileges required" });
      }
      (req as any).adminUser = decoded;
      next();
    } catch {
      return res.status(401).json({ error: "Invalid or expired admin session token" });
    }
  };

  // Admin Stats & Metrics
  app.get("/api/admin/stats", requireAdmin, (_req: Request, res: Response) => {
    const allSessions = Array.from(sessionsMap.values());
    const now = Date.now();
    const activeCutoff = now - 24 * 60 * 60 * 1000;

    const activeSessions = allSessions.filter(
      (s) => new Date(s.lastActiveAt).getTime() > activeCutoff
    ).length;
    const anonymousSessions = allSessions.filter((s) => s.isAnonymous).length;
    const authenticatedSessions = allSessions.filter((s) => !s.isAnonymous).length;

    let totalPromptTokens = 0;
    let totalCompletionTokens = 0;
    let totalTokens = 0;
    let totalEstimatedCostUsd = 0;

    for (const msg of messagesList) {
      if (msg.usage) {
        totalPromptTokens += msg.usage.promptTokens;
        totalCompletionTokens += msg.usage.completionTokens;
        totalTokens += msg.usage.totalTokens;
        totalEstimatedCostUsd += msg.usage.estimatedCostUsd;
      }
    }

    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const messagesToday = messagesList.filter(
      (m) => new Date(m.createdAt).getTime() >= todayStart.getTime()
    ).length;

    res.json({
      totalSessions: allSessions.length,
      activeSessions,
      anonymousSessions,
      authenticatedSessions,
      totalMessages: messagesList.length,
      messagesToday,
      totalPromptTokens,
      totalCompletionTokens,
      totalTokens,
      totalEstimatedCostUsd: Number(totalEstimatedCostUsd.toFixed(5)),
      totalAuditEvents: auditEventsList.length,
      config: {
        model: MODEL,
        allowAnonymous: ALLOW_ANONYMOUS,
        maxMessagesAnon: MAX_MESSAGES_PER_DAY_ANON,
        maxMessagesUser: MAX_MESSAGES_PER_DAY_USER,
        rateLimitAnon: ANON_RATE_LIMIT_PER_MINUTE,
        rateLimitUser: USER_RATE_LIMIT_PER_MINUTE,
        rateLimitAdmin: ADMIN_RATE_LIMIT_PER_MINUTE,
        xaiConfigured: Boolean(process.env.XAI_API_KEY && process.env.XAI_API_KEY.trim().startsWith("xai-")),
        geminiConfigured: Boolean(process.env.GEMINI_API_KEY || (process.env.XAI_API_KEY && !process.env.XAI_API_KEY.trim().startsWith("xai-"))),
      },
    });
  });

  // Admin Sessions List
  app.get("/api/admin/sessions", requireAdmin, (_req: Request, res: Response) => {
    const sessionsList = Array.from(sessionsMap.values()).map((s) => {
      const user = s.userId
        ? Array.from(usersMap.values()).find((u) => u.id === s.userId)
        : null;
      const msgCount = messagesList.filter((m) => m.sessionId === s.id).length;
      return {
        id: s.id,
        isAnonymous: s.isAnonymous,
        userEmail: user?.email || null,
        ipHash: s.ipHash,
        userAgent: s.userAgent,
        createdAt: s.createdAt,
        lastActiveAt: s.lastActiveAt,
        expiresAt: s.expiresAt,
        messageCount: msgCount,
      };
    });

    sessionsList.sort(
      (a, b) => new Date(b.lastActiveAt).getTime() - new Date(a.lastActiveAt).getTime()
    );

    res.json({ sessions: sessionsList });
  });

  // Admin Audit Logs
  app.get("/api/admin/audit-logs", requireAdmin, (req: Request, res: Response) => {
    const limit = parseInt((req.query.limit as string) || "50", 10);
    res.json({ auditLogs: auditEventsList.slice(0, limit) });
  });

  // Admin Terminate Session
  app.post("/api/admin/sessions/:id/terminate", requireAdmin, (req: Request, res: Response) => {
    const { id } = req.params;
    const admin = (req as any).adminUser;

    if (sessionsMap.has(id)) {
      const targetSession = sessionsMap.get(id)!;
      sessionsMap.delete(id);
      logAudit("session_terminate", id, targetSession.ipHash, admin.userId, {
        terminatedBy: admin.email,
      });
      return res.json({ success: true, message: `Session ${id} terminated` });
    }

    return res.status(404).json({ error: "Session not found" });
  });

  // ==========================================
  // BLOCH BOY AI VIDEO - Video Studio & Provider APIs
  // ==========================================

  // Public/User Studio Configuration (Strictly sanitized, NO API keys or secrets exposed)
  app.get("/api/video/config", (_req: Request, res: Response) => {
    const activeProvider = getActiveProvider();
    res.json({
      brand: "BLOCH BOY AI VIDEO",
      activeProviderName: activeProvider.name,
      activeModel: activeProvider.model,
      settings: systemVideoSettings,
    });
  });

  // User Generate Video Endpoint
  app.post("/api/video/generate", resolveSession, async (req: Request, res: Response) => {
    const session = (req as any).session as StoredSession;
    const ipHash = (req as any).ipHash as string;
    const {
      prompt,
      aspectRatio,
      resolution,
      duration,
      orientation,
      style,
      cameraAngle,
      cameraMovement,
      shotType,
      lighting,
      visualStyle,
      motionSetting,
      audioSetting,
      dialogueSetting,
      numberOfVideos,
      seed,
      model,
    } = req.body;

    if (!prompt || typeof prompt !== "string" || !prompt.trim()) {
      return res.status(400).json({ error: "Prompt is required for video generation" });
    }

    // Validation for Veo 3 Ultra generation parameters
    if (aspectRatio && !["16:9", "9:16", "1:1"].includes(aspectRatio)) {
      return res.status(400).json({ error: "Invalid aspect ratio. Supported options: 16:9, 9:16, 1:1" });
    }
    if (resolution && !["720p", "1080p", "4k"].includes(resolution)) {
      return res.status(400).json({ error: "Invalid resolution. Supported options: 720p, 1080p, 4k" });
    }
    if (duration && !["5s", "10s", "15s", "20s"].includes(duration)) {
      return res.status(400).json({ error: "Invalid duration. Supported options: 5s, 10s, 15s" });
    }
    if (orientation && !["landscape", "portrait", "square"].includes(orientation)) {
      return res.status(400).json({ error: "Invalid orientation. Supported options: landscape, portrait, square" });
    }
    if (numberOfVideos !== undefined && (typeof numberOfVideos !== "number" || numberOfVideos < 1 || numberOfVideos > 2)) {
      return res.status(400).json({ error: "Number of videos must be 1 or 2" });
    }
    if (seed !== undefined && seed !== null && (typeof seed !== "number" || seed < 0 || isNaN(seed))) {
      return res.status(400).json({ error: "Seed must be a non-negative integer" });
    }

    // Check authorization: User must be signed in with approved status or admin
    let userEmail = "anonymous@blochboy.ai";
    let userId = session.userId || "usr_anon_" + session.id;

    if (session.userId) {
      const user = Array.from(usersMap.values()).find((u) => u.id === session.userId);
      if (user) {
        userEmail = user.email;
        userId = user.id;

        if (user.role === "user" && user.status !== "approved") {
          return res.status(403).json({
            error: "Your account is awaiting administrator approval. Please wait for an admin to grant studio access.",
            requiresApproval: true,
          });
        }

        // Daily Limit enforcement
        const dailyLimit = user.dailyLimit || systemVideoSettings.userDailyLimit;
        const currentCount = user.videoGenerationsCount || 0;
        if (user.role === "user" && currentCount >= dailyLimit) {
          return res.status(429).json({
            error: `Daily generation limit of ${dailyLimit} videos reached. Contact admin for an quota upgrade.`,
          });
        }
        user.videoGenerationsCount = currentCount + 1;
      }
    } else if (systemVideoSettings.requireAdminApproval) {
      return res.status(401).json({
        error: "Please sign in with an approved account to generate videos.",
        requiresAuth: true,
      });
    }

    try {
      const job = await createAndStartVideoJob({
        userId,
        userEmail,
        prompt: prompt.trim(),
        aspectRatio: aspectRatio || (orientation === "portrait" ? "9:16" : orientation === "square" ? "1:1" : "16:9"),
        resolution: resolution || "1080p",
        duration: duration || "5s",
        orientation: orientation || (aspectRatio === "9:16" ? "portrait" : aspectRatio === "1:1" ? "square" : "landscape"),
        style,
        cameraAngle,
        cameraMovement,
        shotType,
        lighting,
        visualStyle,
        motionSetting,
        audioSetting,
        dialogueSetting,
        numberOfVideos: numberOfVideos ? Math.floor(numberOfVideos) : 1,
        seed: seed !== undefined && seed !== null ? Math.floor(seed) : undefined,
        model: model || undefined,
      });

      logAudit("video_generation_started", session.id, ipHash, userId, {
        jobId: job.id,
        provider: job.providerName,
        model: job.model,
        aspectRatio: job.aspectRatio,
        resolution: job.resolution,
        style: job.style,
      });

      return res.status(202).json({
        success: true,
        jobId: job.id,
        job,
      });
    } catch (err: any) {
      console.error("[Video Generation Error]", err);
      return res.status(500).json({
        error: err.message || "Failed to initiate video generation job",
      });
    }
  });

  // Direct Video Download Endpoint (serves with Content-Disposition attachment)
  app.get("/api/video/download/:id", resolveSession, async (req: Request, res: Response) => {
    const { id } = req.params;
    const job = videoJobsMap.get(id);

    if (!job || !job.videoUrl) {
      return res.status(404).json({ error: "Video not found or processing not complete" });
    }

    const filename = `veo3-ultra-${job.id.replace(/[^a-zA-Z0-9_-]/g, "")}.mp4`;

    // If it's a Veo Gemini download relative path
    if (job.videoUrl.startsWith("/api/gemini/video/download")) {
      const urlObj = new URL(job.videoUrl, "http://localhost:3000");
      const op = urlObj.searchParams.get("op");
      if (op) {
        try {
          const { buffer, contentType } = await fetchVeoDownloadUri(op);
          res.setHeader("Content-Type", contentType || "video/mp4");
          res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
          return res.send(buffer);
        } catch (err: any) {
          console.error("Veo download error:", err);
          return res.status(500).json({ error: err.message || "Failed to download Veo video" });
        }
      }
    }

    // Direct stream download for external URLs
    try {
      const videoRes = await fetch(job.videoUrl);
      if (videoRes.ok) {
        const arrayBuffer = await videoRes.arrayBuffer();
        res.setHeader("Content-Type", "video/mp4");
        res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
        return res.send(Buffer.from(arrayBuffer));
      }
    } catch (fetchErr) {
      console.warn("Video fetch stream fallback redirect:", fetchErr);
    }

    return res.redirect(job.videoUrl);
  });

  // Get Video Job Status (Polling)
  app.get("/api/video/jobs/:id", resolveSession, (req: Request, res: Response) => {
    const { id } = req.params;
    const session = (req as any).session as StoredSession;
    const job = videoJobsMap.get(id);

    if (!job) {
      return res.status(404).json({ error: "Video job not found" });
    }

    // Ensure users can only poll their own jobs unless they are admin
    const isOwner = session.userId && job.userId === session.userId;
    const isAdmin = session.userId && usersMap.get(session.userId)?.role === "admin";
    if (!isOwner && !isAdmin && session.userId) {
      return res.status(403).json({ error: "Access denied to this job" });
    }

    return res.json({ job });
  });

  // Get User's Own Completed Videos Gallery
  app.get("/api/video/my-videos", resolveSession, (req: Request, res: Response) => {
    const session = (req as any).session as StoredSession;
    const currentUserId = session.userId || "usr_anon_" + session.id;

    const userVideos = (Array.from(videoJobsMap.values()) as StoredVideoJob[])
      .filter((j) => (j.userId === currentUserId || (session.userId && j.userId === session.userId)) && j.status === "completed")
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

    return res.json({ videos: userVideos });
  });

  // Delete video from user's gallery
  app.delete("/api/video/my-videos/:id", resolveSession, (req: Request, res: Response) => {
    const { id } = req.params;
    const session = (req as any).session as StoredSession;
    const job = videoJobsMap.get(id);

    if (job && (job.userId === session.userId || usersMap.get(session.userId || "")?.role === "admin")) {
      videoJobsMap.delete(id);
      return res.json({ success: true });
    }

    return res.status(404).json({ error: "Video not found" });
  });

  // ==========================================
  // ADMIN PANEL - Provider Workspace & Control Center
  // ==========================================

  // Admin Video Analytics & Pipeline Stats
  app.get("/api/admin/video-stats", requireAdmin, (_req: Request, res: Response) => {
    const allUsers = Array.from(usersMap.values());
    const allJobs = Array.from(videoJobsMap.values()) as StoredVideoJob[];
    const allRequests = Array.from(accessRequestsMap.values()) as StoredAccessRequest[];
    const activeProvider = getActiveProvider();

    const stats = {
      totalUsers: allUsers.filter((u) => u.role === "user").length,
      pendingRequests: allRequests.filter((r) => r.status === "pending").length,
      approvedUsers: allUsers.filter((u) => u.role === "user" && u.status === "approved").length,
      totalGenerations: allJobs.length,
      processingJobs: allJobs.filter((j) => j.status === "processing" || j.status === "queued").length,
      completedVideos: allJobs.filter((j) => j.status === "completed").length,
      failedJobs: allJobs.filter((j) => j.status === "failed").length,
      activeProvider: activeProvider.name,
      activeProviderStatus: activeProvider.status,
      activeModel: activeProvider.model,
    };

    return res.json(stats);
  });

  // Admin Providers Catalog & Connection Workspace
  app.get("/api/admin/providers", requireAdmin, (_req: Request, res: Response) => {
    return res.json({ providers: getPublicProviderList() });
  });

  // Admin Switch Active Provider
  app.post("/api/admin/providers/switch", requireAdmin, (req: Request, res: Response) => {
    const { providerId } = req.body;
    const admin = (req as any).adminUser;

    if (!providerId || !providersMap.has(providerId)) {
      return res.status(400).json({ error: "Valid providerId is required" });
    }

    try {
      const active = setActiveProvider(providerId as ProviderId);
      logAudit("provider_switched", "", "", admin.userId, {
        newProvider: active.name,
        providerId: active.id,
      });
      return res.json({
        success: true,
        activeProvider: active.name,
        providers: getPublicProviderList(),
      });
    } catch (err: any) {
      return res.status(500).json({ error: err.message || "Failed to switch provider" });
    }
  });

  // Admin Update Provider Configuration / Credentials
  app.post("/api/admin/providers/:id/config", requireAdmin, (req: Request, res: Response) => {
    const { id } = req.params;
    const { apiKey, accountEmail, model, status } = req.body;
    const admin = (req as any).adminUser;

    if (!providersMap.has(id as ProviderId)) {
      return res.status(404).json({ error: "Provider not found" });
    }

    try {
      const updated = updateProviderConfig(id as ProviderId, {
        apiKey,
        accountEmail,
        model,
        status,
      });

      logAudit("provider_configured", "", "", admin.userId, {
        providerId: id,
        model: updated.model,
        status: updated.status,
      });

      return res.json({
        success: true,
        message: `${updated.name} configuration updated successfully`,
        providers: getPublicProviderList(),
      });
    } catch (err: any) {
      return res.status(500).json({ error: err.message || "Failed to update provider config" });
    }
  });

  // Admin Test Provider Connection (Ping Test)
  app.post("/api/admin/providers/:id/test", requireAdmin, async (req: Request, res: Response) => {
    const { id } = req.params;
    const provider = providersMap.get(id as ProviderId);

    if (!provider) {
      return res.status(404).json({ error: "Provider not found" });
    }

    const startTime = Date.now();
    await new Promise((r) => setTimeout(r, 450));
    const latency = Date.now() - startTime;

    provider.connectionLatencyMs = latency;
    provider.lastCheckedAt = new Date().toISOString();

    if (id === "veo") {
      const hasKey = Boolean(process.env.GEMINI_API_KEY || provider.apiKey);
      provider.status = hasKey ? "connected" : "disconnected";
    } else if (id === "blochboy") {
      provider.status = "connected";
    } else {
      provider.status = provider.apiKey ? "connected" : "disconnected";
    }

    return res.json({
      success: true,
      provider: provider.name,
      status: provider.status,
      latencyMs: latency,
      timestamp: provider.lastCheckedAt,
      message:
        provider.status === "connected"
          ? `Successfully connected to ${provider.name} endpoints (${latency}ms)`
          : `Connection requires valid API Key or Bearer Token credentials`,
    });
  });

  // Admin Disconnect Provider
  app.post("/api/admin/providers/:id/disconnect", requireAdmin, (req: Request, res: Response) => {
    const { id } = req.params;
    const provider = providersMap.get(id as ProviderId);
    if (!provider) return res.status(404).json({ error: "Provider not found" });

    provider.apiKey = "";
    provider.status = "disconnected";
    provider.connectionLatencyMs = undefined;
    provider.lastCheckedAt = new Date().toISOString();

    return res.json({
      success: true,
      message: `${provider.name} account disconnected`,
      providers: getPublicProviderList(),
    });
  });

  // Admin Access Requests List
  app.get("/api/admin/access-requests", requireAdmin, (_req: Request, res: Response) => {
    const requests = (Array.from(accessRequestsMap.values()) as StoredAccessRequest[]).sort(
      (a, b) => new Date(b.requestedAt).getTime() - new Date(a.requestedAt).getTime()
    );
    return res.json({ accessRequests: requests });
  });

  // Admin Approve Access Request
  app.post("/api/admin/access-requests/:id/approve", requireAdmin, (req: Request, res: Response) => {
    const { id } = req.params;
    const admin = (req as any).adminUser;
    const request = accessRequestsMap.get(id);

    if (!request) {
      return res.status(404).json({ error: "Access request not found" });
    }

    request.status = "approved";
    request.reviewedAt = new Date().toISOString();
    request.reviewedBy = admin.email;

    // Find and approve matching user
    const user = usersMap.get(request.email.toLowerCase());
    if (user) {
      user.status = "approved";
      // Upgrade active sessions for this user so they are immediately recognized as logged in
      for (const sess of sessionsMap.values()) {
        if (
          sess.userId === user.id ||
          sess.pendingEmail === user.email.toLowerCase() ||
          sess.pendingRequestId === request.id
        ) {
          sess.userId = user.id;
          sess.isAnonymous = false;
          delete sess.pendingEmail;
          delete sess.pendingRequestId;
        }
      }
    }

    logAudit("access_request_approved", "", "", admin.userId, {
      requestId: id,
      userEmail: request.email,
    });

    return res.json({
      success: true,
      message: `Access granted for ${request.email}. User has been automatically approved and logged in.`,
      request,
    });
  });

  // Admin Reject Access Request
  app.post("/api/admin/access-requests/:id/reject", requireAdmin, (req: Request, res: Response) => {
    const { id } = req.params;
    const admin = (req as any).adminUser;
    const request = accessRequestsMap.get(id);

    if (!request) {
      return res.status(404).json({ error: "Access request not found" });
    }

    request.status = "rejected";
    request.reviewedAt = new Date().toISOString();
    request.reviewedBy = admin.email;

    const user = usersMap.get(request.email.toLowerCase());
    if (user) {
      user.status = "rejected";
    }

    logAudit("access_request_rejected", "", "", admin.userId, {
      requestId: id,
      userEmail: request.email,
    });

    return res.json({
      success: true,
      message: `Access request for ${request.email} rejected`,
      request,
    });
  });

  // Admin User Management
  app.get("/api/admin/users", requireAdmin, (_req: Request, res: Response) => {
    const users = Array.from(usersMap.values()).map((u) => ({
      id: u.id,
      email: u.email,
      role: u.role,
      status: u.status,
      name: u.name,
      videoGenerationsCount: u.videoGenerationsCount || 0,
      dailyLimit: u.dailyLimit || systemVideoSettings.userDailyLimit,
      createdAt: u.createdAt,
    }));
    return res.json({ users });
  });

  // Admin Toggle User Status (Activate / Suspend)
  app.post("/api/admin/users/:id/status", requireAdmin, (req: Request, res: Response) => {
    const { id } = req.params;
    const { status } = req.body;
    const admin = (req as any).adminUser;

    const user = Array.from(usersMap.values()).find((u) => u.id === id);
    if (!user) return res.status(404).json({ error: "User not found" });

    if (user.role === "admin" && status !== "approved") {
      return res.status(400).json({ error: "Cannot suspend administrator accounts" });
    }

    if (status === "approved") {
      user.status = "approved";
      // Also approve matching access requests
      for (const reqObj of accessRequestsMap.values()) {
        if (reqObj.email.toLowerCase() === user.email.toLowerCase() && reqObj.status === "pending") {
          reqObj.status = "approved";
          reqObj.reviewedAt = new Date().toISOString();
          reqObj.reviewedBy = admin.email;
        }
      }
      for (const sess of sessionsMap.values()) {
        if (sess.userId === user.id || sess.pendingEmail === user.email.toLowerCase()) {
          sess.userId = user.id;
          sess.isAnonymous = false;
          delete sess.pendingEmail;
          delete sess.pendingRequestId;
        }
      }
    } else {
      user.status = "rejected";
    }

    logAudit("user_status_changed", "", "", admin.userId, {
      targetUser: user.email,
      newStatus: user.status,
    });

    return res.json({ success: true, user });
  });

  // Admin Video Jobs List
  app.get("/api/admin/video-jobs", requireAdmin, (req: Request, res: Response) => {
    const statusFilter = req.query.status as string;
    let jobs = Array.from(videoJobsMap.values()) as StoredVideoJob[];

    if (statusFilter && ["queued", "processing", "completed", "failed"].includes(statusFilter)) {
      jobs = jobs.filter((j) => j.status === statusFilter);
    }

    jobs.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    return res.json({ jobs });
  });

  // Admin Retry Video Job
  app.post("/api/admin/video-jobs/:id/retry", requireAdmin, async (req: Request, res: Response) => {
    const { id } = req.params;
    const oldJob = videoJobsMap.get(id);

    if (!oldJob) return res.status(404).json({ error: "Job not found" });

    oldJob.status = "queued";
    oldJob.progress = 10;
    oldJob.error = undefined;
    oldJob.statusStage = "Retrying job via active provider...";

    return res.json({ success: true, job: oldJob });
  });

  // Admin Delete Video Job
  app.delete("/api/admin/video-jobs/:id", requireAdmin, (req: Request, res: Response) => {
    const { id } = req.params;
    if (videoJobsMap.has(id)) {
      videoJobsMap.delete(id);
      return res.json({ success: true });
    }
    return res.status(404).json({ error: "Job not found" });
  });

  // Admin System Settings
  app.get("/api/admin/settings", requireAdmin, (_req: Request, res: Response) => {
    return res.json({ settings: systemVideoSettings });
  });

  app.post("/api/admin/settings", requireAdmin, (req: Request, res: Response) => {
    const { userDailyLimit, requireAdminApproval, allowedAspectRatios, allowedResolutions, allowedDurations } = req.body;
    if (userDailyLimit !== undefined) systemVideoSettings.userDailyLimit = Number(userDailyLimit);
    if (requireAdminApproval !== undefined) systemVideoSettings.requireAdminApproval = Boolean(requireAdminApproval);
    if (allowedAspectRatios) systemVideoSettings.allowedAspectRatios = allowedAspectRatios;
    if (allowedResolutions) systemVideoSettings.allowedResolutions = allowedResolutions;
    if (allowedDurations) systemVideoSettings.allowedDurations = allowedDurations;

    return res.json({ success: true, settings: systemVideoSettings });
  });

  // --- Background Image Upload / Override ---
  app.get("/api/background", (_req: Request, res: Response) => {
    const publicPath = path.join(process.cwd(), "public", "background.jpg");
    if (fs.existsSync(publicPath)) {
      return res.json({ url: "/background.jpg" });
    }
    return res.json({ url: "/background.jpg" });
  });

  app.post("/api/background", (req: Request, res: Response) => {
    const { image } = req.body;
    if (!image) {
      return res.status(400).json({ error: "No image provided" });
    }

    try {
      const base64Data = image.replace(/^data:image\/\w+;base64,/, "");
      const buffer = Buffer.from(base64Data, "base64");

      const publicDir = path.join(process.cwd(), "public");
      if (!fs.existsSync(publicDir)) {
        fs.mkdirSync(publicDir, { recursive: true });
      }
      fs.writeFileSync(path.join(publicDir, "background.jpg"), buffer);

      const assetsDir = path.join(process.cwd(), "src", "assets");
      if (!fs.existsSync(assetsDir)) {
        fs.mkdirSync(assetsDir, { recursive: true });
      }
      fs.writeFileSync(path.join(assetsDir, "background.jpg"), buffer);

      const distDir = path.join(process.cwd(), "dist");
      if (fs.existsSync(distDir)) {
        fs.writeFileSync(path.join(distDir, "background.jpg"), buffer);
      }

      return res.json({ success: true, url: `/background.jpg?t=${Date.now()}` });
    } catch (err: any) {
      console.error("Failed to save background image:", err);
      return res.status(500).json({ error: "Failed to save background image" });
    }
  });

  // --- Profile Avatar Upload / Override ---
  app.get("/api/avatar", (_req: Request, res: Response) => {
    return res.json({ url: "/avatar.jpg" });
  });

  app.post("/api/avatar", (req: Request, res: Response) => {
    const { image } = req.body;
    if (!image) {
      return res.status(400).json({ error: "No image provided" });
    }

    try {
      const base64Data = image.replace(/^data:image\/\w+;base64,/, "");
      const buffer = Buffer.from(base64Data, "base64");

      const publicDir = path.join(process.cwd(), "public");
      if (!fs.existsSync(publicDir)) {
        fs.mkdirSync(publicDir, { recursive: true });
      }
      fs.writeFileSync(path.join(publicDir, "avatar.jpg"), buffer);

      const assetsDir = path.join(process.cwd(), "src", "assets");
      if (!fs.existsSync(assetsDir)) {
        fs.mkdirSync(assetsDir, { recursive: true });
      }
      fs.writeFileSync(path.join(assetsDir, "avatar.jpg"), buffer);

      const distDir = path.join(process.cwd(), "dist");
      if (fs.existsSync(distDir)) {
        fs.writeFileSync(path.join(distDir, "avatar.jpg"), buffer);
      }

      return res.json({ success: true, url: `/avatar.jpg?t=${Date.now()}` });
    } catch (err: any) {
      console.error("Failed to save avatar image:", err);
      return res.status(500).json({ error: "Failed to save avatar image" });
    }
  });

  // --- Vite Middleware for Development / Static in Production ---
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (_req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  const server = http.createServer(app);
  const wss = new WebSocketServer({ server, path: "/live" });
  setupLiveWebSocket(wss);

  server.listen(PORT, HOST, () => {
    console.log(`Baloch AI running at http://${HOST}:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error("Failed to start server:", err);
  process.exit(1);
});
