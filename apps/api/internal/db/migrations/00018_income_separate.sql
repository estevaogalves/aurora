-- +goose Up
-- Renda "distribuir separado" (13º salário, bônus): a sugestão do saldo ganha uma fonte própria para ela, em vez
-- de somar tudo num saldo só. É só uma marca: não muda nenhum valor, saldo, projeção ou relatório.
-- Só acrescenta uma coluna com valor padrão: as rendas que já existem ficam como estão (nenhuma separada).
ALTER TABLE transactions ADD COLUMN separate boolean NOT NULL DEFAULT false;

-- +goose Down
ALTER TABLE transactions DROP COLUMN separate;
