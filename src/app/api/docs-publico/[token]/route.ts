import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

export async function GET(request: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;

  if (!token) {
    return NextResponse.json({ error: "Link inválido." }, { status: 400 });
  }

  const supabase = createAdminClient();

  const { data: doc, error } = await supabase
    .from("docs")
    .select("id, titulo, descricao, conteudo, emoji, updated_at, excluido_em")
    .eq("link_publico_token", token)
    .maybeSingle();

  if (error || !doc || doc.excluido_em) {
    return NextResponse.json({ error: "Link não encontrado." }, { status: 404 });
  }

  return NextResponse.json({ doc });
}
