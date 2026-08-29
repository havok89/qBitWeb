import React, { useState, useEffect } from 'react';
import { ArrowLeft, Trash2, Search, Loader2, Image as ImageIcon, AlertCircle, CheckCircle2, DownloadCloud, Clock, List, Edit2, Eye, EyeOff, X, ChevronDown, ChevronRight, Star } from 'lucide-react';
import { getEpisodes, searchEpisode, searchSeason, updateSeries, getSeriesQualityProfiles, getQueue, deleteEpisodeFile, unmonitorEpisode, monitorEpisode } from '../sonarrApi';
import { searchMovie, updateMovie, getMovieQualityProfiles, getMovieQueue, deleteMovieFile } from '../radarrApi';
import { useCommand } from '../CommandContext';
import InteractiveSearchModal from './modals/InteractiveSearchModal';
import HistoryModal from './modals/HistoryModal';
import Modal from './modals/Modal';
import ConfirmModal from './modals/ConfirmModal';
import EditMediaSettingsModal from './modals/EditMediaSettingsModal';
import EpisodeDetailsModal from './modals/EpisodeDetailsModal';
import SeasonList from './SeasonList';
import LazyImage from './LazyImage';

const MediaDetails = ({ item: initialItem, isRadarr, onBack, onDelete }) => {
  const [localItem, setLocalItem] = useState(initialItem);
  useEffect(() => {
    setLocalItem(initialItem);
  }, [initialItem]);
  const item = localItem;
  const [isDeleting, setIsDeleting] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  
  // Episode Details Modal State

  // Radarr Movie File Delete
  const [isDeletingMovieFile, setIsDeletingMovieFile] = useState(false);
  const [showMovieDeleteConfirm, setShowMovieDeleteConfirm] = useState(false);
  const [unmonitorTarget, setUnmonitorTarget] = useState(null);

  // Settings Modal State
  const [showSettings, setShowSettings] = useState(false);

  const { searchStatuses, trackCommand } = useCommand();
  
  // Interactive search state per episode
  const [interactiveModalData, setInteractiveModalData] = useState(null); // { item, isRadarr, title }

  // History state
  const [historyModalData, setHistoryModalData] = useState(null); // { itemId, isRadarr, title }

  // Collapsed seasons state
  const toggleSeasonCollapse = (seasonNum) => {
    setCollapsedSeasons(prev => ({ ...prev, [seasonNum]: !prev[seasonNum] }));
  };

  // Episode queue status map: episodeId -> 'downloading' | 'importing'
  const [episodeQueueMap, setEpisodeQueueMap] = useState(new Map());

  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);




  const [isTogglingMonitor, setIsTogglingMonitor] = useState(false);

  const handleToggleMonitor = async () => {
    if (item.monitored) {
      setUnmonitorTarget({
        type: 'item',
        title: item.title,
        action: async () => {
          setIsTogglingMonitor(true);
          try {
            const updatedData = { ...item, monitored: false };
            const result = isRadarr ? await updateMovie(updatedData) : await updateSeries(updatedData);
            setLocalItem(result);
          } catch (e) {
            console.error('Failed to unmonitor', e);
            alert('Failed to unmonitor state.');
          } finally {
            setIsTogglingMonitor(false);
            setUnmonitorTarget(null);
          }
        }
      });
    } else {
      setIsTogglingMonitor(true);
      try {
        const updatedData = { ...item, monitored: true };
        const result = isRadarr ? await updateMovie(updatedData) : await updateSeries(updatedData);
        setLocalItem(result);
      } catch (e) {
        console.error('Failed to monitor', e);
        alert('Failed to monitor state.');
      } finally {
        setIsTogglingMonitor(false);
      }
    }
  };

  const handleToggleEpisodeMonitor = async (ep) => {
    const newMonitored = !ep.monitored;
    try {
      if (newMonitored) {
        await monitorEpisode(ep.id);
      } else {
        await unmonitorEpisode(ep.id);
      }
      setEpisodes(prev => prev.map(e => e.id === ep.id ? { ...e, monitored: newMonitored } : e));
    } catch (err) {
      console.error('Failed to toggle episode monitor', err);
      alert('Failed to toggle episode monitor.');
    }
  };

  const radarrMovieId = isRadarr ? item.id : null;
  const sonarrSeriesId = !isRadarr ? item.id : null;

  const rawPoster = item.images?.find(img => img.coverType === 'poster');
  const rawBg = item.images?.find(img => img.coverType === 'fanart');

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

  // Group episodes by season
  const seasons = episodes.reduce((acc, ep) => {
    if (!acc[ep.seasonNumber]) acc[ep.seasonNumber] = [];
    acc[ep.seasonNumber].push(ep);
    return acc;
  }, {});

  const sortedSeasons = Object.keys(seasons).map(Number).sort((a, b) => b - a); // Newest season first

  return (
    <div className="media-details-container" style={{ color: '#fff', position: 'relative', zIndex: 1, height: '100%', overflowY: 'auto', overflowX: 'hidden', display: 'flex', flexDirection: 'column' }}>
      
      {/* Background graphic */}
      {bgSrc && (
        <LazyImage 
          src={bgSrc} 
          isBackground={true} 
          backgroundOpacity={0.1} 
          style={{ position: 'fixed', zIndex: -1, pointerEvents: 'none' }}
        />
      )}

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '24px' }}>
        <button className="icon-btn" onClick={onBack} style={{ background: 'rgba(255,255,255,0.1)' }}>
          <ArrowLeft size={24} />
        </button>
        <h1 style={{ margin: 0, fontSize: '24px', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {item.title} {item.year ? `(${item.year})` : ''}
        </h1>
        {!isRadarr && (
          <button className="icon-btn" onClick={() => setHistoryModalData({ itemId: item.id, isRadarr: false, isSeries: true, title: item.title })} title="Series History">
            <Clock size={20} />
          </button>
        )}
        <button className="icon-btn" onClick={() => setShowSettings(true)} title="Edit">
          <Edit2 size={20} />
        </button>
        <button className="icon-btn danger" onClick={() => setShowDeleteConfirm(true)}>
          <Trash2 size={20} />
        </button>
      </div>

      {/* Hero Section */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '24px', marginBottom: '32px' }}>
        
        {/* Top Row: Poster + Synopsis */}
        <div className="media-details-hero-top">
          {/* Poster */}
          {posterSrc ? (
            <div className="media-details-poster">
              <LazyImage src={posterSrc} alt="Poster" style={{ width: '100%', height: '100%', borderRadius: '8px' }} />
            </div>
          ) : (
            <div className="media-details-poster-placeholder">
              <ImageIcon size={48} color="#666" />
            </div>
          )}
          
          {/* Synopsis */}
          <div style={{ flex: '1 1 300px', display: 'flex', flexDirection: 'column' }}>
            <div style={{ fontSize: '15px', color: 'var(--text-secondary)', lineHeight: '1.6' }}>
              {item.overview || 'No synopsis available.'}
            </div>
          </div>
        </div>

        {/* Bottom Row: Tags */}
        <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
          <div style={{ background: 'rgba(255,255,255,0.1)', padding: '6px 12px', borderRadius: '16px', fontSize: '13px', fontWeight: '500' }}>
            {isRadarr ? 'Movie' : 'TV Show'}
          </div>
          {item.status && (
            <div style={{ background: 'rgba(255,255,255,0.1)', padding: '6px 12px', borderRadius: '16px', fontSize: '13px', fontWeight: '500' }}>
              {item.status.toLowerCase() === 'incinemas' 
                ? 'In Cinemas' 
                : item.status.toLowerCase() === 'tba'
                ? 'TBA'
                : item.status.charAt(0).toUpperCase() + item.status.slice(1)}
            </div>
          )}
          {item.network && (
            <div style={{ background: 'rgba(255,255,255,0.1)', padding: '6px 12px', borderRadius: '16px', fontSize: '13px', fontWeight: '500' }}>
              {item.network}
            </div>
          )}
          {item.certification && (
            <div style={{ background: 'rgba(255,255,255,0.1)', padding: '6px 12px', borderRadius: '16px', fontSize: '13px', fontWeight: '500' }}>
              {item.certification}
            </div>
          )}
          {item.ratings && item.ratings.value > 0 && (
            <div style={{ background: 'rgba(255,255,255,0.1)', padding: '6px 12px', borderRadius: '16px', fontSize: '13px', fontWeight: '500', display: 'flex', alignItems: 'center', gap: '4px' }}>
              <Star size={14} fill="currentColor" /> {item.ratings.value.toFixed(1)}
            </div>
          )}
          {item.genres && item.genres.length > 0 && item.genres.map(genre => (
            <div key={genre} style={{ background: 'rgba(255,255,255,0.1)', padding: '6px 12px', borderRadius: '16px', fontSize: '13px', fontWeight: '500' }}>
              {genre}
            </div>
          ))}
        </div>
      </div>

      {/* Content Section */}
      {isRadarr ? (
        (() => {
          const movieTrackingKey = `radarr-movie-${item.id}`;
          const movieIsSearching = searchStatuses[movieTrackingKey]?.isSearching;
          const movieIsSuccess = searchStatuses[movieTrackingKey]?.isSuccess;
          const qStatus = episodeQueueMap.get(item.id);
          
          let statusColor = item.hasFile ? '#34C759' : 'var(--danger)';
          if (movieIsSearching || movieIsSuccess || qStatus?.status === 'downloading') {
            statusColor = 'var(--accent-blue)';
          } else if (qStatus?.status === 'importing') {
            statusColor = '#BF5AF2';
          }
          
          return (
            <div className="modern-card" style={{ padding: '24px', display: 'flex', flexDirection: 'column', alignItems: 'stretch', gap: '16px', background: 'rgba(20,20,20,0.85)' }}>
              <h3 style={{ margin: 0, textAlign: 'left' }}>Movie Management</h3>
              <div style={{ display: 'flex', gap: '12px', alignItems: 'center', flexWrap: 'wrap' }}>
                <div style={{ flex: '1 1 auto', color: 'var(--text-secondary)', textAlign: 'left', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  <span>Status:</span>
                  <strong style={{ color: statusColor, display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                    {(() => {
                      if (movieIsSearching || movieIsSuccess) {
                        return (
                          <>
                            <Loader2 size={14} className="spinner" />
                            Searching...
                          </>
                        );
                      }
                      if (qStatus) {
                        return (
                          <>
                            <Loader2 size={14} className="spinner" />
                            {qStatus.status === 'importing' ? 'Importing' : 'Downloading'}
                            {qStatus.pct !== undefined && <span style={{ opacity: 0.7, fontWeight: '400', marginLeft: '4px' }}>({qStatus.pct}%)</span>}
                          </>
                        );
                      }
                      if (!item.hasFile) return 'Missing';
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
                      
                      if (file && file.size) {
                        const sizeGB = (file.size / (1024 * 1024 * 1024)).toFixed(1);
                        sizeStr = sizeGB >= 1 ? `${sizeGB} GB` : `${Math.round(file.size / (1024 * 1024))} MB`;
                      } else if (item.sizeOnDisk > 0) {
                        const sizeGB = (item.sizeOnDisk / (1024 * 1024 * 1024)).toFixed(1);
                        sizeStr = sizeGB >= 1 ? `${sizeGB} GB` : `${Math.round(item.sizeOnDisk / (1024 * 1024))} MB`;
                      }
                      
                      if (qualityStr && sizeStr) return `${qualityStr} (${sizeStr})`;
                      if (qualityStr) return qualityStr;
                      if (sizeStr) return sizeStr;
                      return 'Downloaded';
                    })()}
                  </strong>
                </div>
                <div style={{ display: 'flex', gap: '8px', marginLeft: 'auto' }}>
                  <button 
                    className="btn btn-secondary media-action-btn" 
                    onClick={() => setInteractiveModalData({ item, isRadarr: true, title: item.title })}
                    style={{ display: 'flex', alignItems: 'center', gap: '8px' }}
                    title="Interactive Search"
                  >
                    <List size={16} /> <span className="btn-text">Interactive Search</span>
                  </button>
                  <button 
                    className="btn btn-secondary media-action-btn" 
                    onClick={() => setHistoryModalData({ itemId: item.id, isRadarr: true, title: item.title })}
                    style={{ display: 'flex', alignItems: 'center', gap: '8px' }}
                    title="View History"
                  >
                    <Clock size={16} /> <span className="btn-text">History</span>
                  </button>
                  <button 
                    className="btn btn-secondary media-action-btn" 
                    onClick={handleToggleMonitor}
                    disabled={isTogglingMonitor}
                    style={{ display: 'flex', alignItems: 'center', gap: '8px' }}
                    title={item.monitored ? "Unmonitor" : "Monitor"}
                  >
                    {isTogglingMonitor ? <Loader2 size={16} className="spinner" /> : (item.monitored ? <Eye size={16} color="var(--accent-blue)" /> : <EyeOff size={16} />)}
                    <span className="btn-text">{item.monitored ? 'Monitored' : 'Unmonitored'}</span>
                  </button>
                  <button 
                    className={`btn ${movieIsSuccess ? 'btn-primary' : 'btn-secondary'} media-action-btn`} 
                    onClick={handleMovieSearch}
                    disabled={movieIsSearching}
                    style={{ display: 'flex', alignItems: 'center', gap: '8px', backgroundColor: movieIsSuccess ? '#34C759' : undefined }}
                    title="Auto Search"
                  >
                    {movieIsSearching ? <Loader2 size={16} className="spinner" /> : <Search size={16} />} 
                    <span className="btn-text">{movieIsSuccess ? 'Searched!' : 'Auto Search'}</span>
                  </button>
                </div>
              </div>

              {item.hasFile && item.movieFile && (
                <div style={{ marginTop: '8px', background: 'rgba(0,0,0,0.2)', padding: '16px', borderRadius: '8px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  <h4 style={{ margin: 0, fontSize: '15px', color: 'var(--text-primary)' }}>File Information</h4>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '8px 16px', marginTop: '4px' }}>
                    <div style={{ fontSize: '14px', color: 'var(--text-secondary)' }}>
                      <strong>Resolution:</strong> {item.movieFile.mediaInfo?.resolution || 'Unknown'}
                    </div>
                    <div style={{ fontSize: '14px', color: 'var(--text-secondary)' }}>
                      <strong>Video:</strong> {item.movieFile.mediaInfo?.videoCodec || 'Unknown'}
                    </div>
                    <div style={{ fontSize: '14px', color: 'var(--text-secondary)' }}>
                      <strong>Audio:</strong> {item.movieFile.mediaInfo?.audioCodec ? `${item.movieFile.mediaInfo.audioCodec} ${item.movieFile.mediaInfo.audioChannels ? `(${item.movieFile.mediaInfo.audioChannels})` : ''}` : 'Unknown'}
                    </div>
                    <div style={{ fontSize: '14px', color: 'var(--text-secondary)' }}>
                      <strong>Language:</strong> {item.movieFile.languages?.[0]?.name || item.movieFile.mediaInfo?.audioLanguages || 'Unknown'}
                    </div>
                    {item.movieFile.mediaInfo?.runTime && (
                      <div style={{ fontSize: '14px', color: 'var(--text-secondary)' }}>
                        <strong>Runtime:</strong> {item.movieFile.mediaInfo.runTime}
                      </div>
                    )}
                    {item.movieFile.releaseGroup && (
                      <div style={{ fontSize: '14px', color: 'var(--text-secondary)' }}>
                        <strong>Group:</strong> {item.movieFile.releaseGroup}
                      </div>
                    )}
                    <div style={{ fontSize: '14px', color: 'var(--text-secondary)' }}>
                      <strong>Size:</strong> {item.movieFile.size ? (item.movieFile.size / (1024 * 1024 * 1024)).toFixed(2) + ' GB' : 'Unknown'}
                    </div>
                    <div style={{ fontSize: '14px', color: 'var(--text-secondary)' }}>
                      <strong>Added:</strong> {item.movieFile.dateAdded ? new Date(item.movieFile.dateAdded).toLocaleDateString() : 'Unknown'}
                    </div>
                  </div>
                  {item.movieFile.mediaInfo?.subtitles && (
                    <div style={{ fontSize: '14px', color: 'var(--text-secondary)' }}>
                      <strong>Subtitles:</strong> <span style={{ wordBreak: 'break-word', display: 'inline-block' }}>{item.movieFile.mediaInfo.subtitles}</span>
                    </div>
                  )}
                  <div style={{ fontSize: '14px', color: 'var(--text-secondary)', marginTop: '4px' }}>
                    <strong>Path:</strong> <span style={{ wordBreak: 'break-all' }}>{item.movieFile.relativePath}</span>
                  </div>
                  
                  <div style={{ marginTop: '12px', display: 'flex', justifyContent: 'flex-end' }}>
                    <button 
                      className="btn media-action-btn" 
                      onClick={() => setShowMovieDeleteConfirm(true)}
                      style={{ background: 'var(--danger)', color: '#fff', border: 'none', padding: '8px', borderRadius: '8px' }}
                      title="Delete File"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>
              )}
            </div>
          );
        })()
      ) : (
        <SeasonList 
          item={item}
          episodeQueueMap={episodeQueueMap}
          setLocalItem={setLocalItem}
          setInteractiveModalData={setInteractiveModalData}
          setHistoryModalData={setHistoryModalData}
          setUnmonitorTarget={setUnmonitorTarget}
        />
      )}

      {/* Unmonitor Confirmation Modal */}
      <ConfirmModal 
        isOpen={!!unmonitorTarget}
        onClose={() => setUnmonitorTarget(null)}
        onConfirm={() => unmonitorTarget?.action()}
        title="Confirm Unmonitor"
        message={
          <>
            Are you sure you want to unmonitor <strong>{unmonitorTarget?.title}</strong>?
            <br /><br />
            It will no longer be searched for and will be removed from your Missing list.
          </>
        }
        confirmText="Unmonitor"
        isDanger={true}
        isProcessing={isTogglingMonitor}
      />

      {/* Settings Modal */} 

      <EditMediaSettingsModal 
        isOpen={showSettings} 
        onClose={() => setShowSettings(false)} 
        item={localItem} 
        isRadarr={isRadarr} 
        onSaveSuccess={(result) => { setLocalItem(result); setShowSettings(false); }} 
      />

      {/* Delete Confirmation Modal */}
      <ConfirmModal 
        isOpen={showDeleteConfirm}
        onClose={() => setShowDeleteConfirm(false)}
        onConfirm={handleDelete}
        title="Confirm Deletion"
        message={
          <>
            Are you sure you want to delete <strong>{item.title}</strong> from your library?
            <br /><br />
            This will also permanently delete all associated files from your disk. This action cannot be undone.
          </>
        }
        confirmText="Delete Media"
        isProcessing={isDeleting}
      />

      
      {/* Movie File Delete Confirmation */}
      <ConfirmModal 
        isOpen={showMovieDeleteConfirm}
        onClose={() => setShowMovieDeleteConfirm(false)}
        onConfirm={async () => {
          setIsDeletingMovieFile(true);
          try {
            await deleteMovieFile(item.movieFile.id);
            setLocalItem(prev => ({ ...prev, hasFile: false, movieFile: undefined }));
            setShowMovieDeleteConfirm(false);
          } catch (e) {
            alert('Failed to delete movie file.');
          } finally {
            setIsDeletingMovieFile(false);
          }
        }}
        title="Delete Movie File"
        message={
          <>
            Are you sure you want to delete the file for <strong>{item.title}</strong>?
            <br /><br />
            This will permanently delete the file from your disk.
          </>
        }
        confirmText="Delete File"
        isProcessing={isDeletingMovieFile}
      />

      {/* Interactive Search Modal */}
      {interactiveModalData && (
        <InteractiveSearchModal
          isOpen={true}
          onClose={() => setInteractiveModalData(null)}
          item={interactiveModalData.item}
          isRadarr={interactiveModalData.isRadarr}
          modalTitleDisplay={interactiveModalData.title}
          onSearchSuccess={() => {
            // Optional local visual state change
          }}
        />
      )}

      {/* History Modal */}
      {historyModalData && (
        <HistoryModal
          isOpen={true}
          onClose={() => setHistoryModalData(null)}
          itemId={historyModalData.itemId}
          isRadarr={historyModalData.isRadarr}
          isSeries={historyModalData.isSeries}
          seasonNumber={historyModalData.seasonNumber}
          title={historyModalData.title}
        />
      )}
    </div>
  );
};

export default MediaDetails;
