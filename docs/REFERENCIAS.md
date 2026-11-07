# Referências

Acompanhamento da refatoração do OrganizaGrana: monorepo, novo visual (Aurora), lógica corrigida e backend em Go.

**Como usar:** `[ ]` = pendente · `[ ok ]` = feito e verificado. Troque `[ ]` por `[ ok ]` a cada mudança concluída.

---

## Decisões

- [ ] Monorepo com `apps/web` (React, Tailwind, shadcn, TypeScript, Zustand) e `apps/api` (Go)
- [ ] Banco de dados: PostgreSQL
- [ ] Redis: refresh tokens, rate limit de login e cache dos resumos mensais
- [ ] Login por e-mail e senha (argon2id + JWT), com papéis `user` e `admin`
- [ ] Ordem: front primeiro (dados locais), API depois, troca da fonte de dados por último
- [ ] Visual: protótipo B "Aurora" (escuro, violeta e ciano, abas no topo, painel em blocos)
- [ ] Confirmar o nome do produto (Aurora ou outro) antes da Fase 2
- [ ] Uma única ação "Lançar" (modal com abas Despesa, Renda e Crédito); as listas não têm botões de adicionar

## Fase 0: Monorepo sem mudar comportamento

- [ ok ] Criar branch de trabalho (`refactor/monorepo-aurora`)
- [ ok ] Mover o front atual para `apps/web` com `git mv`
- [ ok ] Criar `pnpm-workspace.yaml` (e um `package.json` raiz com os scripts `dev`, `build` e `lint`)
- [ ok ] Liberar os scripts de build do `esbuild` e do `core-js` (`allowBuilds`) para o `pnpm dev` funcionar
- [ ] `pnpm dev` e `pnpm build` funcionando como antes
  - `pnpm dev` e `vite build` funcionam. `pnpm build` ainda falha no `tsc -b` por um erro que já existia (`Mocks/ExpensesExamples.tsx`), corrigido na Fase 5.

## Fase 1: Fundação da lógica (front)

- [ ok ] `src/lib/money.ts`: `parseBRL`, `formatBRL` e valores em centavos inteiros
- [ ok ] Remover os 3 `formatCurrency` duplicados
- [ ok ] Camada de domínio pura em `src/domain/` (sem React e sem Zustand)
- [ ok ] Listas, contadores e gráficos filtrados por mês
- [ ok ] Crédito parcelado incluído nos totais, no saldo e no PDF
- [ ok ] Despesa e renda fixas respeitando o mês de início
- [ ok ] Valor `0` por mês tratado como válido em `monthlyValues`
- [ ok ] Renda fixa com ocultar e restaurar por mês, como a despesa fixa
- [ ok ] Cadastros e notas usando `currentMonth` da store, não `new Date()`
- [ ok ] Vitest configurado e testes do domínio
  - 55 testes: dinheiro, domínio e repositório/migração.
- [ ok ] Interface `FinanceRepository` e `LocalRepository`
- [ ok ] Zustand guardando só estado de tela e cache
- [ ok ] `persist` com `version` e `migrate` para não perder os dados atuais
  - O versionamento ficou no `LocalRepository` (chave `aurora:finance`, versão 1, valores em centavos). Os dados antigos (`finance-storage`, em reais) são convertidos uma vez e o backup é mantido.

## Fase 2: Tema Aurora

- [ ] Tokens do protótipo B em `src/index.css`
- [ ] Mapear os tokens para as variáveis do shadcn e para o `tailwind.config.js`
- [ ] Fontes Sora e Figtree
- [ ] Alternância entre claro e escuro, com a escolha salva
- [ ] Remover as classes soltas `bg-slate-900`, `border-slate-600` e `green-800`
- [ ] Nova logo e nome no app e no `index.html`

## Fase 3: Layout e telas

- [ ] `AppShell` com abas no topo (substitui `AppSideBar`)
- [ ] Container responsivo `max-w-[1240px]`, sem `w-[1380px]` e `mx-44`
- [ ] Rotas `/painel`, `/lancamentos`, `/projecao`, `/comparacao`, `/metas` e `/relatorios`
- [ ] Seletor de mês global no cabeçalho
- [ ] Painel somente leitura (saldo, tendência, categorias, sugestão, metas, 5 últimas despesas)
- [ ] Tela Lançamentos com rendas, despesas e parcelas
- [ ] `TransactionForm` único em modal (substitui `AddExpenses` e `AddIncome`)
- [ ] Componentes `StatCard`, `ConfirmDeletion` e `CategorySelect`
- [ ] Gráficos em Recharts usando os tokens
- [ ] Sem rolagem horizontal em 400px

