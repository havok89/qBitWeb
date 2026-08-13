import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import { Calendar, Search, Loader2, AlertCircle, Clock, CheckCircle2, DownloadCloud, List, X, Download } from 'lucide-react';
import { searchEpisode, getReleases, downloadRelease } from '../sonarrApi';

const SonarrCard = ({ episode, isDownloading, hideSearch }) => {
  const [isSearching, setIsSearching] = useState(false);
  const [searchSuccess, setSearchSuccess] = useState(false);
  const [isTitleExpanded, setIsTitleExpanded] = useState(false);
  
  // Interactive Search State
  const [showInteractiveModal, setShowInteractiveModal] = useState(false);
  const [releases, setReleases] = useState([]);
  const [isLoadingReleases, setIsLoadingReleases] = useState(false);
  const [downloadingGuid, setDownloadingGuid] = useState(null);

  const seriesTitle = episode.series?.title || 'Unknown Series';
  const episodeTitle = episode.title || 'Unknown Episode';
  const seasonEp = `Season ${episode.seasonNumber} - Episode ${String(episode.episodeNumber).padStart(2, '0')}`;
  
  const airDateStr = episode.airDateUtc 
    ? new Date(episode.airDateUtc).toLocaleDateString(undefined, { 
        weekday: 'short', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit'
      })
    : episode.airDate || 'Unknown Date';

  const posterImage = episode.series?.images?.find(img => img.coverType === 'poster');
  const posterSrc = posterImage ? (posterImage.url || posterImage.remoteUrl) : null;

  const bgImage = episode.series?.images?.find(img => img.coverType === 'fanart');
  const bgSrc = bgImage ? (bgImage.url || bgImage.remoteUrl) : null;

  const now = new Date();
  const airDate = new Date(episode.airDateUtc);
  const isUnaired = airDate > now;
  
  const statusBadge = episode.hasFile ? 'Downloaded' : (isDownloading ? 'Downloading' : (isUnaired ? 'Unaired' : 'Missing'));
  const statusColor = episode.hasFile ? '#34C759' : (isDownloading ? '#34C759' : (isUnaired ? 'var(--accent-blue)' : 'var(--danger)'));

  const handleSearch = async () => {
    if (isSearching || searchSuccess) return;
    setIsSearching(true);
    const minWait = new Promise(resolve => setTimeout(resolve, 2000));
    try {
      const success = await searchEpisode(episode.id);
      if (success) {
        setSearchSuccess(true);
        setTimeout(() => setSearchSuccess(false), 5000);
      }
    } catch (e) {
      console.error(e);
    } finally {
      await minWait;
      setIsSearching(false);
    }
  };

  const handleInteractiveSearch = async () => {
    if (episode.hasFile || isUnaired || isDownloading) return;
    setShowInteractiveModal(true);
    setIsLoadingReleases(true);
    setReleases([]);
    try {
      const data = await getReleases(episode.id);
      // Sort by seeders desc, then size desc
      const sorted = data.sort((a, b) => b.seeders - a.seeders || b.size - a.size);
      setReleases(sorted);
    } catch (e) {
      console.error("Failed to get releases", e);
    } finally {
      setIsLoadingReleases(false);
    }
  };

  const handleDownloadRelease = async (guid, indexerId) => {
    if (downloadingGuid) return;
    setDownloadingGuid(guid);
    try {
      const success = await downloadRelease(guid, indexerId);
      if (success) {
        setSearchSuccess(true);
        setShowInteractiveModal(false);
        setTimeout(() => setSearchSuccess(false), 5000);
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

  return (
    <div className="modern-card sonarr-card" style={{ position: 'relative', overflow: 'hidden' }}>
      
      {/* Background Image with Overlay */}
      {bgSrc && (
        <div style={{
          position: 'absolute',
          top: 0, left: 0, right: 0, bottom: 0,
          backgroundImage: `url(${bgSrc})`,
          backgroundSize: 'cover',
          backgroundPosition: 'center',
          opacity: 0.15,
          zIndex: 0
        }} />
      )}

      {/* Content wrapper to stay above the background */}
      <div style={{ position: 'relative', zIndex: 1, display: 'flex', width: '100%', gap: '20px', alignItems: 'center' }}>
        {posterSrc && (
          <div style={{ flexShrink: 0 }}>
            <img 
              src={posterSrc} 
              alt="Poster" 
              style={{ width: '58px', height: '87px', objectFit: 'cover', borderRadius: '4px', boxShadow: '0 4px 6px rgba(0,0,0,0.5)' }} 
            />
          </div>
        )}
        
        <div className="modern-info">
          <div className="modern-title-row">
            <h3 
              title={seriesTitle}
              className={isTitleExpanded ? 'expanded' : ''}
              onClick={() => setIsTitleExpanded(!isTitleExpanded)}
            >
              {seriesTitle}
            </h3>
          </div>
          
          <div style={{ fontSize: '13px', color: 'var(--text-secondary)', fontStyle: 'italic', marginBottom: '2px' }}>
            {seasonEp}
          </div>
          
          <div style={{ fontSize: '14px', color: 'var(--accent-blue)', fontWeight: 500, marginBottom: '6px' }}>
            {episodeTitle}
          </div>
          
          <div className="modern-meta-row">
            <span className="meta-text highlight"><Calendar size={14} /> {airDateStr}</span>
            <span className="meta-divider">•</span>
            <span className="meta-text" style={{ color: statusColor, fontWeight: 600 }}>
              {statusBadge === 'Missing' && <AlertCircle size={14} style={{ marginRight: '4px' }} />}
              {statusBadge === 'Unaired' && <Clock size={14} style={{ marginRight: '4px' }} />}
              {statusBadge === 'Downloaded' && <CheckCircle2 size={14} style={{ marginRight: '4px' }} />}
              {statusBadge === 'Downloading' && <DownloadCloud size={14} style={{ marginRight: '4px' }} />}
              {statusBadge}
            </span>
          </div>
        </div>

        {!hideSearch && (
          <div className="action-buttons">
            <button 
              className="icon-btn" 
              onClick={handleInteractiveSearch} 
              title="Interactive Search"
              disabled={episode.hasFile || isUnaired || isDownloading}
              style={(episode.hasFile || isUnaired || isDownloading) ? { opacity: 0.5, cursor: 'not-allowed', marginRight: '4px' } : { marginRight: '4px' }}
            >
              <List size={18} />
            </button>
            <button 
              className={`icon-btn ${searchSuccess ? 'primary' : ''}`} 
              onClick={handleSearch} 
              title="Auto Search"
              disabled={isSearching || episode.hasFile || isUnaired || isDownloading}
              style={(episode.hasFile || isUnaired || isDownloading) ? { opacity: 0.5, cursor: 'not-allowed' } : {}}
            >
              {isSearching ? <Loader2 size={18} className="spinner" /> : <Search size={18} fill={searchSuccess ? 'currentColor' : 'none'} />}
            </button>
          </div>
        )}
      </div>

      {/* Interactive Search Modal */}
      {showInteractiveModal && createPortal(
        <div className="modal-overlay" onClick={() => setShowInteractiveModal(false)}>
          <div className="modal-content interactive-search-modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Releases for S{String(episode.seasonNumber).padStart(2, '0')}E{String(episode.episodeNumber).padStart(2, '0')} - {episodeTitle}</h2>
              <button className="icon-btn" onClick={() => setShowInteractiveModal(false)}>
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
                        <div className="release-title" title={release.title}>{release.title}</div>
                        <div className="release-meta">
                          <span className="release-indexer">{release.indexer}</span>
                          <span className="meta-divider">•</span>
                          <span className="release-size">{formatSize(release.size)}</span>
                          <span className="meta-divider">•</span>
                          <span className="release-peers" style={{ color: release.seeders > 0 ? '#34C759' : 'var(--text-secondary)' }}>
                            {release.seeders} S / {release.leechers} L
                          </span>
                        </div>
                        {release.rejected && (
                          <div className="release-rejected-reason">
                            <AlertCircle size={12} style={{ marginRight: '4px' }} />
                            {release.rejections?.join(', ') || 'Rejected by profile'}
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
      )}
    </div>
  );
};

export default SonarrCard;
