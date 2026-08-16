import React, { useState, useEffect, Suspense, lazy } from 'react';
import { checkAuth } from './api';
import { CommandProvider } from './CommandContext';
import { ToastProvider, useToast } from './ToastContext';
import pkg from '../package.json';

import { PartyPopper } from 'lucide-react';

const Dashboard = lazy(() => import('./components/Dashboard'));

const UpdateChecker = ({ onUpdateAvailable }) => {
  const { addToast } = useToast();
  
  useEffect(() => {
    fetch('https://api.github.com/repos/havok89/qBitWeb/releases/latest')
      .then(res => res.json())
      .then(data => {
        if (data && data.tag_name) {
          const latestVersion = data.tag_name.replace(/^v/, '');
          const currentVersion = pkg.version;
          if (latestVersion.localeCompare(currentVersion, undefined, { numeric: true, sensitivity: 'base' }) > 0) {
            onUpdateAvailable(latestVersion);
            
            const dismissedVersion = localStorage.getItem('qbitweb_dismissed_update');
            if (dismissedVersion !== latestVersion) {
              localStorage.setItem('qbitweb_dismissed_update', latestVersion);
              addToast(
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <PartyPopper size={24} color="#BF5AF2" style={{ flexShrink: 0 }} />
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    <span style={{ fontWeight: '600' }}>Update available! v{latestVersion} is out</span>
                    <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>You are currently running v{currentVersion}.</span>
                    <a href={`https://github.com/havok89/qBitWeb/releases/tag/v${latestVersion}`} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--accent-blue)', textDecoration: 'none', fontWeight: '500', fontSize: '13px', marginTop: '2px' }}>
                      View Release Notes →
                    </a>
                  </div>
                </div>,
                { duration: 15000 }
              );
            }
          }
        }
      })
      .catch(err => console.error('Failed to check for updates', err));
  }, [addToast, onUpdateAvailable]);

  return null;
};

function App() {
  const [authStatus, setAuthStatus] = useState({ authenticated: false, hasPasskeys: false, requiresSetup: false });
  const [loading, setLoading] = useState(true);
  const [updateAvailable, setUpdateAvailable] = useState(null);

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
      <ToastProvider>
        <UpdateChecker onUpdateAvailable={setUpdateAvailable} />
        <CommandProvider>
          <Suspense fallback={<div className="empty-state">Loading module...</div>}>
            <Dashboard 
              authStatus={authStatus} 
              onLogin={() => setAuthStatus({ ...authStatus, authenticated: true })} 
              onLogout={() => setAuthStatus({ ...authStatus, authenticated: false })}
              updateAvailable={updateAvailable}
            />
          </Suspense>
        </CommandProvider>
      </ToastProvider>
    </div>
  );
}

export default App;
