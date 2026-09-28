import React, { useState, useEffect, useCallback } from 'react';
import { Routes, Route, NavLink, useLocation, useNavigate } from 'react-router-dom';
import { startRegistration } from '@simplewebauthn/browser';
import TorrentCard from './TorrentCard';
import MediaList from './MediaList';
import Login from './Login';
import AddMediaModal from './modals/AddMediaModal';
import AddTorrentModal from './modals/AddTorrentModal';
import ActiveSearchesModal from './modals/ActiveSearchesModal';
import { getTorrents, pauseTorrent, resumeTorrent, addTorrents, getCategories, getPreferences, setPreferences, checkQbittorrentStatus, getCleanerStatus, updateCleanerConfig, runCleanerNow } from '../api';
import { checkSonarrStatus, deleteSeries } from '../sonarrApi';
import { checkRadarrStatus, deleteMovie } from '../radarrApi';
import { DownloadCloud, Zap, Play, Square, Plus, Loader2, Menu, X, Tv, Calendar, History, Film, Settings, Database, RefreshCw } from 'lucide-react';
import LibraryView from './LibraryView';
import MediaDetailsRoute from './MediaDetailsRoute';
import { useCommand } from '../CommandContext';
import pkg from '../../package.json';

const Dashboard = ({ authStatus, onLogin, onLogout, updateAvailable }) => {
  const [torrents, setTorrents] = useState([]);
  const [error, setError] = useState(null);
  
  const [showAddModal, setShowAddModal] = useState(false);
  const [showAddMediaModal, setShowAddMediaModal] = useState(false);
  const [initialSearchTerm, setInitialSearchTerm] = useState('');
  const [libraryRefreshTrigger, setLibraryRefreshTrigger] = useState(0);
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

  // Queue Cleaner State
  const [cleanerStatus, setCleanerStatus] = useState(null);
  const [isScanningCleaner, setIsScanningCleaner] = useState(false);
  const [cleanerScanMessage, setCleanerScanMessage] = useState(null);

  const { searchStatuses } = useCommand();
  const isSearchActive = Object.values(searchStatuses).some(s => s?.isSearching);
  const [showSearchesModal, setShowSearchesModal] = useState(false);

  useEffect(() => {
    if (showSettingsModal) {
      if (qbittorrentAvailable) {
        getPreferences().then(data => {
          if (data) {
            setDlLimit(data.dl_limit ? Math.round(data.dl_limit / 1024) : 0);
            setUpLimit(data.up_limit ? Math.round(data.up_limit / 1024) : 0);
            setMaxActiveDownloads(data.max_active_downloads !== undefined ? data.max_active_downloads : 3);
          }
        }).catch(console.error);
      }
      if (sonarrAvailable || radarrAvailable) {
        getCleanerStatus().then(status => {
          if (status) setCleanerStatus(status);
        }).catch(console.error);
      }
    }
  }, [showSettingsModal, qbittorrentAvailable, sonarrAvailable, radarrAvailable]);

  const handleToggleCleaner = async (enabled) => {
    try {
      const updated = await updateCleanerConfig({ enabled });
      setCleanerStatus(prev => prev ? { ...prev, enabled: updated.enabled } : null);
    } catch (err) {
      console.error('Failed to toggle cleaner config:', err);
    }
  };

  const handleRunCleanerNow = async () => {
    setIsScanningCleaner(true);
    setCleanerScanMessage(null);
    try {
      const res = await runCleanerNow();
      const count = res.cleaned?.length || 0;
      if (count > 0) {
        setCleanerScanMessage({ type: 'success', text: `Cleaned & blocklisted ${count} fake release${count > 1 ? 's' : ''}!` });
      } else {
        setCleanerScanMessage({ type: 'info', text: 'Queue is clean. No fake releases detected.' });
      }
      const updatedStatus = await getCleanerStatus();
      setCleanerStatus(updatedStatus);
    } catch (err) {
      console.error('Failed to run cleaner:', err);
      setCleanerScanMessage({ type: 'error', text: 'Queue scan failed.' });
    } finally {
      setIsScanningCleaner(false);
    }
  };

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

  const [hasCheckedServers, setHasCheckedServers] = useState(false);

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
      setHasCheckedServers(true);
    };
    checkMediaServers();
  }, [authStatus?.authenticated]);

  useEffect(() => {
    if (authStatus?.authenticated && hasCheckedServers) {
      if (!qbittorrentAvailable && currentView === 'torrents') {
        if (sonarrAvailable || radarrAvailable) {
          navigate('/library');
        }
      } else if (!sonarrAvailable && !radarrAvailable && currentView !== 'torrents') {
        if (qbittorrentAvailable) {
          navigate('/');
        }
      }
    }
  }, [currentView, qbittorrentAvailable, sonarrAvailable, radarrAvailable, authStatus?.authenticated, hasCheckedServers, navigate]);

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

  const handleAdd = async (formData) => {
    try {
      await addTorrents(formData);
      setShowAddModal(false);
      fetchTorrents();
    } catch (e) {
      console.error("Failed to add torrents", e);
      throw e;
    }
  };



  return (
    <div>
      <header className="app-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div className="app-title" style={{ color: 'var(--accent-blue)', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Zap size={32} fill="currentColor" />
            <span style={{ fontSize: '24px', fontWeight: 'bold', color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '12px' }}>
              {currentView === 'torrents' ? 'qBitWeb' : currentView === 'upcoming' ? 'Upcoming' : currentView === 'recent' ? 'Recently Added' : currentView === 'library' ? 'Library' : currentView === 'media' ? 'Media Details' : 'Missing'}
              {isSearchActive && (
                <span onClick={() => setShowSearchesModal(true)} style={{ cursor: 'pointer', display: 'flex' }}>
                  <Loader2 size={20} className="spinner" style={{ color: 'var(--accent-blue)' }} />
                </span>
              )}
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
            <button className="icon-btn" onClick={() => setShowSettingsModal(true)} title="Settings" style={{ position: 'relative' }}>
              <Settings size={20} />
              {updateAvailable && (
                <div style={{
                  position: 'absolute',
                  top: '-2px',
                  right: '-2px',
                  width: '8px',
                  height: '8px',
                  backgroundColor: '#ff4d4d',
                  borderRadius: '50%',
                  border: '2px solid var(--bg-color)'
                }} />
              )}
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
              sonarrAvailable={sonarrAvailable}
              radarrAvailable={radarrAvailable}
              refreshTrigger={libraryRefreshTrigger}
              onAddMissingItem={(term) => {
                setInitialSearchTerm(term);
                setShowAddMediaModal(true);
              }}
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
      <AddTorrentModal 
        isOpen={showAddModal && currentView === 'torrents'}
        onClose={() => setShowAddModal(false)}
        categories={categories}
        onAdd={handleAdd}
      />

      {/* Settings Modal */}
      {showSettingsModal && (
        <div className="modal-overlay" onClick={() => setShowSettingsModal(false)}>
          <div className="modal-content" onClick={e => e.stopPropagation()}>
            <h3>Settings</h3>
            
            {updateAvailable && (
              <div style={{
                padding: '10px 12px',
                borderRadius: '8px',
                backgroundColor: 'rgba(191, 90, 242, 0.1)',
                border: '1px solid rgba(191, 90, 242, 0.2)',
                marginBottom: '16px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between'
              }}>
                <div>
                  <div style={{ fontWeight: '600', color: '#BF5AF2', marginBottom: '2px', fontSize: '14px' }}>Update Available</div>
                  <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>qBitWeb v{updateAvailable} is out now.</div>
                </div>
                <a 
                  href={`https://github.com/havok89/qBitWeb/releases/tag/v${updateAvailable}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="btn btn-primary"
                  style={{ textDecoration: 'none', padding: '6px 10px', fontSize: '12px' }}
                >
                  View Notes
                </a>
              </div>
            )}
            
            <form onSubmit={handleSaveSettings} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
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

              {(sonarrAvailable || radarrAvailable) && (
                <div style={{ marginTop: '8px', borderTop: '1px solid var(--border-color)', paddingTop: '16px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <div>
                      <div style={{ fontWeight: 600, fontSize: '14px' }}>Fake Torrent Auto-Cleaner</div>
                      <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '2px' }}>
                        Auto-removes & blocklists releases with .exe payloads and no video files.
                      </div>
                    </div>
                    <label className="checkbox-group" style={{ cursor: 'pointer' }}>
                      <input 
                        type="checkbox" 
                        checked={cleanerStatus?.enabled ?? true} 
                        onChange={(e) => handleToggleCleaner(e.target.checked)}
                        style={{ width: '18px', height: '18px', accentColor: 'var(--accent-blue)', cursor: 'pointer' }}
                      />
                    </label>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px', flexWrap: 'wrap' }}>
                    <button 
                      type="button" 
                      className="btn btn-secondary" 
                      style={{ fontSize: '13px', padding: '6px 12px', display: 'flex', alignItems: 'center', gap: '6px' }}
                      onClick={handleRunCleanerNow}
                      disabled={isScanningCleaner}
                    >
                      {isScanningCleaner ? <Loader2 size={14} className="spinner" /> : <RefreshCw size={14} />}
                      {isScanningCleaner ? 'Scanning Queues...' : 'Scan Queues Now'}
                    </button>

                    {cleanerStatus && (
                      <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
                        {cleanerStatus.cleanedCount > 0 ? `${cleanerStatus.cleanedCount} fake release${cleanerStatus.cleanedCount > 1 ? 's' : ''} cleaned` : 'Queue currently clean'}
                      </span>
                    )}
                  </div>

                  {cleanerScanMessage && (
                    <div style={{
                      padding: '8px 12px',
                      borderRadius: '6px',
                      fontSize: '12px',
                      backgroundColor: cleanerScanMessage.type === 'success' ? 'rgba(76, 175, 80, 0.15)' : cleanerScanMessage.type === 'error' ? 'rgba(255, 77, 77, 0.15)' : 'rgba(10, 132, 255, 0.15)',
                      color: cleanerScanMessage.type === 'success' ? '#4caf50' : cleanerScanMessage.type === 'error' ? '#ff4d4d' : 'var(--accent-blue)',
                      border: `1px solid ${cleanerScanMessage.type === 'success' ? 'rgba(76, 175, 80, 0.3)' : cleanerScanMessage.type === 'error' ? 'rgba(255, 77, 77, 0.3)' : 'rgba(10, 132, 255, 0.3)'}`
                    }}>
                      {cleanerScanMessage.text}
                    </div>
                  )}

                  <details style={{ fontSize: '12px', background: 'rgba(255,255,255,0.03)', borderRadius: '6px', padding: '8px 12px' }}>
                    <summary style={{ cursor: 'pointer', color: 'var(--text-secondary)', fontWeight: 500 }}>
                      Recent Blocklisted Releases ({cleanerStatus?.recentActions?.length || 0})
                    </summary>
                    <div style={{ marginTop: '8px', display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '140px', overflowY: 'auto' }}>
                      {cleanerStatus?.recentActions?.length > 0 ? (
                        cleanerStatus.recentActions.map((act, idx) => (
                          <div key={idx} style={{ borderBottom: '1px solid rgba(255,255,255,0.05)', paddingBottom: '6px' }}>
                            <div style={{ fontWeight: 600, color: 'var(--danger)' }}>{act.title}</div>
                            <div style={{ color: 'var(--text-secondary)', fontSize: '11px', marginTop: '2px' }}>
                              {act.service.toUpperCase()} • {act.reason} • {new Date(act.timestamp).toLocaleTimeString()}
                            </div>
                          </div>
                        ))
                      ) : (
                        <div style={{ color: 'var(--text-secondary)', fontStyle: 'italic', padding: '4px 0' }}>
                          No releases blocklisted yet.
                        </div>
                      )}
                    </div>
                  </details>
                </div>
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
              <div style={{ textAlign: 'center', marginTop: '4px', fontSize: '12px', color: 'var(--text-secondary)' }}>
                qBitWeb v{pkg.version}
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Add Media Modal */}
      {showAddMediaModal && (
        <AddMediaModal 
          onClose={() => {
            setShowAddMediaModal(false);
            setInitialSearchTerm('');
          }} 
          onAdded={() => {
            setLibraryRefreshTrigger(prev => prev + 1);
          }}
          initialSearchTerm={initialSearchTerm}
          initialMode={radarrAvailable && !sonarrAvailable ? 'movie' : 'series'} 
          sonarrAvailable={sonarrAvailable}
          radarrAvailable={radarrAvailable}
        />
      )}

      {/* Active Searches Modal */}
      <ActiveSearchesModal 
        isOpen={showSearchesModal}
        onClose={() => setShowSearchesModal(false)}
      />

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
