-- +goose Up
-- Porquinho: guardado sem valor de meta obrigatório (target_cents pode ficar em 0). Só acrescenta uma coluna com valor padrão.
ALTER TABLE goals ADD COLUMN piggy boolean NOT NULL DEFAULT false;

-- +goose Down
ALTER TABLE goals DROP COLUMN piggy;
