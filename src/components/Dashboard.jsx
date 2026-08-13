import React, { useState, useEffect, useCallback } from 'react';
import TorrentCard from './TorrentCard';
import MediaList from './MediaList';
import Login from './Login';
import AddMediaModal from './AddMediaModal';
import { getTorrents, pauseTorrent, resumeTorrent, addTorrents, getCategories, getPreferences, setPreferences } from '../api';
import { checkSonarrStatus, deleteSeries } from '../sonarrApi';
import { checkRadarrStatus, deleteMovie } from '../radarrApi';
import { DownloadCloud, Zap, Play, Square, Plus, Loader2, Menu, X, Tv, Calendar, History, Film, Settings, Database } from 'lucide-react';
import LibraryView from './LibraryView';
import MediaDetails from './MediaDetails';

const Dashboard = ({ isAuthenticated, onLogin }) => {
  const [torrents, setTorrents] = useState([]);
  const [error, setError] = useState(null);
  
  const [showAddModal, setShowAddModal] = useState(false);
  const [showAddMediaModal, setShowAddMediaModal] = useState(false);
  const [addUrls, setAddUrls] = useState('');
  const [addFiles, setAddFiles] = useState(null);
  const [isAdding, setIsAdding] = useState(false);
  
  const [categories, setCategories] = useState([]);
  const [selectedCategory, setSelectedCategory] = useState('');

  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [dlLimit, setDlLimit] = useState(0);
  const [upLimit, setUpLimit] = useState(0);
  const [maxActiveDownloads, setMaxActiveDownloads] = useState(3);
  const [isSavingSettings, setIsSavingSettings] = useState(false);

  useEffect(() => {
    if (showSettingsModal) {
      getPreferences().then(data => {
        if (data) {
          setDlLimit(data.dl_limit ? Math.round(data.dl_limit / 1024) : 0);
          setUpLimit(data.up_limit ? Math.round(data.up_limit / 1024) : 0);
          setMaxActiveDownloads(data.max_active_downloads !== undefined ? data.max_active_downloads : 3);
        }
      }).catch(console.error);
    }
  }, [showSettingsModal]);

  const handleSaveSettings = async (e) => {
    e.preventDefault();
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

  // New states for Media integration
  const [sonarrAvailable, setSonarrAvailable] = useState(false);
  const [radarrAvailable, setRadarrAvailable] = useState(false);
  const [currentView, setCurrentView] = useState(localStorage.getItem('currentView') || 'torrents'); // 'torrents' | 'upcoming' | 'recent' | 'missing' | 'library'
  const [selectedMediaItem, setSelectedMediaItem] = useState(() => {
    const saved = localStorage.getItem('selectedMediaItem');
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {
        return null;
      }
    }
    return null;
  });

  useEffect(() => {
    if (selectedMediaItem) {
      localStorage.setItem('selectedMediaItem', JSON.stringify(selectedMediaItem));
    } else {
      localStorage.removeItem('selectedMediaItem');
    }
  }, [selectedMediaItem]);

  const fetchTorrents = useCallback(async () => {
    // Only fetch torrents if we are in the torrents view and authenticated
    if (currentView !== 'torrents' || !isAuthenticated) return;
    try {
      const data = await getTorrents();
      if (Array.isArray(data)) {
        setTorrents(data);
        setError(null);
      }
    } catch (err) {
      setError('Failed to connect to qBittorrent');
    }
  }, [currentView, isAuthenticated]);

  useEffect(() => {
    const checkMediaServers = async () => {
      const [sAvailable, rAvailable] = await Promise.all([
        checkSonarrStatus(),
        checkRadarrStatus()
      ]);
      setSonarrAvailable(sAvailable);
      setRadarrAvailable(rAvailable);
    };
    checkMediaServers();
  }, []);

  useEffect(() => {
    fetchTorrents();
    const interval = setInterval(fetchTorrents, 2000);
    return () => clearInterval(interval);
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

  const changeView = (view) => {
    setCurrentView(view);
    localStorage.setItem('currentView', view);
    setSelectedMediaItem(null);
  };

  const handleDeleteMedia = async (id, isRadarr) => {
    if (isRadarr) {
      await deleteMovie(id, true);
    } else {
      await deleteSeries(id, true);
    }
    setSelectedMediaItem(null); // Return to library after deletion
  };

  return (
    <div>
      <header className="app-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div className="app-title" style={{ color: 'var(--accent-blue)', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Zap size={32} fill="currentColor" />
            <span style={{ fontSize: '24px', fontWeight: 'bold', color: 'var(--text-primary)' }}>
              {currentView === 'torrents' ? 'qBitWeb' : currentView === 'upcoming' ? 'Upcoming' : currentView === 'recent' ? 'Recently Added' : currentView === 'library' ? 'Library' : 'Missing'}
            </span>
          </div>
        </div>
        
        {currentView === 'torrents' && isAuthenticated && (
          <div className="app-actions">
            <button className="icon-btn" onClick={handlePauseAll} title="Stop All" disabled={isPausingAll}>
              {isPausingAll ? <Loader2 size={18} className="spinner" /> : <Square size={18} fill="currentColor" />}
            </button>
            <button className="icon-btn" onClick={handleResumeAll} title="Start All" disabled={isResumingAll}>
              {isResumingAll ? <Loader2 size={20} className="spinner" /> : <Play size={20} fill="currentColor" />}
            </button>
            <button className="icon-btn" onClick={() => setShowSettingsModal(true)} title="Settings">
              <Settings size={20} strokeWidth={2} />
            </button>
            <button className="icon-btn primary" onClick={() => setShowAddModal(true)} title="Add Torrent">
              <Plus size={20} strokeWidth={3} />
            </button>
          </div>
        )}
        
        {currentView !== 'torrents' && (
          <div className="app-actions">
            <button className="icon-btn primary" onClick={() => setShowAddMediaModal(true)} title="Add Media">
              <Plus size={20} strokeWidth={3} />
            </button>
          </div>
        )}
      </header>


      
      {selectedMediaItem ? (
        <MediaDetails 
          item={selectedMediaItem.item} 
          isRadarr={selectedMediaItem.isRadarr} 
          onBack={() => setSelectedMediaItem(null)}
          onDelete={handleDeleteMedia}
        />
      ) : currentView === 'torrents' ? (
        !isAuthenticated ? (
          <Login onLogin={onLogin} />
        ) : (
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
        )
      ) : currentView === 'library' ? (
        <LibraryView 
          onSelectMedia={(item, isRadarr) => setSelectedMediaItem({ item, isRadarr })}
          isDownloading={false} 
        />
      ) : (
        <MediaList mode={currentView} isAuthenticated={isAuthenticated} sonarrAvailable={sonarrAvailable} radarrAvailable={radarrAvailable} onSelectMedia={(item, isRadarr) => setSelectedMediaItem({ item, isRadarr })} />
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

              <div className="modal-actions" style={{ marginTop: '8px' }}>
                <button type="button" className="btn btn-secondary" onClick={() => setShowSettingsModal(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary" disabled={isSavingSettings}>
                  {isSavingSettings ? 'Saving...' : 'Save Settings'}
                </button>
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
          <button 
            className={`bottom-nav-btn ${currentView === 'torrents' ? 'active' : ''}`}
            onClick={() => changeView('torrents')}
          >
            <Zap size={24} />
            <span>Torrents</span>
          </button>

          <button 
            className={`bottom-nav-btn ${currentView === 'library' ? 'active' : ''}`}
            onClick={() => changeView('library')}
          >
            <Database size={24} />
            <span>Library</span>
          </button>
          
          <button 
            className={`bottom-nav-btn ${currentView === 'recent' ? 'active' : ''}`}
            onClick={() => changeView('recent')}
          >
            <History size={24} />
            <span>Recent</span>
          </button>
          
          <button 
            className={`bottom-nav-btn ${currentView === 'upcoming' ? 'active' : ''}`}
            onClick={() => changeView('upcoming')}
          >
            <Calendar size={24} />
            <span>Upcoming</span>
          </button>
          
          <button 
            className={`bottom-nav-btn ${currentView === 'missing' ? 'active' : ''}`}
            onClick={() => changeView('missing')}
          >
            <Film size={24} />
            <span>Missing</span>
          </button>
        </nav>
      )}
    </div>
  );
};

export default Dashboard;
