import React, { useState, useEffect } from 'react';
import { getUpcoming, getMissing, getQueue, getRecentlyImported } from '../sonarrApi';
import { getUpcomingMovies, getMissingMovies, getMovieQueue, getRecentlyImportedMovies } from '../radarrApi';
import MediaCard from './MediaCard';
import { Loader2, Film } from 'lucide-react';

const MediaList = ({ mode, isAuthenticated, sonarrAvailable, radarrAvailable, onSelectMedia }) => {
  const [mediaItems, setMediaItems] = useState([]);
  const [downloadingIds, setDownloadingIds] = useState(new Set());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [visibleCount, setVisibleCount] = useState(10);

  useEffect(() => {
    setVisibleCount(10);
    const fetchData = async () => {
      setLoading(true);
      setError('');
      try {
        const promises = [];
        
        if (sonarrAvailable) {
          promises.push(
            (mode === 'recent' ? getRecentlyImported() : (mode === 'upcoming' ? getUpcoming() : getMissing()))
              .then(data => data.map(item => ({ ...item, _type: 'sonarr' })))
              .catch(() => [])
          );
          promises.push(getQueue().then(q => q.map(i => ({ ...i, _type: 'sonarr' }))).catch(() => []));
        } else {
          promises.push(Promise.resolve([]));
          promises.push(Promise.resolve([]));
        }

        if (radarrAvailable) {
          promises.push(
            (mode === 'recent' ? getRecentlyImportedMovies() : (mode === 'upcoming' ? getUpcomingMovies() : getMissingMovies()))
              .then(data => data.map(item => ({ ...item, _type: 'radarr' })))
              .catch(() => [])
          );
          promises.push(getMovieQueue().then(q => q.map(i => ({ ...i, _type: 'radarr' }))).catch(() => []));
        } else {
          promises.push(Promise.resolve([]));
          promises.push(Promise.resolve([]));
        }

        const [sonarrData, sonarrQueue, radarrData, radarrQueue] = await Promise.all(promises);
        
        let mergedData = [...sonarrData, ...radarrData];
        
        // Sort the merged data based on the mode
        if (mode === 'upcoming') {
          mergedData.sort((a, b) => {
            const dateA = new Date(a._type === 'radarr' ? (a.digitalRelease || a.physicalRelease || a.inCinemas) : a.airDateUtc);
            const dateB = new Date(b._type === 'radarr' ? (b.digitalRelease || b.physicalRelease || b.inCinemas) : b.airDateUtc);
            return dateA - dateB;
          });
        } else if (mode === 'recent') {
          mergedData.sort((a, b) => new Date(b.historyDate) - new Date(a.historyDate));
        } else if (mode === 'missing') {
          mergedData.sort((a, b) => {
            const titleA = a._type === 'radarr' ? a.title : a.series?.title;
            const titleB = b._type === 'radarr' ? b.title : b.series?.title;
            return (titleA || '').localeCompare(titleB || '');
          });
        }

        setMediaItems(mergedData);

        const queueSet = new Set([
          ...sonarrQueue.map(q => `sonarr-${q.episodeId}`),
          ...radarrQueue.map(q => `radarr-${q.movieId}`)
        ]);
        setDownloadingIds(queueSet);
      } catch (err) {
        setError(err.message || 'Failed to fetch from media servers');
      } finally {
        setLoading(false);
      }
    };
    
    fetchData();
  }, [mode, sonarrAvailable, radarrAvailable]);

  if (loading) {
    return (
      <div className="empty-state">
        <Loader2 size={48} className="spinner" style={{ color: 'var(--accent-blue)' }} />
        <p>Loading {mode} media...</p>
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

  if (mediaItems.length === 0) {
    return (
      <div className="empty-state">
        <Film size={48} style={{ color: 'var(--text-secondary)', marginBottom: '16px' }} />
        <p>No {mode} media found.</p>
        <p style={{ fontSize: '14px', color: 'var(--text-secondary)', marginTop: '8px' }}>
          {(!sonarrAvailable && !radarrAvailable) ? 'Neither Sonarr nor Radarr are connected.' : 'Check your media server queues.'}
        </p>
      </div>
    );
  }

  // Upcoming groups by day, Missing/Recent are just lists
  let grouped = {};
  if (mode === 'upcoming') {
    mediaItems.forEach(item => {
      const dateStr = item._type === 'radarr' 
        ? new Date(item.digitalRelease || item.physicalRelease || item.inCinemas).toLocaleDateString(undefined, { weekday: 'long', month: 'short', day: 'numeric' })
        : new Date(item.airDateUtc).toLocaleDateString(undefined, { weekday: 'long', month: 'short', day: 'numeric' });
      if (!grouped[dateStr]) grouped[dateStr] = [];
      grouped[dateStr].push(item);
    });
  }

  return (
    <div className="sonarr-list-container">
      {mode === 'upcoming' ? (
        Object.entries(grouped).map(([date, items]) => (
          <div key={date} className="date-group">
            <h3 className="date-header">{date}</h3>
            <div className="torrent-list">
              {items.map(item => (
                <div key={`${item._type}-${item.id}`} onClick={() => onSelectMedia && onSelectMedia(item, item._type === 'radarr')} style={{ cursor: onSelectMedia ? 'pointer' : 'default' }}>
                  <MediaCard 
                    item={item} 
                    isDownloading={downloadingIds.has(`${item._type}-${item.id}`)}
                    hideSearch={true}
                  />
                </div>
              ))}
            </div>
          </div>
        ))
      ) : (
        <div className="torrent-list">
          {mediaItems.slice(0, visibleCount).map(item => (
            <div key={`${item._type}-${item.id}`} onClick={() => onSelectMedia && onSelectMedia(item, item._type === 'radarr')} style={{ cursor: onSelectMedia ? 'pointer' : 'default' }}>
              <MediaCard 
                item={item} 
                isDownloading={downloadingIds.has(`${item._type}-${item.id}`)}
                hideSearch={mode === 'recent'}
              />
            </div>
          ))}
        </div>
      )}
      
      {mode !== 'upcoming' && visibleCount < mediaItems.length && (
        <div style={{ textAlign: 'center', marginTop: '32px' }}>
          <button className="btn btn-secondary" onClick={() => setVisibleCount(v => v + 20)}>
            Load More
          </button>
        </div>
      )}
    </div>
  );
};

export default MediaList;
