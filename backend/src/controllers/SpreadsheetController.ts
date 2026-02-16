import { AIProvider } from "../providers/AIProvider";
import { SpreadsheetService } from "../services/SpreadsheetService";
import { formatSemanticIssues, spreadsheetSchema, validateSpreadsheetSemantics } from "../validators/spreadsheetSchema";

export class SpreadsheetController {
    private aiProvider: AIProvider;
    private spreadsheetService: SpreadsheetService;

    constructor(apiKey: string) {
        this.aiProvider = new AIProvider(apiKey);
        this.spreadsheetService = new SpreadsheetService();
    }

    async processRequest(userPrompt: string, generationMode?: 'standard' | 'corporate') {
        // Agora sempre gera a planilha e sugestões em um único passo
        const response = await this.aiProvider.generateSpreadsheetAndNextSteps(userPrompt, generationMode);

        return {
            status: "success",
            schema: response.schema,
            followUp: response.followUp,
            suggestions: response.suggestions,
            mode: response.mode
        };
    }

    async generateFile(schema: unknown, format: 'xlsx' | 'csv' = 'xlsx') {
        const parsedSchema = spreadsheetSchema.safeParse(schema);
        if (!parsedSchema.success) {
            const issue = parsedSchema.error.issues[0];
            const issuePath = issue?.path?.join(".") || "schema";
            throw new Error(`SCHEMA_INVALID: Estrutura inválida em "${issuePath}": ${issue?.message || "erro de validação"}`);
        }

        const semanticIssues = validateSpreadsheetSemantics(parsedSchema.data);
        if (semanticIssues.length > 0) {
            throw new Error(`SCHEMA_INVALID: ${formatSemanticIssues(semanticIssues)}`);
        }

        if (format === "csv" && parsedSchema.data.sheets.length !== 1) {
            throw new Error("SCHEMA_INVALID: O formato CSV suporta apenas 1 aba. Use XLSX para múltiplas abas.");
        }

        const workbook = await this.spreadsheetService.createWorkbook(parsedSchema.data);
        const buffer = await this.spreadsheetService.exportToBuffer(workbook, format);
        const safeTitle = this.getSafeFilename(parsedSchema.data.title || 'planilha');

        return {
            buffer,
            filename: `${safeTitle}.${format}`,
            mimeType: format === 'xlsx'
                ? 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
                : 'text/csv'
        };
    }

    private getSafeFilename(raw: unknown): string {
        return String(raw || 'planilha')
            .replace(/[<>:"/\\|?*\x00-\x1F]/g, ' ')
            .replace(/\s+/g, ' ')
            .trim()
            .slice(0, 80) || 'planilha';
    }
}
