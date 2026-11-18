import { cache } from 'react'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getSessionUserId } from '@/lib/supabase/session'
import { type UserRole } from '@/types/database'

const ADMIN_ROLES: UserRole[] = ['support_admin', 'ops_admin', 'master_admin']

/**
 * Identity for an admin page render: ONE local token check plus ONE profile query, shared by
 * everything in the same request (React cache). Before this each page made its own getUser()
 * network call and its own role query on top of the middleware's, about four sequential
 * round trips to Supabase before any page data was fetched.
 *
 * getClaims() verifies the session token's signature locally (the project signs with ES256 keys),
 * so it needs no network call. The role still comes from the database on every request, and every
 * query below runs as the signed-in user under row-level security. Server actions that change data
 * keep using requireAdmin() in ./guard, which asks the auth server directly.
 */
export const getAdminPageContext = cache(async () => {
  const supabase = await createClient()

  const userId = await getSessionUserId(supabase)
  if (!userId) redirect('/admin/login')

  const { data: profile } = await supabase
    .from('users')
    .select('name, role')
    .eq('id', userId)
    .single() as { data: { name: string; role: UserRole } | null; error: unknown }

  // Defence in depth: the middleware already gates /admin, but pages that use the service
  // client must not rely on that alone.
  if (!profile || !ADMIN_ROLES.includes(profile.role)) redirect('/admin/login')

  return { supabase, userId, profile }
})
