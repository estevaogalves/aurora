# Investimentos (Metas e Investimentos)

Acompanhamento do módulo de controle pessoal de investimentos do Aurora: registrar onde o dinheiro está investido, quanto foi aportado, quanto vale hoje e quanto rendeu, **sem integração** com bancos ou corretoras e sem atualização em tempo real.

**Como usar:** `[ ]` = pendente · `[ ok ]` = feito e verificado. Troque `[ ]` por `[ ok ]` a cada item concluído.

**Status:** tela, regras, backend em Go, aviso de vencimento no sino e tour prontos e validados nos **dois modos** (local e API). A migration `00012` **ainda não foi aplicada em nenhum banco real**: só rodou em Postgres descartável de teste. Nada foi para a `main`.

Plano original de planejamento: [`investimentos-planejamento.md`](investimentos-planejamento.md).

---

## Decisões

- [ ok ] **Onde fica:** sub-abas dentro da aba **Metas** (seletor **Metas | Investimentos** no topo). Não ganha aba nova, para não apertar a barra mobile (já são 6 abas, e 7 no modo local por causa de "Cartões").
- [ ok ] **Modelo:** entidades próprias, `Investment` e `InvestmentMovement`. Não é uma terceira modalidade de `Goal` (meta é o objetivo, investimento é o instrumento).
- [ ok ] **Histórico:** o investimento tem movimentações datadas: aporte, resgate, rendimento e atualização de valor.
- [ ok ] **Saldo do mês:** investimentos ficam **separados** do fluxo de caixa. `getMonthSummary`, `getProjection` e relatórios não são tocados (há teste garantindo). Aporte não é despesa e resgate não é receita.
- [ ok ] **Fora da v1:** gráfico de evolução do patrimônio, integração com o saldo, moeda estrangeira, cálculo de IR, vínculo com meta, benchmarks e aba "Mais" no mobile.
- [ ] Rótulo da aba continua **"Metas"**. "Metas e Investimentos" não cabe na barra mobile. A tela se apresenta pelo seletor interno. Reavaliar se o usuário não achar os investimentos.

## Tipos suportados

Select **Tipo** único, agrupado por família (só os produtos mais usados):

| Família | Produtos |
|---|---|
| Renda fixa | CDB, LCI, LCA |
| Tesouro Direto | Tesouro Selic, Tesouro IPCA+ |
| Liquidez diária | Poupança, Conta remunerada |
| Ações, FIIs e ETFs | Ação, FII, ETF |
| Fundos | Fundo de renda fixa, Fundo multimercado, Fundo de ações |
| Outros | Criptomoeda, Outro |

Um investimento com produto que saiu da lista continua editável (o produto antigo aparece no grupo dele).

## Cadastro

- Sempre visíveis: **Tipo, Nome, Banco/corretora/plataforma, Valor investido, Data da aplicação**. O resto fica em **"Mais detalhes (opcional)"**, recolhido.
- **Valor atual** não está no cadastro: começa igual ao investido e é atualizado depois, em **Movimentar → Atualização de valor**.
- **Vencimento** é sempre opcional (vazio = não tem, como liquidez diária). Aparece para renda fixa, Tesouro e Outros.
- **Ação, FII e ETF:** pedem **cotas e preço por cota**, e o valor investido é calculado (100 × R$ 30 = R$ 3.000).
- **Tesouro:** o indexador (Selic ou IPCA) sai do produto. A taxa não repete o indexador no card.
- **Poupança:** sem taxa nem indexador (regra própria).
- **Cripto e Outro:** campo "Código do ativo" (ex.: BTC). Nome e taxa têm exemplos por produto.
- Aviso (não bloqueia) quando cotas × preço médio não batem com o valor investido, nos tipos em que isso é opcional.

## Movimentar e histórico

