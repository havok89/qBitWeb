import 'dotenv/config';
import express from 'express';
import { createProxyMiddleware } from 'http-proxy-middleware';
import cookieParser from 'cookie-parser';
import jwt from 'jsonwebtoken';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { generateRegistrationOptions, verifyRegistrationResponse, generateAuthenticationOptions, verifyAuthenticationResponse } from '@simplewebauthn/server';
import crypto from 'crypto';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const port = process.env.PORT || 80;

// Env variables
const AUTH_PASSWORD = process.env.AUTH_PASSWORD;
const JWT_SECRET = process.env.JWT_SECRET || crypto.randomBytes(32).toString('hex');
const RP_NAME = 'qBitWeb';

// Derive RP_ID and ORIGIN dynamically from request headers so passkeys work on any domain
const getWebAuthnParams = (req) => {
  const host = req.get('host') || 'localhost';
  const hostname = host.split(':')[0];
  const protocol = req.get('x-forwarded-proto') || req.protocol || 'http';
  return {
    rpID: process.env.RP_ID || hostname,
    origin: process.env.ORIGIN || `${protocol}://${host}`,
  };
};

const QBITTORRENT_URL = (process.env.QBITTORRENT_URL || 'http://localhost:8080').replace(/\/$/, '');
const SONARR_URL = (process.env.SONARR_URL || 'http://localhost:8989').replace(/\/$/, '');
const SONARR_API_KEY = process.env.SONARR_API_KEY || '';
const RADARR_URL = (process.env.RADARR_URL || 'http://localhost:7878').replace(/\/$/, '');
const RADARR_API_KEY = process.env.RADARR_API_KEY || '';

const QBITTORRENT_USERNAME = process.env.QBITTORRENT_USERNAME;
const QBITTORRENT_PASSWORD = process.env.QBITTORRENT_PASSWORD;

app.use(cookieParser());

// Data storage for passkeys
const dataDir = path.join(__dirname, 'data');
const authFile = path.join(dataDir, 'auth.json');
if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });
if (!fs.existsSync(authFile)) fs.writeFileSync(authFile, JSON.stringify({ authenticators: [] }));

const getAuthenticators = () => {
  const data = JSON.parse(fs.readFileSync(authFile));
  return data.authenticators.map(auth => ({
    ...auth,
    credentialID: auth.credentialID, // Already a Base64URLString
    credentialPublicKey: new Uint8Array(Buffer.from(auth.credentialPublicKey, 'base64url'))
  }));
};

const saveAuthenticator = (auth) => {
  const data = JSON.parse(fs.readFileSync(authFile));
  data.authenticators.push({
    ...auth,
    credentialID: auth.credentialID,
    credentialPublicKey: Buffer.from(auth.credentialPublicKey).toString('base64url')
  });
  fs.writeFileSync(authFile, JSON.stringify(data, null, 2));
};

// Middleware to parse JSON only for auth routes
app.use('/api/auth', express.json());

const requireAuth = (req, res, next) => {
  if (!AUTH_PASSWORD && getAuthenticators().length === 0) {
    return next();
  }
  
  const token = req.cookies.qbitweb_session;
  if (!token) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  
  try {
    jwt.verify(token, JWT_SECRET);
    next();
  } catch (err) {
    res.status(401).json({ error: 'Unauthorized' });
  }
};

// --- qBittorrent Auto-Login ---
let qbitCookie = '';
let isLoggingIn = false;

