"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

interface Membro {
  id: string;
  nome: string;
  fotoUrl: string | null;
  cargoNome: string | null;
  abertas: number;
  concluidas: number;
  atrasadas: number;
  tempoTotalSegundos: number;
}

function formatarDuracao(totalSegundos: number) {
  const h = Math.floor(totalSegundos / 3600);
  const m = Math.floor((totalSegundos % 3600) / 60);
  if (h === 0 && m === 0) return "0min";
  if (h === 0) return `${m}min`;
  return `${h}h ${String(m).padStart(2, "0")}min`;
}

const CORES_AVATAR = [
  "bg-red-400", "bg-orange-400", "bg-amber-500", "bg-lime-500", "bg-emerald-500",
  "bg-teal-500", "bg-sky-500", "bg-indigo-500", "bg-violet-500", "bg-pink-500",
];
function corAvatar(nome: string) {
  let hash = 0;
  for (let i = 0; i < nome.length; i++) hash = (hash * 31 + nome.charCodeAt(i)) % CORES_AVATAR.length;
  return CORES_AVATAR[Math.abs(hash) % CORES_AVATAR.length];
}

export default function EquipePage() {
  const router = useRouter();
  const [membros, setMembros] = useState<Membro[]>([]);
  const [loading, setLoading] = useState(true);

  const carregar = useCallback(async () => {
    setLoading(true);
    const supabase = createClient();
    const hojeISO = new Date().toISOString().slice(0, 10);

    const [{ data: funcData }, { data: statusData }] = await Promise.all([
      supabase
        .from("funcionarios")
        .select("id, papeis ( pessoas ( nome, foto_url ) ), cargos ( nome )")
        .not("auth_user_id", "is", null),
      supabase.from("status_conteudo").select("id, cor"),
    ]);

    const idsConcluido = new Set((statusData ?? []).filter((s) => s.cor === "verde").map((s) => s.id));

    const listaFunc = ((funcData ?? []) as unknown as {
      id: string;
      papeis: { pessoas: { nome: string; foto_url: string | null } | null } | null;
      cargos: { nome: string } | null;
    }[]).map((f) => ({
      id: f.id,
      nome: f.papeis?.pessoas?.nome ?? "—",
      fotoUrl: f.papeis?.pessoas?.foto_url ?? null,
      cargoNome: f.cargos?.nome ?? null,
    }));

    const idsFunc = listaFunc.map((f) => f.id);

    const [{ data: respTarefas }, { data: respPosts }] = await Promise.all([
      idsFunc.length > 0
        ? supabase
            .from("tarefas_responsaveis")
            .select("funcionario_id, tarefas ( id, status_id, prazo, tempo_total_segundos, arquivada, excluido_em )")
            .in("funcionario_id", idsFunc)
        : Promise.resolve({ data: [] }),
      idsFunc.length > 0
        ? supabase
            .from("posts_conteudo_responsaveis")
            .select("funcionario_id, posts_conteudo ( id, status_id, data_publicacao, tempo_total_segundos, arquivado, excluido_em )")
            .in("funcionario_id", idsFunc)
        : Promise.resolve({ data: [] }),
    ]);

    type LinhaT = { funcionario_id: string; tarefas: { id: string; status_id: string; prazo: string | null; tempo_total_segundos: number; arquivada: boolean; excluido_em: string | null } | null };
    type LinhaP = { funcionario_id: string; posts_conteudo: { id: string; status_id: string; data_publicacao: string; tempo_total_segundos: number; arquivado: boolean; excluido_em: string | null } | null };

    const membrosComDados: Membro[] = listaFunc.map((f) => {
      const minhasTarefas = ((respTarefas ?? []) as unknown as LinhaT[])
        .filter((r) => r.funcionario_id === f.id && r.tarefas && !r.tarefas.arquivada && !r.tarefas.excluido_em)
        .map((r) => r.tarefas!);
      const meusPosts = ((respPosts ?? []) as unknown as LinhaP[])
        .filter((r) => r.funcionario_id === f.id && r.posts_conteudo && !r.posts_conteudo.arquivado && !r.posts_conteudo.excluido_em)
        .map((r) => r.posts_conteudo!);

      const concluidas = minhasTarefas.filter((t) => idsConcluido.has(t.status_id)).length + meusPosts.filter((p) => idsConcluido.has(p.status_id)).length;
      const abertas = minhasTarefas.length + meusPosts.length - concluidas;
      const atrasadas =
        minhasTarefas.filter((t) => !idsConcluido.has(t.status_id) && t.prazo && t.prazo < hojeISO).length +
        meusPosts.filter((p) => !idsConcluido.has(p.status_id) && p.data_publicacao < hojeISO).length;
      const tempoTotalSegundos =
        minhasTarefas.reduce((s, t) => s + (t.tempo_total_segundos ?? 0), 0) + meusPosts.reduce((s, p) => s + (p.tempo_total_segundos ?? 0), 0);

      return { ...f, abertas, concluidas, atrasadas, tempoTotalSegundos };
    });

    membrosComDados.sort((a, b) => a.nome.localeCompare(b.nome));
    setMembros(membrosComDados);
    setLoading(false);
  }, []);

  useEffect(() => {
    carregar();
  }, [carregar]);

  return (
    <main className="mx-auto max-w-6xl px-6 py-10">
      <div className="mb-8">
        <h1 className="text-2xl font-extrabold text-ink mb-1">Meu Time</h1>
        <p className="text-sm text-ink/60">Carga de trabalho, entregas e tempo dedicado por pessoa.</p>
      </div>

      {loading ? (
        <p className="text-sm text-ink/50">Carregando...</p>
      ) : membros.length === 0 ? (
        <p className="text-sm text-ink/50">Nenhum membro com acesso ao sistema ainda.</p>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {membros.map((m, i) => {
            const total = m.abertas + m.concluidas;
            const pctConcluido = total > 0 ? Math.round((m.concluidas / total) * 100) : 0;
            return (
              <button
                key={m.id}
                onClick={() => router.push(`/equipe/${m.id}`)}
                style={{ animationDelay: `${i * 60}ms` }}
                className="animate-[entrada_0.4s_ease-out_backwards] group text-left rounded-3xl bg-card border border-black/5 p-5 hover:shadow-lg hover:-translate-y-1 hover:border-forest/20 transition-all duration-200"
              >
                <div className="flex items-center gap-3 mb-4">
                  {m.fotoUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={m.fotoUrl} alt={m.nome} className="h-14 w-14 rounded-full object-cover shrink-0 ring-2 ring-transparent group-hover:ring-forest/30 transition-all" />
                  ) : (
                    <div className={`h-14 w-14 rounded-full ${corAvatar(m.nome)} text-white flex items-center justify-center font-bold text-lg shrink-0`}>
                      {m.nome.slice(0, 2).toUpperCase()}
                    </div>
                  )}
                  <div className="min-w-0">
                    <p className="text-sm font-extrabold text-ink truncate group-hover:text-forest transition-colors">{m.nome}</p>
                    {m.cargoNome && <p className="text-xs text-ink/40 truncate">{m.cargoNome}</p>}
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-2 mb-3">
                  <div className="rounded-xl bg-surface p-2.5 text-center">
                    <p className="text-lg font-extrabold text-ink">{m.abertas}</p>
                    <p className="text-[10px] font-semibold text-ink/50">abertas</p>
                  </div>
                  <div className="rounded-xl bg-emerald-50 p-2.5 text-center">
                    <p className="text-lg font-extrabold text-emerald-600">{m.concluidas}</p>
                    <p className="text-[10px] font-semibold text-emerald-600/70">concluídas</p>
                  </div>
                  <div className={`rounded-xl p-2.5 text-center ${m.atrasadas > 0 ? "bg-red-50" : "bg-surface"}`}>
                    <p className={`text-lg font-extrabold ${m.atrasadas > 0 ? "text-red-600" : "text-ink/30"}`}>{m.atrasadas}</p>
                    <p className={`text-[10px] font-semibold ${m.atrasadas > 0 ? "text-red-600/70" : "text-ink/30"}`}>atrasadas</p>
                  </div>
                </div>

                {total > 0 && (
                  <div className="mb-3">
                    <div className="h-1.5 rounded-full bg-black/5 overflow-hidden">
                      <div
                        className="h-full rounded-full bg-forest transition-all duration-700 ease-out"
                        style={{ width: `${pctConcluido}%` }}
                      />
                    </div>
                  </div>
                )}

                <div className="flex items-center justify-between text-xs text-ink/50 pt-2 border-t border-black/5">
                  <span className="flex items-center gap-1">⏱️ {formatarDuracao(m.tempoTotalSegundos)}</span>
                  <span className="font-semibold text-forest group-hover:underline">Ver detalhes →</span>
                </div>
              </button>
            );
          })}
        </div>
      )}

      <style jsx global>{`
        @keyframes entrada {
          from {
            opacity: 0;
            transform: translateY(10px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
      `}</style>
    </main>
  );
}
