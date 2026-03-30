import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

async function hashSenha(senha: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(senha + "missao-level-up-salt-2026");
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, "0")).join("");
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { status: 200, headers: { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Methods": "POST, OPTIONS", "Access-Control-Allow-Headers": "*" } });
  }

  function responder(body: unknown, status = 200) {
    return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "*" } });
  }

  try {
    const { email, password } = await req.json();
    if (!email || !password) return responder({ error: "Dados incompletos." }, 400);

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    const { data: user } = await supabase.from("users").select("*").eq("email", email.trim().toLowerCase()).maybeSingle();
    if (!user) return responder({ error: "E-mail ou senha inválidos." }, 401);

    const hashDigitado = await hashSenha(password);
    const senhaCorreta = user.password === hashDigitado || user.password === password;

    if (!senhaCorreta) return responder({ error: "E-mail ou senha inválidos." }, 401);

    const { password: _hash, ...usuarioSeguro } = user;
    return responder(usuarioSeguro);

  } catch (err) {
    return responder({ error: "Erro interno: " + String(err) }, 500);
  }
});