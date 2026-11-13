# Tour guiado por tela (Spotlight Tour)

Acompanhamento da funcionalidade de onboarding do Aurora: um tour curto e **individual por tela**, que destaca os elementos da página com um spotlight.

**Como usar:** `[ ]` = pendente · `[ ok ]` = feito e verificado. Troque `[ ]` por `[ ok ]` a cada item concluído.

**Status:** implementado e verificado nos dois modos (local e API).

---

## Decisões

- [ ok ] Visual: **protótipo B "Foco"**. Halo luminoso que pulsa no elemento destacado, cartão compacto, número grande da etapa (ex.: `3/9`) e pontos de progresso.
  - Protótipo: https://claude.ai/artifact/Q5nqtFgrTZCKB136VJ4QMw (os outros, A e C, foram descartados)
- [ ok ] **Cada tela tem o seu próprio tour.** Não existe tour geral da plataforma.
- [ ok ] **O tour apresenta todos os cards da tela.** As telas são pequenas e têm pouca informação, então nenhum card fica de fora. A ordem das etapas segue a ordem de leitura da tela (de cima para baixo, da esquerda para a direita).
- [ ok ] Estado do onboarding **por usuário e por tela**, salvo na conta (API) e, no modo local, no `localStorage`
- [ ok ] Mostrar o tour nos **dois modos**: com a API (estado na conta) e local (estado no `localStorage`)
- [ ] Item "Rever tour desta tela" no menu do usuário. *Opcional, fora do escopo: não implementado.*

## Comportamento

- [ ok ] Na **primeira visita a cada tela**, abre o convite:
  - Título: **Conheça esta tela!**
  - Texto: *Gostaria de fazer um tour rápido de aproximadamente 1 minuto para conhecer os principais recursos desta página?*
  - Botões: **Começar tour** e **Agora não**
- [ ok ] O tour **nunca começa sozinho**: sempre passa pelo convite.
- [ ok ] "Começar tour" inicia a apresentação na hora. "Agora não" não convida de novo naquela tela.
- [ ok ] Qualquer resposta (recusar, fechar, pular ou finalizar) grava o estado da tela. Atualizar a página ou voltar depois mantém o estado.
- [ ok ] Navegar entre as abas não gera convites repetidos: só a primeira visita de cada tela convida.
- [ ok ] Cada etapa tem:
  - spotlight (halo pulsante) no elemento, com o resto da interface escurecido
  - cartão ao lado do elemento, com título curto e descrição objetiva
  - indicador de progresso (número grande `n/total` e pontos)
  - botões **Voltar**, **Próximo** e, na última etapa, **Finalizar**
  - **Pular tour** e botão de fechar (X)
- [ ok ] Teclado: `→` avança, `←` volta, `Esc` fecha. O foco fica preso dentro do cartão enquanto o tour está aberto.
- [ ok ] Durante o tour, uma camada bloqueia cliques na página, para não alterar formulários, dados nem a navegação.
- [ ok ] Elemento ainda não renderizado ou oculto: a etapa é **pulada**. Se nenhuma etapa puder ser mostrada, o convite não aparece e nada é gravado.
- [ ok ] Cartão reposiciona sozinho em telas pequenas (acima, abaixo, ao lado ou fixo na base) e nunca sai da viewport.
- [ ok ] Respeita `prefers-reduced-motion` (sem pulsar nem animar o spotlight).

## Persistência

- [ ok ] Novo campo `onboarding` em `FinanceData`, um mapa de tela para resposta:
  ```json
  { "painel": "done", "lancamentos": "dismissed" }
  ```
  - `done`: viu o tour até o fim
  - `dismissed`: recusou o convite, fechou ou pulou
  - tela ausente do mapa: ainda não foi convidado
