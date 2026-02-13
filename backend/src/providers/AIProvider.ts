import { GoogleGenerativeAI, GenerativeModel } from "@google/generative-ai";

type SpreadsheetAIResponse = {
  schema: unknown;
  followUp: string;
  suggestions: string[];
};

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
6. SAÍDA: Retorne APENAS JSON válido, sem markdown e sem texto extra.`,
      generationConfig: {
        responseMimeType: "application/json",
        temperature: 0.1,
        maxOutputTokens: 8192
      }
    });
  }

  async generateSpreadsheetAndNextSteps(userPrompt: string): Promise<SpreadsheetAIResponse> {
    if (!this.apiKey) {
      throw new Error("GEMINI_API_KEY não configurada");
    }

    const prompt = `Gere uma planilha para: "${userPrompt}". 
Retorne um JSON seguindo este formato:
{
  "schema": {
    "title": "...",
    "description": "...",
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
}`;

    try {
      const result = await this.model.generateContent(prompt);
      const rawText = result.response.text();
      return await this.parseModelResponse(rawText, userPrompt);
    } catch (error: any) {
      console.error("AI Error Specifics:", error);
      throw new Error(`Erro na IA: ${error.message || "Falha na estrutura JSON"}`);
    }
  }

  private async parseModelResponse(rawText: string, userPrompt: string): Promise<SpreadsheetAIResponse> {
    const parsed = this.parseJsonSafely(rawText);
    if (parsed) {
      return this.assertShape(parsed);
    }

    const repairPrompt = `Corrija o JSON abaixo para ficar válido e completo.
Retorne apenas o objeto JSON final, sem markdown:
${rawText}

Contexto da solicitação original: "${userPrompt}"`;

    const repairResult = await this.model.generateContent(repairPrompt);
    const repairedParsed = this.parseJsonSafely(repairResult.response.text());

    if (!repairedParsed) {
      throw new Error("A resposta da IA veio truncada e não pôde ser recuperada.");
    }

    return this.assertShape(repairedParsed);
  }

  private assertShape(payload: any): SpreadsheetAIResponse {
    if (!payload || typeof payload !== "object") {
      throw new Error("JSON inválido retornado pela IA.");
    }

    if (!payload.schema || typeof payload.followUp !== "string" || !Array.isArray(payload.suggestions)) {
      throw new Error("A IA retornou JSON sem o formato esperado.");
    }

    return {
      schema: payload.schema,
      followUp: payload.followUp,
      suggestions: payload.suggestions
    };
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
