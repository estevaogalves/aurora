-- +goose Up
-- Dia da cobrança escolhido ao cadastrar a compra no crédito (1 a 31). 0 = não informado: as compras que já existem ficam como estão.
-- Nos meses mais curtos a cobrança cai no último dia do mês (dia 31 -> 28/29 em fevereiro).
ALTER TABLE credit_purchases ADD COLUMN billing_day integer NOT NULL DEFAULT 0;

-- +goose Down
ALTER TABLE credit_purchases DROP COLUMN billing_day;
