import type { Express } from "express";
import express from "express";
import type { Server } from "http";
import { storage } from "./storage";
import { api } from "@shared/routes";
import { z } from "zod";
import multer from "multer";
import path from "path";
import fs from "fs";

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