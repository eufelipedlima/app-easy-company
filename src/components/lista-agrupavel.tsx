"use client";

import { useEffect, useState } from "react";
import { Settings2 } from "lucide-react";

export interface ColunaLista<T> {
  chave: string;
  label: string;
  larguraCss: string;
  render: (item: T) => React.ReactNode;
  ehNome?: boolean;
}

export interface OpcaoAgrupamento<T> {
  chave: string;
  label: string;
  grupoDe: (item: T) => { chave: string; label: string; cor?: string };
  ordemGrupos?: (a: string, b: string) => number;
}

/** Lista com agrupamento e colunas configuráveis, no estilo ClickUp — usada
 * nas abas de Tarefas e Conteúdo. As preferências (colunas visíveis,
 * agrupamento escolhido) ficam salvas no navegador da pessoa. */
export function ListaAgrupavel<T>({
  itens,
  chaveId,
  colunas,
  opcoesAgrupamento,
  chaveArmazenamento,
  onAbrir,
}: {
  itens: T[];
  chaveId: (item: T) => string;
  colunas: ColunaLista<T>[];
  opcoesAgrupamento: OpcaoAgrupamento<T>[];
  /** Prefixo único pra salvar as preferências dessa lista específica (ex: "tarefas-cliente"). */
  chaveArmazenamento: string;
  onAbrir: (item: T) => void;
}) {
  const chaveColunas = `lista-colunas:${chaveArmazenamento}`;
  const chaveAgrupamento = `lista-agrupar:${chaveArmazenamento}`;

  const [colunasVisiveis, setColunasVisiveis] = useState<Set<string>>(new Set(colunas.map((c) => c.chave)));
  const [agruparPor, setAgruparPor] = useState<string>("nenhum");
  const [configAberta, setConfigAberta] = useState(false);
  const [carregouPreferencias, setCarregouPreferencias] = useState(false);

  useEffect(() => {
    try {
      const salvasColunas = localStorage.getItem(chaveColunas);
      if (salvasColunas) setColunasVisiveis(new Set(JSON.parse(salvasColunas)));
      const salvoAgrupamento = localStorage.getItem(chaveAgrupamento);
      if (salvoAgrupamento) setAgruparPor(salvoAgrupamento);
    } catch {
      // preferências corrompidas ou indisponíveis — segue com o padrão
    }
    setCarregouPreferencias(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!carregouPreferencias) return;
    localStorage.setItem(chaveColunas, JSON.stringify(Array.from(colunasVisiveis)));
  }, [colunasVisiveis, carregouPreferencias, chaveColunas]);

  useEffect(() => {
    if (!carregouPreferencias) return;
    localStorage.setItem(chaveAgrupamento, agruparPor);
  }, [agruparPor, carregouPreferencias, chaveAgrupamento]);

  function alternarColuna(chave: string) {
    setColunasVisiveis((atual) => {
      const nova = new Set(atual);
      if (nova.has(chave)) nova.delete(chave);
      else nova.add(chave);
      return nova;
    });
  }

  const colunasExibidas = colunas.filter((c) => c.ehNome || colunasVisiveis.has(c.chave));
  const templateColunas = colunasExibidas.map((c) => c.larguraCss).join(" ");
  const opcaoAgrupamentoAtiva = opcoesAgrupamento.find((o) => o.chave === agruparPor) ?? null;

  const grupos: { chave: string; label: string; cor?: string; itens: T[] }[] = opcaoAgrupamentoAtiva
    ? (() => {
        const mapa = new Map<string, { chave: string; label: string; cor?: string; itens: T[] }>();
        for (const item of itens) {
          const g = opcaoAgrupamentoAtiva.grupoDe(item);
          if (!mapa.has(g.chave)) mapa.set(g.chave, { ...g, itens: [] });
          mapa.get(g.chave)!.itens.push(item);
        }
        const listaGrupos = Array.from(mapa.values());
        if (opcaoAgrupamentoAtiva.ordemGrupos) {
          listaGrupos.sort((a, b) => opcaoAgrupamentoAtiva.ordemGrupos!(a.chave, b.chave));
        }
        return listaGrupos;
      })()
    : [{ chave: "todos", label: "", itens }];

  return (
    <div>
      <div className="flex items-center justify-between gap-2 mb-3">
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold text-ink/40">Agrupar por</span>
          <select
            value={agruparPor}
            onChange={(e) => setAgruparPor(e.target.value)}
            className="input py-1.5 text-xs !w-auto"
          >
            <option value="nenhum">Nenhum</option>
            {opcoesAgrupamento.map((o) => (
              <option key={o.chave} value={o.chave}>
                {o.label}
              </option>
            ))}
          </select>
        </div>
        <div className="relative">
          <button
            onClick={() => setConfigAberta((v) => !v)}
            className="h-8 w-8 rounded-full flex items-center justify-center text-ink/40 hover:bg-surface hover:text-ink transition-colors"
            title="Personalizar colunas"
          >
            <Settings2 size={15} />
          </button>
          {configAberta && (
            <div
              className="absolute z-20 top-9 right-0 w-56 rounded-2xl bg-white border border-black/10 shadow-lg p-3"
              onMouseLeave={() => setConfigAberta(false)}
            >
              <p className="text-[11px] font-bold uppercase tracking-wide text-ink/40 mb-2">Colunas visíveis</p>
              <div className="space-y-1.5">
                {colunas
                  .filter((c) => !c.ehNome)
                  .map((c) => (
                    <label key={c.chave} className="flex items-center gap-2 text-sm text-ink/80 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={colunasVisiveis.has(c.chave)}
                        onChange={() => alternarColuna(c.chave)}
                        className="accent-forest"
                      />
                      {c.label}
                    </label>
                  ))}
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="space-y-4">
        {grupos.map((grupo) => (
          <div key={grupo.chave} className="rounded-3xl bg-card border border-black/5 overflow-hidden">
            {opcaoAgrupamentoAtiva && (
              <div className="px-5 py-2.5 border-b border-black/5 flex items-center gap-2 bg-surface/40">
                {grupo.cor ? (
                  <span className={`text-[11px] font-bold rounded-full px-2.5 py-0.5 ${grupo.cor}`}>{grupo.label}</span>
                ) : (
                  <span className="text-xs font-bold text-ink/60">{grupo.label}</span>
                )}
                <span className="text-[11px] text-ink/30">{grupo.itens.length}</span>
              </div>
            )}
            <div
              className="grid gap-2 px-5 py-2 text-[11px] font-bold uppercase tracking-wide text-ink/40 bg-surface/60"
              style={{ gridTemplateColumns: templateColunas }}
            >
              {colunasExibidas.map((c) => (
                <span key={c.chave}>{c.label}</span>
              ))}
            </div>
            {grupo.itens.length === 0 ? (
              <p className="px-5 py-4 text-sm text-ink/40">Nada aqui.</p>
            ) : (
              grupo.itens.map((item) => (
                <button
                  key={chaveId(item)}
                  onClick={() => onAbrir(item)}
                  className="w-full grid items-center gap-2 px-5 py-3 border-b border-black/5 last:border-0 hover:bg-surface/60 transition-colors text-left"
                  style={{ gridTemplateColumns: templateColunas }}
                >
                  {colunasExibidas.map((c) => (
                    <span key={c.chave} className="min-w-0">
                      {c.render(item)}
                    </span>
                  ))}
                </button>
              ))
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
