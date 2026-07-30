// Paleta fixa de cores disponíveis pros status do calendário de conteúdo.
// Cada status guarda só a "chave" (ex: "roxo") no banco — as classes visuais
// ficam aqui, compartilhadas entre a tela interna, a de configuração e a
// pública, pra manter consistência e não depender de string solta no banco.
export const PALETA_CORES: Record<string, { nome: string; cor: string; dot: string }> = {
  cinza: { nome: "Cinza", cor: "bg-slate-100 text-slate-600", dot: "bg-slate-400" },
  indigo: { nome: "Índigo", cor: "bg-indigo-50 text-indigo-700", dot: "bg-indigo-500" },
  ciano: { nome: "Ciano", cor: "bg-cyan-50 text-cyan-700", dot: "bg-cyan-500" },
  azul: { nome: "Azul", cor: "bg-sky-50 text-sky-700", dot: "bg-sky-500" },
  roxo: { nome: "Roxo", cor: "bg-purple-50 text-purple-700", dot: "bg-purple-500" },
  amarelo: { nome: "Amarelo", cor: "bg-amber-50 text-amber-700", dot: "bg-amber-500" },
  vermelho: { nome: "Vermelho", cor: "bg-red-50 text-red-700", dot: "bg-red-500" },
  "verde-agua": { nome: "Verde-água", cor: "bg-teal-50 text-teal-700", dot: "bg-teal-500" },
  verde: { nome: "Verde", cor: "bg-mint text-forest", dot: "bg-forest" },
  rosa: { nome: "Rosa", cor: "bg-pink-50 text-pink-700", dot: "bg-pink-500" },
  laranja: { nome: "Laranja", cor: "bg-orange-50 text-orange-700", dot: "bg-orange-500" },
};

export function corDoStatus(chave: string) {
  return PALETA_CORES[chave] ?? PALETA_CORES.cinza;
}
