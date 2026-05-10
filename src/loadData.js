// Hydrate window.CP_DATA and window.CP_USERS from Supabase.
// Maps server rows back into the prototype shape so existing components
// (which look up records by string IDs like 'f-bk') keep working.
//
// On error, the app falls back to whatever data.js installed.

import { supabase, supabaseConfigured } from './supabase.js';
import { loadScenarios, loadRecentAudit, loadShipments } from './sync.js';

export async function loadReferenceData() {
  if (!supabaseConfigured) return { ok: false, reason: 'no-config' };

  const [facRes, truckRes, crateRes, userRes, ufaRes] = await Promise.all([
    supabase.from('facilities').select('id, legacy_id, code, name, city, address, archived').eq('archived', false),
    supabase.from('trucks').select('id, legacy_id, facility_id, ref, model, type, length_in, width_in, height_in, max_lbs, axles, out_of_service').eq('out_of_service', false),
    supabase.from('crates').select('id, legacy_id, ref, title, artist, year, medium, length_in, width_in, height_in, weight_lbs, value_cents, fragile, orient, stack, flat, glass, home_facility_id'),
    supabase.from('users').select('id, legacy_id, name, email, role, status, invited_at'),
    supabase.from('user_facility_access').select('user_id, facility_id'),
  ]);

  const errs = [facRes, truckRes, crateRes, userRes, ufaRes].map(r => r.error).filter(Boolean);
  if (errs.length) {
    console.error('[supabase] reference load failed:', errs);
    return { ok: false, reason: 'fetch-error', errors: errs };
  }

  // uuid → legacy_id maps for joining
  const facUuidToLegacy = Object.fromEntries(facRes.data.map(f => [f.id, f.legacy_id]));
  const userUuidToLegacy = Object.fromEntries(userRes.data.map(u => [u.id, u.legacy_id]));

  // facility user/truck counts
  const truckCount = {};
  for (const t of truckRes.data) {
    const flegacy = facUuidToLegacy[t.facility_id];
    if (flegacy) truckCount[flegacy] = (truckCount[flegacy] || 0) + 1;
  }
  const userCount = {};
  for (const a of ufaRes.data) {
    const flegacy = facUuidToLegacy[a.facility_id];
    if (flegacy) userCount[flegacy] = (userCount[flegacy] || 0) + 1;
  }

  // facilities
  const facilities = facRes.data.map(f => ({
    id: f.legacy_id,
    _uuid: f.id,
    code: f.code,
    name: f.name,
    city: f.city,
    address: f.address,
    users: userCount[f.legacy_id] || 0,
    trucks: truckCount[f.legacy_id] || 0,
  }));

  // trucks
  const trucks = truckRes.data.map(t => ({
    id: t.legacy_id,
    _uuid: t.id,
    facility: facUuidToLegacy[t.facility_id],
    ref: t.ref,
    model: t.model,
    type: t.type,
    L: t.length_in,
    W: t.width_in,
    H: t.height_in,
    maxLbs: t.max_lbs,
    axles: t.axles,
  }));

  // crates → "items" in prototype shape
  const items = crateRes.data.map(c => ({
    id: c.legacy_id,
    _uuid: c.id,
    ref: c.ref,
    title: c.title,
    artist: c.artist,
    year: c.year,
    medium: c.medium,
    L: c.length_in,
    W: c.width_in,
    H: c.height_in,
    lbs: c.weight_lbs,
    value: Number(c.value_cents) / 100,
    fragile: c.fragile,
    orient: c.orient,
    stack: c.stack,
    flat: c.flat,
    glass: c.glass,
    homeFacility: facUuidToLegacy[c.home_facility_id] || null,
    status: 'queued',
  }));

  // users + their facility access
  const userFacilities = {};
  for (const a of ufaRes.data) {
    const ulegacy = userUuidToLegacy[a.user_id];
    const flegacy = facUuidToLegacy[a.facility_id];
    if (!ulegacy) continue;
    (userFacilities[ulegacy] ||= []).push(flegacy);
  }
  const users = userRes.data.map(u => ({
    id: u.legacy_id,
    _uuid: u.id,
    name: u.name,
    email: u.email,
    role: u.role,
    status: u.status,
    facilities: userFacilities[u.legacy_id] || [],
    invitedAt: u.invited_at?.slice(0, 10),
  }));

  // Patch the existing globals (data.js has already populated them with the seed
  // shape; we keep the same keys so components don't need to change).
  const existing = window.CP_DATA || {};
  window.CP_DATA = {
    ...existing,
    facilities,
    trucks,
    items,
  };
  window.CP_USERS = users;

  return {
    ok: true,
    counts: {
      facilities: facilities.length,
      trucks: trucks.length,
      crates: items.length,
      users: users.length,
    },
  };
}

// Must be called AFTER loadReferenceData() — both scenario rows and audit rows
// reference UUIDs that we resolve back to legacy_ids using window.CP_DATA / CP_USERS.
export async function hydrateUserData() {
  if (!supabaseConfigured) return { ok: false, reason: 'no-config' };
  const store = window.CP_STORE;
  if (!store) return { ok: false, reason: 'no-store' };

  const [scenRes, auditRes, shipRes] = await Promise.all([
    loadScenarios(),
    loadRecentAudit(200),
    loadShipments(),
  ]);

  if (scenRes.ok)  store.set('scenarios', scenRes.rows);
  if (auditRes.ok) store.set('audit', auditRes.rows);
  if (shipRes.ok)  store.set('shipments', shipRes.rows);

  return {
    ok: true,
    counts: {
      scenarios: scenRes.rows.length,
      audit:     auditRes.rows.length,
      shipments: shipRes.rows.length,
    },
  };
}
