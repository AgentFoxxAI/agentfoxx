import { pgTable, text, serial, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

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

export const insertActivitySchema = createInsertSchema(activities).omit({ 
  id: true, createdAt: true 
});

export type Activity = typeof activities.$inferSelect;
export type InsertActivity = z.infer<typeof insertActivitySchema>;
export type UpdateActivityRequest = Partial<InsertActivity>;
