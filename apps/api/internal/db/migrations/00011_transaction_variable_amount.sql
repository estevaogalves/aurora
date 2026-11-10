-- +goose Up
-- Despesa/renda fixa de valor variável: o valor da fixa é uma estimativa e cada mês aceita o valor real
-- (os valores reais ficam em fixed_overrides, como qualquer valor específico de um mês).
-- Só acrescenta uma coluna com valor padrão: os dados existentes ficam como estão.
ALTER TABLE transactions ADD COLUMN variable_amount boolean NOT NULL DEFAULT false;

-- +goose Down
ALTER TABLE transactions DROP COLUMN variable_amount;
