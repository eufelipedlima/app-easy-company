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
