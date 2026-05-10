import React from 'react';
import { saveFacility, deleteFacility, saveAppUser, deleteAppUser, saveTruck, deleteTruck } from './sync.js';
import { supabaseConfigured } from './supabase.js';
// Admin — users, locations, roles management

const { useState: useAdminState, useMemo: useAdminMemo } = React;

// Subscribe to global data refresh events. Returns the latest snapshot of the
// requested window.CP_* slice every time saveFacility/saveAppUser/etc. fires
// 'cp-data-changed'.
function useLiveData(getter) {
  const [snap, setSnap] = React.useState(getter);
  React.useEffect(() => {
    const handler = () => setSnap(getter());
    window.addEventListener('cp-data-changed', handler);
    return () => window.removeEventListener('cp-data-changed', handler);
  }, []);
  return snap;
}

const ROLES = [
  { id: 'admin',    name: 'Admin',             desc: 'Full access across all facilities and settings', scope: 'org' },
  { id: 'regional', name: 'Regional Manager',  desc: 'Manage multiple facilities, plan + approve loads', scope: 'multi' },
  { id: 'facility', name: 'Facility Manager',  desc: 'Plan loads and manage trucks at assigned facility', scope: 'single' },
  { id: 'planner',  name: 'Load Planner',      desc: 'Build and edit load plans at assigned facilities', scope: 'multi' },
  { id: 'viewer',   name: 'Viewer',            desc: 'Read-only — manifests, plans, scenarios', scope: 'multi' },
];

window.CP_ROLES = [
  { id: 'admin',    name: 'Admin' },
  { id: 'regional', name: 'Regional Manager' },
  { id: 'facility', name: 'Facility Manager' },
  { id: 'planner',  name: 'Load Planner' },
  { id: 'viewer',   name: 'Viewer' },
];
window.CP_CAN_EDIT = function(role, area) {
  const map = {
    admin: ['plans','manifest','trucks','users','facilities','org'],
    regional: ['plans','manifest','trucks'],
    facility: ['plans','manifest','trucks'],
    planner: ['plans','manifest'],
    viewer: [],
  };
  return (map[role] || []).includes(area);
};
window.CP_USERS = [
  { id: 'u-01', name: 'Ines Vidal',     email: 'ines@atelier-shipping.com',  role: 'facility', facilities: ['f-bk'],                   status: 'active', invitedAt: '2024-09-12' },
  { id: 'u-02', name: 'Marcus Reilly',  email: 'marcus@atelier-shipping.com',role: 'regional', facilities: ['f-bk','f-lic','f-la'],   status: 'active', invitedAt: '2023-04-02' },
  { id: 'u-03', name: 'Hana Koizumi',   email: 'hana@atelier-shipping.com',  role: 'planner',  facilities: ['f-bk'],                   status: 'active', invitedAt: '2024-11-30' },
  { id: 'u-04', name: 'Diego Salgado',  email: 'diego@atelier-shipping.com', role: 'facility', facilities: ['f-la'],                   status: 'active', invitedAt: '2024-02-18' },
  { id: 'u-05', name: 'Olu Adebayo',    email: 'olu@atelier-shipping.com',   role: 'admin',    facilities: ['f-bk','f-lic','f-la','f-ldn'], status: 'active', invitedAt: '2022-08-09' },
  { id: 'u-06', name: 'Fiona Carrick',  email: 'fiona@atelier-shipping.com', role: 'planner',  facilities: ['f-ldn'],                  status: 'pending', invitedAt: '2026-04-30' },
  { id: 'u-07', name: 'Pat O\u2019Leary',  email: 'pat@atelier-shipping.com',role: 'viewer',   facilities: ['f-bk','f-lic'],          status: 'active', invitedAt: '2025-06-15' },
];

const SEED_USERS = window.CP_USERS;

