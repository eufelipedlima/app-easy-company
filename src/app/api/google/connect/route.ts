import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { ESCOPOS_GOOGLE_CALENDAR, redirectUriGoogle } from "@/lib/google/config";

export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  const { data: funcionario } = await supabase.from("funcionarios").select("id").eq("auth_user_id", user.id).maybeSingle();

  if (!funcionario) {
    return NextResponse.redirect(new URL("/perfil?google=sem_funcionario", request.url));
  }

  const clientId = process.env.GOOGLE_CLIENT_ID;
  if (!clientId) {
    return NextResponse.redirect(new URL("/perfil?google=nao_configurado", request.url));
  }

  // O "state" carrega o id do funcionário, mas quem manda de verdade é a
  // sessão logada de novo lá no callback — o state sozinho não é
  // suficiente pra escrever nada, é só pra saber pra quem a conexão é.
  const state = funcionario.id;

  const url = new URL("https://accounts.google.com/o/oauth2/v2/auth");
  url.searchParams.set("client_id", clientId);
  url.searchParams.set("redirect_uri", redirectUriGoogle(request.nextUrl.origin));
  url.searchParams.set("response_type", "code");
  url.searchParams.set("scope", ESCOPOS_GOOGLE_CALENDAR);
  url.searchParams.set("access_type", "offline");
  url.searchParams.set("prompt", "consent");
  url.searchParams.set("state", state);

  return NextResponse.redirect(url.toString());
}
