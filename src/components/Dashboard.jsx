import React, { useState, useEffect, useCallback } from 'react';
import TorrentCard from './TorrentCard';
import SonarrList from './SonarrList';
import { getTorrents, pauseTorrent, resumeTorrent, addTorrents } from '../api';
import { checkSonarrStatus } from '../sonarrApi';
import { DownloadCloud, Zap, Play, Square, Plus, Loader2, Menu, X, Tv, Calendar } from 'lucide-react';

const Dashboard = () => {
  const [torrents, setTorrents] = useState([]);
  const [error, setError] = useState(null);
  
  const [showAddModal, setShowAddModal] = useState(false);
  const [addUrls, setAddUrls] = useState('');
  const [isAdding, setIsAdding] = useState(false);

  // New states for Sonarr integration
  const [sonarrAvailable, setSonarrAvailable] = useState(false);
  const [currentView, setCurrentView] = useState('torrents'); // 'torrents' | 'upcoming' | 'missing'
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  const fetchTorrents = useCallback(async () => {
    // Only fetch torrents if we are in the torrents view
    if (currentView !== 'torrents') return;
    try {
      const data = await getTorrents();
      if (Array.isArray(data)) {
        setTorrents(data);
        setError(null);
      }
    } catch (err) {
      setError('Failed to connect to qBittorrent');
    }
  }, [currentView]);

  useEffect(() => {
    const checkSonarr = async () => {
      const available = await checkSonarrStatus();
      setSonarrAvailable(available);
    };
    checkSonarr();
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
    if (!addUrls.trim()) return;
    
    setIsAdding(true);
    const formData = new FormData();
    formData.append('urls', addUrls);
    
    await addTorrents(formData);
    
    setIsAdding(false);
    setShowAddModal(false);
    setAddUrls('');
    fetchTorrents();
  };

  const changeView = (view) => {
    setCurrentView(view);
    setIsMenuOpen(false);
  };

  return (
    <div>
      <header className="app-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          {sonarrAvailable && (
            <button className="icon-btn" onClick={() => setIsMenuOpen(true)} style={{ padding: '4px' }}>
              <Menu size={28} color="var(--text-primary)" />
            </button>
          )}
          <div className="app-title" style={{ color: 'var(--accent-blue)', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Zap size={32} fill="currentColor" />
            <span style={{ fontSize: '24px', fontWeight: 'bold', color: 'var(--text-primary)' }}>
              {currentView === 'torrents' ? 'qBitWeb' : currentView === 'upcoming' ? 'Upcoming' : 'Missing'}
            </span>
          </div>
        </div>
        
        {currentView === 'torrents' && (
          <div className="app-actions">
            <button className="icon-btn" onClick={handlePauseAll} title="Stop All" disabled={isPausingAll}>
              {isPausingAll ? <Loader2 size={18} className="spinner" /> : <Square size={18} fill="currentColor" />}
            </button>
            <button className="icon-btn" onClick={handleResumeAll} title="Start All" disabled={isResumingAll}>
              {isResumingAll ? <Loader2 size={20} className="spinner" /> : <Play size={20} fill="currentColor" />}
            </button>
            <button className="icon-btn primary" onClick={() => setShowAddModal(true)} title="Add Torrent">
              <Plus size={20} strokeWidth={3} />
            </button>
          </div>
        )}
      </header>

      {/* Side Menu */}
      {isMenuOpen && (
        <div className="modal-overlay" onClick={() => setIsMenuOpen(false)} style={{ alignItems: 'flex-start', justifyContent: 'flex-start' }}>
          <div className="menu-sidebar" onClick={e => e.stopPropagation()} style={{
            background: 'var(--card-bg)',
            height: '100%',
            width: '250px',
            padding: '20px',
            display: 'flex',
            flexDirection: 'column',
            gap: '20px',
            boxShadow: '2px 0 10px rgba(0,0,0,0.5)'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h2 style={{ margin: 0 }}>Menu</h2>
              <button className="icon-btn" onClick={() => setIsMenuOpen(false)}><X size={24} /></button>
            </div>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <button 
                className={`menu-item-btn ${currentView === 'torrents' ? 'active' : ''}`}
                onClick={() => changeView('torrents')}
              >
                <Zap size={20} /> Torrents
              </button>
              <button 
                className={`menu-item-btn ${currentView === 'upcoming' ? 'active' : ''}`}
                onClick={() => changeView('upcoming')}
              >
                <Calendar size={20} /> Upcoming
              </button>
              <button 
                className={`menu-item-btn ${currentView === 'missing' ? 'active' : ''}`}
                onClick={() => changeView('missing')}
              >
                <Tv size={20} /> Missing
              </button>
            </div>
          </div>
        </div>
      )}
      
      {currentView === 'torrents' ? (
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
      ) : (
        <SonarrList mode={currentView} />
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
                  required
                />
              </div>
              <div className="modal-actions">
                <button type="button" className="btn btn-secondary" onClick={() => setShowAddModal(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary" disabled={isAdding}>
                  {isAdding ? 'Adding...' : 'Add Torrents'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default Dashboard;