- [ ok ] **API:** coluna `onboarding jsonb` em `user_settings` (migration `00003`), query no sqlc, `PUT /settings/onboarding/{screen}` (muda só a chave da tela, para dois dispositivos não apagarem as respostas um do outro), campo em `GET /data` e `/import`, e `docs/openapi.yaml` atualizado (`make generate` para os tipos)
- [ ok ] **Front:** `FinanceRepository.setOnboarding(screen, state)`, implementado em `LocalRepository` (envelope versão 6 em `localMigration`) e em `ApiRepository`; ação na `FinanceStore`
- [ ok ] A tela só decide se convida **depois** dos dados carregarem (`hydrated`), para não convidar quem já respondeu em outro dispositivo
- [ ok ] Teste de integração da API (grava, lê, isolamento entre usuários) e testes do repositório local

## Estrutura de código (front)

- [ ok ] `components/tour/SpotlightTour.tsx`: spotlight, cartão, progresso e teclado
- [ ok ] `components/tour/TourInvite.tsx`: modal de convite
- [ ok ] `components/tour/placement.ts`: cálculo da posição do cartão (testável)
- [ ok ] `components/tour/useScreenTour.ts`: decide quando convidar, controla o estado e grava a resposta
- [ ok ] `Features/*/tour.ts`: as etapas de cada tela, em um arquivo por tela
- [ ok ] Elementos destacados por **`data-tour="..."`**, nunca por classes CSS
- [ ok ] Cada página chama `useScreenTour("<tela>", steps)` e marca os elementos com `data-tour`

Formato de uma etapa:

```ts
{ target: "saldo", title: "Seu saldo do mês", text: "…", placement: ["right", "bottom"] }
```

## Etapas por tela

Os textos estão em `Features/*/tour.ts`. Quando um card depende de dados (por exemplo, não há metas), ele só entra se estiver visível.

### Painel (`painel`)

- [ ok ] 1. Botão **Lançar**: todo cadastro começa aqui; o Painel só mostra os números
- [ ok ] 2. **Seletor de mês**: troca o período; não passa do mês atual
- [ ok ] 3. **Aviso de prazo das metas** (só aparece se houver meta com prazo próximo ou vencido)
- [ ok ] 4. **Tempo e fôlego** (botão): horas de trabalho e card Dias de fôlego, desligados por padrão
- [ ok ] 5. **Em destaque neste mês**: insights por regras locais, dispensáveis (só com 2+ meses de movimento)
- [ ok ] 6. Card **Saldo do mês**: renda menos despesas (com as parcelas do crédito) e % da renda comprometida
- [ ok ] 7. Card **Últimos 6 meses**: gráfico de renda e despesas
- [ ok ] 8. Card **Próximos vencimentos**: despesas com "Dia do vencimento" e faturas de cartão não pagas; atrasados primeiro; "Marcar como paga" só registra; janela de 7, 14 ou 30 dias. Sem vencimentos, usa exemplos fictícios durante o tour. Os atrasados e os que vencem em até 3 dias também avisam no sino
- [ ok ] 9. Card **Despesas por categoria**: onde o dinheiro do mês foi
- [ ok ] 10. Card **Sugestão do saldo**: como dividir o que sobrou; menu ⋮ ajusta os percentuais
- [ ok ] 11. Card **Metas**: progresso geral dos objetivos
- [ ok ] 12. Card **Despesas do mês**: as 5 mais recentes
- [ ok ] 13. Card **Anotações**: lembretes do mês (somente leitura aqui)
- [ ok ] 14. Card **Dias de fôlego** (só aparece ligado em Tempo e fôlego e com reserva; durante o tour mostra um exemplo)

### Lançamentos (`lancamentos`)

- [ ok ] 0. Botão **Importar arquivo**: CSV de extrato ou fatura (a janela traz duas planilhas modelo para baixar, de extrato e de fatura) (colunas, pré-visualização com categoria por regras e duplicados desmarcados; nada é gravado antes de confirmar; também em Lançar > Importar extrato ou fatura)
- [ ok ] 1. Card **Rendas**: fontes do mês; fixas se repetem todo mês; menu de ações da linha
- [ ok ] 2. Card **Despesas do mês**: despesas comuns, fixas e parcelas do crédito; fixa pode ser ocultada só num mês e restaurada
- [ ok ] 3. Card **Anotações**: lembretes do mês, que podem ser fixados e editados

### Projeção (`projecao`)

