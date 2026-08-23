import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { garantirAccessTokenValido } from "@/lib/google/token";

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  }

  const { data: funcionario } = await supabase
    .from("funcionarios")
    .select("id, papeis ( pessoas ( nome ) )")
    .eq("auth_user_id", user.id)
    .maybeSingle();
  const nomePessoa = (funcionario as unknown as { papeis: { pessoas: { nome: string } | null } | null } | null)?.papeis?.pessoas?.nome;
  if (!funcionario) {
    return NextResponse.json({ error: "Funcionário não encontrado." }, { status: 404 });
  }

  const body = await request.json();
  const modo: "nova" | "existente" = body.modo;
  const nomeAgendaNova: string | undefined = body.nomeAgendaNova;
  const calendarIdEscolhido: string | undefined = body.calendarId;

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

  let calendarId: string;

  if (modo === "existente") {
    if (!calendarIdEscolhido) {
      return NextResponse.json({ error: "Escolha uma agenda." }, { status: 400 });
    }
    calendarId = calendarIdEscolhido;
  } else {
    const respostaCalendario = await fetch("https://www.googleapis.com/calendar/v3/calendars", {
      method: "POST",
      headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        summary: (nomeAgendaNova || `Pauta — ${nomePessoa ?? "Easy Company"}`).slice(0, 100),
        description: "Criado automaticamente pelo sistema da Easy Company — mostra suas tarefas e conteúdos com prazo.",
        timeZone: "America/Sao_Paulo",
      }),
    });
    const calendarioData = await respostaCalendario.json();
    if (!respostaCalendario.ok) {
      return NextResponse.json({ error: "Não deu pra criar a agenda no Google." }, { status: 502 });
    }
    calendarId = calendarioData.id;
  }

  await admin
    .from("funcionarios_google_calendar")
    .update({ google_calendar_id: calendarId, escolha_pendente: false })
    .eq("funcionario_id", funcionario.id);

  return NextResponse.json({ ok: true });
}
