-- name: ListTransactions :many
SELECT * FROM transactions WHERE user_id = ? ORDER BY created_at, rowid;

-- name: GetTransaction :one
SELECT * FROM transactions WHERE id = ? AND user_id = ?;

-- name: CreateTransaction :one
INSERT INTO transactions (id, user_id, name, amount_cents, type, category, notes, fixed, month, variable_amount, card_id, purchase_date, end_month, dist_group)
VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
RETURNING *;

-- name: UpdateTransaction :one
UPDATE transactions SET
    name         = COALESCE(sqlc.narg('name'), name),
    amount_cents = COALESCE(sqlc.narg('amount_cents'), amount_cents),
    category     = COALESCE(sqlc.narg('category'), category),
    notes        = COALESCE(sqlc.narg('notes'), notes),
    fixed        = COALESCE(sqlc.narg('fixed'), fixed),
    -- valor variavel (estimado): vale para fixa e para avulsa; so muda quando vem na requisicao
    variable_amount = COALESCE(sqlc.narg('variable_amount'), variable_amount),
    purchase_date = COALESCE(sqlc.narg('purchase_date'), purchase_date),
    -- fixa encerrada: ultimo mes em que vale; texto vazio tira o fim
    end_month     = COALESCE(sqlc.narg('end_month'), end_month),
    -- renda variavel: em qual distribuicao do saldo entra (0 = Dist 1, 2 a 20 = distribuicao propria); so marca
    dist_group    = COALESCE(sqlc.narg('dist_group'), dist_group)
WHERE id = sqlc.arg('id') AND user_id = sqlc.arg('user_id')
RETURNING *;

-- name: SetTransactionCard :one
-- card_id nulo solta a despesa do cartao.
UPDATE transactions SET card_id = ? WHERE id = ? AND user_id = ? RETURNING *;

-- name: DeleteTransaction :execrows
DELETE FROM transactions WHERE id = ? AND user_id = ?;

-- name: ListOverrides :many
SELECT o.* FROM fixed_overrides o
JOIN transactions t ON t.id = o.transaction_id
WHERE t.user_id = ?
ORDER BY o.transaction_id, o.month;

-- name: ListTransactionOverrides :many
SELECT * FROM fixed_overrides WHERE transaction_id = ? ORDER BY month;

-- name: DeleteTransactionOverrides :exec
DELETE FROM fixed_overrides WHERE transaction_id = ?;

-- name: InsertOverride :exec
INSERT INTO fixed_overrides (transaction_id, month, hidden, amount_cents)
VALUES (?, ?, ?, ?);

-- name: ListCredits :many
SELECT * FROM credit_purchases WHERE user_id = ? ORDER BY created_at, rowid;

-- name: CreateCredit :one
INSERT INTO credit_purchases (id, user_id, name, total_cents, installments, start_month, category, adjustments, recurring, end_month, billing_day, card_id, variable_amount)
VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
RETURNING *;

-- name: UpdateCredit :one
UPDATE credit_purchases SET
    name         = COALESCE(sqlc.narg('name'), name),
    total_cents  = COALESCE(sqlc.narg('total_cents'), total_cents),
    installments = COALESCE(sqlc.narg('installments'), installments),
    start_month  = COALESCE(sqlc.narg('start_month'), start_month),
    category     = COALESCE(sqlc.narg('category'), category),
    end_month    = COALESCE(sqlc.narg('end_month'), end_month),
    billing_day  = COALESCE(sqlc.narg('billing_day'), billing_day),
    variable_amount = COALESCE(sqlc.narg('variable_amount'), variable_amount)
WHERE id = sqlc.arg('id') AND user_id = sqlc.arg('user_id')
RETURNING *;

-- name: SetCreditCard :one
-- card_id nulo solta a compra do cartao.
UPDATE credit_purchases SET card_id = ? WHERE id = ? AND user_id = ? RETURNING *;

-- name: ListCreditCards :many
SELECT * FROM credit_cards WHERE user_id = ? ORDER BY created_at, rowid;

-- name: CreateCreditCard :one
INSERT INTO credit_cards (id, user_id, name, closing_day, due_day, limit_cents, payments)
VALUES (?, ?, ?, ?, ?, ?, ?)
RETURNING *;

-- name: UpdateCreditCard :one
UPDATE credit_cards SET
    name        = COALESCE(sqlc.narg('name'), name),
    closing_day = COALESCE(sqlc.narg('closing_day'), closing_day),
    due_day     = COALESCE(sqlc.narg('due_day'), due_day),
    limit_cents = COALESCE(sqlc.narg('limit_cents'), limit_cents)
