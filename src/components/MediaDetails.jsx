import React, { useState, useEffect } from 'react';
import { ArrowLeft, Trash2, Search, Loader2, Image as ImageIcon, AlertCircle, CheckCircle2, DownloadCloud, Clock, List, Edit2, Eye, EyeOff, X, ChevronDown, ChevronRight, Star } from 'lucide-react';
import { getEpisodes, searchEpisode, searchSeason, updateSeries, getSeriesQualityProfiles, getQueue } from '../sonarrApi';
import { searchMovie, updateMovie, getMovieQualityProfiles, getMovieQueue } from '../radarrApi';
import { useCommand } from '../CommandContext';
import InteractiveSearchModal from './InteractiveSearchModal';
import HistoryModal from './HistoryModal';
import LazyImage from './LazyImage';

const MediaDetails = ({ item: initialItem, isRadarr, onBack, onDelete }) => {
  const [localItem, setLocalItem] = useState(initialItem);
  const item = localItem;
  const [episodes, setEpisodes] = useState([]);
  const [isLoadingEpisodes, setIsLoadingEpisodes] = useState(!isRadarr);
  const [isDeleting, setIsDeleting] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  // Settings Modal State
  const [showSettings, setShowSettings] = useState(false);
  const [qualityProfiles, setQualityProfiles] = useState([]);
  const [selectedQualityProfile, setSelectedQualityProfile] = useState(initialItem.qualityProfileId);
  const [selectedSeriesType, setSelectedSeriesType] = useState(initialItem.seriesType || 'standard');
  const [selectedMonitored, setSelectedMonitored] = useState(initialItem.monitored !== undefined ? initialItem.monitored : true);
  const [selectedSeasonFolder, setSelectedSeasonFolder] = useState(initialItem.seasonFolder !== undefined ? initialItem.seasonFolder : true);
  const [isSavingSettings, setIsSavingSettings] = useState(false);

  const { searchStatuses, trackCommand } = useCommand();
  
  // Interactive search state per episode
  const [interactiveModalData, setInteractiveModalData] = useState(null); // { item, isRadarr, title }

  // History state
  const [historyModalData, setHistoryModalData] = useState(null); // { itemId, isRadarr, title }

  // Collapsed seasons state
  const [collapsedSeasons, setCollapsedSeasons] = useState({});
  const toggleSeasonCollapse = (seasonNum) => {
    setCollapsedSeasons(prev => ({ ...prev, [seasonNum]: !prev[seasonNum] }));
  };

  // Episode queue status map: episodeId -> 'downloading' | 'importing'
  const [episodeQueueMap, setEpisodeQueueMap] = useState(new Map());

  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

  useEffect(() => {
    if (showSettings && qualityProfiles.length === 0) {
      const fetchProfiles = async () => {
        try {
          const profiles = isRadarr ? await getMovieQualityProfiles() : await getSeriesQualityProfiles();
          setQualityProfiles(profiles);
        } catch (e) {
          console.error("Failed to load profiles", e);
        }
      };
      fetchProfiles();
    }
  }, [showSettings, isRadarr, qualityProfiles.length]);

  const handleSaveSettings = async () => {
    setIsSavingSettings(true);
    try {
      const updatedData = { ...item, qualityProfileId: Number(selectedQualityProfile) };
      if (!isRadarr) {
        updatedData.seriesType = selectedSeriesType;
        updatedData.monitored = selectedMonitored;
        updatedData.seasonFolder = selectedSeasonFolder;
      }
      const result = isRadarr ? await updateMovie(updatedData) : await updateSeries(updatedData);
      setLocalItem(result);
      setShowSettings(false);
    } catch (e) {
      console.error("Failed to update media settings", e);
      alert("Failed to update settings. " + e.message);
    } finally {
      setIsSavingSettings(false);
    }
  };

  const handleToggleSeasonMonitor = async (seasonNum) => {
    try {
      const updatedData = { ...item };
      const seasonIndex = updatedData.seasons.findIndex(s => s.seasonNumber === seasonNum);
      if (seasonIndex !== -1) {
        updatedData.seasons[seasonIndex].monitored = !updatedData.seasons[seasonIndex].monitored;
        const result = await updateSeries(updatedData);
        setLocalItem(result);
      }
    } catch (e) {
      console.error("Failed to toggle season monitor", e);
      alert("Failed to toggle season monitor. " + e.message);
    }
  };

  useEffect(() => {
    if (!isRadarr) {
      const fetchEpisodes = async () => {
        try {
          const [data, queueData] = await Promise.all([
            getEpisodes(item.id),
            getQueue().catch(() => [])
          ]);
          setEpisodes(data || []);

          // Build episode queue map
          const qMap = new Map();
          const epIds = new Set((data || []).map(e => e.id));
          (queueData || []).forEach(q => {
            if (epIds.has(q.episodeId) || q.seriesId === item.id) {
              const status = q.status === 'completed' ? 'importing' : 'downloading';
              const pct = q.size > 0 ? Math.round(((q.size - q.sizeleft) / q.size) * 100) : 0;
              qMap.set(q.episodeId, { status, pct });
            }
          });
          setEpisodeQueueMap(qMap);
          
          if (data && data.length > 0) {
            const seasonNums = [...new Set(data.map(ep => ep.seasonNumber))].sort((a, b) => b - a);
            const initialCollapsed = {};
            seasonNums.forEach(sNum => {
              if (seasonNums.length > 1) {
                initialCollapsed[sNum] = true;
              }
            });
            setCollapsedSeasons(initialCollapsed);
          }
        } catch (e) {
          console.error("Failed to load episodes", e);
        } finally {
          setIsLoadingEpisodes(false);
        }
      };
      fetchEpisodes();
    } else {
      // For Radarr, just fetch the queue
      const fetchMovieQueue = async () => {
        try {
          const queueData = await getMovieQueue().catch(() => []);
          const qMap = new Map();
          const matchedQ = queueData.find(q => q.movieId === item.id);
          if (matchedQ) {
            const status = matchedQ.status === 'completed' ? 'importing' : 'downloading';
            const pct = matchedQ.size > 0 ? Math.round(((matchedQ.size - matchedQ.sizeleft) / matchedQ.size) * 100) : 0;
            qMap.set(item.id, { status, pct });
          }
          setEpisodeQueueMap(qMap);
        } catch (e) {
          console.error("Failed to load movie queue", e);
        }
      };
      fetchMovieQueue();
    }
  }, [item.id, isRadarr]);

  const handleDelete = async () => {
    setIsDeleting(true);
    await onDelete(item.id, isRadarr);
    setIsDeleting(false);
  };

  const fetchQueue = async () => {
    try {
      if (isRadarr) {
        const queueData = await getMovieQueue().catch(() => []);
        const qMap = new Map();
        const matchedQ = queueData.find(q => q.movieId === item.id);
        if (matchedQ) {
          const status = matchedQ.status === 'completed' ? 'importing' : 'downloading';
          const pct = matchedQ.size > 0 ? Math.round(((matchedQ.size - matchedQ.sizeleft) / matchedQ.size) * 100) : 0;
          qMap.set(item.id, { status, pct });
        }
        setEpisodeQueueMap(qMap);
      } else {
        const queueData = await getQueue().catch(() => []);
        const qMap = new Map();
        
        // Only track queue items that belong to the current episodes loaded on this page
        const currentEpisodeIds = new Set(episodes.map(e => e.id));
        
        (queueData || []).forEach(q => {
          if (currentEpisodeIds.has(q.episodeId) || q.seriesId === item.id) {
            const status = q.status === 'completed' ? 'importing' : 'downloading';
            const pct = q.size > 0 ? Math.round(((q.size - q.sizeleft) / q.size) * 100) : 0;
            qMap.set(q.episodeId, { status, pct });
          }
        });
        setEpisodeQueueMap(qMap);
      }
    } catch (err) {
      console.error("Failed to fetch queue", err);
    }
  };

  useEffect(() => {
    // Check if any relevant search just succeeded (stays true for 5 seconds in context)
    const hasRecentSuccess = Object.keys(searchStatuses).some(k => {
      if (isRadarr) return k.includes(`radarr-movie-${item.id}`) && searchStatuses[k]?.isSuccess;
      return k.includes(`sonarr-`) && searchStatuses[k]?.isSuccess;
    });
    
    const hasActiveDownloads = episodeQueueMap.size > 0;

    // Immediately fetch if a search just succeeded
    if (hasRecentSuccess) {
      fetchQueue();
    }

    // Only set up the 5s polling interval if there are active downloads, or if we're in the 5s success window
    if (!hasActiveDownloads && !hasRecentSuccess) return;

    const interval = setInterval(() => {
      fetchQueue();
    }, 5000);
    return () => clearInterval(interval);
  }, [isRadarr, item.id, episodeQueueMap.size, searchStatuses]);

  const handleEpisodeSearch = async (episodeId) => {
    const trackingKey = `sonarr-episode-${episodeId}`;
    if (searchStatuses[trackingKey]?.isSearching || searchStatuses[trackingKey]?.isSuccess) return;
    
    try {
      const commandId = await searchEpisode(episodeId);
      if (commandId) {
        const ep = episodes.find(e => e.id === episodeId);
        const epStr = ep ? `S${String(ep.seasonNumber).padStart(2, '0')}E${String(ep.episodeNumber).padStart(2, '0')} - ${ep.title}` : '';
        trackCommand(trackingKey, commandId, false, `${item.title} ${epStr}`);
      }
    } catch (e) {
      console.error("Failed to search episode", e);
    }
  };

  const handleMovieSearch = async () => {
    const trackingKey = `radarr-movie-${item.id}`;
    if (searchStatuses[trackingKey]?.isSearching || searchStatuses[trackingKey]?.isSuccess) return;
    
    try {
      const commandId = await searchMovie(item.id);
      if (commandId) {
        trackCommand(trackingKey, commandId, true, item.title);
      }
    } catch (e) {
      console.error("Failed to search movie", e);
    }
  };

  const handleSeasonSearch = async (seasonNum) => {
    const trackingKey = `sonarr-season-${item.id}-${seasonNum}`;
    if (searchStatuses[trackingKey]?.isSearching || searchStatuses[trackingKey]?.isSuccess) return;
    
    try {
      const commandId = await searchSeason(item.id, seasonNum);
      if (commandId) {
        trackCommand(trackingKey, commandId, false, `${item.title} Season ${seasonNum}`);
      }
    } catch (e) {
      console.error("Failed to search season", e);
    }
  };

  const handleSeasonInteractiveSearch = (seasonNum) => {
    setInteractiveModalData({ 
      item: { isSeason: true, seriesId: item.id, seasonNumber: seasonNum }, 
      isRadarr: false, 
      title: `${item.title} - ${seasonNum === 0 ? 'Specials' : `Season ${seasonNum}`}` 
    });
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
            </div>
          );
        })()
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
          {isLoadingEpisodes ? (
            <div style={{ display: 'flex', justifyContent: 'center', padding: '40px' }}><Loader2 size={32} className="spinner" color="var(--accent-blue)" /></div>
          ) : (
            sortedSeasons.map(seasonNum => {
              const seasonObj = item.seasons?.find(s => s.seasonNumber === seasonNum);
              const isMonitored = seasonObj ? seasonObj.monitored : false;
              
              const seasonEps = seasons[seasonNum] || [];
              const totalEps = seasonEps.length;
              const downloadedEps = seasonEps.filter(ep => ep.hasFile).length;
              const missingEps = seasonEps.filter(ep => {
                const now = new Date();
                const isUnaired = ep.airDateUtc ? new Date(ep.airDateUtc) > now : false;
                return !ep.hasFile && !isUnaired;
              }).length;
              const unairedEps = seasonEps.filter(ep => {
                const now = new Date();
                const isUnaired = ep.airDateUtc ? new Date(ep.airDateUtc) > now : false;
                return !ep.hasFile && isUnaired;
              }).length;

              const downloadingEps = seasonEps.filter(ep => episodeQueueMap.get(ep.id)?.status === 'downloading').length;
              const importingEps = seasonEps.filter(ep => episodeQueueMap.get(ep.id)?.status === 'importing').length;
              const anyActive = downloadingEps > 0 || importingEps > 0;

              let seasonStatusText = '';
              let seasonStatusColor = 'var(--text-secondary)';
              if (missingEps > 0) {
                seasonStatusText = `${missingEps} Missing`;
                seasonStatusColor = 'var(--danger)';
              } else if (downloadedEps === totalEps && totalEps > 0) {
                seasonStatusText = 'All Downloaded';
                seasonStatusColor = '#34C759';
              } else if (downloadedEps > 0) {
                seasonStatusText = `${downloadedEps}/${totalEps} Downloaded`;
                seasonStatusColor = '#34C759';
              } else if (unairedEps > 0) {
                seasonStatusText = 'Unaired';
              }
              
              const seasonTrackingKey = `sonarr-season-${item.id}-${seasonNum}`;
              const seasonIsSearching = searchStatuses[seasonTrackingKey]?.isSearching;
              const seasonIsSuccess = searchStatuses[seasonTrackingKey]?.isSuccess;
              
              return (
              <div key={seasonNum} className="modern-card" style={{ padding: '0', overflow: 'hidden', display: 'flex', flexDirection: 'column', alignItems: 'stretch', gap: 0, background: 'rgba(20,20,20,0.85)' }}>
                <div 
                  onClick={() => toggleSeasonCollapse(seasonNum)}
                  style={{ padding: '16px 20px', background: 'rgba(255,255,255,0.05)', borderBottom: collapsedSeasons[seasonNum] ? 'none' : '1px solid rgba(255,255,255,0.05)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer' }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    {collapsedSeasons[seasonNum] ? <ChevronRight size={20} /> : <ChevronDown size={20} />}
                    <div style={{ display: 'flex', flexDirection: 'column' }}>
                      <span style={{ fontWeight: '600', fontSize: '18px' }}>
                        {seasonNum === 0 ? 'Specials' : `Season ${seasonNum}`}
                      </span>
                      {seasonStatusText && (
                        <span style={{ fontSize: '12px', fontWeight: '500', color: seasonStatusColor, marginTop: '2px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                          {anyActive && <Loader2 size={12} className="spinner" color={importingEps > 0 ? '#BF5AF2' : 'var(--accent-blue)'} />}
                          {seasonStatusText}
                        </span>
                      )}
                    </div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <button 
                      className="icon-btn" 
                      onClick={(e) => { e.stopPropagation(); setHistoryModalData({ itemId: item.id, isRadarr: false, isSeries: true, seasonNumber: seasonNum, title: `${item.title} - ${seasonNum === 0 ? 'Specials' : 'Season ' + seasonNum}` }); }} 
                      title="Season History"
                      style={{ background: 'transparent' }}
                    >
                      <Clock size={18} />
                    </button>
                    <button 
                      className="icon-btn" 
                      onClick={(e) => { e.stopPropagation(); handleSeasonInteractiveSearch(seasonNum); }} 
                      title="Interactive Season Search"
                      style={{ background: 'transparent' }}
                    >
                      <List size={18} />
                    </button>
                    <button 
                      className={`icon-btn ${seasonIsSuccess ? 'primary' : ''}`} 
                      onClick={(e) => { e.stopPropagation(); handleSeasonSearch(seasonNum); }} 
                      title="Auto Season Search"
                      disabled={seasonIsSearching}
                      style={{ background: 'transparent' }}
                    >
                      {seasonIsSearching ? <Loader2 size={18} className="spinner" /> : <Search size={18} fill={seasonIsSuccess ? 'currentColor' : 'none'} />}
                    </button>
                    <button 
                      className="icon-btn" 
                      onClick={(e) => { e.stopPropagation(); handleToggleSeasonMonitor(seasonNum); }}
                      title={isMonitored ? "Unmonitor Season" : "Monitor Season"}
                      style={{ background: 'transparent' }}
                    >
                      {isMonitored ? <Eye size={18} color="var(--accent-blue)" /> : <EyeOff size={18} color="var(--text-secondary)" />}
                    </button>
                  </div>
                </div>
                <div style={{ 
                  display: 'grid', 
                  gridTemplateRows: collapsedSeasons[seasonNum] ? '0fr' : '1fr', 
                  transition: 'grid-template-rows 0.3s ease-in-out' 
                }}>
                  <div style={{ overflow: 'hidden', minHeight: 0 }}>
                    <div style={{ display: 'flex', flexDirection: 'column' }}>
                      {seasons[seasonNum].sort((a, b) => b.episodeNumber - a.episodeNumber).map((ep, idx, arr) => {
                        const now = new Date();
                        const isUnaired = ep.airDateUtc ? new Date(ep.airDateUtc) > now : false;
                        
                        const epTrackingKey = `sonarr-episode-${ep.id}`;
                        const epIsSearching = searchStatuses[epTrackingKey]?.isSearching;
                        const epIsSuccess = searchStatuses[epTrackingKey]?.isSuccess;
                        
                        let statusBadge = 'Missing';
                        let statusColor = 'var(--danger)';
                        let spinnerColor = 'var(--accent-blue)';
                        
                        if (epIsSearching || epIsSuccess) {
                          statusBadge = 'Searching...';
                          statusColor = 'var(--accent-blue)';
                        } else if (ep.hasFile) {
                          let qualityStr = '';
                          let sizeStr = '';
                          const file = ep.episodeFile;
                          const qualityObj = ep.quality || (file && file.quality);
                          
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
                          }
                          
                          if (qualityStr && sizeStr) statusBadge = `${qualityStr} (${sizeStr})`;
                          else if (qualityStr) statusBadge = qualityStr;
                          else if (sizeStr) statusBadge = sizeStr;
                          else statusBadge = 'Downloaded';
                          
                          statusColor = '#34C759';
                        } else if (isUnaired) {
                          statusBadge = 'Unaired';
                          statusColor = 'var(--text-secondary)';
                        } else if (episodeQueueMap.get(ep.id)?.status === 'importing') {
                          statusBadge = 'Importing';
                          statusColor = '#BF5AF2';
                        } else if (episodeQueueMap.get(ep.id)?.status === 'downloading') {
                          statusBadge = 'Downloading';
                          statusColor = 'var(--accent-blue)';
                          spinnerColor = 'var(--accent-blue)';
                        }
                        
                        const isLast = idx === arr.length - 1;
                        
                        return (
                          <div key={ep.id} style={{ display: 'flex', alignItems: 'center', gap: '16px', padding: '16px 20px', borderBottom: isLast ? 'none' : '1px solid rgba(255,255,255,0.05)' }}>
                            <div style={{ width: '32px', color: 'var(--text-secondary)', fontWeight: '600', fontSize: '15px' }}>
                              {ep.episodeNumber}
                            </div>
                            <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column' }}>
                              <div style={{ fontWeight: '500', fontSize: '15px', color: 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                {ep.title}
                              </div>
                              {ep.airDateUtc && (
                                <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '2px', marginBottom: '4px' }}>
                                  {new Date(ep.airDateUtc).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })}
                                </div>
                              )}
                              {statusBadge && (
                                <div style={{ fontSize: '10px', color: statusColor, display: 'flex', alignItems: 'center', gap: '4px', fontWeight: '500', marginTop: ep.airDateUtc ? '0' : '4px' }}>
                                  {statusBadge === 'Missing' && <AlertCircle size={14} />}
                                  {(ep.hasFile || statusBadge === 'Downloaded') && <CheckCircle2 size={14} />}
                                  {statusBadge === 'Unaired' && <Clock size={14} />}
                                  {(statusBadge === 'Downloading' || statusBadge === 'Importing' || statusBadge === 'Searching...') && <Loader2 size={14} className="spinner" />}
                                  {statusBadge}
                                  {statusBadge === 'Downloading' && episodeQueueMap.get(ep.id)?.pct !== undefined && (
                                    <span style={{ opacity: 0.7, fontWeight: '400' }}>({episodeQueueMap.get(ep.id).pct}%)</span>
                                  )}
                                </div>
                              )}
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                              <button 
                                className="icon-btn" 
                                onClick={() => setHistoryModalData({ itemId: ep.id, isRadarr: false, title: `${item.title} - S${String(seasonNum).padStart(2, '0')}E${String(ep.episodeNumber).padStart(2, '0')}` })} 
                                title="Episode History"
                              >
                                <Clock size={16} />
                              </button>
                              <button 
                                className={`icon-btn ${epIsSuccess ? 'primary' : ''}`} 
                                onClick={() => handleEpisodeSearch(ep.id)} 
                                title="Auto Search"
                                disabled={isUnaired || epIsSearching}
                                style={{ opacity: isUnaired ? 0.3 : 1 }}
                              >
                                {epIsSearching ? <Loader2 size={16} className="spinner" /> : <Search size={16} fill={epIsSuccess ? 'currentColor' : 'none'} />}
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              </div>
              );})
          )}
        </div>
      )}

      {/* Settings Modal */}
      {showSettings && (
        <div className="modal-overlay" onClick={() => setShowSettings(false)}>
          <div className="modal-content" onClick={e => e.stopPropagation()} style={{ maxWidth: '400px', width: '90%' }}>
            <div className="modal-header">
              <h2>Edit Media</h2>
              <button className="icon-btn" onClick={() => setShowSettings(false)}>
                <X size={20} />
              </button>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div>
                <label style={{ display: 'block', marginBottom: '8px', fontWeight: '500', color: 'var(--text-secondary)' }}>
                  Quality Profile
                </label>
                {qualityProfiles.length === 0 ? (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--text-secondary)' }}>
                    <Loader2 size={16} className="spinner" /> Loading profiles...
                  </div>
                ) : (
                  <select 
                    className="form-input" 
                    value={selectedQualityProfile}
                    onChange={(e) => setSelectedQualityProfile(e.target.value)}
                    style={{ width: '100%', padding: '12px', background: '#222', color: '#fff', border: '1px solid #333', borderRadius: '8px', fontSize: '15px', cursor: 'pointer' }}
                  >
                    {qualityProfiles.map(p => (
                      <option key={p.id} value={p.id}>{p.name}</option>
                    ))}
                  </select>
                )}
              </div>

              {!isRadarr && (
                <>
                  <div>
                    <label style={{ display: 'block', marginBottom: '8px', fontWeight: '500', color: 'var(--text-secondary)' }}>
                      Series Type
                    </label>
                    <select 
                      className="form-input" 
                      value={selectedSeriesType} 
                      onChange={(e) => setSelectedSeriesType(e.target.value)}
                      style={{ width: '100%', padding: '12px', background: '#222', color: '#fff', border: '1px solid #333', borderRadius: '8px', fontSize: '15px', cursor: 'pointer' }}
                    >
                      <option value="standard">Standard</option>
                      <option value="daily">Daily</option>
                      <option value="anime">Anime</option>
                    </select>
                  </div>
                  
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginTop: '4px' }}>
                    <input 
                      type="checkbox" 
                      id="edit-monitored"
                      checked={selectedMonitored} 
                      onChange={(e) => setSelectedMonitored(e.target.checked)}
                      style={{ width: '18px', height: '18px', cursor: 'pointer', accentColor: 'var(--accent-blue)' }}
                    />
                    <label htmlFor="edit-monitored" style={{ cursor: 'pointer', fontWeight: '500' }}>
                      Monitored
                    </label>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginTop: '4px' }}>
                    <input 
                      type="checkbox" 
                      id="edit-season-folder"
                      checked={selectedSeasonFolder} 
                      onChange={(e) => setSelectedSeasonFolder(e.target.checked)}
                      style={{ width: '18px', height: '18px', cursor: 'pointer', accentColor: 'var(--accent-blue)' }}
                    />
                    <label htmlFor="edit-season-folder" style={{ cursor: 'pointer', fontWeight: '500' }}>
                      Use Season Folders
                    </label>
                  </div>
                </>
              )}
              
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '8px' }}>
                <button className="btn btn-secondary" onClick={() => setShowSettings(false)}>Cancel</button>
                <button 
                  className="btn btn-primary" 
                  onClick={handleSaveSettings}
                  disabled={isSavingSettings || qualityProfiles.length === 0}
                  style={{ display: 'flex', alignItems: 'center', gap: '8px' }}
                >
                  {isSavingSettings && <Loader2 size={16} className="spinner" />}
                  Save Changes
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {showDeleteConfirm && (
        <div className="modal-overlay" onClick={() => setShowDeleteConfirm(false)}>
          <div className="modal-content" onClick={e => e.stopPropagation()} style={{ maxWidth: '400px' }}>
            <div className="modal-header">
              <h2>Confirm Deletion</h2>
            </div>
            <div className="modal-body" style={{ color: 'var(--text-secondary)', lineHeight: '1.5', marginBottom: '24px' }}>
              Are you sure you want to delete <strong>{item.title}</strong> from your library?
              <br /><br />
              This will also permanently delete all associated files from your disk. This action cannot be undone.
            </div>
            <div className="modal-actions" style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
              <button className="btn btn-secondary" onClick={() => setShowDeleteConfirm(false)} disabled={isDeleting}>
                Cancel
              </button>
              <button className="btn btn-danger" onClick={handleDelete} disabled={isDeleting} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                {isDeleting && <Loader2 size={16} className="spinner" />}
                Delete Media
              </button>
            </div>
          </div>
        </div>
      )}

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
