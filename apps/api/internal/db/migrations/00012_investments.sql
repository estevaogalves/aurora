-- +goose Up
-- Investimentos registrados à mão (sem integração com banco ou corretora) e as movimentações de cada um.
-- Só acrescenta: duas tabelas novas, nada do que já existe muda. Ficam separados do fluxo de caixa:
-- aporte não é despesa e resgate não é receita. Valores em CENTAVOS; datas "AAAA-MM-DD".
CREATE TABLE investments (
    id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id             uuid    NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    name                text    NOT NULL,
    family              text    NOT NULL CHECK (family IN ('fixed', 'treasury', 'liquid', 'equity', 'fund', 'other')),
    product             text    NOT NULL DEFAULT '',
    institution         text    NOT NULL,
    applied_at          text    NOT NULL,
    -- valor atual: refeito pelas movimentações (veja domain.ReplayInvestment) ou digitado no Editar
    current_value_cents bigint  NOT NULL DEFAULT 0 CHECK (current_value_cents >= 0),
    maturity_date       text    NOT NULL DEFAULT '',
    indexer             text    NOT NULL DEFAULT '',
    rate                text    NOT NULL DEFAULT '',
    liquidity           text    NOT NULL DEFAULT '',
    grace_until         text    NOT NULL DEFAULT '',
    early_redeem        boolean NOT NULL DEFAULT false,
    -- cotas e preço médio: nulos enquanto o investimento não controla quantidade (cotas fracionárias, até 6 casas)
    quantity            numeric(20, 6) CHECK (quantity >= 0),
    avg_price_cents     bigint  CHECK (avg_price_cents >= 0),
    redeem_days         integer NOT NULL DEFAULT 0 CHECK (redeem_days >= 0),
    ticker              text    NOT NULL DEFAULT '',
    fees                text    NOT NULL DEFAULT '',
    notes               text    NOT NULL DEFAULT '',
    created_at          timestamptz NOT NULL DEFAULT clock_timestamp()
);
CREATE INDEX investments_user_idx ON investments (user_id);
ALTER TABLE investments ENABLE ROW LEVEL SECURITY;

-- Apagar o investimento apaga as movimentações dele.
CREATE TABLE investment_movements (
    id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id          uuid    NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    investment_id    uuid    NOT NULL REFERENCES investments (id) ON DELETE CASCADE,
    type             text    NOT NULL CHECK (type IN ('contribution', 'redemption', 'yield', 'adjustment')),
    date             text    NOT NULL,
    -- valor total da movimentação; no ajuste, é o novo valor atual
    amount_cents     bigint  NOT NULL CHECK (amount_cents >= 0),
    quantity         numeric(20, 6) CHECK (quantity >= 0),
    unit_price_cents bigint  CHECK (unit_price_cents >= 0),
    created_at       timestamptz NOT NULL DEFAULT clock_timestamp()
);
CREATE INDEX investment_movements_user_idx ON investment_movements (user_id);
CREATE INDEX investment_movements_investment_idx ON investment_movements (investment_id);
ALTER TABLE investment_movements ENABLE ROW LEVEL SECURITY;

-- +goose Down
DROP TABLE investment_movements;
DROP TABLE investments;
