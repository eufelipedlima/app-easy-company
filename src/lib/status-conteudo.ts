// Paleta fixa de cores disponíveis pros status do calendário de conteúdo.
// Cada status guarda só a "chave" (ex: "roxo") no banco — as classes visuais
// ficam aqui, compartilhadas entre a tela interna, a de configuração e a
// pública, pra manter consistência e não depender de string solta no banco.
export const PALETA_CORES: Record<
  string,
  { nome: string; cor: string; dot: string; colBg: string; colBorder: string }
> = {
  cinza: { nome: "Cinza", cor: "bg-slate-100 text-slate-600", dot: "bg-slate-400", colBg: "bg-slate-100", colBorder: "border-slate-300" },
  indigo: { nome: "Índigo", cor: "bg-indigo-50 text-indigo-700", dot: "bg-indigo-500", colBg: "bg-indigo-100/70", colBorder: "border-indigo-300" },
  ciano: { nome: "Ciano", cor: "bg-cyan-50 text-cyan-700", dot: "bg-cyan-500", colBg: "bg-cyan-100/70", colBorder: "border-cyan-300" },
  azul: { nome: "Azul", cor: "bg-sky-50 text-sky-700", dot: "bg-sky-500", colBg: "bg-sky-100/70", colBorder: "border-sky-300" },
  roxo: { nome: "Roxo", cor: "bg-purple-50 text-purple-700", dot: "bg-purple-500", colBg: "bg-purple-100/70", colBorder: "border-purple-300" },
  amarelo: { nome: "Amarelo", cor: "bg-amber-50 text-amber-700", dot: "bg-amber-500", colBg: "bg-amber-100/70", colBorder: "border-amber-300" },
  vermelho: { nome: "Vermelho", cor: "bg-red-50 text-red-700", dot: "bg-red-500", colBg: "bg-red-100/70", colBorder: "border-red-300" },
  "verde-agua": { nome: "Verde-água", cor: "bg-teal-50 text-teal-700", dot: "bg-teal-500", colBg: "bg-teal-100/70", colBorder: "border-teal-300" },
  verde: { nome: "Verde", cor: "bg-mint text-forest", dot: "bg-forest", colBg: "bg-mint/80", colBorder: "border-forest/35" },
  rosa: { nome: "Rosa", cor: "bg-pink-50 text-pink-700", dot: "bg-pink-500", colBg: "bg-pink-100/70", colBorder: "border-pink-300" },
  laranja: { nome: "Laranja", cor: "bg-orange-50 text-orange-700", dot: "bg-orange-500", colBg: "bg-orange-100/70", colBorder: "border-orange-300" },
};

export function corDoStatus(chave: string) {
  return PALETA_CORES[chave] ?? PALETA_CORES.cinza;
}

/** Escolhe o status padrão pra uma tarefa/conteúdo recém-criado — sempre
 * tenta achar "Ideia" pelo nome, em vez de simplesmente pegar o primeiro
 * item da lista (que muda se alguém reordenar os status em
 * Configurações). Se não achar "Ideia" (lista vazia, ou renomeado),
 * cai pro primeiro item mesmo, como reserva. */
export function statusPadrao<T extends { id: string; nome: string }>(lista: T[]): T | undefined {
  return lista.find((s) => s.nome.trim().toLowerCase() === "ideia") ?? lista[0];
}
