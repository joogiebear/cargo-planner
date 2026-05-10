// Phase 3b — read/write of scenarios + audit log against Supabase.
// All UUID ↔ legacy_id translation lives in this module so components
// can keep dealing with the prototype's string-id shape.

import { supabase, supabaseConfigured } from './supabase.js';

// -- helpers -----------------------------------------------------------

function legacyToUuid(collection, legacyId) {
  if (!legacyId || !collection) return null;
  const hit = collection.find(x => x.id === legacyId);
  return hit?._uuid || null;
}

function uuidToLegacy(collection, uuid) {
  if (!uuid || !collection) return null;
  const hit = collection.find(x => x._uuid === uuid);
  return hit?.id || null;
}

// -- crates ------------------------------------------------------------

// Insert a brand-new crate into the crates table. Returns the saved row in
// prototype shape (with both id (legacy-style) and _uuid). Caller is
// responsible for updating window.CP_DATA.items + any shipment manifest.
export async function saveCrate(form) {
  if (!supabaseConfigured) {
    return { ok: false, reason: 'no-config' };
  }
  const row = {
    legacy_id: 'i-local-' + Date.now().toString(36),
    ref: form.ref || ('CRT-' + Math.floor(1000 + Math.random() * 9000)),
    title: form.title || 'Untitled',
    artist: form.artist || null,
    year: form.year || null,
    medium: form.medium || 'PNT',
    length_in: form.L || 1,
    width_in:  form.W || 1,
    height_in: form.H || 1,
    weight_lbs: form.lbs || 1,
    value_cents: Math.round((form.value || 0) * 100),
    fragile: !!form.fragile,
    orient:  form.orient || 'UP',
    stack:   !!form.stack,
    flat:    !!form.flat,
    glass:   !!form.glass,
    home_facility_id: form._homeFacilityUuid || null,
  };

  const { data, error } = await supabase
    .from('crates')
    .insert(row)
    .select('id, legacy_id, ref, title, artist, year, medium, length_in, width_in, height_in, weight_lbs, value_cents, fragile, orient, stack, flat, glass, home_facility_id')
    .single();

  if (error) {
    console.error('[supabase] saveCrate failed', error);
    return { ok: false, error };
  }

  const homeFacility = uuidToLegacy(window.CP_DATA?.facilities || [], data.home_facility_id);

  // Convert back to prototype shape (matching loadData.js mapping)
  const crate = {
    id: data.legacy_id,
    _uuid: data.id,
    ref: data.ref,
    title: data.title,
    artist: data.artist,
    year: data.year,
    medium: data.medium,
    L: data.length_in,
    W: data.width_in,
    H: data.height_in,
    lbs: data.weight_lbs,
    value: Number(data.value_cents) / 100,
    fragile: data.fragile,
    orient: data.orient,
    stack: data.stack,
    flat: data.flat,
    glass: data.glass,
    homeFacility,
    status: 'queued',
  };

  // Patch into the live window.CP_DATA.items so the rest of the app sees it.
  if (window.CP_DATA) {
    window.CP_DATA.items = [...(window.CP_DATA.items || []), crate];
  }

  return { ok: true, crate };
}

// Delete a crate from Supabase, given its prototype-shape record (with _uuid).
// Also strips it from window.CP_DATA.items so the rest of the app sees it gone.
// If the crate has no _uuid (e.g., local-only mode), just does the local cleanup.
export async function deleteCrate(crate) {
  // Local cleanup first — this is what the UI cares about.
  if (window.CP_DATA?.items) {
    window.CP_DATA.items = window.CP_DATA.items.filter(i => i.id !== crate.id);
  }

  if (!supabaseConfigured || !crate._uuid) {
    return { ok: true, localOnly: true };
  }

  const { error } = await supabase.from('crates').delete().eq('id', crate._uuid);
  if (error) {
    console.error('[supabase] deleteCrate failed', error);
    return { ok: false, error };
  }
  return { ok: true };
}

// -- audit log ---------------------------------------------------------

const AUDIT_KIND_DEFAULT = 'edit';

export async function appendAuditRow(entry, actorUuid) {
  if (!supabaseConfigured) return { ok: false, reason: 'no-config' };
  const row = {
    actor_user_id: actorUuid || null,
    kind: entry.kind || AUDIT_KIND_DEFAULT,
    action: entry.action || '',
    target: entry.target || null,
    entity_type: entry.entity_type || null,
    entity_id: entry.entity_id || null,
    meta: entry.meta || null,
  };
  const { error } = await supabase.from('audit_log').insert(row);
  if (error) {
    console.error('[supabase] audit insert failed', error);
    return { ok: false, error };
  }
  return { ok: true };
}

export async function loadRecentAudit(limit = 200) {
  if (!supabaseConfigured) return { ok: false, rows: [] };

  const { data, error } = await supabase
    .from('audit_log')
    .select('id, t, actor_user_id, kind, action, target, entity_type, entity_id, meta')
    .order('t', { ascending: false })
    .limit(limit);

  if (error) {
    console.error('[supabase] audit load failed', error);
    return { ok: false, rows: [] };
  }

  const users = window.CP_USERS || [];
  const rows = data.map(r => ({
    t: r.t,
    who: users.find(u => u._uuid === r.actor_user_id)?.name || 'Unknown',
    kind: r.kind,
    action: r.action,
    target: r.target,
  }));
  return { ok: true, rows };
}

