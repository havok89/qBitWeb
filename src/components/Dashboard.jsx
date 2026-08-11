import React, { useState, useEffect, useCallback } from 'react';
import TorrentCard from './TorrentCard';
import { getTorrents, pauseTorrent, resumeTorrent, addTorrents } from '../api';
import { DownloadCloud, Zap, Play, Square, Plus, Loader2 } from 'lucide-react';

const Dashboard = () => {
  const [torrents, setTorrents] = useState([]);
  const [error, setError] = useState(null);
  
  // Add Modal State
  const [showAddModal, setShowAddModal] = useState(false);
  const [addUrls, setAddUrls] = useState('');
  const [isAdding, setIsAdding] = useState(false);

  const fetchTorrents = useCallback(async () => {
    try {
      const data = await getTorrents();
      if (Array.isArray(data)) {
        setTorrents(data);
        setError(null);
      }
    } catch (err) {
      setError('Failed to connect to qBittorrent');
    }
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

  return (
    <div>
      <header className="app-header">
        <div className="app-title" style={{ color: 'var(--accent-blue)', display: 'flex', alignItems: 'center', gap: '12px' }}>
          <Zap size={32} fill="currentColor" />
          <span style={{ fontSize: '24px', fontWeight: 'bold', color: 'var(--text-primary)' }}>qBitWeb</span>
        </div>
        
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
      </header>
      
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

      {/* Add Torrent Modal */}
      {showAddModal && (
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
