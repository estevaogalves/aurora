-- +goose Up
-- Negócio próprio (revenda etc.): nova família "business" e novo tipo de movimentação "income" (recebimento).
-- (Versão SQLite da migration 00019 do Postgres: mesmo número, mesmo efeito.)
-- O SQLite não altera uma regra CHECK no lugar; então as duas tabelas são refeitas, com as linhas copiadas
-- antes (cópias temporárias) para o ON DELETE CASCADE não levar nada junto. Nenhuma linha existente muda.
CREATE TABLE _investments_bak AS SELECT * FROM investments;
CREATE TABLE _investment_movements_bak AS SELECT * FROM investment_movements;
DROP TABLE investment_movements;
DROP TABLE investments;

CREATE TABLE investments (
    id                  uuid PRIMARY KEY NOT NULL,
    user_id             uuid NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    name                text NOT NULL,
    family              text NOT NULL CHECK (family IN ('fixed', 'treasury', 'liquid', 'equity', 'fund', 'other', 'business')),
    product             text NOT NULL DEFAULT '',
    institution         text NOT NULL,
    applied_at          text NOT NULL,
    current_value_cents integer NOT NULL DEFAULT 0 CHECK (current_value_cents >= 0),
    maturity_date       text NOT NULL DEFAULT '',
    indexer             text NOT NULL DEFAULT '',
    rate                text NOT NULL DEFAULT '',
    liquidity           text NOT NULL DEFAULT '',
    grace_until         text NOT NULL DEFAULT '',
    early_redeem        boolean NOT NULL DEFAULT 0,
    quantity            real CHECK (quantity >= 0),
    avg_price_cents     integer CHECK (avg_price_cents >= 0),
    redeem_days         integer NOT NULL DEFAULT 0 CHECK (redeem_days >= 0),
    ticker              text NOT NULL DEFAULT '',
    fees                text NOT NULL DEFAULT '',
    notes               text NOT NULL DEFAULT '',
    created_at          datetime NOT NULL DEFAULT (strftime('%Y-%m-%d %H:%M:%f', 'now'))
);
CREATE INDEX investments_user_idx ON investments (user_id);

CREATE TABLE investment_movements (
    id               uuid PRIMARY KEY NOT NULL,
    user_id          uuid NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    investment_id    uuid NOT NULL REFERENCES investments (id) ON DELETE CASCADE,
    type             text NOT NULL CHECK (type IN ('contribution', 'redemption', 'yield', 'adjustment', 'income')),
    date             text NOT NULL,
    amount_cents     integer NOT NULL CHECK (amount_cents >= 0),
    quantity         real CHECK (quantity >= 0),
    unit_price_cents integer CHECK (unit_price_cents >= 0),
    created_at       datetime NOT NULL DEFAULT (strftime('%Y-%m-%d %H:%M:%f', 'now')),
    note             text NOT NULL DEFAULT '',
    origin           text NOT NULL DEFAULT ''
);
CREATE INDEX investment_movements_user_idx ON investment_movements (user_id);
CREATE INDEX investment_movements_investment_idx ON investment_movements (investment_id);

INSERT INTO investments (id, user_id, name, family, product, institution, applied_at, current_value_cents, maturity_date, indexer, rate, liquidity, grace_until, early_redeem, quantity, avg_price_cents, redeem_days, ticker, fees, notes, created_at)
    SELECT id, user_id, name, family, product, institution, applied_at, current_value_cents, maturity_date, indexer, rate, liquidity, grace_until, early_redeem, quantity, avg_price_cents, redeem_days, ticker, fees, notes, created_at FROM _investments_bak;
INSERT INTO investment_movements (id, user_id, investment_id, type, date, amount_cents, quantity, unit_price_cents, created_at, note, origin)
    SELECT id, user_id, investment_id, type, date, amount_cents, quantity, unit_price_cents, created_at, note, origin FROM _investment_movements_bak;
DROP TABLE _investment_movements_bak;
DROP TABLE _investments_bak;

-- +goose Down
DELETE FROM investment_movements WHERE type = 'income' OR investment_id IN (SELECT id FROM investments WHERE family = 'business');
DELETE FROM investments WHERE family = 'business';
CREATE TABLE _investments_bak AS SELECT * FROM investments;
CREATE TABLE _investment_movements_bak AS SELECT * FROM investment_movements;
DROP TABLE investment_movements;
DROP TABLE investments;

CREATE TABLE investments (
    id                  uuid PRIMARY KEY NOT NULL,
    user_id             uuid NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    name                text NOT NULL,
    family              text NOT NULL CHECK (family IN ('fixed', 'treasury', 'liquid', 'equity', 'fund', 'other')),
    product             text NOT NULL DEFAULT '',
    institution         text NOT NULL,
    applied_at          text NOT NULL,
    current_value_cents integer NOT NULL DEFAULT 0 CHECK (current_value_cents >= 0),
    maturity_date       text NOT NULL DEFAULT '',
    indexer             text NOT NULL DEFAULT '',
    rate                text NOT NULL DEFAULT '',
    liquidity           text NOT NULL DEFAULT '',
    grace_until         text NOT NULL DEFAULT '',
    early_redeem        boolean NOT NULL DEFAULT 0,
    quantity            real CHECK (quantity >= 0),
    avg_price_cents     integer CHECK (avg_price_cents >= 0),
    redeem_days         integer NOT NULL DEFAULT 0 CHECK (redeem_days >= 0),
    ticker              text NOT NULL DEFAULT '',
    fees                text NOT NULL DEFAULT '',
    notes               text NOT NULL DEFAULT '',
    created_at          datetime NOT NULL DEFAULT (strftime('%Y-%m-%d %H:%M:%f', 'now'))
);
CREATE INDEX investments_user_idx ON investments (user_id);

CREATE TABLE investment_movements (
    id               uuid PRIMARY KEY NOT NULL,
    user_id          uuid NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    investment_id    uuid NOT NULL REFERENCES investments (id) ON DELETE CASCADE,
    type             text NOT NULL CHECK (type IN ('contribution', 'redemption', 'yield', 'adjustment')),
    date             text NOT NULL,
    amount_cents     integer NOT NULL CHECK (amount_cents >= 0),
    quantity         real CHECK (quantity >= 0),
    unit_price_cents integer CHECK (unit_price_cents >= 0),
    created_at       datetime NOT NULL DEFAULT (strftime('%Y-%m-%d %H:%M:%f', 'now')),
    note             text NOT NULL DEFAULT '',
    origin           text NOT NULL DEFAULT ''
);
CREATE INDEX investment_movements_user_idx ON investment_movements (user_id);
CREATE INDEX investment_movements_investment_idx ON investment_movements (investment_id);

INSERT INTO investments SELECT * FROM _investments_bak;
INSERT INTO investment_movements SELECT * FROM _investment_movements_bak;
DROP TABLE _investment_movements_bak;
DROP TABLE _investments_bak;
