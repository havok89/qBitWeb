import React, { useState, useEffect, Suspense, lazy } from 'react';
import { checkAuth } from './api';
import { CommandProvider } from './CommandContext';

const Dashboard = lazy(() => import('./components/Dashboard'));

function App() {
  const [authStatus, setAuthStatus] = useState({ authenticated: false, hasPasskeys: false, requiresSetup: false });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    checkAuth().then(status => {
      setAuthStatus(status);
      setLoading(false);
      
      const splash = document.getElementById('initial-splash');
      if (splash) {
        setTimeout(() => {
          splash.style.opacity = '0';
          setTimeout(() => splash.remove(), 500);
        }, 1000);
      }
    });
  }, []);

  if (loading) {
    return <div className="empty-state">Loading...</div>;
  }

  return (
    <div className="app-container">
      <CommandProvider>
        <Suspense fallback={<div className="empty-state">Loading module...</div>}>
          <Dashboard 
            authStatus={authStatus} 
            onLogin={() => setAuthStatus({ ...authStatus, authenticated: true })} 
            onLogout={() => setAuthStatus({ ...authStatus, authenticated: false })}
          />
        </Suspense>
      </CommandProvider>
    </div>
  );
}

export default App;
