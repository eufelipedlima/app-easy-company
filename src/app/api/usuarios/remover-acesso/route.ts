import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

export async function POST(request: NextRequest) {
  const supabaseSessao = await createClient();
  const {
    data: { user },
  } = await supabaseSessao.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  }

  const { funcionarioId, authUserId, excluirContaLogin } = (await request.json()) as {
    funcionarioId?: string;
    authUserId?: string;
    excluirContaLogin?: boolean;
  };
  if (!funcionarioId) {
    return NextResponse.json({ error: "Funcionário não informado." }, { status: 400 });
  }

  const admin = createAdminClient();

  const { error: updateError } = await admin
    .from("funcionarios")
    .update({ tem_acesso_sistema: false, auth_user_id: null, email_acesso: null, perfil_completo: true })
    .eq("id", funcionarioId);
  if (updateError) {
    return NextResponse.json({ error: updateError.message }, { status: 500 });
  }

  // Só apaga a conta de login de verdade (liberando o e-mail pra um novo convite) se pedido explicitamente.
  if (excluirContaLogin && authUserId) {
    await admin.auth.admin.deleteUser(authUserId);
  }

  return NextResponse.json({ ok: true });
}
