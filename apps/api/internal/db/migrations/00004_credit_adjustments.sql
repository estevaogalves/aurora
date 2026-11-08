-- +goose Up
-- Ajustes por parcela de uma compra no crédito, pela posição ("1" a "N"):
-- {"3": {"advanced": {"month": "2026-11", "discount": 800, "amount": 9200}}, "2": {"value": 15000}, "1": {"removed": true}}
-- Só acrescenta uma coluna com valor padrão: as compras existentes ficam exatamente como estão.
ALTER TABLE credit_purchases ADD COLUMN adjustments jsonb NOT NULL DEFAULT '{}';

-- +goose Down
ALTER TABLE credit_purchases DROP COLUMN adjustments;
