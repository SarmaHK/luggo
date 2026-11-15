'use server'

import { randomBytes } from 'crypto'
import { headers } from 'next/headers'
import { revalidatePath } from 'next/cache'
import { createServiceClient } from '@/lib/supabase/service'
import { requireAdmin } from '@/lib/admin/guard'
import { createStaffMember } from '@/lib/admin/staffActions'
import { hitRateLimit } from '@/lib/security/rateLimit'
import { sendEmail } from '@/lib/utils/email'
import { CONTACT_EMAIL } from '@/lib/public-company'
import { siteUrl } from '@/lib/site-url'
import { uuidSchema } from '@/lib/validators/common'
import {
  approvePartnerSchema,
  cleanInviteToken,
  cleanRefCode,
  partnerApplicationSchema,
  type PartnerApplicationInput,
} from '@/lib/validators/partner'

type SubmitResult = { ok: true } | { ok: false; error: 'invalid' | 'rateLimited' | 'inviteInvalid' | 'failed' }

function escapeHtml(value: string): string {
  return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;')
}

// ─────────────────────────────────────────────
// PUBLIC — submit an application from /partners
// ─────────────────────────────────────────────
export async function submitPartnerApplication(input: PartnerApplicationInput): Promise<SubmitResult> {
  const parsed = partnerApplicationSchema.safeParse(input)
  if (!parsed.success) return { ok: false, error: 'invalid' }
  const data = parsed.data

  // Bots fill every field; pretend it worked so they learn nothing.
  if (data.website) return { ok: true }

  const ip = (await headers()).get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown'
  const byIp = await hitRateLimit(`partner-apply:ip:${ip}`, 5, 60 * 60_000)
  const byEmail = await hitRateLimit(`partner-apply:email:${data.email}`, 3, 24 * 60 * 60_000)
  if (!byIp.allowed || !byEmail.allowed) return { ok: false, error: 'rateLimited' }

  const svc = createServiceClient()

  // An invite link is single-use: claim it before saving so two submissions can't share it.
  let inviteId: string | null = null
  const inviteToken = cleanInviteToken(data.invite)
  if (data.invite) {
    if (!inviteToken) return { ok: false, error: 'inviteInvalid' }
    const { data: claimed } = await svc
      .from('partner_invites' as never)
      .update({ used_at: new Date().toISOString() } as never)
      .eq('token', inviteToken)
      .is('used_at', null)
      .gt('expires_at', new Date().toISOString())
      .select('id') as { data: { id: string }[] | null }
    if (!claimed?.length) return { ok: false, error: 'inviteInvalid' }
    inviteId = claimed[0].id
  }

  const { error } = await svc.from('partner_applications' as never).insert({
    business_name: data.businessName,
    contact_name: data.contactName,
    phone: data.phone,
    email: data.email,
    city: data.city,
    address: data.address,
    business_type: data.businessType,
    storage_capacity: data.storageCapacity ?? null,
    open_time: data.openTime || null,
    close_time: data.closeTime || null,
    notes: data.notes || null,
    locale: data.locale ?? null,
    ref_code: cleanRefCode(data.ref),
    invite_id: inviteId,
  } as never) as { error: { message: string } | null }

  if (error) {
    console.error('[partners] application insert failed:', error.message)
    // Give the invite back so the applicant can retry with the same link.
    if (inviteId) await svc.from('partner_invites' as never).update({ used_at: null } as never).eq('id', inviteId)
    return { ok: false, error: 'failed' }
  }

  await sendEmail({
    to: process.env.PARTNER_NOTIFY_EMAIL || CONTACT_EMAIL,
    subject: `New partner application: ${data.businessName}`,
    html: `<p>A new partner application was submitted.</p>
<ul>
<li><b>Business:</b> ${escapeHtml(data.businessName)} (${escapeHtml(data.businessType)})</li>
<li><b>Contact:</b> ${escapeHtml(data.contactName)}, ${escapeHtml(data.phone)}, ${escapeHtml(data.email)}</li>
<li><b>Location:</b> ${escapeHtml(data.city)} — ${escapeHtml(data.address)}</li>
</ul>
<p>Review it at <a href="${siteUrl}/admin/partners">${siteUrl}/admin/partners</a>.</p>`,
  })

  return { ok: true }
}

// ─────────────────────────────────────────────
// ADMIN — invite links
// ─────────────────────────────────────────────
export async function createPartnerInvite(input: {
  businessName?: string
  note?: string
  days?: number
}): Promise<{ error?: string; url?: string }> {
  const { svc, userId, role, error: authError } = await requireAdmin()
  if (authError || !svc) return { error: authError ?? 'Auth error' }

  const days = Number.isInteger(input.days) && input.days! >= 1 && input.days! <= 90 ? input.days! : 14
  const token = randomBytes(24).toString('base64url')
  const { data: invite, error } = await svc
    .from('partner_invites' as never)
    .insert({
      token,
      business_name: input.businessName?.trim().slice(0, 120) || null,
      note: input.note?.trim().slice(0, 300) || null,
      created_by: userId,
      expires_at: new Date(Date.now() + days * 24 * 60 * 60_000).toISOString(),
    } as never)
    .select('id')
    .single() as { data: { id: string } | null; error: { message: string } | null }
  if (error || !invite) return { error: error?.message ?? 'Failed to create invite link.' }

  await svc.rpc('write_audit_log', {
    p_actor_id: userId,
    p_actor_role: role,
    p_action: 'partner_invite_created',
    p_entity: 'partner_invites',
    p_entity_id: invite.id,
    p_metadata: { business_name: input.businessName ?? null, days },
  })

  revalidatePath('/admin/partners')
  return { url: `${siteUrl}/partners?invite=${token}` }
}

