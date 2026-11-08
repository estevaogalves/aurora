-- +goose Up
-- Pagamento de despesas: só registro para consulta e relatórios, não entra em nenhuma conta.
-- transactions.payments: por mês ("2026-11": {"method": "pix", "date": "2026-11-08", "notes": ""}),
-- porque uma despesa fixa pode estar paga em um mês e não em outro.
-- extra_expenses.payment: um pagamento só (a despesa extra existe em um único mês); null = não paga.
-- Só acrescenta colunas com valor padrão: os dados existentes ficam como estão.
ALTER TABLE transactions ADD COLUMN payments jsonb NOT NULL DEFAULT '{}';
ALTER TABLE extra_expenses ADD COLUMN payment jsonb;

-- +goose Down
ALTER TABLE extra_expenses DROP COLUMN payment;
ALTER TABLE transactions DROP COLUMN payments;
