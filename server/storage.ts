import { db } from "./db";
import {
  activities, type Activity, type InsertActivity, type UpdateActivityRequest,
  reviews, type Review, type InsertReview,
  attendees, type Attendee, type InsertAttendee,
  profiles, type Profile,
  events, type Event, type InsertEvent,
  broadcasts, type Broadcast, type InsertBroadcast,
} from "@shared/schema";
import { eq, desc, isNotNull, sql, ilike, and, or } from "drizzle-orm";

interface ListFilters {
  eventId?: number;
  userId?: string;
}

export interface IStorage {
  // Profiles
  getProfiles(): Promise<Profile[]>;
  getProfile(id: string): Promise<Profile | undefined>;
  updateProfile(id: string, updates: Partial<Profile>): Promise<Profile>;

  // Events
  getEvents(): Promise<Event[]>;
  getEvent(id: number): Promise<Event | undefined>;
  createEvent(event: InsertEvent): Promise<Event>;
  updateEvent(id: number, updates: Partial<InsertEvent>): Promise<Event>;

  // Activities
  createActivity(activity: InsertActivity): Promise<Activity>;
  getActivities(filters?: ListFilters): Promise<Activity[]>;
  getActivity(id: number): Promise<Activity | undefined>;
  updateActivity(id: number, updates: UpdateActivityRequest): Promise<Activity>;
  getStats(eventId?: number): Promise<{
    emailsSent: number;
    leadsCreated: number;
    themeDistribution: { theme: string; count: number }[];
  }>;

  // Reviews
  createReview(review: InsertReview): Promise<Review>;
  getReviews(filters?: ListFilters): Promise<Review[]>;
  getReview(id: number): Promise<Review | undefined>;
  updateReview(id: number, updates: Partial<InsertReview>): Promise<Review>;
  deleteReview(id: number): Promise<boolean>;

  // Attendees
  searchAttendees(query: string, eventId?: number): Promise<Attendee[]>;
  getAttendeeCount(eventId?: number): Promise<number>;
  clearAttendees(): Promise<void>;
  bulkInsertAttendees(rows: InsertAttendee[]): Promise<number>;
  replaceAttendees(rows: InsertAttendee[]): Promise<number>;

  // Broadcasts
  getBroadcasts(eventId?: number, userId?: string): Promise<Broadcast[]>;
  createBroadcast(broadcast: InsertBroadcast): Promise<Broadcast>;

  // Leaderboard
  getLeaderboard(eventId?: number): Promise<Array<{
    userId: string;
    name: string;
    points: number;
    leadCount: number;
    topClassification: string;
  }>>;
}

export class DatabaseStorage implements IStorage {
  // ── Profiles ──────────────────────────────────────────────────────

  async getProfiles(): Promise<Profile[]> {
    return await db.select().from(profiles).orderBy(profiles.name);
  }

  async getProfile(id: string): Promise<Profile | undefined> {
    const [result] = await db.select().from(profiles).where(eq(profiles.id, id));
    return result;
  }

  async updateProfile(id: string, updates: Partial<Profile>): Promise<Profile> {
    const [result] = await db.update(profiles).set(updates).where(eq(profiles.id, id)).returning();
    return result;
  }

  // ── Events ────────────────────────────────────────────────────────

  async getEvents(): Promise<Event[]> {
    return await db.select().from(events).orderBy(desc(events.createdAt));
  }

  async getEvent(id: number): Promise<Event | undefined> {
    const [result] = await db.select().from(events).where(eq(events.id, id));
    return result;
  }

  async createEvent(event: InsertEvent): Promise<Event> {
    const [result] = await db.insert(events).values(event).returning();
    return result;
  }

  async updateEvent(id: number, updates: Partial<InsertEvent>): Promise<Event> {
    const [result] = await db.update(events).set(updates).where(eq(events.id, id)).returning();
    return result;
  }

  // ── Activities ────────────────────────────────────────────────────

  async createActivity(activity: InsertActivity): Promise<Activity> {
    const [result] = await db.insert(activities).values(activity).returning();
    return result;
  }

  async getActivities(filters?: ListFilters): Promise<Activity[]> {
    const conditions = [];
    if (filters?.eventId) conditions.push(eq(activities.eventId, filters.eventId));
    if (filters?.userId) conditions.push(eq(activities.userId, filters.userId));

    const query = db.select().from(activities).orderBy(desc(activities.createdAt)).limit(100);
    if (conditions.length > 0) {
      return await query.where(and(...conditions));
    }
    return await query;
  }

  async getActivity(id: number): Promise<Activity | undefined> {
    const [result] = await db.select().from(activities).where(eq(activities.id, id));
    return result;
  }

  async updateActivity(id: number, updates: UpdateActivityRequest): Promise<Activity> {
    const [result] = await db.update(activities).set(updates).where(eq(activities.id, id)).returning();
    return result;
  }

  async getStats(eventId?: number) {
    const baseConditions = eventId ? [eq(activities.eventId, eventId)] : [];

    const completedConditions = [...baseConditions, eq(activities.status, "completed")];
    const completed = await db.select({ count: sql<number>`count(*)::int` })
      .from(activities)
      .where(and(...completedConditions));

    const leadsConditions = [...baseConditions, isNotNull(activities.outlookContactId)];
    const leads = await db.select({ count: sql<number>`count(*)::int` })
      .from(activities)
      .where(and(...leadsConditions));

    const themeConditions = [...baseConditions, isNotNull(activities.theme)];
    const themeDist = await db.select({
      theme: activities.theme,
      count: sql<number>`count(*)::int`,
    })
      .from(activities)
      .where(and(...themeConditions))
      .groupBy(activities.theme)
      .orderBy(desc(sql`count(*)`))
      .limit(5);

    return {
      emailsSent: completed[0]?.count || 0,
      leadsCreated: leads[0]?.count || 0,
      themeDistribution: themeDist.map((t) => ({ theme: t.theme || "Unknown", count: t.count })),
    };
  }

