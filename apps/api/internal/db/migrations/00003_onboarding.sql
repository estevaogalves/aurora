-- +goose Up
-- Resposta do usuário ao tour de cada tela: {"painel": "done", "metas": "dismissed"}.
ALTER TABLE user_settings ADD COLUMN onboarding jsonb NOT NULL DEFAULT '{}';

-- +goose Down
ALTER TABLE user_settings DROP COLUMN onboarding;
