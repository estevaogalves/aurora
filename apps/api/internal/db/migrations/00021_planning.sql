-- +goose Up
-- Planejamento do usuário: orçamento por categoria, dívidas e consórcios, fechamento do mês e carteira manual de
-- dividendos. São listas pequenas por conta, guardadas juntas num único jsonb em user_settings (como as distribuições
-- próprias): {"budgets": {...}, "debts": [...], "closings": {...}, "dividendAssets": [...]}. Só marcas e anotações:
-- nada aqui muda valor, saldo, projeção ou relatório. Só acrescenta uma coluna com valor padrão.
ALTER TABLE user_settings ADD COLUMN planning jsonb NOT NULL DEFAULT '{}';

-- +goose Down
ALTER TABLE user_settings DROP COLUMN planning;
