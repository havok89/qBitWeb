import React, { useState } from 'react';
import { setupLogin } from '../api';
import { startAuthentication } from '@simplewebauthn/browser';

const Login = ({ authStatus, onLogin }) => {
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPasswordFallback, setShowPasswordFallback] = useState(false);

  const handleSetupLogin = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    
    try {
      await setupLogin(password);
      onLogin();
    } catch (err) {
      setError(err.message || 'Invalid password');
    } finally {
      setLoading(false);
    }
  };

  const handlePasskeyLogin = async () => {
    setError('');
    setLoading(true);
    
    try {
      const res = await fetch('/api/auth/webauthn/generate-authentication-options');
      const options = await res.json();
      
      if (options.error) throw new Error(options.error);
      
      const authResp = await startAuthentication(options);
      
      const verificationRes = await fetch('/api/auth/webauthn/verify-authentication', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(authResp),
      });
      
      const verification = await verificationRes.json();
      if (verification.verified) {
        onLogin();
      } else {
        throw new Error('Passkey verification failed');
      }
    } catch (err) {
      console.error(err);
      let errorMsg = err.message || 'Passkey login failed';
      if (errorMsg.toLowerCase().includes('not supported in this browser') || errorMsg.toLowerCase().includes('supported')) {
        errorMsg = 'WebAuthn (Passkeys) requires a secure HTTPS connection on mobile devices.';
      }
      setError(errorMsg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-container">
      <div className="login-form">
        <h2>Welcome to qBitWeb</h2>
        
        {authStatus?.requiresSetup || showPasswordFallback ? (
          <form onSubmit={handleSetupLogin}>
            <p style={{ margin: 0, fontSize: '0.9rem', color: '#888' }}>
              Please enter your master password to log in. {authStatus?.requiresSetup && "You can add a Passkey in settings later."}
            </p>
            <div className="input-group">
              <label>Master Password</label>
              <input 
                type="password" 
                value={password} 
                onChange={(e) => setPassword(e.target.value)} 
                required 
              />
            </div>
            {error && <div className="error-msg">{error}</div>}
            <button type="submit" className="btn btn-primary" disabled={loading}>
              {loading ? 'Logging in...' : 'Log In'}
            </button>
            {!authStatus?.requiresSetup && (
              <button 
                type="button" 
                className="btn btn-secondary" 
                onClick={() => setShowPasswordFallback(false)}
              >
                Back to Passkey
              </button>
            )}
          </form>
        ) : (
          <div style={{ textAlign: 'center', display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <p style={{ margin: 0, fontSize: '0.9rem', color: '#888' }}>
              Sign in securely using your registered Passkey.
            </p>
            <button 
              onClick={handlePasskeyLogin} 
              className="btn btn-primary" 
              style={{ width: '100%', padding: '12px', fontSize: '1.1rem' }}
              disabled={loading}
            >
              {loading ? 'Authenticating...' : 'Sign in with Passkey'}
            </button>
            <button 
              type="button" 
              className="btn btn-secondary" 
              onClick={() => setShowPasswordFallback(true)}
            >
              Log in with Password
            </button>
            {error && <div className="error-msg">{error}</div>}
          </div>
        )}
      </div>
    </div>
  );
};

export default Login;
