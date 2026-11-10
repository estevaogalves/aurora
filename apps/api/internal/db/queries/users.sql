-- name: CreateUser :one
INSERT INTO users (id, email, name, password_hash, role)
VALUES (?, ?, ?, ?, ?)
RETURNING *;

-- name: GetUserByEmail :one
SELECT * FROM users WHERE lower(email) = lower(?);

-- name: GetUserByID :one
SELECT * FROM users WHERE id = ?;

-- name: ListUsers :many
SELECT * FROM users ORDER BY created_at;

-- name: CountUsers :one
SELECT count(*) FROM users;

-- name: CreateRefreshToken :exec
INSERT INTO refresh_tokens (user_id, token_hash, expires_at) VALUES (?, ?, ?);

-- name: GetRefreshToken :one
SELECT * FROM refresh_tokens WHERE token_hash = ?;

-- name: RevokeRefreshToken :exec
UPDATE refresh_tokens SET revoked_at = strftime('%Y-%m-%d %H:%M:%f', 'now') WHERE token_hash = ? AND revoked_at IS NULL;

-- name: RevokeUserRefreshTokens :many
UPDATE refresh_tokens SET revoked_at = strftime('%Y-%m-%d %H:%M:%f', 'now')
WHERE user_id = ? AND revoked_at IS NULL
RETURNING token_hash;

-- name: DeleteExpiredRefreshTokens :exec
DELETE FROM refresh_tokens WHERE expires_at < strftime('%Y-%m-%d %H:%M:%f', 'now', '-7 days');

-- name: EnsureSettings :exec
INSERT INTO user_settings (user_id) VALUES (?) ON CONFLICT DO NOTHING;

-- name: GetSettings :one
SELECT * FROM user_settings WHERE user_id = ?;

-- name: SetDistribution :exec
INSERT INTO user_settings (user_id, distribution) VALUES (?, ?)
ON CONFLICT (user_id) DO UPDATE SET distribution = EXCLUDED.distribution;

-- name: SetSeenAlerts :exec
INSERT INTO user_settings (user_id, seen_alerts) VALUES (?, ?)
ON CONFLICT (user_id) DO UPDATE SET seen_alerts = EXCLUDED.seen_alerts;

-- name: SetOnboardingScreen :exec
-- Muda so a chave da tela, para dois dispositivos nao apagarem as respostas um do outro.
INSERT INTO user_settings (user_id, onboarding)
VALUES (?, json_object(CAST(sqlc.arg(screen) AS TEXT), CAST(sqlc.arg(state) AS TEXT)))
ON CONFLICT (user_id) DO UPDATE
SET onboarding = json_patch(user_settings.onboarding, EXCLUDED.onboarding);

-- name: MergeOnboarding :exec
INSERT INTO user_settings (user_id, onboarding) VALUES (?, ?)
ON CONFLICT (user_id) DO UPDATE SET onboarding = json_patch(user_settings.onboarding, EXCLUDED.onboarding);

-- name: LockAdmins :many
-- As transacoes do SQLite comecam com BEGIN IMMEDIATE (veja db.Open): so uma escreve por vez, entao
-- dois rebaixamentos simultaneos nao zeram a lista de admins.
SELECT id FROM users WHERE role = 'admin' ORDER BY id;

-- name: SetUserRole :one
UPDATE users SET role = ? WHERE id = ? RETURNING *;

-- name: DeleteUser :execrows
-- Apaga a conta e, em cascata, tudo que e dela (lancamentos, metas, notas, configuracoes, refresh tokens).
DELETE FROM users WHERE id = ?;
