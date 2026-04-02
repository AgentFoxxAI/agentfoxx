import type { Express, Request, Response, NextFunction } from "express";
import express from "express";
import type { Server } from "http";
import { storage } from "./storage";
import { api } from "@shared/routes";
import { z } from "zod";
import multer from "multer";
import path from "path";
import fs from "fs";
import { parse } from "csv-parse/sync";
import { requireAuth, requireAdmin, requireAuthOrApiKey, supabaseAdmin } from "./supabase";
import { processLead } from "./pipeline";
import { sendApprovedEmail } from "./email";

// Configure multer for audio file uploads (memory storage)
const uploadDir = path.join(process.cwd(), "uploads");
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

const uploader = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 25 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const allowedTypes = ["audio/webm", "audio/mp4", "audio/mpeg", "audio/ogg", "audio/wav", "audio/x-m4a", "video/webm"];
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error(`Unsupported audio format: ${file.mimetype}`));
    }
  },
});

export async function registerRoutes(httpServer: Server, app: Express): Promise<Server> {
  app.use("/uploads", express.static(uploadDir));

  // ── Public routes ─────────────────────────────────────────────────

  app.get("/api/health", (_req, res) => {
    res.json({
      status: "ok",
      timestamp: new Date().toISOString(),
      version: "2.0.0",
      nodeEnv: process.env.NODE_ENV,
    });
  });

  // ── Auth / Profile routes ─────────────────────────────────────────

  app.get("/api/profile", requireAuth, async (req, res) => {
    res.json(req.user);
  });

  app.patch("/api/profile", requireAuth, async (req, res) => {
    const { name, title, phone, signature } = req.body;
    const updates: Record<string, any> = {};
    if (name !== undefined) updates.name = name;
    if (title !== undefined) updates.title = title;
    if (phone !== undefined) updates.phone = phone;
    if (signature !== undefined) updates.signature = signature;

    const profile = await storage.updateProfile(req.user!.id, updates);
    res.json(profile);
  });

  // ── Admin: Invite user ────────────────────────────────────────────

  app.post("/api/admin/invite", requireAuth, requireAdmin, async (req, res) => {
    try {
      const { email, name, role } = req.body;
      if (!email || !name) {
        return res.status(400).json({ message: "email and name are required" });
      }

      const { data, error } = await supabaseAdmin.auth.admin.inviteUserByEmail(email, {
        data: { name, role: role || "rep" },
      });

      if (error) {
        return res.status(400).json({ message: error.message });
      }

      res.status(201).json({
        success: true,
        message: `Invite sent to ${email}`,
        userId: data.user.id,
      });
    } catch (err: any) {
      res.status(500).json({ message: err.message || "Failed to send invite" });
    }
  });

  // ── Admin: List users ─────────────────────────────────────────────

  app.get("/api/admin/users", requireAuth, requireAdmin, async (_req, res) => {
    const users = await storage.getProfiles();
    res.json(users);
  });

  app.patch("/api/admin/users/:id", requireAuth, requireAdmin, async (req, res) => {
    const { role, isActive } = req.body;
    const updates: Record<string, any> = {};
    if (role !== undefined) updates.role = role;
    if (isActive !== undefined) updates.isActive = isActive;

    const profile = await storage.updateProfile(req.params.id, updates);
    res.json(profile);
  });

  // ── Reviews ───────────────────────────────────────────────────────

  app.get(api.reviews.list.path, requireAuth, async (req, res) => {
    const eventId = req.query.eventId ? Number(req.query.eventId) : undefined;
    const reviews = await storage.getReviews({ eventId, userId: req.user!.role === "admin" ? undefined : req.user!.id });
    res.json(reviews);
  });

  app.get(api.reviews.get.path, requireAuth, async (req, res) => {
    const id = parseInt(req.params.id);
    const review = await storage.getReview(id);
    if (!review) return res.status(404).json({ message: "Review not found" });
    res.json(review);
  });

  app.post(api.reviews.create.path, requireAuthOrApiKey, async (req, res) => {
    try {
      if (req.body.confidence !== undefined) {
        req.body.confidence = String(req.body.confidence);
      }
      const data = api.reviews.create.input.parse(req.body);
      const review = await storage.createReview(data);
      res.status(201).json(review);
    } catch (e) {
      res.status(400).json({ message: "Invalid review data" });
    }
  });

  app.patch(api.reviews.update.path, requireAuth, async (req, res) => {
    const id = parseInt(req.params.id);
    try {
      const updates = api.reviews.update.input.parse(req.body);
      const review = await storage.updateReview(id, updates);
      res.json(review);
    } catch (e) {
      res.status(400).json({ message: "Invalid update data" });
    }
  });

  app.delete("/api/reviews/:id", requireAuth, requireAdmin, async (req, res) => {
    const id = parseInt(req.params.id);
    if (!Number.isFinite(id)) return res.status(400).json({ message: "Invalid review ID" });
    const deleted = await storage.deleteReview(id);
    if (!deleted) return res.status(404).json({ message: "Review not found" });
    res.json({ success: true, message: "Review deleted" });
  });

  app.post(api.reviews.decide.path, requireAuth, async (req, res) => {
    const id = parseInt(req.params.id);
    try {
      const { status, emailBody, subjectLine } = api.reviews.decide.input.parse(req.body);

      const review = await storage.getReview(id);
      if (!review) return res.status(404).json({ message: "Review not found" });

      await storage.updateReview(id, { status, emailBody, subjectLine });

      let emailResult = { success: true, message: "" };

      if (status === "approved") {
        emailResult = await sendApprovedEmail(id);
      }

      const baseMessage = status === "approved"
        ? emailResult.message || "Email approved and sent."
        : "Email draft rejected.";

      res.json({
        success: true,
        message: baseMessage,
        emailSent: status === "approved" ? emailResult.success : false,
      });
    } catch (e) {
      if (e instanceof z.ZodError) {
        return res.status(400).json({ message: e.errors[0].message });
      }
      console.error("[Decide] Error:", e);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // ── Audio Upload ──────────────────────────────────────────────────

  app.post(api.upload.audio.path, requireAuth, uploader.single("audio"), async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ message: "No audio file provided", field: "audio" });
      }

      const { contactName, contactEmail, company, notes, eventId } = req.body;

      if (!contactName || !contactEmail) {
        return res.status(400).json({ message: "contactName and contactEmail are required" });
      }

      const protocol = req.headers["x-forwarded-proto"] || req.protocol;
      const audioFileName = `audio_${Date.now()}${path.extname(req.file.originalname) || ".webm"}`;
      const audioUrl = `${protocol}://${req.get("host")}/uploads/${audioFileName}`;

      // Save to disk (best-effort)
      try {
        fs.writeFileSync(path.join(uploadDir, audioFileName), req.file.buffer);
      } catch (writeErr) {
        console.warn("[AgentFoxx] Could not write audio to disk:", writeErr);
      }

      const parsedEventId = eventId ? Number(eventId) : null;

      const activity = await storage.createActivity({
        userId: req.user!.id,
        eventId: parsedEventId,
        contactName,
        contactEmail,
        company: company || null,
        notes: notes || null,
        status: "processing",
        audioUrl,
      });

      // Return immediately — pipeline runs async
      res.status(202).json({
        success: true,
        activityId: activity.id,
        audioUrl,
        message: "Audio uploaded. AI pipeline processing...",
      });

      // Run pipeline in background (after response sent)
      const event = parsedEventId ? await storage.getEvent(parsedEventId) : null;

      processLead({
        activityId: activity.id,
        audioBuffer: req.file.buffer,
        audioMimeType: req.file.mimetype || "audio/webm",
        contactName,
        contactEmail,
        company: company || "",
        notes: notes || "",
        userId: req.user!.id,
        eventId: parsedEventId,
        event: event || null,
        profile: req.user!,
      }).catch((err) => {
        console.error(`[Pipeline] Failed for activity ${activity.id}:`, err);
        // Update activity status to failed
        storage.updateActivity(activity.id, { status: "failed" }).catch(() => {});
      });

    } catch (error: any) {
      console.error("Upload error:", error);
      res.status(500).json({ message: error.message });
    }
  });

  // ── Activities ────────────────────────────────────────────────────

  app.get(api.activities.list.path, requireAuth, async (req, res) => {
    const eventId = req.query.eventId ? Number(req.query.eventId) : undefined;
    const activities = await storage.getActivities({ eventId, userId: req.user!.role === "admin" ? undefined : req.user!.id });
    res.json(activities);
  });

  app.get(api.activities.get.path, requireAuth, async (req, res) => {
    const activity = await storage.getActivity(Number(req.params.id));
    if (!activity) return res.status(404).json({ message: "Activity not found" });
    res.json(activity);
  });

  app.put(api.activities.update.path, requireAuth, async (req, res) => {
    try {
      const input = api.activities.update.input.parse(req.body);
      await storage.updateActivity(Number(req.params.id), {
        ...input,
        status: input.status || "completed",
      });
      res.status(200).json({ success: true, message: "Activity updated" });
    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({ message: err.errors[0].message });
      }
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.get(api.activities.stats.path, requireAuth, async (req, res) => {
    const eventId = req.query.eventId ? Number(req.query.eventId) : undefined;
    const stats = await storage.getStats(eventId);
    res.json(stats);
  });

  // ── Attendees ─────────────────────────────────────────────────────

  const csvUploader = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } });

  app.get("/api/attendees/search", requireAuth, async (req, res) => {
    const q = String(req.query.q || "");
    const eventId = req.query.eventId ? Number(req.query.eventId) : undefined;
    const results = await storage.searchAttendees(q, eventId);
    res.json(results);
  });

  app.get("/api/attendees/count", requireAuth, async (req, res) => {
    const eventId = req.query.eventId ? Number(req.query.eventId) : undefined;
    const count = await storage.getAttendeeCount(eventId);
    res.json({ count });
  });

  app.post("/api/attendees/upload", requireAuth, requireAdmin, csvUploader.single("file"), async (req, res) => {
    try {
      if (!req.file) return res.status(400).json({ message: "No CSV file provided" });

      const eventId = req.body.eventId ? Number(req.body.eventId) : undefined;
      const csvContent = req.file.buffer.toString("utf-8");
      const lines = csvContent.split("\n").map((l) => l.trim()).filter((l) => l.length > 0);

      let startIndex = 0;
      for (let i = 0; i < lines.length; i++) {
        const lower = lines[i].toLowerCase();
        if (lower.includes("name") && lower.includes("email")) {
          startIndex = i;
          break;
        }
      }

      const csvToParse = lines.slice(startIndex).join("\n");
      const records = parse(csvToParse, {
        columns: true,
        skip_empty_lines: true,
        trim: true,
        relax_column_count: true,
      }) as Record<string, string>[];

      const attendeeRows: { fullName: string; email: string; company: string | null; eventId: number | null }[] = [];
      for (const row of records) {
        const name = row["Name"] || row["name"] || row["Full Name"] || row["full_name"] || row["FullName"] || "";
        const email = row["Email"] || row["email"] || row["E-mail"] || "";
        const company = row["Company"] || row["company"] || row["Organization"] || "";

        const trimmedName = name.trim();
        const trimmedEmail = email.trim();
        const trimmedCompany = company.trim();

        if (trimmedName && trimmedName !== "-" && trimmedEmail && trimmedEmail !== "-" && trimmedEmail.includes("@")) {
          attendeeRows.push({
            fullName: trimmedName,
            email: trimmedEmail,
            company: trimmedCompany && trimmedCompany !== "-" ? trimmedCompany : null,
            eventId: eventId ?? null,
          });
        }
      }

      if (attendeeRows.length === 0) {
        return res.status(400).json({ message: "No valid attendee rows found in CSV." });
      }

      const inserted = await storage.replaceAttendees(attendeeRows);
      res.json({ success: true, count: inserted, message: `Imported ${inserted} attendees` });
    } catch (error: any) {
      console.error("CSV upload error:", error);
      res.status(500).json({ message: error.message || "Failed to process CSV" });
    }
  });

  app.delete("/api/attendees", requireAuth, requireAdmin, async (_req, res) => {
    await storage.clearAttendees();
    res.json({ success: true, message: "All attendees cleared" });
  });

  // ── Events ────────────────────────────────────────────────────────

  app.get("/api/events", requireAuth, async (_req, res) => {
    const events = await storage.getEvents();
    res.json(events);
  });

  app.post("/api/events", requireAuth, requireAdmin, async (req, res) => {
    try {
      const event = await storage.createEvent(req.body);
      res.status(201).json(event);
    } catch (err: any) {
      res.status(400).json({ message: err.message || "Failed to create event" });
    }
  });

  app.patch("/api/events/:id", requireAuth, requireAdmin, async (req, res) => {
    try {
      const event = await storage.updateEvent(Number(req.params.id), req.body);
      res.json(event);
    } catch (err: any) {
      res.status(400).json({ message: err.message || "Failed to update event" });
    }
  });

  return httpServer;
}