  // ── Reviews ───────────────────────────────────────────────────────

  async createReview(review: InsertReview): Promise<Review> {
    const [result] = await db.insert(reviews).values(review).returning();
    return result;
  }

  async getReviews(filters?: ListFilters): Promise<Review[]> {
    const conditions = [];
    if (filters?.eventId) conditions.push(eq(reviews.eventId, filters.eventId));
    if (filters?.userId) conditions.push(eq(reviews.userId, filters.userId));

    const query = db.select().from(reviews).orderBy(desc(reviews.createdAt));
    if (conditions.length > 0) {
      return await query.where(and(...conditions));
    }
    return await query;
  }

  async getReview(id: number): Promise<Review | undefined> {
    const [result] = await db.select().from(reviews).where(eq(reviews.id, id));
    return result;
  }

  async updateReview(id: number, updates: Partial<InsertReview>): Promise<Review> {
    const [result] = await db.update(reviews).set(updates).where(eq(reviews.id, id)).returning();
    return result;
  }

  async deleteReview(id: number): Promise<boolean> {
    const result = await db.delete(reviews).where(eq(reviews.id, id)).returning();
    return result.length > 0;
  }

  // ── Attendees ─────────────────────────────────────────────────────

  async searchAttendees(query: string, eventId?: number): Promise<Attendee[]> {
    if (!query || query.length < 1) return [];
    const conditions = [ilike(attendees.fullName, `%${query}%`)];
    if (eventId) conditions.push(eq(attendees.eventId, eventId));

    return await db.select().from(attendees)
      .where(and(...conditions))
      .orderBy(attendees.fullName)
      .limit(10);
  }

  async getAttendeeCount(eventId?: number): Promise<number> {
    const query = db.select({ count: sql<number>`count(*)::int` }).from(attendees);
    if (eventId) {
      const [result] = await query.where(eq(attendees.eventId, eventId));
      return result?.count || 0;
    }
    const [result] = await query;
    return result?.count || 0;
  }

  async clearAttendees(): Promise<void> {
    await db.delete(attendees);
  }

  async bulkInsertAttendees(rows: InsertAttendee[]): Promise<number> {
    if (rows.length === 0) return 0;
    const batchSize = 500;
    let inserted = 0;
    for (let i = 0; i < rows.length; i += batchSize) {
      const batch = rows.slice(i, i + batchSize);
      await db.insert(attendees).values(batch);
      inserted += batch.length;
    }
    return inserted;
  }

  async replaceAttendees(rows: InsertAttendee[]): Promise<number> {
    return await db.transaction(async (tx) => {
      await tx.delete(attendees);
      if (rows.length === 0) return 0;
      const batchSize = 500;
      let inserted = 0;
      for (let i = 0; i < rows.length; i += batchSize) {
        const batch = rows.slice(i, i + batchSize);
        await tx.insert(attendees).values(batch);
        inserted += batch.length;
      }
      return inserted;
    });
  }

  // ── Broadcasts ──────────────────────────────────────────────────

  async getBroadcasts(eventId?: number, userId?: string): Promise<Broadcast[]> {
    const conditions = [];
    if (eventId) conditions.push(eq(broadcasts.eventId, eventId));

    // User sees: broadcasts targeted to "all" OR targeted to them specifically
    if (userId) {
      conditions.push(
        or(
          eq(broadcasts.targetType, "all"),
          eq(broadcasts.targetUserId, userId),
          eq(broadcasts.fromUserId, userId),
        )!
      );
    }

    const query = db.select().from(broadcasts).orderBy(desc(broadcasts.createdAt)).limit(50);
    if (conditions.length > 0) {
      return await query.where(and(...conditions));
    }
    return await query;
  }

  async createBroadcast(broadcast: InsertBroadcast): Promise<Broadcast> {
    const [result] = await db.insert(broadcasts).values(broadcast).returning();
    return result;
  }

  // ── Leaderboard ─────────────────────────────────────────────────

  async getLeaderboard(eventId?: number): Promise<Array<{
    userId: string;
    name: string;
    points: number;
    leadCount: number;
    topClassification: string;
  }>> {
    // Quality-weighted scoring
    const pointsExpression = sql<number>`
      SUM(CASE
        WHEN ${reviews.classification} = 'qualified_lead' THEN 5
        WHEN ${reviews.classification} = 'partnership_opportunity' THEN 4
        WHEN ${reviews.classification} = 'content_nurture' THEN 3
        WHEN ${reviews.classification} = 'relationship_building' THEN 2
        WHEN ${reviews.classification} = 'needs_clarification' THEN 1
        ELSE 0
      END)::int
    `;

    const conditions = [];
    if (eventId) conditions.push(eq(reviews.eventId, eventId));
    conditions.push(isNotNull(reviews.userId));

    const results = await db
      .select({
        userId: reviews.userId,
        name: profiles.name,
        points: pointsExpression,
        leadCount: sql<number>`count(*)::int`,
        topClassification: sql<string>`
          mode() WITHIN GROUP (ORDER BY ${reviews.classification})
        `,
      })
      .from(reviews)
      .innerJoin(profiles, eq(reviews.userId, profiles.id))
      .where(and(...conditions))
      .groupBy(reviews.userId, profiles.name)
      .orderBy(desc(pointsExpression));

    return results.map((r) => ({
      userId: r.userId!,
      name: r.name,
      points: r.points || 0,
      leadCount: r.leadCount || 0,
      topClassification: r.topClassification || "none",
    }));
  }
}

export const storage = new DatabaseStorage();
