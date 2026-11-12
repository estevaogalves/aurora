-- +goose Up
-- Dia do vencimento de uma despesa (1 a 31), para o card "Próximos vencimentos" do Painel. 0 = sem dia (a despesa
-- não aparece no card: o Aurora não inventa datas). Só marca: não muda nenhum valor, total ou projeção.
-- (Versão SQLite da migration 00020 do Postgres: mesmo número, mesmo efeito.)
ALTER TABLE transactions ADD COLUMN due_day integer NOT NULL DEFAULT 0 CHECK (due_day BETWEEN 0 AND 31);

-- +goose Down
ALTER TABLE transactions DROP COLUMN due_day;
