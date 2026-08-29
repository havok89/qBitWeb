import React, { useState, useEffect } from 'react';
import { Loader2, Search } from 'lucide-react';
import { getAllMovies, getMovieQueue } from '../radarrApi';
import { getAllSeries, getQueue } from '../sonarrApi';
import MediaCard from './MediaCard';

const LibraryView = ({ onSelectMedia, isDownloading, sonarrAvailable = true, radarrAvailable = true, refreshTrigger, onAddMissingItem }) => {
  const [library, setLibrary] = useState([]);
  const [queueStatusMap, setQueueStatusMap] = useState(new Map());
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [visibleCount, setVisibleCount] = useState(5);

  useEffect(() => {
    const fetchLibrary = async () => {
      setIsLoading(true);
      try {
        const fetchPromises = [];
        if (radarrAvailable) fetchPromises.push(getAllMovies());
        else fetchPromises.push(Promise.resolve([]));
        
        if (sonarrAvailable) fetchPromises.push(getAllSeries());
        else fetchPromises.push(Promise.resolve([]));

        const [movies, series] = await Promise.all(fetchPromises);
        
        const mappedMovies = movies.map(m => ({ ...m, _type: 'radarr' }));
        const mappedSeries = series.map(s => ({ ...s, _type: 'sonarr' }));
        
        // Combine and sort by recently added
        const combined = [...mappedMovies, ...mappedSeries].sort((a, b) => {
          const dateA = new Date(a.added || 0);
          const dateB = new Date(b.added || 0);
          return dateB - dateA;
        });
        
        setLibrary(combined);

        // Fetch initial queue state
        const qPromises = [];
        if (radarrAvailable) qPromises.push(getMovieQueue().catch(() => []));
        else qPromises.push(Promise.resolve([]));

        if (sonarrAvailable) qPromises.push(getQueue().catch(() => []));
        else qPromises.push(Promise.resolve([]));

        const [movieQ, seriesQ] = await Promise.all(qPromises);
        const qMap = new Map();
        
        movieQ.forEach(q => {
          const status = q.status === 'completed' ? 'importing' : 'downloading';
          qMap.set(`radarr-${q.movieId}`, status);
        });
        
        seriesQ.forEach(q => {
          const status = q.status === 'completed' ? 'importing' : 'downloading';
          qMap.set(`sonarr-${q.seriesId}`, status);
        });
        
        setQueueStatusMap(qMap);
      } catch (err) {
        console.error("Failed to load library", err);
      } finally {
        setIsLoading(false);
      }
    };
    
    fetchLibrary();
  }, [sonarrAvailable, radarrAvailable, refreshTrigger]);

  const filteredLibrary = library.filter(item => 
    (item.title || '').toLowerCase().includes(searchTerm.toLowerCase())
  );

  const displayedLibrary = filteredLibrary.slice(0, visibleCount);

  return (
    <div>
      <div style={{ display: 'flex', gap: '8px', marginBottom: '24px' }}>
        <div style={{ position: 'relative', flex: 1 }}>
          <Search size={18} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-secondary)' }} />
          <input 
            type="text" 
            placeholder="Search your library..." 
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            style={{ 
              width: '100%', padding: '12px 12px 12px 40px', 
              borderRadius: '8px', border: '1px solid #333', 
              background: '#222', color: '#fff', fontSize: '15px'
            }}
          />
        </div>
      </div>
      
      {isLoading ? (
        <div style={{ display: 'flex', justifyContent: 'center', padding: '40px' }}>
          <Loader2 size={32} className="spinner" color="var(--accent-blue)" />
        </div>
      ) : filteredLibrary.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '40px', color: 'var(--text-secondary)' }}>
          <div style={{ marginBottom: searchTerm ? '16px' : '0' }}>
            {searchTerm ? 'No media found matching your search.' : 'Your library is empty.'}
          </div>
          {searchTerm && onAddMissingItem && (
            <button 
              className="btn btn-primary" 
              onClick={() => onAddMissingItem(searchTerm)}
            >
              Add "{searchTerm}" to Library
            </button>
          )}
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {displayedLibrary.map(item => (
            <div key={`${item._type}-${item.id}`} onClick={() => onSelectMedia(item, item._type === 'radarr')} style={{ cursor: 'pointer' }}>
              <MediaCard 
                item={item} 
                queueStatus={queueStatusMap.get(`${item._type}-${item.id}`)} 
                hideSearch={true} 
              />
            </div>
          ))}
          {visibleCount < filteredLibrary.length && (
            <button 
              className="btn btn-secondary" 
              style={{ padding: '12px', fontSize: '15px', fontWeight: '500', width: '100%', marginTop: '8px' }}
              onClick={() => setVisibleCount(v => v + 10)}
            >
              Load 10 more
            </button>
          )}
        </div>
      )}
    </div>
  );
};

export default LibraryView;
