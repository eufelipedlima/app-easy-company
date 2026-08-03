"use client";

import { useEffect, useState, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";

interface Area {
  id: string;
  nome: string;
  slug: string;
  ordem: number;
}

interface Perfil {
  id: string;
  nome: string;
  ordem: number;
}

type Nivel = "nenhum" | "visualizar" | "completo";

const NIVEL_LABEL: Record<Nivel, string> = {
  nenhum: "Nenhum",
  visualizar: "Só visualizar",
  completo: "Completo",
};

const NIVEL_COR: Record<Nivel, string> = {
  nenhum: "bg-black/5 text-ink/40",
  visualizar: "bg-amber-50 text-amber-700",
  completo: "bg-mint text-forest",
};

export default function PerfisAcessoPage() {
  const [areas, setAreas] = useState<Area[]>([]);
  const [perfis, setPerfis] = useState<Perfil[]>([]);
  const [perfilAberto, setPerfilAberto] = useState<string | null>(null);
  const [matriz, setMatriz] = useState<Record<string, Record<string, Nivel>>>({});
  const [loading, setLoading] = useState(true);
  const [novoNome, setNovoNome] = useState("");
  const [salvando, setSalvando] = useState(false);

  const carregar = useCallback(async () => {
    setLoading(true);
    const supabase = createClient();
    const [{ data: a }, { data: p }, { data: pa }] = await Promise.all([
      supabase.from("areas_sistema").select("id, nome, slug, ordem").order("ordem"),
      supabase.from("perfis_acesso").select("id, nome, ordem").order("ordem"),
      supabase.from("perfis_acesso_areas").select("perfil_id, area_id, nivel"),
    ]);
    setAreas(a ?? []);
    setPerfis(p ?? []);
    const m: Record<string, Record<string, Nivel>> = {};
    for (const linha of pa ?? []) {
      if (!m[linha.perfil_id]) m[linha.perfil_id] = {};
      m[linha.perfil_id][linha.area_id] = linha.nivel as Nivel;
    }
    setMatriz(m);
    setLoading(false);
  }, []);

  useEffect(() => {
    carregar();
  }, [carregar]);

  async function adicionarPerfil(e: React.FormEvent) {
    e.preventDefault();
    if (!novoNome.trim()) return;
    setSalvando(true);
    const supabase = createClient();
    const maxOrdem = Math.max(0, ...perfis.map((p) => p.ordem));
    const { data: novoPerfil, error } = await supabase
      .from("perfis_acesso")
      .insert({ nome: novoNome.trim(), ordem: maxOrdem + 1 })
      .select("id")
      .single();
    if (!error && novoPerfil) {
      await supabase
        .from("perfis_acesso_areas")
        .insert(areas.map((a) => ({ perfil_id: novoPerfil.id, area_id: a.id, nivel: "nenhum" })));
    }
    setNovoNome("");
    setSalvando(false);
    carregar();
  }

  async function removerPerfil(id: string) {
    if (!window.confirm("Remover este perfil? Funcionários vinculados a ele perdem o nível de acesso configurado.")) return;
    const supabase = createClient();
    await supabase.from("perfis_acesso").delete().eq("id", id);
    carregar();
  }

  async function mudarNivel(perfilId: string, areaId: string, nivel: Nivel) {
    setMatriz((atual) => ({ ...atual, [perfilId]: { ...atual[perfilId], [areaId]: nivel } }));
    const supabase = createClient();
    await supabase.from("perfis_acesso_areas").upsert({ perfil_id: perfilId, area_id: areaId, nivel });
  }

  return (
    <section>
      <p className="text-xs text-ink/50 bg-surface rounded-full px-4 py-2 inline-flex items-center gap-1.5 w-fit mb-6">
        💡 Marque o nível de acesso de cada perfil em cada área do sistema. Novas áreas aparecem
        aqui automaticamente conforme o sistema cresce.
      </p>

      <form onSubmit={adicionarPerfil} className="flex items-center gap-2 mb-6">
        <input
          value={novoNome}
          onChange={(e) => setNovoNome(e.target.value)}
          className="input flex-1 max-w-xs"
          placeholder="Nome do novo perfil..."
        />
        <button
          type="submit"
          disabled={salvando}
          className="shrink-0 rounded-full bg-ink text-white px-5 py-2 text-sm font-semibold hover:bg-forest transition-colors disabled:opacity-50"
        >
          + Adicionar perfil
        </button>
      </form>

      {loading ? (
        <p className="text-sm text-ink/50">Carregando...</p>
      ) : perfis.length === 0 ? (
        <p className="text-sm text-ink/50">Nenhum perfil cadastrado ainda.</p>
      ) : (
        <div className="space-y-3">
          {perfis.map((perfil) => {
            const aberto = perfilAberto === perfil.id;
            const comAcesso = areas.filter((a) => (matriz[perfil.id]?.[a.id] ?? "nenhum") !== "nenhum").length;
            return (
              <div key={perfil.id} className="rounded-3xl bg-card border border-black/5 overflow-hidden">
                <button
                  onClick={() => setPerfilAberto(aberto ? null : perfil.id)}
                  className="w-full flex items-center justify-between px-5 py-4 bg-surface text-left"
                >
                  <div className="flex items-center gap-3">
                    <span className={`text-ink/40 transition-transform ${aberto ? "rotate-90" : ""}`}>▶</span>
                    <p className="font-bold text-ink">{perfil.nome}</p>
                  </div>
                  <span className="text-xs text-ink/50">
                    {comAcesso === 0 ? "Sem acesso a nada" : `Acesso em ${comAcesso} de ${areas.length} áreas`}
                  </span>
                </button>

                {aberto && (
                  <div>
                    <div className="divide-y divide-black/5">
                      {areas.map((area) => {
                        const nivelAtual = matriz[perfil.id]?.[area.id] ?? "nenhum";
                        return (
                          <div key={area.id} className="flex items-center justify-between px-5 py-3">
                            <span className="text-sm font-medium text-ink">{area.nome}</span>
                            <div className="flex items-center gap-1 rounded-full bg-surface p-1">
                              {(["nenhum", "visualizar", "completo"] as Nivel[]).map((nivel) => (
                                <button
                                  key={nivel}
                                  onClick={() => mudarNivel(perfil.id, area.id, nivel)}
                                  className={`rounded-full px-3 py-1.5 text-xs font-semibold transition-colors ${
                                    nivelAtual === nivel ? NIVEL_COR[nivel] : "text-ink/40 hover:text-ink"
                                  }`}
                                >
                                  {NIVEL_LABEL[nivel]}
                                </button>
                              ))}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                    <div className="px-5 py-3 border-t border-black/5">
                      <button
                        onClick={() => removerPerfil(perfil.id)}
                        className="text-xs font-semibold text-ink/40 hover:text-red-600"
                      >
                        Remover perfil
                      </button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}
