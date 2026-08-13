import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Loader2, X, Download, AlertCircle } from 'lucide-react';
import { getReleases, getSeasonReleases, downloadRelease, getQueue as getSonarrQueue } from '../sonarrApi';
import { getMovieReleases, downloadMovieRelease, getMovieQueue } from '../radarrApi';

const InteractiveSearchModal = ({ isOpen, onClose, item, isRadarr, modalTitleDisplay, onSearchSuccess }) => {
  const [releases, setReleases] = useState([]);
  const [isLoadingReleases, setIsLoadingReleases] = useState(false);
  const [downloadingGuid, setDownloadingGuid] = useState(null);
  const [expandedReleases, setExpandedReleases] = useState({});

  useEffect(() => {
    if (isOpen && item) {
      const fetchReleases = async () => {
        setIsLoadingReleases(true);
        setReleases([]);
        try {
          let data = [];
          if (isRadarr) {
            data = await getMovieReleases(item.id);
          } else if (item.isSeason) {
            data = await getSeasonReleases(item.seriesId, item.seasonNumber);
          } else {
            data = await getReleases(item.id);
          }
          const sorted = data.sort((a, b) => b.seeders - a.seeders || b.size - a.size);
          setReleases(sorted);
        } catch (e) {
          console.error("Failed to get releases", e);
        } finally {
          setIsLoadingReleases(false);
        }
      };
      fetchReleases();
    }
  }, [isOpen, item, isRadarr]);

  const handleDownloadRelease = async (guid, indexerId) => {
    if (downloadingGuid) return;
    setDownloadingGuid(guid);
    const minWait = new Promise(resolve => setTimeout(resolve, 1000));
    try {
      const success = isRadarr ? await downloadMovieRelease(guid, indexerId) : await downloadRelease(guid, indexerId);
      if (success) {
        await minWait;
        if (onSearchSuccess) onSearchSuccess();
        onClose();
        
        // Polling queue logic is handled by parent triggering success state
      }
    } catch (e) {
      console.error("Failed to download release", e);
    } finally {
      setDownloadingGuid(null);
    }
  };

  const formatSize = (bytes) => {
    if (!bytes) return 'Unknown Size';
    const gb = bytes / (1024 * 1024 * 1024);
    if (gb >= 1) return `${gb.toFixed(1)} GB`;
    const mb = bytes / (1024 * 1024);
    return `${mb.toFixed(0)} MB`;
  };

  const formatReleaseDate = (release) => {
    if (release.publishDate) {
      return new Date(release.publishDate).toLocaleDateString();
    }
    if (release.age !== undefined) {
      if (release.age === 0) return 'Today';
      return `${release.age} day${release.age === 1 ? '' : 's'} ago`;
    }
    return '';
  };

  const toggleRelease = (guid) => {
    setExpandedReleases(prev => ({ ...prev, [guid]: !prev[guid] }));
  };

  if (!isOpen) return null;

  return createPortal(
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content interactive-search-modal" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h2>Releases for {modalTitleDisplay}</h2>
          <button className="icon-btn" onClick={onClose}>
            <X size={24} />
          </button>
        </div>
        
        <div className="modal-body release-list-container">
          {isLoadingReleases ? (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '40px 0', color: 'var(--text-secondary)' }}>
              <Loader2 size={32} className="spinner" style={{ marginBottom: '16px' }} />
              <div>Searching indexers...</div>
            </div>
          ) : releases.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '40px 0', color: 'var(--text-secondary)' }}>
              No releases found.
            </div>
          ) : (
            <div className="release-list">
              {releases.map((release) => (
                <div key={release.guid} className={`release-item ${release.rejected ? 'rejected' : ''}`}>
                  <div className="release-info">
                    <div className="release-title" title={release.title}>
                      {release.title}
                    </div>
                    <div className="release-meta">
                      <span className="meta-item release-indexer">{release.indexer}</span>
                      <span className="meta-item release-size">{formatSize(release.size)}</span>
                      <span className="meta-item release-peers" style={{ color: release.seeders > 0 ? '#34C759' : 'var(--text-secondary)' }}>
                        {release.seeders} S / {release.leechers} L
                      </span>
                      {formatReleaseDate(release) && (
                        <span className="meta-item release-date">{formatReleaseDate(release)}</span>
                      )}
                    </div>
                    {release.rejected && (
                      <div 
                        className={`release-rejected-reason ${expandedReleases[release.guid] ? 'expanded' : ''}`}
                        onClick={() => toggleRelease(release.guid)}
                        title="Tap to expand"
                      >
                        <AlertCircle size={12} style={{ marginRight: '4px', flexShrink: 0 }} />
                        <span>{release.rejections?.join(', ') || 'Rejected by profile'}</span>
                      </div>
                    )}
                  </div>
                  
                  <button 
                    className="download-release-btn"
                    onClick={() => handleDownloadRelease(release.guid, release.indexerId)}
                    disabled={downloadingGuid === release.guid}
                  >
                    {downloadingGuid === release.guid ? <Loader2 size={16} className="spinner" /> : <Download size={16} />}
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>,
    document.body
  );
};

export default InteractiveSearchModal;