- [ ok ] Aporte, resgate, rendimento e atualização de valor, cada um com data.
- [ ok ] Em investimento que controla cotas (ação, FII, ETF e qualquer um com quantidade), aporte e resgate pedem **quantidade e preço por cota**; o total é calculado. Resgate maior que as cotas em carteira é bloqueado.
- [ ok ] **Cotas e preço médio** são calculados pelas movimentações (preço médio ponderado). No Editar, eles não são editáveis à mão quando vêm das movimentações.
- [ ok ] **Histórico** ordenado por data (mais recente primeiro), com **Editar** e **Excluir** (confirmação na própria linha). Ao corrigir ou excluir, valor atual, cotas e preço médio são recalculados.
- [ ok ] O valor atual é **refeito pela ordem das datas** das movimentações (`replayInvestment`): um aporte retroativo entra na ordem certa, e uma atualização de valor vale só até a próxima movimentação posterior a ela.
- [ ok ] Depois de um resgate, aparece o aviso para registrar uma Atualização de valor se o preço da cota mudou (o valor atual cai pelo total resgatado).

## Cálculos

- **Total aportado** = soma dos aportes (o resgate aparece à parte).
- **Lucro** = valor atual + resgates − aportes.
- **Rentabilidade** = lucro ÷ aportes.
- Rendimento soma ao valor atual sem ser aporte. Atualização de valor define o valor atual.
- O valor atual nunca fica negativo. Limite de valor: R$ 1 bilhão.
- Cotas fracionárias aceitas (até 6 casas), em campo numérico à parte (centavos inteiros não bastam).

## Indicadores na tela

- [ ok ] Patrimônio investido, total aportado, lucro/prejuízo e rentabilidade.
- [ ok ] Distribuição por tipo e por instituição (rosca, reaproveitando `ChartDonut`).
- [ ok ] Próximos vencimentos (90 dias, inclui os já vencidos com valor).
- [ ok ] Card por investimento com lucro, taxa, vencimento, liquidez, carência, cotas e observações.

## Validação e usabilidade

- [ ok ] Erros aparecem **dentro do formulário**, em vermelho, e somem sozinhos quando qualquer campo muda.
- [ ok ] Validação nativa do navegador desligada (`noValidate`) nos dois formulários. Antes, o `min` do campo de data barrava o envio com o balão do navegador e a nossa mensagem nunca aparecia.
- [ ok ] Bloqueios com mensagem: nome vazio, banco vazio, valor zero ou acima do limite, vencimento anterior à aplicação, data de movimentação anterior à aplicação, carência anterior à aplicação, resgate maior que o saldo, resgate de mais cotas do que se tem.
- [ ok ] **Sinal negativo:** o campo mantém o `-` visível (`MoneyInput` com `keepSign`). Enquanto ele estiver lá, o aviso fica e o **Registrar fica desabilitado**. O bloqueio vem do valor do campo, então digitar tecla por tecla não o libera. Validado no Chrome real, digitando.
- [ ok ] Clicar fora do modal **não fecha** os formulários de cadastro e de movimentação (evita perder o que foi digitado).
- [ ok ] Mensagens de sucesso com a concordância certa ("Valor atualizado", "Aporte registrado").

## Arquivos

- Domínio: `apps/web/src/domain/investments.ts` (cálculos, `replayInvestment`, campos por tipo, placeholders) e `types.ts` (`Investment`, `InvestmentMovement`, `FinanceData.investments?` e `investmentMovements?`).
- Persistência local: `repositories/FinanceRepository.ts`, `LocalRepository.ts`, `localMigration.ts` (**backup versão 8**), `Store/FinanceStore.ts`, `Services/backup.ts`, `Layout/UserMenu.tsx` (o `exportBackup` lista os campos à mão: campo novo precisa entrar ali).
- Telas: `Features/Investments/InvestmentsView.tsx` e `InvestmentDialogs.tsx`, seletor em `Features/Goals/GoalsPage.tsx`.
- Testes: `domain/investments.test.ts` e `repositories/repositories.test.ts` (302 testes passando).

## Pontos de atenção

- [ ] **Backup versão 8:** backups com investimentos são recusados por versões antigas do app. Backups antigos continuam abrindo.
- [ ] Investimentos cadastrados **antes** da versão com controle de cotas, sem movimentação de quantidade, mantêm as cotas como estavam até a primeira movimentação com quantidade.
- [ ok ] `ApiRepository` chama a API de verdade (antes rejeitava de propósito). Campo limpo no Editar (`undefined`) vira texto vazio, `false`, `0` ou `null` (cotas e preço médio), porque o JSON descarta `undefined` e a API entenderia "não mudou".

