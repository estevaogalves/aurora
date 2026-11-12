-- +goose Up
-- Encerrar uma despesa ou renda fixa a partir de um mês: end_month é o ÚLTIMO mês em que ela vale ("2026-11" =
-- vale até novembro e deixa de valer de dezembro em diante). Vazio = segue valendo, como sempre. Os meses
-- anteriores, os valores por mês e os pagamentos já registrados não mudam. Só acrescenta uma coluna com valor
-- padrão: as fixas que já existem ficam exatamente como estão.
-- (Versão SQLite da migration 00015 do Postgres.)
ALTER TABLE transactions ADD COLUMN end_month text NOT NULL DEFAULT '';

-- +goose Down
ALTER TABLE transactions DROP COLUMN end_month;
