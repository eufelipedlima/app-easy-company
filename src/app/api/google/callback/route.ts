import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { redirectUriGoogle } from "@/lib/google/config";

export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get("code");
  const state = request.nextUrl.searchParams.get("state");
  const erroGoogle = request.nextUrl.searchParams.get("error");

  if (erroGoogle) {
    // A pessoa cancelou a autorização na tela do Google — não é um erro
    // nosso, só volta pro perfil sem conectar nada.
    return NextResponse.redirect(new URL("/perfil?google=cancelado", request.url));
  }
  if (!code || !state) {
    return NextResponse.redirect(new URL("/perfil?google=erro", request.url));
  }

  // Confere de novo quem está logado agora, e se bate com o funcionário
  // que o "state" diz que iniciou a conexão — o state sozinho não é
  // suficiente pra escrever nada no banco.
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.redirect(new URL("/login", request.url));
  }
  const { data: funcionario } = await supabase
    .from("funcionarios")
    .select("id, papeis ( pessoas ( nome ) )")
    .eq("auth_user_id", user.id)
    .maybeSingle();
  const nomePessoa = (funcionario as unknown as { papeis: { pessoas: { nome: string } | null } | null } | null)?.papeis?.pessoas?.nome;
  if (!funcionario || funcionario.id !== state) {
    return NextResponse.redirect(new URL("/perfil?google=erro", request.url));
  }

  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    return NextResponse.redirect(new URL("/perfil?google=nao_configurado", request.url));
  }

  try {
    // Troca o código pelo par de tokens.
    const respostaToken = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        code,
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uri: redirectUriGoogle(request.nextUrl.origin),
        grant_type: "authorization_code",
      }),
    });
    const tokenData = await respostaToken.json();
    if (!respostaToken.ok || !tokenData.refresh_token) {
      // Sem refresh_token normalmente quer dizer que a pessoa já tinha
      // autorizado antes e o Google não reenviou — com prompt=consent
      // isso não deveria acontecer, mas por garantia avisamos claramente.
      return NextResponse.redirect(new URL("/perfil?google=sem_refresh_token", request.url));
    }

    const accessToken = tokenData.access_token as string;
    const expiraEm = new Date(Date.now() + (tokenData.expires_in ?? 3600) * 1000).toISOString();

    // Descobre o e-mail da conta Google conectada, só pra mostrar na tela.
    const respostaEmail = await fetch("https://www.googleapis.com/oauth2/v2/userinfo", {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    const emailData = await respostaEmail.json();
    const googleEmail: string | null = emailData?.email ?? null;

    // Cria (ou reaproveita) o calendário dedicado dessa pessoa.
    const admin = createAdminClient();
    const { data: conexaoExistente } = await admin
      .from("funcionarios_google_calendar")
      .select("google_calendar_id")
      .eq("funcionario_id", funcionario.id)
      .maybeSingle();

    let calendarId = conexaoExistente?.google_calendar_id ?? null;
    if (!calendarId) {
      const respostaCalendario = await fetch("https://www.googleapis.com/calendar/v3/calendars", {
        method: "POST",
        headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          summary: `Pauta — ${nomePessoa ?? "Easy Company"}`,
          description: "Criado automaticamente pelo sistema da Easy Company — mostra suas tarefas e conteúdos com prazo.",
          timeZone: "America/Sao_Paulo",
        }),
      });
      const calendarioData = await respostaCalendario.json();
      if (!respostaCalendario.ok) {
        return NextResponse.redirect(new URL("/perfil?google=erro_calendario", request.url));
      }
      calendarId = calendarioData.id;
    }

    await admin.from("funcionarios_google_calendar").upsert(
      {
        funcionario_id: funcionario.id,
        google_email: googleEmail,
        refresh_token: tokenData.refresh_token,
        access_token: accessToken,
        access_token_expira_em: expiraEm,
        google_calendar_id: calendarId,
        conectado_em: new Date().toISOString(),
      },
      { onConflict: "funcionario_id" }
    );

    return NextResponse.redirect(new URL("/perfil?google=conectado", request.url));
  } catch {
    return NextResponse.redirect(new URL("/perfil?google=erro", request.url));
  }
}
