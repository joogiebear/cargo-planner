import React from 'react';
import { App } from './app.jsx';
import { SignIn, NotInvited } from './SignIn.jsx';
import { getSession, onAuthStateChange, resolveAppUser, signOut } from './auth.js';
import { supabaseConfigured } from './supabase.js';

const Loading = () => (
  <div className="signin-shell">
    <div className="signin-card" style={{ textAlign: 'center' }}>
      <p className="eyebrow mono">Cargo Planner</p>
      <p>Loading…</p>
    </div>
  </div>
);

export function AuthGate() {
  const [state, setState] = React.useState({ status: 'loading' });

  React.useEffect(() => {
    if (!supabaseConfigured) {
      // Local-only mode — no auth, fall back to the picker
      setState({ status: 'unauthed-mode' });
      return;
    }

    let mounted = true;

    async function applySession(session) {
      if (!session) {
        if (mounted) setState({ status: 'signed-out' });
        return;
      }
      const user = await resolveAppUser(session);
      if (!mounted) return;
      if (!user || user.suspended) {
        setState({ status: 'not-invited', email: session.user?.email });
        return;
      }
      setState({ status: 'signed-in', user });
    }

    getSession().then(applySession);
    const off = onAuthStateChange(applySession);
    return () => { mounted = false; off(); };
  }, []);

  if (state.status === 'loading') return <Loading />;
  if (state.status === 'unauthed-mode') return <App authedUser={null} onSignOut={null} />;
  if (state.status === 'signed-out') return <SignIn />;
  if (state.status === 'not-invited') return <NotInvited email={state.email} onRetry={() => signOut()} />;
  return <App authedUser={state.user} onSignOut={() => signOut()} />;
}