WHERE id = sqlc.arg('id') AND user_id = sqlc.arg('user_id')
RETURNING *;

-- name: DeleteCreditCard :execrows
DELETE FROM credit_cards WHERE id = ? AND user_id = ?;

-- name: WipeCreditCards :exec
DELETE FROM credit_cards WHERE user_id = ?;

-- name: DeleteCredit :execrows
DELETE FROM credit_purchases WHERE id = ? AND user_id = ?;

-- name: ListGoals :many
SELECT * FROM goals WHERE user_id = ? ORDER BY created_at, rowid;

-- name: CreateGoal :one
INSERT INTO goals (id, user_id, name, target_cents, saved_cents, monthly_cents, deadline, yield_total_cents, piggy)
VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
RETURNING *;

-- name: UpdateGoal :one
UPDATE goals SET
    name              = COALESCE(sqlc.narg('name'), name),
    target_cents      = COALESCE(sqlc.narg('target_cents'), target_cents),
    saved_cents       = COALESCE(sqlc.narg('saved_cents'), saved_cents),
    monthly_cents     = COALESCE(sqlc.narg('monthly_cents'), monthly_cents),
    yield_total_cents = COALESCE(sqlc.narg('yield_total_cents'), yield_total_cents)
WHERE id = sqlc.arg('id') AND user_id = sqlc.arg('user_id')
RETURNING *;

-- name: SetGoalDeadline :one
-- deadline nulo limpa o prazo.
UPDATE goals SET deadline = ? WHERE id = ? AND user_id = ? RETURNING *;

-- name: DeleteGoal :execrows
DELETE FROM goals WHERE id = ? AND user_id = ?;

-- name: ListExtraExpenses :many
SELECT * FROM extra_expenses WHERE user_id = ? ORDER BY created_at, rowid;

-- name: CreateExtraExpense :one
INSERT INTO extra_expenses (id, user_id, name, amount_cents, month, card_id, purchase_date)
VALUES (?, ?, ?, ?, ?, ?, ?)
RETURNING *;

-- name: UpdateExtraExpense :one
UPDATE extra_expenses SET
    name         = COALESCE(sqlc.narg('name'), name),
    amount_cents = COALESCE(sqlc.narg('amount_cents'), amount_cents),
    month        = COALESCE(sqlc.narg('month'), month),
    purchase_date = COALESCE(sqlc.narg('purchase_date'), purchase_date)
WHERE id = sqlc.arg('id') AND user_id = sqlc.arg('user_id')
RETURNING *;

-- name: SetExtraExpenseCard :one
-- card_id nulo solta a despesa extra do cartao.
UPDATE extra_expenses SET card_id = ? WHERE id = ? AND user_id = ? RETURNING *;

-- name: DeleteExtraExpense :execrows
DELETE FROM extra_expenses WHERE id = ? AND user_id = ?;

-- name: ListNotes :many
SELECT * FROM notes WHERE user_id = ? ORDER BY created_at, rowid;

-- name: CreateNote :one
INSERT INTO notes (id, user_id, content, date, pinned, month)
VALUES (?, ?, ?, ?, ?, ?)
RETURNING *;

-- name: UpdateNote :one
UPDATE notes SET
    content = COALESCE(sqlc.narg('content'), content),
    date    = COALESCE(sqlc.narg('date'), date),
    pinned  = COALESCE(sqlc.narg('pinned'), pinned),
    month   = COALESCE(sqlc.narg('month'), month)
WHERE id = sqlc.arg('id') AND user_id = sqlc.arg('user_id')
RETURNING *;

-- name: DeleteNote :execrows
DELETE FROM notes WHERE id = ? AND user_id = ?;

-- name: ListCategories :many
SELECT * FROM custom_categories WHERE user_id = ? ORDER BY name;

-- name: CreateCategory :one
INSERT INTO custom_categories (id, user_id, name, color)
VALUES (?, ?, ?, ?)
RETURNING *;

-- name: DeleteCategory :execrows
DELETE FROM custom_categories WHERE id = ? AND user_id = ?;

-- name: WipeTransactions :exec
DELETE FROM transactions WHERE user_id = ?;

-- name: WipeCredits :exec
DELETE FROM credit_purchases WHERE user_id = ?;

-- name: WipeGoals :exec
DELETE FROM goals WHERE user_id = ?;

-- name: WipeExtraExpenses :exec
DELETE FROM extra_expenses WHERE user_id = ?;

-- name: WipeNotes :exec
DELETE FROM notes WHERE user_id = ?;

