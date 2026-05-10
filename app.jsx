/* global React, ReactDOM, packTruck, CP_Scene, CP_DATA, useTweaks, TweaksPanel, TweakSection, TweakRadio, TweakToggle, TweakColor, TweakSelect */
const { useState, useEffect, useMemo, useRef } = React;

const TWEAK_DEFAULTS = /*EDITMODE-BEGIN*/{
  "theme": "light",
  "view": "iso",
  "density": "balanced",
  "fragileTop": true,
  "stackLimits": true,
  "weightBalance": true,
  "showLabels": true,
  "accent": "#b75a32"
}/*EDITMODE-END*/;

// ---- Icons (minimal stroke set) ----
const I = {
  search:  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6"><circle cx="11" cy="11" r="6.5"/><path d="m20 20-3.5-3.5"/></svg>,
  plus:    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6"><path d="M12 5v14M5 12h14"/></svg>,
  paste:   <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6"><rect x="7" y="4" width="10" height="4" rx="1"/><path d="M7 6H5v14h14V6h-2"/></svg>,
  optimize:<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6"><path d="M3 12h4l3-7 4 14 3-7h4"/></svg>,
  print:   <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6"><rect x="6" y="3" width="12" height="6" rx="1"/><rect x="4" y="9" width="16" height="9" rx="2"/><rect x="7" y="14" width="10" height="6" rx="1"/></svg>,
  save:    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6"><path d="M5 5v14h14V8l-3-3H5z"/><path d="M9 5v4h6"/></svg>,
  sun:     <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6"><circle cx="12" cy="12" r="4"/><path d="M12 3v2M12 19v2M3 12h2M19 12h2M5.6 5.6l1.4 1.4M17 17l1.4 1.4M5.6 18.4 7 17M17 7l1.4-1.4"/></svg>,
  moon:    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6"><path d="M20 14.5A8 8 0 1 1 9.5 4a7 7 0 0 0 10.5 10.5z"/></svg>,
  caret:   <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="m6 9 6 6 6-6"/></svg>,
  close:   <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6"><path d="M6 6l12 12M18 6 6 18"/></svg>,
  bell:    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6"><path d="M6 16V11a6 6 0 0 1 12 0v5l1.5 2H4.5L6 16z"/><path d="M10 20a2 2 0 0 0 4 0"/></svg>,
  cmd:     <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6"><path d="M9 3a3 3 0 1 0 0 6h6a3 3 0 1 0 0-6 3 3 0 0 0-3 3v12a3 3 0 0 1-3 3 3 3 0 0 1 0-6h6a3 3 0 0 1 3 3 3 3 0 0 1-6 0"/></svg>,
  list:    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6"><path d="M4 6h16M4 12h16M4 18h10"/></svg>,
  fit:     <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6"><rect x="3" y="7" width="18" height="10" rx="1"/><path d="M8 7v10M14 7v10"/></svg>,
  truck:   <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6"><rect x="2" y="7" width="12" height="9" rx="1"/><path d="M14 10h4l3 3v3h-7z"/><circle cx="7" cy="18" r="1.6"/><circle cx="17" cy="18" r="1.6"/></svg>,
};

// ---- Format helpers ----
const fmt = {
  lbs: n => `${n.toLocaleString()} lbs`,
  ft:  inches => `${Math.floor(inches/12)}′${inches%12 ? ` ${inches%12}″` : ''}`,
  cuft: cui => `${(cui/1728).toFixed(0)} ft³`,
  pct: f => `${(f*100).toFixed(0)}%`,
  shortDims: i => `${i.L}″ × ${i.W}″ × ${i.H}″`,
};

// ---- App ----
// ---- localStorage persistence ----
const CP_STORE = (() => {
  const KEY = 'cp_v1';
  let state = (() => { try { return JSON.parse(localStorage.getItem(KEY)) || {}; } catch { return {}; } })();
  const listeners = new Set();
  const save = () => { try { localStorage.setItem(KEY, JSON.stringify(state)); } catch {} };
  return {
    get: (k, fallback) => (k in state ? state[k] : fallback),
    set: (k, v) => { state[k] = v; save(); listeners.forEach(fn => fn(k, v)); },
    subscribe: (fn) => { listeners.add(fn); return () => listeners.delete(fn); },
    reset: () => { state = {}; save(); listeners.forEach(fn => fn(null, null)); },
    appendAudit: (entry) => {
      const log = state['audit'] || [];
      const next = [{ ...entry, t: new Date().toISOString() }, ...log].slice(0, 200);
      state['audit'] = next; save();
      listeners.forEach(fn => fn('audit', next));
    },
  };
})();
window.CP_STORE = CP_STORE;

function usePersist(key, defaultValue) {
  const [v, setV] = useState(() => {
    const stored = CP_STORE.get(key, undefined);
    return stored === undefined ? (typeof defaultValue === 'function' ? defaultValue() : defaultValue) : stored;
  });
  useEffect(() => { CP_STORE.set(key, v); }, [key, v]);
  return [v, setV];
}

