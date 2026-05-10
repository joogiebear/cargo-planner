/* global React */
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
window.ShipmentsPage = function ShipmentsPage() {
  const data = window.CP_DATA;
  const [ships, setShips] = usePgState(() => (window.CP_STORE?.get('shipments', SEED_SHIPMENTS)) || SEED_SHIPMENTS);
  usePgEffect(() => window.CP_STORE?.subscribe((k) => {
    if (k === 'shipments' || k === null) setShips(window.CP_STORE.get('shipments', SEED_SHIPMENTS));
  }), []);
  usePgEffect(() => { window.CP_STORE?.set('shipments', ships); }, [ships]);
  const [statusFilter, setStatusFilter] = usePgState('all');
  const [facFilter, setFacFilter] = usePgState('all');
  const [q, setQ] = usePgState('');
  const [view, setView] = usePgState('list');
  const [showNew, setShowNew] = usePgState(false);
  const [open, setOpen] = usePgState(null);

  const facMap = Object.fromEntries(data.facilities.map(f => [f.id, f]));
  const itemMap = Object.fromEntries(data.items.map(i => [i.id, i]));

  const filtered = ships.filter(s =>
    (statusFilter === 'all' || s.status === statusFilter) &&
    (facFilter === 'all' || s.origin === facFilter) &&
    (!q || `${s.ref} ${s.name} ${s.destination} ${s.handler}`.toLowerCase().includes(q.toLowerCase()))
  );

  const counts = usePgMemo(() => {
    const c = { all: ships.length };
    Object.keys(STATUS_META).forEach(k => { c[k] = ships.filter(s => s.status === k).length; });
    return c;
  }, [ships]);

  return (
    <div className="admin-wrap">
      <div className="admin-head">
        <div>
          <div className="admin-eyebrow">Operations · pipeline</div>
          <h1 className="admin-h1"><em>Shipments</em></h1>
          <div className="admin-sub">Pickups and deliveries across the network. Each shipment groups crates that move together.</div>
        </div>
        <div className="admin-stats">
          <div><span className="n">{(counts.planning||0) + (counts.draft||0)}</span><span className="l">in planning</span></div>
          <div><span className="n">{counts.ready || 0}</span><span className="l">ready</span></div>
          <div><span className="n">{counts['in-transit'] || 0}</span><span className="l">in transit</span></div>
          <div><span className="n">${(ships.reduce((a,s) => a + s.value, 0)/1e6).toFixed(1)}M</span><span className="l">declared value</span></div>
        </div>
      </div>

      <div className="admin-toolbar">
        <div className="input">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6"><circle cx="11" cy="11" r="6.5"/><path d="m20 20-3.5-3.5"/></svg>
          <input placeholder="Search shipments…" value={q} onChange={e => setQ(e.target.value)} />
        </div>
        <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
          <div className="seg">
            <button className={view==='list'?'on':''} onClick={() => setView('list')}>List</button>
            <button className={view==='board'?'on':''} onClick={() => setView('board')}>Board</button>
          </div>
          <button className="btn accent" onClick={() => setShowNew(true)}>+ New shipment</button>
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
          <span className="name">All facilities</span>
        </button>
        {data.facilities.map(f => (
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
              <th>Shipment</th>
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
      {showNew && <NewShipmentDialog facilities={data.facilities} onClose={() => setShowNew(false)} onCreate={(s) => {
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
  const items = shipment.itemIds.map(id => itemMap[id]).filter(Boolean);
  const totalLbs = items.reduce((a,i) => a + i.lbs, 0);
  const totalCft = items.reduce((a,i) => a + (i.L * i.W * i.H) / 1728, 0);

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
            <div className="dt-section-head">
              <span>Crates · {items.length}</span>
              <span className="muted small mono">{totalLbs.toLocaleString()} lbs &middot; {totalCft.toFixed(0)} ft³</span>
            </div>
            {items.length === 0 ? (
              <div className="muted small" style={{ padding: '14px 0' }}>No crates yet — add from the manifest in Load Plan.</div>
            ) : (
              <table className="admin-table" style={{ marginTop: 8 }}>
                <thead><tr><th>Ref</th><th>Title</th><th>Artist</th><th>Dims</th><th>Lbs</th><th>Flags</th></tr></thead>
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
    </div>
  );
}

function NewShipmentDialog({ facilities, onClose, onCreate }) {
  const [form, setForm] = usePgState({ name: '', origin: facilities[0]?.id, destination: '', pickup: '', arrive: '', handler: '', priority: 'normal', climate: false, notes: '' });
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));
  return (
    <div className="dialog-mask" onClick={onClose}>
      <div className="dialog" onClick={e => e.stopPropagation()}>
        <div className="dialog-head"><h3>New <em>shipment</em></h3><button className="icon-btn" onClick={onClose}>×</button></div>
        <div className="dialog-body">
          <div className="field"><label>Shipment name</label><input value={form.name} onChange={e => set('name', e.target.value)} placeholder="e.g. Frieze Pickup" /></div>
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

window.TrucksPage = function TrucksPage() {
  const data = window.CP_DATA;
  const [trucks, setTrucks] = usePgState(data.trucks);
  const [facFilter, setFacFilter] = usePgState('all');
  const [q, setQ] = usePgState('');
  const [editing, setEditing] = usePgState(null);
  const [showNew, setShowNew] = usePgState(false);

  const facMap = Object.fromEntries(data.facilities.map(f => [f.id, f]));
  const filtered = trucks.filter(t =>
    (facFilter === 'all' || t.facility === facFilter) &&
    (!q || `${t.ref} ${t.model} ${t.type}`.toLowerCase().includes(q.toLowerCase()))
  );

  const totalCft = (t) => ((t.L * t.W * t.H) / 1728).toFixed(0);
  const totalCap = trucks.reduce((a, t) => a + t.maxLbs, 0);

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

      {editing && <TruckDialog truck={editing} facilities={data.facilities} onClose={() => setEditing(null)}
        onSave={(t) => { setTrucks(prev => prev.map(x => x.id === t.id ? t : x)); setEditing(null); }}
        onDelete={(id) => { setTrucks(prev => prev.filter(x => x.id !== id)); setEditing(null); }} />}
      {showNew && <TruckDialog truck={null} facilities={data.facilities} onClose={() => setShowNew(false)}
        onSave={(t) => { setTrucks(prev => [...prev, { ...t, id: 't-' + Math.random().toString(36).slice(2,6) }]); setShowNew(false); }} />}
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
  const [scens, setScens] = usePgState(() => (window.CP_STORE?.get('scenarios', SEED_SCENARIOS)) || SEED_SCENARIOS);
  usePgEffect(() => window.CP_STORE?.subscribe((k) => {
    if (k === 'scenarios' || k === null) setScens(window.CP_STORE.get('scenarios', SEED_SCENARIOS));
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
          <div className="admin-sub">Saved load plans — alternate truck combinations and packing strategies for each shipment. Pick up to three to compare side-by-side.</div>
        </div>
        <div className="admin-stats">
          <div><span className="n">{scens.filter(s => s.status==='active').length}</span><span className="l">active</span></div>
          <div><span className="n">{scens.filter(s => s.status==='draft').length}</span><span className="l">drafts</span></div>
          <div><span className="n">{Object.keys(grouped).length}</span><span className="l">shipments</span></div>
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
