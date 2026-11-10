-- +goose Up
-- Cartões de crédito: só nome e dias de fechamento e vencimento (nada sensível). Com cartão, a compra no
-- crédito entra no mês do vencimento da fatura. Só acrescenta: tabela nova e colunas com valor padrão,
-- então as compras que já existem (sem cartão) ficam exatamente como estão.
CREATE TABLE credit_cards (
    id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id     uuid    NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    name        text    NOT NULL,
    closing_day integer NOT NULL CHECK (closing_day BETWEEN 1 AND 31),
    due_day     integer NOT NULL CHECK (due_day BETWEEN 1 AND 31),
    created_at  timestamptz NOT NULL DEFAULT clock_timestamp()
);
CREATE INDEX credit_cards_user_idx ON credit_cards (user_id);
ALTER TABLE credit_cards ENABLE ROW LEVEL SECURITY;

-- Apagar o cartão solta as compras (card_id volta a null), nunca apaga compra.
ALTER TABLE credit_purchases ADD COLUMN card_id uuid REFERENCES credit_cards (id) ON DELETE SET NULL;
-- Recorrente de valor variável: total_cents é uma estimativa; o valor real de cada mês fica em adjustments.
ALTER TABLE credit_purchases ADD COLUMN variable_amount boolean NOT NULL DEFAULT false;

-- +goose Down
ALTER TABLE credit_purchases DROP COLUMN variable_amount;
ALTER TABLE credit_purchases DROP COLUMN card_id;
DROP TABLE credit_cards;