function App() {
  const { useRef } = React;
  const [t, setTweak] = useTweaks(TWEAK_DEFAULTS);
  const [page, setPage] = useState('plan');
  const [toast, setToast] = useState(null);
  useEffect(() => { if (!toast) return; const id = setTimeout(() => setToast(null), 2200); return () => clearTimeout(id); }, [toast]);
  const [activeShipment, setActiveShipment] = useState(null); // shipment object
  const [activeScenarioId, setActiveScenarioId] = useState(null);

  useEffect(() => {
    window.CP_NAV = {
      openShipmentInPlan: (s) => { setActiveShipment(s); setPage('plan'); },
      openScenarioInPlan: (sn) => {
        setActiveScenarioId(sn.id);
        setPage('plan');
        if (sn.snapshot) {
          if (sn.snapshot.trucks) setScenarioTrucks(sn.snapshot.trucks);
          if (sn.snapshot.assignments) {
            const map = Object.fromEntries(sn.snapshot.assignments.map(a => [a.id, a.truckId]));
            setItems(prev => prev.map(i => i.id in map ? { ...i, truckId: map[i.id], status: map[i.id] ? 'loaded' : 'queued' } : i));
          }
          if (sn.facility) setFacilityId(sn.facility);
        }
        setToast('Scenario loaded');
      },
      setPage,
    };
  }, []);

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', t.theme);
    document.documentElement.style.setProperty('--accent', t.accent || 'oklch(0.52 0.13 38)');
  }, [t.theme, t.accent]);

  const data = window.CP_DATA;
  const allUsers = window.CP_USERS || [];
  const [activeUserId, setActiveUserId] = usePersist('activeUserId', 'u-02');
  const activeUser = allUsers.find(u => u.id === activeUserId) || allUsers[0];
  const userFacilities = activeUser?.role === 'admin'
    ? data.facilities
    : data.facilities.filter(f => activeUser?.facilities?.includes(f.id));
  const canEditPlans = window.CP_CAN_EDIT?.(activeUser?.role, 'plans');
  const canEditManifest = window.CP_CAN_EDIT?.(activeUser?.role, 'manifest');
  const [facilityId, setFacilityId] = usePersist('facilityId', userFacilities[0]?.id || 'f-bk');
  React.useEffect(() => {
    if (!userFacilities.find(f => f.id === facilityId)) setFacilityId(userFacilities[0]?.id);
  }, [activeUserId]);
  const [facMenu, setFacMenu] = useState(false);
  const facility = data.facilities.find(f => f.id === facilityId);

  // Trucks for this scenario (start with two trucks)
  const facilityTrucks = data.trucks.filter(tk => tk.facility === facilityId);
  const [scenarioTrucks, setScenarioTrucks] = usePersist('scenarioTrucks', () => facilityTrucks.slice(0, 2).map(tk => tk.id));
  const [activeTruck, setActiveTruck] = useState(scenarioTrucks[0]);

  useEffect(() => {
    const ts = data.trucks.filter(tk => tk.facility === facilityId).slice(0, 2).map(tk => tk.id);
    setScenarioTrucks(ts);
    setActiveTruck(ts[0]);
  }, [facilityId]);

  // Items list — assignment by truckId or 'queued'/'excluded'
  // Pre-assign a starting load so the viz shows something on first paint
  const [items, setItems] = usePersist('items', () => {
    const facilityTrucksList = data.trucks.filter(tk => tk.facility === 'f-bk').slice(0, 2);
    const t1 = facilityTrucksList[0]?.id;
    const t2 = facilityTrucksList[1]?.id;
    const preload = {
      'i-04': t1, 'i-06': t1, 'i-07': t1, 'i-08': t1, 'i-14': t1, 'i-09': t1, 'i-10': t1,
      'i-01': t2, 'i-03': t2, 'i-11': t2, 'i-13': t2, 'i-12': t2,
    };
    return data.items.map(i => ({
      ...i,
      truckId: preload[i.id] || null,
      status: preload[i.id] ? 'loaded' : 'queued',
    }));
  });
  const [showAdd, setShowAdd] = useState(false);
  const [showPaste, setShowPaste] = useState(false);
  const [optimizing, setOptimizing] = useState(false);
  const [optStage, setOptStage] = useState(0);
  const [dropAnim, setDropAnim] = useState(false);
  const [fitResult, setFitResult] = useState(null);
  const [showLoadOrder, setShowLoadOrder] = useState(false);
  const [dragOverTruck, setDragOverTruck] = useState(null);
  const [dragOverManifest, setDragOverManifest] = useState(false);

  // Constraints
  const constraints = {
    fragileTop: t.fragileTop,
    stackLimits: t.stackLimits,
    weightBalance: t.weightBalance,
  };

  // Pack each truck
  const packed = useMemo(() => {
    const out = {};
    for (const tid of scenarioTrucks) {
      const tk = data.trucks.find(x => x.id === tid);
      const truckItems = items.filter(i => i.truckId === tid);
      const result = packTruck(tk, truckItems, { fragileTop: constraints.fragileTop });
      out[tid] = { truck: tk, ...result };
    }
    return out;
  }, [scenarioTrucks, items, constraints.fragileTop]);

  const truck = data.trucks.find(x => x.id === activeTruck);
  const activePacked = packed[activeTruck] || { placed: [], unplaced: [] };

  // Utilization
  const util = useMemo(() => computeUtil(truck, activePacked), [truck, activePacked]);

  // Will-it-fit: take ALL items in this scenario, allocate across the facility's fleet,
  // adding more trucks as needed. Greedy First-Fit-Decreasing by volume; verifies each
  // candidate truck with the real packer before committing.
  const runFit = () => {
    const allItems = items.filter(i => i.status !== 'excluded');
    const fleet = data.trucks.filter(tk => tk.facility === facilityId);
    // sort items largest-first
    const queue = [...allItems].sort((a, b) => (b.L * b.W * b.H) - (a.L * a.W * a.H));
    // try to keep using the smaller trucks unless an item won't fit
    const fleetBySize = [...fleet].sort((a, b) => (a.L * a.W * a.H) - (b.L * b.W * b.H));
    const trucks = []; // [{ tk, items[] }]
    const overflow = [];
    for (const it of queue) {
      let placed = false;
      // try each existing truck
      for (const t of trucks) {
        const trial = packTruck(t.tk, [...t.items, it], { fragileTop: t.fragileTop });
        if (trial.unplaced.length === 0) {
          t.items.push(it);
          placed = true;
          break;
        }
      }
      if (placed) continue;
      // open a new truck — pick smallest that can fit this single item
      const next = fleetBySize.find(tk => {
        const trial = packTruck(tk, [it], { fragileTop: true });
        return trial.unplaced.length === 0;
      }) || fleetBySize[fleetBySize.length - 1];
      if (next) {
        const trial = packTruck(next, [it], { fragileTop: true });
        if (trial.unplaced.length === 0) {
          trucks.push({ tk: next, items: [it] });
        } else {
          overflow.push(it);
        }
      } else {
        overflow.push(it);
      }
    }
    // compute utilization per truck
    const summary = trucks.map((t, idx) => {
      const packed = packTruck(t.tk, t.items, { fragileTop: true });
      const u = computeUtil(t.tk, packed);
      return {
        idx: idx + 1,
        tk: t.tk,
        items: t.items,
        placed: packed.placed,
        util: u,
      };
    });
    setFitResult({ summary, overflow, totalItems: allItems.length });
  };

  // Generate a step-by-step load plan for the active truck.
  // Order: floor crates first (heaviest, non-stackable, largest), then climbing layers.
  const loadOrder = useMemo(() => {
    const placed = activePacked.placed;
    if (!placed.length) return [];
    const sorted = [...placed].sort((a, b) => {
      if (a.y !== b.y) return a.y - b.y; // bottom first
      if (a.x !== b.x) return b.x - a.x; // load deepest (high X = far end / cab) first, last on first off
      return a.z - b.z;
    });
    return sorted.map((p, i) => {
      const zSide = p.z < truck.W * 0.33 ? 'driver-side' : p.z > truck.W * 0.66 ? 'curb-side' : 'center';
      const xPos = p.x < truck.L * 0.33 ? 'rear (door)' : p.x > truck.L * 0.66 ? 'nose (cab)' : 'mid-bay';
      const onFloor = p.y === 0;
      const supports = !onFloor
        ? sorted.find(o => o !== p && o.y + o.H === p.y && o.x < p.x + p.L && o.x + o.L > p.x && o.z < p.z + p.W && o.z + o.W > p.z)
        : null;
      return {
        step: i + 1,
        item: p.item,
        location: `${xPos} · ${zSide}${onFloor ? ' · floor' : supports ? ` · atop ${supports.item.ref}` : ' · second tier'}`,
        height: p.y,
      };
    });
  }, [activePacked, truck]);

  // Run optimize: distribute queued items across trucks and pack
  const runOptimize = () => {
    setOptimizing(true);
    setOptStage(0);
    CP_STORE.appendAudit({ who: activeUser?.name || 'Unknown', kind: 'edit', action: 'Ran optimize', target: `${facility.code} · ${scenarioTrucks.length} trucks` });
    const stages = ['Reading manifest', 'Sorting by fragility & weight', 'Allocating to trucks', 'Packing volumes', 'Verifying balance'];
    let s = 0;
    const tick = () => {
      s += 1;
      if (s <= stages.length) {
        setOptStage(s);
        if (s < stages.length) setTimeout(tick, 380);
        else {
          // Distribute queued items across trucks
          const trucksMeta = scenarioTrucks.map(tid => ({ id: tid, t: data.trucks.find(x => x.id === tid), used: 0 }));
          const queued = items.filter(i => i.truckId === null && i.status !== 'excluded')
            .sort((a, b) => (b.L * b.W * b.H) - (a.L * a.W * a.H));
          const next = items.map(i => ({ ...i }));
          for (const it of queued) {
            // assign to truck with least used volume that has capacity
            const candidates = trucksMeta.slice().sort((a, b) => (a.used / (a.t.L * a.t.W * a.t.H)) - (b.used / (b.t.L * b.t.W * b.t.H)));
            const target = candidates.find(c => c.used + it.L*it.W*it.H < c.t.L*c.t.W*c.t.H * 0.92) || candidates[0];
            const ix = next.findIndex(n => n.id === it.id);
            next[ix] = { ...next[ix], truckId: target.id, status: 'loaded' };
            target.used += it.L * it.W * it.H;
          }
          setItems(next);
          setTimeout(() => {
            setOptimizing(false);
            setDropAnim(true);
            setTimeout(() => setDropAnim(false), 1200);
          }, 280);
        }
      }
    };
    setTimeout(tick, 280);
  };

  // Spreadsheet paste handler
  const onPaste = (text) => {
    const lines = text.trim().split(/\r?\n/);
    const newItems = [];
    for (const line of lines) {
      const cols = line.split(/\t|,/).map(c => c.trim());
      if (cols.length < 4) continue;
      const [ref, title, L, W, H, lbs, medium] = cols;
      if (isNaN(parseFloat(L))) continue;
      newItems.push({
        id: 'pi-' + Math.random().toString(36).slice(2, 8),
        ref: ref || `CRT-${Math.floor(Math.random()*9000+1000)}`,
        title: title || 'Untitled',
        artist: '—', year: 2024,
        medium: (medium || 'MIX').toUpperCase().slice(0,3),
        L: +L, W: +W, H: +H, lbs: +lbs || 50,
        fragile: true, orient: 'UP', stack: false,
        value: 0, status: 'queued', truckId: null,
      });
    }
    if (newItems.length) {
      setItems(prev => [...prev, ...newItems]);
    }
    setShowPaste(false);
  };

  // Item interactions
  const toggleItemTruck = (id) => {
    setItems(prev => prev.map(it => {
      if (it.id !== id) return it;
      if (it.truckId === activeTruck) return { ...it, truckId: null, status: 'queued' };
      return { ...it, truckId: activeTruck, status: 'loaded' };
    }));
  };

  // Add a truck to the scenario
  const addTruckToScenario = (tid) => {
    if (scenarioTrucks.includes(tid)) return;
    setScenarioTrucks(prev => [...prev, tid]);
  };

  // Search
  const [q, setQ] = useState('');
  const filteredItems = items.filter(it =>
    (!activeShipment || activeShipment.itemIds.includes(it.id)) &&
    (!q || `${it.ref} ${it.title} ${it.artist}`.toLowerCase().includes(q.toLowerCase()))
  );

  // Saved scenarios (visual)
  const savedScenarios = [
    { id: 's-01', name: 'Frieze Pickup — BK → LDN', util: 0.78, trucks: 2, items: 14, active: true },
    { id: 's-02', name: 'Basel Outbound — LA → EU',  util: 0.62, trucks: 3, items: 22, active: false },
    { id: 's-03', name: 'Storage Consol. — LIC',          util: 0.91, trucks: 1, items: 9,  active: false },
  ];

  return (
    <div className="app" data-theme={t.theme}>
      {/* Top bar */}
      <header className="topbar">
        <div className="brand">
          <div className="mark">Cargo<em>·</em>Planner</div>
          <div className="build">v0.4 · atelier build</div>
        </div>
        <div className="crumbs">
          <span className="label">Facility</span>
          <button className="pill" onClick={() => setFacMenu(v => !v)}>
            <span className="dot" />
            <span className="mono" style={{ fontSize: 11, letterSpacing: '0.04em' }}>{facility.code}</span>
            <span style={{ fontSize: 12.5 }}>{facility.name}</span>
            {I.caret}
          </button>
          {facMenu && (
            <FacilityMenu
              facilities={userFacilities}
              activeId={facilityId}
              onPick={(id) => { setFacilityId(id); setFacMenu(false); }}
              onClose={() => setFacMenu(false)}
            />
          )}
          <span className="sep">/</span>
          <span className="muted" style={{ fontSize: 12.5 }}>{data.scenario.name}</span>
        </div>
        <div className="topbar-right">
          <button className="btn ghost sm">
            <span className="kbd-hint">⌘K</span>
            <span style={{ marginLeft: 6 }}>Search</span>
          </button>
          <button className="icon-btn" title="Notifications">{I.bell}</button>
          <button className="icon-btn" title="Toggle theme"
            onClick={() => setTweak('theme', t.theme === 'light' ? 'dark' : 'light')}>
            {t.theme === 'light' ? I.moon : I.sun}
          </button>
          <ActingAsMenu activeUserId={activeUserId} setActiveUserId={setActiveUserId} />
        </div>
      </header>
      {/* Sub nav */}
      <nav className="subnav">
        <div className="subnav-tabs">
          <button className={`subnav-tab ${page==='shipments'?'active':''}`} onClick={() => setPage('shipments')}><span className="num">01</span> Shipments</button>
          <button className={`subnav-tab ${page==='plan'?'active':''}`} onClick={() => setPage('plan')}><span className="num">02</span> Load Plan</button>
          <button className={`subnav-tab ${page==='trucks'?'active':''}`} onClick={() => setPage('trucks')}><span className="num">03</span> Trucks</button>
          <button className={`subnav-tab ${page==='scenarios'?'active':''}`} onClick={() => setPage('scenarios')}><span className="num">04</span> Scenarios</button>
          {activeUser?.role !== 'viewer' && (
            <button className={`subnav-tab ${page==='admin'?'active':''}`} onClick={() => setPage('admin')}><span className="num">05</span> Admin</button>
          )}
        </div>
        <div className="subnav-meta">
          <span className="live" />
          <span>autosaved · 12:42</span>
          <span className="sep" style={{ width: 1, height: 12, background: 'var(--line)' }} />
          <span>{items.filter(i => i.truckId).length}/{items.length} loaded</span>
        </div>
      </nav>

      {/* Main */}
      {page === 'admin' ? (
        <main className="main admin-main"><window.AdminPage onExit={() => setPage('plan')} /></main>
      ) : page === 'shipments' ? (
        <main className="main admin-main"><window.ShipmentsPage /></main>
      ) : page === 'trucks' ? (
        <main className="main admin-main"><window.TrucksPage /></main>
      ) : page === 'scenarios' ? (
        <main className="main admin-main"><window.ScenariosPage /></main>
      ) : (
      <main className={`main ${t.density === 'dense' ? 'dense' : t.density === 'sparse' ? 'sparse' : ''} ${!canEditPlans ? 'role-readonly' : ''}`} data-role={activeUser?.role}>
        {/* Manifest */}
        <aside
          className={`pane ${dragOverManifest ? 'drop-target' : ''}`}
          onDragOver={(e) => { if (canEditPlans) { e.preventDefault(); e.dataTransfer.dropEffect = 'move'; setDragOverManifest(true); } }}
          onDragLeave={() => setDragOverManifest(false)}
          onDrop={(e) => {
            e.preventDefault();
            const itemId = e.dataTransfer.getData('text/cp-item');
            if (itemId && canEditPlans) {
              setItems(prev => prev.map(i => i.id === itemId ? { ...i, truckId: null, status: 'queued' } : i));
            }
            setDragOverManifest(false);
          }}
        >
          <div className="pane-head">
            <h2><em>Manifest</em></h2>
            <span className="mono muted" style={{ fontSize: 11 }}>{filteredItems.length} crates</span>
          </div>
          <div className="manifest-tools">
            <div className="input">
              {I.search}
              <input placeholder="Search ref, title, artist…" value={q} onChange={e => setQ(e.target.value)} />
            </div>
            <button className="btn sm" onClick={() => setShowAdd(true)} title="Add crate">{I.plus}</button>
            <button className="btn sm" onClick={() => setShowPaste(true)} title="Paste from spreadsheet">{I.paste}</button>
          </div>
          <div className="pane-body">
            {filteredItems.map(it => (
              <ItemRow
                key={it.id}
                it={it}
                onClick={() => toggleItemTruck(it.id)}
                activeTruck={activeTruck}
              />
            ))}
          </div>
          <div className="pane-foot row spread">
            <span className="mono muted" style={{ fontSize: 10.5 }}>
              {items.filter(i => !i.truckId).length} unassigned
            </span>
            <button className="btn sm">Sort by weight</button>
          </div>
        </aside>

        {/* Center planner */}
        <section className="pane center">
          <div className="center-head">
            <div className="scenario-row">
              <div className="scenario-title">
                <h1>{activeShipment ? activeShipment.name : 'Frieze Pickup'} <em>—</em> {activeShipment ? `${facility.code} → ${activeShipment.destination.split(',')[0]}` : 'Brooklyn to London'}</h1>
                {activeShipment && <div className="mono small muted" style={{ marginTop: 4, display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                  <span>{activeShipment.ref} · {activeShipment.itemIds.length} crates</span>
                  <span className={`status-pill st-${activeShipment.status || 'planning'}`}>{(activeShipment.status || 'planning').toUpperCase()}</span>
                  {canEditPlans && (activeShipment.status === 'planning' || !activeShipment.status) && (
                    <button className="link-btn accent" onClick={() => {
                      const seed = window.CP_SEED_SHIPMENTS || [];
                      const ships = CP_STORE.get('shipments', seed);
                      const updated = ships.map(s => s.id === activeShipment.id ? { ...s, status: 'loaded', loadedAt: new Date().toISOString() } : s);
                      CP_STORE.set('shipments', updated);
                      CP_STORE.appendAudit({ who: activeUser?.name || 'Unknown', kind: 'edit', action: 'Marked shipment loaded', target: `${activeShipment.ref} · ${activeShipment.name}` });
                      setActiveShipment(updated.find(s => s.id === activeShipment.id));
                      setToast('Shipment marked as loaded');
                    }}>Mark as loaded ↗</button>
                  )}
                  {activeShipment.loadedAt && <span>· loaded {new Date(activeShipment.loadedAt).toLocaleString('en-US',{month:'short',day:'numeric',hour:'numeric',minute:'2-digit'})}</span>}
                  <button className="link-btn" onClick={() => setActiveShipment(null)}>Clear</button>
                </div>}
              </div>
              <div className="scenario-meta">
                <span>PICKUP 21 MAY</span>
                <span className="sep" />
                <span>ARR 24–26 MAY</span>
                <span className="sep" />
                <span>HANDLER · IV</span>
              </div>
            </div>

            <div className="truck-tabs">
              {scenarioTrucks.map(tid => {
                const tk = data.trucks.find(x => x.id === tid);
                const u = packed[tid] ? computeUtil(tk, packed[tid]) : null;
                return (
                  <button
                    key={tid}
                    className={`truck-tab ${tid === activeTruck ? 'active' : ''} ${dragOverTruck === tid ? 'drop-target' : ''}`}
                    onClick={() => setActiveTruck(tid)}
                    onDragOver={(e) => { if (canEditPlans) { e.preventDefault(); e.dataTransfer.dropEffect = 'move'; setDragOverTruck(tid); } }}
                    onDragLeave={() => setDragOverTruck(null)}
                    onDrop={(e) => {
                      e.preventDefault();
                      const itemId = e.dataTransfer.getData('text/cp-item');
                      if (itemId && canEditPlans) {
                        setItems(prev => prev.map(i => i.id === itemId ? { ...i, truckId: tid, status: 'loaded' } : i));
                        setActiveTruck(tid);
                        setDropAnim(true);
                        setTimeout(() => setDropAnim(false), 1000);
                      }
                      setDragOverTruck(null);
                    }}
                  >
                    <span className="name">{tk.ref}</span>
                    <span className="meta">
                      <span>{tk.type}</span>
                      <span style={{ width: 1, height: 10, background: 'var(--line)' }} />
                      <span>{u ? fmt.pct(u.vol) : '0%'}</span>
                    </span>
                    <span className="util-bar" style={{ width: u ? `${u.vol*100}%` : '0%' }} />
                  </button>
                );
              })}
              <button className="truck-add" onClick={() => {
                const remaining = facilityTrucks.find(tk => !scenarioTrucks.includes(tk.id));
                if (remaining) {
                  addTruckToScenario(remaining.id);
                  CP_STORE.appendAudit({ who: activeUser?.name || 'Unknown', kind: 'edit', action: 'Added truck to scenario', target: remaining.ref });
                }
              }}>
                {I.plus} <span style={{ marginLeft: 8 }}>Add truck</span>
              </button>
            </div>
          </div>

          <div className="canvas-wrap">
            <div className="canvas">
              <div className="grid" />
              <div className="corners" />

              <CP_Scene
                truck={truck}
                placed={activePacked.placed}
                view={t.view}
                dropAnim={dropAnim}
                theme={t.theme}
              />

              {/* Controls */}
              <div className="canvas-controls">
                <div className="seg">
                  {['iso', '3d', 'top'].map(v => (
                    <button
                      key={v}
                      className={t.view === v ? 'active' : ''}
                      onClick={() => setTweak('view', v)}
                    >{v}</button>
                  ))}
                </div>
              </div>

              <div className="canvas-status">
                <span className={`chip ${util.vol > 0.95 ? 'warn' : 'ok'}`}>
                  <span className="d" /> {fmt.pct(util.vol)} vol
                </span>
                <span className={`chip ${util.wt > 0.95 ? 'warn' : 'ok'}`}>
                  <span className="d" /> {fmt.pct(util.wt)} wt
                </span>
                {activePacked.unplaced.length > 0 && (
                  <span className="chip warn">
                    <span className="d" /> {activePacked.unplaced.length} won’t fit
                  </span>
                )}
              </div>

              <div className="canvas-legend">
                <span><span className="swatch" style={{ background: 'oklch(0.74 0.06 70)' }} /> Wooden crate</span>
                <span><span className="swatch" style={{ background: 'transparent', borderStyle: 'dashed' }} /> Truck shell</span>
                <span><span style={{ color: 'oklch(0.42 0.18 28)', fontFamily: 'var(--mono)', fontSize: 10 }}>FRAGILE ↑↑</span></span>
              </div>

              <div className="canvas-axes">
                <span>L {truck.L}″</span>
                <span>W {truck.W}″</span>
                <span>H {truck.H}″</span>
              </div>

              {/* Optimize overlay */}
              <div className={`opt-overlay ${optimizing ? 'show' : ''}`}>
                <div className="card">
                  <h4>Computing <em>load plan</em></h4>
                  <div className="stages">
                    {['Reading manifest', 'Sorting by fragility & weight', 'Allocating to trucks', 'Packing volumes', 'Verifying balance'].map((s, i) => (
                      <div key={i} className={`stage ${i < optStage - 1 ? 'done' : i === optStage - 1 ? 'run' : ''}`}>
                        <span className="dot" />
                        <span>{s}</span>
                        <span className="mono muted" style={{ fontSize: 10 }}>{i < optStage - 1 ? '✓' : ''}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            <div className="optimize-row">
              <div className="left">
                <span className="mono muted" style={{ fontSize: 11 }}>{activePacked.placed.length} placed · {activePacked.unplaced.length} pending</span>
              </div>
              <div className="right">
                <button className="btn sm" onClick={() => setShowLoadOrder(true)} title="Step-by-step load order">
                  {I.list || I.print} <span>Load order</span>
                </button>
                <button className="btn sm" onClick={runFit} title="Distribute all crates across trucks">
                  {I.fit || I.optimize} <span>Will it fit?</span>
                </button>
                <button className="btn sm" onClick={() => {
                  const seed = window.CP_SEED_SCENARIOS || [];
                  const scens = CP_STORE.get('scenarios', seed);
                  const newScen = {
                    id: 'sn-' + Date.now().toString(36),
                    name: (activeShipment ? activeShipment.name : 'Untitled scenario') + ' — ' + facility.code,
                    facility: facilityId,
                    shipmentRef: activeShipment?.ref || '—',
                    trucks: scenarioTrucks.length,
                    crates: items.filter(i => i.truckId).length,
                    util: Math.round((util?.vol || 0) * 100),
                    weight: Math.round((util?.wt || 0) * 100),
                    status: 'active',
                    updated: new Date().toISOString().slice(0,10),
                    author: 'Marcus Chen',
                    snapshot: {
                      trucks: scenarioTrucks,
                      assignments: items.filter(i => i.truckId).map(i => ({ id: i.id, truckId: i.truckId })),
                    },
                  };
                  CP_STORE.set('scenarios', [newScen, ...scens]);
                  CP_STORE.appendAudit({ who: activeUser?.name || 'Unknown', kind: 'edit', action: 'Saved scenario', target: newScen.name });
                  setToast('Scenario saved');
                }}>{I.save} <span>Save scenario</span></button>
                <button className="btn sm" onClick={() => {
                  document.body.dataset.printMode = 'manifest';
                  setTimeout(() => { window.print(); setTimeout(() => { delete document.body.dataset.printMode; }, 500); }, 50);
                }}>{I.print} <span>Manifest PDF</span></button>
                <button className="btn accent" onClick={runOptimize} disabled={optimizing}>
                  {I.optimize} <span>Optimize</span>
                </button>
              </div>
            </div>
          </div>
        </section>

        {/* Right pane */}
        <aside className="pane">
          <div className="pane-head">
            <h2><em>Utilization</em></h2>
            <span className="mono muted" style={{ fontSize: 11 }}>{truck.ref}</span>
          </div>

          <div className="pane-body">
            <div className="right-section">
              <h3>Volume <em>&amp;</em> weight</h3>
              <Meter label="Volume" value={util.vol} format={fmt.pct} note={`${fmt.cuft(util.usedVol)} of ${fmt.cuft(util.totalVol)}`} />
              <Meter label="Weight" value={util.wt}  format={fmt.pct} note={`${fmt.lbs(util.usedLbs)} of ${fmt.lbs(util.totalLbs)}`} accent="accent" />
              <Meter label="Floor footprint" value={util.floor} format={fmt.pct} note={`${activePacked.placed.length} crates`} accent="good" />
            </div>

            <div className="right-section">
              <h3>Axle balance</h3>
              <Balance util={util} truck={truck} />
              <div className="row spread" style={{ marginTop: 12 }}>
                <span className="muted" style={{ fontSize: 11.5 }}>Center of mass</span>
                <span className="mono" style={{ fontSize: 11.5 }}>{(util.com * 100).toFixed(1)}% from cab</span>
              </div>
              <div className="row spread">
                <span className="muted" style={{ fontSize: 11.5 }}>Recommended</span>
                <span className="mono" style={{ fontSize: 11.5, color: 'var(--good)' }}>52–58%</span>
              </div>
            </div>

            <div className="right-section">
              <h3>Constraints</h3>
              <div className="constraints">
                <ConstraintRow
                  name="Fragile this side up"
                  desc="Lock orient ↑ for fragile crates"
                  on={t.fragileTop}
                  onClick={() => setTweak('fragileTop', !t.fragileTop)}
                />
                <ConstraintRow
                  name="Stack limits"
                  desc="Honor crate stack flags"
                  on={t.stackLimits}
                  onClick={() => setTweak('stackLimits', !t.stackLimits)}
                />
                <ConstraintRow
                  name="Weight balance"
                  desc="Distribute load over axles"
                  on={t.weightBalance}
                  onClick={() => setTweak('weightBalance', !t.weightBalance)}
                />
                <ConstraintRow
                  name="Climate priority"
                  desc="Group climate-sensitive crates"
                  on={true}
                  onClick={() => {}}
                />
              </div>
            </div>

            <div className="right-section">
              <h3>Scenarios</h3>
              <div className="scen-list">
                {savedScenarios.map(s => (
                  <button key={s.id} className={`scen ${s.active ? 'active' : ''}`}>
                    <div className="nm">
                      <span className="t">{s.name}</span>
                      <span className="s">{s.trucks} trucks · {s.items} items</span>
                    </div>
                    <div className="meta">
                      {fmt.pct(s.util)}
                    </div>
                  </button>
                ))}
              </div>
            </div>
          </div>
        </aside>
      </main>
      )}

      {/* Footer */}
      <footer className="footer">
        <div className="group">
          <span><span className="k">Plan</span> <span className="v">FRZ-2026-05</span></span>
          <span><span className="k">From</span> <span className="v">{facility.code} · {facility.city}</span></span>
          <span><span className="k">To</span> <span className="v">LDN · Park Royal Annex</span></span>
        </div>
        <div className="group">
          <span><span className="k">Vol</span> <span className="v">{fmt.pct(util.vol)}</span></span>
          <span><span className="k">Wt</span> <span className="v">{fmt.pct(util.wt)}</span></span>
          <span><span className="k">CoM</span> <span className="v">{(util.com * 100).toFixed(1)}%</span></span>
          <span><span className="k">⌘S</span> <span className="v">save</span></span>
          <span><span className="k">O</span> <span className="v">optimize</span></span>
        </div>
      </footer>

      {/* Dialogs */}
      {showAdd && <AddDialog onClose={() => setShowAdd(false)} onAdd={(it) => {
        setItems(prev => [...prev, it]); setShowAdd(false);
      }} />}
      {showPaste && <PasteDialog onClose={() => setShowPaste(false)} onPaste={onPaste} />}
      {fitResult && <FitDialog result={fitResult} onClose={() => setFitResult(null)} onApply={() => {
        // Apply: assign items to scenario trucks based on result, adding any new trucks needed
        const newScenarioTrucks = [...scenarioTrucks];
        const assignments = {};
        fitResult.summary.forEach((s, idx) => {
          let truckId = newScenarioTrucks[idx];
          if (!truckId) {
            // need to add a new truck — find an unused one matching s.tk
            const unused = data.trucks.find(tk => tk.facility === facilityId && !newScenarioTrucks.includes(tk.id) && tk.type === s.tk.type) ||
                           data.trucks.find(tk => tk.facility === facilityId && !newScenarioTrucks.includes(tk.id));
            if (unused) { newScenarioTrucks.push(unused.id); truckId = unused.id; }
          }
          if (truckId) s.items.forEach(it => assignments[it.id] = truckId);
        });
        setScenarioTrucks(newScenarioTrucks);
        setItems(prev => prev.map(i => assignments[i.id] ? { ...i, truckId: assignments[i.id], status: 'loaded' } : i));
        setFitResult(null);
        setDropAnim(true);
        setTimeout(() => setDropAnim(false), 1200);
      }} />}
      {showLoadOrder && <LoadOrderDialog steps={loadOrder} truck={truck} onClose={() => setShowLoadOrder(false)} />}

      {/* Print sheet — hidden on screen, populated for print() */}
      <div className="print-sheet" aria-hidden="true">
        <div className="print-head">
          <div className="print-brand">Cargo<em>·</em>Planner</div>
          <div className="print-title-block">
            <div className="print-eyebrow mono small">{document.body.dataset.printMode === 'loadcard' ? `LOAD CARD · ${truck.ref}` : 'MANIFEST'}</div>
            <div className="print-title">{activeShipment ? activeShipment.name : 'Frieze Pickup'}</div>
            <div className="print-sub mono small">{activeShipment ? `${activeShipment.ref} · ${facility.code} → ${activeShipment.destination?.split(',')[0] || ''}` : `${facility.code} → London`}</div>
          </div>
          <div className="print-meta mono small">
            <div>{new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })}</div>
            <div>{activeUser?.name}</div>
          </div>
        </div>

        <div className="print-summary">
          <div><span className="k">Trucks</span><span className="v">{scenarioTrucks.length}</span></div>
          <div><span className="k">Crates</span><span className="v">{items.filter(i => i.truckId).length}/{items.length}</span></div>
          <div><span className="k">Volume</span><span className="v">{fmt.pct(util?.vol || 0)}</span></div>
          <div><span className="k">Weight</span><span className="v">{fmt.pct(util?.wt || 0)}</span></div>
          <div><span className="k">CoM</span><span className="v">{((util?.com || 0) * 100).toFixed(1)}%</span></div>
        </div>

        {/* Manifest mode: per-truck tables */}
        <div className="print-manifest-only">
          {scenarioTrucks.map(tid => {
            const tk = data.trucks.find(x => x.id === tid);
            const truckItems = items.filter(i => i.truckId === tid);
            const u = packed[tid] ? computeUtil(tk, packed[tid]) : null;
            return (
              <div key={tid} className="print-truck">
                <div className="print-truck-head">
                  <h2>{tk.ref} <em>—</em> {tk.type}</h2>
                  <div className="mono small">{truckItems.length} crates · {u ? fmt.pct(u.vol) : '—'} vol · {u ? fmt.pct(u.wt) : '—'} wt</div>
                </div>
                <table className="print-table">
                  <thead><tr><th>Ref</th><th>Title</th><th>Artist</th><th>Dims (in)</th><th>Wt</th><th>Flags</th></tr></thead>
                  <tbody>
                    {truckItems.map(it => (
                      <tr key={it.id}>
                        <td className="mono">{it.ref}</td>
                        <td className="ital">{it.title}</td>
                        <td>{it.artist}</td>
                        <td className="mono">{it.L}×{it.W}×{it.H}</td>
                        <td className="mono">{it.lbs}</td>
                        <td className="mono small">{[it.fragile && 'FRAG', it.orient==='UP' && '↑', it.flat && 'FLAT', it.glass && 'GLASS', it.stack && 'STK'].filter(Boolean).join(' ')}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            );
          })}
        </div>

        {/* Load card mode: step-by-step for active truck */}
        <div className="print-loadcard-only">
          <div className="print-truck-head">
            <h2>{truck.ref} <em>—</em> {truck.type}</h2>
            <div className="mono small">Last on, first off · {loadOrder.length} steps</div>
          </div>
          <table className="print-table">
            <thead><tr><th>#</th><th>Ref</th><th>Title</th><th>Position</th><th>Dims</th><th>Wt</th><th>Flags</th></tr></thead>
            <tbody>
              {loadOrder.map((s, i) => (
                <tr key={s.id || i}>
                  <td className="mono">{String(i+1).padStart(2,'0')}</td>
                  <td className="mono">{s.ref}</td>
                  <td className="ital">{s.title}</td>
                  <td className="small">{s.location}</td>
                  <td className="mono">{s.L}×{s.W}×{s.H}</td>
                  <td className="mono">{s.lbs}</td>
                  <td className="mono small">{[s.fragile && 'FRAG', s.orient==='UP' && '↑', s.flat && 'FLAT', s.glass && 'GLASS', s.stack && 'STK'].filter(Boolean).join(' ')}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="print-foot mono small">
          Cargo Planner · printed {new Date().toLocaleString()} · {activeUser?.name}
        </div>
      </div>

      {toast && <div className="toast">{toast}</div>}

      {/* Tweaks panel */}
      <TweaksPanel title="Tweaks" defaultOpen={false}>
        <TweakSection label="Theme">
          <TweakRadio label="Mode" value={t.theme} onChange={v => setTweak('theme', v)} options={[
            { label: 'Light', value: 'light' },
            { label: 'Dark',  value: 'dark' },
          ]} />
          <TweakColor label="Accent" value={t.accent} onChange={v => setTweak('accent', v)}
            options={['#b75a32', '#1f5d4a', '#3a4a8a', '#c9a23c']} />
        </TweakSection>
        <TweakSection label="Visualization">
          <TweakRadio label="View" value={t.view} onChange={v => setTweak('view', v)} options={[
            { label: 'Iso', value: 'iso' },
            { label: '3D',  value: '3d' },
            { label: 'Top', value: 'top' },
          ]} />
          <TweakRadio label="Density" value={t.density} onChange={v => setTweak('density', v)} options={[
            { label: 'Sparse',   value: 'sparse' },
            { label: 'Balanced', value: 'balanced' },
            { label: 'Dense',    value: 'dense' },
          ]} />
          <TweakToggle label="Show labels" value={t.showLabels} onChange={v => setTweak('showLabels', v)} />
        </TweakSection>
      </TweaksPanel>
    </div>
  );
}

// ---- Subcomponents ----
function ActingAsMenu({ activeUserId, setActiveUserId }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  const users = window.CP_USERS || [];
  const roles = Object.fromEntries((window.CP_ROLES || []).map(r => [r.id, r.name]));
  const data = window.CP_DATA;
  const u = users.find(x => x.id === activeUserId) || users[0];
  if (!u) return null;
  const initials = u.name.split(' ').map(s => s[0]).slice(0,2).join('');
  useEffect(() => {
    const onDoc = e => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    if (open) document.addEventListener('click', onDoc);
    return () => document.removeEventListener('click', onDoc);
  }, [open]);
  return (
    <div className="acting-as" ref={ref}>
      <button className="acting-trigger" onClick={(e) => { e.stopPropagation(); setOpen(v => !v); }} title={`${u.name} — ${roles[u.role]}`}>
        <span className="avatar sm">{initials}</span>
        <span className="acting-meta">
          <span className="acting-label mono small muted">ACTING AS</span>
          <span className="acting-name">{u.name.split(' ')[0]} <em>·</em> {roles[u.role]}</span>
        </span>
        <span className="caret">{I.caret}</span>
      </button>
      {open && (
        <div className="acting-pop">
          <div className="acting-pop-head">
            <span className="mono small muted">SWITCH USER</span>
            <span className="mono small muted">{users.length} ON ORG</span>
          </div>
          <div className="acting-list">
            {users.map(usr => {
              const facs = (usr.role === 'admin' ? data.facilities : data.facilities.filter(f => usr.facilities.includes(f.id))).map(f => f.code);
              return (
                <button key={usr.id} className={`acting-row ${usr.id === activeUserId ? 'active' : ''}`} onClick={() => { setActiveUserId(usr.id); setOpen(false); }}>
                  <span className="avatar sm">{usr.name.split(' ').map(s => s[0]).slice(0,2).join('')}</span>
                  <span className="acting-row-meta">
                    <span className="nm">{usr.name}</span>
                    <span className="rl mono small">{roles[usr.role]} <em>·</em> {facs.join(' / ') || '—'}</span>
                  </span>
                  {usr.id === activeUserId && <span className="acting-check">✓</span>}
                </button>
              );
            })}
          </div>
          <div className="acting-pop-foot mono small muted">DEMO MODE · ROLE-GATED UI</div>
        </div>
      )}
    </div>
  );
}

function FacilityMenu({ facilities, activeId, onPick, onClose }) {
  useEffect(() => {
    const onDoc = e => {
      if (!e.target.closest('.menu') && !e.target.closest('.pill')) onClose();
    };
    document.addEventListener('click', onDoc);
    return () => document.removeEventListener('click', onDoc);
  }, []);
  return (
    <div className="menu">
      <div className="group-h">Your facilities</div>
      {facilities.map(f => (
        <div key={f.id} className={`row ${f.id === activeId ? 'active' : ''}`} onClick={() => onPick(f.id)}>
          <div className="code">{f.code}</div>
          <div className="nm">
            <span className="t">{f.name}</span>
            <span className="s">{f.city} · {f.trucks} trucks · {f.users} users</span>
          </div>
          <span className="mono muted" style={{ fontSize: 10 }}>{f.id === activeId ? 'active' : ''}</span>
        </div>
      ))}
    </div>
  );
}

function ItemRow({ it, onClick, activeTruck, onDragStart, onDragEnd, draggable }) {
  const loaded = it.truckId === activeTruck;
  const onOther = it.truckId && it.truckId !== activeTruck;
  return (
    <div
      className={`item ${loaded ? 'is-loaded' : ''} ${onOther ? 'excluded' : ''}`}
      onClick={onClick}
      draggable={draggable}
      onDragStart={(e) => { e.dataTransfer.effectAllowed = 'move'; e.dataTransfer.setData('text/cp-item', it.id); onDragStart?.(it.id); }}
      onDragEnd={() => onDragEnd?.()}
    >
      <div className="item-thumb">{it.medium}</div>
      <div className="item-title">
        <span className="t italic">{it.title}</span>
        <span className="s">
          <span className="ref">{it.ref}</span>
          <span className="dot" />
          <span>{it.artist}{it.year ? ` · ${it.year}` : ''}</span>
        </span>
      </div>
      <div className="item-meta">
        <span className="lbs">{fmt.shortDims(it)}</span>
        <span>{it.lbs} lbs</span>
        <span className="badges">
          {it.fragile && <span className="badge frag" title="Fragile">FRAG</span>}
          {it.orient === 'UP' && <span className="badge up" title="This side up">↑</span>}
          {it.flat && <span className="badge flat" title="Must lie flat">FLAT</span>}
          {it.glass && <span className="badge glass" title="Glass — must ride along a wall">GLASS</span>}
          {it.stack && <span className="badge stk" title="Stackable">STK</span>}
          {loaded && <span className="badge loaded">LOADED</span>}
          {onOther && <span className="badge exc">on other</span>}
        </span>
      </div>
    </div>
  );
}

function Meter({ label, value, format, note, accent }) {
  return (
    <div className="meter">
      <div className="meter-head">
        <span>{label}</span>
        <span className="v">{format(value)} <small>{note}</small></span>
      </div>
      <div className={`bar ${accent || ''}`}>
        <i style={{ width: `${Math.min(value, 1) * 100}%` }} />
        <span className="marker" style={{ left: '90%' }} />
      </div>
    </div>
  );
}

function ConstraintRow({ name, desc, on, onClick }) {
  return (
    <div className="constraint">
      <div className="label-stack">
        <span className="name">{name}</span>
        <span className="desc">{desc}</span>
      </div>
      <button className={`toggle ${on ? 'on' : ''}`} onClick={onClick} aria-pressed={on} />
    </div>
  );
}

function Balance({ util, truck }) {
  return (
    <div className="balance">
      <div className="truck-svg">
        <div className="com" style={{ left: `${util.com * 100}%` }} />
      </div>
      <div className="axles">
        {Array.from({ length: truck.axles }).map((_, i) => <div key={i} className="axle" />)}
      </div>
      <div className="scale">
        <span>cab</span>
        <span>30%</span>
        <span>50%</span>
        <span>70%</span>
        <span>tail</span>
      </div>
    </div>
  );
}

function AddDialog({ onClose, onAdd }) {
  const [form, setForm] = useState({
    ref: 'CRT-' + Math.floor(1000 + Math.random() * 9000),
    title: '', artist: '', year: 2024, medium: 'PNT',
    L: 48, W: 6, H: 36, lbs: 80, fragile: true, orient: 'UP', stack: false, flat: false, glass: false,
    value: 0,
  });
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));
  return (
    <div className="dialog-mask" onClick={onClose}>
      <div className="dialog" onClick={e => e.stopPropagation()}>
        <div className="dialog-head">
          <h3>Add <em>crate</em></h3>
          <button className="icon-btn" onClick={onClose}>{I.close}</button>
        </div>
        <div className="dialog-body">
          <div className="grid-2">
            <div className="field"><label>Reference</label><input value={form.ref} onChange={e => set('ref', e.target.value)} /></div>
            <div className="field"><label>Medium</label>
              <select value={form.medium} onChange={e => set('medium', e.target.value)}>
                {Object.entries(window.CP_DATA.mediumLabel).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select>
            </div>
          </div>
          <div className="grid-2">
            <div className="field"><label>Title</label><input value={form.title} onChange={e => set('title', e.target.value)} placeholder="Untitled (Marine)" /></div>
            <div className="field"><label>Artist</label><input value={form.artist} onChange={e => set('artist', e.target.value)} /></div>
          </div>
          <div className="grid-3">
            <div className="field"><label>Length (in)</label><input type="number" value={form.L} onChange={e => set('L', +e.target.value)} /></div>
            <div className="field"><label>Width (in)</label><input type="number" value={form.W} onChange={e => set('W', +e.target.value)} /></div>
            <div className="field"><label>Height (in)</label><input type="number" value={form.H} onChange={e => set('H', +e.target.value)} /></div>
          </div>
          <div className="grid-3">
            <div className="field"><label>Weight (lbs)</label><input type="number" value={form.lbs} onChange={e => set('lbs', +e.target.value)} /></div>
            <div className="field"><label>Orientation</label>
              <select value={form.orient} onChange={e => set('orient', e.target.value)}>
                <option value="UP">This side up</option>
                <option value="ANY">Any</option>
              </select>
            </div>
            <div className="field"><label>Insured value (USD)</label><input type="number" value={form.value} onChange={e => set('value', +e.target.value)} /></div>
          </div>
          <div className="grid-3">
            <div className="field check"><label><input type="checkbox" checked={form.fragile} onChange={e => set('fragile', e.target.checked)} /> Fragile</label></div>
            <div className="field check"><label><input type="checkbox" checked={form.stack} onChange={e => set('stack', e.target.checked)} /> Stackable</label></div>
            <div className="field check"><label><input type="checkbox" checked={form.flat} onChange={e => set('flat', e.target.checked)} /> Must lie flat</label></div>
          </div>
          <div className="grid-2">
            <div className="field check"><label><input type="checkbox" checked={form.glass} onChange={e => set('glass', e.target.checked)} /> Glass — ride along a side wall, do not span the door</label></div>
          </div>
        </div>
        <div className="dialog-foot">
          <button className="btn" onClick={onClose}>Cancel</button>
          <button className="btn primary" onClick={() => onAdd({
            ...form, id: 'ni-' + Math.random().toString(36).slice(2, 8),
            status: 'queued', truckId: null,
          })}>Add to manifest</button>
        </div>
      </div>
    </div>
  );
}

function PasteDialog({ onClose, onPaste }) {
  const [text, setText] = useState(
`CRT-9501\tStudy in Crimson\t36\t3\t28\t22\tWRK
CRT-9502\tField Maquette\t30\t30\t30\t140\tSCL
CRT-9503\tQuiet Mass III\t72\t6\t52\t168\tPNT`
  );
  return (
    <div className="dialog-mask" onClick={onClose}>
      <div className="dialog" onClick={e => e.stopPropagation()}>
        <div className="dialog-head">
          <h3>Paste from <em>spreadsheet</em></h3>
          <button className="icon-btn" onClick={onClose}>{I.close}</button>
        </div>
        <div className="dialog-body">
          <div className="field">
            <label>Tab- or comma-separated: ref, title, L, W, H, lbs, medium</label>
            <textarea className="paste" value={text} onChange={e => setText(e.target.value)} />
          </div>
        </div>
        <div className="dialog-foot">
          <button className="btn" onClick={onClose}>Cancel</button>
          <button className="btn primary" onClick={() => onPaste(text)}>Import rows</button>
        </div>
      </div>
    </div>
  );
}

function FitDialog({ result, onClose, onApply }) {
  const fits = result.overflow.length === 0;
  return (
    <div className="dialog-mask" onClick={onClose}>
      <div className="dialog wide" onClick={e => e.stopPropagation()}>
        <div className="dialog-head">
          <h3>Will it <em>fit?</em></h3>
          <button className="icon-btn" onClick={onClose}>{I.close}</button>
        </div>
        <div className="dialog-body">
          <div className="fit-summary">
            <div className="fit-headline">
              <div className="big">
                <span className="n">{result.summary.length}</span>
                <span className="u">{result.summary.length === 1 ? 'truck' : 'trucks'}</span>
              </div>
              <div className="meta">
                <div>{result.totalItems} crates · {fits ? 'all placed' : `${result.overflow.length} won’t fit any truck`}</div>
                <div className={fits ? 'ok' : 'warn'}>{fits ? '✓ Plan complete' : 'Manual review needed'}</div>
              </div>
            </div>
          </div>
          <div className="fit-trucks">
            {result.summary.map(s => (
              <div key={s.idx} className="fit-truck">
                <div className="ft-head">
                  <div className="ft-name">
                    <span className="num">#{s.idx}</span>
                    <span className="ref">{s.tk.ref}</span>
                    <span className="ty">{s.tk.type}</span>
                  </div>
                  <div className="ft-util">
                    <span><b>{(s.util.vol*100).toFixed(0)}%</b> vol</span>
                    <span><b>{(s.util.wt*100).toFixed(0)}%</b> wt</span>
                    <span><b>{s.items.length}</b> crates</span>
                  </div>
                </div>
                <div className="ft-bar">
                  <i style={{ width: `${Math.min(s.util.vol,1)*100}%` }} />
                </div>
                <div className="ft-list">
                  {s.items.map(it => (
                    <span key={it.id} className="ft-chip">
                      <span className="r">{it.ref}</span>
                      <span className="t">{it.title}</span>
                    </span>
                  ))}
                </div>
              </div>
            ))}
            {result.overflow.length > 0 && (
              <div className="fit-truck overflow">
                <div className="ft-head">
                  <div className="ft-name">
                    <span className="num">!</span>
                    <span className="ref">Won’t fit any single truck</span>
                  </div>
                  <div className="ft-util muted">{result.overflow.length} crates</div>
                </div>
                <div className="ft-list">
                  {result.overflow.map(it => (
                    <span key={it.id} className="ft-chip warn">
                      <span className="r">{it.ref}</span>
                      <span className="t">{it.title} · {it.L}″×{it.W}″×{it.H}″</span>
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
        <div className="dialog-foot">
          <button className="btn" onClick={onClose}>Close</button>
          <button className="btn primary" onClick={onApply} disabled={!fits}>Apply to scenario</button>
        </div>
      </div>
    </div>
  );
}

function LoadOrderDialog({ steps, truck, onClose }) {
  return (
    <div className="dialog-mask" onClick={onClose}>
      <div className="dialog wide" onClick={e => e.stopPropagation()}>
        <div className="dialog-head">
          <h3>Load order <em>—</em> {truck.ref}</h3>
          <button className="icon-btn" onClick={onClose}>{I.close}</button>
        </div>
        <div className="dialog-body">
          <p className="dialog-intro">
            Step-by-step pack sequence. Load from the cab end working back toward the door —
            the last crate on is the first crate off.
          </p>
          {steps.length === 0 ? (
            <div className="empty">No crates assigned to this truck yet.</div>
          ) : (
            <ol className="load-steps">
              {steps.map(s => (
                <li key={s.step}>
                  <span className="step-num mono">{String(s.step).padStart(2,'0')}</span>
                  <span className="step-body">
                    <span className="step-title">
                      <span className="ref mono">{s.item.ref}</span>
                      <span className="t italic">{s.item.title}</span>
                    </span>
                    <span className="step-meta">
                      <span>{s.item.L}″×{s.item.W}″×{s.item.H}″ · {s.item.lbs} lbs</span>
                      <span className="loc">{s.location}</span>
                    </span>
                    <span className="step-flags">
                      {s.item.fragile && <span className="badge frag">FRAG</span>}
                      {s.item.glass && <span className="badge glass">GLASS</span>}
                      {s.item.flat && <span className="badge flat">FLAT</span>}
                      {s.item.stack && <span className="badge stk">STK</span>}
                    </span>
                  </span>
                </li>
              ))}
            </ol>
          )}
        </div>
        <div className="dialog-foot">
          <button className="btn" onClick={onClose}>Close</button>
          <button className="btn primary" onClick={() => {
            document.body.dataset.printMode = 'loadcard';
            setTimeout(() => { window.print(); setTimeout(() => { delete document.body.dataset.printMode; }, 500); }, 50);
          }}>Print load card</button>
        </div>
      </div>
    </div>
  );
}

// ---- Compute utilization ----
function computeUtil(truck, packed) {
  const totalVol = truck.L * truck.W * truck.H;
  const totalLbs = truck.maxLbs;
  let usedVol = 0, usedLbs = 0;
  let momentX = 0; // for CoM along truck length
  let floorArea = 0;
  const truckFloor = truck.L * truck.W;
  for (const p of packed.placed) {
    const v = p.L * p.W * p.H;
    usedVol += v;
    usedLbs += p.item.lbs;
    momentX += (p.x + p.L / 2) * p.item.lbs;
    if (p.y === 0) floorArea += p.L * p.W;
  }
  const com = usedLbs > 0 ? (momentX / usedLbs) / truck.L : 0.5;
  return {
    vol: usedVol / totalVol,
    wt:  usedLbs / totalLbs,
    floor: Math.min(1, floorArea / truckFloor),
    usedVol, totalVol, usedLbs, totalLbs,
    com: Math.max(0, Math.min(1, com)),
  };
}

ReactDOM.createRoot(document.getElementById('root')).render(<App />);
