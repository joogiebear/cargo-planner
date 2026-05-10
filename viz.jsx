/* global React */
// 3D/Iso/Top truck visualization

const { useMemo, useEffect, useRef, useState } = React;

// Bin packer — simple shelf packing along truck length, then stack within shelves.
// Inputs items as {id, L, W, H, lbs, fragile, orient, stack, medium}
// Truck dims (L, W, H) in inches.
// Returns { placed: [{id, x,y,z, L,W,H}], unplaced: [...], }
window.packTruck = function packTruck(truck, items, opts = {}) {
  const { fragileTop = true, balance = true } = opts;
  const T = { L: truck.L, W: truck.W, H: truck.H };
  // Sort: heaviest first, non-stackable first
  const queue = [...items].sort((a, b) => {
    if (a.fragile !== b.fragile) return a.fragile ? 1 : -1; // non-fragile first (bottom)
    if (a.stack !== b.stack)   return a.stack ? 1 : -1;     // non-stack first
    if (b.lbs !== a.lbs)       return b.lbs - a.lbs;
    return (b.L * b.W * b.H) - (a.L * a.W * a.H);
  });

  // Layered packing: rows along L, columns along W, with stacking
  const placed = [];
  const unplaced = [];
  // grid of "ceiling height" at (xCol, zCol) cell of 12in
  const cell = 12;
  const cols = Math.ceil(T.L / cell);
  const rows = Math.ceil(T.W / cell);
  const ceiling = Array(cols * rows).fill(0); // y top in inches
  const baseFlag = Array(cols * rows).fill(true); // can place on floor
  const ceilFragile = Array(cols * rows).fill(false); // fragile beneath

  // Try orientations honoring flat/glass/UP flags.
  // 'flat' = must lie flat (smallest dim becomes H).
  // 'glass' = long side parallel to truck length (longest dim along L) and must touch a side wall.
  const orientations = (it) => {
    const dims = [it.L, it.W, it.H].slice().sort((a, b) => b - a); // [max, mid, min]
    if (it.flat) {
      // H = smallest, footprint = max x mid in either rotation
      return [
        { L: dims[0], W: dims[1], H: dims[2] },
        { L: dims[1], W: dims[0], H: dims[2] },
      ];
    }
    if (it.glass) {
      // long side parallel to L; H locked upright (next-largest)
      return [{ L: dims[0], W: dims[2], H: dims[1] }];
    }
    if (it.orient === 'UP') {
      return [{L: it.L, W: it.W, H: it.H}, {L: it.W, W: it.L, H: it.H}];
    }
    return [
      {L: it.L, W: it.W, H: it.H},
      {L: it.W, W: it.L, H: it.H},
      {L: it.L, W: it.H, H: it.W},
      {L: it.H, W: it.L, H: it.W},
    ];
  };

  for (const it of queue) {
    let best = null;
    for (const o of orientations(it)) {
      if (o.L > T.L || o.W > T.W || o.H > T.H) continue;
      const cL = Math.ceil(o.L / cell), cW = Math.ceil(o.W / cell);
      // scan grid
      for (let z = 0; z + cW <= rows; z++) {
        for (let x = 0; x + cL <= cols; x++) {
          // find max ceiling under footprint
          let maxY = 0; let anyFragileBelow = false;
          for (let zz = z; zz < z + cW; zz++) {
            for (let xx = x; xx < x + cL; xx++) {
              const i = zz * cols + xx;
              if (ceiling[i] > maxY) maxY = ceiling[i];
              if (ceilFragile[i]) anyFragileBelow = true;
            }
          }
          if (maxY + o.H > T.H) continue;
          if (anyFragileBelow && !it.stack) continue;
          if (it.stack === false && maxY > 0) continue;
          if (fragileTop && it.fragile && maxY > 0 && !it.stack) continue;
          // Glass crates must hug a side wall (z=0 or z=W) to avoid spanning the door
          if (it.glass) {
            const touchesSide = (z === 0) || (z + cW === rows);
            if (!touchesSide) continue;
          }
          // Score: lower y, then lower x, then lower z
          const score = maxY * 1000000 + x * 1000 + z;
          if (!best || score < best.score) {
            best = { score, x: x * cell, y: maxY, z: z * cell, o, cx: x, cz: z, cL, cW };
          }
        }
      }
    }
    if (best) {
      placed.push({ id: it.id, x: best.x, y: best.y, z: best.z, L: best.o.L, W: best.o.W, H: best.o.H, item: it });
      // mark ceiling
      for (let zz = best.cz; zz < best.cz + best.cW; zz++) {
        for (let xx = best.cx; xx < best.cx + best.cL; xx++) {
          const i = zz * cols + xx;
          ceiling[i] = best.y + best.o.H;
          if (it.fragile) ceilFragile[i] = true;
          baseFlag[i] = false;
        }
      }
    } else {
      unplaced.push(it);
    }
  }
  return { placed, unplaced };
};

