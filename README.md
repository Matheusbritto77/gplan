# Spreadsheet-as-a-Service AI 🚀

Gerador de planilhas inteligente usando **Bun + Elysia + Vue 3 + Gemini 2.0 Flash**.

## 🛠️ Como rodar o projeto

### 1. Configurar o Backend
1. Entre na pasta `backend`.
2. Renomeie ou edite o arquivo `.env`.
3. Adicione sua chave de API do Gemini:
   ```env
   GEMINI_API_KEY=sua_chave_aqui
   ```
4. Instale as dependências e rode:
   ```bash
   npm install
   npm run dev
   ```

### 2. Configurar o Frontend
1. Entre na pasta `frontend`.
2. Instale as dependências e rode:
   ```bash
   npm install
   npm run dev
   ```

### 🌟 Funcionalidades
- **Análise Contextual**: A I.A. pergunta se precisar de mais detalhes antes de gerar.
- **Preview em Tempo Real**: Veja os dados antes de baixar.
- **Múltiplos Formatos**: Exportação para `.xlsx` e `.csv`.
- **Design Premium**: Interface moderna com Dark Mode e Glassmorphism.

## 🏗️ Arquitetura (SOLID)
- **AIProvider**: Abstração da lógica da IA.
- **SpreadsheetService**: Responsável puramente pela criação do arquivo físico.
- **SpreadsheetController**: Orquestra o fluxo de dados.
- **Frontend Reactive**: Vue 3 com Composition API.
