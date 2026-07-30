import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

export async function GET(request: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const { searchParams } = new URL(request.url);
  const mes = searchParams.get("mes");
  const ano = searchParams.get("ano");

  if (!token) {
    return NextResponse.json({ error: "Link inválido." }, { status: 400 });
  }

  const supabase = createAdminClient();

  const { data: cliente, error: clienteError } = await supabase
    .from("clientes")
    .select("id, papeis ( pessoas ( nome ) )")
    .eq("link_publico_token", token)
    .maybeSingle();

  if (clienteError || !cliente) {
    return NextResponse.json({ error: "Link não encontrado." }, { status: 404 });
  }

  const anoNum = ano ? Number(ano) : new Date().getFullYear();
  const mesNum = mes ? Number(mes) : new Date().getMonth();
  const inicio = new Date(anoNum, mesNum, 1).toISOString().slice(0, 10);
  const fim = new Date(anoNum, mesNum + 1, 0).toISOString().slice(0, 10);

  const { data: posts, error: postsError } = await supabase
    .from("posts_conteudo")
    .select(
      `id, data_publicacao, legenda, objetivo, status, arquivo_path, arquivo_nome, arquivo_tipo,
       redes_sociais ( nome ),
       posts_conteudo_comentarios ( id, autor, texto, created_at )`
    )
    .eq("cliente_id", cliente.id)
    .gte("data_publicacao", inicio)
    .lte("data_publicacao", fim)
    .order("data_publicacao");

  if (postsError) {
    return NextResponse.json({ error: postsError.message }, { status: 500 });
  }

  const postsComMidia = (posts ?? []).map((p) => ({
    ...p,
    midia_url: p.arquivo_path
      ? supabase.storage.from("conteudo-midia").getPublicUrl(p.arquivo_path).data.publicUrl
      : null,
  }));

  const nomeCliente =
    (cliente as unknown as { papeis: { pessoas: { nome: string } | null } | null }).papeis?.pessoas?.nome ?? "Cliente";

  return NextResponse.json({ nomeCliente, posts: postsComMidia });
}