// 3D scene component
function Scene({ truck, placed, view = 'iso', dropAnim = false, theme = 'light' }) {
  const wrapRef = useRef(null);
  const [size, setSize] = useState({ w: 800, h: 480 });
  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => {
      const r = el.getBoundingClientRect();
      setSize({ w: r.width, h: r.height });
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // Compute scale: fit truck length within 78% of canvas width, plus depth foreshortening
  const margin = 28;
  const availW = size.w - margin * 2;
  const availH = size.h - margin * 2;

  // For iso/3D, the on-screen footprint is roughly L (across) and W*sin(rot) projected
  // We'll compute per-view scale and rotations.
  const view3D = view === '3d';
  const viewIso = view === 'iso';
  const viewTop = view === 'top';

  let rotX, rotY;
  if (viewTop) { rotX = -90; rotY = 0; }
  else if (viewIso) { rotX = -32; rotY = -45; }
  else { rotX = -16; rotY = -28; } // 3d perspective

  // Estimate projected bounding box (rough)
  const radX = (rotX * Math.PI) / 180;
  const radY = (rotY * Math.PI) / 180;
  // After rotateY then rotateX:
  // x' = L*cos(rotY) + W*sin(rotY)
  // y' = (L*sin(rotY) - W*cos(rotY)) * sin(-rotX) + H*cos(rotX)
  const projW = Math.abs(truck.L * Math.cos(radY)) + Math.abs(truck.W * Math.sin(radY));
  const projH = viewTop
    ? truck.W
    : Math.abs((truck.L * Math.sin(radY) - truck.W * Math.cos(radY)) * Math.sin(-radX)) + Math.abs(truck.H * Math.cos(radX));

  const scale = Math.min(availW / projW, availH / projH) * 0.78;

  // Camera transform
  const worldStyle = {
    transform: `translate3d(0,0,0) scale(${scale}) rotateX(${rotX}deg) rotateY(${rotY}deg)`,
    width: 0, height: 0,
  };

  return (
    <div className="scene" ref={wrapRef}>
      <div className="world" style={worldStyle}>
        {/* truck shell — edge wireframe only, faces hidden so cargo reads cleanly */}
        <div
          className="cuboid truck-shell"
          style={{
            transform: `translate3d(${-truck.L/2}px, ${-truck.H/2}px, ${-truck.W/2}px)`,
          }}
        >
          {renderTruckShell(truck.L, truck.W, truck.H)}
        </div>

        {/* boxes — sit on the floor: floor is at y = +truck.H/2 in world.
            box origin is its top-front-left corner; box extends +Y (down) by p.H.
            so origin Y = floorY - p.H - p.y, where p.y is stack height above floor. */}
        {placed.map((p, idx) => {
          const bx = -truck.L / 2 + p.x;
          const by = truck.H / 2 - p.H - p.y;
          const bz = -truck.W / 2 + p.z;
          const cls = `cuboid box-${p.item.medium}${dropAnim ? ' dropping' : ''}`;
          const style = {
            transform: `translate3d(${bx}px, ${by}px, ${bz}px)`,
            ['--bx']: `${bx}px`,
            ['--by']: `${by}px`,
            ['--bz']: `${bz}px`,
            animationDelay: dropAnim ? `${idx * 30}ms` : undefined,
          };
          return (
            <div key={p.id} className={cls} style={style}>
              {renderFaces(p.L, p.W, p.H, true, {
                stencil: `${p.item.ref}\n${p.item.medium}  ${p.L}\u00d7${p.W}\u00d7${p.H}`,
                fragile: p.item.fragile ? 'FRAGILE \u2191\u2191' : '',
              })}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function renderFaces(L, W, H, isBox, stencil) {
  const faces = [
    { cls: 'face bottom', w: L, h: W, t: `translateY(${H}px) rotateX(90deg)` },
    { cls: 'face top',    w: L, h: W, t: `rotateX(90deg)` },
    { cls: 'face front',  w: L, h: H, t: `` },
    { cls: 'face back',   w: L, h: H, t: `translateZ(${W}px)` },
    { cls: 'face left',   w: W, h: H, t: `rotateY(-90deg)` },
    { cls: 'face right',  w: W, h: H, t: `translateX(${L}px) rotateY(-90deg)` },
  ];
  return faces.map((f, i) => {
    const props = { width: f.w, height: f.h, transform: f.t };
    const extra = {};
    if (stencil && f.cls.includes('front')) {
      extra['data-stencil'] = stencil.stencil;
      extra['data-fragile'] = stencil.fragile;
    }
    if (stencil && f.cls.includes('right')) {
      extra['data-stencil'] = stencil.stencil;
    }
    return (
      <div key={i} className={f.cls} style={props} {...extra} />
    );
  });
}

function renderTruckShell(L, W, H) {
  // All six walls as ultra-faint translucent panes so the truck reads as a
  // closed volume; cargo behind/inside still shows through.
  return (
    <>
      <div className="t-floor" style={{ width: L, height: W, transform: `translateY(${H}px) rotateX(90deg)` }} />
      <div className="t-ceil"  style={{ width: L, height: W, transform: `rotateX(90deg)` }} />
      <div className="t-wall"  style={{ width: L, height: H, transform: `translateZ(${W}px)` }} />
      <div className="t-wall t-near" style={{ width: L, height: H, transform: `` }} />
      <div className="t-wall"  style={{ width: W, height: H, transform: `rotateY(-90deg)` }} />
      <div className="t-wall"  style={{ width: W, height: H, transform: `translateX(${L}px) rotateY(-90deg)` }} />
      {[
        { w: L, h: 0, t: `translateY(${H}px)` },
        { w: L, h: 0, t: `translateY(${H}px) translateZ(${W}px)` },
        { w: L, h: 0, t: `` },
        { w: L, h: 0, t: `translateZ(${W}px)` },
      ].map((e, i) => (
        <div key={'h'+i} className="t-edge" style={{ width: e.w, height: 1, transform: e.t }} />
      ))}
      {[
        { vert: W, t: `translateY(${H}px)` },
        { vert: W, t: `translateY(${H}px) translateX(${L}px)` },
        { vert: W, t: `` },
        { vert: W, t: `translateX(${L}px)` },
      ].map((e, i) => (
        <div key={'d'+i} className="t-edge" style={{ width: e.vert, height: 1, transform: `${e.t} rotateY(-90deg)` }} />
      ))}
      {[``, `translateX(${L}px)`, `translateZ(${W}px)`, `translateX(${L}px) translateZ(${W}px)`].map((t, i) => (
        <div key={'v'+i} className="t-edge" style={{ width: 1, height: H, transform: t }} />
      ))}
    </>
  );
}

window.CP_Scene = Scene;
