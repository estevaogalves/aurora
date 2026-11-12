-- +goose Up
-- Dia do vencimento de uma despesa (1 a 31), para o card "Próximos vencimentos" do Painel. 0 = sem dia (a despesa
-- não aparece no card: o Aurora não inventa datas). Só marca: não muda nenhum valor, total ou projeção.
-- Em despesa fixa vale para todos os meses; nos meses curtos, o dia vira o último dia do mês.
ALTER TABLE transactions ADD COLUMN due_day integer NOT NULL DEFAULT 0 CHECK (due_day BETWEEN 0 AND 31);

-- +goose Down
ALTER TABLE transactions DROP COLUMN due_day;
