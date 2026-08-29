import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Calendar, Search, Loader2, AlertCircle, Clock, CheckCircle2, DownloadCloud, List, X, Download, Eye, EyeOff, ChevronRight } from 'lucide-react';
import { searchEpisode, getReleases, downloadRelease, unmonitorEpisode, getQueue as getSonarrQueue } from '../sonarrApi';
import { searchMovie, getMovieReleases, downloadMovieRelease, unmonitorMovie, getMovieQueue } from '../radarrApi';
import { useCommand } from '../CommandContext';
import InteractiveSearchModal from './modals/InteractiveSearchModal';
import HistoryModal from './modals/HistoryModal';
import LazyImage from './LazyImage';

const MediaCard = ({ item, queueStatus, hideSearch, hideHistory, hideUnmonitor, onSelectMedia }) => {
  const isRadarr = item._type === 'radarr';
  const { searchStatuses, trackCommand } = useCommand();
  const trackingKey = isRadarr ? `radarr-movie-${item.id}` : (item.series ? `sonarr-episode-${item.id}` : `sonarr-series-${item.id}`);
  const commandState = searchStatuses[trackingKey] || {};
  const isSearching = commandState.isSearching || false;
  const searchSuccess = commandState.isSuccess || false;
  
  const [isTitleExpanded, setIsTitleExpanded] = useState(false);
  
  // Interactive Search State
  const [showInteractiveModal, setShowInteractiveModal] = useState(false);
  
  // Unmonitor state
  const [isUnmonitored, setIsUnmonitored] = useState(false);
  const [isUnmonitoring, setIsUnmonitoring] = useState(false);
  const [showConfirmUnmonitor, setShowConfirmUnmonitor] = useState(false);

  // History State
  const [showHistoryModal, setShowHistoryModal] = useState(false);

  // Status override state
  const [isPendingDownload, setIsPendingDownload] = useState(false);
  const [localQueueStatus, setLocalQueueStatus] = useState(queueStatus);

  useEffect(() => {
    setLocalQueueStatus(queueStatus);
  }, [queueStatus]);

  const isSonarrEpisode = !isRadarr && item.series;
  const isSonarrSeries = !isRadarr && !item.series;

  useEffect(() => {
    if (searchSuccess) {
      const checkQueue = async () => {
        try {
          const queue = isRadarr ? await getMovieQueue() : await getSonarrQueue();
          const matchedQ = queue.find(q => (isRadarr ? q.movieId : q.episodeId) === item.id);
          if (matchedQ) {
            setLocalQueueStatus(matchedQ.status === 'completed' ? 'importing' : 'downloading');
          }
        } catch (e) {
          console.error(e);
        } finally {
          setIsPendingDownload(false);
        }
      };
      checkQueue();
    }
  }, [searchSuccess, isRadarr, item.id]);

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

  const radarrMovieId = isRadarr ? item.id : null;
  const sonarrSeriesId = !isRadarr ? (isSonarrSeries ? item.id : (item.seriesId || item.series?.id)) : null;

  const images = (isRadarr || isSonarrSeries) ? item.images : item.series?.images;
  const rawPoster = images?.find(img => img.coverType === 'poster');
  const rawBg = images?.find(img => img.coverType === 'fanart');

  let posterSrc = rawPoster ? (rawPoster.url || rawPoster.remoteUrl) : null;
  let bgSrc = rawBg ? (rawBg.url || rawBg.remoteUrl) : null;

  if (isRadarr && radarrMovieId && radarrMovieId > 0) {
    posterSrc = `/radarr-media/${radarrMovieId}/poster.jpg`;
    bgSrc = `/radarr-media/${radarrMovieId}/fanart.jpg`;
  } else if (!isRadarr && sonarrSeriesId && sonarrSeriesId > 0) {
    posterSrc = `/sonarr-media/${sonarrSeriesId}/poster.jpg`;
    bgSrc = `/sonarr-media/${sonarrSeriesId}/fanart.jpg`;
  } else {
    if (posterSrc && posterSrc.includes('MediaCover')) {
      posterSrc = posterSrc.replace(/.*MediaCover/, isRadarr ? '/radarr-media' : '/sonarr-media');
    }
    if (bgSrc && bgSrc.includes('MediaCover')) {
      bgSrc = bgSrc.replace(/.*MediaCover/, isRadarr ? '/radarr-media' : '/sonarr-media');
    }
  }

  const now = new Date();
  const isUnaired = rawDate ? new Date(rawDate) > now : false;
  
  const isDownloading = !!localQueueStatus;

  let statusBadge = 'Missing';
  let statusColor = 'var(--danger)';
  let spinnerColor = null;
  
  if (isSonarrSeries) {
    const rawStatus = item.status || 'Continuing';
    statusBadge = rawStatus.charAt(0).toUpperCase() + rawStatus.slice(1);
    statusColor = statusBadge.toLowerCase() === 'ended' ? 'var(--text-secondary)' : '#34C759';
  } else {
    if (item.hasFile) {
      let qualityStr = '';
      let sizeStr = '';
      const file = item.movieFile || item.episodeFile;
      const qualityObj = item.quality || (file && file.quality);
      
      if (qualityObj) {
        if (qualityObj.quality && qualityObj.quality.name) {
          qualityStr = qualityObj.quality.name;
        } else if (qualityObj.name) {
          qualityStr = qualityObj.name;
        } else if (typeof qualityObj === 'string') {
          qualityStr = qualityObj;
        }
      }
      
      const sizeBytes = file ? file.size : (item.sizeOnDisk > 0 ? item.sizeOnDisk : null);
      if (sizeBytes) {
        const sizeGB = (sizeBytes / (1024 * 1024 * 1024)).toFixed(1);
        sizeStr = sizeGB >= 1 ? `${sizeGB} GB` : `${Math.round(sizeBytes / (1024 * 1024))} MB`;
      }
      
      if (qualityStr && sizeStr) statusBadge = `${qualityStr} (${sizeStr})`;
      else if (qualityStr) statusBadge = qualityStr;
      else if (sizeStr) statusBadge = sizeStr;
      else statusBadge = 'Downloaded';
      
      statusColor = '#34C759';
    } else if (localQueueStatus === 'importing') {
      statusBadge = 'Importing';
      statusColor = '#A855F7';
      spinnerColor = '#A855F7';
    } else if (localQueueStatus === 'downloading') {
      statusBadge = 'Downloading';
      statusColor = 'var(--accent-blue)';
      spinnerColor = 'var(--accent-blue)';
    } else if (isUnaired) {
      statusBadge = 'Unaired';
      statusColor = 'var(--text-secondary)';
    }
  }
  
  if (isPendingDownload) {
    statusColor = 'var(--accent-blue)';
    spinnerColor = 'var(--accent-blue)';
  }

  const handleSearch = async () => {
    if (isSearching || searchSuccess) return;
    
    // We instantly show pending download logic to optimistic UI
    setIsPendingDownload(true);

    try {
      const commandId = isRadarr ? await searchMovie(item.id) : await searchEpisode(item.id);
      if (commandId) {
        const titleStr = isRadarr ? item.title : (item.series?.title ? `${item.series.title} - ${item.title}` : item.title);
        trackCommand(trackingKey, commandId, isRadarr, titleStr);
      } else {
        setIsPendingDownload(false);
      }
    } catch (e) {
      console.error(e);
      setIsPendingDownload(false);
    }
  };

  const handleInteractiveSearch = () => {
    if (item.hasFile) return;
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
    : isSonarrSeries 
      ? mainTitle
      : `S${String(item.seasonNumber).padStart(2, '0')}E${String(item.episodeNumber).padStart(2, '0')} - ${itemTitle}`;

  const unmonitorConfirmDisplay = isRadarr
    ? `${mainTitle} (${subTitle})`
    : isSonarrSeries
      ? mainTitle
      : `${mainTitle} - S${String(item.seasonNumber).padStart(2, '0')}E${String(item.episodeNumber).padStart(2, '0')} - ${itemTitle}`;

  return (
    <div 
      className="modern-card sonarr-card" 
      style={{ position: 'relative', overflow: 'hidden', cursor: onSelectMedia ? 'pointer' : 'default' }}
      onClick={() => { if (onSelectMedia) onSelectMedia(); }}
    >
      
      {/* Background Image with Overlay */}
      {bgSrc && (
        <LazyImage src={bgSrc} isBackground={true} backgroundOpacity={0.15} />
      )}

      {/* Content wrapper to stay above the background */}
      <div className="media-card-content">
        {posterSrc && (
          <div style={{ flexShrink: 0 }}>
            <LazyImage 
              src={posterSrc} 
              alt="Poster" 
              className="media-card-poster"
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
          
          <div className="media-card-subtitle">
            {subTitle}
          </div>
          
          {itemTitle && (
            <div className="media-card-itemtitle">
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
                  {(item.hasFile || statusBadge === 'Downloaded') && <CheckCircle2 size={14} style={{ marginRight: '4px' }} />}
                  {statusBadge === 'Downloading' && <Loader2 size={14} className="spinner" style={{ marginRight: '4px' }} />}
                  {statusBadge === 'Importing' && <Loader2 size={14} className="spinner" style={{ marginRight: '4px' }} />}
                </>
              )}
              {isPendingDownload ? 'Checking...' : statusBadge}
            </span>
          </div>
        </div>

        <div className="action-buttons">
          {isRadarr && !hideUnmonitor && !hideSearch && (
            <button 
              className="icon-btn" 
              onClick={(e) => { 
                e.stopPropagation(); 
                if (item.monitored !== false) {
                  setShowConfirmUnmonitor(true); 
                }
              }} 
              title={item.monitored !== false ? "Unmonitor (Remove from missing)" : "Unmonitored"}
              disabled={isUnmonitoring || item.hasFile || isDownloading || item.monitored === false}
              style={(item.hasFile || isDownloading || item.monitored === false) ? { opacity: 0.5, cursor: 'not-allowed' } : {}}
            >
              {isUnmonitoring ? <Loader2 size={18} className="spinner" /> : (item.monitored !== false ? <Eye size={18} color="var(--accent-blue)" /> : <EyeOff size={18} color="var(--text-secondary)" />)}
            </button>
          )}
          {!hideHistory && (
            <button 
              className="icon-btn" 
              onClick={(e) => { e.stopPropagation(); setShowHistoryModal(true); }} 
              title="View History"
            >
              <Clock size={18} />
            </button>
          )}
          <button 
            type="button"
            className="icon-btn" 
            onClick={onSelectMedia}
            title="View Details"
            style={{ opacity: 0.8, color: 'var(--text-secondary)' }}
          >
            <ChevronRight size={18} />
          </button>
          {!hideSearch && (
            <>
              <button 
                className="icon-btn" 
                onClick={(e) => { e.stopPropagation(); handleInteractiveSearch(); }} 
                title="Interactive Search"
                disabled={item.hasFile}
                style={item.hasFile ? { opacity: 0.5, cursor: 'not-allowed' } : {}}
              >
                <List size={18} />
              </button>
              <button 
                className={`icon-btn ${searchSuccess ? 'primary' : ''}`} 
                onClick={(e) => { e.stopPropagation(); handleSearch(); }} 
                title="Auto Search"
                disabled={isSearching || item.hasFile || isDownloading}
                style={(item.hasFile || isDownloading) ? { opacity: 0.5, cursor: 'not-allowed' } : {}}
              >
                {isSearching ? <Loader2 size={18} className="spinner" /> : <Search size={18} fill={searchSuccess ? 'currentColor' : 'none'} />}
              </button>
            </>
          )}
        </div>
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
              const matchedQ = queue.find(q => (isRadarr ? q.movieId : q.episodeId) === item.id);
              if (matchedQ) {
                setLocalQueueStatus(matchedQ.status === 'completed' ? 'importing' : 'downloading');
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

      {/* History Modal */}
      {showHistoryModal && createPortal(
        <HistoryModal 
          isOpen={showHistoryModal} 
          onClose={() => setShowHistoryModal(false)} 
          itemId={item.id} 
          isRadarr={isRadarr} 
          isSeries={isSonarrSeries}
          title={modalTitleDisplay} 
        />,
        document.body
      )}
    </div>
  );
};

export default MediaCard;
