import type { Express } from "express";
import express from "express";
import type { Server } from "http";
import { storage } from "./storage";
import { api } from "@shared/routes";
import { z } from "zod";
import multer from "multer";
import path from "path";
import fs from "fs";
import { parse } from "csv-parse/sync";

// Configure multer for audio file uploads
const uploadDir = path.join(process.cwd(), 'uploads');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

const uploader = multer({
  storage: multer.diskStorage({
    destination: (req, file, cb) => {
      cb(null, uploadDir);
    },
    filename: (req, file, cb) => {
      const timestamp = Date.now();
      const ext = path.extname(file.originalname) || '.webm';
      cb(null, `audio_${timestamp}${ext}`);
    }
  }),
  limits: { fileSize: 50 * 1024 * 1024 }, // 50MB limit
  fileFilter: (req, file, cb) => {
    cb(null, true);
  }
});

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {

  app.use('/uploads', express.static(uploadDir));

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

  app.post(api.reviews.create.path, async (req, res) => {
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

  app.post(api.reviews.decide.path, async (req, res) => {
    const id = parseInt(req.params.id);
    try {
      const { status, emailBody, subjectLine } = api.reviews.decide.input.parse(req.body);

      const review = await storage.getReview(id);
      if (!review) return res.status(404).json({ message: "Review not found" });

      await storage.updateReview(id, { status, emailBody, subjectLine });

      let webhookWarning = "";
      try {
        const resumeUrlWithStatus = new URL(review.resumeUrl);
        resumeUrlWithStatus.searchParams.set("status", status);

        const webhookResponse = await fetch(resumeUrlWithStatus.toString(), {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            status,
            emailBody,
            subjectLine,
            reviewId: review.id,
          }),
        });

        if (!webhookResponse.ok) {
          console.error("n8n resume webhook failed:", webhookResponse.statusText);
          webhookWarning = " (Warning: n8n workflow may have expired — the decision was saved but the workflow was not resumed.)";
        }
      } catch (webhookErr) {
        console.error("n8n resume webhook error:", webhookErr);
        webhookWarning = " (Warning: could not reach n8n — the decision was saved but the workflow was not notified.)";
      }

      const baseMessage = status === "approved" ? "Email approved and sent to Outreach." : "Email draft rejected.";
      res.json({
        success: true,
        message: baseMessage + webhookWarning,
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

      const audioUrl = `${req.protocol}://${req.get('host')}/uploads/${req.file.filename}`;

      const activity = await storage.createActivity({
        contactName,
        contactEmail,
        company: company || null,
        notes: notes || null,
        status: 'processing',
        audioUrl
      });

      const n8nWebhookUrl = process.env.N8N_WEBHOOK_URL;
      
      if (n8nWebhookUrl) {
        try {
          const response = await fetch(n8nWebhookUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              activityId: activity.id,
              audioUrl,
              contactName,
              contactEmail,
              company,
              notes,
              callbackUrl: `${req.protocol}://${req.get('host')}/api/activities/${activity.id}`
            })
          });

          if (!response.ok) {
            console.error('n8n webhook failed:', response.statusText);
          }
        } catch (webhookErr) {
          console.error('n8n webhook fetch error:', webhookErr);
        }
      }

      res.status(200).json({
        success: true,
        activityId: activity.id,
        audioUrl,
        message: 'Audio uploaded successfully. Processing workflow...'
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

  app.post('/api/attendees/upload', csvUploader.single('file'), async (req, res) => {
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

  app.delete('/api/attendees', async (_req, res) => {
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
          outreachProspectId: "123"
        });
      }
    } catch(e) {
      console.error("Seed data error:", e);
    }
  }, 2000);

  return httpServer;
}