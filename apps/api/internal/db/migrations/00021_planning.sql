-- +goose Up
-- Planejamento do usuário: orçamento por categoria, dívidas e consórcios, fechamento do mês e carteira manual de
-- dividendos, guardados juntos num único documento JSON em user_settings. Só marcas e anotações: nada aqui muda
-- valor, saldo, projeção ou relatório. Só acrescenta uma coluna com valor padrão.
-- (Versão SQLite da migration 00021 do Postgres: mesmo número, mesmo efeito.)
ALTER TABLE user_settings ADD COLUMN planning jsontext NOT NULL DEFAULT '{}';

-- +goose Down
ALTER TABLE user_settings DROP COLUMN planning;
