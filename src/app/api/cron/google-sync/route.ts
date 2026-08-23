import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { sincronizarFuncionario } from "@/lib/google/sync";

// Roda periodicamente (configurado em vercel.json) pra manter as agendas
// de todo mundo atualizadas sozinhas, sem precisar que cada pessoa clique
// em "sincronizar agora". Protegido pelo CRON_SECRET que a Vercel injeta
// automaticamente nas chamadas agendadas — ninguém de fora consegue
// disparar isso.
export async function GET(request: NextRequest) {
  const segredoEsperado = process.env.CRON_SECRET;
  const autorizacao = request.headers.get("authorization");
  if (segredoEsperado && autorizacao !== `Bearer ${segredoEsperado}`) {
    return NextResponse.json({ error: "Não autorizado." }, { status: 401 });
  }

  const admin = createAdminClient();
  const { data: conexoes } = await admin
    .from("funcionarios_google_calendar")
    .select("funcionario_id")
    .not("google_calendar_id", "is", null)
    .eq("escolha_pendente", false);

  const resultados = [];
  for (const c of conexoes ?? []) {
    const resultado = await sincronizarFuncionario(c.funcionario_id);
    resultados.push({ funcionario_id: c.funcionario_id, ...resultado });
  }

  return NextResponse.json({ ok: true, total: resultados.length, resultados });
}
