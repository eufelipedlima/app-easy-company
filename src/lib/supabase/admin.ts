import { createClient as createSupabaseClient } from "@supabase/supabase-js";

// Usa a service role key — só pode ser chamado no servidor (route handlers),
// nunca em código que roda no navegador. Ignora RLS de propósito, então cada
// uso precisa validar manualmente o que está liberando (ex: o token do link
// público de um cliente específico).
export function createAdminClient() {
  return createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
}
