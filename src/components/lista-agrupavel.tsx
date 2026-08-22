"use client";

import { useEffect, useState, useRef } from "react";
import { SlidersHorizontal, ChevronDown, ChevronRight } from "lucide-react";

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

export interface EstadoListaAgrupavel {
  colunasVisiveis: Set<string>;
  alternarColuna: (chave: string) => void;
  agruparPor: string;
  setAgruparPor: (chave: string) => void;
  gruposColapsados: Set<string>;
  alternarColapso: (chave: string) => void;
}

/** Guarda o estado (colunas visíveis, agrupamento, grupos colapsados) numa
 * chave própria por lista, salvando as preferências no navegador. Separado
 * do botão e do corpo da tabela pra poder colocar o gatilho em qualquer
 * lugar da tela (ex: junto com os outros filtros, numa linha só) e o corpo
 * embaixo, sem os dois precisarem ficar vizinhos no JSX. */
export function useListaAgrupavel(chaveArmazenamento: string, chavesColunas: string[]): EstadoListaAgrupavel {
  const chaveColunas = `lista-colunas:${chaveArmazenamento}`;
  const chaveAgrupamento = `lista-agrupar:${chaveArmazenamento}`;
  const chaveColapsados = `lista-colapsados:${chaveArmazenamento}`;

  const [colunasVisiveis, setColunasVisiveis] = useState<Set<string>>(new Set(chavesColunas));
  const [agruparPor, setAgruparPor] = useState<string>("nenhum");
  const [gruposColapsados, setGruposColapsados] = useState<Set<string>>(new Set());
  const [carregou, setCarregou] = useState(false);

  useEffect(() => {
    try {
      const salvasColunas = localStorage.getItem(chaveColunas);
      if (salvasColunas) setColunasVisiveis(new Set(JSON.parse(salvasColunas)));
      const salvoAgrupamento = localStorage.getItem(chaveAgrupamento);
      if (salvoAgrupamento) setAgruparPor(salvoAgrupamento);
      const salvosColapsados = localStorage.getItem(chaveColapsados);
      if (salvosColapsados) setGruposColapsados(new Set(JSON.parse(salvosColapsados)));
    } catch {
      // preferências corrompidas ou indisponíveis — segue com o padrão
    }
    setCarregou(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!carregou) return;
    localStorage.setItem(chaveColunas, JSON.stringify(Array.from(colunasVisiveis)));
  }, [colunasVisiveis, carregou, chaveColunas]);

  useEffect(() => {
    if (!carregou) return;
    localStorage.setItem(chaveAgrupamento, agruparPor);
  }, [agruparPor, carregou, chaveAgrupamento]);

  useEffect(() => {
    if (!carregou) return;
    localStorage.setItem(chaveColapsados, JSON.stringify(Array.from(gruposColapsados)));
  }, [gruposColapsados, carregou, chaveColapsados]);

  function alternarColuna(chave: string) {
    setColunasVisiveis((atual) => {
      const nova = new Set(atual);
      if (nova.has(chave)) nova.delete(chave);
      else nova.add(chave);
      return nova;
    });
  }

  function alternarColapso(chave: string) {
    setGruposColapsados((atual) => {
      const nova = new Set(atual);
      if (nova.has(chave)) nova.delete(chave);
      else nova.add(chave);
      return nova;
    });
  }

  return { colunasVisiveis, alternarColuna, agruparPor, setAgruparPor, gruposColapsados, alternarColapso };
}

/** O botão "Exibir" — pode ficar em qualquer lugar da tela (ex: na mesma
 * linha dos outros filtros), separado do corpo da lista. */