-- name: WipeCategories :exec
DELETE FROM custom_categories WHERE user_id = ?;

-- name: GetCreditForUpdate :one
SELECT * FROM credit_purchases WHERE id = ? AND user_id = ?;

-- name: SetCreditAdjustments :one
UPDATE credit_purchases SET adjustments = ?
WHERE id = ? AND user_id = ?
RETURNING *;

-- name: GetTransactionForUpdate :one
SELECT * FROM transactions WHERE id = ? AND user_id = ?;

-- name: SetTransactionPayments :one
UPDATE transactions SET payments = ?
WHERE id = ? AND user_id = ?
RETURNING *;

-- name: SetTransactionMonthlyNotes :one
UPDATE transactions SET monthly_notes = ?
WHERE id = ? AND user_id = ?
RETURNING *;

-- name: GetExtraExpenseForUpdate :one
SELECT * FROM extra_expenses WHERE id = ? AND user_id = ?;

-- name: SetExtraExpensePayment :one
UPDATE extra_expenses SET payment = ?
WHERE id = ? AND user_id = ?
RETURNING *;

-- name: GetCategoryForUpdate :one
SELECT * FROM custom_categories WHERE id = ? AND user_id = ?;

-- name: UpdateCategory :one
UPDATE custom_categories SET
  name  = COALESCE(sqlc.narg('name'), name),
  color = COALESCE(sqlc.narg('color'), color)
WHERE id = sqlc.arg('id') AND user_id = sqlc.arg('user_id')
RETURNING *;

-- Os lancamentos guardam a categoria pelo nome: renomear leva junto as despesas e as compras no credito.
-- name: RenameTransactionCategory :execrows
UPDATE transactions SET category = sqlc.arg('new_name') WHERE user_id = sqlc.arg('user_id') AND category = sqlc.arg('old_name');

-- name: RenameCreditCategory :execrows
UPDATE credit_purchases SET category = sqlc.arg('new_name') WHERE user_id = sqlc.arg('user_id') AND category = sqlc.arg('old_name');

-- name: ListInvestments :many
SELECT * FROM investments WHERE user_id = ? ORDER BY created_at, rowid;

-- name: GetInvestmentForUpdate :one
SELECT * FROM investments WHERE id = ? AND user_id = ?;

-- name: CreateInvestment :one
INSERT INTO investments (id, user_id, name, family, product, institution, applied_at, current_value_cents,
    maturity_date, indexer, rate, liquidity, grace_until, early_redeem, quantity, avg_price_cents, redeem_days, ticker, fees, notes)
VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
RETURNING *;

-- name: UpdateInvestment :one
UPDATE investments SET
    name                = COALESCE(sqlc.narg('name'), name),
    family              = COALESCE(sqlc.narg('family'), family),
    product             = COALESCE(sqlc.narg('product'), product),
    institution         = COALESCE(sqlc.narg('institution'), institution),
    applied_at          = COALESCE(sqlc.narg('applied_at'), applied_at),
    current_value_cents = COALESCE(sqlc.narg('current_value_cents'), current_value_cents),
    maturity_date       = COALESCE(sqlc.narg('maturity_date'), maturity_date),
    indexer             = COALESCE(sqlc.narg('indexer'), indexer),
    rate                = COALESCE(sqlc.narg('rate'), rate),
    liquidity           = COALESCE(sqlc.narg('liquidity'), liquidity),
    grace_until         = COALESCE(sqlc.narg('grace_until'), grace_until),
    early_redeem        = COALESCE(sqlc.narg('early_redeem'), early_redeem),
    redeem_days         = COALESCE(sqlc.narg('redeem_days'), redeem_days),
    ticker              = COALESCE(sqlc.narg('ticker'), ticker),
    fees                = COALESCE(sqlc.narg('fees'), fees),
    notes               = COALESCE(sqlc.narg('notes'), notes)
WHERE id = sqlc.arg('id') AND user_id = sqlc.arg('user_id')
RETURNING *;

-- name: SetInvestmentQuantity :one
-- Cotas: so mudam quando vieram na requisicao; valor nulo limpa.
UPDATE investments SET quantity = ? WHERE id = ? AND user_id = ? RETURNING *;

-- name: SetInvestmentAvgPrice :one
-- Preco medio: so muda quando veio na requisicao; valor nulo limpa.
UPDATE investments SET avg_price_cents = ? WHERE id = ? AND user_id = ? RETURNING *;

