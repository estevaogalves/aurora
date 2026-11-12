-- name: ListTransactions :many
SELECT * FROM transactions WHERE user_id = $1 ORDER BY created_at, id;

-- name: GetTransaction :one
SELECT * FROM transactions WHERE id = $1 AND user_id = $2;

-- name: CreateTransaction :one
INSERT INTO transactions (id, user_id, name, amount_cents, type, category, notes, fixed, month, variable_amount, card_id, purchase_date, end_month, dist_group, due_day)
VALUES (COALESCE(NULLIF($1::uuid, '00000000-0000-0000-0000-000000000000'), gen_random_uuid()), $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
RETURNING *;

-- name: UpdateTransaction :one
UPDATE transactions SET
    name         = COALESCE(sqlc.narg('name'), name),
    amount_cents = COALESCE(sqlc.narg('amount_cents'), amount_cents),
    category     = COALESCE(sqlc.narg('category'), category),
    notes        = COALESCE(sqlc.narg('notes'), notes),
    fixed        = COALESCE(sqlc.narg('fixed'), fixed),
    -- valor variável (estimado): vale para fixa e para avulsa; só muda quando vem na requisição
    variable_amount = COALESCE(sqlc.narg('variable_amount'), variable_amount),
    -- card_id: só muda quando set_card é true; card_id nulo solta a despesa do cartão
    card_id       = CASE WHEN sqlc.arg('set_card')::boolean THEN sqlc.narg('card_id')::uuid ELSE card_id END,
    purchase_date = COALESCE(sqlc.narg('purchase_date'), purchase_date),
    -- fixa encerrada: último mês em que vale; texto vazio tira o fim
    end_month     = COALESCE(sqlc.narg('end_month'), end_month),
    -- renda variável: em qual distribuição do saldo entra (0 = Dist 1, 2 a 20 = distribuição própria); só marca
    dist_group    = COALESCE(sqlc.narg('dist_group'), dist_group),
    -- dia do vencimento (1 a 31); 0 tira o dia
    due_day       = COALESCE(sqlc.narg('due_day'), due_day)
WHERE id = sqlc.arg('id') AND user_id = sqlc.arg('user_id')
RETURNING *;

-- name: DeleteTransaction :execrows
DELETE FROM transactions WHERE id = $1 AND user_id = $2;

-- name: ListOverrides :many
SELECT o.* FROM fixed_overrides o
JOIN transactions t ON t.id = o.transaction_id
WHERE t.user_id = $1
ORDER BY o.transaction_id, o.month;

-- name: ListTransactionOverrides :many
SELECT * FROM fixed_overrides WHERE transaction_id = $1 ORDER BY month;

-- name: DeleteTransactionOverrides :exec
DELETE FROM fixed_overrides WHERE transaction_id = $1;

-- name: InsertOverride :exec
INSERT INTO fixed_overrides (transaction_id, month, hidden, amount_cents)
VALUES ($1, $2, $3, $4);

-- name: ListCredits :many
SELECT * FROM credit_purchases WHERE user_id = $1 ORDER BY created_at, id;

-- name: CreateCredit :one
INSERT INTO credit_purchases (id, user_id, name, total_cents, installments, start_month, category, adjustments, recurring, end_month, billing_day, card_id, variable_amount)
VALUES (COALESCE(NULLIF($1::uuid, '00000000-0000-0000-0000-000000000000'), gen_random_uuid()), $2, $3, $4, $5, $6, $7, $8::jsonb, $9, $10, $11, $12, $13)
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
    variable_amount = COALESCE(sqlc.narg('variable_amount'), variable_amount),
    -- card_id: só muda quando set_card é true; card_id nulo solta a compra do cartão
    card_id      = CASE WHEN sqlc.arg('set_card')::boolean THEN sqlc.narg('card_id')::uuid ELSE card_id END
WHERE id = sqlc.arg('id') AND user_id = sqlc.arg('user_id')
RETURNING *;

-- name: ListCreditCards :many
SELECT * FROM credit_cards WHERE user_id = $1 ORDER BY created_at, id;

-- name: CreateCreditCard :one
INSERT INTO credit_cards (id, user_id, name, closing_day, due_day, limit_cents, payments)
VALUES (COALESCE(NULLIF($1::uuid, '00000000-0000-0000-0000-000000000000'), gen_random_uuid()), $2, $3, $4, $5, $6, $7::jsonb)
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
DELETE FROM credit_cards WHERE id = $1 AND user_id = $2;

-- name: WipeCreditCards :exec
DELETE FROM credit_cards WHERE user_id = $1;

-- name: DeleteCredit :execrows
DELETE FROM credit_purchases WHERE id = $1 AND user_id = $2;

-- name: ListGoals :many
SELECT * FROM goals WHERE user_id = $1 ORDER BY created_at, id;

-- name: CreateGoal :one
INSERT INTO goals (id, user_id, name, target_cents, saved_cents, monthly_cents, deadline, yield_total_cents, piggy)
VALUES (COALESCE(NULLIF($1::uuid, '00000000-0000-0000-0000-000000000000'), gen_random_uuid()), $2, $3, $4, $5, $6, $7, $8, $9)
RETURNING *;

-- name: UpdateGoal :one
UPDATE goals SET
    name              = COALESCE(sqlc.narg('name'), name),
    target_cents      = COALESCE(sqlc.narg('target_cents'), target_cents),
    saved_cents       = COALESCE(sqlc.narg('saved_cents'), saved_cents),
    monthly_cents     = COALESCE(sqlc.narg('monthly_cents'), monthly_cents),
    yield_total_cents = COALESCE(sqlc.narg('yield_total_cents'), yield_total_cents),
    deadline          = CASE WHEN sqlc.arg('set_deadline')::boolean THEN sqlc.narg('deadline') ELSE deadline END
WHERE id = sqlc.arg('id') AND user_id = sqlc.arg('user_id')
RETURNING *;

-- name: DeleteGoal :execrows
DELETE FROM goals WHERE id = $1 AND user_id = $2;

-- name: ListExtraExpenses :many
SELECT * FROM extra_expenses WHERE user_id = $1 ORDER BY created_at, id;

-- name: CreateExtraExpense :one
INSERT INTO extra_expenses (id, user_id, name, amount_cents, month, card_id, purchase_date)
VALUES (COALESCE(NULLIF($1::uuid, '00000000-0000-0000-0000-000000000000'), gen_random_uuid()), $2, $3, $4, $5, $6, $7)
RETURNING *;

-- name: UpdateExtraExpense :one
UPDATE extra_expenses SET
    name         = COALESCE(sqlc.narg('name'), name),
    amount_cents = COALESCE(sqlc.narg('amount_cents'), amount_cents),
    month        = COALESCE(sqlc.narg('month'), month),
    card_id       = CASE WHEN sqlc.arg('set_card')::boolean THEN sqlc.narg('card_id')::uuid ELSE card_id END,
    purchase_date = COALESCE(sqlc.narg('purchase_date'), purchase_date)
WHERE id = sqlc.arg('id') AND user_id = sqlc.arg('user_id')
RETURNING *;

-- name: DeleteExtraExpense :execrows
DELETE FROM extra_expenses WHERE id = $1 AND user_id = $2;

-- name: ListNotes :many
SELECT * FROM notes WHERE user_id = $1 ORDER BY created_at, id;

-- name: CreateNote :one
INSERT INTO notes (id, user_id, content, date, pinned, month)
VALUES (COALESCE(NULLIF($1::uuid, '00000000-0000-0000-0000-000000000000'), gen_random_uuid()), $2, $3, $4, $5, $6)
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
DELETE FROM notes WHERE id = $1 AND user_id = $2;

-- name: ListCategories :many
SELECT * FROM custom_categories WHERE user_id = $1 ORDER BY name;

-- name: CreateCategory :one
INSERT INTO custom_categories (id, user_id, name, color)
VALUES (COALESCE(NULLIF($1::uuid, '00000000-0000-0000-0000-000000000000'), gen_random_uuid()), $2, $3, $4)
RETURNING *;

-- name: GetCategoryForUpdate :one
SELECT * FROM custom_categories WHERE id = $1 AND user_id = $2 FOR UPDATE;

-- name: UpdateCategory :one
UPDATE custom_categories SET
  name  = COALESCE(sqlc.narg('name'), name),
  color = COALESCE(sqlc.narg('color'), color)
WHERE id = sqlc.arg('id') AND user_id = sqlc.arg('user_id')
RETURNING *;

-- Os lançamentos guardam a categoria pelo nome: renomear leva junto as despesas e as compras no crédito.
-- name: RenameTransactionCategory :execrows
UPDATE transactions SET category = sqlc.arg('new_name') WHERE user_id = sqlc.arg('user_id') AND category = sqlc.arg('old_name');

-- name: RenameCreditCategory :execrows
UPDATE credit_purchases SET category = sqlc.arg('new_name') WHERE user_id = sqlc.arg('user_id') AND category = sqlc.arg('old_name');

-- name: DeleteCategory :execrows
DELETE FROM custom_categories WHERE id = $1 AND user_id = $2;

-- name: WipeTransactions :exec
DELETE FROM transactions WHERE user_id = $1;

-- name: WipeCredits :exec
DELETE FROM credit_purchases WHERE user_id = $1;

-- name: WipeGoals :exec
DELETE FROM goals WHERE user_id = $1;

-- name: WipeExtraExpenses :exec
DELETE FROM extra_expenses WHERE user_id = $1;

-- name: WipeNotes :exec
DELETE FROM notes WHERE user_id = $1;

-- name: WipeCategories :exec
DELETE FROM custom_categories WHERE user_id = $1;

-- name: GetCreditForUpdate :one
SELECT * FROM credit_purchases WHERE id = $1 AND user_id = $2 FOR UPDATE;

-- name: SetCreditAdjustments :one
UPDATE credit_purchases SET adjustments = $3::jsonb
WHERE id = $1 AND user_id = $2
RETURNING *;

-- name: GetTransactionForUpdate :one
SELECT * FROM transactions WHERE id = $1 AND user_id = $2 FOR UPDATE;

-- name: SetTransactionPayments :one
UPDATE transactions SET payments = $3::jsonb
WHERE id = $1 AND user_id = $2
RETURNING *;

-- name: SetTransactionMonthlyNotes :one
UPDATE transactions SET monthly_notes = $3::jsonb
WHERE id = $1 AND user_id = $2
RETURNING *;

-- name: GetExtraExpenseForUpdate :one
SELECT * FROM extra_expenses WHERE id = $1 AND user_id = $2 FOR UPDATE;

-- name: SetExtraExpensePayment :one
UPDATE extra_expenses SET payment = $3::jsonb
WHERE id = $1 AND user_id = $2
RETURNING *;

-- name: ListInvestments :many
SELECT * FROM investments WHERE user_id = $1 ORDER BY created_at, id;

-- name: GetInvestmentForUpdate :one
SELECT * FROM investments WHERE id = $1 AND user_id = $2 FOR UPDATE;

-- name: CreateInvestment :one
INSERT INTO investments (id, user_id, name, family, product, institution, applied_at, current_value_cents,
    maturity_date, indexer, rate, liquidity, grace_until, early_redeem, quantity, avg_price_cents, redeem_days, ticker, fees, notes)
VALUES (COALESCE(NULLIF($1::uuid, '00000000-0000-0000-0000-000000000000'), gen_random_uuid()), $2, $3, $4, $5, $6, $7, $8,
    $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20)
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
    notes               = COALESCE(sqlc.narg('notes'), notes),
    -- cotas e preço médio: só mudam quando o respectivo set_* é true; valor nulo limpa
    quantity            = CASE WHEN sqlc.arg('set_quantity')::boolean THEN sqlc.narg('quantity')::numeric ELSE quantity END,
    avg_price_cents     = CASE WHEN sqlc.arg('set_avg_price')::boolean THEN sqlc.narg('avg_price_cents')::bigint ELSE avg_price_cents END
WHERE id = sqlc.arg('id') AND user_id = sqlc.arg('user_id')
RETURNING *;

-- name: SetInvestmentDerived :one
UPDATE investments SET
    current_value_cents = sqlc.arg('current_value_cents'),
    quantity            = sqlc.narg('quantity')::numeric,
    avg_price_cents     = sqlc.narg('avg_price_cents')::bigint
WHERE id = sqlc.arg('id') AND user_id = sqlc.arg('user_id')
RETURNING *;

-- name: DeleteInvestment :execrows
DELETE FROM investments WHERE id = $1 AND user_id = $2;

-- name: WipeInvestments :exec
DELETE FROM investments WHERE user_id = $1;

-- name: ListInvestmentMovements :many
SELECT * FROM investment_movements WHERE user_id = $1 ORDER BY created_at, id;

-- name: ListMovementsOfInvestment :many
SELECT * FROM investment_movements WHERE investment_id = $1 AND user_id = $2 ORDER BY created_at, id;

-- name: GetInvestmentMovementForUpdate :one
SELECT * FROM investment_movements WHERE id = $1 AND user_id = $2 FOR UPDATE;

-- name: CreateInvestmentMovement :one
INSERT INTO investment_movements (id, user_id, investment_id, type, date, amount_cents, quantity, unit_price_cents, note, origin)
VALUES (COALESCE(NULLIF($1::uuid, '00000000-0000-0000-0000-000000000000'), gen_random_uuid()), $2, $3, $4, $5, $6, $7, $8, $9, $10)
RETURNING *;

-- name: UpdateInvestmentMovement :one
UPDATE investment_movements SET
    type         = COALESCE(sqlc.narg('type'), type),
    date         = COALESCE(sqlc.narg('date'), date),
    amount_cents = COALESCE(sqlc.narg('amount_cents'), amount_cents),
    note         = COALESCE(sqlc.narg('note'), note),
    origin       = COALESCE(sqlc.narg('origin'), origin),
    quantity         = CASE WHEN sqlc.arg('set_quantity')::boolean THEN sqlc.narg('quantity')::numeric ELSE quantity END,
    unit_price_cents = CASE WHEN sqlc.arg('set_unit_price')::boolean THEN sqlc.narg('unit_price_cents')::bigint ELSE unit_price_cents END
WHERE id = sqlc.arg('id') AND user_id = sqlc.arg('user_id')
RETURNING *;

-- name: DeleteInvestmentMovement :execrows
DELETE FROM investment_movements WHERE id = $1 AND user_id = $2;

-- name: GetCreditCardForUpdate :one
SELECT * FROM credit_cards WHERE id = $1 AND user_id = $2 FOR UPDATE;

-- name: SetCreditCardPayments :one
UPDATE credit_cards SET payments = $3::jsonb
WHERE id = $1 AND user_id = $2
RETURNING *;

-- name: SetCreditCardAdjustments :one
UPDATE credit_cards SET adjustments = $3::jsonb
WHERE id = $1 AND user_id = $2
RETURNING *;

-- name: GetGoalForUpdate :one
SELECT * FROM goals WHERE id = $1 AND user_id = $2 FOR UPDATE;

-- name: SetGoalDerived :one
UPDATE goals SET saved_cents = $3, yield_total_cents = $4
WHERE id = $1 AND user_id = $2
RETURNING *;

-- name: ListGoalMovements :many
SELECT * FROM goal_movements WHERE user_id = $1 ORDER BY created_at, id;

-- name: ListMovementsOfGoal :many
SELECT * FROM goal_movements WHERE goal_id = $1 AND user_id = $2 ORDER BY created_at, id;

-- name: GetGoalMovementForUpdate :one
SELECT * FROM goal_movements WHERE id = $1 AND user_id = $2 FOR UPDATE;

-- name: CreateGoalMovement :one
INSERT INTO goal_movements (id, user_id, goal_id, type, date, amount_cents, note, origin)
VALUES (COALESCE(NULLIF($1::uuid, '00000000-0000-0000-0000-000000000000'), gen_random_uuid()), $2, $3, $4, $5, $6, $7, $8)
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
DELETE FROM goal_movements WHERE id = $1 AND user_id = $2;
