-- +goose Up
-- Comprovantes (imagem ou PDF) anexados a uma despesa ou renda. Arquivos pequenos (até 300 KiB, no máximo 5 por
-- lançamento), guardados em blob: o conteúdo só sai por GET /receipts/{id}, nunca vai junto da lista de lançamentos.
-- Só marcas e anexos: nada aqui muda valor, saldo, projeção ou relatório. Tabela nova, nada do que existe muda.
-- Apagar o lançamento (ou a conta) apaga os comprovantes.
-- (Versão SQLite da migration 00023 do Postgres: mesmo número, mesmas colunas.)
CREATE TABLE transaction_receipts (
    id             uuid PRIMARY KEY NOT NULL,
    user_id        uuid NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    transaction_id uuid NOT NULL REFERENCES transactions (id) ON DELETE CASCADE,
    name           text NOT NULL,
    mime           text NOT NULL CHECK (mime IN ('image/png', 'image/jpeg', 'image/webp', 'application/pdf')),
    size_bytes     integer NOT NULL CHECK (size_bytes BETWEEN 1 AND 307200),
    data           blob NOT NULL,
    created_at     datetime NOT NULL DEFAULT (strftime('%Y-%m-%d %H:%M:%f', 'now'))
);
CREATE INDEX transaction_receipts_user_idx ON transaction_receipts (user_id);
CREATE INDEX transaction_receipts_transaction_idx ON transaction_receipts (transaction_id);

-- +goose Down
DROP TABLE transaction_receipts;