// -- scenarios ---------------------------------------------------------

// Convert a prototype scenario (the shape app.jsx builds) to the RPC payload.
function toScenarioPayload(scen, actorUuid) {
  const data = window.CP_DATA || {};
  const trucks = data.trucks || [];
  const items  = data.items  || [];

  // legacy → uuid for the truck fleet of this scenario
  const truckPayload = (scen.snapshot?.trucks || []).map(legacyId => ({
    truck_id: legacyToUuid(trucks, legacyId),
  })).filter(t => t.truck_id);

  // legacy → uuid for each per-crate assignment
  const assignmentPayload = (scen.snapshot?.assignments || []).map((a, idx) => ({
    crate_id: legacyToUuid(items,  a.id),
    truck_id: legacyToUuid(trucks, a.truckId),
    position: null,
    seq: idx,
  })).filter(a => a.crate_id && a.truck_id);

  return {
    id: scen._uuid || null,                 // existing → upsert; new → server generates
    name: scen.name,
    facility_id: legacyToUuid(data.facilities || [], scen.facility),
    shipment_id: null,                      // Phase 3c migrates shipments
    status: scen.status === 'archived' ? 'archived'
          : scen.status === 'draft'    ? 'draft'
          : 'active',
    author_user_id: actorUuid || null,
    summary: {
      trucks: scen.trucks,
      crates: scen.crates,
      util:   scen.util,
      weight: scen.weight,
      shipmentRef: scen.shipmentRef || null,
      author: scen.author || null,          // display name; the FK above is the source of truth
    },
    trucks: truckPayload,
    assignments: assignmentPayload,
  };
}

export async function saveScenario(scen, actorUuid) {
  if (!supabaseConfigured) {
    return { ok: false, reason: 'no-config', scenario: scen };
  }
  const payload = toScenarioPayload(scen, actorUuid);
  const { data, error } = await supabase.rpc('save_scenario', { payload });
  if (error) {
    console.error('[supabase] save_scenario failed', error);
    return { ok: false, error, scenario: scen };
  }
  // RPC returns { id: '...' }
  const newUuid = data?.id;
  return {
    ok: true,
    scenario: { ...scen, _uuid: newUuid, id: scen.id || ('sn-' + newUuid.slice(0, 8)) },
  };
}

export async function loadScenarios() {
  if (!supabaseConfigured) return { ok: false, rows: [] };

  const [scenRes, stRes, saRes] = await Promise.all([
    supabase.from('scenarios')
      .select('id, name, facility_id, shipment_id, status, author_user_id, summary, updated_at')
      .order('updated_at', { ascending: false }),
    supabase.from('scenario_trucks').select('scenario_id, truck_id'),
    supabase.from('scenario_assignments').select('scenario_id, crate_id, truck_id, seq')
      .order('seq', { ascending: true }),
  ]);

  const errs = [scenRes, stRes, saRes].map(r => r.error).filter(Boolean);
  if (errs.length) {
    console.error('[supabase] scenario load failed', errs);
    return { ok: false, rows: [] };
  }

  const data = window.CP_DATA || {};
  const facilities = data.facilities || [];
  const trucks     = data.trucks     || [];
  const items      = data.items      || [];
  const users      = window.CP_USERS || [];

  // group children by scenario uuid
  const trucksByScen = {};
  for (const r of stRes.data) {
    (trucksByScen[r.scenario_id] ||= []).push(uuidToLegacy(trucks, r.truck_id));
  }
  const assignByScen = {};
  for (const r of saRes.data) {
    (assignByScen[r.scenario_id] ||= []).push({
      id: uuidToLegacy(items, r.crate_id),
      truckId: uuidToLegacy(trucks, r.truck_id),
    });
  }

  const rows = scenRes.data.map(s => {
    const summary = s.summary || {};
    const author = users.find(u => u._uuid === s.author_user_id)?.name
                || summary.author
                || 'Unknown';
    return {
      _uuid: s.id,
      id: 'sn-' + s.id.slice(0, 8),                  // legacy-style id for the UI
      name: s.name,
      facility: uuidToLegacy(facilities, s.facility_id),
      shipmentRef: summary.shipmentRef || '—',
      trucks: summary.trucks ?? (trucksByScen[s.id]?.length || 0),
      crates: summary.crates ?? (assignByScen[s.id]?.length || 0),
      util:   summary.util   ?? 0,
      weight: summary.weight ?? 0,
      status: s.status,
      updated: (s.updated_at || '').slice(0, 10),
      author,
      snapshot: {
        trucks: (trucksByScen[s.id] || []).filter(Boolean),
        assignments: (assignByScen[s.id] || []).filter(a => a.id && a.truckId),
      },
    };
  });

  return { ok: true, rows };
}
