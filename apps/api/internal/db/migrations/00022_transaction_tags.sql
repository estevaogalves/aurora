-- +goose Up
-- Etiquetas livres numa despesa ou renda (ex.: "viagem"), para buscar e filtrar em Lançamentos. Lista de textos em
-- JSON. Só marca: não muda valor, saldo, projeção ou relatório. Só acrescenta uma coluna com valor padrão.
-- (Versão SQLite da migration 00022 do Postgres: mesmo número, mesmo efeito.)
ALTER TABLE transactions ADD COLUMN tags jsontext NOT NULL DEFAULT '[]';

-- +goose Down
ALTER TABLE transactions DROP COLUMN tags;
