import React, { useState } from 'react';

export default function Dashboard({ user, onSignedOut, theme, onToggleTheme }) {
  const [error, setError] = useState('');

  async function signOut() {
    try {
      const response = await fetch('/api/auth/logout', { method: 'POST' });
      if (!response.ok) throw new Error('Sign out failed');
      onSignedOut();
    } catch {
      setError('We could not sign you out. Please try again.');
    }
  }

  return (
    <main className="dashboard-shell">
      <header className="dashboard-header">
        <div className="brand-lockup">
          <div className="brand-mark" aria-hidden="true">C</div>
          <div>
            <p className="brand-name">CGC <span>University</span></p>
            <p className="brand-caption">CAMPUS PORTAL</p>
          </div>
        </div>
        <div className="dashboard-actions">
          <button type="button" className="theme-toggle" onClick={onToggleTheme}>
            {theme === 'light' ? '◐ Dark mode' : '☼ Light mode'}
          </button>
          <button type="button" className="signout-button" onClick={signOut}>Sign out</button>
        </div>
      </header>
      <section className="dashboard-content">
        <p className="eyebrow">CGC UNIVERSITY · {user.accountType.toUpperCase()}</p>
        <h1>Good to have you here, {user.displayName}.</h1>
        <p className="dashboard-lede">You’re signed in to your campus portal.</p>
        {error && <p className="feedback error" role="status">{error}</p>}
        <div className="dashboard-card">
          <span className="dashboard-card-icon" aria-hidden="true">✓</span>
          <div>
            <h2>Your account is connected</h2>
            <p>Campus services linked to your account will be available here.</p>
          </div>
        </div>
      </section>
    </main>
  );
}