const loginToQbittorrent = async () => {
  if (!QBITTORRENT_USERNAME || !QBITTORRENT_PASSWORD) return;
  if (isLoggingIn) return;
  isLoggingIn = true;
  
  try {
    const params = new URLSearchParams();
    params.append('username', QBITTORRENT_USERNAME);
    params.append('password', QBITTORRENT_PASSWORD);
    
    const res = await fetch(`${QBITTORRENT_URL}/api/v2/auth/login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Referer': `${QBITTORRENT_URL}/`
      },
      body: params
    });
    
    const cookies = res.headers.getSetCookie();
    if (cookies && cookies.length > 0) {
      qbitCookie = cookies.map(c => c.split(';')[0]).join('; ');
      console.log('Successfully authenticated with qBittorrent');
    }
  } catch (err) {
    console.error('Failed to auto-login to qBittorrent:', err.message);
  } finally {
    isLoggingIn = false;
  }
};

loginToQbittorrent();
setInterval(loginToQbittorrent, 1000 * 60 * 30);

const attachQbitCookie = (proxyReq, req, res) => {
  if (qbitCookie) {
    proxyReq.setHeader('Cookie', qbitCookie);
  }
  proxyReq.setHeader('Origin', QBITTORRENT_URL);
  proxyReq.setHeader('Referer', `${QBITTORRENT_URL}/`);
};

// --- Auth Routes ---
const currentChallenges = {}; // In-memory challenge store

app.post('/api/auth/setup-login', (req, res) => {
  const { password } = req.body;
  if (AUTH_PASSWORD && password === AUTH_PASSWORD) {
    const token = jwt.sign({ user: 'admin' }, JWT_SECRET, { expiresIn: '7d' });
    res.cookie('qbitweb_session', token, { httpOnly: true, maxAge: 7 * 24 * 60 * 60 * 1000, path: '/' });
    return res.json({ success: true });
  }
  return res.status(401).json({ error: 'Invalid password' });
});

app.post('/api/auth/logout', (req, res) => {
  res.clearCookie('qbitweb_session');
  res.json({ success: true });
});

app.get('/api/auth/status', (req, res) => {
  const token = req.cookies.qbitweb_session;
  const hasAuthenticators = getAuthenticators().length > 0;
  
  if (!token) {
    return res.json({ authenticated: false, hasPasskeys: hasAuthenticators, requiresSetup: !hasAuthenticators && !!AUTH_PASSWORD });
  }
  try {
    jwt.verify(token, JWT_SECRET);
    return res.json({ authenticated: true, hasPasskeys: hasAuthenticators });
  } catch (err) {
    return res.json({ authenticated: false, hasPasskeys: hasAuthenticators, requiresSetup: !hasAuthenticators && !!AUTH_PASSWORD });
  }
});

app.get('/api/auth/webauthn/generate-registration-options', requireAuth, async (req, res) => {
  const { rpID } = getWebAuthnParams(req);
  const user = { id: 'admin', username: 'admin' };
  const userID = new Uint8Array(Buffer.from(user.id));
  const options = await generateRegistrationOptions({
    rpName: RP_NAME,
    rpID,
    userID: userID,
    userName: user.username,
    attestationType: 'none',
    authenticatorSelection: { residentKey: 'preferred', userVerification: 'preferred' },
  });
  currentChallenges[user.id] = options.challenge;
  res.json(options);
});

app.post('/api/auth/webauthn/verify-registration', requireAuth, async (req, res) => {
  const body = req.body;
  const expectedChallenge = currentChallenges['admin'];
  const { rpID, origin } = getWebAuthnParams(req);
  try {
    const verification = await verifyRegistrationResponse({
      response: body,
      expectedChallenge,
      expectedOrigin: origin,
      expectedRPID: rpID,
    });
    if (verification.verified) {
      saveAuthenticator({
        credentialID: verification.registrationInfo.credential.id,
        credentialPublicKey: verification.registrationInfo.credential.publicKey,
        counter: verification.registrationInfo.credential.counter,
        transports: verification.registrationInfo.credential.transports || []
      });
      res.json({ verified: true });
    } else {
      res.status(400).json({ error: 'Verification failed' });
    }
  } catch (error) {
    console.error(error);
    res.status(400).json({ error: error.message });
  }
});

app.get('/api/auth/webauthn/generate-authentication-options', async (req, res) => {
  const authenticators = getAuthenticators();
  if (authenticators.length === 0) return res.status(400).json({ error: 'No passkeys registered' });
  const { rpID } = getWebAuthnParams(req);
  const options = await generateAuthenticationOptions({
    rpID,
    allowCredentials: authenticators.map(auth => ({
      id: auth.credentialID,
      type: 'public-key',
      transports: auth.transports,
    })),
    userVerification: 'preferred',
  });
  currentChallenges['admin'] = options.challenge;
  res.json(options);
});

app.post('/api/auth/webauthn/verify-authentication', async (req, res) => {
  const body = req.body;
  const expectedChallenge = currentChallenges['admin'];
  const authenticators = getAuthenticators();
  const authenticator = authenticators.find(auth => auth.credentialID === body.id);
  if (!authenticator) return res.status(400).json({ error: 'Authenticator not registered' });
  const { rpID, origin } = getWebAuthnParams(req);
  try {
    const verification = await verifyAuthenticationResponse({
      response: body,
      expectedChallenge,
      expectedOrigin: origin,
      expectedRPID: rpID,
      credential: {
        id: authenticator.credentialID,
        publicKey: authenticator.credentialPublicKey,
        counter: authenticator.counter,
        transports: authenticator.transports,
      },
    });
    if (verification.verified) {
      const token = jwt.sign({ user: 'admin' }, JWT_SECRET, { expiresIn: '7d' });
      res.cookie('qbitweb_session', token, { httpOnly: true, maxAge: 7 * 24 * 60 * 60 * 1000, path: '/' });
      res.json({ verified: true });
    } else {
      res.status(400).json({ error: 'Verification failed' });
    }
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});


// --- Proxy Routes (Protected) ---
// Now that /api/auth routes are defined above, they will catch first.
app.use('/api', requireAuth, createProxyMiddleware({
  target: QBITTORRENT_URL,
  changeOrigin: true,
  pathRewrite: (path, req) => req.originalUrl,
  on: {
    proxyReq: (proxyReq, req, res) => {
      attachQbitCookie(proxyReq, req, res);
    },
    error: (err, req, res) => {
      console.error(`[Proxy Error] qBittorrent on ${req.url}:`, err.message);
      if (!res.headersSent) res.status(502).json({ error: 'Proxy Error' });
    }
  }
}));

app.use('/sonarr/api', requireAuth, createProxyMiddleware({
  target: SONARR_URL,
  changeOrigin: true,
  pathRewrite: (path, req) => req.originalUrl.replace(/^\/sonarr\/api/, '/api'),
  on: {
    proxyReq: (proxyReq) => {
      proxyReq.setHeader('X-Api-Key', SONARR_API_KEY);
    },
    error: (err, req, res) => console.error(`[Proxy Error] Sonarr on ${req.url}:`, err.message)
  }
}));

app.use('/radarr/api', requireAuth, createProxyMiddleware({
  target: RADARR_URL,
  changeOrigin: true,
  pathRewrite: (path, req) => req.originalUrl.replace(/^\/radarr\/api/, '/api'),
  on: {
    proxyReq: (proxyReq) => proxyReq.setHeader('X-Api-Key', RADARR_API_KEY),
    error: (err, req, res) => console.error('Radarr Proxy Error:', err.message)
  }
}));

app.use('/sonarr-media', requireAuth, createProxyMiddleware({
  target: SONARR_URL,
  changeOrigin: true,
  pathRewrite: (path, req) => {
    let newPath = req.originalUrl.replace(/^\/sonarr-media/, '/api/v3/MediaCover');
    if (SONARR_API_KEY) newPath += (newPath.includes('?') ? '&' : '?') + 'apikey=' + SONARR_API_KEY;
    return newPath;
  },
  on: {
    proxyReq: (proxyReq) => proxyReq.setHeader('X-Api-Key', SONARR_API_KEY)
  }
}));

app.use('/radarr-media', requireAuth, createProxyMiddleware({
  target: RADARR_URL,
  changeOrigin: true,
  pathRewrite: (path, req) => {
    let newPath = req.originalUrl.replace(/^\/radarr-media/, '/api/v3/MediaCover');
    if (RADARR_API_KEY) newPath += (newPath.includes('?') ? '&' : '?') + 'apikey=' + RADARR_API_KEY;
    return newPath;
  },
  on: {
    proxyReq: (proxyReq) => proxyReq.setHeader('X-Api-Key', RADARR_API_KEY)
  }
}));


// --- Static Files ---
app.use(express.static(path.join(__dirname, 'dist')));
app.use((req, res) => {
  res.sendFile(path.join(__dirname, 'dist', 'index.html'));
});

app.listen(port, () => {
  console.log(`Server listening on port ${port}`);
});
