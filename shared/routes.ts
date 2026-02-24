import { z } from 'zod';
import { insertActivitySchema, activities, insertReviewSchema, reviews } from './schema';

export const errorSchemas = {
  validation: z.object({
    message: z.string(),
    field: z.string().optional(),
  }),
  notFound: z.object({
    message: z.string(),
  }),
  internal: z.object({
    message: z.string(),
  }),
};

export const api = {
  activities: {
    list: {
      method: 'GET' as const,
      path: '/api/activities' as const,
      responses: {
        200: z.array(z.custom<typeof activities.$inferSelect>()),
      },
    },
    get: {
      method: 'GET' as const,
      path: '/api/activities/:id' as const,
      responses: {
        200: z.custom<typeof activities.$inferSelect>(),
        404: errorSchemas.notFound,
      },
    },
    update: {
      method: 'PUT' as const,
      path: '/api/activities/:id' as const,
      input: insertActivitySchema.partial(),
      responses: {
        200: z.object({ success: z.boolean(), message: z.string() }),
        404: errorSchemas.notFound,
      },
    },
    stats: {
      method: 'GET' as const,
      path: '/api/stats' as const,
      responses: {
        200: z.object({
          emailsSent: z.number(),
          leadsCreated: z.number(),
          themeDistribution: z.array(z.object({ theme: z.string(), count: z.number() })),
        }),
      }
    }
  },
  reviews: {
    list: {
      method: 'GET' as const,
      path: '/api/reviews' as const,
      responses: {
        200: z.array(z.custom<typeof reviews.$inferSelect>()),
      },
    },
    get: {
      method: 'GET' as const,
      path: '/api/reviews/:id' as const,
      responses: {
        200: z.custom<typeof reviews.$inferSelect>(),
        404: errorSchemas.notFound,
      },
    },
    create: {
      method: 'POST' as const,
      path: '/api/reviews' as const,
      input: insertReviewSchema,
      responses: {
        201: z.custom<typeof reviews.$inferSelect>(),
        400: errorSchemas.validation,
      },
    },
    update: {
      method: 'PATCH' as const,
      path: '/api/reviews/:id' as const,
      input: insertReviewSchema.partial(),
      responses: {
        200: z.custom<typeof reviews.$inferSelect>(),
        404: errorSchemas.notFound,
      },
    },
  },
  upload: {
    audio: {
      method: 'POST' as const,
      path: '/api/upload-audio' as const,
      responses: {
        200: z.object({
          success: z.boolean(),
          activityId: z.number(),
          audioUrl: z.string(),
          message: z.string()
        }),
        400: errorSchemas.validation,
      }
    }
  }
};

export function buildUrl(path: string, params?: Record<string, string | number>): string {
  let url = path;
  if (params) {
    Object.entries(params).forEach(([key, value]) => {
      if (url.includes(`:${key}`)) {
        url = url.replace(`:${key}`, String(value));
      }
    });
  }
  return url;
}

export type ActivityResponse = z.infer<typeof api.activities.get.responses[200]>;
export type StatsResponse = z.infer<typeof api.activities.stats.responses[200]>;
export type UploadAudioResponse = z.infer<typeof api.upload.audio.responses[200]>;