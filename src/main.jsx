import React from 'react';
import ReactDOM from 'react-dom/client';

import './styles.css';
import './admin.css';
import './pages.css';

// IMPORTANT: data.js + the seed-data scripts must run *before* loadReferenceData,
// because the loader patches the same globals (window.CP_DATA, window.CP_USERS).
import './data.js';
import './tweaks-panel.jsx';
import './viz.jsx';
import './admin.jsx';
import './pages.jsx';
import './app.jsx'; // sets up CP_STORE on window
import { AuthGate } from './AuthGate.jsx';

import { loadReferenceData, hydrateUserData } from './loadData.js';

const root = ReactDOM.createRoot(document.getElementById('root'));

(async () => {
  try {
    const result = await loadReferenceData();
    if (result.ok) {
      console.log('[supabase] loaded reference data:', result.counts);
    } else {
      console.warn(`[supabase] using local seed (reason: ${result.reason}). App will still work.`);
    }
  } catch (err) {
    console.error('[supabase] unexpected boot error, using local seed:', err);
  }

  root.render(<AuthGate />);

  // Fire-and-forget: scenarios + audit hydrate after first paint.
  // Components subscribe to CP_STORE and re-render when these land.
  hydrateUserData()
    .then(r => r.ok && console.log('[supabase] hydrated user data:', r.counts))
    .catch(err => console.error('[supabase] user-data hydration failed:', err));
})();
