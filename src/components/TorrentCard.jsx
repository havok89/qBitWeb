import React, { useState, useEffect } from 'react';
import { format } from 'date-fns';
import { Calendar, Database, Tag, Play, Square, Trash2, Download, Upload, Loader2, Settings } from 'lucide-react';
import { pauseTorrent, resumeTorrent, deleteTorrent, getTorrentFiles, setFilePriority } from '../api';

const formatBytes = (bytes, decimals = 1) => {
  if (!+bytes) return '0 B';
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB', 'PB', 'EB', 'ZB', 'YB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(dm))} ${sizes[i]}`;
};

const formatStatus = (state) => {
  const map = {
    'error': 'Error',
    'missingFiles': 'Missing Files',
    'uploading': 'Seeding',
    'pausedUP': 'Paused (Seeding)',
    'stoppedUP': 'Stopped (Seeding)',
    'queuedUP': 'Queued',
    'stalledUP': 'Seeding',
    'checkingUP': 'Checking',
    'forcedUP': 'Forced Seeding',
    'allocating': 'Allocating',
    'downloading': 'Downloading',
    'metaDL': 'Fetching Metadata',
    'pausedDL': 'Paused',
    'stoppedDL': 'Stopped',
    'queuedDL': 'Queued',
    'stalledDL': 'Stalled',
    'checkingDL': 'Checking',
    'forcedDL': 'Forced Downloading',
    'checkingResumeData': 'Checking Resume',
    'moving': 'Moving',
    'unknown': 'Unknown'
  };
  return map[state] || state;
};

const TorrentCard = ({ torrent, onUpdate }) => {
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [showFilesModal, setShowFilesModal] = useState(false);
  const [files, setFiles] = useState([]);
  const [filesLoading, setFilesLoading] = useState(false);
  
  const [deleteFiles, setDeleteFiles] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const isPaused = torrent.state.includes('paused') || torrent.state.includes('stopped');
  const isSeeding = torrent.state.includes('UP') || torrent.state === 'uploading';
  
  const percentage = Math.floor(torrent.progress * 100);
  const statusText = formatStatus(torrent.state);

  const [isToggling, setIsToggling] = useState(false);
  const [isTitleExpanded, setIsTitleExpanded] = useState(false);

  const handleTogglePause = async () => {
    if (isToggling) return;
    setIsToggling(true);
    const minWait = new Promise(resolve => setTimeout(resolve, 2000));
    try {
      if (isPaused) {
        await resumeTorrent(torrent.hash);
      } else {
        await pauseTorrent(torrent.hash);
      }
      await onUpdate();
    } finally {
      await minWait;
      setIsToggling(false);
    }
  };

  const handleDelete = async () => {
    setIsDeleting(true);
    await deleteTorrent(torrent.hash, deleteFiles);
    setShowDeleteModal(false);
    onUpdate();
  };

  const loadFiles = async () => {
    setFilesLoading(true);
    try {
      const data = await getTorrentFiles(torrent.hash);
      if (Array.isArray(data)) setFiles(data);
    } catch (e) {
      console.error('Failed to load files', e);
    } finally {
      setFilesLoading(false);
    }
  };

  useEffect(() => {
    if (showFilesModal) {
      loadFiles();
    }
  }, [showFilesModal]);

  const handleToggleFile = async (fileIndex, currentPriority) => {
    const newPriority = currentPriority > 0 ? 0 : 1; // 0 = Do Not Download, 1 = Normal
    
    // Optimistic UI update
    setFiles(prev => prev.map(f => f.index === fileIndex ? { ...f, priority: newPriority } : f));
    
    try {
      await setFilePriority(torrent.hash, fileIndex, newPriority);
    } catch (e) {
      console.error('Failed to update file priority', e);
      // Revert on error
      setFiles(prev => prev.map(f => f.index === fileIndex ? { ...f, priority: currentPriority } : f));
    }
  };

  return (
    <>
      <div className="modern-card">
        <button 
          className={`modern-play-btn ${isPaused ? 'paused' : 'playing'} ${isToggling ? 'loading' : ''}`} 
          onClick={handleTogglePause}
          title={isPaused ? 'Start' : 'Stop'}
          disabled={isToggling}
        >
          {isToggling ? (
            <Loader2 size={20} className="spinner" />
          ) : isPaused ? (
            <Play size={20} fill="currentColor" style={{ marginLeft: '2px' }} /> 
          ) : (
            <Square size={16} fill="currentColor" />
          )}
        </button>
        
        <div className="modern-info">
          <div className="modern-title-row">
            <h3 
              title={torrent.name}
              className={isTitleExpanded ? 'expanded' : ''}
              onClick={() => setIsTitleExpanded(!isTitleExpanded)}
            >
              {torrent.name}
            </h3>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span className={`modern-status ${isSeeding ? 'seeding' : ''}`}>{statusText}</span>
              <button className="icon-btn" style={{ padding: '4px' }} onClick={() => setShowFilesModal(true)} title="Files & Settings">
                <Settings size={16} color="var(--text-secondary)" />
              </button>
            </div>
          </div>
          
          <div className="modern-progress-bg">
            <div 
              className={`modern-progress-fill ${isSeeding ? 'seeding' : ''}`} 
              style={{ width: `${percentage}%` }}
            />
          </div>
          
          <div className="modern-meta-row">
            <span className="meta-text highlight">{percentage}%</span>
            <span className="meta-divider">•</span>
            <span className="meta-text">{formatBytes(torrent.completed)} / {formatBytes(torrent.size)}</span>
            <span className="meta-divider">•</span>
            <span className="meta-text speed"><Download size={12} strokeWidth={3}/> {formatBytes(torrent.dlspeed)}/s</span>
            <span className="meta-divider">•</span>
            <span className="meta-text speed"><Upload size={12} strokeWidth={3}/> {formatBytes(torrent.upspeed)}/s</span>
            
            {torrent.category && (
               <>
                 <span className="meta-divider">•</span>
                 <span className="meta-text tag"><Tag size={12}/> {torrent.category}</span>
               </>
            )}
          </div>
        </div>

        <button className="modern-delete-btn" onClick={() => setShowDeleteModal(true)} title="Delete Torrent">
          <Trash2 size={18} />
        </button>
      </div>

      {/* Delete Modal */}
      {showDeleteModal && (
        <div className="modal-overlay" onClick={() => setShowDeleteModal(false)}>
          <div className="modal-content" onClick={e => e.stopPropagation()}>
            <h3>Delete Torrent</h3>
            <p>Are you sure you want to remove <strong>{torrent.name}</strong>?</p>
            
            <label className="checkbox-group">
              <input 
                type="checkbox" 
                checked={deleteFiles} 
                onChange={(e) => setDeleteFiles(e.target.checked)} 
              />
              Also delete the downloaded files on the hard drive
            </label>

            <div className="modal-actions">
              <button className="btn btn-secondary" onClick={() => setShowDeleteModal(false)}>Cancel</button>
              <button className="btn btn-danger" onClick={handleDelete} disabled={isDeleting}>
                {isDeleting ? 'Deleting...' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Files Modal */}
      {showFilesModal && (
        <div className="modal-overlay" onClick={() => setShowFilesModal(false)}>
          <div className="modal-content" onClick={e => e.stopPropagation()} style={{ maxWidth: '600px', width: '90%', maxHeight: '80vh', overflowY: 'auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <h3 style={{ margin: 0 }}>Torrent Files</h3>
              <button className="icon-btn" onClick={() => setShowFilesModal(false)} style={{ padding: '4px' }}>
                <span style={{ fontSize: '24px', lineHeight: '1' }}>&times;</span>
              </button>
            </div>
            
            <p style={{ fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '16px' }}>
              Tick the files you want to download. Unticked files will be skipped.
            </p>

            {filesLoading ? (
              <div style={{ display: 'flex', justifyContent: 'center', padding: '40px 0' }}>
                <Loader2 size={32} className="spinner" style={{ color: 'var(--accent-blue)' }} />
              </div>
            ) : files.length === 0 ? (
              <p>No files found.</p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {files.map(f => (
                  <label key={f.index} style={{ 
                    display: 'flex', 
                    alignItems: 'center', 
                    gap: '12px', 
                    padding: '8px', 
                    background: 'rgba(255,255,255,0.05)', 
                    borderRadius: '6px',
                    cursor: 'pointer' 
                  }}>
                    <input 
                      type="checkbox" 
                      checked={f.priority > 0} 
                      onChange={() => handleToggleFile(f.index, f.priority)} 
                      style={{ accentColor: 'var(--accent-blue)', width: '16px', height: '16px' }}
                    />
                    <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minWidth: 0 }}>
                      <span style={{ fontSize: '14px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{f.name}</span>
                      <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>{formatBytes(f.size)} • {Math.floor(f.progress * 100)}%</span>
                    </div>
                  </label>
                ))}
              </div>
            )}
            
            <div className="modal-actions" style={{ marginTop: '24px' }}>
              <button className="btn btn-secondary" onClick={() => setShowFilesModal(false)} style={{ width: '100%' }}>Done</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default TorrentCard;
