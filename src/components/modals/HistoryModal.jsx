import React, { useState, useEffect, useCallback } from 'react';
import { X, Loader2, Download, AlertCircle, CheckCircle, FileText, Ban } from 'lucide-react';
import { getMovieHistory, markMovieHistoryFailed } from '../../radarrApi';
import { getEpisodeHistory, getSeriesHistory, markEpisodeHistoryFailed } from '../../sonarrApi';
import { useToast } from '../../ToastContext';
import ConfirmModal from './ConfirmModal';
import Modal from './Modal';

const HistoryModal = ({ isOpen, onClose, itemId, isRadarr, isSeries, seasonNumber, title }) => {
  const [history, setHistory] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [blocklistTarget, setBlocklistTarget] = useState(null);
  const [isBlocklisting, setIsBlocklisting] = useState(false);
  const { addToast } = useToast();

  const fetchHistory = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      let data = [];
      if (isRadarr) {
        data = await getMovieHistory(itemId);
      } else if (isSeries) {
        data = await getSeriesHistory(itemId, seasonNumber !== undefined ? seasonNumber : null);
      } else {
        data = await getEpisodeHistory(itemId);
      }
      setHistory(data || []);
    } catch (err) {
      console.error("Failed to fetch history:", err);
      setError("Failed to load history.");
    } finally {
      setIsLoading(false);
    }
  }, [itemId, isRadarr, isSeries, seasonNumber]);

  useEffect(() => {
    if (!isOpen || !itemId) return;
    fetchHistory();
  }, [isOpen, itemId, fetchHistory]);

  const handleConfirmBlocklist = async () => {
    if (!blocklistTarget) return;
    setIsBlocklisting(true);
    try {
      let success = false;
      if (isRadarr) {
        success = await markMovieHistoryFailed(blocklistTarget.id);
      } else {
        success = await markEpisodeHistoryFailed(blocklistTarget.id);
      }

      if (success) {
        addToast('Release added to blocklist');
        setBlocklistTarget(null);
        await fetchHistory();
      } else {
        throw new Error('Failed to blocklist release');
      }
    } catch (err) {
      console.error('Error blocklisting release:', err);
      addToast('Failed to blocklist release');
    } finally {
      setIsBlocklisting(false);
    }
  };

  if (!isOpen) return null;

  const getEventIcon = (eventType) => {
    switch (eventType) {
      case 'grabbed': return <Download size={16} color="var(--accent-blue)" />;
      case 'downloadFolderImported': return <CheckCircle size={16} color="#34C759" />;
      case 'downloadFailed': return <AlertCircle size={16} color="var(--danger)" />;
      default: return <FileText size={16} color="var(--text-secondary)" />;
    }
  };

  const getEventName = (eventType) => {
    switch (eventType) {
      case 'grabbed': return 'Grabbed';
      case 'seriesFolderCreated': return 'Folder Created';
      case 'downloadFolderImported': return 'Imported';
      case 'downloadFailed': return 'Failed';
      case 'episodeFileDeleted': return 'File Deleted';
      case 'movieFileDeleted': return 'File Deleted';
      default: return eventType;
    }
  };

  return (
    <Modal>
      <div className="modal-overlay" onClick={(e) => { e.stopPropagation(); onClose(); }} style={{ zIndex: 10000 }}>
        <div className="modal-content" onClick={e => e.stopPropagation()} style={{ maxWidth: '600px', width: '90%', maxHeight: '80vh', display: 'flex', flexDirection: 'column' }}>
          <div className="modal-header">
            <h2>History {title ? `- ${title}` : ''}</h2>
            <button className="icon-btn" onClick={(e) => { e.stopPropagation(); onClose(); }}>
              <X size={24} />
            </button>
          </div>
          <div className="modal-body" style={{ overflowY: 'auto', flex: 1, padding: '16px' }}>
            {isLoading ? (
              <div style={{ display: 'flex', justifyContent: 'center', padding: '40px' }}>
                <Loader2 size={32} className="spinner" color="var(--accent-blue)" />
              </div>
            ) : error ? (
              <div style={{ color: 'var(--danger)', textAlign: 'center', padding: '20px' }}>
                {error}
              </div>
            ) : history.length === 0 ? (
              <div style={{ color: 'var(--text-secondary)', textAlign: 'center', padding: '20px' }}>
                No history found for this item.
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {history.map((record, index) => (
                  <div key={record.id || index} style={{ display: 'flex', gap: '12px', padding: '12px', background: 'rgba(255,255,255,0.05)', borderRadius: '8px' }}>
                    <div style={{ paddingTop: '2px' }}>
                      {getEventIcon(record.eventType)}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '4px' }}>
                        <span style={{ fontWeight: '600', fontSize: '15px' }}>
                          {getEventName(record.eventType)}
                        </span>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginLeft: '12px' }}>
                          {record.eventType === 'grabbed' && (
                            <button
                              type="button"
                              className="icon-btn danger"
                              onClick={(e) => {
                                e.stopPropagation();
                                setBlocklistTarget(record);
                              }}
                              title="Blocklist release (mark as failed)"
                              style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '4px',
                                padding: '3px 8px',
                                fontSize: '12px',
                                fontWeight: '500',
                                color: 'var(--danger)',
                                background: 'rgba(255, 69, 58, 0.12)',
                                border: '1px solid rgba(255, 69, 58, 0.3)',
                                borderRadius: '6px',
                                cursor: 'pointer',
                                transition: 'all 0.2s ease'
                              }}
                            >
                              <Ban size={13} />
                              <span>Blocklist</span>
                            </button>
                          )}
                          <span style={{ fontSize: '12px', color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>
                            {new Date(record.date).toLocaleString()}
                          </span>
                        </div>
                      </div>
                      {record.sourceTitle && (
                        <div style={{ fontSize: '13px', color: 'var(--text-secondary)', wordBreak: 'break-all' }}>
                          {record.sourceTitle}
                        </div>
                      )}
                      {record.data && record.data.indexer && (
                        <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '4px', fontWeight: '500' }}>
                          Indexer: <span style={{ color: 'var(--text-primary)' }}>{record.data.indexer}</span>
                        </div>
                      )}
                      {record.data && record.data.message && (
                        <div style={{ fontSize: '13px', color: 'var(--danger)', marginTop: '4px' }}>
                          {record.data.message}
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
      {blocklistTarget && (
        <ConfirmModal
          isOpen={Boolean(blocklistTarget)}
          onClose={() => setBlocklistTarget(null)}
          onConfirm={handleConfirmBlocklist}
          title="Blocklist Release"
          message={`Are you sure you want to mark this release as failed? It will be added to the blocklist in ${isRadarr ? 'Radarr' : 'Sonarr'} and will not be automatically downloaded again.`}
          confirmText="Blocklist Release"
          isDanger={true}
          isProcessing={isBlocklisting}
          zIndex={11000}
        >
          {blocklistTarget?.sourceTitle && (
            <div style={{ 
              marginTop: '12px', 
              padding: '8px 10px', 
              background: 'rgba(255,255,255,0.06)', 
              borderRadius: '6px', 
              fontSize: '13px', 
              wordBreak: 'break-all',
              color: 'var(--text-primary)'
            }}>
              {blocklistTarget.sourceTitle}
            </div>
          )}
        </ConfirmModal>
      )}
    </Modal>
  );
};

export default HistoryModal;
