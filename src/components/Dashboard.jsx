import React, { useState, useEffect, useCallback } from 'react';
import { Routes, Route, NavLink, useLocation, useNavigate } from 'react-router-dom';
import { startRegistration } from '@simplewebauthn/browser';
import TorrentCard from './TorrentCard';
import MediaList from './MediaList';
import Login from './Login';
import AddMediaModal from './AddMediaModal';
import { getTorrents, pauseTorrent, resumeTorrent, addTorrents, getCategories, getPreferences, setPreferences, checkQbittorrentStatus } from '../api';
import { checkSonarrStatus, deleteSeries } from '../sonarrApi';
import { checkRadarrStatus, deleteMovie } from '../radarrApi';
import { DownloadCloud, Zap, Play, Square, Plus, Loader2, Menu, X, Tv, Calendar, History, Film, Settings, Database } from 'lucide-react';
import LibraryView from './LibraryView';
import MediaDetailsRoute from './MediaDetailsRoute';

const Dashboard = ({ authStatus, onLogin, onLogout }) => {
  const [torrents, setTorrents] = useState([]);
  const [error, setError] = useState(null);
  
  const [showAddModal, setShowAddModal] = useState(false);
  const [showAddMediaModal, setShowAddMediaModal] = useState(false);
  const [addUrls, setAddUrls] = useState('');
  const [addFiles, setAddFiles] = useState(null);
  const [isAdding, setIsAdding] = useState(false);
  
  const [categories, setCategories] = useState([]);
  const [selectedCategory, setSelectedCategory] = useState('');

  // Media integration states
  const [qbittorrentAvailable, setQbittorrentAvailable] = useState(true);
  const [sonarrAvailable, setSonarrAvailable] = useState(false);
  const [radarrAvailable, setRadarrAvailable] = useState(false);

  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [dlLimit, setDlLimit] = useState(0);
  const [upLimit, setUpLimit] = useState(0);
  const [maxActiveDownloads, setMaxActiveDownloads] = useState(3);
  const [isSavingSettings, setIsSavingSettings] = useState(false);
  const [passkeyMsg, setPasskeyMsg] = useState({ text: '', type: '' });

  useEffect(() => {
    if (showSettingsModal && qbittorrentAvailable) {
      getPreferences().then(data => {
        if (data) {
          setDlLimit(data.dl_limit ? Math.round(data.dl_limit / 1024) : 0);
          setUpLimit(data.up_limit ? Math.round(data.up_limit / 1024) : 0);
          setMaxActiveDownloads(data.max_active_downloads !== undefined ? data.max_active_downloads : 3);
        }
      }).catch(console.error);
    }
  }, [showSettingsModal, qbittorrentAvailable]);

  const handleSaveSettings = async (e) => {
    e.preventDefault();
    if (!qbittorrentAvailable) {
      setShowSettingsModal(false);
      return;
    }
    setIsSavingSettings(true);
    try {
      await setPreferences({
        dl_limit: dlLimit * 1024,
        up_limit: upLimit * 1024,
        max_active_downloads: maxActiveDownloads
      });
      setShowSettingsModal(false);
    } catch (err) {
      console.error(err);
      alert('Failed to save settings');
    } finally {
      setIsSavingSettings(false);
    }
  };

  useEffect(() => {
    if (showAddModal) {
      getCategories().then(data => {
        if (data && typeof data === 'object') {
          setCategories(Object.keys(data));
        }
      }).catch(console.error);
    }
  }, [showAddModal]);

  const location = useLocation();
  const navigate = useNavigate();

  const currentView = location.pathname === '/library' ? 'library' 
    : location.pathname === '/recent' ? 'recent'
    : location.pathname === '/upcoming' ? 'upcoming'
    : location.pathname === '/missing' ? 'missing'
    : location.pathname.startsWith('/media') ? 'media'
    : 'torrents';

  const fetchTorrents = useCallback(async () => {
    if (currentView !== 'torrents' || !authStatus?.authenticated) return;
    try {
      const data = await getTorrents();
      if (Array.isArray(data)) {
        setTorrents(data);
        setError(null);
      }
    } catch (err) {
      if (err.message === 'Unauthorized' && typeof onLogout === 'function') {
        onLogout();
      } else {
        setError('Failed to connect to qBittorrent');
      }
    }
  }, [currentView, authStatus?.authenticated, onLogout]);

  useEffect(() => {
    const checkMediaServers = async () => {
      // Don't check if not authenticated
      if (!authStatus?.authenticated) return;
      
      const [sAvailable, rAvailable, qAvailable] = await Promise.all([
        checkSonarrStatus(),
        checkRadarrStatus(),
        checkQbittorrentStatus()
      ]);
      setSonarrAvailable(sAvailable);
      setRadarrAvailable(rAvailable);
      setQbittorrentAvailable(qAvailable);

      if (!qAvailable && currentView === 'torrents') {
        if (sAvailable || rAvailable) {
          navigate('/library');
        }
      }
    };
    checkMediaServers();
  }, [authStatus?.authenticated, currentView, navigate]);

  useEffect(() => {
    fetchTorrents();
    const interval = setInterval(fetchTorrents, 2000);
    
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        fetchTorrents();
      }
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);
    
    return () => {
      clearInterval(interval);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [fetchTorrents]);

  const [isPausingAll, setIsPausingAll] = useState(false);
  const [isResumingAll, setIsResumingAll] = useState(false);

  const handlePauseAll = async () => {
    setIsPausingAll(true);
    const minWait = new Promise(resolve => setTimeout(resolve, 2000));
    try {
      await pauseTorrent('all');
      await fetchTorrents();
    } finally {
      await minWait;
      setIsPausingAll(false);
    }
  };

  const handleResumeAll = async () => {
    setIsResumingAll(true);
    const minWait = new Promise(resolve => setTimeout(resolve, 2000));
    try {
      await resumeTorrent('all');
      await fetchTorrents();
    } finally {
      await minWait;
      setIsResumingAll(false);
    }
  };

  const handleAddSubmit = async (e) => {
    e.preventDefault();
    if (!addUrls.trim() && (!addFiles || addFiles.length === 0)) return;
    
    setIsAdding(true);
    const formData = new FormData();
    
    if (addUrls.trim()) {
      formData.append('urls', addUrls);
    }
    
    if (addFiles) {
      for (let i = 0; i < addFiles.length; i++) {
        formData.append('torrents', addFiles[i]);
      }
    }
    
    if (selectedCategory) {
      formData.append('category', selectedCategory);
    }
    
    await addTorrents(formData);
    
    setIsAdding(false);
    setShowAddModal(false);
    setAddUrls('');
    setAddFiles(null);
    setSelectedCategory('');
    fetchTorrents();
  };



  return (
    <div>
      <header className="app-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div className="app-title" style={{ color: 'var(--accent-blue)', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Zap size={32} fill="currentColor" />
            <span style={{ fontSize: '24px', fontWeight: 'bold', color: 'var(--text-primary)' }}>
              {currentView === 'torrents' ? 'qBitWeb' : currentView === 'upcoming' ? 'Upcoming' : currentView === 'recent' ? 'Recently Added' : currentView === 'library' ? 'Library' : currentView === 'media' ? 'Media Details' : 'Missing'}
            </span>
          </div>
        </div>
        
        <div className="app-actions">
          {currentView === 'torrents' && authStatus?.authenticated && qbittorrentAvailable && (
            <>
              <button className="icon-btn" onClick={handlePauseAll} title="Stop All" disabled={isPausingAll}>
                {isPausingAll ? <Loader2 size={18} className="spinner" /> : <Square size={18} fill="currentColor" />}
              </button>
              <button className="icon-btn" onClick={handleResumeAll} title="Start All" disabled={isResumingAll}>
                {isResumingAll ? <Loader2 size={20} className="spinner" /> : <Play size={20} fill="currentColor" />}
              </button>
              <button className="icon-btn primary" onClick={() => setShowAddModal(true)} title="Add Torrent">
                <Plus size={20} strokeWidth={3} />
              </button>
            </>
          )}
          
          {currentView !== 'torrents' && (
            <button className="icon-btn primary" onClick={() => setShowAddMediaModal(true)} title="Add Media">
              <Plus size={20} strokeWidth={3} />
            </button>
          )}

          {authStatus?.authenticated && (
            <button className="icon-btn" onClick={() => setShowSettingsModal(true)} title="Settings">
              <Settings size={20} strokeWidth={2} />
            </button>
          )}
        </div>
      </header>


      
      {!authStatus?.authenticated ? (
        <Login authStatus={authStatus} onLogin={onLogin} />
      ) : (
        <Routes>
          <Route path="/" element={
            <>
              {error && <div className="error-msg" style={{ marginBottom: '20px' }}>{error}</div>}
              {torrents.length === 0 && !error ? (
                <div className="empty-state">
                  <DownloadCloud size={48} opacity={0.5} />
                  <h2>No torrents currently queued</h2>
                  <p>Click the + icon above to add a new torrent.</p>
                </div>
              ) : (
                <div className="torrent-list">
                  {torrents.map(t => (
                    <TorrentCard key={t.hash} torrent={t} onUpdate={fetchTorrents} />
                  ))}
                </div>
              )}
            </>
          } />
          
          <Route path="/library" element={
            <LibraryView 
              onSelectMedia={(item, isRadarr) => navigate(`/media/${isRadarr ? 'movie' : 'series'}/${item.id}`)}
              isDownloading={false} 
            />
          } />
          
          <Route path="/recent" element={
            <MediaList mode="recent" isAuthenticated={authStatus?.authenticated} sonarrAvailable={sonarrAvailable} radarrAvailable={radarrAvailable} onSelectMedia={(item, isRadarr) => navigate(`/media/${isRadarr ? 'movie' : 'series'}/${item.id}`)} />
          } />
          
          <Route path="/upcoming" element={
            <MediaList mode="upcoming" isAuthenticated={authStatus?.authenticated} sonarrAvailable={sonarrAvailable} radarrAvailable={radarrAvailable} onSelectMedia={(item, isRadarr) => navigate(`/media/${isRadarr ? 'movie' : 'series'}/${item.id}`)} />
          } />
          
          <Route path="/missing" element={
            <MediaList mode="missing" isAuthenticated={authStatus?.authenticated} sonarrAvailable={sonarrAvailable} radarrAvailable={radarrAvailable} onSelectMedia={(item, isRadarr) => navigate(`/media/${isRadarr ? 'movie' : 'series'}/${item.id}`)} />
          } />

          <Route path="/media/:type/:id" element={<MediaDetailsRoute />} />
        </Routes>
      )}

      {/* Add Torrent Modal */}
      {showAddModal && currentView === 'torrents' && (
        <div className="modal-overlay" onClick={() => setShowAddModal(false)}>
          <div className="modal-content" onClick={e => e.stopPropagation()}>
            <h3>Add New Torrent</h3>
            <form onSubmit={handleAddSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div className="input-group">
                <label>Magnet Links or URLs (one per line)</label>
                <textarea 
                  value={addUrls}
                  onChange={(e) => setAddUrls(e.target.value)}
                  placeholder="magnet:?xt=urn:btih:..."
                  rows={4}
                  style={{
                    padding: '12px',
                    borderRadius: '8px',
                    border: '1px solid #333',
                    background: '#222',
                    color: '#fff',
                    fontFamily: 'monospace',
                    resize: 'vertical'
                  }}
                />
              </div>

              <div className="input-group">
                <label>Or Upload .torrent Files</label>
                <input 
                  type="file" 
                  multiple 
                  accept=".torrent"
                  onChange={(e) => setAddFiles(e.target.files)}
                  style={{
                    padding: '10px',
                    borderRadius: '8px',
                    border: '1px dashed #555',
                    background: '#222',
                    color: '#fff',
                    cursor: 'pointer'
                  }}
                />
              </div>
              
              {categories.length > 0 && (
                <div className="input-group">
                  <label>Category (Optional)</label>
                  <select
                    value={selectedCategory}
                    onChange={(e) => setSelectedCategory(e.target.value)}
                    style={{
                      padding: '12px',
                      borderRadius: '8px',
                      border: '1px solid #333',
                      background: '#222',
                      color: '#fff',
                      width: '100%',
                      fontSize: '14px'
                    }}
                  >
                    <option value="">None</option>
                    {categories.map(cat => (
                      <option key={cat} value={cat}>{cat}</option>
                    ))}
                  </select>
                </div>
              )}

              <div className="modal-actions">
                <button type="button" className="btn btn-secondary" onClick={() => setShowAddModal(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary" disabled={isAdding || (!addUrls.trim() && (!addFiles || addFiles.length === 0))}>
                  {isAdding ? 'Adding...' : 'Add Torrents'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Settings Modal */}
      {showSettingsModal && (
        <div className="modal-overlay" onClick={() => setShowSettingsModal(false)}>
          <div className="modal-content" onClick={e => e.stopPropagation()}>
            <h3>Settings</h3>
            <form onSubmit={handleSaveSettings} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              {qbittorrentAvailable && (
                <>
                  <div className="input-group">
                    <label>Max Active Downloads</label>
                    <input 
                      type="number" 
                      value={maxActiveDownloads} 
                      onChange={(e) => setMaxActiveDownloads(Number(e.target.value))}
                      min="-1"
                    />
                  </div>
                  <div className="input-group" style={{ gap: '4px' }}>
                    <label style={{ marginBottom: '4px' }}>Download Speed Limit (KB/s)</label>
                    <input 
                      type="number" 
                      value={dlLimit} 
                      onChange={(e) => setDlLimit(Number(e.target.value))}
                      min="0"
                    />
                    <small style={{ color: 'var(--text-secondary)', fontSize: '12px' }}>0 for unlimited</small>
                  </div>
                  <div className="input-group" style={{ gap: '4px' }}>
                    <label style={{ marginBottom: '4px' }}>Upload Speed Limit (KB/s)</label>
                    <input 
                      type="number" 
                      value={upLimit} 
                      onChange={(e) => setUpLimit(Number(e.target.value))}
                      min="0"
                    />
                    <small style={{ color: 'var(--text-secondary)', fontSize: '12px' }}>0 for unlimited</small>
                  </div>
                </>
              )}

              {passkeyMsg.text && (
                <div style={{
                  padding: '10px',
                  borderRadius: '8px',
                  backgroundColor: passkeyMsg.type === 'success' ? 'rgba(76, 175, 80, 0.1)' : 'rgba(255, 77, 77, 0.1)',
                  color: passkeyMsg.type === 'success' ? '#4caf50' : '#ff4d4d',
                  border: `1px solid ${passkeyMsg.type === 'success' ? 'rgba(76, 175, 80, 0.2)' : 'rgba(255, 77, 77, 0.2)'}`,
                  fontSize: '0.9rem',
                  textAlign: 'center'
                }}>
                  {passkeyMsg.text}
                </div>
              )}

              <div className="modal-actions" style={{ marginTop: '8px', borderTop: '1px solid var(--border-color)', paddingTop: '16px' }}>
                <div style={{ flex: 1, textAlign: 'left' }}>
                  <button type="button" className="btn btn-secondary" onClick={async () => {
                    setPasskeyMsg({ text: '', type: '' });
                    try {
                      const res = await fetch('/api/auth/webauthn/generate-registration-options');
                      const options = await res.json();
                      const attResp = await startRegistration(options);
                      const verifyRes = await fetch('/api/auth/webauthn/verify-registration', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify(attResp),
                      });
                      const verification = await verifyRes.json();
                      if (verification.verified) {
                        setPasskeyMsg({ text: 'Passkey registered successfully!', type: 'success' });
                      } else {
                        setPasskeyMsg({ text: 'Failed to register Passkey.', type: 'error' });
                      }
                    } catch (err) {
                      console.error(err);
                      let errorMsg = err.message || 'Unknown error';
                      if (errorMsg.toLowerCase().includes('not supported in this browser') || errorMsg.toLowerCase().includes('supported')) {
                        errorMsg = 'WebAuthn (Passkeys) requires a secure HTTPS connection (or localhost) on mobile devices. Please access qBitWeb via a reverse proxy with SSL enabled.';
                      }
                      setPasskeyMsg({ text: 'Failed to register Passkey: ' + errorMsg, type: 'error' });
                    }
                  }}>
                    Add Passkey
                  </button>
                </div>
              </div>
              <div className="modal-actions" style={{ marginTop: '8px' }}>
                <button type="button" className="btn btn-secondary" onClick={() => setShowSettingsModal(false)}>
                  {qbittorrentAvailable ? 'Cancel' : 'Close'}
                </button>
                {qbittorrentAvailable && (
                  <button type="submit" className="btn btn-primary" disabled={isSavingSettings}>
                    {isSavingSettings ? 'Saving...' : 'Save Settings'}
                  </button>
                )}
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Add Media Modal */}
      {showAddMediaModal && (
        <AddMediaModal 
          onClose={() => setShowAddMediaModal(false)} 
          initialMode={radarrAvailable && !sonarrAvailable ? 'movie' : 'series'} 
        />
      )}

      {/* Bottom Navigation */}
      {(sonarrAvailable || radarrAvailable) && (
        <nav className="bottom-nav">
          {qbittorrentAvailable && (
            <NavLink 
              to="/"
              className={({ isActive }) => `bottom-nav-btn ${isActive ? 'active' : ''}`}
              end
            >
              <Zap size={24} />
              <span>Torrents</span>
            </NavLink>
          )}

          <NavLink 
            to="/library"
            className={({ isActive }) => `bottom-nav-btn ${isActive ? 'active' : ''}`}
          >
            <Database size={24} />
            <span>Library</span>
          </NavLink>
          
          <NavLink 
            to="/recent"
            className={({ isActive }) => `bottom-nav-btn ${isActive ? 'active' : ''}`}
          >
            <History size={24} />
            <span>Recent</span>
          </NavLink>
          
          <NavLink 
            to="/upcoming"
            className={({ isActive }) => `bottom-nav-btn ${isActive ? 'active' : ''}`}
          >
            <Calendar size={24} />
            <span>Upcoming</span>
          </NavLink>
          
          <NavLink 
            to="/missing"
            className={({ isActive }) => `bottom-nav-btn ${isActive ? 'active' : ''}`}
          >
            <Film size={24} />
            <span>Missing</span>
          </NavLink>
        </nav>
      )}
    </div>
  );
};

export default Dashboard;
