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
- [ ok ] Visual: protótipo B "Aurora" (escuro, violeta e ciano, abas no topo, painel em blocos)
- [ ] Confirmar o nome do produto (Aurora ou outro) antes da Fase 2
- [ ok ] Uma única ação "Lançar" (modal com abas Despesa, Renda e Crédito); as listas não têm botões de adicionar

## Fase 0: Monorepo sem mudar comportamento

- [ ok ] Criar branch de trabalho (`refactor/monorepo-aurora`)
- [ ok ] Mover o front atual para `apps/web` com `git mv`
- [ ok ] Criar `pnpm-workspace.yaml` (e um `package.json` raiz com os scripts `dev`, `build` e `lint`)
- [ ok ] Liberar os scripts de build do `esbuild` e do `core-js` (`allowBuilds`) para o `pnpm dev` funcionar
- [ ok ] `pnpm dev` e `pnpm build` funcionando como antes
  - O erro antigo de `tsc -b` (`Mocks/ExpensesExamples.tsx`) sumiu com a remoção dos mocks.

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

- [ ok ] Tokens do protótipo B em `src/index.css`
- [ ok ] Mapear os tokens para as variáveis do shadcn e para o `tailwind.config.js`
- [ ok ] Fontes Sora e Figtree
- [ ok ] Alternância entre claro e escuro, com a escolha salva
- [ ok ] Remover as classes soltas `bg-slate-900`, `border-slate-600` e `green-800`
- [ ok ] Nova logo e nome no app e no `index.html`
  - O protótipo B não está no repositório: a paleta (violeta `262`, ciano `188`, fundo escuro `252`) foi definida a partir da descrição. Ajuste os valores em `src/index.css` se o protótipo diferir.
  - Tema escuro é o padrão; escolha salva em `aurora:theme` (`src/theme/`). Classes soltas trocadas por tokens (`bg-card`, `border-border`, `text-primary` etc.), com `success` e `destructive` para positivo e negativo.
  - Nome "Aurora" assumido (constante `APP_NAME` em `src/theme/theme.ts`); confirme na decisão pendente.

## Fase 3: Layout e telas

- [ ok ] `AppShell` com abas no topo (substitui `AppSideBar`)
- [ ok ] Container responsivo `max-w-[1240px]`, sem `w-[1380px]` e `mx-44`
- [ ok ] Rotas `/painel`, `/lancamentos`, `/projecao`, `/comparacao`, `/metas` e `/relatorios`
- [ ok ] Seletor de mês global no cabeçalho
  - Avançar para meses futuros continua bloqueado (só até o mês atual); decidir se libera junto da Projeção.
- [ ok ] Painel somente leitura (saldo, tendência, categorias, sugestão, metas, 5 últimas despesas)
  - O bloco de metas é um atalho para `/metas`; o acompanhamento real vem na Fase 4.
- [ ok ] Tela Lançamentos com rendas, despesas e parcelas
- [ ok ] `TransactionForm` único em modal (substitui `AddExpenses` e `AddIncome`)
- [ ok ] Componentes `StatCard`, `ConfirmDeletion` e `CategorySelect`
- [ ok ] Gráficos em Recharts usando os tokens
  - Substituído: os gráficos são SVG próprios portados do protótipo B (`src/components/charts/`), com os tokens do tema. O Recharts não é mais usado.
- [ ok ] Sem rolagem horizontal em 400px
  - Conferido no navegador (Playwright) nas 6 rotas, em claro e escuro. Telas mock (Projeção, Comparação, Relatórios) foram só ajustadas; serão refeitas na Fase 4.

## Fase 3.5: Fidelidade ao protótipo B (artefato claude.ai/artifact/6SxZzgW4u5jYVHB1Duzxnp)

