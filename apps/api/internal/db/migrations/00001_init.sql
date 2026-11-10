-- +goose Up
-- Schema do Aurora em SQLite (versão local, um arquivo .db). Valores em CENTAVOS (integer). Meses no formato "YYYY-MM".
-- Os nomes de tipo (uuid, jsontext, textlist) são lidos pelo sqlc (veja sqlc.yaml) e viram tipos Go; para o
-- SQLite todos guardam TEXT. ids são gerados no Go (google/uuid); created_at tem milissegundos.

CREATE TABLE users (
    id            uuid PRIMARY KEY NOT NULL,
    email         text NOT NULL,
    name          text NOT NULL DEFAULT '',
    password_hash text NOT NULL,
    role          text NOT NULL DEFAULT 'user' CHECK (role IN ('user', 'admin')),
    created_at    datetime NOT NULL DEFAULT (strftime('%Y-%m-%d %H:%M:%f', 'now'))
);
CREATE UNIQUE INDEX users_email_key ON users (lower(email));

CREATE TABLE refresh_tokens (
    id         integer PRIMARY KEY AUTOINCREMENT,
    user_id    uuid NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    token_hash text NOT NULL UNIQUE,
    expires_at datetime NOT NULL,
    revoked_at datetime,
    created_at datetime NOT NULL DEFAULT (strftime('%Y-%m-%d %H:%M:%f', 'now'))
);
CREATE INDEX refresh_tokens_user_idx ON refresh_tokens (user_id);

CREATE TABLE transactions (
    id              uuid PRIMARY KEY NOT NULL,
    user_id         uuid NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    name            text NOT NULL,
    amount_cents    integer NOT NULL,
    type            text NOT NULL CHECK (type IN ('income', 'expense')),
    category        text NOT NULL,
    notes           text NOT NULL DEFAULT '',
    fixed           boolean NOT NULL DEFAULT 0,
    month           text NOT NULL,
    payments        jsontext NOT NULL DEFAULT '{}',
    monthly_notes   jsontext NOT NULL DEFAULT '{}',
    variable_amount boolean NOT NULL DEFAULT 0,
    created_at      datetime NOT NULL DEFAULT (strftime('%Y-%m-%d %H:%M:%f', 'now'))
);
CREATE INDEX transactions_user_month_idx ON transactions (user_id, month);

-- Fixas: valor específico de um mês e/ou mês ocultado.
CREATE TABLE fixed_overrides (
    transaction_id uuid NOT NULL REFERENCES transactions (id) ON DELETE CASCADE,
    month          text NOT NULL,
    hidden         boolean NOT NULL DEFAULT 0,
    amount_cents   integer,
    PRIMARY KEY (transaction_id, month)
);

-- Cartões: só nome e dias de fechamento e vencimento (nada sensível).
CREATE TABLE credit_cards (
    id          uuid PRIMARY KEY NOT NULL,
    user_id     uuid NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    name        text NOT NULL,
    closing_day integer NOT NULL CHECK (closing_day BETWEEN 1 AND 31),
    due_day     integer NOT NULL CHECK (due_day BETWEEN 1 AND 31),
    created_at  datetime NOT NULL DEFAULT (strftime('%Y-%m-%d %H:%M:%f', 'now'))
);
CREATE INDEX credit_cards_user_idx ON credit_cards (user_id);

CREATE TABLE credit_purchases (
    id              uuid PRIMARY KEY NOT NULL,
    user_id         uuid NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    name            text NOT NULL,
    total_cents     integer NOT NULL,
    installments    integer NOT NULL CHECK (installments >= 1),
    start_month     text NOT NULL,
    category        text NOT NULL,
    adjustments     jsontext NOT NULL DEFAULT '{}',
    recurring       boolean NOT NULL DEFAULT 0,
    end_month       text,
    billing_day     integer NOT NULL DEFAULT 0,
    -- apagar o cartão solta as compras (card_id volta a null), nunca apaga compra
    card_id         uuid REFERENCES credit_cards (id) ON DELETE SET NULL,
    variable_amount boolean NOT NULL DEFAULT 0,
    created_at      datetime NOT NULL DEFAULT (strftime('%Y-%m-%d %H:%M:%f', 'now'))
);
CREATE INDEX credit_purchases_user_idx ON credit_purchases (user_id);

CREATE TABLE goals (
    id                uuid PRIMARY KEY NOT NULL,
    user_id           uuid NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    name              text NOT NULL,
    target_cents      integer NOT NULL DEFAULT 0,
    saved_cents       integer NOT NULL DEFAULT 0,
    monthly_cents     integer NOT NULL DEFAULT 0,
    deadline          text,
    yield_total_cents integer NOT NULL DEFAULT 0,
    piggy             boolean NOT NULL DEFAULT 0,
    created_at        datetime NOT NULL DEFAULT (strftime('%Y-%m-%d %H:%M:%f', 'now'))
);
CREATE INDEX goals_user_idx ON goals (user_id);

CREATE TABLE extra_expenses (
    id           uuid PRIMARY KEY NOT NULL,
    user_id      uuid NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    name         text NOT NULL,
    amount_cents integer NOT NULL,
    month        text NOT NULL,
    payment      jsontext,
    created_at   datetime NOT NULL DEFAULT (strftime('%Y-%m-%d %H:%M:%f', 'now'))
);
CREATE INDEX extra_expenses_user_idx ON extra_expenses (user_id, month);

CREATE TABLE notes (
    id         uuid PRIMARY KEY NOT NULL,
    user_id    uuid NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    content    text NOT NULL,
    date       text NOT NULL DEFAULT '',
    pinned     boolean NOT NULL DEFAULT 0,
    month      text NOT NULL,
    created_at datetime NOT NULL DEFAULT (strftime('%Y-%m-%d %H:%M:%f', 'now'))
);
CREATE INDEX notes_user_idx ON notes (user_id, month);

CREATE TABLE custom_categories (
    id      uuid PRIMARY KEY NOT NULL,
    user_id uuid NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    name    text NOT NULL,
    color   text NOT NULL
);
CREATE UNIQUE INDEX custom_categories_user_name_key ON custom_categories (user_id, lower(name));

-- Distribuição do saldo (null = padrão), avisos de meta já vistos e respostas ao tour de cada tela.
CREATE TABLE user_settings (
    user_id      uuid PRIMARY KEY NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    distribution jsontext,
    seen_alerts  textlist NOT NULL DEFAULT '[]',
    onboarding   jsontext NOT NULL DEFAULT '{}'
);

-- +goose Down
DROP TABLE user_settings;
DROP TABLE custom_categories;
DROP TABLE notes;
DROP TABLE extra_expenses;
DROP TABLE goals;
DROP TABLE credit_purchases;
DROP TABLE credit_cards;
DROP TABLE fixed_overrides;
DROP TABLE transactions;
DROP TABLE refresh_tokens;
DROP TABLE users;
