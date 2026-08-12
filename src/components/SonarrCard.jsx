import React, { useState } from 'react';
import { Calendar, Search, Loader2 } from 'lucide-react';
import { searchEpisode } from '../sonarrApi';

const SonarrCard = ({ episode }) => {
  const [isSearching, setIsSearching] = useState(false);
  const [searchSuccess, setSearchSuccess] = useState(false);

  const seriesTitle = episode.series?.title || 'Unknown Series';
  const episodeTitle = episode.title || 'Unknown Episode';
  const seasonEp = `S${String(episode.seasonNumber).padStart(2, '0')}E${String(episode.episodeNumber).padStart(2, '0')}`;
  
  const airDateStr = episode.airDateUtc 
    ? new Date(episode.airDateUtc).toLocaleDateString(undefined, { 
        weekday: 'short', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit'
      })
    : episode.airDate || 'Unknown Date';

  const posterImage = episode.series?.images?.find(img => img.coverType === 'poster');
  const posterSrc = posterImage ? (posterImage.url || posterImage.remoteUrl) : null;

  const [isTitleExpanded, setIsTitleExpanded] = useState(false);

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
    <div className="modern-card">
      {posterSrc && (
        <div style={{ flexShrink: 0 }}>
          <img 
            src={posterSrc} 
            alt="Poster" 
            style={{ width: '48px', height: '72px', objectFit: 'cover', borderRadius: '4px' }} 
          />
        </div>
      )}
      <div className="modern-info">
        <div className="modern-title-row">
          <h3 
            title={`${seriesTitle} - ${seasonEp}`}
            className={isTitleExpanded ? 'expanded' : ''}
            onClick={() => setIsTitleExpanded(!isTitleExpanded)}
          >
            {seriesTitle} - {seasonEp}
          </h3>
          <span className="modern-status" style={{ color: 'var(--accent-blue)' }}>{episodeTitle}</span>
        </div>
        
        <div className="modern-meta-row" style={{ marginTop: '4px' }}>
          <span className="meta-text highlight"><Calendar size={14} /> {airDateStr}</span>
          
          {episode.hasFile && (
            <>
              <span className="meta-divider">•</span>
              <span className="meta-text" style={{ color: '#34C759' }}>Downloaded</span>
            </>
          )}
        </div>
      </div>

      <div className="action-buttons">
        <button 
          className={`icon-btn ${searchSuccess ? 'primary' : ''}`} 
          onClick={handleSearch} 
          title="Search for Episode"
          disabled={isSearching || episode.hasFile}
          style={episode.hasFile ? { opacity: 0.5, cursor: 'not-allowed' } : {}}
        >
          {isSearching ? <Loader2 size={18} className="spinner" /> : <Search size={18} fill={searchSuccess ? 'currentColor' : 'none'} />}
        </button>
      </div>
    </div>
  );
};

export default SonarrCard;
