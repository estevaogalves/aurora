-- +goose Up
-- Compra recorrente no cartão (assinatura): um valor único (total_cents) cobrado todo mês a partir de start_month.
-- end_month é o último mês cobrado, preenchido ao cancelar a recorrência (null = segue cobrando).
-- Só acrescenta colunas com valor padrão: as compras parceladas existentes ficam exatamente como estão.
ALTER TABLE credit_purchases ADD COLUMN recurring boolean NOT NULL DEFAULT false;
ALTER TABLE credit_purchases ADD COLUMN end_month char(7);

-- +goose Down
ALTER TABLE credit_purchases DROP COLUMN end_month;
ALTER TABLE credit_purchases DROP COLUMN recurring;