// ─────────────────────────────────────────────
// ADMIN — review applications
// ─────────────────────────────────────────────
type ApplicationRow = {
  id: string
  status: string
  business_name: string
  contact_name: string
  email: string
  city: string
  address: string
  open_time: string | null
  close_time: string | null
}

export async function rejectPartnerApplication(id: string, note?: string): Promise<{ error?: string; success?: boolean }> {
  const { svc, userId, role, error: authError } = await requireAdmin()
  if (authError || !svc) return { error: authError ?? 'Auth error' }
  if (!uuidSchema.safeParse(id).success) return { error: 'Invalid application.' }

  const { data: updated, error } = await svc
    .from('partner_applications' as never)
    .update({ status: 'rejected', admin_note: note?.trim().slice(0, 500) || null, reviewed_by: userId, reviewed_at: new Date().toISOString() } as never)
    .eq('id', id)
    .eq('status', 'new')
    .select('id') as { data: { id: string }[] | null; error: { message: string } | null }
  if (error) return { error: error.message }
  if (!updated?.length) return { error: 'This application has already been reviewed.' }

  await svc.rpc('write_audit_log', {
    p_actor_id: userId, p_actor_role: role, p_action: 'partner_application_rejected',
    p_entity: 'partner_applications', p_entity_id: id, p_metadata: {},
  })
  revalidatePath('/admin/partners')
  return { success: true }
}

/**
 * Approving creates the hub as INACTIVE (it stays off the public site until an admin
 * switches it on from /admin/hubs) and a staff account for the applicant.
 */
export async function approvePartnerApplication(
  id: string,
  input: { alias: string; capacity: number; latitude: number; longitude: number }
): Promise<{ error?: string; success?: boolean; warning?: string }> {
  const { svc, userId, role, error: authError } = await requireAdmin()
  if (authError || !svc) return { error: authError ?? 'Auth error' }
  if (!uuidSchema.safeParse(id).success) return { error: 'Invalid application.' }

  const parsed = approvePartnerSchema.safeParse({ ...input, alias: input.alias.trim().toUpperCase() })
  if (!parsed.success) return { error: parsed.error.issues[0].message }

  const { data: app } = await svc
    .from('partner_applications' as never)
    .select('id, status, business_name, contact_name, email, city, address, open_time, close_time')
    .eq('id', id)
    .maybeSingle() as { data: ApplicationRow | null }
  if (!app) return { error: 'Application not found.' }
  if (app.status !== 'new') return { error: 'This application has already been reviewed.' }

  const { data: hub, error: hubError } = await svc
    .from('hubs' as never)
    .insert({
      name: app.business_name,
      alias: parsed.data.alias,
      location: app.city,
      address: app.address,
      capacity: parsed.data.capacity,
      open_time: app.open_time ?? '06:00',
      close_time: app.close_time ?? '22:00',
      latitude: parsed.data.latitude,
      longitude: parsed.data.longitude,
      active: false,
    } as never)
    .select('id')
    .single() as { data: { id: string } | null; error: { message: string } | null }
  if (hubError || !hub) {
    if (hubError?.message.toLowerCase().includes('unique') || hubError?.message.includes('duplicate key')) {
      return { error: `A hub with alias "${parsed.data.alias}" already exists.` }
    }
    return { error: hubError?.message ?? 'Failed to create the hub.' }
  }

  // Only one reviewer may win; if another admin got here first, undo the hub.
  const { data: claimed } = await svc
    .from('partner_applications' as never)
    .update({ status: 'approved', hub_id: hub.id, reviewed_by: userId, reviewed_at: new Date().toISOString() } as never)
    .eq('id', id)
    .eq('status', 'new')
    .select('id') as { data: { id: string }[] | null }
  if (!claimed?.length) {
    await svc.from('hubs' as never).delete().eq('id', hub.id)
    return { error: 'This application has already been reviewed.' }
  }

  await svc.rpc('write_audit_log', {
    p_actor_id: userId, p_actor_role: role, p_action: 'partner_application_approved',
    p_entity: 'partner_applications', p_entity_id: id,
    p_metadata: { hub_id: hub.id, alias: parsed.data.alias },
  })

  const staff = await createStaffMember({ email: app.email, name: app.contact_name, hubId: hub.id })

  revalidatePath('/admin/partners')
  revalidatePath('/admin/hubs')
  if (staff.error) {
    return { success: true, warning: `Hub created, but the staff account failed: ${staff.error} Add it from the Staff page.` }
  }
  return { success: true }
}
