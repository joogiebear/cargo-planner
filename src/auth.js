// Supabase auth helpers — magic-link only, invite-only access.

import { supabase, supabaseConfigured } from './supabase.js';

export async function signInWithMagicLink(email) {
  if (!supabaseConfigured) throw new Error('Supabase not configured');
  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: {
      emailRedirectTo: window.location.origin,
      // Don't auto-create users in auth.users — that would let anyone trigger
      // an outbound email + auth row. Invite-only matching happens in resolveAppUser.
      // Note: Supabase still creates the auth.users row on first verified click,
      // but resolveAppUser blocks the session if there's no app users row.
    },
  });
  if (error) throw error;
}

export async function signOut() {
  if (!supabaseConfigured) return;
  await supabase.auth.signOut();
}

export async function getSession() {
  if (!supabaseConfigured) return null;
  const { data } = await supabase.auth.getSession();
  return data?.session || null;
}

export function onAuthStateChange(handler) {
  if (!supabaseConfigured) return () => {};
  const { data } = supabase.auth.onAuthStateChange((_event, session) => handler(session));
  return () => data?.subscription?.unsubscribe();
}

// Look up the app users row that matches the authenticated email.
// Returns the row in prototype shape, with _uuid set, or null if not invited.
// Also links the auth.users.id back into users.auth_user_id on first match.
export async function resolveAppUser(session) {
  if (!session?.user?.email) return null;
  const email = session.user.email.toLowerCase();
  const authUserId = session.user.id;

  const { data, error } = await supabase
    .from('users')
    .select('id, legacy_id, name, email, role, status, auth_user_id')
    .eq('email', email)
    .maybeSingle();

  if (error) {
    console.error('[auth] users lookup failed', error);
    return null;
  }
  if (!data) return null;
  if (data.status === 'suspended') return { suspended: true };

  // First-time sign-in: store the auth.users.id link so we can RLS off it later.
  if (!data.auth_user_id) {
    const { error: linkErr } = await supabase
      .from('users')
      .update({ auth_user_id: authUserId, last_seen_at: new Date().toISOString() })
      .eq('id', data.id);
    if (linkErr) console.warn('[auth] failed to link auth_user_id', linkErr);
  } else {
    // Bump last_seen_at; ignore failures.
    supabase.from('users').update({ last_seen_at: new Date().toISOString() }).eq('id', data.id).then(() => {});
  }

  // Also fetch facility access for this user.
  const { data: ufa } = await supabase
    .from('user_facility_access')
    .select('facility_id, facilities(legacy_id)')
    .eq('user_id', data.id);

  const facilities = (ufa || [])
    .map(r => r.facilities?.legacy_id)
    .filter(Boolean);

  return {
    _uuid: data.id,
    id: data.legacy_id || ('u-auth-' + data.id.slice(0, 8)),
    name: data.name,
    email: data.email,
    role: data.role,
    status: data.status,
    facilities,
  };
}
