-- name: CreateUser :one
INSERT INTO users (email, name, password_hash, role)
VALUES ($1, $2, $3, $4)
RETURNING *;

-- name: GetUserByEmail :one
SELECT * FROM users WHERE lower(email) = lower($1);

-- name: GetUserByID :one
SELECT * FROM users WHERE id = $1;

-- name: ListUsers :many
SELECT * FROM users ORDER BY created_at;

-- name: CountUsers :one
SELECT count(*) FROM users;

-- name: CreateRefreshToken :exec
INSERT INTO refresh_tokens (user_id, token_hash, expires_at) VALUES ($1, $2, $3);

-- name: GetRefreshToken :one
SELECT * FROM refresh_tokens WHERE token_hash = $1;

-- name: RevokeRefreshToken :exec
UPDATE refresh_tokens SET revoked_at = now() WHERE token_hash = $1 AND revoked_at IS NULL;

-- name: RevokeUserRefreshTokens :many
UPDATE refresh_tokens SET revoked_at = now()
WHERE user_id = $1 AND revoked_at IS NULL
RETURNING token_hash;

-- name: DeleteExpiredRefreshTokens :exec
DELETE FROM refresh_tokens WHERE expires_at < now() - interval '7 days';

-- name: EnsureSettings :exec
INSERT INTO user_settings (user_id) VALUES ($1) ON CONFLICT DO NOTHING;

-- name: GetSettings :one
SELECT * FROM user_settings WHERE user_id = $1;

-- name: SetDistribution :exec
INSERT INTO user_settings (user_id, distribution) VALUES ($1, $2)
ON CONFLICT (user_id) DO UPDATE SET distribution = EXCLUDED.distribution;

-- name: SetSeenAlerts :exec
INSERT INTO user_settings (user_id, seen_alerts) VALUES ($1, $2)
ON CONFLICT (user_id) DO UPDATE SET seen_alerts = EXCLUDED.seen_alerts;

-- name: SetOnboardingScreen :exec
-- Muda só a chave da tela, para dois dispositivos não apagarem as respostas um do outro.
INSERT INTO user_settings (user_id, onboarding)
VALUES ($1, jsonb_build_object(sqlc.arg(screen)::text, sqlc.arg(state)::text))
ON CONFLICT (user_id) DO UPDATE
SET onboarding = user_settings.onboarding || jsonb_build_object(sqlc.arg(screen)::text, sqlc.arg(state)::text);

-- name: MergeOnboarding :exec
INSERT INTO user_settings (user_id, onboarding) VALUES ($1, $2)
ON CONFLICT (user_id) DO UPDATE SET onboarding = user_settings.onboarding || EXCLUDED.onboarding;
