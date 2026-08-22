import type { ReactNode } from "react";
import { Play, Clock, Tag, Calendar, Paperclip, UserPlus, UserMinus, Pencil, Building2, ListTree, FileEdit } from "lucide-react";

/** Escolhe um ícone pequeno pra cada tipo de evento do histórico, baseado em
 * palavras-chave do texto — deixa mais fácil bater o olho e identificar o
 * tipo de mudança sem ler tudo. */
export function iconeHistorico(descricao: string): ReactNode {
  const d = descricao.toLowerCase();
  const props = { size: 12, strokeWidth: 2.5 };
  if (d.startsWith("passou") && d.includes("trabalhando")) return <Clock {...props} />;
  if (d.includes("status")) return <Tag {...props} />;
  if (d.includes("prazo") || d.includes("data")) return <Calendar {...props} />;
  if (d.includes("anexou") || d.includes("adicionou") && (d.includes("arquivo") || d.includes("arte"))) return <Paperclip {...props} />;
  if (d.startsWith("atribuiu")) return <UserPlus {...props} />;
  if (d.startsWith("removeu") && d.includes("responsáve")) return <UserMinus {...props} />;
  if (d.startsWith("renomeou")) return <Pencil {...props} />;
  if (d.includes("cliente")) return <Building2 {...props} />;
  if (d.includes("subtarefa") || d.includes("pasta")) return <ListTree {...props} />;
  return <FileEdit {...props} />;
}

/** Destaca os trechos entre aspas (o valor novo/antigo de uma mudança) com
 * negrito, pra ficar fácil de achar "o que mudou" sem ler a frase toda. */
export function comValoresDestacados(descricao: string): ReactNode[] {
  const partes = descricao.split(/("[^"]+")/g);
  return partes.map((parte, i) =>
    parte.startsWith('"') && parte.endsWith('"') ? (
      <span key={i} className="font-semibold text-ink">
        {parte}
      </span>
    ) : (
      parte
    )
  );
}

/** Lê "Fulano passou Xmin trabalhando..." no histórico e soma por pessoa —
 * é a fonte mais completa que existe, porque toda sessão de cronômetro
 * concluída sempre gerou essa linha, mesmo antes de existir uma sessão
 * por pessoa dedicada. Assim ninguém fica de fora da contagem.
 *
 * Reconhece também o texto mais antigo ainda ("pausou o cronômetro
 * (+Xmin)"), usado antes de deixarmos a frase mais direta — sem isso,
 * sessões registradas há mais tempo ficavam de fora da soma. */
export function segundosPorPessoaDoHistorico(
  historico: { autor_id: string | null; descricao: string; created_at: string }[]
): Map<string, number> {
  const mapa = new Map<string, number>();
  for (const s of sessoesDoHistorico(historico)) {
    mapa.set(s.autorId, (mapa.get(s.autorId) ?? 0) + s.segundos);
  }
  return mapa;
}

/** Mesma leitura acima, mas devolvendo cada sessão individual (com data) em
 * vez de já somar tudo — usado quando é preciso filtrar por período (ex:
 * lucratividade por mês), já que a soma pronta não permite recortar por
 * data depois. */
export function sessoesDoHistorico(
  historico: { autor_id: string | null; descricao: string; created_at: string }[]
): { autorId: string; segundos: number; dataISO: string }[] {
  const regexes = [/^passou (?:menos de 1min|(\d+)min) trabalhando/, /^pausou o cronômetro \(\+(?:menos de 1|(\d+))min\)/];
  const sessoes: { autorId: string; segundos: number; dataISO: string }[] = [];
  for (const h of historico) {
    if (!h.autor_id) continue;
    const m = regexes.map((r) => h.descricao.match(r)).find((r) => r);
    if (!m) continue;
    const segundos = m[1] ? Number(m[1]) * 60 : 30;
    sessoes.push({ autorId: h.autor_id, segundos, dataISO: h.created_at });
  }
  return sessoes;
}
