import React, { useState, useEffect } from 'react';
import { getUpcoming, getMissing, getQueue, getRecentlyImported } from '../sonarrApi';
import { getUpcomingMovies, getMissingMovies, getMovieQueue, getRecentlyImportedMovies } from '../radarrApi';
import MediaCard from './MediaCard';
import { Loader2, Film } from 'lucide-react';

const MediaList = ({ mode, isAuthenticated, sonarrAvailable, radarrAvailable, onSelectMedia }) => {
  const [mediaItems, setMediaItems] = useState([]);
  const [queueStatusMap, setQueueStatusMap] = useState(new Map());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [visibleCount, setVisibleCount] = useState(10);
  const [filter, setFilter] = useState('all');

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
            const dateA = new Date(a._type === 'radarr' ? (a.digitalRelease || a.physicalRelease || a.inCinemas || a.added || 0) : (a.airDateUtc || 0));
            const dateB = new Date(b._type === 'radarr' ? (b.digitalRelease || b.physicalRelease || b.inCinemas || b.added || 0) : (b.airDateUtc || 0));
            return dateB - dateA; // Most recently missing first
          });
        }

        setMediaItems(mergedData);

        const newQueueMap = new Map();
        
        sonarrQueue.forEach(q => {
          const status = q.status === 'completed' ? 'importing' : 'downloading';
          newQueueMap.set(`sonarr-${q.episodeId}`, status);
        });
        
        radarrQueue.forEach(q => {
          const status = q.status === 'completed' ? 'importing' : 'downloading';
          newQueueMap.set(`radarr-${q.movieId}`, status);
        });

        setQueueStatusMap(newQueueMap);
      } catch (err) {
        setError(err.message || 'Failed to fetch from media servers');
      } finally {
        setLoading(false);
      }
    };
    
    fetchData();

    // Auto-refresh when the app (PWA) is brought back to the foreground
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        fetchData();
      }
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [mode, isAuthenticated, sonarrAvailable, radarrAvailable]);

  useEffect(() => {
    let intervalId;
    if (queueStatusMap.size > 0) {
      intervalId = setInterval(async () => {
        try {
          const promises = [];
          if (sonarrAvailable) promises.push(getQueue().catch(() => []));
          else promises.push(Promise.resolve([]));
          
          if (radarrAvailable) promises.push(getMovieQueue().catch(() => []));
          else promises.push(Promise.resolve([]));
          
          const [sonarrQueue, radarrQueue] = await Promise.all(promises);
          
          const newQueueMap = new Map();
          sonarrQueue.forEach(q => {
            const status = q.status === 'completed' ? 'importing' : 'downloading';
            newQueueMap.set(`sonarr-${q.episodeId}`, status);
          });
          
          radarrQueue.forEach(q => {
            const status = q.status === 'completed' ? 'importing' : 'downloading';
            newQueueMap.set(`radarr-${q.movieId}`, status);
          });

          setQueueStatusMap(newQueueMap);
        } catch (e) {
          console.error("Background queue refresh failed", e);
        }
      }, 10000);
    }
    return () => {
      if (intervalId) clearInterval(intervalId);
    };
  }, [queueStatusMap.size, sonarrAvailable, radarrAvailable]);

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
  const filteredItems = mediaItems.filter(item => {
    if (filter === 'movies' && item._type !== 'radarr') return false;
    if (filter === 'tv' && item._type !== 'sonarr') return false;
    return true;
  });

  const grouped = {};
  if (mode === 'upcoming') {
    filteredItems.forEach(item => {
      const dateStr = item._type === 'radarr' 
        ? new Date(item.digitalRelease || item.physicalRelease || item.inCinemas).toLocaleDateString(undefined, { weekday: 'long', month: 'short', day: 'numeric' })
        : new Date(item.airDateUtc).toLocaleDateString(undefined, { weekday: 'long', month: 'short', day: 'numeric' });
      if (!grouped[dateStr]) grouped[dateStr] = [];
      grouped[dateStr].push(item);
    });
  }

  return (
    <div className="sonarr-list-container">
      {(mode === 'missing' || mode === 'recent') && sonarrAvailable && radarrAvailable && (
        <div style={{ display: 'flex', gap: '8px', marginBottom: '24px', justifyContent: 'center' }}>
          {['all', 'movies', 'tv'].map(f => (
            <button 
              key={f}
              onClick={() => { setFilter(f); setVisibleCount(10); }}
              style={{
                padding: '6px 16px',
                borderRadius: '20px',
                border: 'none',
                background: filter === f ? 'var(--accent-blue)' : 'rgba(255,255,255,0.05)',
                color: filter === f ? '#fff' : 'var(--text-secondary)',
                cursor: 'pointer',
                fontWeight: '500',
                fontSize: '14px',
                textTransform: 'capitalize',
                transition: 'all 0.2s'
              }}
            >
              {f === 'tv' ? 'TV Shows' : f}
            </button>
          ))}
        </div>
      )}
      
      {mode === 'upcoming' ? (
        Object.entries(grouped).map(([date, items]) => (
          <div key={date} className="date-group">
            <h3 className="date-header">{date}</h3>
            <div className="torrent-list">
              {items.map(item => (
                <div key={`${item._type}-${item.id}`}>
                  <MediaCard 
                    item={item} 
                    queueStatus={queueStatusMap.get(`${item._type}-${item.id}`)}
                    hideSearch={true}
                    hideHistory={true}
                    onSelectMedia={() => onSelectMedia && onSelectMedia(item.series ? { ...item.series, _type: 'sonarr' } : item, item._type === 'radarr')}
                  />
                </div>
              ))}
            </div>
          </div>
        ))
      ) : (
        <div className="torrent-list">
          {filteredItems.slice(0, visibleCount).map(item => (
            <div key={`${item._type}-${item.id}`}>
              <MediaCard 
                item={item} 
                queueStatus={queueStatusMap.get(`${item._type}-${item.id}`)}
                hideSearch={mode === 'recent'}
                hideHistory={mode === 'missing' || mode === 'upcoming'}
                onSelectMedia={() => onSelectMedia && onSelectMedia(item.series ? { ...item.series, _type: 'sonarr' } : item, item._type === 'radarr')}
              />
            </div>
          ))}
        </div>
      )}
      
      {mode !== 'upcoming' && visibleCount < filteredItems.length && (
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
