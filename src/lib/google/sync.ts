import { createAdminClient } from "@/lib/supabase/admin";
import { garantirAccessTokenValido } from "@/lib/google/token";

interface ItemParaSincronizar {
  id: string;
  titulo: string;
  clienteNome: string | null;
  dataInicio: string | null;
  dataFim: string; // sempre presente — é a "âncora" do evento
  link: string;
}

function montarEvento(item: ItemParaSincronizar) {
  // Google Calendar trata eventos de dia inteiro com "end" EXCLUSIVO —
  // ou seja, um evento de um dia só (ex: 10/08) precisa de
  // start=2026-08-10 e end=2026-08-11 (o dia seguinte).
  const inicio = item.dataInicio && item.dataInicio < item.dataFim ? item.dataInicio : item.dataFim;
  const fimExclusivo = new Date(item.dataFim + "T00:00:00");
  fimExclusivo.setDate(fimExclusivo.getDate() + 1);
  const fim = fimExclusivo.toISOString().slice(0, 10);

  return {
    summary: item.clienteNome ? `${item.titulo} · ${item.clienteNome}` : item.titulo,
    description: `Sincronizado automaticamente do sistema Easy Company.\n${item.link}`,
    start: { date: inicio },
    end: { date: fim },
  };
}

async function chamarGoogle(accessToken: string, url: string, options: RequestInit = {}) {
  const resposta = await fetch(url, {
    ...options,
    headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json", ...options.headers },
  });
  return resposta;
}

/** Sincroniza tarefas e conteúdos de UM funcionário com o Google Calendar
 * dele. Só considera itens com data definida (prazo / data de
 * publicação), não excluídos, não arquivados, em que a pessoa é
 * responsável. Cria eventos novos, atualiza os que já existem, e remove
 * os que não fazem mais sentido (item excluído, ou a pessoa deixou de
 * ser responsável). */
