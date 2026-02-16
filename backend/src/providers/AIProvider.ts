import { GoogleGenerativeAI, GenerativeModel } from "@google/generative-ai";
import { z } from "zod";
import {
  SpreadsheetSchema,
  formatSemanticIssues,
  spreadsheetSchema,
  validateSpreadsheetSemantics
} from "../validators/spreadsheetSchema";

type SpreadsheetAIResponse = {
  schema: SpreadsheetSchema;
  followUp: string;
  suggestions: string[];
  mode: "standard" | "corporate";
};

const aiResponseSchema = z.object({
  schema: spreadsheetSchema,
  followUp: z.string().trim().min(1).max(400),
  suggestions: z.array(z.string().trim().min(1).max(180)).min(1).max(8)
}).strict();

export class AIProvider {
  private genAI: GoogleGenerativeAI;
  private model: GenerativeModel;
  private readonly apiKey: string;

  constructor(apiKey: string) {
    this.apiKey = apiKey;
    this.genAI = new GoogleGenerativeAI(apiKey);
    this.model = this.genAI.getGenerativeModel({
      model: "gemini-2.5-flash",
      systemInstruction: `Você é um Engenheiro de Dados especialista em Excel.
Sua missão é gerar planilhas PREMIUM e COMPLETAS em JSON. 

REGRAS:
1. IDIOMA: Responda exatamente no idioma solicitado pelo usuário.
2. DADOS: Mínimo 12 linhas de dados reais e úteis. Evite placeholders.
3. FÓRMULAS: Use fórmulas Excel padrão (SUM, IF, VLOOKUP, etc) para campos calculados.
4. DESIGN: Gere um tema elegante com cores Hex.
5. FORMATO: Siga rigorosamente o schema JSON fornecido.
6. SEGURANÇA: Nunca gere fórmulas perigosas (WEBSERVICE, FILTERXML, EXEC, CALL, SHELL, cmd|).
7. SAÍDA: Retorne APENAS JSON válido, sem markdown e sem texto extra.`,
      generationConfig: {
        responseMimeType: "application/json",
        temperature: 0.05,
        maxOutputTokens: 10000
      }
    });
  }

  async generateSpreadsheetAndNextSteps(userPrompt: string, requestedMode?: "standard" | "corporate"): Promise<SpreadsheetAIResponse> {
    if (!this.apiKey) {
      throw new Error("GEMINI_API_KEY não configurada");
    }

    const mode = requestedMode || this.inferModeFromPrompt(userPrompt);
    const prompt = this.buildPrompt(userPrompt, mode);

    try {
      const result = await this.model.generateContent(prompt);
      const rawText = result.response.text();
      return await this.parseModelResponse(rawText, userPrompt, mode);
    } catch (error: any) {
      if (error instanceof Error && error.message.startsWith("AI_VALIDATION_ERROR:")) {
        throw error;
      }

      console.error("AI Error Specifics:", error);
      throw new Error(`Erro na IA: ${error.message || "Falha na estrutura JSON"}`);
    }
  }

  private buildPrompt(userPrompt: string, mode: "standard" | "corporate"): string {
    const corporateDirective = mode === "corporate"
      ? `REQUISITOS CORPORATE:
- Estruture em múltiplas abas com padrão: Input, Base, Calculos, Dashboards e Audit (quando fizer sentido).
- Inclua KPIs executivos e fórmulas de consolidação entre abas.
- Inclua metadata.mode="corporate".`
      : `REQUISITOS STANDARD:
- Gere estrutura simples e objetiva, focada em agilidade.
- Inclua metadata.mode="standard".`;

    return `Gere uma planilha para: "${userPrompt}".
Modo de geração: ${mode}.
${corporateDirective}

Retorne um JSON seguindo EXATAMENTE este formato:
{
  "schema": {
    "schemaVersion": "1.0",
    "title": "...",
    "description": "...",
    "metadata": {
      "mode": "${mode}",
      "locale": "pt-BR",
      "currency": "BRL"
    },
    "theme": { "headerBg": "#...", "headerText": "#...", "rowEvenBg": "#...", "rowOddBg": "#...", "borderColor": "#..." },
    "sheets": [{
      "name": "Sheet1",
      "showTitle": true,
      "autoFilter": true,
      "columns": [{ "header": "...", "key": "col1", "width": 15, "format": "currency" }],
      "rows": [{ "col1": 100 }]
    }]
  },
  "followUp": "...",
  "suggestions": ["...", "..."]
}

Não retorne markdown e não inclua chaves extras fora desse contrato.`;
  }