---

## Pendências

### 1. Backend em Go (pré-requisito para subir para a `main`)

- [ ok ] Migration `00012_investments.sql` (goose, aditiva): tabelas `investments` e `investment_movements`, com `user_id ... ON DELETE CASCADE`, valores em `_cents`, datas `AAAA-MM-DD`, `quantity` como `numeric(20,6)`, RLS ligado. Cotas e preço médio ficam nulos enquanto o investimento não controla quantidade.
- [ ok ] Queries sqlc em `finance.sql` e `sqlcgen` regenerado (`sqlc.yaml` ganhou o override de `numeric` para `float64`).
- [ ok ] Tipos em `domain/investment.go`, `FinanceData`/`Normalize`, validação (`httpapi/validate.go`: família, datas reais, limite de R$ 1 bilhão, textos, cotas), teto de importação (`ImportItems`), `store.Import` (ids novos, valores como vieram no pacote) e `LoadData`.
- [ ok ] Rotas `POST/PATCH/DELETE /investments` e `/investment-movements` (`httpapi/investments.go`). Cada movimentação refaz o investimento na mesma transação, com o investimento travado (`FOR UPDATE`), e devolve `{movement, investment}`.
- [ ok ] `domain.ReplayInvestment` em Go, com os mesmos casos do teste do front (inclui arredondamento do preço médio como o `Math.round` do JavaScript).
- [ ok ] `docs/openapi.yaml` e `packages/api-types` (`generate` sem diferença).
- [ ok ] Stubs do `ApiRepository` trocados por chamadas reais, e `normalizeFinanceData` lê `investments` e `investmentMovements`.
- [ ok ] `GET /me/export` e `POST /import` incluem investimentos (testado: importar duas vezes com `replace` não duplica; movimentação de investimento fora do pacote é recusada).
- [ ] **Não aplicar migration em banco nenhum sem o usuário decidir quando e onde.** Só arquivos e testes. Respeitado: a `00012` só rodou em Postgres descartável (testes e conferência no navegador). **Pendente:** decidir quando aplicar no banco real (o `docker compose up --build` aplica sozinho ao subir a API).

### 2. Tour da tela de Investimentos

- [ ok ] Seguiu o padrão de `docs/tuor.md`: `Features/Investments/tour.ts` (11 etapas), `data-tour` em `InvestmentsView` e exemplos no modo `tourDemo` (`Features/Investments/demo.ts`), que só existem enquanto o tour está aberto e nunca são gravados.
- [ ok ] Decisão: **tours separados**. Cada visão tem o seu `PageHeader` com o botão ? (Metas segue com `METAS_TOUR`; Investimentos com `INVESTIMENTOS_TOUR`). O tour geral não inclui Investimentos, porque a aba abre em Metas e o seletor é estado local.
- [ ok ] Feito com o layout fechado.

### 3. Aviso de vencimento no sino

- [ ok ] O sino (`Layout/GoalBell.tsx`) mostra as duas seções: prazos das metas e vencimentos de investimentos. Regras em `domain/investments.ts` (`getMaturityAlerts`) e hook em `Features/Investments/maturityAlerts.ts`.
- [ ok ] Janela de **30 dias**, com três níveis: em breve (8 a 30 dias), esta semana (0 a 7 dias, inclui hoje) e vencido. Só avisa quem tem valor e vencimento. A chave de aviso visto é `inv:<id>:<vencimento>:<nível>` em `seenAlerts`: o aviso volta quando o nível sobe ou o vencimento muda, e sai quando o investimento é excluído. Fica visível até registrar o resgate (valor zero). A lista "Próximos vencimentos" da tela continua com 90 dias.
- [ ok ] O link "Ir para Investimentos" do sino abre `/metas?aba=investimentos`.

---

## Despesas com cartão e fatura

