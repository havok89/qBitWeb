import React, { useState, useEffect } from 'react';
import { Loader2, ChevronDown, ChevronRight, AlertCircle, CheckCircle2, Clock, List, Search, Eye, EyeOff } from 'lucide-react';
import { getEpisodes, searchEpisode, searchSeason, updateSeries } from '../sonarrApi';
import { useCommand } from '../CommandContext';
import EpisodeDetailsModal from './modals/EpisodeDetailsModal';

const SeasonList = ({ 
  item, 
  episodeQueueMap, 
  setLocalItem, 
  setInteractiveModalData, 
  setHistoryModalData, 
  setUnmonitorTarget 
}) => {
  const [episodes, setEpisodes] = useState([]);
  const [isLoadingEpisodes, setIsLoadingEpisodes] = useState(true);
  const [collapsedSeasons, setCollapsedSeasons] = useState({});
  const [selectedEpisodeForDetails, setSelectedEpisodeForDetails] = useState(null);

  const { searchStatuses, trackCommand } = useCommand();

  useEffect(() => {
    let active = true;
    const fetchEps = async () => {
      try {
        const data = await getEpisodes(item.id);
        if (active) setEpisodes(data || []);
      } catch (e) {
        console.error("Failed to load episodes", e);
      } finally {
        if (active) setIsLoadingEpisodes(false);
      }
    };
    fetchEps();
    return () => { active = false; };
  }, [item.id]);

  const toggleSeasonCollapse = (seasonNum) => {
    setCollapsedSeasons(prev => ({
      ...prev,
      [seasonNum]: !prev[seasonNum]
    }));
  };

  const handleToggleSeasonMonitor = async (seasonNum) => {
    const seasonIndex = item.seasons.findIndex(s => s.seasonNumber === seasonNum);
    if (seasonIndex === -1) return;
    const isCurrentlyMonitored = item.seasons[seasonIndex].monitored;

    if (isCurrentlyMonitored) {
      setUnmonitorTarget({
        type: 'season',
        title: `${item.title} - ${seasonNum === 0 ? 'Specials' : `Season ${seasonNum}`}`,
        action: async () => {
          try {
            const updatedData = { ...item };
            updatedData.seasons[seasonIndex].monitored = false;
            const result = await updateSeries(updatedData);
            setLocalItem(result);
          } catch (e) {
            console.error("Failed to unmonitor season", e);
            alert("Failed to unmonitor season. " + e.message);
          } finally {
            setUnmonitorTarget(null);
          }
        }
      });
    } else {
      try {
        const updatedData = { ...item };
        updatedData.seasons[seasonIndex].monitored = true;
        const result = await updateSeries(updatedData);
        setLocalItem(result);
      } catch (e) {
        console.error("Failed to monitor season", e);
        alert("Failed to monitor season. " + e.message);
      }
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

  const handleEpisodeSearch = async (episodeId) => {
    const trackingKey = `sonarr-episode-${episodeId}`;
    if (searchStatuses[trackingKey]?.isSearching || searchStatuses[trackingKey]?.isSuccess) return;
    
    try {
      const commandId = await searchEpisode(episodeId);
      if (commandId) {
        const ep = episodes.find(e => e.id === episodeId);
        trackCommand(trackingKey, commandId, false, `${item.title} - S${String(ep?.seasonNumber || 0).padStart(2,'0')}E${String(ep?.episodeNumber || 0).padStart(2,'0')}`);
      }
    } catch (e) {
      console.error("Failed to search episode", e);
    }
  };

  const handleSeasonInteractiveSearch = (seasonNum) => {
    setInteractiveModalData({ 
      item: { isSeason: true, seriesId: item.id, seasonNumber: seasonNum }, 
      isRadarr: false, 
      title: `${item.title} - Season ${seasonNum}` 
    });
  };

  const handleEpisodeInteractiveSearch = (ep, seasonNum) => {
    setInteractiveModalData({ 
      item: { id: ep.id }, 
      isRadarr: false, 
      title: `${item.title} - S${String(seasonNum).padStart(2, '0')}E${String(ep.episodeNumber).padStart(2, '0')}` 
    });
  };

  const seasons = {};
  episodes.forEach(ep => {
    if (!seasons[ep.seasonNumber]) seasons[ep.seasonNumber] = [];
    seasons[ep.seasonNumber].push(ep);
  });
  const sortedSeasons = Object.keys(seasons).map(Number).sort((a, b) => b - a);

  if (isLoadingEpisodes) {
    return <div style={{ display: 'flex', justifyContent: 'center', padding: '40px' }}><Loader2 size={32} className="spinner" color="var(--accent-blue)" /></div>;
  }

  return (
    <>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
        {sortedSeasons.map(seasonNum => {
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
                    {seasonEps.sort((a, b) => b.episodeNumber - a.episodeNumber).map((ep, idx, arr) => {
                      const now = new Date();
                      const isUnaired = ep.airDateUtc ? new Date(ep.airDateUtc) > now : false;
                      
                      const epTrackingKey = `sonarr-episode-${ep.id}`;
                      const epIsSearching = searchStatuses[epTrackingKey]?.isSearching;
                      const epIsSuccess = searchStatuses[epTrackingKey]?.isSuccess;
                      
                      let statusBadge = 'Missing';
                      let statusColor = 'var(--danger)';
                      
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
                      } else if (episodeQueueMap.get(ep.id)?.status === 'importing') {
                        statusBadge = 'Importing';
                        statusColor = '#BF5AF2';
                      } else if (episodeQueueMap.get(ep.id)?.status === 'downloading') {
                        statusBadge = 'Downloading';
                        statusColor = 'var(--accent-blue)';
                      } else if (isUnaired) {
                        statusBadge = 'Unaired';
                        statusColor = 'var(--text-secondary)';
                      }
                      
                      const isLast = idx === arr.length - 1;
                      
                      return (
                        <div 
                          key={ep.id} 
                          onClick={() => setSelectedEpisodeForDetails(ep)}
                          style={{ display: 'flex', alignItems: 'center', gap: '16px', padding: '16px 20px', borderBottom: isLast ? 'none' : '1px solid rgba(255,255,255,0.05)', cursor: 'pointer' }}
                        >
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
                              onClick={(e) => { e.stopPropagation(); setHistoryModalData({ itemId: ep.id, isRadarr: false, title: `${item.title} - S${String(seasonNum).padStart(2, '0')}E${String(ep.episodeNumber).padStart(2, '0')}` }); }} 
                              title="Episode History"
                            >
                              <Clock size={16} />
                            </button>
                            <button 
                              className="icon-btn" 
                              onClick={(e) => { e.stopPropagation(); handleEpisodeInteractiveSearch(ep, seasonNum); }} 
                              title="Interactive Search"
                            >
                              <List size={16} />
                            </button>
                            <button 
                              className={`icon-btn ${epIsSuccess ? 'primary' : ''}`} 
                              onClick={(e) => { e.stopPropagation(); handleEpisodeSearch(ep.id); }} 
                              title="Auto Search"
                              disabled={epIsSearching}
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
          );
        })}
      </div>

      <EpisodeDetailsModal 
        isOpen={!!selectedEpisodeForDetails}
        onClose={() => setSelectedEpisodeForDetails(null)}
        episode={selectedEpisodeForDetails}
        seriesTitle={item.title}
        onFileDeleted={(episodeId) => {
          setEpisodes(prev => prev.map(ep => 
            ep.id === episodeId 
              ? { ...ep, hasFile: false, episodeFileId: 0, episodeFile: undefined }
              : ep
          ));
          setSelectedEpisodeForDetails(null);
        }}
      />
    </>
  );
};

export default SeasonList;
