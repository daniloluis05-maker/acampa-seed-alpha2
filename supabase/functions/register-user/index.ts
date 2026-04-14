import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import bcrypt from "npm:bcryptjs";

// ── CORS headers ──────────────────────────────────────────────────────────────
const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

Deno.serve(async (req) => {
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
    const { name, fullName, email, password } = await req.json();

    // ── Validações ─────────────────────────────────────────────────────────────
    if (!name || !email || !password) {
      return responder({ error: "Dados incompletos." }, 400);
    }
    if (password.length < 6) {
      return responder({ error: "Senha mínima: 6 caracteres." }, 400);
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return responder({ error: "Formato de e-mail inválido." }, 400);
    }

    const emailNorm = email.trim().toLowerCase();
    const nameNorm  = name.trim();

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    // ── Verificar duplicatas ───────────────────────────────────────────────────
    const { data: emailExistente } = await supabase
      .from("users")
      .select("id")
      .eq("email", emailNorm)
      .maybeSingle();

    if (emailExistente) {
      return responder({ error: "E-mail já cadastrado." }, 400);
    }

    const { data: nomeExistente } = await supabase
      .from("users")
      .select("id")
      .ilike("name", nameNorm)
      .maybeSingle();

    if (nomeExistente) {
      return responder({ error: "Este nome bíblico já está em uso. Escolha outro." }, 400);
    }

    // ── Hash bcrypt (custo 10) ─────────────────────────────────────────────────
    const passwordHash = await bcrypt.hash(password, 10);
    const id = crypto.randomUUID();

    const { error: insertError } = await supabase.from("users").insert({
      id,
      name:               nameNorm,
      full_name:          fullName?.trim() || "",
      email:              emailNorm,
      password:           passwordHash,
      role:               "user",
      points:             0,
      completed_missions: [],
      daily_points:       {},
      missed_days:        0,
      last_active_day:    "",
    });

    if (insertError) {
      console.error("[register-user] Erro ao inserir:", insertError);
      return responder({ error: "Erro ao criar conta. Tente novamente." }, 500);
    }

    return responder({
      id,
      name:              nameNorm,
      fullName:          fullName?.trim() || "",
      email:             emailNorm,
      role:              "user",
      points:            0,
      completedMissions: [],
      dailyPoints:       {},
      missedDays:        0,
      lastActiveDay:     "",
    });

  } catch (err) {
    console.error("[register-user] Erro interno:", err);
    return responder({ error: "Erro interno. Tente novamente." }, 500);
  }
});
