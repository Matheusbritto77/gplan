# 📊 Relatório de Melhorias e Próximos Passos - SheetAI (GPlan)

Este documento detalha as oportunidades de melhoria técnica e funcional para o sistema, com foco em escalabilidade, experiência do usuário e robustez arquitetural.

---

## 🏗️ 1. Arquitetura e Performance

### **Migração para Stream (Escalabilidade)**
Atualmente, o sistema processa a planilha inteira na memória antes do download. 
- **Melhoria**: Usar streams (`exceljs` streaming) para gerar arquivos grandes sem travar o servidor.
- **Impacto**: Redução drástica no uso de RAM em ambientes de produção (VPS).

### **Caching de Respostas**
Muitas solicitações podem ser similares ou repetidas.
- **Melhoria**: Implementar um Redis ou cache local (lru-cache) para armazenar schemas gerados por prompts comuns.
- **Impacto**: Respostas instantâneas e economia de créditos da API do Gemini.

### **Fila de Processamento (Jobs)**
O processamento da IA pode demorar mais que o tempo de timeout de alguns navegadores ou proxys.
- **Melhoria**: Implementar `BullMQ` para gerenciar as gerações em segundo plano.
- **Impacto**: O usuário recebe uma notificação ou status de "processando" em vez de esperar um request HTTP travado.

---

## 🤖 2. Inteligência Artificial (Gemini)

### **Contextualização de Longo Prazo**
- **Melhoria**: Integrar um banco de dados vetorial (como Pinecone ou SQLite-VSS) para "lembrar" das preferências de estilo e regras de negócio do usuário entre sessões diferentes.

### **Validação de Schema Rigorosa**
- **Melhoria**: Refinar o uso do `zod` no backend para validar não apenas o JSON, mas se os cálculos (fórmulas) sugeridos pela IA são válidos no Excel/Sheets.

---

## 🎨 3. Experiência do Usuário (UI/UX)

### **Edição Real-time na Planilha**
- **Melhoria**: Integrar uma biblioteca de grid editável (como `AG-Grid` ou `Handsontable`) na pré-visualização.
- **Impacto**: O usuário poderia ajustar valores diretamente na web antes de baixar o arquivo.

### **Multi-Abas e Templates**
- **Melhoria**: Permitir que a IA gere múltiplas abas (`Worksheets`) em um único arquivo de forma estruturada (ex: Aba "Dashboard" + Aba "Dados Brutos").

### **Suporte a Fórmulas Dinâmicas**
- **Melhoria**: Instruir a IA a gerar fórmulas nativas do Excel em vez de apenas texto estático.

---

## 🔒 4. Segurança e Segurança

### **Autenticação e Planos (SaaS Ready)**
- **Melhoria**: Implementar `NextAuth` ou JWT simples com integração `Stripe` para monetização por "gerações de planilhas".

### **Sanitização de Dados**
- **Melhoria**: Adicionar uma camada de segurança para filtrar prompts maliciosos (Prompt Injection) que possam tentar extrair a API Key do servidor.

---

## 🚀 5. DevOps e Infraestrutura

### **Log Centralizado**
- **Melhoria**: Configurar um logger profissional (`Pino` ou `Winston`) para monitorar erros de geração em tempo real na VPS.

### **CI/CD Automatizado**
- **Melhoria**: Criar GitHub Actions para rodar testes automatizados e buildar a imagem Docker sempre que houver um `push` na `main`.

---

**Elaborado por:** Antigravity AI
**Status:** Em Evolução Constante 🚀
