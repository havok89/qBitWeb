import React, { useState } from 'react';
import { Calendar, Search, Loader2, AlertCircle, Clock, CheckCircle2 } from 'lucide-react';
import { searchEpisode } from '../sonarrApi';

const SonarrCard = ({ episode }) => {
  const [isSearching, setIsSearching] = useState(false);
  const [searchSuccess, setSearchSuccess] = useState(false);
  const [isTitleExpanded, setIsTitleExpanded] = useState(false);

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
  const statusBadge = episode.hasFile ? 'Downloaded' : (isUnaired ? 'Unaired' : 'Missing');
  const statusColor = episode.hasFile ? '#34C759' : (isUnaired ? 'var(--accent-blue)' : 'var(--danger)');

  const handleSearch = async () => {
    if (isSearching || searchSuccess) return;
    setIsSearching(true);
    try {
      const success = await searchEpisode(episode.id);
      if (success) {
        setSearchSuccess(true);
        setTimeout(() => setSearchSuccess(false), 5000);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setIsSearching(false);
    }
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
              {statusBadge}
            </span>
          </div>
        </div>

        <div className="action-buttons">
          <button 
            className={`icon-btn ${searchSuccess ? 'primary' : ''}`} 
            onClick={handleSearch} 
            title="Search for Episode"
            disabled={isSearching || episode.hasFile || isUnaired}
            style={(episode.hasFile || isUnaired) ? { opacity: 0.5, cursor: 'not-allowed' } : {}}
          >
            {isSearching ? <Loader2 size={18} className="spinner" /> : <Search size={18} fill={searchSuccess ? 'currentColor' : 'none'} />}
          </button>
        </div>
      </div>
    </div>
  );
};

export default SonarrCard;
