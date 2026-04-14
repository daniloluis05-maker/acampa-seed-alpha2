import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import * as bcrypt from "https://deno.land/x/bcrypt@v0.4.1/mod.ts";

// ── Constantes de rate limiting ───────────────────────────────────────────────
const MAX_TENTATIVAS = 5;
const JANELA_SEGUNDOS = 900; // 15 minutos
const TABELA_RATE = "login_rate_limit";

// ── CORS headers ──────────────────────────────────────────────────────────────
const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { status: 200, headers: CORS });
  }

  function responder(body: unknown, status = 200) {
    return new Response(JSON.stringify(body), {
      status,
      headers: { "Content-Type": "application/json", ...CORS },
    });
  }

  try {
    const { email, password } = await req.json();

    if (!email || !password) {
      return responder({ error: "Dados incompletos." }, 400);
    }

    const emailNorm = email.trim().toLowerCase();

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "https://oyvvlbyxlaetlghzgjam.supabase.co",
      Deno.env.get("SERVICE_ROLE_KEY") ?? Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    // ── Rate limiting ──────────────────────────────────────────────────────────
    const agora = Math.floor(Date.now() / 1000);

    const { data: rl } = await supabase
      .from(TABELA_RATE)
      .select("tentativas, bloqueado_ate")
      .eq("email", emailNorm)
      .maybeSingle();

    if (rl) {
      if (rl.bloqueado_ate && rl.bloqueado_ate > agora) {
        const restante = Math.ceil((rl.bloqueado_ate - agora) / 60);
        return responder(
          { error: `Muitas tentativas. Tente novamente em ${restante} minuto(s).` },
          429
        );
      }
      // Janela expirada: resetar
      if (rl.bloqueado_ate && rl.bloqueado_ate <= agora) {
        await supabase
          .from(TABELA_RATE)
          .update({ tentativas: 0, bloqueado_ate: null })
          .eq("email", emailNorm);
      }
    }

    // ── Busca usuário ──────────────────────────────────────────────────────────
    const { data: user } = await supabase
      .from("users")
      .select("*")
      .eq("email", emailNorm)
      .maybeSingle();

    const ERRO_AUTH = "E-mail ou senha inválidos.";

    if (!user) {
      await registrarFalha(supabase, emailNorm, agora, rl);
      return responder({ error: ERRO_AUTH }, 401);
    }

    // ── Verificação de senha ───────────────────────────────────────────────────
    // Hashes bcrypt começam com "$2a$" ou "$2b$".
    // Hashes legados (SHA-256) são migrados automaticamente no primeiro login.
    let senhaCorreta = false;
    let migrarHash = false;

    if (user.password?.startsWith("$2")) {
      senhaCorreta = await bcrypt.compare(password, user.password);
    } else {
      // Verificação legada SHA-256 para migração gradual
      const hashLegado = await sha256Legado(password);
      senhaCorreta = user.password === hashLegado;
      if (senhaCorreta) migrarHash = true;
    }

    if (!senhaCorreta) {
      await registrarFalha(supabase, emailNorm, agora, rl);
      return responder({ error: ERRO_AUTH }, 401);
    }

    // ── Sucesso: limpar rate limit + migrar hash se necessário ─────────────────
    await supabase
      .from(TABELA_RATE)
      .upsert({ email: emailNorm, tentativas: 0, bloqueado_ate: null });

    if (migrarHash) {
      const novoHash = await bcrypt.hash(password);
      await supabase.from("users").update({ password: novoHash }).eq("id", user.id);
    }

    const { password: _hash, ...usuarioSeguro } = user;
    return responder(usuarioSeguro);

  } catch (err) {
    console.error("[login-user] Erro interno:", err);
    return responder({ error: "Erro interno. Tente novamente." }, 500);
  }
});

// ── Helpers ───────────────────────────────────────────────────────────────────

async function registrarFalha(
  supabase: ReturnType<typeof createClient>,
  email: string,
  agora: number,
  rl: { tentativas: number; bloqueado_ate: number | null } | null
) {
  const novas = (rl?.tentativas ?? 0) + 1;
  await supabase.from(TABELA_RATE).upsert({
    email,
    tentativas: novas,
    bloqueado_ate: novas >= MAX_TENTATIVAS ? agora + JANELA_SEGUNDOS : null,
    atualizado_em: new Date().toISOString(),
  });
}

// Reproduz o hash legado apenas para compatibilidade de migração.
// Remover esta função após todos os registros terem sido migrados para bcrypt.
async function sha256Legado(senha: string): Promise<string> {
  const data = new TextEncoder().encode(senha + "missao-level-up-salt-2026");
  const buf = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, "0")).join("");
}

/*
─────────────────────────────────────────────────────────────────────────────
  MIGRAÇÃO NECESSÁRIA — executar no SQL Editor do Supabase antes do deploy
─────────────────────────────────────────────────────────────────────────────

  CREATE TABLE IF NOT EXISTS login_rate_limit (
    email         TEXT PRIMARY KEY,
    tentativas    INTEGER NOT NULL DEFAULT 0,
    bloqueado_ate BIGINT,
    atualizado_em TIMESTAMPTZ DEFAULT NOW()
  );

  CREATE INDEX IF NOT EXISTS idx_rl_bloqueado_ate ON login_rate_limit (bloqueado_ate);

  ALTER TABLE login_rate_limit ENABLE ROW LEVEL SECURITY;
  -- Nenhuma policy pública: acesso apenas via service_role (Edge Function)

  -- Limpeza periódica via pg_cron (opcional):
  -- SELECT cron.schedule('limpar-rate-limit', '0 * * * *',
  --   $$ DELETE FROM login_rate_limit WHERE bloqueado_ate < EXTRACT(EPOCH FROM NOW()) $$);

─────────────────────────────────────────────────────────────────────────────
*/
