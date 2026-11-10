-- +goose Up
-- Observação de uma despesa/renda fixa é só do mês, não se repete nos seguintes.
-- transactions.notes continua valendo no mês de criação; monthly_notes guarda as dos outros meses
-- ("2026-12": "texto"). Só acrescenta uma coluna com valor padrão: os dados existentes ficam como estão.
ALTER TABLE transactions ADD COLUMN monthly_notes jsonb NOT NULL DEFAULT '{}';

-- +goose Down
ALTER TABLE transactions DROP COLUMN monthly_notes;
