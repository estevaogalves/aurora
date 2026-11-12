-- +goose Up
-- Ajuste da fatura de um cartão (desconto ou acréscimo): só registro para a fatura bater com a do banco, não entra
-- em nenhuma despesa nem nos totais do mês.
-- credit_cards.adjustments: por mês de vencimento da fatura ("2026-12": {"amount": -37, "note": "desconto"}), em centavos;
-- negativo = desconto, positivo = acréscimo.
-- Só acrescenta uma coluna com valor padrão: os cartões que já existem ficam como estão (nenhum ajuste).
ALTER TABLE credit_cards ADD COLUMN adjustments jsonb NOT NULL DEFAULT '{}';

-- +goose Down
ALTER TABLE credit_cards DROP COLUMN adjustments;