- [ ok ] Paleta exata (hex do protótipo) nos temas claro e escuro, em `src/index.css`
- [ ok ] Fontes Sora (títulos e números) e Figtree (texto), raios 20px/12px e brilho radial de fundo
- [ ok ] Cabeçalho: marca em gradiente, abas em pílula com ícones, tema e botão Lançar
- [ ok ] Painel igual ao protótipo (saldo em destaque, 6 meses, rosca, sugestão, metas, despesas, anotações)
- [ ok ] Lançamentos igual ao protótipo (rendas + anotações à esquerda, despesas à direita)
- [ ok ] Modal "Novo lançamento" (Despesa, Renda, Crédito parcelado)
- [ ok ] Gráficos de linha e rosca portados do protótipo, com tooltip
- [ ok ] Projeção, Comparação, Metas e Relatórios no layout do protótipo (feitos junto da Fase 4, que dá a lógica)
- [ ok ] Gráficos de barras agrupadas e radar do protótipo (Fase 4)
  - Diferenças assumidas: o seletor de mês global fica no cabeçalho (o protótipo não tem); o título do Painel é "Painel", sem o nome do usuário; o bloco de metas do Painel mostra estado vazio até a Fase 4. Os botões "Nova renda" e "Nova despesa" nos cartões seguem o protótipo (a decisão anterior de listas sem botões foi substituída).

## Ajustes pedidos após a Fase 4

- [ ok ] Observação na despesa (campo no Novo lançamento; aparece na linha da lista e no menu Editar)
- [ ok ] Categorias personalizadas com cor própria (criar no formulário, apagar na janela de categorias; cor aparece em listas e gráficos)
- [ ok ] Menu ⋮ nos lançamentos e anotações (Editar, Fixar como atalho, Excluir)
- [ ok ] Lançamentos só para visualizar e ajustar: sem botões Nova renda e Nova despesa
- [ ok ] Modal Lançar continua aberto após cadastrar (fecha com Esc, X ou clique fora)
- [ ok ] Editar anotações
- [ ok ] Despesa extra cadastrada pelo Lançar (aba Despesa extra); botões removidos da Projeção
- [ ok ] Comparação: só meses com movimentação, aviso com menos de 2 meses, até 5 meses
- [ ok ] Cabeçalho sem a caixa atrás dos botões (transparente no topo, com fundo só ao rolar)
- [ ] ~~Nova opção no Crédito parcelado~~ (descartada)
  - Repositório na versão 3 (`customCategories`), com migração de v1 e v2.

## Fase 4: Telas que hoje são mock

- [ ok ] Metas: tipo `Goal`, criar, editar, excluir e aportar
- [ ok ] Projeção futura: despesas extras e `getProjection`
- [ ok ] Comparação: seleção de meses, ranking, barras, radar e categorias
- [ ok ] Relatórios: exportar PDF (`exportPDF` com o período por parâmetro)
- [ ok ] Relatórios: exportar CSV
- [ ok ] Relatórios: exportar TXT

## Fase 5: Limpeza e correções

- Fase concluída. Também saíram dependências sem uso (`recharts`, `@recharts/devtools`, `react-icons`, radix separator e tooltip) e o gerador de PDF passou a ser carregado só quando se exporta (pacote principal de 918 KB para 495 KB).

- [ ok ] Remover `Navbar.tsx`, `EditableAmount.tsx`, `Mocks/*`, `Types/Incomes.tsx`, `SideBarStore.ts` e `ListExtraExpenses.tsx`
- [ ok ] Remover `console.log` e blocos comentados
- [ ok ] Corrigir `EditableName` (a edição não fecha depois de salvar) (feito na Fase 1)
- [ ok ] Corrigir `grid-cols-[auto,1fr,auto]` em `ExpenseCard.tsx`
- [ ok ] Zerar os erros de TypeScript (`tsc -b`)
- [ ok ] Zerar os avisos do `pnpm lint`
  - `pnpm lint`, `tsc -b` e `pnpm build` passam sem avisos.

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
- [ ok ] Navegação entre meses limitada (sem futuro, bloqueada por mês vazio)
  - O seletor global não passa do mês atual e mês vazio no meio não trava a volta.
- [ ok ] `MoneyCard` e `SummaryCard` sem reagir à troca de mês
- [ ok ] Percentuais de distribuição duplicados em `getDistribuition` e `CardPositive`
- [ ok ] Nomes trocados entre arquivo e função (`BarsGraph`, `CategoryGraph`)
- [ ok ] Botão "Cancelar" da despesa extra enviando o formulário
- [ ok ] Botão "Criar Meta" recarregando a página