window.AdminPage = function AdminPage({ onExit }) {
  const [tab, setTab] = useAdminState('users');
  // Live snapshots — refreshed by 'cp-data-changed' so a save in another tab
  // (or in Trucks page, or via the topbar facility menu) updates Admin too.
  const users      = useLiveData(() => window.CP_USERS || []);
  const facilities = useLiveData(() => window.CP_DATA?.facilities || []);
  const data = { facilities }; // legacy access pattern

  const [showInvite, setShowInvite] = useAdminState(false);
  const [showFacility, setShowFacility] = useAdminState(null);
  const [editingUser, setEditingUser] = useAdminState(null);
  const [q, setQ] = useAdminState('');
  const [facFilter, setFacFilter] = useAdminState(null); // facility id or null = all
  const [busyMsg, setBusyMsg] = useAdminState('');

  const facMap = useAdminMemo(() => Object.fromEntries(facilities.map(f => [f.id, f])), [facilities]);

  const filteredUsers = users.filter(u => {
    const matchQ = !q || `${u.name} ${u.email} ${u.role}`.toLowerCase().includes(q.toLowerCase());
    const matchFac = !facFilter || u.facilities.includes(facFilter);
    return matchQ && matchFac;
  });

  const facUserCount = useAdminMemo(() => {
    const m = {};
    facilities.forEach(f => { m[f.id] = users.filter(u => u.facilities.includes(f.id)).length; });
    return m;
  }, [users, facilities]);

  const jumpToFacilityUsers = (fid) => { setFacFilter(fid); setTab('users'); };

  return (
    <div className="admin-wrap">
      <div className="admin-head">
        <div>
          <div className="admin-eyebrow">Organization · settings</div>
          <h1 className="admin-h1"><em>Admin</em> &amp; access control</h1>
          <div className="admin-sub">Invite users, manage facility access, and assign roles across the network.</div>
        </div>
        <div className="admin-stats">
          <div><span className="n">{users.filter(u => u.status==='active').length}</span><span className="l">active users</span></div>
          <div><span className="n">{users.filter(u => u.status==='pending').length}</span><span className="l">pending invites</span></div>
          <div><span className="n">{facilities.length}</span><span className="l">facilities</span></div>
          <div><span className="n">{ROLES.length}</span><span className="l">roles</span></div>
        </div>
      </div>

      <div className="admin-tabs">
        {[
          { id: 'users', label: 'Users', n: '01' },
          { id: 'facilities', label: 'Facilities', n: '02' },
          { id: 'trucks', label: 'Trucks', n: '03' },
          { id: 'roles', label: 'Roles & permissions', n: '04' },
          { id: 'audit', label: 'Audit', n: '05' },
          { id: 'data', label: 'Data', n: '06' },
        ].map(t => (
          <button key={t.id} className={`admin-tab ${tab===t.id?'active':''}`} onClick={() => setTab(t.id)}>
            <span className="num">{t.n}</span> {t.label}
          </button>
        ))}
      </div>

      {tab === 'users' && (
        <section className="admin-section">
          <div className="admin-toolbar">
            <div className="input">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6"><circle cx="11" cy="11" r="6.5"/><path d="m20 20-3.5-3.5"/></svg>
              <input placeholder="Search by name, email, role…" value={q} onChange={e => setQ(e.target.value)} />
            </div>
            <button className="btn accent" onClick={() => setShowInvite(true)}>+ Invite user</button>
          </div>
          <div className="fac-filter-row">
            <span className="fac-filter-label">Filter by facility</span>
            <button className={`fac-filter ${!facFilter ? 'active' : ''}`} onClick={() => setFacFilter(null)}>
              <span className="code">All</span>
              <span className="count">{users.length}</span>
            </button>
            {facilities.map(f => (
              <button key={f.id} className={`fac-filter ${facFilter===f.id ? 'active' : ''}`} onClick={() => setFacFilter(f.id)}>
                <span className="code">{f.code}</span>
                <span className="name">{f.name}</span>
                <span className="count">{facUserCount[f.id]}</span>
              </button>
            ))}
          </div>
          {facFilter && (
            <div className="fac-filter-banner">
              Showing users with access to <strong>{facMap[facFilter]?.name}</strong> · {filteredUsers.length} {filteredUsers.length===1?'user':'users'}
              <button className="btn sm ghost" onClick={() => setFacFilter(null)}>Clear filter</button>
            </div>
          )}
          <table className="admin-table">
            <thead>
              <tr>
                <th>User</th>
                <th>Role</th>
                <th>Facility access</th>
                <th>Status</th>
                <th>Invited</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {filteredUsers.map(u => {
                const role = ROLES.find(r => r.id === u.role);
                return (
                  <tr key={u.id}>
                    <td>
                      <div className="u-cell">
                        <div className="u-avatar">{u.name.split(' ').map(p=>p[0]).slice(0,2).join('')}</div>
                        <div>
                          <div className="u-name">{u.name}</div>
                          <div className="u-email">{u.email}</div>
                        </div>
                      </div>
                    </td>
                    <td><span className={`role-pill r-${u.role}`}>{role?.name}</span></td>
                    <td>
                      <div className="fac-chips">
                        {u.facilities.length === facilities.length
                          ? <span className="fac-chip all">All facilities</span>
                          : u.facilities.map(fid => (
                              <button key={fid} className={`fac-chip clickable ${facFilter===fid?'active':''}`} onClick={() => setFacFilter(fid)} title={`Filter by ${facMap[fid]?.name}`}>{facMap[fid]?.code || fid}</button>
                            ))}
                      </div>
                    </td>
                    <td><span className={`status ${u.status}`}><span className="d" />{u.status}</span></td>
                    <td className="mono muted small">{u.invitedAt}</td>
                    <td className="actions">
                      <button className="btn sm ghost" onClick={() => setEditingUser(u)}>Edit</button>
                      <button className="btn sm ghost danger" onClick={async () => {
                        if (!confirm(`Remove ${u.name}? This deletes their access immediately.`)) return;
                        setBusyMsg('Removing…');
                        const res = await deleteAppUser(u);
                        setBusyMsg('');
                        if (!res.ok) alert(res.error?.message || 'Could not remove user.');
                      }}>Remove</button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </section>
      )}

      {tab === 'facilities' && (
        <section className="admin-section">
          <div className="admin-toolbar">
            <div className="muted small">Facilities are physical locations with their own trucks, dock, and managers.</div>
            <button className="btn accent" onClick={() => setShowFacility({})}>+ Add facility</button>
          </div>
          <div className="fac-grid">
            {facilities.map(f => {
              const managers = users.filter(u => u.facilities.includes(f.id) && (u.role === 'facility' || u.role === 'regional' || u.role === 'admin'));
              return (
                <div key={f.id} className="fac-card">
                  <div className="fac-card-head">
                    <div className="fac-code">{f.code}</div>
                    <div className="fac-card-title">
                      <div className="fac-name">{f.name}</div>
                      <div className="fac-city">{f.city}</div>
                    </div>
                    <div style={{ display: 'flex', gap: 4 }}>
                      <button className="btn sm ghost" onClick={() => setShowFacility(f)}>Edit</button>
                      <button className="btn sm ghost danger" onClick={async () => {
                        if (!confirm(`Delete facility "${f.name}"? Trucks at this facility must be removed first.`)) return;
                        setBusyMsg('Deleting…');
                        const res = await deleteFacility(f);
                        setBusyMsg('');
                        if (!res.ok) alert(res.error?.message || 'Could not delete facility (it may have trucks/jobs attached).');
                      }}>×</button>
                    </div>
                  </div>
                  <div className="fac-meta">
                    <div><span className="k">Address</span><span className="v">{f.address}</span></div>
                    <div><span className="k">Trucks</span><span className="v">{f.trucks}</span></div>
                    <div><span className="k">Users</span><span className="v"><button className="link-btn" onClick={() => jumpToFacilityUsers(f.id)}>{users.filter(u => u.facilities.includes(f.id)).length} →</button></span></div>
                  </div>
                  <div className="fac-managers">
                    <div className="k">Managers</div>
                    <div className="m-list">
                      {managers.length === 0 && <span className="muted small">None assigned</span>}
                      {managers.slice(0, 4).map(m => (
                        <span key={m.id} className="m-chip" title={m.email}>{m.name}</span>
                      ))}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {tab === 'trucks' && <TrucksAdminTab facilities={facilities} setBusyMsg={setBusyMsg} />}

      {tab === 'roles' && (
        <section className="admin-section">
          <div className="admin-toolbar">
            <div className="muted small">Built-in roles. Custom roles coming soon.</div>
          </div>
          <div className="roles-grid">
            {ROLES.map(r => {
              const count = users.filter(u => u.role === r.id).length;
              return (
                <div key={r.id} className="role-card">
                  <div className="role-head">
                    <span className={`role-pill r-${r.id}`}>{r.name}</span>
                    <span className="muted small">{count} {count === 1 ? 'user' : 'users'}</span>
                  </div>
                  <p className="role-desc">{r.desc}</p>
                  <ul className="role-perms">
                    <li className={canEdit(r.id, 'plans') ? 'on' : ''}>Build & edit load plans</li>
                    <li className={canEdit(r.id, 'manifest') ? 'on' : ''}>Add / remove crates from manifest</li>
                    <li className={canEdit(r.id, 'trucks') ? 'on' : ''}>Manage truck fleet</li>
                    <li className={canEdit(r.id, 'users') ? 'on' : ''}>Invite & manage users</li>
                    <li className={canEdit(r.id, 'facilities') ? 'on' : ''}>Add / edit facilities</li>
                    <li className={canEdit(r.id, 'org') ? 'on' : ''}>Org-level settings &amp; billing</li>
                  </ul>
                  <div className="role-scope">
                    <span className="k">Scope</span>
                    <span className="v">{r.scope === 'org' ? 'Organization-wide' : r.scope === 'multi' ? 'One or more facilities' : 'Single facility'}</span>
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {tab === 'audit' && (
        <section className="admin-section">
          <table className="admin-table">
            <thead><tr><th>When</th><th>Actor</th><th>Action</th><th>Target</th></tr></thead>
            <tbody>
              {(window.CP_STORE?.get('audit') ?? (supabaseConfigured ? [] : SEED_AUDIT)).map((a, i) => (
                <tr key={i}>
                  <td className="mono small muted">{a.t && a.t.length > 16 ? new Date(a.t).toLocaleString('en-US',{year:'numeric',month:'short',day:'2-digit',hour:'2-digit',minute:'2-digit'}) : a.t}</td>
                  <td>{a.who}</td>
                  <td><span className={`audit-action ${a.kind}`}>{a.action}</span></td>
                  <td className="mono small">{a.target}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}

      {tab === 'data' && <DataTab />}

      {showInvite && <InviteDialog facilities={facilities} onClose={() => setShowInvite(false)} onInvite={async (u) => {
        setBusyMsg('Saving…');
        const res = await saveAppUser({ ...u, status: 'invited' });
        setBusyMsg('');
        if (res.ok) setShowInvite(false);
        else alert(res.error?.message || 'Could not save user. See console.');
      }} />}
      {editingUser && <EditUserDialog user={editingUser} facilities={facilities} onClose={() => setEditingUser(null)} onSave={async (u) => {
        setBusyMsg('Saving…');
        const res = await saveAppUser({ ...u, _uuid: editingUser._uuid });
        setBusyMsg('');
        if (res.ok) setEditingUser(null);
        else alert(res.error?.message || 'Could not save user. See console.');
      }} />}
      {showFacility !== null && <FacilityDialog facility={showFacility} onClose={() => setShowFacility(null)} onSave={async (f) => {
        const res = await saveFacility(f);
        if (!res.ok) throw new Error(res.error?.message || 'Could not save facility (the code may already be in use).');
        setShowFacility(null);
      }} />}
      {busyMsg && <div style={{ position: 'fixed', bottom: 16, right: 16, padding: '8px 14px', background: 'var(--ink)', color: 'var(--bg)', borderRadius: 4, fontSize: 13, zIndex: 200 }}>{busyMsg}</div>}
    </div>
  );
};

function DataTab() {
  const [importErr, setImportErr] = React.useState(null);
  const [importPreview, setImportPreview] = React.useState(null);
  const [expanded, setExpanded] = React.useState(null);
  const fileRef = React.useRef(null);

  const STORE_KEYS = ['shipments', 'scenarios', 'users', 'audit', 'activeUserId', 'facilityId', 'theme'];

  const buildExport = () => {
    const store = window.CP_STORE;
    const out = {
      __schema: 'cargo-planner-v1',
      __exportedAt: new Date().toISOString(),
      seed: {
        facilities: window.CP_DATA?.facilities || [],
        trucks: window.CP_DATA?.trucks || [],
        crates: window.CP_DATA?.items || [],
        roles: window.CP_ROLES || [],
      },
      live: {},
    };
    STORE_KEYS.forEach(k => { out.live[k] = store?.get(k, null); });
    return out;
  };

  const downloadJSON = () => {
    const blob = new Blob([JSON.stringify(buildExport(), null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `cargo-planner-${new Date().toISOString().slice(0,10)}.json`;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  const onPickFile = (e) => {
    const f = e.target.files?.[0];
    if (!f) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const parsed = JSON.parse(ev.target.result);
        if (parsed.__schema !== 'cargo-planner-v1') throw new Error('Wrong schema. Expected cargo-planner-v1.');
        if (!parsed.live) throw new Error('Missing "live" key.');
        setImportPreview(parsed);
        setImportErr(null);
      } catch (err) {
        setImportErr(err.message);
        setImportPreview(null);
      }
    };
    reader.readAsText(f);
  };

  const applyImport = () => {
    if (!importPreview) return;
    Object.entries(importPreview.live || {}).forEach(([k, v]) => {
      if (v !== null) window.CP_STORE?.set(k, v);
    });
    setImportPreview(null);
    setImportErr(null);
    if (fileRef.current) fileRef.current.value = '';
    setTimeout(() => window.location.reload(), 200);
  };

  const clearLocal = () => {
    if (!confirm('Wipe all local state and reload? This cannot be undone unless you exported first.')) return;
    try { localStorage.removeItem('cp_v1'); } catch {}
    window.location.reload();
  };

  // Live data model preview
  const live = (() => {
    const store = window.CP_STORE;
    return {
      facilities: window.CP_DATA?.facilities || [],
      trucks: window.CP_DATA?.trucks || [],
      crates: window.CP_DATA?.items || [],
      users: store?.get('users', window.CP_USERS || []),
      shipments: store?.get('shipments', []),
      scenarios: store?.get('scenarios', []),
      audit: store?.get('audit', []),
    };
  })();

  return (
    <section className="admin-section">
      <div className="data-grid">
        <div className="data-card">
          <div className="data-card-eyebrow">Backup &amp; restore</div>
          <h3 className="data-card-h">Export <em>all data</em> as JSON</h3>
          <p className="data-card-p">Bundles seed reference data (facilities, trucks, crates, roles) and your live state (shipments, scenarios, users, audit, preferences) into a single portable file. Use this to seed a real database or move state between machines.</p>
          <div className="data-actions">
            <button className="btn primary" onClick={downloadJSON}>Download JSON</button>
            <span className="muted small">→ <code>cargo-planner-{new Date().toISOString().slice(0,10)}.json</code></span>
          </div>
        </div>

        <div className="data-card">
          <div className="data-card-eyebrow">Restore from backup</div>
          <h3 className="data-card-h">Import <em>JSON</em></h3>
          <p className="data-card-p">Restore a previously-exported file. Overwrites live state in this browser and reloads. Seed reference data is ignored on import — only the <code>live</code> section is applied.</p>
          <div className="data-actions">
            <input ref={fileRef} type="file" accept="application/json" onChange={onPickFile} className="data-file" />
          </div>
          {importErr && <div className="data-err">⚠ {importErr}</div>}
          {importPreview && (
            <div className="data-preview">
              <div className="muted small">Ready to import — exported <span className="mono">{importPreview.__exportedAt?.slice(0,16)}</span></div>
              <ul className="data-preview-list">
                {Object.entries(importPreview.live || {}).map(([k, v]) => (
                  <li key={k}><span className="mono">{k}</span><span className="muted small">{Array.isArray(v) ? `${v.length} entries` : v === null ? 'empty' : typeof v}</span></li>
                ))}
              </ul>
              <div className="data-actions">
                <button className="btn primary" onClick={applyImport}>Apply &amp; reload</button>
                <button className="btn ghost" onClick={() => { setImportPreview(null); if (fileRef.current) fileRef.current.value = ''; }}>Cancel</button>
              </div>
            </div>
          )}
        </div>

        <div className="data-card danger">
          <div className="data-card-eyebrow">Reset</div>
          <h3 className="data-card-h">Wipe <em>local state</em></h3>
          <p className="data-card-p">Clears all live state in this browser and reloads. Reference seeds (facilities, trucks, crates) come back from the bundled fixtures. Export first if you want to keep anything.</p>
          <div className="data-actions">
            <button className="btn ghost danger" onClick={clearLocal}>Wipe &amp; reload</button>
          </div>
        </div>
      </div>

      <div className="data-section-head">
        <div>
          <div className="admin-eyebrow">Live data model</div>
          <h3 className="data-h2"><em>Entities</em> — shapes &amp; counts</h3>
        </div>
        <div className="muted small">For developer reference. Click any entity to inspect a sample record.</div>
      </div>

      <div className="data-entities">
        {Object.entries(live).map(([key, arr]) => {
          const count = Array.isArray(arr) ? arr.length : 0;
          const sample = count > 0 ? arr[0] : null;
          const fields = sample ? Object.keys(sample) : [];
          const isOpen = expanded === key;
          return (
            <div key={key} className={`data-entity ${isOpen ? 'open' : ''}`}>
              <button className="data-entity-head" onClick={() => setExpanded(isOpen ? null : key)}>
                <div className="data-entity-name">
                  <span className="data-entity-dot" />
                  <span className="mono">{key}</span>
                </div>
                <div className="data-entity-meta">
                  <span className="mono">{count}</span>
                  <span className="muted small">{count === 1 ? 'record' : 'records'}</span>
                  <span className="data-chev">{isOpen ? '−' : '+'}</span>
                </div>
              </button>
              {isOpen && (
                <div className="data-entity-body">
                  {sample ? (
                    <>
                      <div className="data-fields">
                        <div className="muted small data-fields-label">Fields ({fields.length})</div>
                        <div className="data-field-grid">
                          {fields.map(f => {
                            const v = sample[f];
                            const t = v === null ? 'null' : Array.isArray(v) ? 'array' : typeof v;
                            return (
                              <div key={f} className="data-field">
                                <span className="mono small">{f}</span>
                                <span className="data-field-t">{t}</span>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                      <div className="data-sample">
                        <div className="muted small data-fields-label">Sample record</div>
                        <pre className="data-pre">{JSON.stringify(sample, null, 2)}</pre>
                      </div>
                    </>
                  ) : (
                    <div className="muted small" style={{ padding: '12px 16px' }}>No records yet.</div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
}

function canEdit(role, area) {
  const map = {
    admin:    ['plans','manifest','trucks','users','facilities','org'],
    regional: ['plans','manifest','trucks','users'],
    facility: ['plans','manifest','trucks'],
    planner:  ['plans','manifest'],
    viewer:   [],
  };
  return (map[role] || []).includes(area);
}

const SEED_AUDIT = [
  { t: '2026-05-09 12:42', who: 'Ines Vidal',    kind: 'edit',   action: 'Updated load plan',          target: 'FRZ-2026-05 / BK-04' },
  { t: '2026-05-09 11:08', who: 'Marcus Reilly', kind: 'invite', action: 'Invited user',               target: 'fiona@atelier-shipping.com' },
  { t: '2026-05-08 17:55', who: 'Olu Adebayo',   kind: 'role',   action: 'Changed role',               target: 'Hana Koizumi → Load Planner' },
  { t: '2026-05-08 09:22', who: 'Diego Salgado', kind: 'edit',   action: 'Added truck',                target: 'LA-12 · Sprinter 3500' },
  { t: '2026-05-07 16:03', who: 'Marcus Reilly', kind: 'fac',    action: 'Granted facility access',    target: 'Hana Koizumi → LIC' },
  { t: '2026-05-07 10:14', who: 'Ines Vidal',    kind: 'edit',   action: 'Saved scenario',             target: 'Frieze Pickup — BK→LDN' },
];

function InviteDialog({ facilities, onClose, onInvite }) {
  const [form, setForm] = useAdminState({ name: '', email: '', role: 'planner', facilities: [] });
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));
  const toggleFac = (fid) => set('facilities', form.facilities.includes(fid) ? form.facilities.filter(x => x !== fid) : [...form.facilities, fid]);
  return (
    <div className="dialog-mask" onClick={onClose}>
      <div className="dialog" onClick={e => e.stopPropagation()}>
        <div className="dialog-head"><h3>Invite <em>user</em></h3><button className="icon-btn" onClick={onClose}>×</button></div>
        <div className="dialog-body">
          <div className="grid-2">
            <div className="field"><label>Full name</label><input value={form.name} onChange={e => set('name', e.target.value)} placeholder="Jane Doe" /></div>
            <div className="field"><label>Work email</label><input type="email" value={form.email} onChange={e => set('email', e.target.value)} placeholder="jane@company.com" /></div>
          </div>
          <div className="field">
            <label>Role</label>
            <div className="role-picker">
              {ROLES.map(r => (
                <button key={r.id} type="button" className={`role-opt ${form.role===r.id?'active':''}`} onClick={() => set('role', r.id)}>
                  <span className="t">{r.name}</span>
                  <span className="d">{r.desc}</span>
                </button>
              ))}
            </div>
          </div>
          <div className="field">
            <label>Facility access {form.role === 'admin' && <span className="muted small">(admins always have all)</span>}</label>
            <div className="fac-picker">
              {facilities.map(f => (
                <button key={f.id} type="button"
                  className={`fac-opt ${form.facilities.includes(f.id) || form.role==='admin' ? 'on' : ''}`}
                  onClick={() => form.role!=='admin' && toggleFac(f.id)}
                  disabled={form.role==='admin'}>
                  <span className="code">{f.code}</span>
                  <span className="nm">{f.name}</span>
                  <span className="ct">{f.city}</span>
                </button>
              ))}
            </div>
          </div>
        </div>
        <div className="dialog-foot">
          <button className="btn" onClick={onClose}>Cancel</button>
          <button className="btn primary" disabled={!form.name || !form.email} onClick={() => onInvite({
            ...form,
            facilities: form.role==='admin' ? facilities.map(f=>f.id) : form.facilities,
          })}>Send invite</button>
        </div>
      </div>
    </div>
  );
}

function EditUserDialog({ user, facilities, onClose, onSave }) {
  const [form, setForm] = useAdminState(user);
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));
  const toggleFac = (fid) => set('facilities', form.facilities.includes(fid) ? form.facilities.filter(x => x !== fid) : [...form.facilities, fid]);
  return (
    <div className="dialog-mask" onClick={onClose}>
      <div className="dialog" onClick={e => e.stopPropagation()}>
        <div className="dialog-head"><h3>Edit <em>{user.name}</em></h3><button className="icon-btn" onClick={onClose}>×</button></div>
        <div className="dialog-body">
          <div className="field">
            <label>Role</label>
            <div className="role-picker">
              {ROLES.map(r => (
                <button key={r.id} type="button" className={`role-opt ${form.role===r.id?'active':''}`} onClick={() => set('role', r.id)}>
                  <span className="t">{r.name}</span>
                  <span className="d">{r.desc}</span>
                </button>
              ))}
            </div>
          </div>
          <div className="field">
            <label>Facility access</label>
            <div className="fac-picker">
              {facilities.map(f => (
                <button key={f.id} type="button"
                  className={`fac-opt ${form.facilities.includes(f.id) || form.role==='admin' ? 'on' : ''}`}
                  onClick={() => form.role!=='admin' && toggleFac(f.id)}
                  disabled={form.role==='admin'}>
                  <span className="code">{f.code}</span>
                  <span className="nm">{f.name}</span>
                  <span className="ct">{f.city}</span>
                </button>
              ))}
            </div>
          </div>
          <div className="field">
            <label>Status</label>
            <select value={form.status} onChange={e => set('status', e.target.value)}>
              <option value="active">Active</option>
              <option value="pending">Pending invite</option>
              <option value="suspended">Suspended</option>
            </select>
          </div>
        </div>
        <div className="dialog-foot">
          <button className="btn" onClick={onClose}>Cancel</button>
          <button className="btn primary" onClick={() => onSave({
            ...form,
            facilities: form.role==='admin' ? facilities.map(f=>f.id) : form.facilities,
          })}>Save changes</button>
        </div>
      </div>
    </div>
  );
}

function FacilityDialog({ facility, onClose, onSave }) {
  const [form, setForm] = useAdminState(facility.id
    ? { ...facility, address: [facility.address, facility.city].filter(Boolean).join(', ') }
    : { code: '', name: '', address: '', trucks: 0, users: 0 });
  const [saving, setSaving] = useAdminState(false);
  const [err, setErr] = useAdminState('');
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  async function handleSave() {
    if (saving) return;
    setSaving(true);
    setErr('');
    try {
      // Single-line address: stash the whole thing in `address`, leave `city` null.
      // The fac-card already displays `address` so nothing else changes.
      await onSave({ ...form, city: null });
    } catch (e) {
      setErr(e?.message || 'Save failed');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="dialog-mask" onClick={saving ? undefined : onClose}>
      <div className="dialog" onClick={e => e.stopPropagation()}>
        <div className="dialog-head"><h3>{facility.id ? 'Edit' : 'Add'} <em>facility</em></h3><button className="icon-btn" onClick={onClose} disabled={saving}>×</button></div>
        <div className="dialog-body">
          <div className="grid-2">
            <div className="field"><label>Code (3 letters)</label><input value={form.code} onChange={e => set('code', e.target.value.toUpperCase().slice(0,3))} placeholder="CHI" autoFocus /></div>
            <div className="field"><label>Name</label><input value={form.name} onChange={e => set('name', e.target.value)} placeholder="Chicago Vault" /></div>
          </div>
          <div className="field">
            <label>Address</label>
            <input value={form.address} onChange={e => set('address', e.target.value)} placeholder="2552 W Ogden Ave Chicago, IL 60608" />
          </div>
          {err && <div style={{ color: 'var(--danger)', fontSize: 13, marginTop: 8 }}>{err}</div>}
        </div>
        <div className="dialog-foot">
          <button className="btn" onClick={onClose} disabled={saving}>Cancel</button>
          <button className="btn primary" disabled={!form.code || !form.name || saving} onClick={handleSave}>
            {saving ? 'Saving…' : 'Save'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ----------------------------------------------------------------------
// TrucksAdminTab — fleet management lives inside Admin so all CRUD is in
// one place. Reuses the existing TruckDialog from pages.jsx via window.
// ----------------------------------------------------------------------
function TrucksAdminTab({ facilities, setBusyMsg }) {
  const trucks = useLiveData(() => window.CP_DATA?.trucks || []);
  const [facFilter, setFacFilter] = useAdminState('all');
  const [q, setQ] = useAdminState('');
  const [editing, setEditing] = useAdminState(null);
  const [showNew, setShowNew] = useAdminState(false);
  const TruckDialog = window.CP_TruckDialog;
  const facMap = Object.fromEntries(facilities.map(f => [f.id, f]));
  const filtered = trucks.filter(t =>
    (facFilter === 'all' || t.facility === facFilter) &&
    (!q || `${t.ref} ${t.model} ${t.type}`.toLowerCase().includes(q.toLowerCase()))
  );

  return (
    <section className="admin-section">
      <div className="admin-toolbar">
        <div className="input">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6"><circle cx="11" cy="11" r="6.5"/><path d="m20 20-3.5-3.5"/></svg>
          <input placeholder="Search by ref or model…" value={q} onChange={e => setQ(e.target.value)} />
        </div>
        <button className="btn accent" onClick={() => setShowNew(true)} disabled={facilities.length === 0}>+ Add truck</button>
      </div>

      {facilities.length === 0 && (
        <div className="muted small" style={{ padding: 12, marginTop: 8, border: '1px dashed var(--line)', borderRadius: 4 }}>
          You need to create a facility first. Go to the <strong>Facilities</strong> tab and add one, then come back here.
        </div>
      )}

      {facilities.length > 0 && (
        <div className="fac-filter-row" style={{ marginTop: 12 }}>
          <span className="fac-filter-label">Facility</span>
          <button className={`fac-filter ${facFilter==='all' ? 'active' : ''}`} onClick={() => setFacFilter('all')}>
            <span className="name">All</span>
            <span className="count">{trucks.length}</span>
          </button>
          {facilities.map(f => (
            <button key={f.id} className={`fac-filter ${facFilter===f.id ? 'active' : ''}`} onClick={() => setFacFilter(f.id)}>
              <span className="code">{f.code}</span>
              <span className="count">{trucks.filter(t => t.facility === f.id).length}</span>
            </button>
          ))}
        </div>
      )}

      <table className="admin-table" style={{ marginTop: 12 }}>
        <thead>
          <tr>
            <th>Ref</th><th>Model</th><th>Type</th><th>Facility</th>
            <th>L×W×H</th><th>Max lbs</th><th></th>
          </tr>
        </thead>
        <tbody>
          {filtered.length === 0 ? (
            <tr><td colSpan={7} className="muted small" style={{ padding: 14, textAlign: 'center' }}>
              {trucks.length === 0 ? 'No trucks yet — click "+ Add truck" to add one.' : 'No matches.'}
            </td></tr>
          ) : (
            filtered.map(t => (
              <tr key={t.id}>
                <td className="mono small">{t.ref}</td>
                <td>{t.model}</td>
                <td className="muted small">{t.type}</td>
                <td className="mono small">{facMap[t.facility]?.code || '—'}</td>
                <td className="mono small">{t.L}×{t.W}×{t.H}″</td>
                <td className="mono small">{t.maxLbs?.toLocaleString()}</td>
                <td className="actions">
                  <button className="btn sm ghost" onClick={() => setEditing(t)}>Edit</button>
                </td>
              </tr>
            ))
          )}
        </tbody>
      </table>

      {editing && TruckDialog && <TruckDialog truck={editing} facilities={facilities} onClose={() => setEditing(null)}
        onSave={async (t) => {
          const res = await saveTruck({ ...t, _uuid: editing._uuid });
          if (!res.ok) throw new Error(res.error?.message || 'Could not save truck.');
          setEditing(null);
        }}
        onDelete={async () => {
          if (!confirm('Delete this truck? It must not be in any saved scenario.')) return;
          setBusyMsg('Deleting…');
          const res = await deleteTruck(editing);
          setBusyMsg('');
          if (res.ok) setEditing(null);
          else alert(res.error?.message || 'Could not delete truck.');
        }} />}
      {showNew && TruckDialog && <TruckDialog truck={null} facilities={facilities} onClose={() => setShowNew(false)}
        onSave={async (t) => {
          const res = await saveTruck(t);
          if (!res.ok) throw new Error(res.error?.message || 'Could not save truck.');
          setShowNew(false);
        }} />}
    </section>
  );
}

Object.assign(window, { AdminPage: window.AdminPage });
