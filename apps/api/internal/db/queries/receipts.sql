-- name: ListReceipts :many
-- So os dados do anexo, sem o conteudo (o conteudo sai por GetReceipt).
SELECT id, transaction_id, name, mime, size_bytes, created_at
FROM transaction_receipts WHERE user_id = ? ORDER BY created_at, rowid;

-- name: CountReceiptsOfTransaction :one
SELECT count(*) FROM transaction_receipts WHERE user_id = ? AND transaction_id = ?;

-- name: CreateReceipt :one
INSERT INTO transaction_receipts (id, user_id, transaction_id, name, mime, size_bytes, data)
VALUES (?, ?, ?, ?, ?, ?, ?)
RETURNING id, transaction_id, name, mime, size_bytes, created_at;

-- name: GetReceipt :one
SELECT * FROM transaction_receipts WHERE id = ? AND user_id = ?;

-- name: DeleteReceipt :execrows
DELETE FROM transaction_receipts WHERE id = ? AND user_id = ?;
