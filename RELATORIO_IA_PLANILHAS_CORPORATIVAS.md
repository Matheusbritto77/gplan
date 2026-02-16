# Relatorio Tecnico: Evolucao da Geracao de Planilhas com IA

Data: 16/02/2026  
Escopo: melhorar o fluxo IA -> JSON -> planilha e elevar a qualidade para padrao corporativo/multinacional.

## 1) Resumo Executivo

Hoje o produto ja gera planilhas uteis, mas o pipeline ainda e "single-shot": uma resposta da IA vira schema e segue direto para exportacao. Isso funciona para casos simples, porem cria risco em cenarios complexos (financas, controladoria, planejamento corporativo) onde formula, governanca, rastreabilidade e padrao visual precisam ser muito mais estritos.

Para atingir nivel enterprise, a evolucao recomendada e:

1. Contrato de dados versionado e estrito (sem ambiguidade).
2. Pipeline em etapas (planejar, gerar, validar, corrigir).
3. Biblioteca de templates corporativos por dominio.
4. Validacoes semanticas e de seguranca antes de exportar.
5. Modo de geracao "Corporate" com artefatos de auditoria e governanca.

## 2) Diagnostico do Estado Atual

## 2.1 Fluxo atual

1. O backend gera JSON via Gemini em `backend/src/providers/AIProvider.ts`.
2. O parser tenta recuperar JSON quebrado (`parseJsonSafely`) e faz validacao minima (`assertShape`).
3. O controller repassa o schema para exportacao em `backend/src/controllers/SpreadsheetController.ts`.
4. A exportacao usa `ExcelJS` em `backend/src/services/SpreadsheetService.ts`.
5. O endpoint `/api/download` valida payload com Zod em `backend/src/validators/requestSchemas.ts`.

## 2.2 Pontos fortes atuais

1. Uso de `responseMimeType: "application/json"` no modelo (boa base).
2. Reparo automatico de JSON truncado.
3. Validacao de entrada com Zod no download.
4. Sanitizacao de nomes de abas e arquivo.
5. Estilizacao e formatos basicos ja implementados.

## 2.3 Gaps tecnicos que limitam escala corporativa

1. Validacao da resposta da IA ainda superficial:
   - `assertShape` valida so existencia de `schema`, `followUp`, `suggestions`.
   - Nao valida profundamente estrutura, tipos, coerencia de colunas/linhas e formula.
2. Ausencia de contrato versionado:
   - nao existe `schemaVersion` para evolucao controlada e retrocompatibilidade.
3. Pipeline sem "quality gates":
   - a IA gera e o sistema tenta consumir direto.
4. CSV com comportamento ambiguo para multiplas abas:
   - em geral, CSV representa uma unica aba; para uso corporativo, isso precisa de regra explicita.
5. Recursos enterprise ausentes:
   - tabelas estruturadas, dashboards, pivot, validacao de dados, protecao, trilha de auditoria.
6. Risco de seguranca em formulas:
   - falta whitelist/regras para bloquear formulas potencialmente perigosas.
7. Observabilidade limitada:
   - nao ha metricas detalhadas de qualidade da geracao (taxa de parse, taxa de retrabalho, erros semanticos).

## 3) Arquitetura Alvo (Padrao Enterprise)

## 3.1 Contrato canonico (DSL de planilha)

Definir um contrato intermediario interno, por exemplo `SpreadsheetDSL v1`, com:

1. `schemaVersion`.
2. `metadata` (locale, moeda, calendario fiscal, unidade de negocio).
3. `workbook` (abas, relacionamentos, nomes nomeados, protecao).
4. `validationRules`.
5. `audit` (origem dos dados, assumptions, notas).

Beneficio: o motor de exportacao passa a depender de um contrato estavel, nao de JSON "livre" vindo do modelo.

## 3.2 Pipeline em 4 etapas

1. Planner:
   - IA interpreta prompt e produz plano estruturado (abas, objetivo, KPIs, formulas-chave).
2. Builder:
   - IA (ou combinacao IA + templates) gera `SpreadsheetDSL` completo.
3. Validator:
   - regras tecnicas e de negocio validam estrutura, tipos, formulas e consistencia.
4. Fixer:
   - quando falhar, aplicar correcao guiada por erro especifico e revalidar.

Somente apos passar no gate de validacao o arquivo e exportado.

## 3.3 Modo de operacao por nivel

1. `standard`:
   - rapido e barato, para casos simples.
2. `corporate`:
   - pipeline completo, templates oficiais, validacao semantica e artefatos de auditoria.

## 4) Como elevar para planilhas avancadas corporativas

## 4.1 Capacidades funcionais alvo

1. Multi-aba com arquitetura padrao:
   - `Input`, `Base`, `Calculos`, `Dashboards`, `Assumptions`, `Audit`.
2. Formulas corporativas:
   - referencias entre abas, totais, variancia, margem, crescimento, comparativo YoY/MoM.
3. Governanca de dados:
   - validacao de dados (listas), campos obrigatorios, limites numericos.
4. Visual corporativo:
   - tema por brandbook, formatos monetarios/percentuais por locale, estilos padronizados.
