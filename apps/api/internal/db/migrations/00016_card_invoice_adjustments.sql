-- +goose Up
-- Ajustes da fatura de um cartão (descontos e acréscimos): só registro para a fatura bater com a do banco, não
-- entram em nenhuma despesa nem nos totais do mês.
-- credit_cards.adjustments: por mês de vencimento da fatura ("2026-12": [{"id": "...", "amount": -37, "note": "desconto"}]),
-- em centavos; negativo = desconto, positivo = acréscimo. Só acrescenta uma coluna com valor padrão.
-- (Versão SQLite da migration 00016 do Postgres.)
ALTER TABLE credit_cards ADD COLUMN adjustments jsontext NOT NULL DEFAULT '{}';

-- +goose Down
ALTER TABLE credit_cards DROP COLUMN adjustments;
