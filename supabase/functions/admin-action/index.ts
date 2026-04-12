import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { status: 200, headers: CORS });

  function responder(body: unknown, status = 200) {
    return new Response(JSON.stringify(body), {
      status, headers: { "Content-Type": "application/json", ...CORS },
    });
  }

  try {
    const { action, adminId, payload } = await req.json();
    if (!action || !adminId) return responder({ error: "Dados incompletos." }, 400);

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    // ── Verificação server-side de role admin ─────────────────────────────────
    const { data: admin } = await supabase
      .from("users").select("role").eq("id", adminId).maybeSingle();

    if (!admin || admin.role !== "admin") {
      return responder({ error: "Acesso negado. Ação restrita a administradores." }, 403);
    }

    // ── Roteamento de ações ───────────────────────────────────────────────────
    switch (action) {

      case "approve_submission": {
        const { submissionId, userId, missionId, points, approvedDate, approvedWeek, approvedMonth, approvedBiweekly } = payload;
        await supabase.rpc("increment_points", { player_id: userId, row_points: points });
        await supabase.from("submissions").update({
          status: "approved", approved_date: approvedDate,
          approved_week: approvedWeek, approved_month: approvedMonth,
          approved_biweekly: approvedBiweekly
        }).eq("id", submissionId);
        await supabase.from("historico_pontos").insert({
          user_id: userId, tipo: "aprovacao", pontos: points,
          descricao: `Missão aprovada: ${missionId}`,
          pontos_antes: 0, pontos_depois: points, data: new Date().toISOString()
        });
        return responder({ ok: true });
      }

      case "reject_submission": {
        const { submissionId, userId, points, isRevoke } = payload;
        if (isRevoke) {
          await supabase.rpc("increment_points", { player_id: userId, row_points: -Math.abs(points) });
          await supabase.from("historico_pontos").insert({
            user_id: userId, tipo: "estorno", pontos: -Math.abs(points),
            descricao: "Estorno pelo admin", pontos_antes: 0, pontos_depois: 0,
            data: new Date().toISOString()
          });
        }
        await supabase.from("submissions").update({
          status: "rejected", approved_date: null, approved_week: null,
          approved_month: null, approved_biweekly: null
        }).eq("id", submissionId);
        return responder({ ok: true });
      }

      case "correct_points": {
        const { userId, delta, motivo } = payload;
        await supabase.rpc("increment_points", { player_id: userId, row_points: delta });
        await supabase.from("historico_pontos").insert({
          user_id: userId, tipo: "correcao", pontos: delta,
          descricao: motivo || "Correção manual pelo admin",
          pontos_antes: 0, pontos_depois: delta, data: new Date().toISOString()
        });
        return responder({ ok: true });
      }

      case "reset_missed_days": {
        const { userIds } = payload;
        await Promise.all(
          userIds.map((id: string) =>
            supabase.from("users").update({ missed_days: 0 }).eq("id", id)
          )
        );
        return responder({ ok: true, total: userIds.length });
      }

      case "assign_team": {
        const { userId, equipeId } = payload;
        await supabase.from("users").update({ equipe_id: equipeId }).eq("id", userId);
        return responder({ ok: true });
      }

      case "credit_team": {
        const { userIds, points, motivo } = payload;
        await Promise.all(
          userIds.map((id: string) =>
            supabase.rpc("increment_points", { player_id: id, row_points: points })
          )
        );
        return responder({ ok: true, creditados: userIds.length });
      }

      default:
        return responder({ error: `Ação desconhecida: ${action}` }, 400);
    }

  } catch (err) {
    console.error("[admin-action] Erro:", err);
    return responder({ error: "Erro interno." }, 500);
  }
});
