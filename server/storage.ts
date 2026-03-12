import { db } from "./db";
import { 
  activities, type Activity, type InsertActivity, type UpdateActivityRequest,
  reviews, type Review, type InsertReview,
  attendees, type Attendee, type InsertAttendee
} from "@shared/schema";
import { eq, desc, isNotNull, sql, ilike } from "drizzle-orm";

export interface IStorage {
  createActivity(activity: InsertActivity): Promise<Activity>;
  getActivities(): Promise<Activity[]>;
  getActivity(id: number): Promise<Activity | undefined>;
  updateActivity(id: number, updates: UpdateActivityRequest): Promise<Activity>;
  getStats(): Promise<{
    emailsSent: number;
    leadsCreated: number;
    themeDistribution: { theme: string; count: number }[];
  }>;
  // Review operations
  createReview(review: InsertReview): Promise<Review>;
  getReviews(): Promise<Review[]>;
  getReview(id: number): Promise<Review | undefined>;
  updateReview(id: number, updates: Partial<InsertReview>): Promise<Review>;
  // Attendee operations
  searchAttendees(query: string): Promise<Attendee[]>;
  getAttendeeCount(): Promise<number>;
  clearAttendees(): Promise<void>;
  bulkInsertAttendees(rows: InsertAttendee[]): Promise<number>;
  replaceAttendees(rows: InsertAttendee[]): Promise<number>;
}

export class DatabaseStorage implements IStorage {
  async createActivity(activity: InsertActivity): Promise<Activity> {
    const [result] = await db.insert(activities).values(activity).returning();
    return result;
  }

  async getActivities(): Promise<Activity[]> {
    return await db.select().from(activities).orderBy(desc(activities.createdAt)).limit(100);
  }

  async getActivity(id: number): Promise<Activity | undefined> {
    const [result] = await db.select().from(activities).where(eq(activities.id, id));
    return result;
  }

  async updateActivity(id: number, updates: UpdateActivityRequest): Promise<Activity> {
    const [result] = await db.update(activities)
      .set(updates)
      .where(eq(activities.id, id))
      .returning();
    return result;
  }

  async getStats() {
    const completed = await db.select({ count: sql<number>`count(*)::int` }).from(activities).where(eq(activities.status, 'completed'));
    const leads = await db.select({ count: sql<number>`count(*)::int` }).from(activities).where(isNotNull(activities.outlookContactId));
    
    const themeDist = await db.select({
      theme: activities.theme,
      count: sql<number>`count(*)::int`
    })
    .from(activities)
    .where(isNotNull(activities.theme))
    .groupBy(activities.theme)
    .orderBy(desc(sql`count(*)`))
    .limit(5);

    return {
      emailsSent: completed[0]?.count || 0,
      leadsCreated: leads[0]?.count || 0,
      themeDistribution: themeDist.map(t => ({ theme: t.theme || 'Unknown', count: t.count }))
    };
  }

  async createReview(review: InsertReview): Promise<Review> {
    const [result] = await db.insert(reviews).values(review).returning();
    return result;
  }

  async getReviews(): Promise<Review[]> {
    return await db.select().from(reviews).orderBy(desc(reviews.createdAt));
  }

  async getReview(id: number): Promise<Review | undefined> {
    const [result] = await db.select().from(reviews).where(eq(reviews.id, id));
    return result;
  }

  async updateReview(id: number, updates: Partial<InsertReview>): Promise<Review> {
    const [result] = await db.update(reviews)
      .set(updates)
      .where(eq(reviews.id, id))
      .returning();
    return result;
  }
  async searchAttendees(query: string): Promise<Attendee[]> {
    if (!query || query.length < 1) return [];
    return await db.select().from(attendees)
      .where(ilike(attendees.fullName, `%${query}%`))
      .orderBy(attendees.fullName)
      .limit(10);
  }

  async getAttendeeCount(): Promise<number> {
    const [result] = await db.select({ count: sql<number>`count(*)::int` }).from(attendees);
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
}

export const storage = new DatabaseStorage();