- [ ok ] 1. Indicador **Despesa fixa mensal**
- [ ok ] 2. Indicador **Parcelas até o fim do período**
- [ ok ] 3. Indicador **Pior mês**
- [ ok ] 4. Indicador **Saldo no período**
- [ ok ] 5. Card **Renda × despesa projetadas**: próximos meses
- [ ok ] 6. Card **Saldo acumulado**: quanto sobra somando os meses
- [ ok ] 7. Card **Despesas extras planejadas**: gastos que não se repetem; cadastrados pelo Lançar
- [ ok ] 8. Card **Parcelas no crédito**: o que ainda vai cair

### Comparação (`comparacao`)

Com menos de dois meses com movimento a tela mostra só um aviso; nesse caso o convite não aparece (não há o que destacar).

- [ ok ] 1. Card **Meses**: escolha até N meses para comparar
- [ ok ] 2. Indicador **Saldo médio**
- [ ok ] 3. Indicador **Melhor mês**
- [ ok ] 4. Indicador **Pior mês**
- [ ok ] 5. Card **Ranking de saldo**: do melhor ao pior
- [ ok ] 6. Card **Renda e despesa**: meses lado a lado
- [ ok ] 7. Card **Perfil de gastos**: onde cada mês pesou mais
- [ ok ] 8. Card **Categorias lado a lado**: valor gasto em cada uma

### Metas (`metas`)

Sem nenhuma meta, a tela mostra só o card "Nenhuma meta ainda"; o tour então explica esse card (etapa 4 abaixo, no lugar das etapas 5 e 6). Com metas, as etapas do cartão usam a primeira meta como exemplo (os cartões são todos iguais).

- [ ok ] 1. Indicador **Metas ativas**
- [ ok ] 2. Indicador **Já guardado**
- [ ok ] 3. Indicador **Aporte mensal**
- [ ok ] 4. Card **Nenhuma meta ainda** (só sem metas)
- [ ok ] 5. **Cartão de meta**: progresso, rendimentos, previsão de conclusão e selo de prazo
- [ ok ] 6. Ações da meta: **aportar** (com rendimento), editar e excluir

### Investimentos (`investimentos`, dentro de Metas)

A tela Metas e Investimentos tem dois cabeçalhos, cada um com o seu botão ?: o de Metas refaz o tour de Metas e o de Investimentos refaz este. Sem nenhum investimento, as etapas dos gráficos, dos vencimentos e do cartão usam exemplos fictícios (`Features/Investments/demo.ts`) enquanto o tour está aberto; eles nunca são gravados.

- [ ok ] 1. Botão **Novo investimento**
- [ ok ] 2. Indicador **Patrimônio investido**
- [ ok ] 3. Indicador **Total aportado**
- [ ok ] 4. Indicador **Lucro ou prejuízo**
- [ ok ] 5. Indicador **Rentabilidade**
- [ ok ] 6. Card **Nenhum investimento ainda** (só sem investimentos)
- [ ok ] 7. Card **Por tipo**
- [ ok ] 8. Card **Por instituição**
- [ ok ] 9. Card **Próximos vencimentos**
- [ ok ] 10. **Cartão do investimento**
- [ ok ] 11. Ações do cartão: **movimentar, histórico, editar e excluir**
- [ ok ] 12. Seção **Meus negócios** (negócio próprio: investido, recebido, sacado e lucro; usa um negócio de exemplo durante o tour)

Fica fora do tour geral: a aba Metas abre em Metas e o seletor Metas | Investimentos | Simulador é estado local da tela.

### Simulador (`simulador`, dentro de Metas)

Aba **Simulador** do seletor da tela Metas, com o seu próprio botão ?. Com os campos vazios, o tour usa números de exemplo (R$ 500 por mês, 10 anos, 10% ao ano, 6% de yield) enquanto está aberto, com a faixa "Exemplo ilustrativo"; eles nunca são gravados.

- [ ok ] 1. Aviso **simulação, não promessa**
- [ ok ] 2. **Seus números**: aporte, valor inicial, prazo e rentabilidade
- [ ok ] 3. **Exemplos de taxa** (só preenchem o campo)
- [ ok ] 4. **O resultado**: investido, rendimento e valor final
- [ ok ] 5. **Evolução** ano a ano
- [ ok ] 6. **Renda passiva por dividendos** e yield on cost
- [ ok ] 7. **Carteira de dividendos** (manual, com yield on cost por ativo)

