import { createClient } from "@supabase/supabase-js";
import type { Request, Response, NextFunction } from "express";
import { db } from "./db";
import { profiles } from "@shared/schema";
import { eq } from "drizzle-orm";
import type { Profile } from "@shared/schema";

const supabaseUrl = process.env.SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

if (!supabaseUrl || !supabaseServiceKey) {
  console.warn("[AgentFoxx] SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY not set — auth will not work");
}

// Service-role client for server-side admin operations (invites, user management)
export const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

// Extend Express Request with user info
declare global {
  namespace Express {
    interface Request {
      user?: Profile;
      supabaseUserId?: string;
    }
  }
}

/**
 * Extract and validate Supabase JWT from Authorization header.
 * Attaches the user's profile to req.user.
 */
export async function requireAuth(req: Request, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;

  if (!authHeader?.startsWith("Bearer ")) {
    return res.status(401).json({ message: "Missing or invalid Authorization header" });
  }

  const token = authHeader.slice(7);

  try {
    const { data: { user }, error } = await supabaseAdmin.auth.getUser(token);

    if (error || !user) {
      return res.status(401).json({ message: "Invalid or expired token" });
    }

    // Fetch profile from DB
    const [profile] = await db.select().from(profiles).where(eq(profiles.id, user.id));

    if (!profile || !profile.isActive) {
      return res.status(403).json({ message: "Account is inactive or profile not found" });
    }

    req.user = profile;
    req.supabaseUserId = user.id;
    next();
  } catch (err) {
    console.error("[Auth] Token validation error:", err);
    return res.status(401).json({ message: "Authentication failed" });
  }
}

/**
 * Requires the authenticated user to have admin role.
 * Must be used after requireAuth.
 */
export function requireAdmin(req: Request, res: Response, next: NextFunction) {
  if (!req.user || req.user.role !== "admin") {
    return res.status(403).json({ message: "Admin access required" });
  }
  next();
}

/**
 * Allows either Supabase JWT auth OR API key auth (for server-to-server calls).
 * This dual-auth pattern ensures n8n/external services can still call protected endpoints.
 */
export function requireAuthOrApiKey(req: Request, res: Response, next: NextFunction) {
  const apiKey = process.env.API_KEY;
  const providedKey = req.headers["x-api-key"] as string | undefined;

  // If valid API key provided, skip JWT auth
  if (apiKey && providedKey) {
    try {
      const keyBuffer = Buffer.from(providedKey);
      const expectedBuffer = Buffer.from(apiKey);
      if (keyBuffer.length === expectedBuffer.length) {
        const crypto = require("crypto");
        if (crypto.timingSafeEqual(keyBuffer, expectedBuffer)) {
          return next();
        }
      }
    } catch {}
  }

  // Fall through to JWT auth
  return requireAuth(req, res, next);
}
