-- +goose Up
-- Histórico de metas e porquinhos, no mesmo conceito dos investimentos: cada aporte, retirada, rendimento ou
-- ajuste vira uma movimentação datada, e o valor guardado (goals.saved_cents / yield_total_cents) passa a ser
-- refeito por elas (veja domain.ReplayGoal). Valores em CENTAVOS; datas "AAAA-MM-DD".
-- Só acrescenta: uma tabela nova e duas colunas com valor padrão. Nada do que já existe muda de valor.
CREATE TABLE goal_movements (
    id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id      uuid    NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    goal_id      uuid    NOT NULL REFERENCES goals (id) ON DELETE CASCADE,
    type         text    NOT NULL CHECK (type IN ('contribution', 'withdrawal', 'yield', 'adjustment')),
    date         text    NOT NULL,
    -- valor da movimentação; no ajuste, é o novo valor guardado
    amount_cents bigint  NOT NULL CHECK (amount_cents >= 0),
    note         text    NOT NULL DEFAULT '',
    -- de onde veio: vazio = lançado à mão; "distribution|AAAA-MM|fonte|fatia" = enviado pela sugestão do saldo
    origin       text    NOT NULL DEFAULT '',
    created_at   timestamptz NOT NULL DEFAULT clock_timestamp()
);
CREATE INDEX goal_movements_user_idx ON goal_movements (user_id);
CREATE INDEX goal_movements_goal_idx ON goal_movements (goal_id);
ALTER TABLE goal_movements ENABLE ROW LEVEL SECURITY;

-- Os investimentos também passam a guardar a observação e a origem de cada movimentação.
ALTER TABLE investment_movements ADD COLUMN note   text NOT NULL DEFAULT '';
ALTER TABLE investment_movements ADD COLUMN origin text NOT NULL DEFAULT '';

-- Metas que já existem ganham um começo de histórico que reproduz exatamente o que estava guardado:
-- primeiro os rendimentos (que somam no guardado e no total de rendimentos) e depois um ajuste que define
-- o guardado. Assim refazer a conta pelas movimentações devolve os mesmos valores de antes.
INSERT INTO goal_movements (user_id, goal_id, type, date, amount_cents, note)
SELECT user_id, id, 'yield', to_char(created_at AT TIME ZONE 'UTC', 'YYYY-MM-DD'), yield_total_cents, 'Rendimentos até aqui'
FROM goals WHERE yield_total_cents > 0;

INSERT INTO goal_movements (user_id, goal_id, type, date, amount_cents, note)
SELECT user_id, id, 'adjustment', to_char(created_at AT TIME ZONE 'UTC', 'YYYY-MM-DD'), saved_cents, 'Saldo inicial'
FROM goals WHERE saved_cents > 0 OR yield_total_cents > 0;

-- +goose Down
ALTER TABLE investment_movements DROP COLUMN origin;
ALTER TABLE investment_movements DROP COLUMN note;
DROP TABLE goal_movements;
