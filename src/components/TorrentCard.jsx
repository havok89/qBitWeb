import React, { useState } from 'react';
import { format } from 'date-fns';
import { Tag, Play, Square, Trash2, Download, Upload, Loader2, Settings } from 'lucide-react';
import { pauseTorrent, resumeTorrent, deleteTorrent } from '../api';
import ConfirmModal from './modals/ConfirmModal';
import TorrentFilesModal from './modals/TorrentFilesModal';

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
    'pausedUP': 'Completed',
    'queuedUP': 'Queued Seed',
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
  const [deleteFiles, setDeleteFiles] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isToggling, setIsToggling] = useState(false);
  const [isTitleExpanded, setIsTitleExpanded] = useState(false);

  const isPaused = torrent.state.includes('paused') || torrent.state.includes('stopped');
  const isSeeding = torrent.state.includes('UP') || torrent.state === 'uploading';
  
  const percentage = Math.floor(torrent.progress * 100);
  const statusText = formatStatus(torrent.state);

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
      onUpdate();
    } catch (e) {
      console.error('Failed to toggle torrent', e);
      alert('Failed to toggle torrent. See console for details.');
    } finally {
      await minWait;
      setIsToggling(false);
    }
  };

  const handleDelete = async () => {
    setIsDeleting(true);
    try {
      await deleteTorrent(torrent.hash, deleteFiles);
      onUpdate();
      setShowDeleteModal(false);
    } catch (e) {
      console.error('Failed to delete torrent', e);
      alert('Failed to delete torrent.');
    } finally {
      setIsDeleting(false);
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

      <ConfirmModal 
        isOpen={showDeleteModal}
        onClose={() => setShowDeleteModal(false)}
        onConfirm={handleDelete}
        title="Delete Torrent"
        message={<>Are you sure you want to remove <strong>{torrent.name}</strong>?</>}
        confirmText="Delete"
        isDanger={true}
        isProcessing={isDeleting}
      >
        <label className="checkbox-group" style={{ marginTop: '16px', display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
          <input 
            type="checkbox" 
            checked={deleteFiles} 
            onChange={(e) => setDeleteFiles(e.target.checked)} 
            style={{ width: '16px', height: '16px', accentColor: 'var(--danger)', cursor: 'pointer' }}
          />
          Also delete the downloaded files on the hard drive
        </label>
      </ConfirmModal>

      <TorrentFilesModal 
        isOpen={showFilesModal}
        onClose={() => setShowFilesModal(false)}
        torrent={torrent}
      />
    </>
  );
};

export default TorrentCard;
