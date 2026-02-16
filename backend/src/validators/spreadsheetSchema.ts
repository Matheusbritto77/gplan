import { z } from "zod";

const HEX_COLOR_REGEX = /^#?[A-Fa-f0-9]{6}([A-Fa-f0-9]{2})?$/;

const spreadsheetPrimitiveValueSchema = z.union([
    z.string().max(20000),
    z.number().finite(),
    z.boolean(),
    z.null()
]);

const spreadsheetFormulaSchema = z.object({
    formula: z.string().trim().min(1).max(1024),
    result: spreadsheetPrimitiveValueSchema.optional()
}).strict();

export const spreadsheetCellValueSchema = z.union([
    spreadsheetPrimitiveValueSchema,
    spreadsheetFormulaSchema
]);

export const spreadsheetColumnSchema = z.object({
    header: z.string().trim().min(1).max(120),
    key: z.string().trim().min(1).max(120),
    width: z.number().min(5).max(300).optional(),
    format: z.string().trim().max(32).optional(),
    type: z.string().trim().max(32).optional(),
    alignment: z.enum(["left", "center", "right"]).optional()
}).passthrough();

const spreadsheetFreezePanesSchema = z.object({
    x: z.number().int().min(0).max(20).optional()
}).passthrough();

export const spreadsheetSheetSchema = z.object({
    name: z.string().trim().min(1).max(80),
    showTitle: z.boolean().optional(),
    autoFilter: z.boolean().optional(),
    freezePanes: spreadsheetFreezePanesSchema.optional(),
    columns: z.array(spreadsheetColumnSchema).min(1).max(200),
    rows: z.array(z.record(z.string().min(1).max(120), spreadsheetCellValueSchema)).max(10000)
}).passthrough();

export const spreadsheetThemeSchema = z.object({
    headerBg: z.string().regex(HEX_COLOR_REGEX).max(9).optional(),
    headerText: z.string().regex(HEX_COLOR_REGEX).max(9).optional(),
    rowEvenBg: z.string().regex(HEX_COLOR_REGEX).max(9).optional(),
    rowOddBg: z.string().regex(HEX_COLOR_REGEX).max(9).optional(),
    borderColor: z.string().regex(HEX_COLOR_REGEX).max(9).optional()
}).passthrough().optional();

export const spreadsheetMetadataSchema = z.object({
    locale: z.string().trim().max(32).optional(),
    currency: z.string().trim().max(8).optional(),
    fiscalYearStartMonth: z.number().int().min(1).max(12).optional(),
    businessUnit: z.string().trim().max(120).optional(),
    mode: z.enum(["standard", "corporate"]).optional()
}).strict().optional();

export const spreadsheetSchema = z.object({
    schemaVersion: z.string().regex(/^\d+\.\d+$/).default("1.0"),
    title: z.string().trim().max(150).optional(),
    description: z.string().trim().max(500).optional(),
    metadata: spreadsheetMetadataSchema,
    theme: spreadsheetThemeSchema,
    sheets: z.array(spreadsheetSheetSchema).min(1).max(8)
}).passthrough();

export type SpreadsheetSchema = z.infer<typeof spreadsheetSchema>;

export type SpreadsheetSemanticIssue = {
    code: string;
    path: string;
    message: string;
};

const BLOCKED_FORMULA_PATTERNS: RegExp[] = [
    /\b(?:WEBSERVICE|FILTERXML|RTD|REGISTER|CALL|EXEC|SHELL)\s*\(/i,
    /\bcmd\|/i,
    /\bpowershell\b/i
];

function isFormulaValue(value: unknown): value is z.infer<typeof spreadsheetFormulaSchema> {
    if (!value || typeof value !== "object") {
        return false;
    }

    const maybeFormula = (value as { formula?: unknown }).formula;
    return typeof maybeFormula === "string";
}

function extractSheetReferences(formula: string): string[] {
    const references = new Set<string>();
    const referenceRegex = /(?:'([^']+)'|([A-Za-z0-9_ ]+))!/g;
    let match: RegExpExecArray | null = null;

    while ((match = referenceRegex.exec(formula)) !== null) {
        const quotedSheet = match[1];
        const plainSheet = match[2];
        const raw = (quotedSheet || plainSheet || "").trim();
        if (raw.length > 0) {
            references.add(raw);
        }
    }

    return Array.from(references);
}

function isDangerousFormula(rawFormula: string): boolean {
    const formula = rawFormula.trim();
    if (!formula) {
        return true;
    }

    if (/[\r\n\0]/.test(formula)) {
        return true;
    }

    const normalized = formula.startsWith("=") ? formula.slice(1).trim() : formula;
    return BLOCKED_FORMULA_PATTERNS.some((pattern) => pattern.test(normalized));
}

export function formatSemanticIssues(issues: SpreadsheetSemanticIssue[], limit = 5): string {
    if (issues.length === 0) {
        return "";
    }

    return issues
        .slice(0, limit)
        .map((issue) => `${issue.path}: ${issue.message}`)
        .join(" | ");
}

export function validateSpreadsheetSemantics(schema: SpreadsheetSchema): SpreadsheetSemanticIssue[] {
    const issues: SpreadsheetSemanticIssue[] = [];
    const sheetNames = new Set(schema.sheets.map((sheet) => sheet.name));

    schema.sheets.forEach((sheet, sheetIndex) => {
        const columnKeys = new Set<string>();

        sheet.columns.forEach((column, columnIndex) => {
            if (columnKeys.has(column.key)) {
                issues.push({
                    code: "DUPLICATE_COLUMN_KEY",
                    path: `sheets[${sheetIndex}].columns[${columnIndex}].key`,
                    message: `A chave "${column.key}" está duplicada na aba "${sheet.name}".`
                });
                return;
            }

            columnKeys.add(column.key);
        });

        sheet.rows.forEach((row, rowIndex) => {
            Object.keys(row).forEach((rowKey) => {
                if (!columnKeys.has(rowKey)) {
                    issues.push({
                        code: "UNKNOWN_ROW_KEY",
                        path: `sheets[${sheetIndex}].rows[${rowIndex}].${rowKey}`,
                        message: `A chave "${rowKey}" não existe nas colunas da aba "${sheet.name}".`
                    });
                }

                const value = row[rowKey];
                if (!isFormulaValue(value)) {
                    return;
                }

                const formula = value.formula.trim();
                if (isDangerousFormula(formula)) {
                    issues.push({
                        code: "UNSAFE_FORMULA",
                        path: `sheets[${sheetIndex}].rows[${rowIndex}].${rowKey}.formula`,
                        message: "A fórmula contém padrão bloqueado por segurança."
                    });
                    return;
                }

                const referencedSheets = extractSheetReferences(formula);
                referencedSheets.forEach((referencedSheet) => {
                    if (!sheetNames.has(referencedSheet)) {
                        issues.push({
                            code: "UNKNOWN_SHEET_REFERENCE",
                            path: `sheets[${sheetIndex}].rows[${rowIndex}].${rowKey}.formula`,
                            message: `A fórmula referencia a aba "${referencedSheet}" que não existe.`
                        });
                    }
                });
            });
        });
    });

    return issues;
}
