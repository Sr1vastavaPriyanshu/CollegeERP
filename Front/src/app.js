import React, { useEffect, useState } from 'react';
import LoginPage from './pages/login';
import Dashboard from './pages/dashboard';

export default function App() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [theme, setTheme] = useState(
    () => window.localStorage.getItem('cgc-theme') || 'light',
  );
  const resetToken = new URLSearchParams(window.location.search).get('reset');

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    window.localStorage.setItem('cgc-theme', theme);
  }, [theme]);

  useEffect(() => {
    let active = true;
    fetch('/api/auth/session')
      .then(async (response) => {
        if (response.ok) {
          const data = await response.json();
          if (active) setUser(data.user);
        }
      })
      .catch(() => {
        if (active) setUser(null);
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, []);

  const toggleTheme = () => {
    setTheme((current) => (current === 'light' ? 'dark' : 'light'));
  };

  if (loading && !resetToken) {
    return <main className="loading-screen" aria-label="Loading portal" />;
  }

  if (resetToken) {
    return (
      <LoginPage
        resetToken={resetToken}
        theme={theme}
        onToggleTheme={toggleTheme}
        onAuthenticated={setUser}
      />
    );
  }

  return user ? (
    <Dashboard
      user={user}
      onSignedOut={() => setUser(null)}
      theme={theme}
      onToggleTheme={toggleTheme}
    />
  ) : (
    <LoginPage
      theme={theme}
      onToggleTheme={toggleTheme}
      onAuthenticated={setUser}
    />
  );
}