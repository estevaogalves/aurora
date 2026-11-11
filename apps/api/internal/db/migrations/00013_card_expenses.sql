-- +goose Up
-- Despesas no cartão: despesas (comuns e extras) podem apontar para um cartão e guardar o dia da compra, e o
-- cartão ganha um teto mensal opcional. Só acrescenta colunas com valor padrão: os registros que já existem
-- (sem cartão, sem teto) ficam exatamente como estão.
--
-- Com cartão e dia da compra, a despesa vale no mês do vencimento da fatura (domain.ResolveCardExpenses);
-- `month` e `purchase_date` continuam como foram lançados. Apagar o cartão solta as despesas (card_id volta a
-- null), nunca apaga despesa, e o dia da compra fica no histórico.
ALTER TABLE transactions   ADD COLUMN card_id uuid REFERENCES credit_cards (id) ON DELETE SET NULL;
ALTER TABLE transactions   ADD COLUMN purchase_date text NOT NULL DEFAULT '';
ALTER TABLE extra_expenses ADD COLUMN card_id uuid REFERENCES credit_cards (id) ON DELETE SET NULL;
ALTER TABLE extra_expenses ADD COLUMN purchase_date text NOT NULL DEFAULT '';

-- Teto mensal da fatura, em centavos. 0 = sem teto. Só acompanhamento: não bloqueia nada.
ALTER TABLE credit_cards ADD COLUMN limit_cents bigint NOT NULL DEFAULT 0 CHECK (limit_cents >= 0);

-- +goose Down
ALTER TABLE credit_cards   DROP COLUMN limit_cents;
ALTER TABLE extra_expenses DROP COLUMN purchase_date;
ALTER TABLE extra_expenses DROP COLUMN card_id;
ALTER TABLE transactions   DROP COLUMN purchase_date;
ALTER TABLE transactions   DROP COLUMN card_id;
