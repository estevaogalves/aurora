-- +goose Up
-- Fixa que terminou porque o usuário a desfixou num mês posterior ao de criação: o fim (end_month) é o mesmo mecanismo
-- do "encerrar a partir daqui", mas a lista de encerradas só mostra as encerradas de propósito. Só acrescenta uma
-- coluna com valor padrão: as fixas que já existem ficam exatamente como estão.
ALTER TABLE transactions ADD COLUMN end_by_unfix boolean NOT NULL DEFAULT false;

-- +goose Down
ALTER TABLE transactions DROP COLUMN end_by_unfix;
