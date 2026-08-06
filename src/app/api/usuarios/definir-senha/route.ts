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

  const { authUserId, novaSenha } = (await request.json()) as { authUserId?: string; novaSenha?: string };
  if (!authUserId || !novaSenha || novaSenha.length < 6) {
    return NextResponse.json({ error: "Informe o usuário e uma senha com pelo menos 6 caracteres." }, { status: 400 });
  }

  const admin = createAdminClient();
  const { error } = await admin.auth.admin.updateUserById(authUserId, { password: novaSenha });
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