**Status (branch `feature/despesas-cartao-fatura`):** Fases 0 a 4 feitas (domínio, API, telas e testes). A Fase 5 (migrar a sua linha manual "Cartão") tem o recurso pronto, mas **a migração dos seus dados é feita por você, na tela, com backup** (passo a passo abaixo). Sem cartão cadastrado, nada muda no cálculo.

Funcionalidade **separada** dos investimentos. Substitui a linha manual "Cartão" por uma fatura calculada a partir de despesas ligadas ao cartão.

### Fase 0: segurança

- [ ok ] Branch `feature/despesas-cartao-fatura` criada a partir dos commits de investimentos.
- [ ] **Pendente (você):** guardar uma cópia dos dados atuais antes de qualquer migração (menu da conta → Exportar, no modo local e na conta da API).

### Fase 1: modelo de dados (só campos opcionais)

- [ ok ] Despesas e despesas extras ganham `cardId` e `purchaseDate` (`domain/types.ts`, `domain/types.go`).
- [ ok ] O cadastro do cartão ganha `limit` (o teto mensal, opcional, em centavos; 0 ou ausente = sem teto).
- [ ok ] Os três campos entram nas listas de campos do `ApiRepository` (`TRANSACTION_PATCH`, `EXTRA_PATCH`, `CARD_PATCH`). No modo local os objetos são guardados inteiros, então não precisou de migração de formato nem de nova versão do backup. Soltar o cartão manda `cardId: ""` e limpar o teto manda `limit: 0`, porque o JSON descarta `undefined`.
- [ ok ] Backend: migration `00013_card_expenses.sql` (colunas opcionais, `ON DELETE SET NULL`), queries, rotas, importação (os cartões entram antes e as despesas apontam para os ids novos), `openapi.yaml` e tipos. **A migration não foi aplicada em nenhum banco real.**
- [ ok ] Registros antigos continuam válidos, porque tudo é opcional.
- [ ok ] Regras de validação (decisões desta etapa): com cartão, a despesa precisa ter o dia da compra, ser despesa e não ser fixa (a API responde 400 ou 422); o dia da compra sem cartão é aceito, porque é o que fica no histórico depois que o cartão é removido; cartão de outra conta é recusado.

### Fase 2: regra de fatura

- [ ok ] `resolveCardExpenses` (`domain/invoice.ts`) e `ResolveCardTransactions` / `ResolveCardExtras` (Go): a despesa avulsa com cartão vale no mês do vencimento da fatura, a partir de `purchaseDate`, igual às parcelas. `month` e `purchaseDate` ficam como foram lançados (a resolução é na leitura, os dados salvos não mudam). Aplicada em resumo do mês, detalhe por categoria, projeção, comparação, relatórios, meses com dados, setas de mês e nos seletores das telas.
- Decisão: **despesa fixa não tem cartão** (recorrência no cartão já existe em Crédito).
- [ ok ] `getCardInvoice(dados, cartão, mês)` (nome em inglês, como o resto do domínio): devolve parcelas, recorrências, compras avulsas (comuns e extras, ordenadas pelo dia da compra), subtotais, total, teto, % usado, se estourou, fechamento e vencimento. `invoiceDates` calcula as datas da fatura que vence no mês e concorda com `getInvoice`.
- [ ok ] Ao remover um cartão, o vínculo das despesas avulsas e extras também é limpo (na store e no banco, `ON DELETE SET NULL`) e nenhuma some. O dia da compra fica no histórico, e a despesa volta a valer no mês em que foi lançada.

### Fase 3: indicadores

- [ ok ] O cálculo mensal continua somando cada lançamento uma vez, na própria categoria. A fatura é só uma visão agrupada e nunca entra na soma (teste de consistência: despesas do mês = despesas sem cartão + soma das faturas).
- [ ok ] Relatórios, Projeção e Comparação usam as mesmas funções e o mesmo resolvedor; nenhum soma a fatura por cima. Falta olhar nas telas quando a Fase 4 existir.

### Fase 4: telas

