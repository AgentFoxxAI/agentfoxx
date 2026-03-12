import { pgTable, text, serial, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";
import { sql } from "drizzle-orm";

export const activities = pgTable("activities", {
  id: serial("id").primaryKey(),
  contactName: text("contact_name").notNull(),
  contactEmail: text("contact_email").notNull(),
  company: text("company"),
  notes: text("notes"),
  theme: text("theme"),
  transcript: text("transcript"),
  emailDraft: text("email_draft"),
  outreachProspectId: text("outreach_prospect_id"),
  outreachSequenceId: text("outreach_sequence_id"),
  status: text("status").default("pending"),
  audioUrl: text("audio_url"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const reviews = pgTable("reviews", {
  id: serial("id").primaryKey(),
  contactName: text("contact_name").notNull(),
  contactEmail: text("contact_email").notNull(),
  company: text("company").notNull(),
  classification: text("classification").notNull(),
  confidence: text("confidence").notNull(), // Store as text to avoid 'real' type issues in some pg drivers or just use numeric
  whitePaper: text("white_paper"),
  subjectLine: text("subject_line"),
  emailBody: text("email_body").notNull(),
  transcription: text("transcription"),
  keyInsights: text("key_insights"),
  status: text("status").notNull().default("pending_approval"),
  resumeUrl: text("resume_url").notNull(),
  timestamp: text("timestamp"), // ISO timestamp from n8n
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const insertActivitySchema = createInsertSchema(activities).omit({ 
  id: true, createdAt: true 
});

export const insertReviewSchema = createInsertSchema(reviews).omit({
  id: true,
  createdAt: true,
});

export type Activity = typeof activities.$inferSelect;
export type InsertActivity = z.infer<typeof insertActivitySchema>;
export type UpdateActivityRequest = Partial<InsertActivity>;

export type Review = typeof reviews.$inferSelect;
export type InsertReview = z.infer<typeof insertReviewSchema>;

export const attendees = pgTable("attendees", {
  id: serial("id").primaryKey(),
  fullName: text("full_name").notNull(),
  email: text("email").notNull(),
  company: text("company"),
});

export const insertAttendeeSchema = createInsertSchema(attendees).omit({ id: true });
export type Attendee = typeof attendees.$inferSelect;
export type InsertAttendee = z.infer<typeof insertAttendeeSchema>;
