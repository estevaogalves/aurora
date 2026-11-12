-- +goose Up
-- Sugestão do saldo em várias distribuições: a Dist 1 é sempre o saldo do mês; uma renda variável (13º, bônus) pode
-- ser somada à Dist 1 ou criar/entrar numa distribuição própria (Dist 2, 3...), cada uma com a sua página no Painel.
-- Só marcas e preferências: nada aqui muda valor, saldo, projeção ou relatório.
-- Só acrescenta colunas com valor padrão: o que já existe fica como está (tudo na Dist 1, sem percentuais próprios).

-- transactions.dist_group: 0 = soma ao saldo do mês (Dist 1); 2 a 20 = número da distribuição própria. Só renda não fixa.
ALTER TABLE transactions ADD COLUMN dist_group integer NOT NULL DEFAULT 0 CHECK (dist_group = 0 OR dist_group BETWEEN 2 AND 20);

-- user_settings.distribution_overrides: percentuais próprios de uma distribuição de um mês, por chave "AAAA-MM|n"
-- ("2026-12|2": [{"id":"emergency","label":"Reserva de emergência","percent":50}, ...]). Sem a chave, vale o padrão.
ALTER TABLE user_settings ADD COLUMN distribution_overrides jsonb NOT NULL DEFAULT '{}';

-- +goose Down
ALTER TABLE user_settings DROP COLUMN distribution_overrides;
ALTER TABLE transactions DROP COLUMN dist_group;
