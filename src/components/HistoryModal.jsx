import React, { useState, useEffect } from 'react';
import { X, Loader2, Download, AlertCircle, CheckCircle, FileText } from 'lucide-react';
import { getMovieHistory } from '../radarrApi';
import { getEpisodeHistory, getSeriesHistory } from '../sonarrApi';

const HistoryModal = ({ isOpen, onClose, itemId, isRadarr, isSeries, seasonNumber, title }) => {
  const [history, setHistory] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!isOpen || !itemId) return;
    
    const fetchHistory = async () => {
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
    };
    fetchHistory();
  }, [isOpen, itemId, isRadarr]);

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
    <div className="modal-overlay" onClick={onClose} style={{ zIndex: 10000 }}>
      <div className="modal-content" onClick={e => e.stopPropagation()} style={{ maxWidth: '600px', width: '90%', maxHeight: '80vh', display: 'flex', flexDirection: 'column' }}>
        <div className="modal-header">
          <h2>History {title ? `- ${title}` : ''}</h2>
          <button className="icon-btn" onClick={onClose}>
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
                      <span style={{ fontSize: '12px', color: 'var(--text-secondary)', whiteSpace: 'nowrap', marginLeft: '12px' }}>
                        {new Date(record.date).toLocaleString()}
                      </span>
                    </div>
                    {record.sourceTitle && (
                      <div style={{ fontSize: '13px', color: 'var(--text-secondary)', wordBreak: 'break-all' }}>
                        {record.sourceTitle}
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
  );
};

export default HistoryModal;
