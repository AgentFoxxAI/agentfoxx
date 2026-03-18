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
import crypto from "crypto";

// API key auth middleware for write endpoints.
// Key is read from API_KEY env var. If not set, auth is disabled (dev mode).
const API_KEY = process.env.API_KEY;

function requireApiKey(req: Request, res: Response, next: NextFunction) {
  if (!API_KEY) return next(); // no key configured = open (dev)
  const provided = req.headers["x-api-key"] as string | undefined;
  if (provided && crypto.timingSafeEqual(Buffer.from(provided), Buffer.from(API_KEY))) {
    return next();
  }
  return res.status(401).json({ message: "Unauthorized: invalid or missing x-api-key header" });
}

// Configure multer for audio file uploads (memory storage for Autoscale compatibility)
const uploadDir = path.join(process.cwd(), 'uploads');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

const uploader = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 25 * 1024 * 1024 }, // 25MB limit (Whisper max)
  fileFilter: (req, file, cb) => {
    const allowedTypes = ['audio/webm', 'audio/mp4', 'audio/mpeg', 'audio/ogg', 'audio/wav', 'audio/x-m4a', 'video/webm'];
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error(`Unsupported audio format: ${file.mimetype}. Accepted: webm, mp4, mp3, ogg, wav, m4a`));
    }
  }
});

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {

  app.use('/uploads', express.static(uploadDir));

  // Health/diagnostic endpoint
  app.get('/api/health', (_req, res) => {
    res.json({
      status: 'ok',
      timestamp: new Date().toISOString(),
      n8nWebhookConfigured: !!process.env.N8N_WEBHOOK_URL,
      n8nWebhookUrl: process.env.N8N_WEBHOOK_URL ? `${process.env.N8N_WEBHOOK_URL.substring(0, 30)}...` : 'NOT SET',
      nodeEnv: process.env.NODE_ENV,
      uploadDir,
    });
  });

  // Reviews
  app.get(api.reviews.list.path, async (_req, res) => {
    const reviews = await storage.getReviews();
    res.json(reviews);
  });

  app.get(api.reviews.get.path, async (req, res) => {
    const id = parseInt(req.params.id);
    const review = await storage.getReview(id);
    if (!review) return res.status(404).json({ message: "Review not found" });
    res.json(review);
  });

  app.post(api.reviews.create.path, requireApiKey, async (req, res) => {
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

  app.patch(api.reviews.update.path, async (req, res) => {
    const id = parseInt(req.params.id);
    try {
      const updates = api.reviews.update.input.parse(req.body);
      const review = await storage.updateReview(id, updates);
      res.json(review);
    } catch (e) {
      res.status(400).json({ message: "Invalid update data" });
    }
  });

  app.delete('/api/reviews/:id', requireApiKey, async (req, res) => {
    const id = parseInt(req.params.id);
    if (!Number.isFinite(id)) return res.status(400).json({ message: "Invalid review ID" });
    const deleted = await storage.deleteReview(id);
    if (!deleted) return res.status(404).json({ message: "Review not found" });
    res.json({ success: true, message: "Review deleted" });
  });

  app.post(api.reviews.decide.path, async (req, res) => {
    const id = parseInt(req.params.id);
    try {
      const { status, emailBody, subjectLine } = api.reviews.decide.input.parse(req.body);

      const review = await storage.getReview(id);
      if (!review) return res.status(404).json({ message: "Review not found" });

      await storage.updateReview(id, { status, emailBody, subjectLine });

      let webhookWarning = "";
      try {
        const resumeUrl = new URL(review.resumeUrl);
        resumeUrl.searchParams.set("status", status);

        const callbackUrl = resumeUrl.toString();
        console.log("[CALLBACK] Calling n8n resume URL:", callbackUrl);
        console.log("[CALLBACK] Stored resumeUrl:", review.resumeUrl);
        console.log("[CALLBACK] Review ID:", id, "Status:", status);

        const webhookResponse = await fetch(callbackUrl, {
          method: "GET",
          redirect: "follow",
          signal: AbortSignal.timeout(15000),
        });

        const responseText = await webhookResponse.text();
        console.log("[CALLBACK] n8n response status:", webhookResponse.status);
        console.log("[CALLBACK] n8n response headers:", JSON.stringify(Object.fromEntries(webhookResponse.headers.entries())));
        console.log("[CALLBACK] n8n response body:", responseText.substring(0, 500));

        if (!webhookResponse.ok) {
          console.error("[CALLBACK] n8n resume webhook failed:", webhookResponse.status, webhookResponse.statusText);
          webhookWarning = ` (Warning: n8n returned ${webhookResponse.status} — the decision was saved but the workflow may not have resumed.)`;
        } else {
          console.log("[CALLBACK] n8n resume webhook succeeded!");
        }
      } catch (webhookErr: any) {
        console.error("[CALLBACK] n8n resume webhook error:", webhookErr?.message || webhookErr);
        console.error("[CALLBACK] Error stack:", webhookErr?.stack);
        webhookWarning = ` (Warning: could not reach n8n — ${webhookErr?.message || "unknown error"})`;
      }

      const baseMessage = status === "approved" ? "Email approved and sent to Outlook." : "Email draft rejected.";
      res.json({
        success: true,
        message: baseMessage + webhookWarning,
        callbackUrl: review.resumeUrl,
        callbackStatus: webhookWarning ? "warning" : "ok",
      });
    } catch (e) {
      if (e instanceof z.ZodError) {
        return res.status(400).json({ message: e.errors[0].message });
      }
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.post(api.upload.audio.path, uploader.single('audio'), async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ message: 'No audio file provided', field: 'audio' });
      }

      const { contactName, contactEmail, company, notes } = req.body;

      if (!contactName || !contactEmail) {
        return res.status(400).json({ message: 'contactName and contactEmail are required', field: 'body' });
      }

      const protocol = req.headers['x-forwarded-proto'] || req.protocol;
      const audioFileName = `audio_${Date.now()}${path.extname(req.file.originalname) || '.webm'}`;
      const audioUrl = `${protocol}://${req.get('host')}/uploads/${audioFileName}`;

      // Use buffer directly from memory storage (Autoscale compatible)
      const audioBase64 = req.file.buffer.toString('base64');
      const audioMimeType = req.file.mimetype || 'audio/webm';

      // Also save to disk for local serving (best-effort, may not persist on Autoscale)
      try {
        fs.writeFileSync(path.join(uploadDir, audioFileName), req.file.buffer);
      } catch (writeErr) {
        console.warn('[AgentFoxx] Could not write audio to disk (expected on Autoscale):', writeErr);
      }

      const activity = await storage.createActivity({
        contactName,
        contactEmail,
        company: company || null,
        notes: notes || null,
        status: 'processing',
        audioUrl
      });

      const n8nWebhookUrl = process.env.N8N_WEBHOOK_URL;
      let webhookStatus = 'skipped';

      if (n8nWebhookUrl) {
        try {
          console.log(`[AgentFoxx] Sending webhook to n8n for activity ${activity.id}`);
          console.log(`[AgentFoxx] Webhook URL: ${n8nWebhookUrl}`);
          console.log(`[AgentFoxx] Audio base64 length: ${audioBase64.length} chars`);

          const webhookPayload = {
            activityId: activity.id,
            audioUrl,
            audioBase64,
            audioMimeType,
            audioFileName,
            contactName,
            contactEmail,
            company,
            notes,
            callbackUrl: `${protocol}://${req.get('host')}/api/activities/${activity.id}`
          };

          const payloadSize = JSON.stringify(webhookPayload).length;
          console.log(`[AgentFoxx] Webhook payload size: ${(payloadSize / 1024 / 1024).toFixed(2)} MB`);

          const response = await fetch(n8nWebhookUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(webhookPayload)
          });

          if (!response.ok) {
            const responseText = await response.text().catch(() => 'no body');
            console.error(`[AgentFoxx] n8n webhook failed: ${response.status} ${response.statusText} - ${responseText}`);
            webhookStatus = `failed: ${response.status}`;
          } else {
            console.log(`[AgentFoxx] n8n webhook succeeded: ${response.status}`);
            webhookStatus = 'sent';
          }
        } catch (webhookErr: any) {
          console.error('[AgentFoxx] n8n webhook fetch error:', webhookErr.message || webhookErr);
          webhookStatus = `error: ${webhookErr.message}`;
        }
      } else {
        console.warn('[AgentFoxx] N8N_WEBHOOK_URL is NOT configured! Webhook skipped. Set this in Replit Secrets.');
        webhookStatus = 'not_configured';
      }

      res.status(200).json({
        success: true,
        activityId: activity.id,
        audioUrl,
        webhookStatus,
        message: webhookStatus === 'sent'
          ? 'Audio uploaded successfully. Processing workflow...'
          : webhookStatus === 'not_configured'
            ? 'Audio uploaded but n8n webhook URL is not configured. Set N8N_WEBHOOK_URL in Secrets.'
            : `Audio uploaded but webhook ${webhookStatus}. Check server logs.`
      });

    } catch (error: any) {
      console.error('Upload error:', error);
      res.status(500).json({ message: error.message });
    }
  });

  app.get(api.activities.list.path, async (req, res) => {
    const activities = await storage.getActivities();
    res.json(activities);
  });

  app.get(api.activities.get.path, async (req, res) => {
    const activity = await storage.getActivity(Number(req.params.id));
    if (!activity) {
      return res.status(404).json({ message: 'Activity not found' });
    }
    res.json(activity);
  });

  app.put(api.activities.update.path, async (req, res) => {
    try {
      const input = api.activities.update.input.parse(req.body);
      const activity = await storage.updateActivity(Number(req.params.id), {
        ...input,
        status: input.status || 'completed'
      });
      res.status(200).json({ success: true, message: 'Activity updated' });
    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({
          message: err.errors[0].message,
          field: err.errors[0].path.join('.'),
        });
      }
      res.status(500).json({ message: 'Internal server error' });
    }
  });

  app.get(api.activities.stats.path, async (req, res) => {
    const stats = await storage.getStats();
    res.json(stats);
  });

  // Attendee endpoints
  const csvUploader = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } });

  app.get('/api/attendees/search', async (req, res) => {
    const q = String(req.query.q || '');
    const results = await storage.searchAttendees(q);
    res.json(results);
  });

  app.get('/api/attendees/count', async (_req, res) => {
    const count = await storage.getAttendeeCount();
    res.json({ count });
  });

  app.post('/api/attendees/upload', requireApiKey, csvUploader.single('file'), async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ message: 'No CSV file provided' });
      }

      const csvContent = req.file.buffer.toString('utf-8');
      const lines = csvContent.split('\n').map(l => l.trim()).filter(l => l.length > 0);

      let startIndex = 0;
      for (let i = 0; i < lines.length; i++) {
        const lower = lines[i].toLowerCase();
        if (lower.includes('name') && lower.includes('email')) {
          startIndex = i;
          break;
        }
      }

      const csvToParse = lines.slice(startIndex).join('\n');
      const records = parse(csvToParse, {
        columns: true,
        skip_empty_lines: true,
        trim: true,
        relax_column_count: true,
      }) as Record<string, string>[];

      const attendeeRows: { fullName: string; email: string; company: string | null }[] = [];
      for (const row of records) {
        const name = row['Name'] || row['name'] || row['Full Name'] || row['full_name'] || row['FullName'] || '';
        const email = row['Email'] || row['email'] || row['E-mail'] || '';
        const company = row['Company'] || row['company'] || row['Organization'] || '';

        const trimmedName = name.trim();
        const trimmedEmail = email.trim();
        const trimmedCompany = company.trim();

        if (trimmedName && trimmedName !== '-' && trimmedEmail && trimmedEmail !== '-' && trimmedEmail.includes('@')) {
          attendeeRows.push({
            fullName: trimmedName,
            email: trimmedEmail,
            company: (trimmedCompany && trimmedCompany !== '-') ? trimmedCompany : null,
          });
        }
      }

      if (attendeeRows.length === 0) {
        return res.status(400).json({ message: 'No valid attendee rows found in CSV. Ensure it has Name and Email columns.' });
      }

      const inserted = await storage.replaceAttendees(attendeeRows);

      res.json({ success: true, count: inserted, message: `Imported ${inserted} attendees` });
    } catch (error: any) {
      console.error('CSV upload error:', error);
      res.status(500).json({ message: error.message || 'Failed to process CSV' });
    }
  });

  app.delete('/api/attendees', requireApiKey, async (_req, res) => {
    await storage.clearAttendees();
    res.json({ success: true, message: 'All attendees cleared' });
  });

  // Seed data
  setTimeout(async () => {
    try {
      const activities = await storage.getActivities();
      if (activities.length === 0) {
        await storage.createActivity({
          contactName: "John Doe",
          contactEmail: "john@example.com",
          company: "Acme Corp",
          notes: "Met at the AI summit.",
          status: "completed",
          theme: "AI Integration",
          outlookContactId: "123"
        });
      }
    } catch(e) {
      console.error("Seed data error:", e);
    }
  }, 2000);

  return httpServer;
}