import React, { useState, useEffect } from 'react';
import { Loader2, Search } from 'lucide-react';
import { getAllMovies } from '../radarrApi';
import { getAllSeries } from '../sonarrApi';
import MediaCard from './MediaCard';

const LibraryView = ({ onSelectMedia, isDownloading }) => {
  const [library, setLibrary] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [visibleCount, setVisibleCount] = useState(5);

  useEffect(() => {
    const fetchLibrary = async () => {
      setIsLoading(true);
      try {
        const [movies, series] = await Promise.all([
          getAllMovies(),
          getAllSeries()
        ]);
        
        const mappedMovies = movies.map(m => ({ ...m, _type: 'radarr' }));
        const mappedSeries = series.map(s => ({ ...s, _type: 'sonarr' }));
        
        // Combine and sort by recently added
        const combined = [...mappedMovies, ...mappedSeries].sort((a, b) => {
          const dateA = new Date(a.added || 0);
          const dateB = new Date(b.added || 0);
          return dateB - dateA;
        });
        
        setLibrary(combined);
      } catch (err) {
        console.error("Failed to load library", err);
      } finally {
        setIsLoading(false);
      }
    };
    
    fetchLibrary();
  }, []);

  const filteredLibrary = library.filter(item => 
    (item.title || '').toLowerCase().includes(searchTerm.toLowerCase())
  );

  const displayedLibrary = filteredLibrary.slice(0, visibleCount);

  return (
    <div style={{ padding: '0 20px 20px 20px', maxWidth: '1200px', margin: '0 auto' }}>
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
          {searchTerm ? 'No media found matching your search.' : 'Your library is empty.'}
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {displayedLibrary.map(item => (
            <div key={`${item._type}-${item.id}`} onClick={() => onSelectMedia(item, item._type === 'radarr')} style={{ cursor: 'pointer' }}>
              <MediaCard 
                item={item} 
                isDownloading={false} 
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
