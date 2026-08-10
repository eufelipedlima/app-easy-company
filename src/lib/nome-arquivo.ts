/**
 * Deixa um nome de arquivo seguro pra usar como parte do caminho de
 * upload no Storage (o Supabase rejeita colchetes, acentos, espaços
 * e alguns outros símbolos com "Invalid key"). O nome original de
 * exibição continua guardado à parte, isso aqui é só pro caminho.
 */
export function sanearNomeArquivo(nome: string): string {
  const ultimoPonto = nome.lastIndexOf(".");
  const base = ultimoPonto > 0 ? nome.slice(0, ultimoPonto) : nome;
  const extensao = ultimoPonto > 0 ? nome.slice(ultimoPonto) : "";
  const baseLimpa = base
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "") // remove acentos
    .replace(/[^a-zA-Z0-9-_]+/g, "-") // troca qualquer coisa que não seja letra/número por hífen
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 80);
  const extensaoLimpa = extensao.replace(/[^a-zA-Z0-9.]/g, "");
  return (baseLimpa || "arquivo") + extensaoLimpa;
}
