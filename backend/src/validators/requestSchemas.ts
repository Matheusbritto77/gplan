import { z } from 'zod';
import { spreadsheetSchema } from './spreadsheetSchema';

export const processRequestSchema = z.object({
    prompt: z.string().trim().min(3).max(3000),
    generationMode: z.enum(['standard', 'corporate']).optional()
}).strict();

export const downloadRequestSchema = z.object({
    format: z.enum(['xlsx', 'csv']).default('xlsx'),
    schema: spreadsheetSchema
}).strict();

export const metaEventRequestSchema = z.object({
    eventName: z.string().trim().min(1).max(64),
    eventSourceUrl: z.string().url().max(2048),
    eventID: z.string().max(128).optional(),
    eventTime: z.number().int().min(0).optional(),
    customData: z.unknown().optional(),
    userData: z.object({
        email: z.string().email().optional(),
        phone: z.string().max(32).optional(),
        externalId: z.string().max(128).optional(),
        firstName: z.string().max(64).optional(),
        lastName: z.string().max(64).optional(),
        city: z.string().max(64).optional(),
        state: z.string().max(64).optional(),
        country: z.string().max(64).optional(),
        zip: z.string().max(32).optional(),
        fbc: z.string().max(256).optional(),
        fbp: z.string().max(256).optional()
    }).strict().optional()
}).strict();
