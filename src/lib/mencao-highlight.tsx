import type { ReactNode } from "react";

/**
 * Quebra um texto em pedaços, destacando (@Nome) de quem está na lista de
 * colegas — usado pra desenhar uma camada por trás do textarea de
 * comentário, fazendo a menção parecer "selecionada" (fundo verde) mesmo
 * enquanto a pessoa ainda está digitando, antes de publicar.
 */
export function comMencoesColoridas(texto: string, colegas: { nome: string }[]): ReactNode[] {
  if (!texto) return [];
  const nomes = [...new Set(colegas.map((c) => c.nome))].filter(Boolean).sort((a, b) => b.length - a.length);
  if (nomes.length === 0) return [texto];

  const escapado = nomes.map((n) => n.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));
  const padrao = new RegExp(`@(?:${escapado.join("|")})(?!\\w)`, "g");

  const partes: ReactNode[] = [];
  let ultimoIndex = 0;
  let match: RegExpExecArray | null;
  let chave = 0;

  while ((match = padrao.exec(texto))) {
    if (match.index > ultimoIndex) partes.push(texto.slice(ultimoIndex, match.index));
    partes.push(
      <span key={chave++} className="rounded px-0.5 -mx-0.5" style={{ background: "var(--ec-mint)", color: "var(--ec-forest)", fontWeight: 600 }}>
        {match[0]}
      </span>
    );
    ultimoIndex = match.index + match[0].length;
  }
  if (ultimoIndex < texto.length) partes.push(texto.slice(ultimoIndex));
  return partes;
}