- [ ok ] Lançar → Despesa e Lançar → Despesa extra ganham "Cartão (opcional)" e, com cartão escolhido, "Data da compra" e o aviso de em qual fatura entra (`CardPurchaseField`). Com cartão, o campo de mês some (o valor vale no mês da fatura). Despesa fixa não mostra cartão. Editar despesa e editar despesa extra têm o mesmo seletor; soltar o cartão mantém a despesa e o dia da compra.
- [ ok ] O cadastro do cartão (Lançar → Cartão) e a edição (perfil) ganham "Teto mensal (opcional)"; o card do cartão mostra o teto, e teto vazio tira o teto. A confirmação de excluir o cartão conta também as despesas ligadas e avisa que nada é apagado.
- [ ok ] **Mudança de desenho, pedida por você:** a fatura fica em **Compras parceladas**, abaixo das parcelas, e não em Despesas do mês. Cada cartão com movimento no mês tem um item "Fatura <cartão>" com o valor completo (parcelas + recorrências + compras avulsas), fechamento e vencimento, os três subtotais, o teto (barra, % usado e aviso de quanto passou) e "Ver compras avulsas". As linhas de parcela e de recorrente **não mudaram**. As compras avulsas continuam listadas em Despesas do mês, com o selo do cartão e a data da compra, e sem "Marcar como paga" (o pagamento é da fatura). A fatura nunca é somada por cima dos totais.
- [ ok ] **Despesa no cartão só edita e exclui** (decisão sua): o menu dela não tem "Fixar" (fixa no cartão é recorrência) nem "Marcar como paga" (o pagamento é da fatura). Vale na tela, na store e na API (marcar pagamento individual responde 422; desmarcar um registro antigo continua liberado). Soltar a despesa do cartão devolve as duas opções.
- [ ok ] Pagamento da fatura: `CreditCard.payments` por mês de vencimento (`"2026-12"`), mesmo formato dos pagamentos de despesas (forma, data, observação; só boleto pode ter data futura = agendada). Menu da fatura: Marcar como paga, Editar pagamento, Desmarcar. Só registro: não muda nenhum valor. Backend: migration `00014_card_invoice_payments.sql`, `PUT/DELETE /credit-cards/{id}/payments/{month}`, import e export. **A migration não foi aplicada em nenhum banco real.** Fora desta etapa: o pagamento da fatura ainda não aparece nos relatórios.

### Fase 5: migração da linha manual "Cartão"

- [ ok ] **O mecanismo que o plano supunha não existia** (o app só ocultava a fixa mês a mês). Foi criado: **"Encerrar a partir daqui"** no menu ⋮ de despesas e rendas fixas, com `Transaction.endMonth` (o último mês em que a fixa vale). Os meses anteriores, os valores por mês e os pagamentos não mudam. A fixa encerrada vai para a lista **Encerradas**, nos meses em que já não vale, com **Reativar a partir daqui**: ela volta a valer só do mês visto em diante, e os meses desativados entre o fim e esse mês continuam desativados (passam a constar como "ocultos", e dá para restaurar cada um). Backend: migration `00015_fixed_end_month.sql` (**não aplicada em nenhum banco real**), validação (só fixa; o fim não pode ser antes do início; pagamento depois do fim é recusado) e import/export.
- [ ] **Com você:** cadastrar (ou editar) o cartão com **teto mensal de R$ 300**, para não perder esse número (perfil → Cartões → Editar, ou Lançar → Cartão).
- [ ] **Com você, passo a passo** (nada disso foi feito nos seus dados):
  1. Exporte o backup (menu da conta → Exportar), no modo local e/ou na conta da API.
  2. Anote em **Lançamentos → Despesas do mês** os totais de **novembro de 2026** e de **dezembro de 2026**.
  3. Vá para **dezembro de 2026**, abra o ⋮ da linha fixa "Cartão" → **Encerrar a partir daqui** → Encerrar.
  4. Confira: novembro igual ao anotado (com o valor real e o selo de pago); dezembro cai o valor da linha; a lista **Encerradas** mostra "Valeu até novembro de 2026".
  5. Cadastre as compras avulsas no cartão (Lançar → Despesa, escolhendo o cartão e o dia da compra) e confira a fatura em Compras parceladas. Se algo não bater, **Reativar** desfaz o encerramento.

