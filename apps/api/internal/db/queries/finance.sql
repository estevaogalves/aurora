-- name: ListTransactions :many
SELECT * FROM transactions WHERE user_id = ? ORDER BY created_at, rowid;

-- name: GetTransaction :one
SELECT * FROM transactions WHERE id = ? AND user_id = ?;

-- name: CreateTransaction :one
INSERT INTO transactions (id, user_id, name, amount_cents, type, category, notes, fixed, month, variable_amount)
VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
RETURNING *;

-- name: UpdateTransaction :one
UPDATE transactions SET
    name         = COALESCE(sqlc.narg('name'), name),
    amount_cents = COALESCE(sqlc.narg('amount_cents'), amount_cents),
    category     = COALESCE(sqlc.narg('category'), category),
    notes        = COALESCE(sqlc.narg('notes'), notes),
    fixed        = COALESCE(sqlc.narg('fixed'), fixed),
    -- so fixa tem valor variavel: deixar de ser fixa desliga
    variable_amount = COALESCE(sqlc.narg('fixed'), fixed) AND COALESCE(sqlc.narg('variable_amount'), variable_amount)
WHERE id = sqlc.arg('id') AND user_id = sqlc.arg('user_id')
RETURNING *;

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
INSERT INTO credit_cards (id, user_id, name, closing_day, due_day)
VALUES (?, ?, ?, ?, ?)
RETURNING *;

-- name: UpdateCreditCard :one
UPDATE credit_cards SET
    name        = COALESCE(sqlc.narg('name'), name),
    closing_day = COALESCE(sqlc.narg('closing_day'), closing_day),
    due_day     = COALESCE(sqlc.narg('due_day'), due_day)
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
INSERT INTO extra_expenses (id, user_id, name, amount_cents, month)
VALUES (?, ?, ?, ?, ?)
RETURNING *;

-- name: UpdateExtraExpense :one
UPDATE extra_expenses SET
    name         = COALESCE(sqlc.narg('name'), name),
    amount_cents = COALESCE(sqlc.narg('amount_cents'), amount_cents),
    month        = COALESCE(sqlc.narg('month'), month)
WHERE id = sqlc.arg('id') AND user_id = sqlc.arg('user_id')
RETURNING *;

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