-- name: SetInvestmentDerived :one
UPDATE investments SET
    current_value_cents = sqlc.arg('current_value_cents'),
    quantity            = sqlc.narg('quantity'),
    avg_price_cents     = sqlc.narg('avg_price_cents')
WHERE id = sqlc.arg('id') AND user_id = sqlc.arg('user_id')
RETURNING *;

-- name: DeleteInvestment :execrows
DELETE FROM investments WHERE id = ? AND user_id = ?;

-- name: WipeInvestments :exec
DELETE FROM investments WHERE user_id = ?;

-- name: ListInvestmentMovements :many
SELECT * FROM investment_movements WHERE user_id = ? ORDER BY created_at, rowid;

-- name: ListMovementsOfInvestment :many
SELECT * FROM investment_movements WHERE investment_id = ? AND user_id = ? ORDER BY created_at, rowid;

-- name: GetInvestmentMovementForUpdate :one
SELECT * FROM investment_movements WHERE id = ? AND user_id = ?;

-- name: CreateInvestmentMovement :one
INSERT INTO investment_movements (id, user_id, investment_id, type, date, amount_cents, quantity, unit_price_cents, note, origin)
VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
RETURNING *;

-- name: UpdateInvestmentMovement :one
UPDATE investment_movements SET
    type         = COALESCE(sqlc.narg('type'), type),
    date         = COALESCE(sqlc.narg('date'), date),
    amount_cents = COALESCE(sqlc.narg('amount_cents'), amount_cents),
    note         = COALESCE(sqlc.narg('note'), note),
    origin       = COALESCE(sqlc.narg('origin'), origin)
WHERE id = sqlc.arg('id') AND user_id = sqlc.arg('user_id')
RETURNING *;

-- name: SetInvestmentMovementQuantity :one
-- Cotas da movimentacao: so mudam quando vieram na requisicao; valor nulo limpa.
UPDATE investment_movements SET quantity = ? WHERE id = ? AND user_id = ? RETURNING *;

-- name: SetInvestmentMovementUnitPrice :one
-- Preco por cota da movimentacao: so muda quando veio na requisicao; valor nulo limpa.
UPDATE investment_movements SET unit_price_cents = ? WHERE id = ? AND user_id = ? RETURNING *;

-- name: DeleteInvestmentMovement :execrows
DELETE FROM investment_movements WHERE id = ? AND user_id = ?;

-- name: GetCreditCardForUpdate :one
SELECT * FROM credit_cards WHERE id = ? AND user_id = ?;

-- name: SetCreditCardPayments :one
UPDATE credit_cards SET payments = sqlc.arg('payments') WHERE id = sqlc.arg('id') AND user_id = sqlc.arg('user_id') RETURNING *;

-- name: SetCreditCardAdjustments :one
UPDATE credit_cards SET adjustments = sqlc.arg('adjustments') WHERE id = sqlc.arg('id') AND user_id = sqlc.arg('user_id') RETURNING *;

-- name: GetGoalForUpdate :one
SELECT * FROM goals WHERE id = ? AND user_id = ?;

-- name: SetGoalDerived :one
UPDATE goals SET saved_cents = sqlc.arg('saved_cents'), yield_total_cents = sqlc.arg('yield_total_cents')
WHERE id = sqlc.arg('id') AND user_id = sqlc.arg('user_id')
RETURNING *;

-- name: ListGoalMovements :many
SELECT * FROM goal_movements WHERE user_id = ? ORDER BY created_at, rowid;

-- name: ListMovementsOfGoal :many
SELECT * FROM goal_movements WHERE goal_id = ? AND user_id = ? ORDER BY created_at, rowid;

-- name: GetGoalMovementForUpdate :one
SELECT * FROM goal_movements WHERE id = ? AND user_id = ?;

-- name: CreateGoalMovement :one
INSERT INTO goal_movements (id, user_id, goal_id, type, date, amount_cents, note, origin)
VALUES (?, ?, ?, ?, ?, ?, ?, ?)
RETURNING *;

-- name: UpdateGoalMovement :one
UPDATE goal_movements SET
    type         = COALESCE(sqlc.narg('type'), type),
    date         = COALESCE(sqlc.narg('date'), date),
    amount_cents = COALESCE(sqlc.narg('amount_cents'), amount_cents),
    note         = COALESCE(sqlc.narg('note'), note),
    origin       = COALESCE(sqlc.narg('origin'), origin)
WHERE id = sqlc.arg('id') AND user_id = sqlc.arg('user_id')
RETURNING *;

-- name: DeleteGoalMovement :execrows
DELETE FROM goal_movements WHERE id = ? AND user_id = ?;
