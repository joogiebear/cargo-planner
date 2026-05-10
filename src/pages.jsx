import React from 'react';
import { saveCrate, deleteCrate, saveTruck, deleteTruck } from './sync.js';
import { supabaseConfigured } from './supabase.js';
// Shipments, Trucks, Scenarios pages

const { useState: usePgState, useMemo: usePgMemo, useEffect: usePgEffect } = React;

// ---------------------------------------------------------------- SHIPMENTS

const SEED_SHIPMENTS = [
  { id: 'sh-01', ref: 'SHP-2026-0142', name: 'Frieze Pickup', origin: 'f-bk',  destination: 'Park Royal Annex, London',     pickup: '2026-05-21', arrive: '2026-05-24 → 2026-05-26', handler: 'Ines Vidal',     itemIds: ['i-01','i-02','i-03','i-05','i-13'], status: 'planning',   priority: 'high',   value: 3285000, climate: true,  notes: 'Two crates require climate logger. Library of Glass to ride floor only.' },
  { id: 'sh-02', ref: 'SHP-2026-0141', name: 'Whitney Loan Return',          origin: 'f-bk',  destination: 'The Whitney, NYC',                  pickup: '2026-05-12', arrive: '2026-05-12',                handler: 'Hana Koizumi',  itemIds: ['i-04','i-09'],          status: 'ready',      priority: 'normal', value: 54000,   climate: false, notes: '' },
  { id: 'sh-03', ref: 'SHP-2026-0139', name: 'Andersen Studio → LIC',         origin: 'f-bk',  destination: 'LIC Vault (Sect. C-3)',             pickup: '2026-05-09', arrive: '2026-05-09',                handler: 'Hana Koizumi',  itemIds: ['i-12'],                  status: 'in-transit', priority: 'normal', value: 78000,   climate: false, notes: 'Internal transfer.' },
  { id: 'sh-04', ref: 'SHP-2026-0136', name: 'Sarmento → Hauser & Wirth LA',  origin: 'f-bk',  destination: 'Hauser & Wirth, Downtown LA',       pickup: '2026-05-18', arrive: '2026-05-22 → 2026-05-23',  handler: 'Marcus Reilly', itemIds: ['i-11'],                  status: 'draft',      priority: 'normal', value: 215000,  climate: true,  notes: '' },
  { id: 'sh-05', ref: 'SHP-2026-0133', name: 'Spring Salon — Mixed Lots',     origin: 'f-la',  destination: 'Frieze LA, Beverly Hills',          pickup: '2026-05-30', arrive: '2026-05-30',                handler: 'Diego Salgado', itemIds: ['i-06','i-07','i-08','i-14'], status: 'planning', priority: 'high',   value: 82400,   climate: false, notes: 'Lay flat — works on paper.' },
  { id: 'sh-06', ref: 'SHP-2026-0128', name: 'Park Royal Pull — Climate',     origin: 'f-ldn', destination: 'Tate Modern, London',               pickup: '2026-04-30', arrive: '2026-04-30',                handler: 'Fiona Carrick', itemIds: ['i-10'],                  status: 'delivered',  priority: 'normal', value: 0,       climate: true,  notes: '' },
  { id: 'sh-07', ref: 'SHP-2026-0125', name: 'Vernon Climate Audit',          origin: 'f-la',  destination: 'On-site (no transit)',              pickup: '—',          arrive: '—',                          handler: 'Diego Salgado', itemIds: [],                        status: 'draft',      priority: 'low',    value: 0,       climate: false, notes: 'Inventory only.' },
];

const STATUS_META = {
  draft:      { label: 'Draft',      color: 'oklch(0.55 0 0)' },
  planning:   { label: 'Planning',   color: 'oklch(0.55 0.14 80)' },
  ready:      { label: 'Ready',      color: 'oklch(0.55 0.14 200)' },
  'in-transit':{ label: 'In transit', color: 'oklch(0.5 0.16 30)' },
  delivered:  { label: 'Delivered',  color: 'oklch(0.5 0.10 155)' },
};

