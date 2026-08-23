import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { sincronizarFuncionario } from "@/lib/google/sync";

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

  const resultado = await sincronizarFuncionario(funcionario.id);
  if (!resultado.ok) {
    return NextResponse.json({ error: resultado.motivo ?? "Não deu pra sincronizar." }, { status: 400 });
  }
  return NextResponse.json(resultado);
}
