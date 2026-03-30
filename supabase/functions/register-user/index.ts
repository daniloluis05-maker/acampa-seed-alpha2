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
    const { name, fullName, email, password } = await req.json();

    if (!name || !email || !password) return responder({ error: "Dados incompletos." }, 400);
    if (password.length < 6) return responder({ error: "Senha mínima: 6 caracteres." }, 400);

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    const { data: emailExistente } = await supabase.from("users").select("id").eq("email", email).maybeSingle();
    if (emailExistente) return responder({ error: "E-mail já cadastrado." }, 400);

    const { data: nomeExistente } = await supabase.from("users").select("id").ilike("name", name.trim()).maybeSingle();
    if (nomeExistente) return responder({ error: "Este nome bíblico já está em uso. Escolha outro." }, 400);

    const passwordHash = await hashSenha(password);
    const id = crypto.randomUUID();

    const { error: insertError } = await supabase.from("users").insert({
      id, name: name.trim(), full_name: fullName || "",
      email: email.trim().toLowerCase(), password: passwordHash,
      role: "user", points: 0, completed_missions: [],
      daily_points: {}, missed_days: 0, last_active_day: ""
    });

    if (insertError) return responder({ error: "Erro ao criar conta: " + insertError.message }, 500);

    return responder({ id, name: name.trim(), fullName: fullName || "", email: email.trim().toLowerCase(), role: "user", points: 0, completedMissions: [], dailyPoints: {}, missedDays: 0, lastActiveDay: "" });

  } catch (err) {
    return responder({ error: "Erro interno: " + String(err) }, 500);
  }
});