window.CP_SEED_SHIPMENTS = SEED_SHIPMENTS;
window.ShipmentsPage = function ShipmentsPage({ activeUser } = {}) {
  const data = window.CP_DATA;
  // When Supabase is configured, an empty CP_STORE means "no jobs" — don't
  // surface the demo SEED_SHIPMENTS. The seeds only stand in for local-only
  // dev (no env vars) so the UI isn't blank.
  const initialFallback = supabaseConfigured ? [] : SEED_SHIPMENTS;
  const [ships, setShips] = usePgState(() => window.CP_STORE?.get('shipments') ?? initialFallback);
  usePgEffect(() => window.CP_STORE?.subscribe((k) => {
    if (k === 'shipments' || k === null) setShips(window.CP_STORE.get('shipments') ?? initialFallback);
  }), []);
  usePgEffect(() => { window.CP_STORE?.set('shipments', ships); }, [ships]);
  const [statusFilter, setStatusFilter] = usePgState('all');
  const [facFilter, setFacFilter] = usePgState('all');
  const [q, setQ] = usePgState('');
  const [view, setView] = usePgState('list');
  const [showNew, setShowNew] = usePgState(false);
  const [open, setOpen] = usePgState(null);

  // Visibility scope: admins see everything; everyone else sees only shipments
  // whose origin is one of their assigned facilities.
  const isAdmin = activeUser?.role === 'admin';
  const userFacilityIds = activeUser?.facilities || [];
  const accessibleFacilities = isAdmin
    ? data.facilities
    : data.facilities.filter(f => userFacilityIds.includes(f.id));

  const visibleShips = isAdmin
    ? ships
    : ships.filter(s => userFacilityIds.includes(s.origin));

  const facMap = Object.fromEntries(data.facilities.map(f => [f.id, f]));
  const itemMap = Object.fromEntries(data.items.map(i => [i.id, i]));

  const filtered = visibleShips.filter(s =>
    (statusFilter === 'all' || s.status === statusFilter) &&
    (facFilter === 'all' || s.origin === facFilter) &&
    (!q || `${s.ref} ${s.name} ${s.destination} ${s.handler}`.toLowerCase().includes(q.toLowerCase()))
  );

  const counts = usePgMemo(() => {
    const c = { all: visibleShips.length };
    Object.keys(STATUS_META).forEach(k => { c[k] = visibleShips.filter(s => s.status === k).length; });
    return c;
  }, [visibleShips]);

  return (
    <div className="admin-wrap">
      <div className="admin-head">
        <div>
          <div className="admin-eyebrow">Operations · pipeline</div>
          <h1 className="admin-h1"><em>Jobs</em></h1>
          <div className="admin-sub">Client load-planning jobs. Each job groups the crates being picked up so you can see how many trucks it'll take.</div>
        </div>
        <div className="admin-stats">
          <div><span className="n">{(counts.planning||0) + (counts.draft||0)}</span><span className="l">in planning</span></div>
          <div><span className="n">{counts.ready || 0}</span><span className="l">ready</span></div>
          <div><span className="n">{counts['in-transit'] || 0}</span><span className="l">in transit</span></div>
          <div><span className="n">${(visibleShips.reduce((a,s) => a + (s.value || 0), 0)/1e6).toFixed(1)}M</span><span className="l">declared value</span></div>
        </div>
      </div>

      <div className="admin-toolbar">
        <div className="input">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6"><circle cx="11" cy="11" r="6.5"/><path d="m20 20-3.5-3.5"/></svg>
          <input placeholder="Search jobs…" value={q} onChange={e => setQ(e.target.value)} />
        </div>
        <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
          <div className="seg">
            <button className={view==='list'?'on':''} onClick={() => setView('list')}>List</button>
            <button className={view==='board'?'on':''} onClick={() => setView('board')}>Board</button>
          </div>
          <button className="btn accent" onClick={() => setShowNew(true)}>+ New job</button>
        </div>
      </div>

      <div className="fac-filter-row">
        <span className="fac-filter-label">Status</span>
        <button className={`fac-filter ${statusFilter==='all'?'active':''}`} onClick={() => setStatusFilter('all')}>
          <span className="name">All</span><span className="count">{counts.all}</span>
        </button>
        {Object.entries(STATUS_META).map(([k, m]) => (
          <button key={k} className={`fac-filter ${statusFilter===k?'active':''}`} onClick={() => setStatusFilter(k)}>
            <span className="status-dot" style={{ background: m.color }} />
            <span className="name">{m.label}</span><span className="count">{counts[k] || 0}</span>
          </button>
        ))}
        <span className="fac-filter-label" style={{ marginLeft: 18 }}>Origin</span>
        <button className={`fac-filter ${facFilter==='all'?'active':''}`} onClick={() => setFacFilter('all')}>
          <span className="name">{isAdmin ? 'All facilities' : (accessibleFacilities.length === 1 ? accessibleFacilities[0].name : 'My facilities')}</span>
        </button>
        {accessibleFacilities.length > 1 && accessibleFacilities.map(f => (
          <button key={f.id} className={`fac-filter ${facFilter===f.id?'active':''}`} onClick={() => setFacFilter(f.id)}>
            <span className="code">{f.code}</span>
          </button>
        ))}
      </div>

      {view === 'list' && (
        <table className="admin-table ship-table">
          <thead>
            <tr>
              <th>Ref</th>
              <th>Job</th>
              <th>Origin → Destination</th>
              <th>Pickup</th>
              <th>Crates</th>
              <th>Value</th>
              <th>Handler</th>
              <th>Status</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {filtered.map(s => (
              <tr key={s.id} onClick={() => setOpen(s.id)} className="clickable-row">
                <td className="mono small">{s.ref}</td>
                <td>
                  <div className="u-name">{s.name}</div>
                  {s.priority === 'high' && <span className="prio-pill">Priority</span>}
                  {s.climate && <span className="climate-pill">Climate</span>}
                </td>
                <td>
                  <div className="ship-route">
                    <span className="fac-chip">{facMap[s.origin]?.code}</span>
                    <span className="arrow">→</span>
                    <span className="dest">{s.destination}</span>
                  </div>
                </td>
                <td className="mono small">{s.pickup}</td>
                <td className="mono">{s.itemIds.length}</td>
                <td className="mono small">{s.value > 0 ? `$${s.value.toLocaleString()}` : '—'}</td>
                <td className="small">{s.handler}</td>
                <td><StatusPill status={s.status} /></td>
                <td className="actions"><button className="btn sm ghost" onClick={(e) => { e.stopPropagation(); setOpen(s.id); }}>Open</button></td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {view === 'board' && (
        <div className="ship-board">
          {Object.entries(STATUS_META).map(([k, m]) => (
            <div key={k} className="ship-col">
              <div className="ship-col-head">
                <span className="status-dot" style={{ background: m.color }} />
                <span className="ship-col-title">{m.label}</span>
                <span className="ship-col-count">{filtered.filter(s => s.status === k).length}</span>
              </div>
              <div className="ship-col-body">
                {filtered.filter(s => s.status === k).map(s => (
                  <div key={s.id} className="ship-card" onClick={() => setOpen(s.id)}>
                    <div className="ship-card-ref">{s.ref}</div>
                    <div className="ship-card-name">{s.name}</div>
                    <div className="ship-card-route">
                      <span className="fac-chip">{facMap[s.origin]?.code}</span>
                      <span className="arrow">→</span>
                      <span className="muted small">{s.destination.split(',')[0]}</span>
                    </div>
                    <div className="ship-card-meta">
                      <span>{s.itemIds.length} crates</span>
                      <span className="mono small">{s.pickup}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {open && <ShipmentDetail shipment={ships.find(s => s.id === open)} facMap={facMap} itemMap={itemMap}
        onClose={() => setOpen(null)}
        onUpdate={(s) => setShips(prev => prev.map(x => x.id === s.id ? s : x))}
        onDelete={(id) => { setShips(prev => prev.filter(x => x.id !== id)); setOpen(null); }} />}
      {showNew && <NewShipmentDialog facilities={accessibleFacilities} onClose={() => setShowNew(false)} onCreate={(s) => {
        setShips(prev => [{ ...s, id: 'sh-' + Math.random().toString(36).slice(2,6), ref: 'SHP-2026-' + (200 + prev.length).toString().padStart(4,'0'), itemIds: [], status: 'draft', value: 0 }, ...prev]);
        setShowNew(false);
      }} />}
    </div>
  );
};

function StatusPill({ status }) {
  const m = STATUS_META[status];
  return <span className="status-pill" style={{ '--c': m.color }}><span className="status-dot" style={{ background: m.color }} />{m.label}</span>;
}

function ShipmentDetail({ shipment, facMap, itemMap, onClose, onUpdate, onDelete }) {
  const [showPicker, setShowPicker] = usePgState(false);
  const [confirmRemoveId, setConfirmRemoveId] = usePgState(null);
  const items = shipment.itemIds.map(id => itemMap[id]).filter(Boolean);
  const totalLbs = items.reduce((a,i) => a + i.lbs, 0);
  const totalCft = items.reduce((a,i) => a + (i.L * i.W * i.H) / 1728, 0);

  async function removeCrate(crate) {
    // Drop from this job's manifest first so the UI updates immediately.
    onUpdate({
      ...shipment,
      itemIds: shipment.itemIds.filter(id => id !== crate.id),
      value: shipment.itemIds
        .filter(id => id !== crate.id)
        .reduce((a, id) => a + (itemMap[id]?.value || 0), 0),
    });
    // Clear it from the in-memory items list (so Load Plan stops showing it).
    window.CP_NAV?.removeItem?.(crate.id);
    // Delete the crate row from Supabase. Best-effort; UI already moved on.
    deleteCrate(crate).catch(err => console.error('deleteCrate failed', err));
    setConfirmRemoveId(null);
  }

  return (
    <div className="dialog-mask" onClick={onClose}>
      <div className="dialog dialog-lg" onClick={e => e.stopPropagation()}>
        <div className="dialog-head">
          <div>
            <div className="muted small mono">{shipment.ref}</div>
            <h3 style={{ marginTop: 4 }}><em>{shipment.name}</em></h3>
          </div>
          <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
            <StatusPill status={shipment.status} />
            <button className="icon-btn" onClick={onClose}>×</button>
          </div>
        </div>
        <div className="dialog-body">
          <div className="ship-detail-grid">
            <div className="dt-block"><div className="dt-k">Origin</div><div className="dt-v">{facMap[shipment.origin]?.name}</div></div>
            <div className="dt-block"><div className="dt-k">Destination</div><div className="dt-v">{shipment.destination}</div></div>
            <div className="dt-block"><div className="dt-k">Pickup</div><div className="dt-v mono small">{shipment.pickup}</div></div>
            <div className="dt-block"><div className="dt-k">Arrival window</div><div className="dt-v mono small">{shipment.arrive}</div></div>
            <div className="dt-block"><div className="dt-k">Handler</div><div className="dt-v">{shipment.handler}</div></div>
            <div className="dt-block"><div className="dt-k">Declared value</div><div className="dt-v">${shipment.value.toLocaleString()}</div></div>
          </div>

          <div className="dt-section">
            <div className="dt-section-head" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
              <span>Crates · {items.length} <span className="muted small mono" style={{ marginLeft: 10 }}>{totalLbs.toLocaleString()} lbs · {totalCft.toFixed(0)} ft³</span></span>
              <button className="btn primary sm" onClick={() => setShowPicker(true)}>+ Add crates</button>
            </div>
            {items.length === 0 ? (
              <div className="muted small" style={{ padding: '14px 0' }}>No crates yet — click <strong>Add crates</strong> above to pick from {facMap[shipment.origin]?.name || 'the origin facility'}.</div>
            ) : (
              <table className="admin-table" style={{ marginTop: 8 }}>
                <thead><tr><th>Ref</th><th>Title</th><th>Artist</th><th>Dims</th><th>Lbs</th><th>Flags</th><th style={{ width: 80 }}></th></tr></thead>
                <tbody>
                  {items.map(i => (
                    <tr key={i.id}>
                      <td className="mono small">{i.ref}</td>
                      <td>{i.title}</td>
                      <td className="small muted">{i.artist}</td>
                      <td className="mono small">{i.L}×{i.W}×{i.H}</td>
                      <td className="mono small">{i.lbs}</td>
                      <td>
                        {i.fragile && <span className="flag-chip">FRAG</span>}
                        {i.orient === 'UP' && <span className="flag-chip">↑</span>}
                        {i.flat && <span className="flag-chip">FLAT</span>}
                        {i.glass && <span className="flag-chip">GLASS</span>}
                      </td>
                      <td style={{ textAlign: 'right' }}>
                        {confirmRemoveId === i.id ? (
                          <span style={{ display: 'inline-flex', gap: 4, alignItems: 'center' }}>
                            <button
                              className="btn sm"
                              style={{ color: 'var(--danger)', borderColor: 'var(--danger)' }}
                              onClick={() => removeCrate(i)}
                              title="Confirm delete"
                            >Delete</button>
                            <button className="btn sm ghost" onClick={() => setConfirmRemoveId(null)}>Cancel</button>
                          </span>
                        ) : (
                          <button
                            className="icon-btn"
                            onClick={() => setConfirmRemoveId(i.id)}
                            title="Remove crate from this job"
                            style={{ opacity: 0.5 }}
                            onMouseEnter={e => e.currentTarget.style.opacity = '1'}
                            onMouseLeave={e => e.currentTarget.style.opacity = '0.5'}
                          >×</button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>

          {shipment.notes && (
            <div className="dt-section">
              <div className="dt-section-head"><span>Notes</span></div>
              <div className="dt-notes">{shipment.notes}</div>
            </div>
          )}
        </div>
        <div className="dialog-foot">
          <button className="btn ghost danger" onClick={() => onDelete(shipment.id)}>Delete</button>
          <div style={{ flex: 1 }} />
          <button className="btn" onClick={() => { window.CP_NAV?.openShipmentInPlan(shipment); onClose(); }}>Open in Load Plan</button>
          <button className="btn primary">Print manifest</button>
        </div>
      </div>
      {showPicker && (
        <AddCrateToShipmentDialog
          shipment={shipment}
          itemMap={itemMap}
          facMap={facMap}
          onClose={() => setShowPicker(false)}
          onAddIds={(addedIds) => {
            onUpdate({
              ...shipment,
              itemIds: [...shipment.itemIds, ...addedIds],
              value: shipment.itemIds.concat(addedIds).reduce((a, id) => a + (itemMap[id]?.value || 0), 0),
            });
          }}
        />
      )}
    </div>
  );
}

// ----------------------------------------------------------------------
// AddCrateToShipmentDialog
// Two-mode: (1) create a single crate from scratch, or
// (2) bulk import from CSV with a downloadable template.
// ----------------------------------------------------------------------
function AddCrateToShipmentDialog({ shipment, itemMap, facMap, onClose, onAddIds }) {
  const [mode, setMode] = usePgState('new'); // 'new' | 'csv'
  return (
    <div className="dialog-mask" onClick={onClose}>
      <div className="dialog dialog-lg" onClick={e => e.stopPropagation()}>
        <div className="dialog-head">
          <div>
            <div className="muted small mono">{shipment.ref}</div>
            <h3 style={{ marginTop: 4 }}>Add crates to <em>{shipment.name}</em></h3>
          </div>
          <button className="icon-btn" onClick={onClose}>×</button>
        </div>
        <div style={{ display: 'flex', gap: 0, padding: '0 24px', borderBottom: '1px solid var(--line-soft)' }}>
          <button style={tabStyle(mode === 'new')} onClick={() => setMode('new')}>New crate</button>
          <button style={tabStyle(mode === 'csv')} onClick={() => setMode('csv')}>Import from CSV</button>
        </div>
        {mode === 'new'
          ? <NewCratePane shipment={shipment} facMap={facMap} onClose={onClose} onAddIds={onAddIds} />
          : <CsvImportPane shipment={shipment} facMap={facMap} onClose={onClose} onAddIds={onAddIds} />
        }
      </div>
    </div>
  );
}

function tabStyle(active) {
  return {
    padding: '12px 18px',
    border: 'none',
    background: 'none',
    fontFamily: 'var(--sans)',
    fontSize: 13,
    fontWeight: 500,
    cursor: 'pointer',
    color: active ? 'var(--ink)' : 'var(--subtle)',
    borderBottom: active ? '2px solid var(--accent)' : '2px solid transparent',
    marginBottom: -1,
  };
}

function NewCratePane({ shipment, facMap, onClose, onAddIds }) {
  const homeFacility = window.CP_DATA?.facilities?.find(f => f.id === shipment.origin);
  const [form, setForm] = usePgState({
    ref: 'CRT-' + Math.floor(1000 + Math.random() * 9000),
    title: '', artist: '', year: new Date().getFullYear(), medium: 'PNT',
    L: 48, W: 6, H: 36, lbs: 80, value: 0,
    fragile: true, orient: 'UP', stack: false, flat: false, glass: false,
  });
  const [saving, setSaving] = usePgState(false);
  const [err, setErr] = usePgState('');
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  async function onSave() {
    if (!form.title) { setErr('Title is required'); return; }
    setSaving(true);
    setErr('');
    try {
      const res = await saveCrate({ ...form, _homeFacilityUuid: homeFacility?._uuid || null });
      if (!res.ok) {
        if (res.reason === 'no-config') {
          // Local-only fallback: synthesize a temp crate so the UI moves on
          const id = 'i-local-' + Date.now().toString(36);
          const crate = {
            id, _uuid: null, ref: form.ref, title: form.title, artist: form.artist, year: form.year,
            medium: form.medium, L: form.L, W: form.W, H: form.H, lbs: form.lbs, value: form.value,
            fragile: form.fragile, orient: form.orient, stack: form.stack, flat: form.flat, glass: form.glass,
            homeFacility: shipment.origin, status: 'queued',
          };
          if (window.CP_DATA) window.CP_DATA.items = [...(window.CP_DATA.items || []), crate];
          window.CP_NAV?.appendItem?.(crate);
          onAddIds([id]);
          onClose();
          return;
        }
        setErr(res.error?.message || 'Could not save crate. See console.');
        return;
      }
      // Push into App's Load Plan items list so the user sees it there too.
      window.CP_NAV?.appendItem?.(res.crate);
      onAddIds([res.crate.id]);
      onClose();
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <div className="dialog-body">
        <div className="muted small" style={{ marginBottom: 12 }}>
          Origin facility: <strong>{homeFacility?.name || shipment.origin}</strong>
        </div>
        <div className="grid-2">
          <div className="field"><label>Reference</label><input value={form.ref} onChange={e => set('ref', e.target.value)} /></div>
          <div className="field"><label>Medium</label>
            <select value={form.medium} onChange={e => set('medium', e.target.value)}>
              {Object.entries(window.CP_DATA?.mediumLabel || {PNT:'Painting',SCL:'Sculpture',WRK:'Work on paper',MIX:'Installation',DEC:'Decorative arts',PHT:'Photograph'}).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
          </div>
        </div>
        <div className="grid-2">
          <div className="field"><label>Title *</label><input value={form.title} onChange={e => set('title', e.target.value)} placeholder="Untitled (Marine)" autoFocus /></div>
          <div className="field"><label>Artist</label><input value={form.artist} onChange={e => set('artist', e.target.value)} /></div>
        </div>
        <div className="grid-3">
          <div className="field"><label>Length (in)</label><input type="number" value={form.L} onChange={e => set('L', +e.target.value)} /></div>
          <div className="field"><label>Width (in)</label><input type="number" value={form.W} onChange={e => set('W', +e.target.value)} /></div>
          <div className="field"><label>Height (in)</label><input type="number" value={form.H} onChange={e => set('H', +e.target.value)} /></div>
        </div>
        <div className="grid-3">
          <div className="field"><label>Weight (lbs)</label><input type="number" value={form.lbs} onChange={e => set('lbs', +e.target.value)} /></div>
          <div className="field"><label>Year</label><input type="number" value={form.year} onChange={e => set('year', +e.target.value)} /></div>
          <div className="field"><label>Insured value (USD)</label><input type="number" value={form.value} onChange={e => set('value', +e.target.value)} /></div>
        </div>
        <div className="grid-3" style={{ marginTop: 4 }}>
          <div className="field check"><label><input type="checkbox" checked={form.fragile} onChange={e => set('fragile', e.target.checked)} /> Fragile</label></div>
          <div className="field check"><label><input type="checkbox" checked={form.glass}   onChange={e => set('glass', e.target.checked)} /> Glass / sidewall</label></div>
          <div className="field check"><label><input type="checkbox" checked={form.flat}    onChange={e => set('flat', e.target.checked)} /> Flat / lay flat</label></div>
        </div>
        <div className="grid-3">
          <div className="field check"><label><input type="checkbox" checked={form.stack}   onChange={e => set('stack', e.target.checked)} /> OK to stack on top</label></div>
          <div className="field"><label>Orientation</label>
            <select value={form.orient} onChange={e => set('orient', e.target.value)}>
              <option value="UP">This side up</option>
              <option value="ANY">Any</option>
            </select>
          </div>
        </div>
        {err && <div style={{ color: 'var(--danger)', fontSize: 13, marginTop: 8 }}>{err}</div>}
      </div>
      <div className="dialog-foot">
        <button className="btn" onClick={onClose} disabled={saving}>Cancel</button>
        <div style={{ flex: 1 }} />
        <button className="btn primary" disabled={saving || !form.title} onClick={onSave}>
          {saving ? 'Saving…' : 'Add crate'}
        </button>
      </div>
    </>
  );
}

// ----------------------------------------------------------------------
// CsvImportPane
// Bulk-import crates from a CSV paste (or, in the future, a file upload).
// Provides a "Download template" link so clients can fill it out and send it
// back. Each row is parsed → INSERTed into Supabase via saveCrate → bound
// to the active job's manifest.
// ----------------------------------------------------------------------

const CSV_HEADERS = [
  'title', 'artist', 'year', 'medium',
  'length_in', 'width_in', 'height_in', 'weight_lbs',
  'value_usd', 'fragile', 'glass', 'flat', 'stack', 'orient', 'ref',
];

const CSV_SAMPLE_ROWS = [
  ['Untitled (Marine)',          'Eluardo Reyes',  '1962', 'PNT', '74', '8',  '58', '142', '480000', 'true', 'false', 'false', 'false', 'UP',  ''],
  ['Form III (bronze)',          'M. Andersen',    '1979', 'SCL', '42', '42', '66', '610', '920000', 'true', 'false', 'false', 'false', 'UP',  ''],
  ['Diptych no. 4 (glass)',      'L. Okafor',      '2004', 'PNT', '96', '6',  '72', '215', '165000', 'true', 'true',  'false', 'false', 'UP',  ''],
];

function parseCsv(text) {
  const rows = text.replace(/^﻿/, '').split(/\r?\n/).filter(l => l.trim().length > 0);
  if (rows.length === 0) return { rows: [], errors: ['CSV is empty'] };
  // naive split by comma — handles the common case; quoted commas can be
  // added later with a real parser if anyone needs them.
  const split = (line) => line.split(',').map(c => c.trim());
  const headers = split(rows[0]).map(h => h.toLowerCase());
  const errors = [];
  const out = [];
  for (let i = 1; i < rows.length; i++) {
    const cols = split(rows[i]);
    const r = {};
    headers.forEach((h, j) => { r[h] = cols[j] ?? ''; });
    if (!r.title) { errors.push(`Row ${i + 1}: missing title`); continue; }
    const num = (v, fb = 0) => {
      const n = parseFloat(v);
      return Number.isFinite(n) ? n : fb;
    };
    const bool = (v) => /^(1|true|yes|y)$/i.test(String(v).trim());
    out.push({
      ref: r.ref || ('CRT-' + Math.floor(1000 + Math.random() * 9000)),
      title: r.title,
      artist: r.artist || null,
      year: r.year ? num(r.year, null) : null,
      medium: (r.medium || 'PNT').toUpperCase().slice(0, 3),
      L: num(r.length_in || r.l, 1),
      W: num(r.width_in  || r.w, 1),
      H: num(r.height_in || r.h, 1),
      lbs: num(r.weight_lbs || r.lbs, 1),
      value: num(r.value_usd || r.value, 0),
      fragile: r.fragile === '' ? true : bool(r.fragile),
      glass: bool(r.glass),
      flat: bool(r.flat),
      stack: bool(r.stack),
      orient: (r.orient || 'UP').toUpperCase() === 'ANY' ? 'ANY' : 'UP',
    });
  }
  return { rows: out, errors };
}

function downloadCsvTemplate() {
  const lines = [CSV_HEADERS.join(','), ...CSV_SAMPLE_ROWS.map(r => r.join(','))];
  const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'cargo-planner-template.csv';
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

function CsvImportPane({ shipment, facMap, onClose, onAddIds }) {
  const homeFacility = window.CP_DATA?.facilities?.find(f => f.id === shipment.origin);
  const [text, setText] = usePgState('');
  const [busy, setBusy] = usePgState(false);
  const [report, setReport] = usePgState(null); // { added, failed, errors }

  const preview = usePgMemo(() => parseCsv(text), [text]);

  async function onImport() {
    setBusy(true);
    setReport(null);
    const { rows } = parseCsv(text);
    const addedIds = [];
    const failed = [];
    for (const row of rows) {
      const res = await saveCrate({ ...row, _homeFacilityUuid: homeFacility?._uuid || null });
      if (res.ok) {
        addedIds.push(res.crate.id);
        window.CP_NAV?.appendItem?.(res.crate);
      } else if (res.reason === 'no-config') {
        const id = 'i-local-' + Date.now().toString(36) + '-' + addedIds.length;
        const crate = { ...row, id, _uuid: null, homeFacility: shipment.origin, status: 'queued' };
        if (window.CP_DATA) window.CP_DATA.items = [...(window.CP_DATA.items || []), crate];
        window.CP_NAV?.appendItem?.(crate);
        addedIds.push(id);
      } else {
        failed.push({ title: row.title, error: res.error?.message || 'Save failed' });
      }
    }
    if (addedIds.length) onAddIds(addedIds);
    setReport({ added: addedIds.length, failed: failed.length, errors: failed });
    setBusy(false);
    if (failed.length === 0) {
      // small delay so user sees the success line, then close
      setTimeout(() => onClose(), 700);
    }
  }

  return (
    <>
      <div className="dialog-body">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
          <div className="muted small">
            Paste rows from a spreadsheet (or send the template to a client and paste their reply).
          </div>
          <button className="btn sm" onClick={downloadCsvTemplate}>↓ Download template</button>
        </div>
        <textarea
          rows={10}
          value={text}
          onChange={e => setText(e.target.value)}
          placeholder={'title,artist,year,medium,length_in,width_in,height_in,weight_lbs,value_usd,fragile,glass,flat,stack,orient,ref\nUntitled (Marine),Eluardo Reyes,1962,PNT,74,8,58,142,480000,true,false,false,false,UP,\n…'}
          style={{ width: '100%', padding: '10px 12px', fontFamily: 'var(--mono)', fontSize: 12, border: '1px solid var(--line)', borderRadius: 6, background: 'var(--panel-2)', color: 'var(--ink)', resize: 'vertical' }}
        />
        <div className="muted small" style={{ marginTop: 8 }}>
          {text.trim()
            ? <>Will create <strong>{preview.rows.length}</strong> crate{preview.rows.length === 1 ? '' : 's'}{preview.errors.length > 0 ? ` · ${preview.errors.length} parsing issue${preview.errors.length === 1 ? '' : 's'}` : ''}</>
            : 'Headers (first row) are required: title is mandatory; everything else has sensible defaults.'}
        </div>
        {preview.errors.length > 0 && (
          <ul className="muted small" style={{ marginTop: 6, paddingLeft: 18 }}>
            {preview.errors.slice(0, 5).map((e, i) => <li key={i}>{e}</li>)}
            {preview.errors.length > 5 && <li>…and {preview.errors.length - 5} more</li>}
          </ul>
        )}
        {report && (
          <div style={{ marginTop: 12, padding: 10, borderLeft: `3px solid var(--${report.failed ? 'warn' : 'good'})`, background: 'var(--panel-2)', fontSize: 13 }}>
            Imported <strong>{report.added}</strong> crate{report.added === 1 ? '' : 's'}.
            {report.failed > 0 && <> {report.failed} failed:</>}
            {report.errors.slice(0, 3).map((e, i) => <div key={i} className="muted small">· {e.title}: {e.error}</div>)}
          </div>
        )}
      </div>
      <div className="dialog-foot">
        <button className="btn" onClick={onClose} disabled={busy}>Cancel</button>
        <div style={{ flex: 1 }} />
        <button className="btn primary" disabled={busy || preview.rows.length === 0} onClick={onImport}>
          {busy ? `Importing… (${report?.added || 0})` : `Import ${preview.rows.length || ''} crate${preview.rows.length === 1 ? '' : 's'}`}
        </button>
      </div>
    </>
  );
}

function NewShipmentDialog({ facilities, onClose, onCreate }) {
  const [form, setForm] = usePgState({ name: '', origin: facilities[0]?.id, destination: '', pickup: '', arrive: '', handler: '', priority: 'normal', climate: false, notes: '' });
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));
  return (
    <div className="dialog-mask" onClick={onClose}>
      <div className="dialog" onClick={e => e.stopPropagation()}>
        <div className="dialog-head"><h3>New <em>job</em></h3><button className="icon-btn" onClick={onClose}>×</button></div>
        <div className="dialog-body">
          <div className="field"><label>Job name</label><input value={form.name} onChange={e => set('name', e.target.value)} placeholder="e.g. Smith pickup — Tuesday" /></div>
          <div className="grid-2">
            <div className="field"><label>Origin facility</label>
              <select value={form.origin} onChange={e => set('origin', e.target.value)}>
                {facilities.map(f => <option key={f.id} value={f.id}>{f.name}</option>)}
              </select>
            </div>
            <div className="field"><label>Destination</label><input value={form.destination} onChange={e => set('destination', e.target.value)} placeholder="Address or facility" /></div>
          </div>
          <div className="grid-2">
            <div className="field"><label>Pickup date</label><input type="date" value={form.pickup} onChange={e => set('pickup', e.target.value)} /></div>
            <div className="field"><label>Arrival window</label><input value={form.arrive} onChange={e => set('arrive', e.target.value)} placeholder="2026-05-24 → 2026-05-26" /></div>
          </div>
          <div className="grid-2">
            <div className="field"><label>Handler</label><input value={form.handler} onChange={e => set('handler', e.target.value)} placeholder="Assigned coordinator" /></div>
            <div className="field"><label>Priority</label>
              <select value={form.priority} onChange={e => set('priority', e.target.value)}>
                <option value="low">Low</option><option value="normal">Normal</option><option value="high">High</option>
              </select>
            </div>
          </div>
          <div className="field"><label><input type="checkbox" checked={form.climate} onChange={e => set('climate', e.target.checked)} /> Requires climate control</label></div>
          <div className="field"><label>Notes</label><textarea rows="3" value={form.notes} onChange={e => set('notes', e.target.value)} /></div>
        </div>
        <div className="dialog-foot">
          <button className="btn" onClick={onClose}>Cancel</button>
          <button className="btn primary" disabled={!form.name || !form.destination} onClick={() => onCreate(form)}>Create draft</button>
        </div>
      </div>
    </div>
  );
}

// ------------------------------------------------------------------- TRUCKS

window.TrucksPage = function TrucksPage({ activeUser } = {}) {
  // Live snapshots of the global data — refresh when 'cp-data-changed' fires.
  const [trucks, setTrucksLocal] = usePgState(() => window.CP_DATA?.trucks || []);
  const [facilities, setFacilities] = usePgState(() => window.CP_DATA?.facilities || []);
  usePgEffect(() => {
    const handler = () => {
      setTrucksLocal(window.CP_DATA?.trucks || []);
      setFacilities(window.CP_DATA?.facilities || []);
    };
    window.addEventListener('cp-data-changed', handler);
    return () => window.removeEventListener('cp-data-changed', handler);
  }, []);
  const data = { trucks, facilities };

  // Visibility scope: admin sees everything; everyone else sees only trucks at their facilities.
  const isAdmin = activeUser?.role === 'admin';
  const userFacilityIds = activeUser?.facilities || [];
  const accessibleFacilities = isAdmin ? facilities : facilities.filter(f => userFacilityIds.includes(f.id));
  const visibleTrucks = isAdmin ? trucks : trucks.filter(t => userFacilityIds.includes(t.facility));

  const [facFilter, setFacFilter] = usePgState('all');
  const [q, setQ] = usePgState('');
  const [editing, setEditing] = usePgState(null);
  const [showNew, setShowNew] = usePgState(false);
  const [busyMsg, setBusyMsg] = usePgState('');

  const facMap = Object.fromEntries(facilities.map(f => [f.id, f]));
  const filtered = visibleTrucks.filter(t =>
    (facFilter === 'all' || t.facility === facFilter) &&
    (!q || `${t.ref} ${t.model} ${t.type}`.toLowerCase().includes(q.toLowerCase()))
  );

  const totalCft = (t) => ((t.L * t.W * t.H) / 1728).toFixed(0);
  const totalCap = visibleTrucks.reduce((a, t) => a + t.maxLbs, 0);

  return (
    <div className="admin-wrap">
      <div className="admin-head">
        <div>
          <div className="admin-eyebrow">Fleet · capacity</div>
          <h1 className="admin-h1"><em>Trucks</em></h1>
          <div className="admin-sub">Vehicles available for load planning, by facility. Specs feed the packer's volume and weight checks.</div>
        </div>
        <div className="admin-stats">
          <div><span className="n">{trucks.length}</span><span className="l">vehicles</span></div>
          <div><span className="n">{(totalCap / 1000).toFixed(0)}k</span><span className="l">lbs total cap</span></div>
          <div><span className="n">{trucks.reduce((a,t) => a + +totalCft(t), 0).toLocaleString()}</span><span className="l">ft³ total</span></div>
          <div><span className="n">{data.facilities.length}</span><span className="l">facilities</span></div>
        </div>
      </div>

      <div className="admin-toolbar">
        <div className="input">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6"><circle cx="11" cy="11" r="6.5"/><path d="m20 20-3.5-3.5"/></svg>
          <input placeholder="Search by ref or model…" value={q} onChange={e => setQ(e.target.value)} />
        </div>
        <button className="btn accent" onClick={() => setShowNew(true)}>+ Add truck</button>
      </div>

      <div className="fac-filter-row">
        <span className="fac-filter-label">Facility</span>
        <button className={`fac-filter ${facFilter==='all'?'active':''}`} onClick={() => setFacFilter('all')}>
          <span className="name">All</span><span className="count">{trucks.length}</span>
        </button>
        {data.facilities.map(f => (
          <button key={f.id} className={`fac-filter ${facFilter===f.id?'active':''}`} onClick={() => setFacFilter(f.id)}>
            <span className="code">{f.code}</span>
            <span className="name">{f.name}</span>
            <span className="count">{trucks.filter(t => t.facility === f.id).length}</span>
          </button>
        ))}
      </div>

      <div className="truck-grid">
        {filtered.map(t => (
          <div key={t.id} className="truck-card" onClick={() => setEditing(t)}>
            <div className="truck-card-head">
              <div>
                <div className="truck-ref">{t.ref}</div>
                <div className="truck-model">{t.model}</div>
              </div>
              <span className="fac-chip">{facMap[t.facility]?.code}</span>
            </div>
            <div className="truck-svg"><TruckSilhouette type={t.type} /></div>
            <div className="truck-specs">
              <div><span className="k">Type</span><span className="v">{t.type}</span></div>
              <div><span className="k">Interior</span><span className="v mono">{t.L}″ × {t.W}″ × {t.H}″</span></div>
              <div><span className="k">Volume</span><span className="v mono">{totalCft(t)} ft³</span></div>
              <div><span className="k">Max load</span><span className="v mono">{t.maxLbs.toLocaleString()} lbs</span></div>
              <div><span className="k">Axles</span><span className="v mono">{t.axles}</span></div>
            </div>
          </div>
        ))}
      </div>

      {editing && <TruckDialog truck={editing} facilities={accessibleFacilities} onClose={() => setEditing(null)}
        onSave={async (t) => {
          setBusyMsg('Saving truck…');
          const res = await saveTruck({ ...t, _uuid: editing._uuid });
          setBusyMsg('');
          if (res.ok) setEditing(null);
          else alert(res.error?.message || 'Could not save truck.');
        }}
        onDelete={async (id) => {
          if (!confirm('Delete this truck? It must not be assigned to any saved scenario.')) return;
          setBusyMsg('Deleting…');
          const res = await deleteTruck(editing);
          setBusyMsg('');
          if (res.ok) setEditing(null);
          else alert(res.error?.message || 'Could not delete truck (it may be in a saved scenario).');
        }} />}
      {showNew && <TruckDialog truck={null} facilities={accessibleFacilities} onClose={() => setShowNew(false)}
        onSave={async (t) => {
          setBusyMsg('Saving truck…');
          const res = await saveTruck(t);
          setBusyMsg('');
          if (res.ok) setShowNew(false);
          else alert(res.error?.message || 'Could not save truck.');
        }} />}
      {busyMsg && <div style={{ position: 'fixed', bottom: 16, right: 16, padding: '8px 14px', background: 'var(--ink)', color: 'var(--bg)', borderRadius: 4, fontSize: 13, zIndex: 200 }}>{busyMsg}</div>}
    </div>
  );
};

function TruckSilhouette({ type }) {
  const isVan = type.includes('Sprinter');
  const isTrailer = type.includes('53') || type.includes('Trailer');
  if (isVan) {
    return (
      <svg viewBox="0 0 240 60" width="100%" height="60">
        <rect x="14" y="8" width="180" height="44" rx="3" fill="none" stroke="currentColor" strokeWidth="1" />
        <rect x="195" y="14" width="32" height="32" rx="2" fill="none" stroke="currentColor" strokeWidth="1" />
        <line x1="194" y1="30" x2="227" y2="30" stroke="currentColor" strokeWidth="0.5" strokeDasharray="2 2" opacity="0.4"/>
        <circle cx="40" cy="56" r="3" fill="currentColor" opacity="0.4"/>
        <circle cx="170" cy="56" r="3" fill="currentColor" opacity="0.4"/>
      </svg>
    );
  }
  if (isTrailer) {
    return (
      <svg viewBox="0 0 240 60" width="100%" height="60">
        <rect x="6" y="10" width="170" height="40" rx="2" fill="none" stroke="currentColor" strokeWidth="1" />
        <rect x="178" y="14" width="40" height="34" rx="2" fill="none" stroke="currentColor" strokeWidth="1" />
        <rect x="218" y="20" width="14" height="22" rx="1" fill="none" stroke="currentColor" strokeWidth="1" />
        <circle cx="30" cy="54" r="3" fill="currentColor" opacity="0.4"/>
        <circle cx="50" cy="54" r="3" fill="currentColor" opacity="0.4"/>
        <circle cx="140" cy="54" r="3" fill="currentColor" opacity="0.4"/>
        <circle cx="160" cy="54" r="3" fill="currentColor" opacity="0.4"/>
        <circle cx="200" cy="54" r="3" fill="currentColor" opacity="0.4"/>
      </svg>
    );
  }
  return (
    <svg viewBox="0 0 240 60" width="100%" height="60">
      <rect x="10" y="10" width="160" height="40" rx="2" fill="none" stroke="currentColor" strokeWidth="1" />
      <rect x="172" y="14" width="40" height="32" rx="2" fill="none" stroke="currentColor" strokeWidth="1" />
      <circle cx="40" cy="54" r="3" fill="currentColor" opacity="0.4"/>
      <circle cx="140" cy="54" r="3" fill="currentColor" opacity="0.4"/>
      <circle cx="190" cy="54" r="3" fill="currentColor" opacity="0.4"/>
    </svg>
  );
}

window.CP_TruckDialog = TruckDialog;
function TruckDialog({ truck, facilities, onClose, onSave, onDelete }) {
  const [form, setForm] = usePgState(truck || { ref: '', model: '', type: 'Sprinter Van', facility: facilities[0]?.id, L: 170, W: 70, H: 79, maxLbs: 4500, axles: 2 });
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));
  const isNew = !truck;
  return (
    <div className="dialog-mask" onClick={onClose}>
      <div className="dialog" onClick={e => e.stopPropagation()}>
        <div className="dialog-head"><h3>{isNew ? 'Add' : 'Edit'} <em>truck</em></h3><button className="icon-btn" onClick={onClose}>×</button></div>
        <div className="dialog-body">
          <div className="grid-2">
            <div className="field"><label>Ref</label><input value={form.ref} onChange={e => set('ref', e.target.value)} placeholder="BK-04" /></div>
            <div className="field"><label>Facility</label>
              <select value={form.facility} onChange={e => set('facility', e.target.value)}>
                {facilities.map(f => <option key={f.id} value={f.id}>{f.name}</option>)}
              </select>
            </div>
          </div>
          <div className="grid-2">
            <div className="field"><label>Model</label><input value={form.model} onChange={e => set('model', e.target.value)} placeholder="Sprinter 3500" /></div>
            <div className="field"><label>Type</label>
              <select value={form.type} onChange={e => set('type', e.target.value)}>
                <option>Sprinter Van</option><option>24′ Box</option><option>26′ Box</option><option>53′ Trailer</option><option>24′ Box (EU)</option>
              </select>
            </div>
          </div>
          <div className="field">
            <label>Interior dimensions (inches)</label>
            <div className="dim-row">
              <div><span className="dim-l">L</span><input type="number" value={form.L} onChange={e => set('L', +e.target.value)} /></div>
              <div><span className="dim-l">W</span><input type="number" value={form.W} onChange={e => set('W', +e.target.value)} /></div>
              <div><span className="dim-l">H</span><input type="number" value={form.H} onChange={e => set('H', +e.target.value)} /></div>
              <div className="dim-cft">{((form.L * form.W * form.H) / 1728).toFixed(0)} ft³</div>
            </div>
          </div>
          <div className="grid-2">
            <div className="field"><label>Max load (lbs)</label><input type="number" value={form.maxLbs} onChange={e => set('maxLbs', +e.target.value)} /></div>
            <div className="field"><label>Axles</label><input type="number" value={form.axles} onChange={e => set('axles', +e.target.value)} /></div>
          </div>
        </div>
        <div className="dialog-foot">
          {!isNew && <button className="btn ghost danger" onClick={() => onDelete(truck.id)}>Delete</button>}
          <div style={{ flex: 1 }} />
          <button className="btn" onClick={onClose}>Cancel</button>
          <button className="btn primary" disabled={!form.ref || !form.model} onClick={() => onSave(form)}>{isNew ? 'Add truck' : 'Save'}</button>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------- SCENARIOS

const SEED_SCENARIOS = [
  { id: 'sn-01', name: 'Frieze Pickup — BK→LDN',          facility: 'f-bk',  shipmentRef: 'SHP-2026-0142', trucks: 2, crates: 5, util: 64, weight: 41, status: 'active',   updated: '2026-05-09', author: 'Ines Vidal' },
  { id: 'sn-02', name: 'Frieze Pickup — BK→LDN (2-truck)', facility: 'f-bk', shipmentRef: 'SHP-2026-0142', trucks: 2, crates: 5, util: 58, weight: 38, status: 'archived', updated: '2026-05-08', author: 'Ines Vidal' },
  { id: 'sn-03', name: 'Frieze Pickup — single 53′',       facility: 'f-bk', shipmentRef: 'SHP-2026-0142', trucks: 1, crates: 5, util: 31, weight: 22, status: 'archived', updated: '2026-05-07', author: 'Marcus Reilly' },
  { id: 'sn-04', name: 'Whitney Loan Return',              facility: 'f-bk', shipmentRef: 'SHP-2026-0141', trucks: 1, crates: 2, util: 14, weight: 5,  status: 'active',   updated: '2026-05-08', author: 'Hana Koizumi' },
  { id: 'sn-05', name: 'Spring Salon — Mixed Lots',        facility: 'f-la', shipmentRef: 'SHP-2026-0133', trucks: 1, crates: 4, util: 22, weight: 4,  status: 'draft',    updated: '2026-05-06', author: 'Diego Salgado' },
  { id: 'sn-06', name: 'Sarmento → Hauser & Wirth',        facility: 'f-bk', shipmentRef: 'SHP-2026-0136', trucks: 1, crates: 1, util: 12, weight: 3,  status: 'draft',    updated: '2026-05-04', author: 'Marcus Reilly' },
];

window.CP_SEED_SCENARIOS = SEED_SCENARIOS;
window.ScenariosPage = function ScenariosPage() {
  const data = window.CP_DATA;
  const scenFallback = supabaseConfigured ? [] : SEED_SCENARIOS;
  const [scens, setScens] = usePgState(() => window.CP_STORE?.get('scenarios') ?? scenFallback);
  usePgEffect(() => window.CP_STORE?.subscribe((k) => {
    if (k === 'scenarios' || k === null) setScens(window.CP_STORE.get('scenarios') ?? scenFallback);
  }), []);
  usePgEffect(() => { window.CP_STORE?.set('scenarios', scens); }, [scens]);
  const [facFilter, setFacFilter] = usePgState('all');
  const [q, setQ] = usePgState('');
  const [compare, setCompare] = usePgState([]);
  const [showCompare, setShowCompare] = usePgState(false);

  const facMap = Object.fromEntries(data.facilities.map(f => [f.id, f]));
  const filtered = scens.filter(s =>
    (facFilter === 'all' || s.facility === facFilter) &&
    (!q || s.name.toLowerCase().includes(q.toLowerCase()))
  );

  const toggleCompare = (id) => setCompare(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id].slice(-3));

  const grouped = usePgMemo(() => {
    const m = {};
    filtered.forEach(s => {
      m[s.shipmentRef] = m[s.shipmentRef] || [];
      m[s.shipmentRef].push(s);
    });
    return m;
  }, [filtered]);

  return (
    <div className="admin-wrap">
      <div className="admin-head">
        <div>
          <div className="admin-eyebrow">Planning · saved plans</div>
          <h1 className="admin-h1"><em>Scenarios</em></h1>
          <div className="admin-sub">Saved load plans — alternate truck combinations and packing strategies for each job. Pick up to three to compare side-by-side.</div>
        </div>
        <div className="admin-stats">
          <div><span className="n">{scens.filter(s => s.status==='active').length}</span><span className="l">active</span></div>
          <div><span className="n">{scens.filter(s => s.status==='draft').length}</span><span className="l">drafts</span></div>
          <div><span className="n">{Object.keys(grouped).length}</span><span className="l">jobs</span></div>
          <div><span className="n">{compare.length}/3</span><span className="l">compare</span></div>
        </div>
      </div>

      <div className="admin-toolbar">
        <div className="input">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6"><circle cx="11" cy="11" r="6.5"/><path d="m20 20-3.5-3.5"/></svg>
          <input placeholder="Search scenarios…" value={q} onChange={e => setQ(e.target.value)} />
        </div>
        <div style={{ display: 'flex', gap: 6 }}>
          {compare.length > 0 && <button className="btn" onClick={() => setCompare([])}>Clear compare ({compare.length})</button>}
          {compare.length >= 2 && <button className="btn accent" onClick={() => setShowCompare(true)}>Compare {compare.length} →</button>}
        </div>
      </div>

      <div className="fac-filter-row">
        <span className="fac-filter-label">Facility</span>
        <button className={`fac-filter ${facFilter==='all'?'active':''}`} onClick={() => setFacFilter('all')}>
          <span className="name">All</span><span className="count">{scens.length}</span>
        </button>
        {data.facilities.map(f => (
          <button key={f.id} className={`fac-filter ${facFilter===f.id?'active':''}`} onClick={() => setFacFilter(f.id)}>
            <span className="code">{f.code}</span>
            <span className="count">{scens.filter(s => s.facility === f.id).length}</span>
          </button>
        ))}
      </div>

      {showCompare && (
        <CompareDialog
          scens={compare.map(id => scens.find(s => s.id === id)).filter(Boolean)}
          facMap={facMap}
          itemMap={Object.fromEntries((window.CP_DATA?.items || []).map(i => [i.id, i]))}
          truckMap={Object.fromEntries((window.CP_DATA?.trucks || []).map(t => [t.id, t]))}
          onClose={() => setShowCompare(false)}
        />
      )}

      {Object.entries(grouped).map(([ref, list]) => (
        <div key={ref} className="scen-group">
          <div className="scen-group-head">
            <span className="mono small muted">{ref}</span>
            <span className="muted small">{list.length} {list.length === 1 ? 'scenario' : 'scenarios'}</span>
          </div>
          <div className="scen-grid">
            {list.map(s => (
              <div key={s.id} className={`scen-card ${compare.includes(s.id) ? 'compared' : ''}`}>
                <div className="scen-thumb">
                  <svg viewBox="0 0 200 80" preserveAspectRatio="none">
                    <defs>
                      <pattern id={`gp-${s.id}`} width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(30)">
                        <line x1="0" y1="0" x2="0" y2="6" stroke="currentColor" strokeWidth="0.4" opacity="0.18" />
                      </pattern>
                    </defs>
                    <rect width="200" height="80" fill={`url(#gp-${s.id})`} />
                    {Array.from({ length: s.trucks }).map((_, i) => {
                      const gap = 6;
                      const totalW = 200 - 24;
                      const w = (totalW - gap * (s.trucks - 1)) / s.trucks;
                      const x = 12 + i * (w + gap);
                      const fill = (s.util / 100) * 0.95;
                      return (
                        <g key={i}>
                          <rect x={x} y={18} width={w} height={50} fill="none" stroke="currentColor" strokeWidth="0.8" opacity="0.55" rx="1.5" />
                          <rect x={x + 1} y={18 + 50 - 50 * fill + 1} width={w - 2} height={50 * fill - 2} fill="var(--accent)" opacity={0.85} rx="0.5" />
                          <text x={x + w/2} y={76} fontSize="6" textAnchor="middle" fill="currentColor" opacity="0.5" fontFamily="var(--mono)">{Math.round(s.util)}%</text>
                        </g>
                      );
                    })}
                    <line x1="0" y1="68.5" x2="200" y2="68.5" stroke="currentColor" strokeWidth="0.5" opacity="0.3" />
                  </svg>
                </div>
                <div className="scen-head">
                  <label className="scen-check"><input type="checkbox" checked={compare.includes(s.id)} onChange={() => toggleCompare(s.id)} /></label>
                  <div className="scen-name">{s.name}</div>
                  <span className={`scen-status s-${s.status}`}>{s.status}</span>
                </div>
                <div className="scen-meters">
                  <div className="scen-meter">
                    <div className="ml"><span>Volume</span><span className="mono">{s.util}%</span></div>
                    <div className="mb"><span style={{ width: s.util + '%' }} /></div>
                  </div>
                  <div className="scen-meter">
                    <div className="ml"><span>Weight</span><span className="mono">{s.weight}%</span></div>
                    <div className="mb"><span style={{ width: s.weight + '%' }} /></div>
                  </div>
                </div>
                <div className="scen-meta">
                  <div><span className="k">Trucks</span><span className="v mono">{s.trucks}</span></div>
                  <div><span className="k">Crates</span><span className="v mono">{s.crates}</span></div>
                  <div><span className="k">Facility</span><span className="v">{facMap[s.facility]?.code}</span></div>
                </div>
                <div className="scen-foot">
                  <span className="muted small">{s.author} · {s.updated}</span>
                  <div style={{ display:'flex', gap: 4 }}>
                    <button className="btn sm ghost" onClick={() => window.CP_NAV?.openScenarioInPlan(s)}>Open</button>
                    <button className="btn sm ghost">Duplicate</button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
};

function CompareDialog({ scens, facMap, itemMap, truckMap, onClose }) {
  // Build per-scenario truck → crate-ids map (snapshot if available)
  const cols = scens.map(s => {
    const trucks = s.snapshot?.trucks || [];
    const assignments = s.snapshot?.assignments || [];
    const byTruck = {};
    assignments.forEach(a => {
      if (!byTruck[a.truckId]) byTruck[a.truckId] = [];
      byTruck[a.truckId].push(a.id);
    });
    return { s, trucks, byTruck, allCrates: assignments.map(a => a.id) };
  });

  // Diff: union of all crate IDs across scenarios; for each, show which truck (or —) per scenario.
  const allCrateIds = Array.from(new Set(cols.flatMap(c => c.allCrates))).sort();
  const haveSnapshots = cols.every(c => c.allCrates.length > 0);

  const truckLabel = (col, tid) => {
    const t = col.trucks.find(x => x.id === tid) || truckMap[tid];
    return t?.ref || tid?.slice(-4) || '—';
  };

  const movedCount = (() => {
    if (cols.length < 2 || !haveSnapshots) return 0;
    return allCrateIds.filter(id => {
      const slots = cols.map(c => {
        const found = Object.entries(c.byTruck).find(([, ids]) => ids.includes(id));
        return found ? found[0] : null;
      });
      const set = new Set(slots);
      return set.size > 1;
    }).length;
  })();

  return (
    <div className="dialog-mask" onClick={onClose}>
      <div className="dialog wide" onClick={e => e.stopPropagation()} style={{ maxWidth: 1100 }}>
        <div className="dialog-head">
          <h3>Compare <em>scenarios</em></h3>
          <button className="icon-btn" onClick={onClose}>×</button>
        </div>
        <div className="dialog-body" style={{ maxHeight: '70vh', overflow: 'auto' }}>
          <div className="cmp-grid" style={{ gridTemplateColumns: `180px repeat(${cols.length}, 1fr)` }}>
            <div className="cmp-row cmp-head">
              <div className="cmp-k">Scenario</div>
              {cols.map(c => (
                <div key={c.s.id} className="cmp-cell cmp-title">
                  <div className="cmp-name">{c.s.name}</div>
                  <div className="muted small">{c.s.shipmentRef} · {facMap[c.s.facility]?.code}</div>
                </div>
              ))}
            </div>
            {[
              ['Status',  c => <span className={`scen-status s-${c.s.status}`}>{c.s.status}</span>],
              ['Trucks',  c => <span className="mono">{c.s.trucks}</span>],
              ['Crates',  c => <span className="mono">{c.s.crates}</span>],
              ['Volume',  c => <span className="mono">{c.s.util}%</span>],
              ['Weight',  c => <span className="mono">{c.s.weight}%</span>],
              ['Updated', c => <span className="muted">{c.s.updated}</span>],
              ['Author',  c => <span className="muted">{c.s.author}</span>],
            ].map(([k, fn]) => (
              <div key={k} className="cmp-row">
                <div className="cmp-k">{k}</div>
                {cols.map(c => <div key={c.s.id} className="cmp-cell">{fn(c)}</div>)}
              </div>
            ))}
          </div>

          {haveSnapshots ? (
            <>
              <div className="cmp-section-head">
                <h4><em>Crate placement</em></h4>
                <span className="muted small">{movedCount} crate{movedCount===1?'':'s'} differ between scenarios</span>
              </div>
              <div className="cmp-grid" style={{ gridTemplateColumns: `180px repeat(${cols.length}, 1fr)` }}>
                <div className="cmp-row cmp-subhead">
                  <div className="cmp-k">Crate</div>
                  {cols.map(c => <div key={c.s.id} className="cmp-cell muted small">Truck</div>)}
                </div>
                {allCrateIds.map(id => {
                  const item = itemMap[id];
                  const slots = cols.map(c => {
                    const found = Object.entries(c.byTruck).find(([, ids]) => ids.includes(id));
                    return found ? found[0] : null;
                  });
                  const differs = new Set(slots).size > 1;
                  return (
                    <div key={id} className={`cmp-row ${differs ? 'cmp-diff' : ''}`}>
                      <div className="cmp-k">
                        <div className="mono small muted">{id}</div>
                        {item && <div className="cmp-crate-name">{item.title}</div>}
                      </div>
                      {cols.map((c, i) => (
                        <div key={c.s.id} className="cmp-cell">
                          {slots[i] ? <span className="cmp-truck-pill">{truckLabel(c, slots[i])}</span> : <span className="muted">—</span>}
                        </div>
                      ))}
                    </div>
                  );
                })}
              </div>
            </>
          ) : (
            <div className="cmp-empty">
              <div className="muted small">Crate-level placement diff is only available for scenarios saved from the Load Plan view. Seed scenarios show summary metrics only.</div>
            </div>
          )}
        </div>
        <div className="dialog-foot">
          <div style={{ flex: 1 }} />
          <button className="btn" onClick={onClose}>Close</button>
        </div>
      </div>
    </div>
  );
}

Object.assign(window, { ShipmentsPage: window.ShipmentsPage, TrucksPage: window.TrucksPage, ScenariosPage: window.ScenariosPage });
