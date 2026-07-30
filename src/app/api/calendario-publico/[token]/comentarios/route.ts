import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

export async function POST(request: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const body = await request.json();
  const { postId, texto } = body as { postId?: string; texto?: string };

  if (!token || !postId || !texto?.trim()) {
    return NextResponse.json({ error: "Dados incompletos." }, { status: 400 });
  }

  const supabase = createAdminClient();

  // Confirma que o token é válido e que o post realmente pertence a esse cliente,
  // pra ninguém comentar em post de outro cliente só sabendo o id do post.
  const { data: cliente } = await supabase
    .from("clientes")
    .select("id")
    .eq("link_publico_token", token)
    .maybeSingle();

  if (!cliente) {
    return NextResponse.json({ error: "Link não encontrado." }, { status: 404 });
  }

  const { data: post } = await supabase
    .from("posts_conteudo")
    .select("id, cliente_id")
    .eq("id", postId)
    .maybeSingle();

  if (!post || post.cliente_id !== cliente.id) {
    return NextResponse.json({ error: "Post não encontrado." }, { status: 404 });
  }

  const { error: comentarioError } = await supabase.from("posts_conteudo_comentarios").insert({
    post_id: postId,
    autor: "cliente",
    texto: texto.trim(),
  });
  if (comentarioError) {
    return NextResponse.json({ error: comentarioError.message }, { status: 500 });
  }

  await supabase.from("posts_conteudo").update({ status: "em_alteracao" }).eq("id", postId);

  return NextResponse.json({ ok: true });
}
