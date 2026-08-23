import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { garantirAccessTokenValido } from "@/lib/google/token";

export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  }

  const { data: funcionario } = await supabase.from("funcionarios").select("id").eq("auth_user_id", user.id).maybeSingle();
  if (!funcionario) {
    return NextResponse.json({ error: "Funcionário não encontrado." }, { status: 404 });
  }

  const admin = createAdminClient();
  const { data: conexao } = await admin
    .from("funcionarios_google_calendar")
    .select("funcionario_id, refresh_token, access_token, access_token_expira_em")
    .eq("funcionario_id", funcionario.id)
    .maybeSingle();
  if (!conexao) {
    return NextResponse.json({ error: "Nenhuma conexão com Google encontrada." }, { status: 404 });
  }

  const accessToken = await garantirAccessTokenValido(admin, conexao);
  if (!accessToken) {
    return NextResponse.json({ error: "Não deu pra renovar o acesso ao Google." }, { status: 401 });
  }

  const resposta = await fetch("https://www.googleapis.com/calendar/v3/users/me/calendarList?minAccessRole=writer", {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  const data = await resposta.json();
  if (!resposta.ok) {
    return NextResponse.json({ error: "Não deu pra buscar suas agendas no Google." }, { status: 502 });
  }

  const calendarios = (data.items ?? [])
    .map((c: { id: string; summary: string; primary?: boolean }) => ({ id: c.id, nome: c.summary, principal: !!c.primary }))
    .sort((a: { principal: boolean }, b: { principal: boolean }) => (b.principal ? 1 : 0) - (a.principal ? 1 : 0));

  return NextResponse.json({ calendarios });
}
