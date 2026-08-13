import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Calendar, Search, Loader2, AlertCircle, Clock, CheckCircle2, DownloadCloud, List, X, Download, EyeOff } from 'lucide-react';
import { searchEpisode, getReleases, downloadRelease, unmonitorEpisode, getQueue as getSonarrQueue } from '../sonarrApi';
import { searchMovie, getMovieReleases, downloadMovieRelease, unmonitorMovie, getMovieQueue } from '../radarrApi';
import InteractiveSearchModal from './InteractiveSearchModal';

const MediaCard = ({ item, isDownloading, hideSearch }) => {
  const isRadarr = item._type === 'radarr';
  
  const [isSearching, setIsSearching] = useState(false);
  const [searchSuccess, setSearchSuccess] = useState(false);
  const [isTitleExpanded, setIsTitleExpanded] = useState(false);
  
  // Interactive Search State
  const [showInteractiveModal, setShowInteractiveModal] = useState(false);
  
  // Unmonitor state
  const [isUnmonitored, setIsUnmonitored] = useState(false);
  const [isUnmonitoring, setIsUnmonitoring] = useState(false);
  const [showConfirmUnmonitor, setShowConfirmUnmonitor] = useState(false);

  // Status override state
  const [isPendingDownload, setIsPendingDownload] = useState(false);
  const [localIsDownloading, setLocalIsDownloading] = useState(isDownloading);

  useEffect(() => {
    setLocalIsDownloading(isDownloading);
  }, [isDownloading]);

  const isSonarrEpisode = !isRadarr && item.series;
  const isSonarrSeries = !isRadarr && !item.series;

  const mainTitle = isRadarr ? item.title : (isSonarrEpisode ? item.series.title : item.title || 'Unknown Series');
  
  let subTitle = '';
  if (isRadarr) {
    subTitle = item.year || '';
  } else if (isSonarrEpisode) {
    subTitle = `Season ${item.seasonNumber} - Episode ${String(item.episodeNumber).padStart(2, '0')}`;
  } else if (isSonarrSeries) {
    subTitle = item.network || (item.year ? `${item.year} Series` : 'Series');
  }

  const itemTitle = isSonarrEpisode ? (item.title || 'Unknown Episode') : '';

  let rawDate = null;
  let dateType = '';
  if (isRadarr) {
    if (item.digitalRelease) {
      rawDate = item.digitalRelease;
      dateType = 'Digital Release';
    } else if (item.physicalRelease) {
      rawDate = item.physicalRelease;
      dateType = 'Physical Release';
    } else if (item.inCinemas) {
      rawDate = item.inCinemas;
      dateType = 'In Cinemas';
    }
  } else if (isSonarrEpisode) {
    rawDate = item.airDateUtc;
  } else if (isSonarrSeries) {
    rawDate = item.firstAired;
    dateType = 'First Aired';
  }

  const airDateStr = rawDate 
    ? new Date(rawDate).toLocaleDateString(undefined, { 
        weekday: 'short', month: 'short', day: 'numeric', 
        ...(isSonarrEpisode ? { hour: '2-digit', minute: '2-digit' } : {})
      })
    : (isRadarr ? 'Unknown Date' : (isSonarrEpisode ? (item.airDate || 'Unknown Date') : 'Unknown Aired Date'));

  const dateLabel = dateType ? `${dateType}: ` : '';

  const images = (isRadarr || isSonarrSeries) ? item.images : item.series?.images;
  const rawPoster = images?.find(img => img.coverType === 'poster');
  let posterSrc = rawPoster ? (rawPoster.remoteUrl || rawPoster.url) : null;
  
  const rawBg = images?.find(img => img.coverType === 'fanart');
  let bgSrc = rawBg ? (rawBg.remoteUrl || rawBg.url) : null;

  // Rewrite image URLs for proxy
  if (posterSrc && posterSrc.includes('/MediaCover')) {
    posterSrc = posterSrc.replace(/.*\/MediaCover/, isRadarr ? '/radarr-media' : '/sonarr-media');
  }
  if (bgSrc && bgSrc.includes('/MediaCover')) {
    bgSrc = bgSrc.replace(/.*\/MediaCover/, isRadarr ? '/radarr-media' : '/sonarr-media');
  }

  const now = new Date();
  const isUnaired = rawDate ? new Date(rawDate) > now : false;
  
  let statusBadge = 'Missing';
  let statusColor = 'var(--danger)';
  
  if (isSonarrSeries) {
    statusBadge = item.status || 'Continuing';
    statusColor = statusBadge.toLowerCase() === 'ended' ? 'var(--text-secondary)' : '#34C759';
  } else {
    if (item.hasFile) {
      statusBadge = 'Downloaded';
      statusColor = '#34C759';
    } else if (localIsDownloading) {
      statusBadge = 'Downloading';
      statusColor = 'var(--accent-blue)';
    } else if (isUnaired) {
      statusBadge = 'Unaired';
      statusColor = 'var(--text-secondary)';
    }
  }
  
  if (isPendingDownload) {
    statusColor = 'var(--accent-blue)';
  }

  const handleSearch = async () => {
    if (isSearching || searchSuccess) return;
    setIsSearching(true);
    const minWait = new Promise(resolve => setTimeout(resolve, 2000));
    try {
      const success = isRadarr ? await searchMovie(item.id) : await searchEpisode(item.id);
      if (success) {
        setSearchSuccess(true);
        setIsPendingDownload(true);
        setTimeout(() => setSearchSuccess(false), 5000);
        
        // Wait 10 seconds, then check the queue
        setTimeout(async () => {
          try {
            const queue = isRadarr ? await getMovieQueue() : await getSonarrQueue();
            if (isRadarr) {
              if (queue.some(q => q.movieId === item.id)) setLocalIsDownloading(true);
            } else {
              if (queue.some(q => q.episodeId === item.id)) setLocalIsDownloading(true);
            }
          } catch (e) {
            console.error(e);
          } finally {
            setIsPendingDownload(false);
          }
        }, 10000);
      }
    } catch (e) {
      console.error(e);
    } finally {
      await minWait;
      setIsSearching(false);
    }
  };

  const handleInteractiveSearch = () => {
    if (item.hasFile || isUnaired || isDownloading) return;
    setShowInteractiveModal(true);
  };

  const handleUnmonitor = async () => {
    if (isUnmonitoring) return;
    setIsUnmonitoring(true);
    const minWait = new Promise(resolve => setTimeout(resolve, 1000));
    try {
      const success = isRadarr ? await unmonitorMovie(item.id) : await unmonitorEpisode(item.id);
      if (success) {
        await minWait;
        setIsUnmonitored(true);
      }
    } catch (e) {
      console.error("Failed to unmonitor item", e);
    } finally {
      setIsUnmonitoring(false);
    }
  };

  if (isUnmonitored) return null;

  const modalTitleDisplay = isRadarr 
    ? `${mainTitle} (${subTitle})`
    : `S${String(item.seasonNumber).padStart(2, '0')}E${String(item.episodeNumber).padStart(2, '0')} - ${itemTitle}`;

  const unmonitorConfirmDisplay = isRadarr
    ? `${mainTitle} (${subTitle})`
    : `${mainTitle} - S${String(item.seasonNumber).padStart(2, '0')}E${String(item.episodeNumber).padStart(2, '0')} - ${itemTitle}`;

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
              style={{ width: '64px', height: '97px', objectFit: 'cover', borderRadius: '4px', boxShadow: '0 4px 6px rgba(0,0,0,0.5)' }} 
            />
          </div>
        )}
        
        <div className="modern-info">
          <div className="modern-title-row">
            <h3 
              title={mainTitle}
              className={isTitleExpanded ? 'expanded' : ''}
              onClick={() => setIsTitleExpanded(!isTitleExpanded)}
            >
              {mainTitle}
            </h3>
          </div>
          
          <div style={{ fontSize: '13px', color: 'var(--text-secondary)', fontStyle: 'italic', marginBottom: '2px' }}>
            {subTitle}
          </div>
          
          {itemTitle && (
            <div style={{ fontSize: '14px', color: 'var(--accent-blue)', fontWeight: 500, marginBottom: '6px' }}>
              {itemTitle}
            </div>
          )}
          
          <div className="modern-meta-row media-card-meta" style={{ marginTop: itemTitle ? '0' : '6px' }}>
            <span className="meta-text highlight" title={dateLabel ? dateLabel.replace(': ', '') : 'Air Date'}>
              <Calendar size={14} /> {dateLabel}{airDateStr}
            </span>
            <span className="meta-divider">•</span>
            <span className="meta-text" style={{ color: statusColor, fontWeight: 600 }}>
              {isPendingDownload ? (
                <Loader2 size={14} className="spinner" style={{ marginRight: '4px' }} />
              ) : (
                <>
                  {statusBadge === 'Missing' && <AlertCircle size={14} style={{ marginRight: '4px' }} />}
                  {statusBadge === 'Unaired' && <Clock size={14} style={{ marginRight: '4px' }} />}
                  {statusBadge === 'Downloaded' && <CheckCircle2 size={14} style={{ marginRight: '4px' }} />}
                  {statusBadge === 'Downloading' && <DownloadCloud size={14} style={{ marginRight: '4px' }} />}
                </>
              )}
              {isPendingDownload ? 'Checking...' : statusBadge}
            </span>
          </div>
        </div>

        {!hideSearch && (
          <div className="action-buttons">
            <button 
              className="icon-btn danger" 
              onClick={() => setShowConfirmUnmonitor(true)} 
              title="Unmonitor (Remove from missing)"
              disabled={isUnmonitoring || item.hasFile || isDownloading}
              style={(item.hasFile || isDownloading) ? { opacity: 0.5, cursor: 'not-allowed' } : {}}
            >
              {isUnmonitoring ? <Loader2 size={18} className="spinner" /> : <EyeOff size={18} />}
            </button>
            <button 
              className="icon-btn" 
              onClick={handleInteractiveSearch} 
              title="Interactive Search"
              disabled={item.hasFile || isUnaired || isDownloading}
              style={(item.hasFile || isUnaired || isDownloading) ? { opacity: 0.5, cursor: 'not-allowed' } : {}}
            >
              <List size={18} />
            </button>
            <button 
              className={`icon-btn ${searchSuccess ? 'primary' : ''}`} 
              onClick={handleSearch} 
              title="Auto Search"
              disabled={isSearching || item.hasFile || isUnaired || isDownloading}
              style={(item.hasFile || isUnaired || isDownloading) ? { opacity: 0.5, cursor: 'not-allowed' } : {}}
            >
              {isSearching ? <Loader2 size={18} className="spinner" /> : <Search size={18} fill={searchSuccess ? 'currentColor' : 'none'} />}
            </button>
          </div>
        )}
      </div>

      {/* Interactive Search Modal */}
      <InteractiveSearchModal
        isOpen={showInteractiveModal}
        onClose={() => setShowInteractiveModal(false)}
        item={item}
        isRadarr={isRadarr}
        modalTitleDisplay={modalTitleDisplay}
        onSearchSuccess={() => {
          setSearchSuccess(true);
          setIsPendingDownload(true);
          setTimeout(() => setSearchSuccess(false), 5000);
          
          setTimeout(async () => {
            try {
              const queue = isRadarr ? await getMovieQueue() : await getSonarrQueue();
              if (isRadarr) {
                if (queue.some(q => q.movieId === item.id)) setLocalIsDownloading(true);
              } else {
                if (queue.some(q => q.episodeId === item.id)) setLocalIsDownloading(true);
              }
            } catch (e) {
              console.error(e);
            } finally {
              setIsPendingDownload(false);
            }
          }, 10000);
        }}
      />

      {/* Confirm Unmonitor Modal */}
      {showConfirmUnmonitor && createPortal(
        <div className="modal-overlay" onClick={() => setShowConfirmUnmonitor(false)}>
          <div className="modal-content" onClick={e => e.stopPropagation()} style={{ maxWidth: '350px' }}>
            <div className="modal-header">
              <h2>Confirm Unmonitor</h2>
              <button className="icon-btn" onClick={() => setShowConfirmUnmonitor(false)}>
                <X size={24} />
              </button>
            </div>
            
            <div className="modal-body" style={{ color: 'var(--text-secondary)', marginBottom: '24px', lineHeight: '1.5' }}>
              Are you sure you want to unmonitor <strong>{unmonitorConfirmDisplay}</strong>?
              <br /><br />
              It will no longer be searched for and will be removed from your Missing list.
            </div>
            
            <div className="modal-actions" style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
              <button 
                className="btn btn-secondary" 
                onClick={() => setShowConfirmUnmonitor(false)}
                disabled={isUnmonitoring}
              >
                Cancel
              </button>
              <button 
                className="btn btn-danger" 
                onClick={handleUnmonitor}
                disabled={isUnmonitoring}
                style={{ display: 'flex', alignItems: 'center', gap: '8px' }}
              >
                {isUnmonitoring ? <Loader2 size={16} className="spinner" /> : <EyeOff size={16} />}
                Unmonitor
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
};

export default MediaCard;
