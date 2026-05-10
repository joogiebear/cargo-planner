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

// -- global data-change notification -----------------------------------
// Components listening to window.addEventListener('cp-data-changed', ...)
// can refresh themselves whenever a CRUD here mutates window.CP_DATA / CP_USERS.
function notifyDataChanged(key) {
  window.dispatchEvent(new CustomEvent('cp-data-changed', { detail: { key } }));
}

// -- facilities --------------------------------------------------------

export async function saveFacility(form) {
  if (!supabaseConfigured) return { ok: false, reason: 'no-config' };

  const row = {
    code: (form.code || '').trim().toUpperCase().slice(0, 8),
    name: (form.name || '').trim(),
    city: form.city || null,
    address: form.address || null,
    archived: false,
  };

  let data, error;
  if (form._uuid) {
    ({ data, error } = await supabase.from('facilities').update(row).eq('id', form._uuid)
      .select('id, legacy_id, code, name, city, address').single());
  } else {
    row.legacy_id = 'f-' + Math.random().toString(36).slice(2, 7);
    ({ data, error } = await supabase.from('facilities').insert(row)
      .select('id, legacy_id, code, name, city, address').single());
  }
  if (error) {
    console.error('[supabase] saveFacility failed', error);
    return { ok: false, error };
  }
  const facility = {
    id: data.legacy_id,
    _uuid: data.id,
    code: data.code,
    name: data.name,
    city: data.city,
    address: data.address,
    users: 0,
    trucks: 0,
  };
  if (window.CP_DATA) {
    const list = window.CP_DATA.facilities || [];
    const idx = list.findIndex(f => f._uuid === facility._uuid);
    window.CP_DATA.facilities = idx >= 0
      ? list.map((f, i) => i === idx ? { ...f, ...facility } : f)
      : [...list, facility];
  }
  notifyDataChanged('facilities');
  return { ok: true, facility };
}

export async function deleteFacility(facility) {
  if (window.CP_DATA?.facilities) {
    window.CP_DATA.facilities = window.CP_DATA.facilities.filter(f => f.id !== facility.id);
  }
  if (!supabaseConfigured || !facility._uuid) {
    notifyDataChanged('facilities');
    return { ok: true, localOnly: true };
  }
  const { error } = await supabase.from('facilities').delete().eq('id', facility._uuid);
  if (error) {
    console.error('[supabase] deleteFacility failed', error);
    return { ok: false, error };
  }
  notifyDataChanged('facilities');
  return { ok: true };
}

// -- trucks ------------------------------------------------------------

// Wraps a Supabase promise with a hard timeout so a stalled connection
// doesn't leave the UI stuck on "Saving…" forever.
function withTimeout(promise, ms = 12000, label = 'request') {
  return Promise.race([
    promise,
    new Promise((_, reject) => setTimeout(
      () => reject(new Error(`${label} timed out after ${ms / 1000}s — check Supabase status / network.`)),
      ms,
    )),
  ]);
}

export async function saveTruck(form) {
  console.log('[saveTruck] called', form);
  if (!supabaseConfigured) return { ok: false, reason: 'no-config' };
  const facUuid = window.CP_DATA?.facilities?.find(f => f.id === form.facility)?._uuid;
  if (!facUuid) {
    console.warn('[saveTruck] facility lookup failed', { wantedLegacyId: form.facility, facilities: window.CP_DATA?.facilities });
    return { ok: false, error: { message: `Facility "${form.facility}" not found in local data — try refreshing.` } };
  }

  const row = {
    facility_id: facUuid,
    ref: (form.ref || '').trim(),
    model: (form.model || '').trim(),
    type: form.type || 'Sprinter',
    length_in: +form.L || 1,
    width_in:  +form.W || 1,
    height_in: +form.H || 1,
    max_lbs:   +form.maxLbs || 1,
    axles:     +form.axles || 2,
    out_of_service: false,
  };
  console.log('[saveTruck] inserting row', row);

  let data, error;
  try {
    if (form._uuid) {
      const res = await withTimeout(
        supabase.from('trucks').update(row).eq('id', form._uuid)
          .select('id, legacy_id, facility_id, ref, model, type, length_in, width_in, height_in, max_lbs, axles').single(),
        12000, 'truck UPDATE',
      );
      data = res.data; error = res.error;
    } else {
      row.legacy_id = 't-' + Math.random().toString(36).slice(2, 7);
      const res = await withTimeout(
        supabase.from('trucks').insert(row)
          .select('id, legacy_id, facility_id, ref, model, type, length_in, width_in, height_in, max_lbs, axles').single(),
        12000, 'truck INSERT',
      );
      data = res.data; error = res.error;
    }
  } catch (e) {
    console.error('[saveTruck] threw', e);
    return { ok: false, error: { message: e.message || 'Network error' } };
  }
  console.log('[saveTruck] response', { data, error });
  if (error) {
    console.error('[supabase] saveTruck failed', error);
    return { ok: false, error };
  }
  const truck = {
    id: data.legacy_id,
    _uuid: data.id,
    facility: form.facility,
    ref: data.ref,
    model: data.model,
    type: data.type,
    L: data.length_in,
    W: data.width_in,
    H: data.height_in,
    maxLbs: data.max_lbs,
    axles: data.axles,
  };
  if (window.CP_DATA) {
    const list = window.CP_DATA.trucks || [];
    const idx = list.findIndex(t => t._uuid === truck._uuid);
    window.CP_DATA.trucks = idx >= 0
      ? list.map((t, i) => i === idx ? { ...t, ...truck } : t)
      : [...list, truck];
  }
  notifyDataChanged('trucks');
  return { ok: true, truck };
}

