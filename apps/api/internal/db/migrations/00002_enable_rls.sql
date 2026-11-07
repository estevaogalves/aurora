-- +goose Up
-- Em bancos que expõem o schema public por uma API própria (Supabase/PostgREST), tabelas sem RLS
-- ficam legíveis com a chave pública. Ligando o RLS sem nenhuma policy, só quem é dono das tabelas
-- (o usuário que a API usa para conectar) enxerga os dados. Em um Postgres comum não muda nada.
ALTER TABLE users            ENABLE ROW LEVEL SECURITY;
ALTER TABLE refresh_tokens   ENABLE ROW LEVEL SECURITY;
ALTER TABLE transactions     ENABLE ROW LEVEL SECURITY;
ALTER TABLE fixed_overrides  ENABLE ROW LEVEL SECURITY;
ALTER TABLE credit_purchases ENABLE ROW LEVEL SECURITY;
ALTER TABLE goals            ENABLE ROW LEVEL SECURITY;
ALTER TABLE extra_expenses   ENABLE ROW LEVEL SECURITY;
ALTER TABLE notes            ENABLE ROW LEVEL SECURITY;
ALTER TABLE custom_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_settings    ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS goose_db_version ENABLE ROW LEVEL SECURITY;

-- +goose Down
ALTER TABLE users            DISABLE ROW LEVEL SECURITY;
ALTER TABLE refresh_tokens   DISABLE ROW LEVEL SECURITY;
ALTER TABLE transactions     DISABLE ROW LEVEL SECURITY;
ALTER TABLE fixed_overrides  DISABLE ROW LEVEL SECURITY;
ALTER TABLE credit_purchases DISABLE ROW LEVEL SECURITY;
ALTER TABLE goals            DISABLE ROW LEVEL SECURITY;
ALTER TABLE extra_expenses   DISABLE ROW LEVEL SECURITY;
ALTER TABLE notes            DISABLE ROW LEVEL SECURITY;
ALTER TABLE custom_categories DISABLE ROW LEVEL SECURITY;
ALTER TABLE user_settings    DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS goose_db_version DISABLE ROW LEVEL SECURITY;
