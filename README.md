# Spreadsheet-as-a-Service AI 🚀

Gerador de planilhas inteligente usando **Node.js + Express + Vue 3 + Gemini**.

## 🛠️ Como rodar o projeto

### 1. Configurar o Backend
1. Entre na pasta `backend`.
2. Renomeie ou edite o arquivo `.env`.
3. Configure as variáveis no `.env` (exemplo em `.env.example`):
   ```env
   GEMINI_API_KEY=sua_chave_aqui
   JWT_SECRET=segredo_com_no_minimo_32_caracteres
   APP_URL=https://seu-dominio.com
   CORS_ORIGINS=https://seu-dominio.com,http://localhost:5173
   MP_ACCESS_TOKEN=seu_token_mercadopago
   MP_WEBHOOK_SECRET=seu_secret_webhook_mercadopago
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
