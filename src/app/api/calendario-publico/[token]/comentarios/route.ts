import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

export async function POST(request: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const body = await request.json();
  const { postId, texto, acao } = body as {
    postId?: string;
    texto?: string;
    acao?: "aprovar" | "solicitar_alteracao";
  };

  if (!token || !postId || !acao) {
    return NextResponse.json({ error: "Dados incompletos." }, { status: 400 });
  }
  if (acao === "solicitar_alteracao" && !texto?.trim()) {
    return NextResponse.json({ error: "Descreva o que precisa ser ajustado." }, { status: 400 });
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
    .select("id, cliente_id, titulo, responsavel_id")
    .eq("id", postId)
    .maybeSingle();

  if (!post || post.cliente_id !== cliente.id) {
    return NextResponse.json({ error: "Post não encontrado." }, { status: 404 });
  }

  if (texto?.trim()) {
    const { error: comentarioError } = await supabase.from("posts_conteudo_comentarios").insert({
      post_id: postId,
      autor: "cliente",
      texto: texto.trim(),
    });
    if (comentarioError) {
      return NextResponse.json({ error: comentarioError.message }, { status: 500 });
    }
  }

  // Move o post pro status equivalente ("Agendamento" ao aprovar, "Em alteração"
  // ao pedir ajuste), se existir um cadastrado com nome parecido
  const termoBusca = acao === "aprovar" ? "%agend%" : "%altera%";
  const { data: statusAlvo } = await supabase
    .from("status_conteudo")
    .select("id")
    .ilike("nome", termoBusca)
    .order("ordem")
    .limit(1)
    .maybeSingle();
  if (statusAlvo) {
    await supabase.from("posts_conteudo").update({ status_id: statusAlvo.id }).eq("id", postId);
  }

  if (post.responsavel_id) {
    const { data: responsavel } = await supabase
      .from("funcionarios")
      .select("auth_user_id")
      .eq("id", post.responsavel_id)
      .maybeSingle();
    if (responsavel?.auth_user_id) {
      await supabase.from("notificacoes").insert({
        destinatario_id: responsavel.auth_user_id,
        tipo: "comentario_cliente",
        titulo: acao === "aprovar" ? "Cliente aprovou um conteúdo" : "Cliente pediu ajuste",
        descricao: post.titulo || (texto?.trim() ? texto.trim().slice(0, 120) : null),
        link: "/conteudo/calendario",
      });
    }
  }

  return NextResponse.json({ ok: true });
}