## Fase 4: Telas que hoje são mock

- [ ] Metas: tipo `Goal`, criar, editar, excluir e aportar
- [ ] Projeção futura: despesas extras e `getProjection`
- [ ] Comparação: seleção de meses, ranking, barras, radar e categorias
- [ ] Relatórios: exportar PDF (`exportPDF` com o mês por parâmetro)
- [ ] Relatórios: exportar CSV
- [ ] Relatórios: exportar TXT

## Fase 5: Limpeza e correções

- [ ] Remover `Navbar.tsx`, `EditableAmount.tsx`, `Mocks/*`, `Types/Incomes.tsx`, `SideBarStore.ts` e `ListExtraExpenses.tsx`
- [ ] Remover `console.log` e blocos comentados
- [ ok ] Corrigir `EditableName` (a edição não fecha depois de salvar) (feito na Fase 1)
- [ ] Corrigir `grid-cols-[auto,1fr,auto]` em `ExpenseCard.tsx`
- [ ] Zerar os erros de TypeScript (`tsc -b`)
- [ ] Zerar os avisos do `pnpm lint`

## Fase 6: Backend em Go

- [ ] Estrutura `apps/api` (chi, pgx, sqlc, goose)
- [ ] Migrations: `users`, `refresh_tokens`, `transactions`, `fixed_overrides`, `credit_purchases`, `goals`, `extra_expenses`, `notes`
- [ ] Autenticação: cadastro, login, refresh e logout
- [ ] Hash de senha com argon2id
- [ ] Refresh token rotativo em cookie `httpOnly`, com hash no Redis
- [ ] Rate limit de login no Redis
- [ ] CRUD de transações, crédito, metas, extras e notas
- [ ] Resumo mensal, projeção e comparação
- [ ] Cache do resumo no Redis, invalidado a cada escrita
- [ ] Endpoint de importação dos dados do `localStorage`
- [ ] `docker-compose` com Postgres, Redis, API e web
- [ ] Testes em Go

## Fase 7: Integração front e back

- [ ] `docs/openapi.yaml` como contrato
- [ ] `packages/api-types` com os tipos gerados
- [ ] `ApiRepository`
- [ ] Telas de login e cadastro
- [ ] Rotas protegidas e renovação automática do token
- [ ] `VITE_DATA_SOURCE=local|api`
- [ ] Tela de importação dos dados locais

## Fase 8: CI e documentação

- [ ] GitHub Actions: lint, `tsc -b`, Vitest, `go vet` e `go test`
- [ ] `Makefile` com `make dev`
- [ ] `.env.example`
- [ ] README atualizado

## Correções apontadas na auditoria

- [ ok ] Despesas e rendas de outros meses aparecendo no mês atual
- [ ok ] Gráfico de despesas com totais incoerentes
- [ ok ] `NaN` ao digitar valores como "1.234,56"
- [ ok ] `pattern="[0-9]*"` bloqueando centavos no formulário de despesa
- [ ok ] Edição inline com `type="number"` rejeitando vírgula
- [ ok ] Renda fixa editada alterando todos os meses
- [ ok ] Lixeira desabilitada para despesa e renda fixas
- [ ] Navegação entre meses limitada (sem futuro, bloqueada por mês vazio)
  - Parcial: mês vazio no meio não trava mais a volta (usa `getAvailableMonths`). Avançar para meses futuros fica para o seletor global da Fase 3.
- [ ok ] `MoneyCard` e `SummaryCard` sem reagir à troca de mês
- [ ok ] Percentuais de distribuição duplicados em `getDistribuition` e `CardPositive`
- [ ] Nomes trocados entre arquivo e função (`BarsGraph`, `CategoryGraph`)
- [ ] Botão "Cancelar" da despesa extra enviando o formulário
- [ ] Botão "Criar Meta" recarregando a página
