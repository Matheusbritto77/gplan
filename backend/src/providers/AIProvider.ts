import { GoogleGenerativeAI, GenerativeModel } from "@google/generative-ai";

export class AIProvider {
  private genAI: GoogleGenerativeAI;
  private model: GenerativeModel;

  constructor(apiKey: string) {
    this.genAI = new GoogleGenerativeAI(apiKey);
    this.model = this.genAI.getGenerativeModel({
      model: "gemini-2.5-flash",
      systemInstruction: `Você é um Engenheiro de Dados especialista em Excel.
Sua missão é gerar planilhas PREMIUM e COMPLETAS em JSON. 

REGRAS:
1. IDIOMA: Responda exatamente no idioma solicitado pelo usuário.
2. DADOS: Mínimo 20 linhas de dados REAIS e DENSOS. Evite placeholders.
3. FÓRMULAS: Use fórmulas Excel padrão (SUM, IF, VLOOKUP, etc) para campos calculados.
4. DESIGN: Gere um tema elegante com cores Hex.
5. FORMATO: Siga rigorosamente o schema JSON fornecido.`,
      generationConfig: {
        responseMimeType: "application/json",
        temperature: 0.1,
        maxOutputTokens: 8192
      }
    });
  }

  async generateSpreadsheetAndNextSteps(userPrompt: string): Promise<any> {
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
      let text = result.response.text();

      // Limpeza robusta para garantir JSON válido
      text = text.trim();
      if (text.startsWith("```json")) text = text.replace(/^```json/, "");
      if (text.endsWith("```")) text = text.replace(/```$/, "");
      text = text.trim();

      return JSON.parse(text);
    } catch (error: any) {
      console.error("AI Error Specifics:", error);
      throw new Error(`Erro na IA: ${error.message || "Falha na estrutura JSON"}`);
    }
  }
}
