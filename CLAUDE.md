@AGENTS.md

# Portal Nero — Advisor de Dados (DAMA-DMBOK2)

Portal web que transforma a **Nero** (um advisor sênior de dados, hoje um Claude
Project) no **motor central** de um portal de governança de dados para o cliente
**LM** (executora: Blite/Venice Tech). O Nero atua como **Guia** (conduz a
operação, desafia decisões) e **Executor** (gera documentos no padrão DAMA, report
quinzenal, atualiza a memória do projeto).

> Idioma do produto e dos artefatos: **pt-BR**.

## Princípio central — Teoria × Realidade
O kit DAMA (`content/kit/08`, `09`) é a **teoria/ideal**. O catálogo real do LM é
desconhecido e só aparece no discovery. Todo fato estruturado carrega um **status de
verdade** (`template/teoria` · `assumido` · `confirmado` · `lacuna`) + proveniência.
Nunca tratar o template como verdade.

## Arquitetura
- **Nero Core** (`src/lib/nero/`) — único ponto de IA. Monta o contexto
  (system prompt = kit `00` + estado `01` + refs `06`/`08`/`09`) e chama a Claude API.
- **Kit de conhecimento** (`content/kit/00`–`09`) — o "cérebro" do Nero. Contexto
  base enxuto; documentos pesados do LM entram sob demanda (RAG, fase futura).
- **Frontend** (`src/app/`) — Next.js App Router, Tailwind + shadcn/ui.

## Stack
- Next.js (App Router) + TypeScript · Tailwind v4 + shadcn/ui
- `@anthropic-ai/sdk` — Claude. Padrão **`claude-sonnet-4-6`**; docs longos
  **`claude-opus-4-8`**.
- Banco (Fase 2+): a definir (SQLite local enquanto não há Docker; Postgres+pgvector
  no deploy/RAG).

## Comandos
- `npm run dev` — servidor de desenvolvimento (Turbopack)
- `npm run build` / `npm start` — build de produção
- `npm run lint` — ESLint

## Variáveis de ambiente (`.env.local`)
- `ANTHROPIC_API_KEY` — obrigatória para o motor.
- (futuras) `VOYAGE_API_KEY`, `DATABASE_URL`.

## Convenções
- O Nero Core é o **único** lugar que fala com a Claude API. UI e features nunca
  chamam o modelo direto.
- Antes de mexer na integração com a Claude API, consultar a skill `claude-api`
  (IDs de modelo, streaming, tool use) em vez de assumir de memória.
- Regra de isolamento (kit `00` §1.1): este projeto é **só LM**. Não importar
  contexto/stack de outros clientes.

## Atenção (Next.js)
Esta versão do Next pode ter breaking changes vs. conhecimento prévio — ver
`node_modules/next/dist/docs/` quando em dúvida sobre APIs/convenções.
