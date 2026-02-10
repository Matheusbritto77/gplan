import { GoogleGenerativeAI, GenerativeModel } from "@google/generative-ai";

export class AIProvider {
  private genAI: GoogleGenerativeAI;
  private model: GenerativeModel;

  constructor(apiKey: string) {
    this.genAI = new GoogleGenerativeAI(apiKey);
    // Usando o modelo solicitado pelo usuário (mantendo o ajuste manual dele se possível ou corrigindo para versão estável)
    this.model = this.genAI.getGenerativeModel({
      model: "gemini-2.5-flash",
      generationConfig: {
        responseMimeType: "application/json",
        temperature: 0.2
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
    const prompt = `
      Pedido do usuário: "${userPrompt}"
      
      OBJETIVO: Gere uma planilha PREMIUM, COMPLETA e COM DESIGN REFINADO.
      A planilha deve vir OBRIGATORIAMENTE preenchida com no mínimo 20 linhas de dados realistas. 
      NÃO use placeholders como "Dado 1", "Valor A". Use nomes, datas e valores que façam sentido absoluto.
      
      REGRAS CRUCIAIS:
      1. IDIOMA: Detecte o idioma do prompt ("${userPrompt}") e responda TODA a planilha (títulos, colunas, dados) nesse exato idioma.
      2. DESIGN: Defina uma paleta de cores (hex) elegante. O cabeçalho deve ter contraste alto.
      3. DADOS: Gere uma massa de dados densa. Se for uma planilha financeira, invente transações reais. 
      4. FORMULAS: OBRIGATORIAMENTE use fórmulas do Excel para campos calculados (ex: totais, médias, descontos, ROIs). 
         - Use a sintaxe padrão do Excel em INGLÊS (ex: =SUM(A1:A10), =VLOOKUP(...), =IF(...)).
      5. FORMATOS: Use o campo "format" para definir se a coluna é "currency", "date", "percentage", ou "number".
      
      FORMA DE RESPOSTA (JSON):
      {
        "schema": {
          "title": "...",
          "description": "...",
          "theme": { ... },
          "sheets": [{
            "name": "...",
            "freezePanes": { "x": 0, "y": 1 }, // Ex: congelar cabeçalho
            "autoFilter": true, // Habilitar filtros automáticos
            "columns": [
              { "header": "...", "key": "k1", "width": 20, "format": "currency" }
            ],
            "rows": [
              { 
                "k1": 150.50, // Valor bruto para dados normais
                "k2": { "formula": "SUM(A2:A21)" } // Fórmulas para campos de ação
              }, ... (mínimo 20 linhas)
            ]
          }]
        },
        "followUp": "...",
        "suggestions": [...]
      }
    `;
    return await this.generateStructuredResponse(prompt);
  }
}
