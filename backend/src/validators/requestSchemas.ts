import { z } from 'zod';

const spreadsheetValueSchema = z.union([
    z.string(),
    z.number(),
    z.boolean(),
    z.null(),
    z.object({
        formula: z.string().min(1).max(200)
    }).strict()
]);

const columnSchema = z.object({
    header: z.string().min(1).max(120),
    key: z.string().min(1).max(120).regex(/^[a-zA-Z0-9_]+$/),
    width: z.number().min(5).max(80).optional(),
    format: z.enum(['currency', 'date', 'percentage', 'number', 'text']).optional(),
    alignment: z.enum(['left', 'center', 'right']).optional()
}).strict();

const sheetSchema = z.object({
    name: z.string().min(1).max(80),
    showTitle: z.boolean().optional(),
    autoFilter: z.boolean().optional(),
    freezePanes: z.object({
        x: z.number().int().min(0).max(20).optional()
    }).strict().optional(),
    columns: z.array(columnSchema).min(1).max(100),
    rows: z.array(z.record(z.string(), spreadsheetValueSchema)).max(5000)
}).strict();

const workbookThemeSchema = z.object({
    headerBg: z.string().max(9).optional(),
    headerText: z.string().max(9).optional(),
    rowEvenBg: z.string().max(9).optional(),
    rowOddBg: z.string().max(9).optional(),
    borderColor: z.string().max(9).optional()
}).strict().optional();

export const processRequestSchema = z.object({
    prompt: z.string().trim().min(3).max(3000)
}).strict();

export const downloadRequestSchema = z.object({
    format: z.enum(['xlsx', 'csv']).default('xlsx'),
    schema: z.object({
        title: z.string().max(150).optional(),
        description: z.string().max(500).optional(),
        theme: workbookThemeSchema,
        sheets: z.array(sheetSchema).min(1).max(5)
    }).strict()
}).strict();

export const metaEventRequestSchema = z.object({
    eventName: z.string().trim().min(1).max(64),
    eventSourceUrl: z.string().url().max(2048),
    eventID: z.string().max(128).optional(),
    customData: z.unknown().optional(),
    userData: z.object({
        email: z.string().email().optional(),
        phone: z.string().max(32).optional(),
        fbc: z.string().max(256).optional(),
        fbp: z.string().max(256).optional()
    }).strict().optional()
}).strict();
