import { createAdminClient } from "@/lib/supabase/admin";

type AdminClient = ReturnType<typeof createAdminClient>;

/** Garante um access_token válido pra essa conexão — se o que está salvo
 * já venceu (ou vence nos próximos 2 minutos), troca pelo refresh_token
 * antes de devolver. Atualiza o banco com o token novo. */
export async function garantirAccessTokenValido(
  admin: AdminClient,
  conexao: { funcionario_id: string; refresh_token: string; access_token: string | null; access_token_expira_em: string | null }
): Promise<string | null> {
  const expiraEm = conexao.access_token_expira_em ? new Date(conexao.access_token_expira_em).getTime() : 0;
  const aindaValido = conexao.access_token && expiraEm - Date.now() > 2 * 60 * 1000;
  if (aindaValido) return conexao.access_token;

  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  if (!clientId || !clientSecret) return null;

  const resposta = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      refresh_token: conexao.refresh_token,
      client_id: clientId,
      client_secret: clientSecret,
      grant_type: "refresh_token",
    }),
  });
  const data = await resposta.json();
  if (!resposta.ok || !data.access_token) return null;

  const novoAccessToken = data.access_token as string;
  const novaExpiracao = new Date(Date.now() + (data.expires_in ?? 3600) * 1000).toISOString();

  await admin
    .from("funcionarios_google_calendar")
    .update({ access_token: novoAccessToken, access_token_expira_em: novaExpiracao })
    .eq("funcionario_id", conexao.funcionario_id);

  return novoAccessToken;
}
