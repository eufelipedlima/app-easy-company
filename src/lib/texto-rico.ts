/**
 * Decide se um texto salvo (comentário, mensagem de chat) é HTML do
 * editor de texto rico, ou texto simples do formato antigo (com
 * marcação manual tipo negrito ou itálico).
 *
 * Antes a gente só olhava se o texto começava com uma tag, mas isso
 * falha sempre que a mensagem começa com texto puro e só tem uma tag
 * no meio — por exemplo uma quebra de linha, que é bem comum. Aqui a
 * gente procura por uma tag em qualquer parte do texto, o que cobre
 * esse caso.
 */
export function ehTextoRico(texto: string): boolean {
  return /<[a-z][\s\S]*?>/i.test(texto);
}
