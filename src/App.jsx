import React, { useState, useEffect } from 'react';
import Login from './components/Login';
import Dashboard from './components/Dashboard';
import { checkAuth } from './api';

function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    checkAuth().then(auth => {
      setIsAuthenticated(auth);
      setLoading(false);
    });
  }, []);

  if (loading) {
    return <div className="empty-state">Loading...</div>;
  }

  return (
    <div className="app-container">
      {isAuthenticated ? (
        <Dashboard />
      ) : (
        <Login onLogin={() => setIsAuthenticated(true)} />
      )}
    </div>
  );
}

export default App;
