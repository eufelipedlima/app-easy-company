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

  let authUserId: string;

  const { data: convite, error: conviteError } = await admin.auth.admin.inviteUserByEmail(email);
  if (conviteError) {
    const jaExiste = conviteError.message.toLowerCase().includes("already been registered") || conviteError.status === 422;
    if (!jaExiste) {
      return NextResponse.json({ error: conviteError.message }, { status: 500 });
    }
    // Já existe uma conta de login com esse e-mail (de um convite anterior, por exemplo).
    // Em vez de falhar, localiza essa conta e vincula ela a este funcionário.
    let usuarioExistente: { id: string } | null = null;
    let pagina = 1;
    while (!usuarioExistente) {
      const { data: listaUsuarios, error: erroLista } = await admin.auth.admin.listUsers({ page: pagina, perPage: 200 });
      if (erroLista || !listaUsuarios || listaUsuarios.users.length === 0) break;
      const achado = listaUsuarios.users.find((u) => u.email?.toLowerCase() === email.toLowerCase());
      if (achado) {
        usuarioExistente = { id: achado.id };
        break;
      }
      if (listaUsuarios.users.length < 200) break;
      pagina++;
    }
    if (!usuarioExistente) {
      return NextResponse.json(
        { error: "Esse e-mail já tem uma conta de login, mas não consegui localizá-la pra vincular. Verifica no painel do Supabase (Authentication → Users)." },
        { status: 500 }
      );
    }
    authUserId = usuarioExistente.id;
    // Reenvia um link de redefinição de senha, já que a pessoa pode não lembrar a senha dessa conta antiga.
    await admin.auth.resetPasswordForEmail(email);
  } else {
    authUserId = convite.user.id;
  }

  const { error: updateError } = await admin
    .from("funcionarios")
    .update({
      tem_acesso_sistema: true,
      email_acesso: email,
      auth_user_id: authUserId,
      perfil_acesso_id: perfilAcessoId || null,
    })
    .eq("id", funcionarioId);

  if (updateError) {
    return NextResponse.json({ error: updateError.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