### Fase 6: testes e conferência

- [ ok ] Testes da função de fatura (`domain/cardInvoice.test.ts`): compra antes e depois do fechamento, virada de ano, recorrência, parcela, cartão removido, fatura vazia, teto, datas.
- [ ok ] Teste de consistência: a soma das despesas do mês tem que ser igual às despesas sem cartão mais a soma das faturas.
- [ ] Conferência manual em dezembro:
  - Antes: despesas sem parcelas R$ 2.521,45 (com os R$ 300) + parcelas R$ 217,99 = R$ 2.739,44.
  - Depois, sem a linha de R$ 300: R$ 2.221,45 + R$ 217,99 = R$ 2.439,44.
  - Com um abastecimento de R$ 50 no cartão: total R$ 2.489,44 e fatura de R$ 267,99, com o teto mostrando R$ 267,99 de R$ 300.

---

## Verificação (backend, sino e tour)

- Go: `go vet ./...` e `go test ./...` com Postgres descartável, todos os pacotes verdes. Novos: `domain/investment_test.go` (mesmos casos do front, cotas fracionárias, venda total, arredondamento) e `httpapi/investments_test.go` (validação, refazer o valor no servidor ao criar, corrigir e excluir movimentação, cotas e preço médio, PATCH com `null`, apagar em cascata, isolamento entre contas, resumo do mês inalterado, importar e exportar).
- Front: 317 testes (`ApiRepository`, `FinanceStore` com repositório falso, avisos de vencimento, exemplos do tour), `eslint`, `tsc -b` e `vite build` sem erros. `pnpm --filter @aurora/api-types generate` sem diferença.
- Navegador (Chromium, Playwright), **modo local e modo API contra o Go real**: tour com 11 etapas e exemplos que somem sem gravar nada; cadastrar, movimentar e ver o valor refeito; sino com o aviso, "Marcar como visto", "Já vistos", link para Investimentos; recarregar mantém tudo (no modo API, vindo do servidor); mudar o vencimento reabre o aviso; excluir persiste; sino e página sem rolagem horizontal a 390 px.
- No modo API o console mostra um 401 em `POST /auth/refresh` ao abrir sem sessão: é a checagem de sessão antes do login, anterior a este trabalho.

### Verificação das Fases 1 a 3

- Go (`go vet` e `go test ./...` com Postgres descartável): `domain/card_expenses_test.go` (mesmos casos do front) e `httpapi/card_expenses_test.go` (validação, ligar e soltar, virar fixa recusado, teto, mês da fatura em `/summary` e `/projection`, apagar o cartão solta e nada some, importar e exportar). Todos os pacotes verdes.
- Front: 336 testes (`cardInvoice.test.ts`, remover cartão na store, `ApiRepository` com os campos novos), `eslint` e `tsc -b` limpos; `pnpm --filter @aurora/api-types generate` regenerado.

### Verificação da Fase 4

- Go: `go vet` e `go test ./...` verdes, incluindo `TestCardInvoicePayment` (validação, só boleto futuro, mês por fatura, isolamento entre contas, desmarcar idempotente, criar ignora pagamentos, importar e exportar, o pagamento não muda o total do mês).
- Front: 346 testes (pagamento da fatura no domínio, na store e no `ApiRepository`; ligar e soltar o cartão de uma despesa), `eslint`, `tsc -b` e `vite build` limpos.
- Navegador (Chromium, Playwright), **modo local (36/36) e modo API contra o Go real (37/37)**: cadastrar cartão com teto; TV parcelada e Streaming recorrente no cartão; compras avulsas; a fatura soma 100 + 20 + 42 = R$ 162,00 com subtotais, datas e 54% do teto; as linhas de parcela e recorrente iguais; a compra que vence no mês seguinte só aparece lá (parcela 2 + recorrente + compra = R$ 150,00); marcar como paga, recarregar, editar e desmarcar; **pagar a fatura não muda nenhum número do Painel**; passar do teto avisa R$ 62,00 acima; soltar a despesa do cartão tira da fatura; remover o cartão não apaga nada; tour com a etapa da fatura; sem rolagem horizontal a 390 px; nenhuma chamada da API falhou.

