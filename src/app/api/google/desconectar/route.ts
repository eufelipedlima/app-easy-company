import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export async function POST() {
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
    .select("refresh_token")
    .eq("funcionario_id", funcionario.id)
    .maybeSingle();

  if (conexao?.refresh_token) {
    // Tenta revogar o acesso do lado do Google também — best-effort, não
    // trava a desconexão no nosso sistema se isso falhar.
    try {
      await fetch(`https://oauth2.googleapis.com/revoke?token=${conexao.refresh_token}`, { method: "POST" });
    } catch {
      // segue o fluxo mesmo se a revogação falhar
    }
  }

  await admin.from("funcionarios_google_calendar").delete().eq("funcionario_id", funcionario.id);

  return NextResponse.json({ ok: true });
}