export function BotaoExibirLista<T>({
  estado,
  colunas,
  opcoesAgrupamento,
}: {
  estado: EstadoListaAgrupavel;
  colunas: ColunaLista<T>[];
  opcoesAgrupamento: OpcaoAgrupamento<T>[];
}) {
  const [aberto, setAberto] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function aoClicarFora(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setAberto(false);
    }
    if (aberto) document.addEventListener("mousedown", aoClicarFora);
    return () => document.removeEventListener("mousedown", aoClicarFora);
  }, [aberto]);

  const nomeAgrupamentoAtivo = opcoesAgrupamento.find((o) => o.chave === estado.agruparPor)?.label ?? null;

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setAberto((v) => !v)}
        className={`inline-flex items-center gap-1.5 rounded-full h-10 px-4 text-sm font-semibold border-2 transition-colors ${
          aberto || nomeAgrupamentoAtivo
            ? "border-forest text-forest bg-mint"
            : "border-black/10 text-ink/50 hover:text-ink hover:bg-surface"
        }`}
      >
        <SlidersHorizontal size={15} />
        Exibir
        {nomeAgrupamentoAtivo && <span className="opacity-70">· {nomeAgrupamentoAtivo}</span>}
      </button>
      {aberto && (
        <div className="absolute z-20 right-0 mt-1.5 w-64 rounded-2xl bg-white border border-black/10 shadow-xl p-3.5 space-y-4">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-wide text-ink/40 mb-2">Agrupar por</p>
            <div className="flex flex-wrap gap-1.5">
              <button
                onClick={() => estado.setAgruparPor("nenhum")}
                className={`rounded-full px-2.5 py-1 text-xs font-semibold border transition-colors ${
                  estado.agruparPor === "nenhum" ? "bg-ink text-white border-ink" : "border-black/10 text-ink/60 hover:bg-surface"
                }`}
              >
                Nenhum
              </button>
              {opcoesAgrupamento.map((o) => (
                <button
                  key={o.chave}
                  onClick={() => estado.setAgruparPor(o.chave)}
                  className={`rounded-full px-2.5 py-1 text-xs font-semibold border transition-colors ${
                    estado.agruparPor === o.chave ? "bg-ink text-white border-ink" : "border-black/10 text-ink/60 hover:bg-surface"
                  }`}
                >
                  {o.label}
                </button>
              ))}
            </div>
          </div>
          <div className="pt-3 border-t border-black/5">
            <p className="text-[11px] font-bold uppercase tracking-wide text-ink/40 mb-2">Colunas visíveis</p>
            <div className="space-y-1">
              {colunas
                .filter((c) => !c.ehNome)
                .map((c) => (
                  <label key={c.chave} className="flex items-center gap-2 text-sm text-ink/80 cursor-pointer py-0.5">
                    <input
                      type="checkbox"
                      checked={estado.colunasVisiveis.has(c.chave)}
                      onChange={() => estado.alternarColuna(c.chave)}
                      className="accent-forest"
                    />
                    {c.label}
                  </label>
                ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/** O corpo da lista — grupos, cabeçalho de colunas e linhas. Usa o mesmo
 * objeto de estado do BotaoExibirLista, então os dois refletem um ao
 * outro mesmo estando em partes bem diferentes da tela. */
export function CorpoListaAgrupavel<T>({
  itens,
  chaveId,
  colunas,
  opcoesAgrupamento,
  estado,
  onAbrir,
}: {
  itens: T[];
  chaveId: (item: T) => string;
  colunas: ColunaLista<T>[];
  opcoesAgrupamento: OpcaoAgrupamento<T>[];
  estado: EstadoListaAgrupavel;
  onAbrir: (item: T) => void;
}) {
  const colunasExibidas = colunas.filter((c) => c.ehNome || estado.colunasVisiveis.has(c.chave));
  const templateColunas = colunasExibidas.map((c) => c.larguraCss).join(" ");
  const opcaoAgrupamentoAtiva = opcoesAgrupamento.find((o) => o.chave === estado.agruparPor) ?? null;

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
    <div className="space-y-3">
      {grupos.map((grupo) => {
        const colapsado = estado.gruposColapsados.has(grupo.chave);
        return (
          <div key={grupo.chave} className="rounded-2xl bg-card border border-black/5 overflow-hidden">
            {opcaoAgrupamentoAtiva && (
              <button
                onClick={() => estado.alternarColapso(grupo.chave)}
                className="w-full flex items-center gap-2 px-4 py-2.5 bg-surface/50 hover:bg-surface transition-colors text-left"
              >
                {colapsado ? <ChevronRight size={14} className="text-ink/40" /> : <ChevronDown size={14} className="text-ink/40" />}
                {grupo.cor ? (
                  <span className={`text-[11px] font-bold rounded-full px-2.5 py-0.5 ${grupo.cor}`}>{grupo.label}</span>
                ) : (
                  <span className="text-xs font-bold text-ink/70">{grupo.label}</span>
                )}
                <span className="text-[11px] text-ink/30">{grupo.itens.length}</span>
              </button>
            )}
            {!colapsado && (
              <>
                <div
                  className="grid gap-2 px-4 py-1.5 text-[10px] font-bold uppercase tracking-wide text-ink/35"
                  style={{ gridTemplateColumns: templateColunas }}
                >
                  {colunasExibidas.map((c) => (
                    <span key={c.chave}>{c.label}</span>
                  ))}
                </div>
                {grupo.itens.length === 0 ? (
                  <p className="px-4 py-4 text-sm text-ink/40">Nada aqui.</p>
                ) : (
                  grupo.itens.map((item) => (
                    <button
                      key={chaveId(item)}
                      onClick={() => onAbrir(item)}
                      className="w-full grid items-center gap-2 px-4 py-2.5 border-t border-black/5 hover:bg-surface/60 transition-colors text-left"
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
              </>
            )}
          </div>
        );
      })}
    </div>
  );
}

/** Versão "tudo junto" (botão + corpo lado a lado), pra quem não precisa
 * separar os dois — usada onde não há uma linha de filtros própria pra
 * encaixar o botão (ex: dentro da Central de Clientes). */
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
  chaveArmazenamento: string;
  onAbrir: (item: T) => void;
}) {
  const estado = useListaAgrupavel(chaveArmazenamento, colunas.map((c) => c.chave));
  return (
    <div>
      <div className="flex justify-end mb-3">
        <BotaoExibirLista estado={estado} colunas={colunas} opcoesAgrupamento={opcoesAgrupamento} />
      </div>
      <CorpoListaAgrupavel itens={itens} chaveId={chaveId} colunas={colunas} opcoesAgrupamento={opcoesAgrupamento} estado={estado} onAbrir={onAbrir} />
    </div>
  );
}
