import React, { useState, useEffect } from 'react';
import { ArrowLeft, Trash2, Search, Loader2, Image as ImageIcon, AlertCircle, CheckCircle2, DownloadCloud, Clock, List, Settings, Eye, EyeOff, X, ChevronDown, ChevronRight } from 'lucide-react';
import { getEpisodes, searchEpisode, searchSeason, updateSeries, getSeriesQualityProfiles } from '../sonarrApi';
import { searchMovie, updateMovie, getMovieQualityProfiles } from '../radarrApi';
import InteractiveSearchModal from './InteractiveSearchModal';
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
  const [isSavingSettings, setIsSavingSettings] = useState(false);

  // Search state per episode
  const [searchingIds, setSearchingIds] = useState({});
  const [searchSuccessIds, setSearchSuccessIds] = useState({});
  
  const [seasonSearchingIds, setSeasonSearchingIds] = useState({});
  const [seasonSearchSuccessIds, setSeasonSearchSuccessIds] = useState({});
  
  // Interactive search state per episode
  const [interactiveModalData, setInteractiveModalData] = useState(null); // { item, isRadarr, title }

  // Collapsed seasons state
  const [collapsedSeasons, setCollapsedSeasons] = useState({});
  const toggleSeasonCollapse = (seasonNum) => {
    setCollapsedSeasons(prev => ({ ...prev, [seasonNum]: !prev[seasonNum] }));
  };

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
          const data = await getEpisodes(item.id);
          setEpisodes(data || []);
          
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
    }
  }, [item.id, isRadarr]);

  const handleDelete = async () => {
    setIsDeleting(true);
    await onDelete(item.id, isRadarr);
    setIsDeleting(false);
  };

  const handleEpisodeSearch = async (episodeId) => {
    if (searchingIds[episodeId] || searchSuccessIds[episodeId]) return;
    
    setSearchingIds(prev => ({ ...prev, [episodeId]: true }));
    try {
      const success = await searchEpisode(episodeId);
      if (success) {
        setSearchSuccessIds(prev => ({ ...prev, [episodeId]: true }));
        setTimeout(() => {
          setSearchSuccessIds(prev => ({ ...prev, [episodeId]: false }));
        }, 5000);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setSearchingIds(prev => ({ ...prev, [episodeId]: false }));
    }
  };

  const handleMovieSearch = async () => {
    if (searchingIds[item.id] || searchSuccessIds[item.id]) return;
    
    setSearchingIds(prev => ({ ...prev, [item.id]: true }));
    try {
      const success = await searchMovie(item.id);
      if (success) {
        setSearchSuccessIds(prev => ({ ...prev, [item.id]: true }));
        setTimeout(() => {
          setSearchSuccessIds(prev => ({ ...prev, [item.id]: false }));
        }, 5000);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setSearchingIds(prev => ({ ...prev, [item.id]: false }));
    }
  };

  const handleSeasonSearch = async (seasonNum) => {
    if (seasonSearchingIds[seasonNum] || seasonSearchSuccessIds[seasonNum]) return;
    
    setSeasonSearchingIds(prev => ({ ...prev, [seasonNum]: true }));
    try {
      const success = await searchSeason(item.id, seasonNum);
      if (success) {
        setSeasonSearchSuccessIds(prev => ({ ...prev, [seasonNum]: true }));
        setTimeout(() => {
          setSeasonSearchSuccessIds(prev => ({ ...prev, [seasonNum]: false }));
        }, 5000);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setSeasonSearchingIds(prev => ({ ...prev, [seasonNum]: false }));
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
        <button className="icon-btn" onClick={() => setShowSettings(true)}>
          <Settings size={20} />
        </button>
        <button className="icon-btn danger" onClick={() => setShowDeleteConfirm(true)}>
          <Trash2 size={20} />
        </button>
      </div>

      {/* Hero Section */}
      <div style={{ display: 'flex', gap: '24px', marginBottom: '32px', flexWrap: 'wrap' }}>
        {posterSrc ? (
          <div style={{ width: '150px', height: '225px', flexShrink: 0, borderRadius: '8px', boxShadow: '0 8px 16px rgba(0,0,0,0.5)', overflow: 'hidden' }}>
            <LazyImage src={posterSrc} alt="Poster" style={{ width: '100%', height: '100%', borderRadius: '8px' }} />
          </div>
        ) : (
          <div style={{ width: '150px', height: '225px', background: '#333', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <ImageIcon size={48} color="#666" />
          </div>
        )}
        <div style={{ flex: '1 1 300px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div style={{ fontSize: '15px', color: 'var(--text-secondary)', lineHeight: '1.6' }}>
            {item.overview || 'No synopsis available.'}
          </div>
          
          <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', marginTop: 'auto' }}>
            <div style={{ background: 'rgba(255,255,255,0.1)', padding: '6px 12px', borderRadius: '16px', fontSize: '13px', fontWeight: '500' }}>
              {isRadarr ? 'Movie' : 'TV Show'}
            </div>
            {item.status && (
              <div style={{ background: 'rgba(255,255,255,0.1)', padding: '6px 12px', borderRadius: '16px', fontSize: '13px', fontWeight: '500' }}>
                {item.status}
              </div>
            )}
            {item.network && (
              <div style={{ background: 'rgba(255,255,255,0.1)', padding: '6px 12px', borderRadius: '16px', fontSize: '13px', fontWeight: '500' }}>
                {item.network}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Content Section */}
      {isRadarr ? (
        <div className="modern-card" style={{ padding: '24px', display: 'flex', flexDirection: 'column', alignItems: 'stretch', gap: '16px' }}>
          <h3 style={{ margin: 0, textAlign: 'left' }}>Movie Management</h3>
          <div style={{ display: 'flex', gap: '12px', alignItems: 'center', flexWrap: 'wrap' }}>
            <div style={{ flex: '1 1 auto', color: 'var(--text-secondary)', textAlign: 'left' }}>
              Status: <strong style={{ color: item.hasFile ? '#34C759' : 'var(--danger)' }}>{item.hasFile ? 'Downloaded' : 'Missing'}</strong>
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
                className={`btn ${searchSuccessIds[item.id] ? 'btn-primary' : 'btn-secondary'} media-action-btn`} 
                onClick={handleMovieSearch}
                disabled={searchingIds[item.id]}
                style={{ display: 'flex', alignItems: 'center', gap: '8px', backgroundColor: searchSuccessIds[item.id] ? '#34C759' : undefined }}
                title="Auto Search"
              >
                {searchingIds[item.id] ? <Loader2 size={16} className="spinner" /> : <Search size={16} />} 
                <span className="btn-text">{searchSuccessIds[item.id] ? 'Searched!' : 'Auto Search'}</span>
              </button>
            </div>
          </div>
        </div>
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
              
              return (
              <div key={seasonNum} className="modern-card" style={{ padding: '0', overflow: 'hidden', display: 'flex', flexDirection: 'column', alignItems: 'stretch', gap: 0 }}>
                <div 
                  onClick={() => toggleSeasonCollapse(seasonNum)}
                  style={{ padding: '16px 20px', background: 'rgba(255,255,255,0.03)', borderBottom: collapsedSeasons[seasonNum] ? 'none' : '1px solid rgba(255,255,255,0.05)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer' }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    {collapsedSeasons[seasonNum] ? <ChevronRight size={20} /> : <ChevronDown size={20} />}
                    <div style={{ display: 'flex', flexDirection: 'column' }}>
                      <span style={{ fontWeight: '600', fontSize: '18px' }}>
                        {seasonNum === 0 ? 'Specials' : `Season ${seasonNum}`}
                      </span>
                      {seasonStatusText && (
                        <span style={{ fontSize: '12px', fontWeight: '500', color: seasonStatusColor, marginTop: '2px' }}>
                          {seasonStatusText}
                        </span>
                      )}
                    </div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <button 
                      className="icon-btn" 
                      onClick={(e) => { e.stopPropagation(); handleSeasonInteractiveSearch(seasonNum); }} 
                      title="Interactive Season Search"
                      style={{ background: 'transparent' }}
                    >
                      <List size={18} />
                    </button>
                    <button 
                      className={`icon-btn ${seasonSearchSuccessIds[seasonNum] ? 'primary' : ''}`} 
                      onClick={(e) => { e.stopPropagation(); handleSeasonSearch(seasonNum); }} 
                      title="Auto Season Search"
                      disabled={seasonSearchingIds[seasonNum]}
                      style={{ background: 'transparent' }}
                    >
                      {seasonSearchingIds[seasonNum] ? <Loader2 size={18} className="spinner" /> : <Search size={18} fill={seasonSearchSuccessIds[seasonNum] ? 'currentColor' : 'none'} />}
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
                        
                        let statusBadge = 'Missing';
                        let statusColor = 'var(--danger)';
                        if (ep.hasFile) {
                          statusBadge = 'Downloaded';
                          statusColor = '#34C759';
                        } else if (isUnaired) {
                          statusBadge = 'Unaired';
                          statusColor = 'var(--text-secondary)';
                        }
                        
                        const isLast = idx === arr.length - 1;
                        
                        return (
                          <div key={ep.id} style={{ display: 'flex', alignItems: 'center', gap: '16px', padding: '16px 20px', borderBottom: isLast ? 'none' : '1px solid rgba(255,255,255,0.05)' }}>
                            <div style={{ width: '32px', color: 'var(--text-secondary)', fontWeight: '600', fontSize: '15px' }}>
                              {ep.episodeNumber}
                            </div>
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <div style={{ fontWeight: '500', fontSize: '15px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                {ep.title}
                              </div>
                              {ep.airDateUtc && (
                                <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '2px', marginBottom: '4px' }}>
                                  {new Date(ep.airDateUtc).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })}
                                </div>
                              )}
                              <div style={{ fontSize: '13px', color: statusColor, display: 'flex', alignItems: 'center', gap: '4px', fontWeight: '500', marginTop: ep.airDateUtc ? '0' : '4px' }}>
                                {statusBadge === 'Missing' && <AlertCircle size={14} />}
                                {statusBadge === 'Downloaded' && <CheckCircle2 size={14} />}
                                {statusBadge === 'Unaired' && <Clock size={14} />}
                                {statusBadge}
                              </div>
                            </div>
                            
                            <div style={{ display: 'flex', gap: '8px' }}>
                              <button 
                                className="icon-btn" 
                                title="Interactive Search"
                                disabled={isUnaired}
                                onClick={() => setInteractiveModalData({ item: ep, isRadarr: false, title: `S${String(seasonNum).padStart(2, '0')}E${String(ep.episodeNumber).padStart(2, '0')} - ${ep.title}` })}
                                style={{ opacity: isUnaired ? 0.3 : 1 }}
                              >
                                <List size={16} />
                              </button>
                              <button 
                                className="icon-btn" 
                                title="Auto Search"
                                disabled={isUnaired || searchingIds[ep.id] || searchSuccessIds[ep.id]}
                                onClick={() => handleEpisodeSearch(ep.id)}
                                style={{ opacity: isUnaired ? 0.3 : 1 }}
                              >
                                {searchingIds[ep.id] ? (
                                  <Loader2 size={16} className="spinner" />
                                ) : searchSuccessIds[ep.id] ? (
                                  <CheckCircle2 size={16} color="#34C759" />
                                ) : (
                                  <Search size={16} />
                                )}
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
              <h2>Media Settings</h2>
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
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '8px' }}>
                <button className="btn btn-secondary" onClick={() => setShowSettings(false)}>Cancel</button>
                <button 
                  className="btn btn-primary" 
                  onClick={handleSaveSettings}
                  disabled={isSavingSettings || qualityProfiles.length === 0}
                  style={{ display: 'flex', alignItems: 'center', gap: '8px' }}
                >
                  {isSavingSettings && <Loader2 size={16} className="spinner" />}
                  Save Settings
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
    </div>
  );
};

export default MediaDetails;