export async function sincronizarFuncionario(
  funcionarioId: string
): Promise<{ ok: boolean; motivo?: string; criados?: number; atualizados?: number; removidos?: number }> {
  const admin = createAdminClient();

  const { data: conexao } = await admin
    .from("funcionarios_google_calendar")
    .select("funcionario_id, refresh_token, access_token, access_token_expira_em, google_calendar_id, escolha_pendente")
    .eq("funcionario_id", funcionarioId)
    .maybeSingle();

  if (!conexao || !conexao.google_calendar_id || conexao.escolha_pendente) {
    return { ok: false, motivo: "sem_conexao_ativa" };
  }

  const accessToken = await garantirAccessTokenValido(admin, conexao);
  if (!accessToken) {
    return { ok: false, motivo: "token_invalido" };
  }
  const calendarId = conexao.google_calendar_id;

  const [{ data: respTarefas }, { data: respPosts }, { data: mapTarefas }, { data: mapPosts }] = await Promise.all([
    admin
      .from("tarefas_responsaveis")
      .select("tarefas ( id, titulo, data_inicio, prazo, arquivada, excluido_em, clientes ( papeis ( pessoas ( nome ) ) ) )")
      .eq("funcionario_id", funcionarioId),
    admin
      .from("posts_conteudo_responsaveis")
      .select(
        "posts_conteudo ( id, titulo, data_inicio, data_publicacao, arquivado, excluido_em, clientes ( papeis ( pessoas ( nome ) ) ) )"
      )
      .eq("funcionario_id", funcionarioId),
    admin.from("tarefas_google_eventos").select("tarefa_id, google_event_id").eq("funcionario_id", funcionarioId),
    admin.from("posts_conteudo_google_eventos").select("post_id, google_event_id").eq("funcionario_id", funcionarioId),
  ]);

  type LinhaT = {
    tarefas: {
      id: string;
      titulo: string;
      data_inicio: string | null;
      prazo: string | null;
      arquivada: boolean;
      excluido_em: string | null;
      clientes: { papeis: { pessoas: { nome: string } | null } | null } | null;
    } | null;
  };
  type LinhaP = {
    posts_conteudo: {
      id: string;
      titulo: string | null;
      data_inicio: string | null;
      data_publicacao: string | null;
      arquivado: boolean;
      excluido_em: string | null;
      clientes: { papeis: { pessoas: { nome: string } | null } | null } | null;
    } | null;
  };

  const tarefasValidas: ItemParaSincronizar[] = ((respTarefas ?? []) as unknown as LinhaT[])
    .map((r) => r.tarefas)
    .filter((t): t is NonNullable<typeof t> => !!t && !t.arquivada && !t.excluido_em && !!t.prazo)
    .map((t) => ({
      id: t.id,
      titulo: t.titulo,
      clienteNome: t.clientes?.papeis?.pessoas?.nome ?? null,
      dataInicio: t.data_inicio,
      dataFim: t.prazo!,
      link: `${process.env.NEXT_PUBLIC_APP_URL ?? ""}/tarefas/${t.id}`,
    }));

  const postsValidos: ItemParaSincronizar[] = ((respPosts ?? []) as unknown as LinhaP[])
    .map((r) => r.posts_conteudo)
    .filter((p): p is NonNullable<typeof p> => !!p && !p.arquivado && !p.excluido_em && !!p.data_publicacao)
    .map((p) => ({
      id: p.id,
      titulo: p.titulo || "Conteúdo sem título",
      clienteNome: p.clientes?.papeis?.pessoas?.nome ?? null,
      dataInicio: p.data_inicio,
      dataFim: p.data_publicacao!,
      link: `${process.env.NEXT_PUBLIC_APP_URL ?? ""}/conteudo/calendario/post/${p.id}`,
    }));

  const mapaTarefaEvento = new Map((mapTarefas ?? []).map((m) => [m.tarefa_id, m.google_event_id]));
  const mapaPostEvento = new Map((mapPosts ?? []).map((m) => [m.post_id, m.google_event_id]));

  let criados = 0;
  let atualizados = 0;
  let removidos = 0;

  async function processar(itens: ItemParaSincronizar[], mapa: Map<string, string>, tabelaMapa: string, colunaId: string) {
    for (const item of itens) {
      const eventoExistente = mapa.get(item.id);
      const corpo = montarEvento(item);
      if (eventoExistente) {
        const resp = await chamarGoogle(
          accessToken!,
          `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events/${eventoExistente}`,
          { method: "PATCH", body: JSON.stringify(corpo) }
        );
        if (resp.ok) {
          atualizados++;
          await admin
            .from(tabelaMapa)
            .update({ atualizado_em: new Date().toISOString() })
            .eq(colunaId, item.id)
            .eq("funcionario_id", funcionarioId);
        } else if (resp.status === 404 || resp.status === 410) {
          const respNovo = await chamarGoogle(
            accessToken!,
            `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events`,
            { method: "POST", body: JSON.stringify(corpo) }
          );
          if (respNovo.ok) {
            const novoEvento = await respNovo.json();
            await admin
              .from(tabelaMapa)
              .update({ google_event_id: novoEvento.id, atualizado_em: new Date().toISOString() })
              .eq(colunaId, item.id)
              .eq("funcionario_id", funcionarioId);
            criados++;
          }
        }
      } else {
        const resp = await chamarGoogle(
          accessToken!,
          `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events`,
          { method: "POST", body: JSON.stringify(corpo) }
        );
        if (resp.ok) {
          const novoEvento = await resp.json();
          await admin.from(tabelaMapa).insert({
            [colunaId]: item.id,
            funcionario_id: funcionarioId,
            google_event_id: novoEvento.id,
          });
          criados++;
        }
      }
    }
  }

  await processar(tarefasValidas, mapaTarefaEvento, "tarefas_google_eventos", "tarefa_id");
  await processar(postsValidos, mapaPostEvento, "posts_conteudo_google_eventos", "post_id");

  async function limpar(mapa: Map<string, string>, validos: Set<string>, tabelaMapa: string, colunaId: string) {
    for (const [itemId, eventoId] of mapa) {
      if (validos.has(itemId)) continue;
      await chamarGoogle(
        accessToken!,
        `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events/${eventoId}`,
        { method: "DELETE" }
      );
      await admin.from(tabelaMapa).delete().eq(colunaId, itemId).eq("funcionario_id", funcionarioId);
      removidos++;
    }
  }

  await limpar(mapaTarefaEvento, new Set(tarefasValidas.map((t) => t.id)), "tarefas_google_eventos", "tarefa_id");
  await limpar(mapaPostEvento, new Set(postsValidos.map((p) => p.id)), "posts_conteudo_google_eventos", "post_id");

  await admin
    .from("funcionarios_google_calendar")
    .update({ ultima_sincronizacao: new Date().toISOString() })
    .eq("funcionario_id", funcionarioId);

  return { ok: true, criados, atualizados, removidos };
}
