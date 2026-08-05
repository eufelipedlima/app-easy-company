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
    .select("id, papeis ( pessoas ( nome, foto_url ) )")
    .eq("link_publico_token", token)
    .maybeSingle();

  if (clienteError || !cliente) {
    return NextResponse.json({ error: "Link não encontrado." }, { status: 404 });
  }

  const anoNum = ano ? Number(ano) : new Date().getFullYear();
  const mesNum = mes ? Number(mes) : new Date().getMonth();
  const inicio = new Date(anoNum, mesNum, 1).toISOString().slice(0, 10);
  const fim = new Date(anoNum, mesNum + 1, 0).toISOString().slice(0, 10);

  const { data: statusVisiveis } = await supabase.from("status_conteudo").select("id").eq("visivel_cliente", true);
  const idsStatusVisiveis = (statusVisiveis ?? []).map((s) => s.id);

  const { data: posts, error: postsError } = await supabase
    .from("posts_conteudo")
    .select(
      `id, titulo, data_publicacao, hora_publicacao, legenda, objetivo, formato, link_video, updated_at,
       status_conteudo ( nome, cor ),
       posts_conteudo_midias ( id, arquivo_path, arquivo_nome, arquivo_tipo, ordem ),
       posts_conteudo_comentarios ( id, autor, texto, created_at )`
    )
    .eq("cliente_id", cliente.id)
    .in("status_id", idsStatusVisiveis.length > 0 ? idsStatusVisiveis : ["00000000-0000-0000-0000-000000000000"])
    .gte("data_publicacao", inicio)
    .lte("data_publicacao", fim)
    .order("data_publicacao");

  if (postsError) {
    return NextResponse.json({ error: postsError.message }, { status: 500 });
  }

  const postsComMidia = (posts ?? []).map((p) => ({
    ...p,
    posts_conteudo_midias: [...(p.posts_conteudo_midias ?? [])]
      .sort((a, b) => a.ordem - b.ordem)
      .map((m) => ({
        ...m,
        url: supabase.storage.from("conteudo-midia").getPublicUrl(m.arquivo_path).data.publicUrl,
      })),
  }));

  const clienteInfo = cliente as unknown as { papeis: { pessoas: { nome: string; foto_url: string | null } | null } | null };
  const nomeCliente = clienteInfo.papeis?.pessoas?.nome ?? "Cliente";
  const fotoCliente = clienteInfo.papeis?.pessoas?.foto_url ?? null;

  return NextResponse.json({ nomeCliente, fotoCliente, posts: postsComMidia });
}
