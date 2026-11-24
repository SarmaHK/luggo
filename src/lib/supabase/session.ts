import type { SupabaseClient } from '@supabase/supabase-js'

/**
 * The signed-in user's id, or null. The token is verified locally against the project's
 * public signing keys (no network call); only if that cannot be done does it ask the auth
 * server. Use it to decide what to render. Anything that changes data should still call
 * auth.getUser() so a revoked session is rejected immediately.
 */
export async function getSessionUserId(supabase: SupabaseClient): Promise<string | null> {
  const { data, error } = await supabase.auth.getClaims()
  const id = data?.claims?.sub ?? null
  if (id || !error) return id
  const { data: { user } } = await supabase.auth.getUser()
  return user?.id ?? null
}
