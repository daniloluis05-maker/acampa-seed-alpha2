-- ──────────────────────────────────────────────────────────────────────────────
-- Migração 001: Tabela de rate limiting para tentativas de login
-- Executar no SQL Editor do Supabase (Dashboard > SQL Editor > New query)
-- ──────────────────────────────────────────────────────────────────────────────

-- 1. Criar tabela
CREATE TABLE IF NOT EXISTS login_rate_limit (
  email         TEXT        PRIMARY KEY,
  tentativas    INTEGER     NOT NULL DEFAULT 0,
  bloqueado_ate BIGINT,                          -- unix timestamp (segundos)
  atualizado_em TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2. Índice para limpeza periódica de registros expirados
CREATE INDEX IF NOT EXISTS idx_rl_bloqueado_ate
  ON login_rate_limit (bloqueado_ate)
  WHERE bloqueado_ate IS NOT NULL;

-- 3. Habilitar RLS (tabela só é acessada pela Edge Function via service_role)
ALTER TABLE login_rate_limit ENABLE ROW LEVEL SECURITY;
-- Nenhuma policy pública — service_role bypassa RLS por padrão.

-- 4. Limpeza automática via pg_cron (se a extensão estiver habilitada no projeto)
--    Supabase Pro: Dashboard > Database > Extensions > pg_cron
-- SELECT cron.schedule(
--   'limpar-rate-limit',
--   '0 * * * *',
--   $$ DELETE FROM login_rate_limit
--      WHERE bloqueado_ate IS NOT NULL
--        AND bloqueado_ate < EXTRACT(EPOCH FROM NOW()) $$
-- );