### Dívidas (`dividas`, dentro de Metas)

Sem nenhuma dívida, o tour usa dívidas de exemplo (fictícias, nunca gravadas).

- [ ok ] 1. Botão **Nova dívida** (abas **Dívida** e **Consórcio**, este linear ou progressivo; as parcelas aparecem sozinhas em Lançamentos)
- [ ok ] 2. **Resumo**: parcelas por mês, saldo a pagar e última parcela
- [ ok ] 3. **Cartão da dívida**: selo Dívida/Consórcio, parcelas, saldo, quitação e **Registrar parcela paga** (igual a marcar a parcela como paga em Lançamentos; confirma o valor e, no consórcio linear, paga junto a última parcela em aberto, quantas vezes quiser); quitada vira **Quitado**
- [ ok ] 4. **Simular quitação antecipada** (com o desconto informado)

### Relatórios (`relatorios`)

- [ ok ] 1. Indicador **Renda em 6 meses**
- [ ok ] 2. Indicador **Despesas em 6 meses**
- [ ok ] 3. Indicador **Economia acumulada**
- [ ok ] 4. Indicador **Maior categoria**
- [ ok ] 5. Card **Resumo mês a mês**: base do relatório
- [ ok ] 6. Card **Exportar relatório**: período e formato (PDF, CSV ou TXT)
- [ ok ] 7. Card **Meses fechados**: o retrato de cada mês fechado no Painel; com mais de 3 meses aparecem o filtro por ano e 3 ou 6 meses por página (usa meses de exemplo durante o tour)

## Verificação

- [ ok ] Testes unitários: posicionamento do cartão (`placement.ts`) e a regra "pular etapa oculta / não convidar sem etapas"
- [ ok ] Testes do repositório: `onboarding` no `LocalRepository` e no `ApiRepository` (inclui migração do envelope local para a versão 6)
- [ ok ] Teste de integração da API para `PUT /settings/onboarding` e `GET /data`
- [ ok ] Playwright, por tela: convite na primeira visita, tour até o fim, recarregar sem novo convite, "Agora não", outra aba sem convite repetido, tela estreita (~390px) e tema claro/escuro
- [ ok ] Conferir no navegador que o tour não deixa clicar na página por baixo e que `Esc` fecha
- [ ok ] `lint`, `tsc -b`, `pnpm test`, `make test-api` e `make generate` sem diferenças

## O que foi verificado

- Backend: `make test-api` com `TestOnboarding` (grava por tela sem apagar as outras, isolamento entre usuários, validação, importação).
- Front: 117 testes (inclui posicionamento do cartão, migração do envelope local para a versão 6, `ApiRepository.setOnboarding` e consistência das etapas de cada tela).
- Playwright, nos dois modos: convite na primeira visita; percurso completo do Painel (10 etapas) e contagem de etapas das outras telas; recarregar sem novo convite; "Agora não"; voltar à aba sem convite repetido; setas e `Esc`; clique na página bloqueado durante o tour; celular (390px) com o cartão sempre dentro da tela; sem erros de JavaScript. Na API, outro dispositivo logado na mesma conta não recebe convites já respondidos.
- Com as etapas condicionais (aviso de prazo no Painel; card vazio de Metas) o número de etapas varia: o teste usou uma conta com dados, em que o Painel tem 10 etapas, Comparação 8 e Metas 5.

## Pontos de atenção

- O convite só aparece depois dos dados carregarem, com uma pausa de 0,5 s para a tela terminar de desenhar. Se o usuário sair da tela com o convite aberto, nada é gravado e ele reaparece na próxima visita.
- O tour não aparece enquanto o modal "Lançar" estiver aberto.
- No modo local o estado fica no navegador: outro navegador ou outro computador convida de novo. Quem usa a API tem o estado na conta.
- Quem importa os dados do navegador para a conta leva junto as respostas dos tours.
