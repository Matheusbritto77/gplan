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
1. IDIOMA: Responda exatamente no idioma solicitado pelo usuário (padrão: Português).
2. DADOS: Mínimo 20 linhas de dados REAIS e DENSOS. Evite placeholders.
3. FÓRMULAS: Use fórmulas Excel padrão (SUM, IF, VLOOKUP, etc) para campos calculados.
4. DESIGN: Gere um tema elegante com cores Hex (ex: headerBg, headerText, rowOddBg).
5. FORMATO: Siga rigorosamente o schema JSON fornecido.`,
      generationConfig: {
        responseMimeType: "application/json",
        temperature: 0.1,
        maxOutputTokens: 2500
      }
    });
  }

  async generateStructuredResponse(prompt: string): Promise<any> {
    try {
      const result = await this.model.generateContent(prompt);
      const response = await result.response;
      return JSON.parse(response.text());
    } catch (error) {
      console.error("Erro na AI:", error);
      throw new Error("Falha ao processar solicitação com IA.");
    }
  }

  async generateSpreadsheetAndNextSteps(userPrompt: string): Promise<any> {
    const prompt = `Gere uma planilha para: "${userPrompt}". 
Retorne um JSON com:
{
  "schema": {
    "title": "Título",
    "description": "Explicação",
    "theme": { "headerBg": "#...", "headerText": "#...", "rowEvenBg": "#...", "rowOddBg": "#...", "borderColor": "#..." },
    "sheets": [{
      "name": "Sheet1",
      "showTitle": true,
      "autoFilter": true,
      "columns": [{ "header": "...", "key": "col1", "width": 15, "format": "currency/date/percentage/number" }],
      "rows": [{ "col1": 100, "col2": { "formula": "..." } }]
    }]
  },
  "followUp": "Pergunta de refinamento",
  "suggestions": ["Sugestão 1", "Sugestão 2"]
}`;

    try {
      const result = await this.model.generateContent(prompt);
      const text = result.response.text();
      return JSON.parse(text);
    } catch (error) {
      console.error("AI Error:", error);
      throw new Error("Erro na aceleração por IA. Verifique sua conexão.");
    }
  }
}
