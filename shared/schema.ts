import { pgTable, text, serial, timestamp, boolean, integer, uuid, date, uniqueIndex } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";
import { sql } from "drizzle-orm";

// ── Profiles (extends Supabase auth.users) ─────────────────────────

export const profiles = pgTable("profiles", {
  id: uuid("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull(),
  title: text("title"),
  phone: text("phone"),
  signature: text("signature"),
  role: text("role").notNull().default("rep"),
  msEmail: text("ms_email"),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
});

export const insertProfileSchema = createInsertSchema(profiles).omit({ createdAt: true });
export type Profile = typeof profiles.$inferSelect;
export type InsertProfile = z.infer<typeof insertProfileSchema>;

// ── Events ──────────────────────────────────────────────────────────

export const events = pgTable("events", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  startDate: date("start_date"),
  endDate: date("end_date"),
  location: text("location"),
  description: text("description"),
  isActive: boolean("is_active").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
});

export const insertEventSchema = createInsertSchema(events).omit({ id: true, createdAt: true });
export type Event = typeof events.$inferSelect;
export type InsertEvent = z.infer<typeof insertEventSchema>;

// ── Event Collateral ────────────────────────────────────────────────

export const eventCollateral = pgTable("event_collateral", {
  id: serial("id").primaryKey(),
  eventId: integer("event_id").notNull().references(() => events.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  filename: text("filename"),
  description: text("description"),
  fileUrl: text("file_url"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
});

export const insertCollateralSchema = createInsertSchema(eventCollateral).omit({ id: true, createdAt: true });
export type EventCollateral = typeof eventCollateral.$inferSelect;
export type InsertCollateral = z.infer<typeof insertCollateralSchema>;

// ── Activities ──────────────────────────────────────────────────────

export const activities = pgTable("activities", {
  id: serial("id").primaryKey(),
  userId: uuid("user_id").references(() => profiles.id),
  eventId: integer("event_id").references(() => events.id),
  contactName: text("contact_name").notNull(),
  contactEmail: text("contact_email").notNull(),
  company: text("company"),
  notes: text("notes"),
  theme: text("theme"),
  transcript: text("transcript"),
  emailDraft: text("email_draft"),
  outlookContactId: text("outlook_contact_id"),
  outlookCampaignId: text("outlook_campaign_id"),
  status: text("status").default("pending"),
  audioUrl: text("audio_url"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
});

export const insertActivitySchema = createInsertSchema(activities).omit({
  id: true, createdAt: true,
});

export type Activity = typeof activities.$inferSelect;
export type InsertActivity = z.infer<typeof insertActivitySchema>;
export type UpdateActivityRequest = Partial<InsertActivity>;

// ── Reviews ─────────────────────────────────────────────────────────

export const reviews = pgTable("reviews", {
  id: serial("id").primaryKey(),
  userId: uuid("user_id").references(() => profiles.id),
  eventId: integer("event_id").references(() => events.id),
  contactName: text("contact_name").notNull(),
  contactEmail: text("contact_email").notNull(),
  company: text("company").notNull(),
  classification: text("classification").notNull(),
  confidence: text("confidence").notNull(),
  whitePaper: text("white_paper"),
  subjectLine: text("subject_line"),
  emailBody: text("email_body").notNull(),
  transcription: text("transcription"),
  keyInsights: text("key_insights"),
  status: text("status").notNull().default("pending_approval"),
  resumeUrl: text("resume_url"),
  timestamp: text("timestamp"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertReviewSchema = createInsertSchema(reviews).omit({
  id: true,
  createdAt: true,
});

export type Review = typeof reviews.$inferSelect;
export type InsertReview = z.infer<typeof insertReviewSchema>;

// ── Attendees ───────────────────────────────────────────────────────

export const attendees = pgTable("attendees", {
  id: serial("id").primaryKey(),
  eventId: integer("event_id").references(() => events.id),
  fullName: text("full_name").notNull(),
  email: text("email").notNull(),
  company: text("company"),
});

export const insertAttendeeSchema = createInsertSchema(attendees).omit({ id: true });
export type Attendee = typeof attendees.$inferSelect;
export type InsertAttendee = z.infer<typeof insertAttendeeSchema>;

// ── Broadcasts ──────────────────────────────────────────────────────

export const broadcasts = pgTable("broadcasts", {
  id: serial("id").primaryKey(),
  eventId: integer("event_id").references(() => events.id),
  fromUserId: uuid("from_user_id").references(() => profiles.id),
  message: text("message").notNull(),
  targetType: text("target_type").notNull().default("all"),
  targetUserId: uuid("target_user_id").references(() => profiles.id),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  expiresAt: timestamp("expires_at", { withTimezone: true }),
});

export const insertBroadcastSchema = createInsertSchema(broadcasts).omit({ id: true, createdAt: true });
export type Broadcast = typeof broadcasts.$inferSelect;
export type InsertBroadcast = z.infer<typeof insertBroadcastSchema>;

// ── Event Schedule ──────────────────────────────────────────────────

export const eventSchedule = pgTable("event_schedule", {
  id: serial("id").primaryKey(),
  eventId: integer("event_id").notNull().references(() => events.id, { onDelete: "cascade" }),
  title: text("title").notNull(),
  startTime: timestamp("start_time", { withTimezone: true }).notNull(),
  endTime: timestamp("end_time", { withTimezone: true }).notNull(),
  location: text("location"),
  type: text("type").notNull().default("session"),
  description: text("description"),
  isRequired: boolean("is_required").notNull().default(false),
});

export const insertScheduleItemSchema = createInsertSchema(eventSchedule).omit({ id: true });
export type ScheduleItem = typeof eventSchedule.$inferSelect;
export type InsertScheduleItem = z.infer<typeof insertScheduleItemSchema>;

// ── Event Attendance ────────────────────────────────────────────────

export const eventAttendance = pgTable("event_attendance", {
  id: serial("id").primaryKey(),
  scheduleItemId: integer("schedule_item_id").notNull().references(() => eventSchedule.id, { onDelete: "cascade" }),
  userId: uuid("user_id").notNull().references(() => profiles.id, { onDelete: "cascade" }),
  status: text("status").notNull().default("no_response"),
  checkedIn: boolean("checked_in").notNull().default(false),
  checkedInAt: timestamp("checked_in_at", { withTimezone: true }),
});

export const insertAttendanceSchema = createInsertSchema(eventAttendance).omit({ id: true });
export type Attendance = typeof eventAttendance.$inferSelect;
export type InsertAttendance = z.infer<typeof insertAttendanceSchema>;
