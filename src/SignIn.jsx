import React from 'react';
import { signInWithMagicLink } from './auth.js';

export function SignIn() {
  const [email, setEmail] = React.useState('');
  const [state, setState] = React.useState('idle'); // 'idle' | 'sending' | 'sent' | 'error'
  const [errMsg, setErrMsg] = React.useState('');

  async function onSubmit(e) {
    e.preventDefault();
    setState('sending');
    setErrMsg('');
    try {
      await signInWithMagicLink(email.trim().toLowerCase());
      setState('sent');
    } catch (err) {
      console.error(err);
      setState('error');
      setErrMsg(err?.message || 'Could not send the magic link.');
    }
  }

  return (
    <div className="signin-shell">
      <div className="signin-card">
        <header>
          <p className="eyebrow mono">Cargo Planner</p>
          <h1>Sign in</h1>
          <p className="sub">A magic link will be emailed to you. Access is invite-only — your email must be on the team list.</p>
        </header>

        {state === 'sent' ? (
          <div className="signin-sent">
            <p className="big">Check your inbox.</p>
            <p className="sub">A link has been sent to <strong>{email}</strong>. Click it to sign in. The link expires shortly.</p>
            <button className="link-btn" onClick={() => { setState('idle'); setEmail(''); }}>Use a different email</button>
          </div>
        ) : (
          <form onSubmit={onSubmit}>
            <label htmlFor="signin-email" className="label">Work email</label>
            <input
              id="signin-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@company.com"
              required
              autoFocus
              autoComplete="email"
            />
            <button type="submit" className="signin-submit" disabled={state === 'sending' || !email}>
              {state === 'sending' ? 'Sending…' : 'Send magic link'}
            </button>
            {state === 'error' && <p className="signin-err">{errMsg}</p>}
          </form>
        )}

        <footer>
          <p className="mono small muted">Atelier Build · {new Date().getFullYear()}</p>
        </footer>
      </div>
    </div>
  );
}

export function NotInvited({ email, onRetry }) {
  return (
    <div className="signin-shell">
      <div className="signin-card">
        <header>
          <p className="eyebrow mono">Access denied</p>
          <h1>You're not on the team list.</h1>
          <p className="sub">
            We received a sign-in attempt from <strong>{email}</strong>, but that email isn't in the Cargo Planner user roster.
            Ask an administrator to add you, then try again.
          </p>
        </header>
        <button className="signin-submit" onClick={onRetry}>Sign out and try a different email</button>
      </div>
    </div>
  );
}