### Verificação do "Encerrar a partir daqui"

- Go: `domain/end_fixed_test.go` e `httpapi/end_fixed_test.go` (regra, novembro intacto, dezembro e meses seguintes sem a fixa, projeção, fim inválido, pagamento depois do fim recusado, reativar com `""`, deixar de ser fixa, isolamento entre contas, import e export). Todos os pacotes verdes.
- Front: 363 testes (`endFixed.test.ts`, store, `ApiRepository`), `eslint` e `tsc` limpos.
- Navegador, **modo local (18/18) e modo API (19/19)**, no cenário da Fase 5 (fixa variável "Cartão" de R$ 300, valor real de novembro R$ 732,47 pago): encerrar a partir de dezembro deixa novembro idêntico (R$ 1.732,47, com o selo de pago e o valor real), dezembro e fevereiro só com o aluguel (R$ 1.000,00), a lista Encerradas com Reativar, persistência depois de recarregar, reativar volta a R$ 1.300,00, no mês em que a fixa começa recusa e orienta a usar Excluir, e despesa comum não oferece Encerrar.

### Valores gigantes

`formatBRL` e `formatBRLShort` (`lib/money.ts`) mostram por inteiro até `R$ 999.999.999.999,99` (21 caracteres) e cortam acima disso com `…`; os rótulos dos eixos dos gráficos têm o mesmo corte (`charts/scale.ts`), e o saldo do Painel e o `StatCard` truncam. Testado com um valor de 56 dígitos em todas as telas, a 1280, 1024 e 390 px, sem estourar a largura. O campo de dinheiro continua aceitando qualquer quantidade de dígitos (só os investimentos limitam a R$ 1 bilhão).

### Valor por extenso ao passar o mouse

Ao manter o mouse (cerca de meio segundo) sobre qualquer valor em dinheiro, em qualquer tela, frase, gráfico ou diálogo, aparece um balão com o valor por extenso: `R$ 110,00` -> "cento e dez reais". A partir de R$ 1.000, o balão ganha uma segunda linha com a forma abreviada ("mil duzentos e trinta e quatro reais..." / "R$ 1 mil 234"; "dois bilhões e um milhão de reais" / "R$ 2 bi 1 mi"); se o por extenso fica longo demais (mais de 140 caracteres), mostra só o abreviado; acima de 10^66 usa notação científica.

- Funciona lendo o texto que a tela já mostra (`components/shared/MoneyTooltip.tsx`, montado no `AppShell`), então não precisou mexer nos ~100 lugares que mostram valores. A regra do texto está em `lib/moneyWords.ts` (extenso e abreviado, sem passar por `number`) e `lib/moneyHover.ts` (achar o valor sob o mouse).
- Valor cortado com `…` (acima de R$ 999.999.999.999,99) volta à grandeza original por um registro que `formatBRL` guarda, então o balão diz o número inteiro. Acima de 15 dígitos significativos o balão avisa "cerca de" (um número não guarda mais que isso com precisão).
- Valores com `formatBRLShort` (sem centavos, como "R$ 1.235") são descritos como estão na tela.
- É só leitura: não muda nem guarda nada. Não aparece em telas de toque (não há "passar o mouse").

### Gráficos com valores grandes

Os rótulos do eixo dos gráficos (Últimos 6 meses, Renda × despesa projetadas, Saldo acumulado e Comparação) usam `shortReais` (`components/charts/scale.ts`): `950`, `1,5 mil`, `15 mil`, `1,5 mi`, `2 bi`, `3 tri` e, passando de 10^15, `1,5e18`, sempre com no máximo 8 caracteres. A margem esquerda do gráfico (`axisPadding`) cresce para caber o maior rótulo (nunca abaixo dos 44 px de sempre), então o rótulo não sai do card. O total no centro da rosca diminui a letra para caber dentro do anel. Verificado de milhares a 10^55 em 390, 1024 e 1280 px (o mesmo teste, rodado no código antigo, acusa rótulos como `1.000 mil` e `10.000.000 mil` saindo até 399 px do card).

