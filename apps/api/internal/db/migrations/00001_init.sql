-- +goose Up
CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE users (
    id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    email         text        NOT NULL,
    name          text        NOT NULL DEFAULT '',
    password_hash text        NOT NULL,
    role          text        NOT NULL DEFAULT 'user' CHECK (role IN ('user', 'admin')),
    created_at    timestamptz NOT NULL DEFAULT clock_timestamp()
);
CREATE UNIQUE INDEX users_email_key ON users (lower(email));

CREATE TABLE refresh_tokens (
    id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id    uuid        NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    token_hash text        NOT NULL UNIQUE,
    expires_at timestamptz NOT NULL,
    revoked_at timestamptz,
    created_at timestamptz NOT NULL DEFAULT clock_timestamp()
);
CREATE INDEX refresh_tokens_user_idx ON refresh_tokens (user_id);

-- Valores em CENTAVOS (bigint). Meses no formato "YYYY-MM".
CREATE TABLE transactions (
    id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id      uuid    NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    name         text    NOT NULL,
    amount_cents bigint  NOT NULL,
    type         text    NOT NULL CHECK (type IN ('income', 'expense')),
    category     text    NOT NULL,
    notes        text    NOT NULL DEFAULT '',
    fixed        boolean NOT NULL DEFAULT false,
    month        char(7) NOT NULL,
    created_at   timestamptz NOT NULL DEFAULT clock_timestamp()
);
CREATE INDEX transactions_user_month_idx ON transactions (user_id, month);

-- Fixas: valor específico de um mês e/ou mês ocultado.
CREATE TABLE fixed_overrides (
    transaction_id uuid    NOT NULL REFERENCES transactions (id) ON DELETE CASCADE,
    month          char(7) NOT NULL,
    hidden         boolean NOT NULL DEFAULT false,
    amount_cents   bigint,
    PRIMARY KEY (transaction_id, month)
);

CREATE TABLE credit_purchases (
    id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id     uuid    NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    name        text    NOT NULL,
    total_cents bigint  NOT NULL,
    installments integer NOT NULL CHECK (installments >= 1),
    start_month char(7) NOT NULL,
    category    text    NOT NULL,
    created_at  timestamptz NOT NULL DEFAULT clock_timestamp()
);
CREATE INDEX credit_purchases_user_idx ON credit_purchases (user_id);

CREATE TABLE goals (
    id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id           uuid    NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    name              text    NOT NULL,
    target_cents      bigint  NOT NULL DEFAULT 0,
    saved_cents       bigint  NOT NULL DEFAULT 0,
    monthly_cents     bigint  NOT NULL DEFAULT 0,
    deadline          char(7),
    yield_total_cents bigint  NOT NULL DEFAULT 0,
    created_at        timestamptz NOT NULL DEFAULT clock_timestamp()
);
CREATE INDEX goals_user_idx ON goals (user_id);

CREATE TABLE extra_expenses (
    id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id      uuid    NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    name         text    NOT NULL,
    amount_cents bigint  NOT NULL,
    month        char(7) NOT NULL,
    created_at   timestamptz NOT NULL DEFAULT clock_timestamp()
);
CREATE INDEX extra_expenses_user_idx ON extra_expenses (user_id, month);

CREATE TABLE notes (
    id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id    uuid    NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    content    text    NOT NULL,
    date       text    NOT NULL DEFAULT '',
    pinned     boolean NOT NULL DEFAULT false,
    month      char(7) NOT NULL,
    created_at timestamptz NOT NULL DEFAULT clock_timestamp()
);
CREATE INDEX notes_user_idx ON notes (user_id, month);

CREATE TABLE custom_categories (
    id      uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    name    text NOT NULL,
    color   text NOT NULL
);
CREATE UNIQUE INDEX custom_categories_user_name_key ON custom_categories (user_id, lower(name));

-- Distribuição do saldo (null = padrão) e avisos de meta já vistos.
CREATE TABLE user_settings (
    user_id      uuid PRIMARY KEY REFERENCES users (id) ON DELETE CASCADE,
    distribution jsonb,
    seen_alerts  text[] NOT NULL DEFAULT '{}'
);

-- +goose Down
DROP TABLE user_settings;
DROP TABLE custom_categories;
DROP TABLE notes;
DROP TABLE extra_expenses;
DROP TABLE goals;
DROP TABLE credit_purchases;
DROP TABLE fixed_overrides;
DROP TABLE transactions;
DROP TABLE refresh_tokens;
DROP TABLE users;
