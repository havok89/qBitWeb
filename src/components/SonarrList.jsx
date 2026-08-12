import React, { useState, useEffect } from 'react';
import { getUpcoming, getMissing, getQueue, getRecentlyImported } from '../sonarrApi';
import SonarrCard from './SonarrCard';
import { Loader2, Tv } from 'lucide-react';

const SonarrList = ({ mode }) => {
  const [episodes, setEpisodes] = useState([]);
  const [downloadingIds, setDownloadingIds] = useState(new Set());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      setError('');
      try {
        const [data, queueData] = await Promise.all([
          mode === 'recent' ? getRecentlyImported() : (mode === 'upcoming' ? getUpcoming() : getMissing()),
          getQueue()
        ]);
        setEpisodes(data);
        const queueSet = new Set(queueData.map(q => q.episodeId));
        setDownloadingIds(queueSet);
      } catch (err) {
        setError(err.message || 'Failed to fetch from Sonarr');
      } finally {
        setLoading(false);
      }
    };
    
    fetchData();
  }, [mode]);

  if (loading) {
    return (
      <div className="empty-state">
        <Loader2 size={48} className="spinner" style={{ color: 'var(--accent-blue)' }} />
        <p>Loading {mode} episodes...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="empty-state">
        <p className="error-msg">{error}</p>
      </div>
    );
  }

  if (episodes.length === 0) {
    return (
      <div className="empty-state">
        <Tv size={48} style={{ opacity: 0.5 }} />
        <p>No {mode} episodes found.</p>
      </div>
    );
  }

  const renderList = () => {
    if (mode === 'missing' || mode === 'recent') {
      return (
        <div className="torrent-list">
          {episodes.map(ep => (
            <SonarrCard key={ep.id} episode={ep} isDownloading={downloadingIds.has(ep.id)} />
          ))}
        </div>
      );
    }
    
    // Grouping for Upcoming
    const grouped = {};
    episodes.forEach(ep => {
      const dateLabel = ep.airDateUtc 
        ? new Date(ep.airDateUtc).toLocaleDateString(undefined, { weekday: 'long', month: 'short', day: 'numeric' })
        : ep.airDate || 'Unknown Date';
      
      if (!grouped[dateLabel]) grouped[dateLabel] = [];
      grouped[dateLabel].push(ep);
    });

    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
        {Object.entries(grouped).map(([dateLabel, eps]) => (
          <div key={dateLabel}>
            <h3 style={{ 
              color: 'var(--text-secondary)', 
              padding: '0 8px', 
              marginBottom: '12px', 
              fontSize: '16px',
              borderBottom: '1px solid rgba(255,255,255,0.1)',
              paddingBottom: '8px'
            }}>
              {dateLabel}
            </h3>
            <div className="torrent-list">
              {eps.map(ep => (
                 <SonarrCard key={ep.id} episode={ep} isDownloading={downloadingIds.has(ep.id)} />
              ))}
            </div>
          </div>
        ))}
      </div>
    );
  };

  return renderList();
};

export default SonarrList;
