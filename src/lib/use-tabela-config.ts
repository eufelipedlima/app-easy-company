"use client";

import { useState, useEffect } from "react";

export interface ColunaDef {
  key: string;
  label: string;
}

export interface ColunaEstado {
  key: string;
  visivel: boolean;
}

export const LINHAS_POR_PAGINA_OPCOES = [10, 25, 50, 100];

/**
 * Reaproveita o mesmo padrão de paginação + colunas customizáveis (mostrar/
 * ocultar/reordenar, salvo no navegador) já usado em Financeiro → Lançamentos.
 *
 * `chave` deve ser único por tela (ex: "contratos_pontuais", "funcionarios")
 * — é o prefixo usado nas chaves do localStorage, pra cada tela guardar sua
 * própria preferência sem conflitar com as outras.
 */
export function useTabelaConfig(chave: string, colunasDisponiveis: ColunaDef[]) {
  const colunasPadrao: ColunaEstado[] = colunasDisponiveis.map((c) => ({ key: c.key, visivel: true }));

  const [colunas, setColunas] = useState<ColunaEstado[]>(colunasPadrao);
  const [painelColunasAberto, setPainelColunasAberto] = useState(false);
  const [linhasPorPagina, setLinhasPorPagina] = useState(10);
  const [paginaAtual, setPaginaAtual] = useState(1);

  useEffect(() => {
    const salvo = window.localStorage.getItem(`${chave}_colunas`);
    if (salvo) {
      try {
        const salvoParsed = JSON.parse(salvo) as ColunaEstado[];
        // se a lista de colunas disponíveis mudou (nova coluna adicionada depois),
        // mescla o que já tinha salvo com as novas colunas no final
        const chavesSalvas = new Set(salvoParsed.map((c) => c.key));
        const novasColunas = colunasPadrao.filter((c) => !chavesSalvas.has(c.key));
        setColunas([...salvoParsed, ...novasColunas]);
      } catch {
        // ignora e mantém padrão
      }
    }
    const salvoLinhas = window.localStorage.getItem(`${chave}_linhas_por_pagina`);
    if (salvoLinhas) setLinhasPorPagina(Number(salvoLinhas));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chave]);

  function atualizarColunas(novas: ColunaEstado[]) {
    setColunas(novas);
    window.localStorage.setItem(`${chave}_colunas`, JSON.stringify(novas));
  }

  function alternarVisibilidade(key: string) {
    atualizarColunas(colunas.map((c) => (c.key === key ? { ...c, visivel: !c.visivel } : c)));
  }

  function moverColuna(key: string, direcao: -1 | 1) {
    const indice = colunas.findIndex((c) => c.key === key);
    const novoIndice = indice + direcao;
    if (novoIndice < 0 || novoIndice >= colunas.length) return;
    const novas = [...colunas];
    [novas[indice], novas[novoIndice]] = [novas[novoIndice], novas[indice]];
    atualizarColunas(novas);
  }

  function mudarLinhasPorPagina(n: number) {
    setLinhasPorPagina(n);
    setPaginaAtual(1);
    window.localStorage.setItem(`${chave}_linhas_por_pagina`, String(n));
  }

  return {
    colunas,
    painelColunasAberto,
    setPainelColunasAberto,
    linhasPorPagina,
    paginaAtual,
    setPaginaAtual,
    alternarVisibilidade,
    moverColuna,
    mudarLinhasPorPagina,
  };
}