5. Controles:
   - congelamento de paines, protecao de celulas, abas ocultas tecnicas.
6. Saida executiva:
   - dashboard pronto para diretoria, KPIs, semaforos, observacoes.

## 4.2 Recursos tecnicos recomendados no motor Excel

1. Suporte a tabelas estruturadas (`Table`) e nomes nomeados (`Named Ranges`).
2. Regras de formatacao condicional.
3. Data validation (drop-down, intervalos, regex quando aplicavel).
4. Definicao de formulas por coluna com referencias consistentes.
5. Separacao entre camada de dados e camada visual.

## 4.3 Catalogo de templates corporativos

Criar biblioteca de templates por dominio:

1. Financeiro (DRE, fluxo de caixa, budget vs actual).
2. Comercial (pipeline, forecast, cohort, metas regionais).
3. Operacoes (SLA, produtividade, backlog, capacidade).
4. Supply/Logistica (OTIF, lead time, ruptura, giro).
5. RH (headcount, turnover, custo por area, absenteismo).

Cada template deve conter:

1. Estrutura base de abas.
2. Formulas homologadas.
3. Regras de validacao.
4. Checklist de QA.

## 5) Qualidade, Seguranca e Confiabilidade

## 5.1 Validacao semantica obrigatoria

1. Toda chave de linha deve existir nas colunas.
2. Toda formula deve referenciar celulas/abas validas.
3. Tipos coerentes: data, numero, texto, percentual, moeda.
4. Limites de volume por plano (linhas/abas/complexidade).

## 5.2 Seguranca

1. Bloquear formulas perigosas por politica.
2. Proteger contra CSV injection em campos iniciados por `=`, `+`, `-`, `@`.
3. Sanitizar links externos e referencias desconhecidas.
4. Logar decisoes de bloqueio para auditoria.

## 5.3 Observabilidade e SLOs

Metricas recomendadas:

1. `ai_json_valid_first_pass_rate`.
2. `ai_repair_rate`.
3. `schema_validation_fail_rate`.
4. `download_failure_rate`.
5. `avg_generation_latency_ms`.
6. `corporate_template_reuse_rate`.
7. `user_edit_after_download_rate` (proxy de qualidade do primeiro resultado).

## 6) Plano de Implementacao (Roadmap)

## Fase 0 (1 semana) - Base de controle

1. Adicionar telemetry por etapa do pipeline.
2. Padronizar codigos de erro (`AI_PARSE_ERROR`, `SCHEMA_INVALID`, `FORMULA_BLOCKED`).
3. Definir KPIs e baseline.

## Fase 1 (2 semanas) - Contrato forte

1. Introduzir `schemaVersion`.
2. Criar `zod` estrito para resposta da IA (profundo).
3. Remover `any` nos pontos principais do fluxo.
4. Validar semanticamente colunas, linhas e formulas.

## Fase 2 (3 a 4 semanas) - Pipeline robusto

1. Separar Planner/Builder/Validator/Fixer.
2. Implementar fallback para template quando prompt for corporativo.
3. Criar modo `standard` e `corporate`.

## Fase 3 (4 a 6 semanas) - Recursos enterprise

1. Implementar tabelas estruturadas, data validation e named ranges.
2. Criar biblioteca inicial de templates corporativos.
3. Adicionar abas `Assumptions` e `Audit` no modo corporate.

## Fase 4 (continuo) - QA e evolucao

1. Suite de prompts de regressao (golden set).
2. Testes automatizados de formula e consistencia.
3. Ajuste continuo de prompt+templates com base em metricas de uso.

## 7) Mudancas praticas por arquivo (prioridade alta)

1. `backend/src/providers/AIProvider.ts`:
   - trocar validacao minima por contrato tipado completo.
   - separar fluxo em etapas e retornar metadados de qualidade.
2. `backend/src/validators/requestSchemas.ts`:
   - criar schema estrito para DSL versionado.
3. `backend/src/services/SpreadsheetService.ts`:
   - adicionar camada de validacao semantica antes de escrever workbook.
   - incluir recursos corporativos (tables, validations, conditional formatting).
4. `backend/src/controllers/SpreadsheetController.ts`:
   - orquestrar pipeline com gates e erros explicitos por etapa.
5. `frontend/src/services/AnalyticsService.ts`:
   - enviar eventos de qualidade da geracao para fechar ciclo de melhoria.

## 8) Criterios de sucesso para "padrao multinacional"

1. >= 95% de schemas validos na primeira passada (sem reparo).
2. >= 99% de downloads sem erro em `xlsx`.
3. <= 2% de falhas semanticas detectadas no validator.
4. <= 3 minutos para geracao corporate completa (com dashboard e audit).
5. >= 80% de satisfacao em prompts corporativos (feedback usuario).

## 9) Proximo passo recomendado

Implementar primeiro um MVP do modo `corporate` com:

1. 2 templates homologados (Financeiro e Comercial).
2. DSL versionado.
3. Validator semantico.
4. Abas `Assumptions` e `Audit`.

Esse conjunto ja aumenta muito a confiabilidade e posiciona o produto para clientes empresariais de maior exigencia.
