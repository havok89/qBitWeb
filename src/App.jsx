import React, { useState, useEffect } from 'react';
import Dashboard from './components/Dashboard';
import { checkAuth } from './api';

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
      <Dashboard 
        authStatus={authStatus} 
        onLogin={() => setAuthStatus({ ...authStatus, authenticated: true })} 
        onLogout={() => setAuthStatus({ ...authStatus, authenticated: false })}
      />
    </div>
  );
}

export default App;
