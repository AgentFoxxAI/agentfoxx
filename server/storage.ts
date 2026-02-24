import { db } from "./db";
import { 
  activities, type Activity, type InsertActivity, type UpdateActivityRequest,
  reviews, type Review, type InsertReview
} from "@shared/schema";
import { eq, desc, isNotNull, sql } from "drizzle-orm";

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
    const leads = await db.select({ count: sql<number>`count(*)::int` }).from(activities).where(isNotNull(activities.outreachProspectId));
    
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
}

export const storage = new DatabaseStorage();