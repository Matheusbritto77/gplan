import { AIProvider } from "../providers/AIProvider";
import { SpreadsheetService } from "../services/SpreadsheetService";

export class SpreadsheetController {
    private aiProvider: AIProvider;
    private spreadsheetService: SpreadsheetService;

    constructor(apiKey: string) {
        this.aiProvider = new AIProvider(apiKey);
        this.spreadsheetService = new SpreadsheetService();
    }

    async processRequest(userPrompt: string) {
        // Agora sempre gera a planilha e sugestões em um único passo
        const response = await this.aiProvider.generateSpreadsheetAndNextSteps(userPrompt);

        return {
            status: "success",
            schema: response.schema,
            followUp: response.followUp,
            suggestions: response.suggestions
        };
    }

    async generateFile(schema: any, format: 'xlsx' | 'csv' = 'xlsx') {
        const workbook = await this.spreadsheetService.createWorkbook(schema);
        const buffer = await this.spreadsheetService.exportToBuffer(workbook, format);

        return {
            buffer,
            filename: `${schema.title || 'planilha'}.${format}`,
            mimeType: format === 'xlsx'
                ? 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
                : 'text/csv'
        };
    }
}