  private async parseModelResponse(rawText: string, userPrompt: string, mode: "standard" | "corporate"): Promise<SpreadsheetAIResponse> {
    const parsed = this.parseJsonSafely(rawText);
    const firstAttempt = parsed ? this.tryValidatePayload(parsed, mode) : { ok: false as const, error: "JSON inválido ou vazio." };
    if (firstAttempt.ok) {
      return firstAttempt.value;
    }

    const repairPrompt = `Corrija o JSON abaixo para ficar válido e completo.
Retorne apenas o objeto JSON final, sem markdown.
Erros encontrados na validação:
${firstAttempt.error}

JSON original:
${(rawText || "").slice(0, 12000)}

Contexto da solicitação original: "${userPrompt}"
Modo de geração esperado: "${mode}"`;

    const repairResult = await this.model.generateContent(repairPrompt);
    const repairedParsed = this.parseJsonSafely(repairResult.response.text());

    if (!repairedParsed) {
      throw new Error("AI_VALIDATION_ERROR: A resposta da IA veio truncada e não pôde ser recuperada.");
    }

    const repairedAttempt = this.tryValidatePayload(repairedParsed, mode);
    if (!repairedAttempt.ok) {
      throw new Error(`AI_VALIDATION_ERROR: ${repairedAttempt.error}`);
    }

    return repairedAttempt.value;
  }

  private tryValidatePayload(payload: unknown, mode: "standard" | "corporate"):
    { ok: true; value: SpreadsheetAIResponse }
    | { ok: false; error: string } {
    const parsed = aiResponseSchema.safeParse(payload);
    if (!parsed.success) {
      return { ok: false, error: this.formatZodIssues(parsed.error.issues) };
    }

    const semanticIssues = validateSpreadsheetSemantics(parsed.data.schema);
    if (semanticIssues.length > 0) {
      return {
        ok: false,
        error: `Falha de validação semântica: ${formatSemanticIssues(semanticIssues)}`
      };
    }

    const normalizedSuggestions = Array.from(
      new Set(parsed.data.suggestions.map((suggestion) => suggestion.trim()).filter(Boolean))
    ).slice(0, 6);

    const normalizedSchema: SpreadsheetSchema = {
      ...parsed.data.schema,
      schemaVersion: parsed.data.schema.schemaVersion || "1.0",
      metadata: {
        ...(parsed.data.schema.metadata || {}),
        mode: parsed.data.schema.metadata?.mode || mode
      }
    };

    return {
      ok: true,
      value: {
        schema: normalizedSchema,
        followUp: parsed.data.followUp.trim(),
        suggestions: normalizedSuggestions.length > 0 ? normalizedSuggestions : ["Adicionar dashboard executivo"],
        mode
      }
    };
  }

  private formatZodIssues(issues: z.ZodIssue[]): string {
    if (!issues.length) {
      return "JSON em formato inválido.";
    }

    return issues
      .slice(0, 6)
      .map((issue) => `${issue.path.join(".") || "payload"}: ${issue.message}`)
      .join(" | ");
  }

  private inferModeFromPrompt(prompt: string): "standard" | "corporate" {
    const corporatePattern = /\b(corporativ|multinacional|diretoria|board|orcamento|budget|kpi|dre|forecast)\b/i;
    return corporatePattern.test(prompt) ? "corporate" : "standard";
  }

  private parseJsonSafely(raw: string): any | null {
    const normalized = this.normalizeRawText(raw);
    const candidates = [
      normalized,
      this.extractFirstJsonObject(normalized),
      this.closeOpenStructures(normalized),
      this.closeOpenStructures(this.extractFirstJsonObject(normalized))
    ].filter((candidate): candidate is string => Boolean(candidate));

    for (const candidate of candidates) {
      try {
        return JSON.parse(candidate);
      } catch (_err) {
        // tenta próximo candidato
      }
    }

    return null;
  }

  private normalizeRawText(raw: string): string {
    let text = (raw || "").trim();
    if (text.startsWith("```json")) {
      text = text.replace(/^```json/, "");
    }
    if (text.startsWith("```")) {
      text = text.replace(/^```/, "");
    }
    if (text.endsWith("```")) {
      text = text.replace(/```$/, "");
    }
    return text.trim();
  }

  private extractFirstJsonObject(text: string): string {
    const start = text.indexOf("{");
    if (start < 0) {
      return "";
    }

    let inString = false;
    let escaped = false;
    let depth = 0;

    for (let i = start; i < text.length; i++) {
      const char = text[i];

      if (escaped) {
        escaped = false;
        continue;
      }

      if (char === "\\") {
        escaped = true;
        continue;
      }

      if (char === "\"") {
        inString = !inString;
        continue;
      }

      if (inString) {
        continue;
      }

      if (char === "{") {
        depth += 1;
      } else if (char === "}") {
        depth -= 1;
        if (depth === 0) {
          return text.slice(start, i + 1);
        }
      }
    }

    return text.slice(start);
  }

  private closeOpenStructures(text: string): string {
    if (!text) {
      return "";
    }

    const stack: string[] = [];
    let inString = false;
    let escaped = false;

    for (const char of text) {
      if (escaped) {
        escaped = false;
        continue;
      }

      if (char === "\\") {
        escaped = true;
        continue;
      }

      if (char === "\"") {
        inString = !inString;
        continue;
      }

      if (inString) {
        continue;
      }

      if (char === "{") {
        stack.push("}");
      } else if (char === "[") {
        stack.push("]");
      } else if ((char === "}" || char === "]") && stack.length > 0) {
        const expected = stack[stack.length - 1];
        if (char === expected) {
          stack.pop();
        }
      }
    }

    if (inString) {
      return text;
    }

    return text + stack.reverse().join("");
  }
}
