# Módulo de Investimentos — Plano consolidado (v1)

## Contexto
O Aurora controla receitas, despesas, crédito e metas, mas não tem onde registrar investimentos. `Goal.saved` é só um número sem histórico, e `getMonthSummary` ignora metas. O objetivo é um **controle pessoal manual** do patrimônio investido (sem integração, sem tempo real), sem comprometer os cálculos atuais.

## Decisões tomadas
1. **Local:** sub-abas dentro de Metas. A aba `/metas` vira "Metas e Investimentos", com seletor segmentado (Metas | Investimentos). Sem aba nova no mobile. Metas e Porquinho não mudam.
2. **Dados:** entidades próprias (`Investment` + `InvestmentMovement`), e não um terceiro modo de `Goal`.
3. **Histórico:** com movimentações datadas (aporte, resgate, rendimento, ajuste de valor).
4. **Saldo:** investimentos **separados** do fluxo de caixa na v1. `getMonthSummary`, `getProjection` e relatórios não são tocados.
5. **Indicadores v1:** patrimônio, total aportado, lucro, rentabilidade; distribuição por categoria; distribuição por instituição; próximos vencimentos.
6. **Escopo:** 5 famílias (ver abaixo), sem moeda, sem cálculo de IR, sem vínculo com meta.

## Cadastro
Famílias: renda fixa com vencimento (CDB, LCI/LCA, debêntures), Tesouro, liquidez diária (poupança, caixinha, conta remunerada), ações/FIIs/ETFs, fundos. "Outros" como genérico.

- **Obrigatórios (todos):** nome, família/tipo, instituição (texto livre com sugestões), valor investido, valor atual, data da aplicação.
- **Opcionais (todos):** observações, taxas/IR estimados (texto livre).
- **Condicionais:** vencimento, indexador e taxa (renda fixa e Tesouro); liquidez/carência/resgate antecipado (renda fixa); quantidade e preço médio (ações/FIIs/ETFs; opcional no Tesouro); prazo de resgate D+N (fundos); ticker/CNPJ (opcional).
- Rentabilidade **calculada**, nunca digitada.

## Cálculos
- Total aportado = aportes − principal resgatado.
- Lucro = valor atual + resgates − aportes.
- Rentabilidade = lucro ÷ aportes.
- Quantidade de cotas em campo numérico à parte (centavos inteiros não bastam).

## Modelo de dados (padrões existentes)
- Tabelas `investments` e `investment_movements`, com `user_id ... ON DELETE CASCADE`, valores em `_cents`, datas `YYYY-MM-DD`, migration goose aditiva (`00012_*`).
- Pontos a tocar (lista de `FinanceData`): `apps/web/src/domain/types.ts`, `repositories/localMigration.ts` (bump `CURRENT_VERSION` 7→8), `LocalRepository`, `ApiRepository`, `FinanceStore.ts`, `Layout/UserMenu.tsx` (`exportBackup` lista campos à mão), `Services/backup.ts` (`describeBackup`); no backend `apps/api/internal/domain/types.go`, `httpapi/validate.go`, `limits.go`, `store.Import`, `db/queries/finance.sql` (sqlc), `docs/openapi.yaml` e `packages/api-types`.

## UI (reaproveitar)
`PageHeader`, `Panel`, `StatCard`, `ChartDonut`, `GoalDialogs.tsx` como modelo de diálogo, `GoalBell.tsx` e `goalAlerts.ts` para avisos de vencimento, e `Features/Goals/GoalsPage.tsx` como casca do seletor.

## Fora da v1
Gráfico de evolução, integração com saldo, moeda estrangeira, cálculo de IR, vínculo com meta, benchmarks, aba "Mais" no mobile.

## Verificação (quando for implementar)
Testes de domínio em Vitest (aporte, resgate parcial, lucro) e em Go; checar que `getMonthSummary` não muda; testar backup export/import com e sem investimentos e com versões antigas; conferir mobile a 360px.
