-- +goose Up
-- Etiquetas livres numa despesa ou renda (ex.: "viagem", "Heitor"), para buscar e filtrar em Lançamentos. Lista de
-- textos em jsonb. Só marca: não muda valor, saldo, projeção ou relatório. Só acrescenta uma coluna com valor padrão.
ALTER TABLE transactions ADD COLUMN tags jsonb NOT NULL DEFAULT '[]';

-- +goose Down
ALTER TABLE transactions DROP COLUMN tags;