export async function deleteTruck(truck) {
  if (window.CP_DATA?.trucks) {
    window.CP_DATA.trucks = window.CP_DATA.trucks.filter(t => t.id !== truck.id);
  }
  if (!supabaseConfigured || !truck._uuid) {
    notifyDataChanged('trucks');
    return { ok: true, localOnly: true };
  }
  const { error } = await supabase.from('trucks').delete().eq('id', truck._uuid);
  if (error) {
    console.error('[supabase] deleteTruck failed', error);
    return { ok: false, error };
  }
  notifyDataChanged('trucks');
  return { ok: true };
}

// -- app users + facility access ---------------------------------------

export async function saveAppUser(form) {
  if (!supabaseConfigured) return { ok: false, reason: 'no-config' };

  const row = {
    name:   (form.name  || '').trim(),
    email:  (form.email || '').trim().toLowerCase(),
    role:   form.role   || 'planner',
    status: form.status || 'invited',
    invited_at: new Date().toISOString(),
  };

  let saved, error;
  if (form._uuid) {
    ({ data: saved, error } = await supabase.from('users').update(row).eq('id', form._uuid)
      .select('id, legacy_id, name, email, role, status, invited_at').single());
  } else {
    row.legacy_id = 'u-' + Math.random().toString(36).slice(2, 7);
    ({ data: saved, error } = await supabase.from('users').insert(row)
      .select('id, legacy_id, name, email, role, status, invited_at').single());
  }
  if (error) {
    console.error('[supabase] saveAppUser failed', error);
    return { ok: false, error };
  }

  // Replace facility access in one shot.
  await supabase.from('user_facility_access').delete().eq('user_id', saved.id);
  if ((form.facilities || []).length > 0) {
    const facUuids = (form.facilities || [])
      .map(legacyId => window.CP_DATA?.facilities?.find(f => f.id === legacyId)?._uuid)
      .filter(Boolean);
    if (facUuids.length > 0) {
      await supabase.from('user_facility_access').insert(
        facUuids.map(facility_id => ({ user_id: saved.id, facility_id }))
      );
    }
  }

  const user = {
    _uuid: saved.id,
    id: saved.legacy_id,
    name: saved.name,
    email: saved.email,
    role: saved.role,
    status: saved.status,
    facilities: form.facilities || [],
    invitedAt: (saved.invited_at || '').slice(0, 10),
  };

  const list = window.CP_USERS || [];
  const idx = list.findIndex(u => u._uuid === user._uuid);
  window.CP_USERS = idx >= 0
    ? list.map((u, i) => i === idx ? user : u)
    : [...list, user];

  notifyDataChanged('users');
  return { ok: true, user };
}

export async function deleteAppUser(user) {
  if (window.CP_USERS) {
    window.CP_USERS = window.CP_USERS.filter(u => u.id !== user.id);
  }
  if (!supabaseConfigured || !user._uuid) {
    notifyDataChanged('users');
    return { ok: true, localOnly: true };
  }
  const { error } = await supabase.from('users').delete().eq('id', user._uuid);
  if (error) {
    console.error('[supabase] deleteAppUser failed', error);
    return { ok: false, error };
  }
  notifyDataChanged('users');
  return { ok: true };
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
