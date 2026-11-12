-- name: ListReceipts :many
-- Só os dados do anexo, sem o conteúdo (o conteúdo sai por GetReceipt).
SELECT id, transaction_id, name, mime, size_bytes, created_at
FROM transaction_receipts WHERE user_id = $1 ORDER BY created_at, id;

-- name: CountReceiptsOfTransaction :one
SELECT count(*) FROM transaction_receipts WHERE user_id = $1 AND transaction_id = $2;

-- name: CreateReceipt :one
INSERT INTO transaction_receipts (id, user_id, transaction_id, name, mime, size_bytes, data)
VALUES (COALESCE(NULLIF($1::uuid, '00000000-0000-0000-0000-000000000000'), gen_random_uuid()), $2, $3, $4, $5, $6, $7)
RETURNING id, transaction_id, name, mime, size_bytes, created_at;

-- name: GetReceipt :one
SELECT * FROM transaction_receipts WHERE id = $1 AND user_id = $2;

-- name: DeleteReceipt :execrows
DELETE FROM transaction_receipts WHERE id = $1 AND user_id = $2;