### Faturas nos relatórios

- Na tela de **Relatórios** não há mais um card com as faturas (a lista ficaria longa demais com vários meses): as faturas aparecem só nos arquivos exportados. Cada fatura tem o título **"Fatura <cartão>"**, o total a pagar, fechamento, vencimento (com o selo de pago, se for o caso) e, abaixo, cada item: parcelas ("TV (parcela 1/3)"), recorrências ("Streaming (recorrente)"), compras avulsas ("01/11 · Padaria", "(despesa extra)") e ajustes (descontos e acréscimos).
- No bloco **Exportar relatório** há a opção "Faturas dos cartões" (marcada por padrão) e as faturas saem no **PDF** (depois dos lançamentos, uma tabela por fatura com o título repetido se quebrar de página), no **CSV** (seção própria: uma linha de total por fatura, depois uma por gasto) e no **TXT**. Desmarcada a opção, o arquivo sai exatamente como antes.
- É só uma visão agrupada: os gastos continuam nas listas de lançamentos e nos totais do período, e nada é somado de novo (`getReportInvoices` em `domain/report.ts`, que usa `getCardInvoice`).
- Verificado no navegador baixando os três formatos (o PDF lido com `pdftotext -raw`) e por testes de domínio (`reportInvoices.test.ts`). Obs.: `pdftotext -layout` desloca valores nas tabelas com linhas de alturas diferentes (acontece também na seção Lançamentos que já existia); o PDF em si está alinhado.

### Salvar alterações no bloco Exportar relatório

O botão **Salvar alterações** guarda o formato (PDF, CSV ou TXT) e o que está marcado (resumo, lançamentos, parcelas, faturas, distribuição) como o padrão da tela: da próxima vez que abrir Relatórios, já vem assim, sem precisar marcar ou desmarcar. O botão só habilita quando há mudança em relação ao salvo; recarregar sem salvar descarta a mexida. O padrão fica no **navegador** (localStorage, chave `aurora:report-prefs`), então vale para esta máquina e navegador, no modo local e no modo com API; não acompanha a conta em outro navegador. O período não é salvo (continua acompanhando o seletor do topo). Lógica em `Features/Reports/prefs.ts`; texto corrompido ou sem permissão do navegador volta ao padrão sem quebrar a tela.


## PDF do relatório: páginas por seção

O PDF não continua mais uma informação na página seguinte. Cada seção abre a sua página, nesta ordem:

1. **Resumo**: totais, gráfico e tabela mês a mês.
2. **Despesas por categoria** (com a sugestão de distribuição, quando cabe na mesma página).
3. **Lançamentos**: um bloco por mês, cada um inteiro numa página.
4. **Parcelas do crédito**.
5. **Faturas dos cartões**: cada fatura inteira (título, total e gastos), várias por página.

Se um bloco não cabe no espaço que sobra, ele vai para a página seguinte. Se ainda for maior que uma página, a letra é reduzida até caber. Só quando nem isso resolve (mais de ~60 linhas num único mês) o bloco continua na página seguinte. Todas as páginas têm "Página n de N", e da segunda em diante um cabeçalho fino.

## Negócio próprio (revenda e similares)

Tipo "Negócio próprio" no cadastro, para acompanhar um negócio seu em vez de um investimento financeiro.
Movimentações: **Investimento** (aporte; pode ser feito várias vezes, não entra no saldo a sacar),
**Recebimento** (venda que entrou, tipo `income`) e **Saque** (resgate; sai do saldo a sacar).

- Valor atual do card = saldo a sacar = recebido − sacado (nunca negativo).
- Lucro = recebido − investido. Negativo = "em prejuízo" (ainda falta recuperar o investido).
- Não entra no patrimônio, nos gráficos por tipo/instituição nem nos avisos de vencimento; tem o painel "Meus negócios".
- Banco: migration `00019_investment_business.sql` (só afrouxa os CHECK de `family` e `type`). Na `local-sqlite`
  é preciso uma migration 00019 equivalente em SQLite.
