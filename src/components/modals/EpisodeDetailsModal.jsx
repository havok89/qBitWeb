import React, { useState } from 'react';
import { X, Trash2, Loader2 } from 'lucide-react';
import Modal from './Modal';
import { deleteEpisodeFile } from '../../sonarrApi';

const EpisodeDetailsModal = ({ isOpen, onClose, episode, seriesTitle, onFileDeleted }) => {
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [showMoreFileDetails, setShowMoreFileDetails] = useState(false);

  if (!isOpen || !episode) return null;

  const handleDeleteFile = async () => {
    setIsDeleting(true);
    try {
      await deleteEpisodeFile(episode.episodeFileId);
      onFileDeleted(episode.id);
      setShowDeleteConfirm(false);
    } catch (e) {
      alert('Failed to delete episode file.');
    } finally {
      setIsDeleting(false);
    }
  };

  const handleClose = () => {
    setShowDeleteConfirm(false);
    onClose();
  };

  return (
    <Modal>
      <div className="modal-overlay" onClick={handleClose}>
        <div className="modal-content" onClick={e => e.stopPropagation()} style={{ maxWidth: '500px', width: '90%' }}>
          <div className="modal-header">
            <h2>{seriesTitle} - S{String(episode.seasonNumber).padStart(2, '0')}E{String(episode.episodeNumber).padStart(2, '0')}</h2>
            <button className="icon-btn" onClick={handleClose}>
              <X size={20} />
            </button>
          </div>
          
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div style={{ fontWeight: '500', fontSize: '18px' }}>
              {episode.title}
            </div>
            <div style={{ fontSize: '15px', color: 'var(--text-secondary)', lineHeight: '1.6' }}>
              {episode.overview || 'No synopsis available.'}
            </div>
            
            {episode.episodeFile ? (
              <div style={{ background: '#1a1a1a', padding: '16px', borderRadius: '8px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <h3 style={{ margin: 0, fontSize: '16px', color: 'var(--text-primary)' }}>File Information</h3>
                  <button 
                    className="btn btn-secondary" 
                    onClick={() => setShowMoreFileDetails(!showMoreFileDetails)}
                    style={{ padding: '4px 12px', fontSize: '12px' }}
                  >
                    {showMoreFileDetails ? 'Less Details' : 'More Details'}
                  </button>
                </div>
                
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '8px 16px', marginTop: '4px' }}>
                  <div style={{ fontSize: '14px', color: 'var(--text-secondary)' }}>
                    <strong>Resolution:</strong> {episode.episodeFile.mediaInfo?.resolution || 'Unknown'}
                  </div>
                  <div style={{ fontSize: '14px', color: 'var(--text-secondary)' }}>
                    <strong>Size:</strong> {episode.episodeFile.size ? (episode.episodeFile.size / (1024 * 1024)).toFixed(2) + ' MB' : 'Unknown'}
                  </div>
                  <div style={{ fontSize: '14px', color: 'var(--text-secondary)' }}>
                    <strong>Added:</strong> {episode.episodeFile.dateAdded ? new Date(episode.episodeFile.dateAdded).toLocaleDateString() : 'Unknown'}
                  </div>
                  {episode.episodeFile.releaseGroup && (
                    <div style={{ fontSize: '14px', color: 'var(--text-secondary)' }}>
                      <strong>Group:</strong> {episode.episodeFile.releaseGroup}
                    </div>
                  )}
                  
                  {showMoreFileDetails && (
                    <>
                      <div style={{ fontSize: '14px', color: 'var(--text-secondary)' }}>
                        <strong>Video:</strong> {episode.episodeFile.mediaInfo?.videoCodec || 'Unknown'}
                      </div>
                      <div style={{ fontSize: '14px', color: 'var(--text-secondary)' }}>
                        <strong>Audio:</strong> {episode.episodeFile.mediaInfo?.audioCodec ? `${episode.episodeFile.mediaInfo.audioCodec} ${episode.episodeFile.mediaInfo.audioChannels ? `(${episode.episodeFile.mediaInfo.audioChannels})` : ''}` : 'Unknown'}
                      </div>
                      <div style={{ fontSize: '14px', color: 'var(--text-secondary)' }}>
                        <strong>Language:</strong> {episode.episodeFile.languages?.[0]?.name || episode.episodeFile.mediaInfo?.audioLanguages || 'Unknown'}
                      </div>
                      {episode.episodeFile.mediaInfo?.runTime && (
                        <div style={{ fontSize: '14px', color: 'var(--text-secondary)' }}>
                          <strong>Runtime:</strong> {episode.episodeFile.mediaInfo.runTime}
                        </div>
                      )}
                    </>
                  )}
                </div>
                
                {showMoreFileDetails && (
                  <>
                    {episode.episodeFile.mediaInfo?.subtitles && (
                      <div style={{ fontSize: '14px', color: 'var(--text-secondary)' }}>
                        <strong>Subtitles:</strong> <span style={{ wordBreak: 'break-word', display: 'inline-block' }}>{episode.episodeFile.mediaInfo.subtitles}</span>
                      </div>
                    )}
                    <div style={{ fontSize: '14px', color: 'var(--text-secondary)', marginTop: '4px' }}>
                      <strong>Path:</strong> <span style={{ wordBreak: 'break-all' }}>{episode.episodeFile.relativePath}</span>
                    </div>
                  </>
                )}
                
                <div style={{ marginTop: '8px', display: 'flex', justifyContent: 'flex-end' }}>
                  {!showDeleteConfirm ? (
                    <button 
                      className="btn media-action-btn" 
                      onClick={() => setShowDeleteConfirm(true)}
                      style={{ background: 'var(--danger)', color: '#fff', border: 'none', padding: '8px', borderRadius: '8px' }}
                      title="Delete File"
                    >
                      <Trash2 size={16} />
                    </button>
                  ) : (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', background: 'rgba(255, 69, 58, 0.1)', padding: '8px', borderRadius: '8px', border: '1px solid rgba(255, 69, 58, 0.2)' }}>
                      <span style={{ fontSize: '14px', color: 'var(--danger)' }}>Are you sure?</span>
                      <button className="btn btn-secondary" onClick={() => setShowDeleteConfirm(false)} style={{ padding: '4px 8px', fontSize: '13px' }}>Cancel</button>
                      <button 
                        className="btn btn-primary" 
                        onClick={handleDeleteFile}
                        disabled={isDeleting}
                        style={{ background: 'var(--danger)', padding: '4px 8px', fontSize: '13px', display: 'flex', alignItems: 'center', gap: '4px' }}
                      >
                        {isDeleting && <Loader2 size={12} className="spinner" />}
                        Confirm
                      </button>
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <div style={{ textAlign: 'center', padding: '16px', color: 'var(--text-secondary)', background: '#1a1a1a', borderRadius: '8px' }}>
                No file currently exists for this episode.
              </div>
            )}
          </div>
        </div>
      </div>
    </Modal>
  );
};

export default EpisodeDetailsModal;
