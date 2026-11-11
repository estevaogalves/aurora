-- +goose Up
-- Pagamento da fatura de um cartão: só registro para consulta, não entra em nenhuma conta.
-- credit_cards.payments: por mês de vencimento da fatura ("2026-12": {"method": "pix", "date": "2026-12-09", "notes": ""}),
-- no mesmo formato de transactions.payments. A fatura é uma visão agrupada (parcelas, recorrências e compras
-- avulsas do cartão) e este é o único dado que ela guarda: se foi paga, como e quando.
-- Só acrescenta uma coluna com valor padrão: os cartões que já existem ficam como estão (nenhuma fatura paga).
ALTER TABLE credit_cards ADD COLUMN payments jsonb NOT NULL DEFAULT '{}';

-- +goose Down
ALTER TABLE credit_cards DROP COLUMN payments;
