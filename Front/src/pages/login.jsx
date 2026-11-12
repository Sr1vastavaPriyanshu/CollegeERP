import React, { useState } from 'react';

const initialFeedback = { kind: '', message: '' };

export default function LoginPage({
  resetToken = '',
  theme,
  onToggleTheme,
  onAuthenticated,
}) {
  const [mode, setMode] = useState(resetToken ? 'reset' : 'login');
  const [accountType, setAccountType] = useState('student');
  const [loginId, setLoginId] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [feedback, setFeedback] = useState(initialFeedback);
  const [busy, setBusy] = useState(false);

  async function submit(event) {
    event.preventDefault();
    setFeedback(initialFeedback);
    setBusy(true);

    const endpoint = {
      login: '/api/auth/login',
      forgot: '/api/auth/forgot-password',
      reset: '/api/auth/reset-password',
    }[mode];
    const body = {
      login: { loginId, password, accountType },
      forgot: { email },
      reset: { token: resetToken, password: newPassword },
    }[mode];

    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const result = await response.json();

      if (!response.ok) {
        setFeedback({ kind: 'error', message: result.message || 'Something went wrong. Please try again.' });
        return;
      }

      if (mode === 'login') {
        onAuthenticated(result.user);
      } else if (mode === 'forgot') {
        setFeedback({ kind: 'success', message: result.message });
      } else {
        window.history.replaceState({}, '', '/');
        setMode('login');
        setPassword('');
        setNewPassword('');
        setFeedback({ kind: 'success', message: 'Your password has been updated. Sign in to continue.' });
      }
    } catch {
      setFeedback({ kind: 'error', message: 'Unable to reach the portal. Check your connection and try again.' });
    } finally {
      setBusy(false);
    }
  }

  const isLogin = mode === 'login';
  const title =
    mode === 'forgot'
      ? 'Reset your password'
      : mode === 'reset'
        ? 'Create a new password'
        : 'Welcome back';

  return (
    <main className="portal-shell">
      <section className="welcome-panel" aria-label="CGC University">
        <div className="brand-lockup">
          <div className="brand-mark" aria-hidden="true">C</div>
          <div>
            <p className="brand-name">CGC <span>University</span></p>
            <p className="brand-caption">MOHALI · PUNJAB</p>
          </div>
        </div>
        <div className="welcome-copy">
          <p className="eyebrow">YOUR CAMPUS, CONNECTED</p>
          <h1>One campus.<br /><span>Every possibility.</span></h1>
          <p className="welcome-description">
            Your place to learn, grow, and make what comes next.
          </p>
        </div>
        <div className="campus-art" aria-hidden="true">
          <div className="sun-orb" />
          <div className="art-hill art-hill-back" />
          <div className="art-hill art-hill-front" />
          <div className="campus-building">
            <div className="building-roof" />
            <div className="building-body">
              <i /><i /><i /><i /><i />
            </div>
          </div>
          <div className="art-path" />
        </div>
        <div className="welcome-footer">
          <span>LEARN WITH PURPOSE</span>
          <span className="footer-divider" />
          <span>LEAD WITH CONFIDENCE</span>
        </div>
      </section>

      <section className="form-panel">
        <div className="form-topbar">
          <span className="secure-label"><span className="secure-dot" /> SECURE CAMPUS ACCESS</span>
          <button
            type="button"
            className="theme-toggle"
            onClick={onToggleTheme}
            aria-label={`Switch to ${theme === 'light' ? 'dark' : 'light'} mode`}
          >
            <span aria-hidden="true">{theme === 'light' ? '◐' : '☼'}</span>
            <span>{theme === 'light' ? 'Dark' : 'Light'} mode</span>
          </button>
        </div>

        <div className="form-content">
          <p className="eyebrow form-eyebrow">
            {isLogin ? 'YOUR UNIVERSITY ACCOUNT' : 'ACCOUNT SUPPORT'}
          </p>
          <h2>{title}</h2>
          <p className="form-subtitle">
            {isLogin
              ? 'Sign in to continue to your campus portal.'
              : mode === 'forgot'
                ? 'Enter your university email and we’ll send a reset link if the account exists.'
                : 'Choose a strong password you have not used before.'}
          </p>

          {isLogin && (
            <div className="account-tabs" role="group" aria-label="Account type">
              <button
                type="button"
                className={accountType === 'student' ? 'account-tab active' : 'account-tab'}
                onClick={() => setAccountType('student')}
                aria-pressed={accountType === 'student'}
              >
                <span className="tab-icon" aria-hidden="true">✳</span> Student
              </button>
              <button
                type="button"
                className={accountType === 'employee' ? 'account-tab active' : 'account-tab'}
                onClick={() => setAccountType('employee')}
                aria-pressed={accountType === 'employee'}
              >
                <span className="tab-icon" aria-hidden="true">▤</span> Employee
              </button>
            </div>
          )}

          <form onSubmit={submit} className="auth-form">
            {isLogin && (
              <>
                <label htmlFor="login-id">{accountType === 'student' ? 'Student ID' : 'Employee ID'}</label>
                <input
                  autoComplete="username"
                  id="login-id"
                  maxLength="100"
                  onChange={(event) => setLoginId(event.target.value)}
                  placeholder={accountType === 'student' ? 'Enter your student ID' : 'Enter your employee ID'}
                  required
                  value={loginId}
                />
              </>
            )}

            {mode === 'forgot' && (
              <>
                <label htmlFor="email">University email</label>
                <input
                  autoComplete="email"
                  id="email"
                  maxLength="254"
                  onChange={(event) => setEmail(event.target.value)}
                  placeholder="name@cgc.edu.in"
                  required
                  type="email"
                  value={email}
                />
              </>
            )}

            {isLogin && (
              <>
                <div className="label-row">
                  <label htmlFor="password">Password</label>
                  <button type="button" className="text-button" onClick={() => { setMode('forgot'); setFeedback(initialFeedback); }}>
                    Forgot password?
                  </button>
                </div>
                <input
                  autoComplete="current-password"
                  id="password"
                  onChange={(event) => setPassword(event.target.value)}
                  placeholder="Enter your password"
                  required
                  type="password"
                  value={password}
                />
              </>
            )}

            {mode === 'reset' && (
              <>
                <label htmlFor="new-password">New password</label>
                <input
                  autoComplete="new-password"
                  id="new-password"
                  maxLength="128"
                  minLength="12"
                  onChange={(event) => setNewPassword(event.target.value)}
                  placeholder="At least 12 characters"
                  required
                  type="password"
                  value={newPassword}
                />
              </>
            )}

            {feedback.message && (
              <p className={`feedback ${feedback.kind}`} role="status">{feedback.message}</p>
            )}

            <button type="submit" className="submit-button" disabled={busy}>
              {busy ? 'Please wait…' : mode === 'login' ? 'Sign in to portal' : mode === 'forgot' ? 'Send reset link' : 'Update password'}
              {!busy && <span aria-hidden="true">→</span>}
            </button>
          </form>

          {!isLogin && (
            <button
              type="button"
              className="back-button"
              onClick={() => { setMode('login'); setFeedback(initialFeedback); }}
            >
              <span aria-hidden="true">←</span> Back to sign in
            </button>
          )}
        </div>

        <footer className="form-footer">
          <span>© {new Date().getFullYear()} CGC University</span>
          <span>Need help? Contact campus IT</span>
        </footer>
      </section>
    </main>
  );
}