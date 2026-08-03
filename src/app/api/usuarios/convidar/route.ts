import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

export async function POST(request: NextRequest) {
  // Confirma que quem está chamando essa rota já está autenticado no sistema —
  // convidar gente nova é uma ação sensível, não pode ser pública.
  const supabaseSessao = await createClient();
  const {
    data: { user },
  } = await supabaseSessao.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  }

  const body = await request.json();
  const { email, funcionarioId, perfilAcessoId } = body as {
    email?: string;
    funcionarioId?: string;
    perfilAcessoId?: string;
  };

  if (!email || !funcionarioId) {
    return NextResponse.json({ error: "E-mail e funcionário são obrigatórios." }, { status: 400 });
  }

  const admin = createAdminClient();

  const { data: convite, error: conviteError } = await admin.auth.admin.inviteUserByEmail(email);
  if (conviteError) {
    return NextResponse.json({ error: conviteError.message }, { status: 500 });
  }

  const { error: updateError } = await admin
    .from("funcionarios")
    .update({
      tem_acesso_sistema: true,
      email_acesso: email,
      auth_user_id: convite.user.id,
      perfil_acesso_id: perfilAcessoId || null,
    })
    .eq("id", funcionarioId);

  if (updateError) {
    return NextResponse.json({ error: updateError.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
