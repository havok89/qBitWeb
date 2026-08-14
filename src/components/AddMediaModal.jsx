import React, { useState, useEffect } from 'react';
import { Search, Loader2, X, Image as ImageIcon, Film, Tv, ArrowLeft } from 'lucide-react';
import { lookupMovie, getMovieQualityProfiles, getMovieRootFolders, addMovie } from '../radarrApi';
import { lookupSeries, getSeriesQualityProfiles, getSeriesRootFolders, addSeries } from '../sonarrApi';

const AddMediaModal = ({ onClose, initialMode = 'movie', sonarrAvailable = true, radarrAvailable = true }) => {
  const [mode, setMode] = useState(initialMode); // 'movie' or 'series'
  const [searchTerm, setSearchTerm] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [results, setResults] = useState([]);
  
  const [selectedItem, setSelectedItem] = useState(null);
  
  const [profiles, setProfiles] = useState([]);
  const [rootFolders, setRootFolders] = useState([]);
  const [selectedProfile, setSelectedProfile] = useState('');
  const [selectedFolder, setSelectedFolder] = useState('');
  
  const [autoSearch, setAutoSearch] = useState(true); // Used for Radarr searchForMovie
  
  // Sonarr specific options
  const [sonarrMonitor, setSonarrMonitor] = useState('all');
  const [sonarrSeriesType, setSonarrSeriesType] = useState('standard');
  const [sonarrSeasonFolder, setSonarrSeasonFolder] = useState(true);
  const [sonarrSearchForMissing, setSonarrSearchForMissing] = useState(false);
  const [sonarrSearchForCutoffUnmet, setSonarrSearchForCutoffUnmet] = useState(false);
  const [isAdding, setIsAdding] = useState(false);
  const [addStatus, setAddStatus] = useState('idle'); // 'idle', 'success', 'error'
  const [addError, setAddError] = useState(null);

  useEffect(() => {
    const fetchMetadata = async () => {
      try {
        let profs, folders;
        if (mode === 'movie') {
          profs = await getMovieQualityProfiles();
          folders = await getMovieRootFolders();
        } else {
          profs = await getSeriesQualityProfiles();
          folders = await getSeriesRootFolders();
        }
        
        setProfiles(profs || []);
        setRootFolders(folders || []);
        
        if (profs?.length > 0) setSelectedProfile(profs[0].id);
        if (folders?.length > 0) setSelectedFolder(folders[0].path);
      } catch (err) {
        console.error('Failed to fetch metadata:', err);
      }
    };
    fetchMetadata();
  }, [mode]);

  const handleSearch = async (e) => {
    e.preventDefault();
    if (!searchTerm.trim()) return;
    
    setIsSearching(true);
    setSelectedItem(null);
    setAddStatus('idle');
    setAddError(null);
    try {
      let data;
      if (mode === 'movie') {
        data = await lookupMovie(searchTerm);
      } else {
        data = await lookupSeries(searchTerm);
      }
      setResults(data || []);
    } catch (err) {
      console.error('Search failed:', err);
      alert('Search failed. Check console for details.');
    } finally {
      setIsSearching(false);
    }
  };

  const handleAdd = async () => {
    if (!selectedItem || !selectedProfile || !selectedFolder) return;
    
    setIsAdding(true);
    setAddStatus('idle');
    setAddError(null);
    try {
      if (mode === 'movie') {
        await addMovie({
          ...selectedItem,
          qualityProfileId: Number(selectedProfile),
          rootFolderPath: selectedFolder,
          monitored: true,
          addOptions: { searchForMovie: autoSearch }
        });
      } else {
        await addSeries({
          ...selectedItem,
          qualityProfileId: Number(selectedProfile),
          rootFolderPath: selectedFolder,
          monitored: true, // Series level monitoring
          seasonFolder: sonarrSeasonFolder,
          seriesType: sonarrSeriesType,
          addOptions: { 
            monitor: sonarrMonitor, // Season level monitoring
            searchForMissingEpisodes: sonarrSearchForMissing,
            searchForCutoffUnmetEpisodes: sonarrSearchForCutoffUnmet
          }
        });
      }
      setAddStatus('success');
      setTimeout(() => {
        onClose();
      }, 1000);
    } catch (err) {
      console.error('Failed to add media:', err);
      setAddStatus('error');
      setAddError(err.message || 'Failed to add media. Check logs.');
    } finally {
      setIsAdding(false);
    }
  };

  const renderSearchFlow = () => (
    <>
      {radarrAvailable && sonarrAvailable && (
        <div style={{ display: 'flex', gap: '10px', marginBottom: '8px' }}>
          <button 
            className={`btn ${mode === 'movie' ? 'btn-primary' : 'btn-secondary'}`} 
            style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}
            onClick={() => { setMode('movie'); setResults([]); setSelectedItem(null); }}
          >
            <Film size={18} /> Movie
          </button>
          <button 
            className={`btn ${mode === 'series' ? 'btn-primary' : 'btn-secondary'}`} 
            style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}
            onClick={() => { setMode('series'); setResults([]); setSelectedItem(null); }}
          >
            <Tv size={18} /> TV Show
          </button>
        </div>
      )}

      <form onSubmit={handleSearch} style={{ display: 'flex', gap: '8px', marginBottom: '8px' }}>
        <input 
          type="text" 
          value={searchTerm} 
          onChange={(e) => setSearchTerm(e.target.value)} 
          placeholder={`Search for a ${mode === 'movie' ? 'movie' : 'TV show'}...`}
          style={{ flex: 1, padding: '10px', borderRadius: '8px', border: '1px solid #333', background: '#222', color: '#fff' }}
        />
        <button type="submit" className="btn btn-primary" disabled={isSearching || !searchTerm.trim()}>
          {isSearching ? <Loader2 size={18} className="spinner" /> : <Search size={18} />}
        </button>
      </form>

      <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '8px' }}>
        {results.map((item) => {
          const rawPoster = item.images?.find(img => img.coverType === 'poster');
          const posterSrc = rawPoster ? (rawPoster.remoteUrl || rawPoster.url) : null;
          const year = item.year ? `(${item.year})` : '';
          
          return (
            <div 
              key={item.tmdbId || item.tvdbId} 
              onClick={() => setSelectedItem(item)}
              style={{ 
                display: 'flex', gap: '12px', padding: '10px', borderRadius: '8px', 
                background: '#1a1a1a', border: '1px solid transparent',
                cursor: 'pointer', transition: 'all 0.2s', alignItems: 'center'
              }}
            >
              {posterSrc ? (
                <img src={posterSrc} alt="Poster" style={{ width: '40px', height: '60px', objectFit: 'cover', borderRadius: '4px' }} />
              ) : (
                <div style={{ width: '40px', height: '60px', background: '#333', borderRadius: '4px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <ImageIcon size={20} color="#666" />
                </div>
              )}
              <div>
                <div style={{ fontWeight: 600, fontSize: '15px' }}>{item.title} {year}</div>
                <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
                  {mode === 'movie' ? 'Movie' : 'TV Show'}
                  {(item.network || item.studio) ? ` • ${item.network || item.studio}` : ''}
                </div>
              </div>
            </div>
          );
        })}
        {results.length === 0 && !isSearching && searchTerm && (
          <div style={{ textAlign: 'center', padding: '20px', color: 'var(--text-secondary)' }}>No results found.</div>
        )}
      </div>

      <div className="modal-actions" style={{ marginTop: 'auto' }}>
        <button className="btn btn-secondary" onClick={onClose}>Close</button>
      </div>
    </>
  );

  const renderDetailFlow = () => {
    const rawPoster = selectedItem.images?.find(img => img.coverType === 'poster');
    const posterSrc = rawPoster ? (rawPoster.remoteUrl || rawPoster.url) : null;
    const year = selectedItem.year ? `(${selectedItem.year})` : '';

    return (
      <>
        <button 
          className="btn btn-secondary" 
          onClick={() => setSelectedItem(null)}
          style={{ alignSelf: 'flex-start', display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '8px', padding: '6px 12px' }}
        >
          <ArrowLeft size={16} /> Back to results
        </button>

        <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '16px', marginBottom: '16px' }}>
          <div style={{ display: 'flex', gap: '16px' }}>
            {posterSrc ? (
              <img src={posterSrc} alt="Poster" style={{ width: '107px', height: '160px', objectFit: 'cover', borderRadius: '8px', boxShadow: '0 4px 12px rgba(0,0,0,0.5)' }} />
            ) : (
              <div style={{ width: '107px', height: '160px', background: '#333', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <ImageIcon size={40} color="#666" />
              </div>
            )}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <h2 style={{ margin: 0, fontSize: '20px' }}>{selectedItem.title} <span style={{ color: 'var(--text-secondary)', fontWeight: 'normal' }}>{year}</span></h2>
              <div style={{ color: 'var(--text-secondary)', fontSize: '14px', lineHeight: '1.5', display: '-webkit-box', WebkitLineClamp: 4, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                {selectedItem.overview || 'No synopsis available.'}
              </div>
            </div>
          </div>

          <div style={{ padding: '16px', background: '#1a1a1a', borderRadius: '8px', display: 'flex', flexDirection: 'column', gap: '12px', marginTop: 'auto' }}>
            {mode === 'movie' ? (
              <div className="input-group" style={{ display: 'flex', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                <label style={{ margin: 0 }}>Start search immediately</label>
                <input 
                  type="checkbox" 
                  checked={autoSearch} 
                  onChange={(e) => setAutoSearch(e.target.checked)}
                  style={{ width: '18px', height: '18px', cursor: 'pointer' }}
                />
              </div>
            ) : (
              <>
                <div className="input-group">
                  <label>Monitor Options</label>
                  <select 
                    value={sonarrMonitor} 
                    onChange={(e) => setSonarrMonitor(e.target.value)}
                    style={{ padding: '10px', borderRadius: '8px', border: '1px solid #333', background: '#222', color: '#fff', width: '100%' }}
                  >
                    <option value="all">All Seasons</option>
                    <option value="future">Future Seasons</option>
                    <option value="missing">Missing Episodes</option>
                    <option value="existing">Existing Episodes</option>
                    <option value="firstSeason">First Season</option>
                    <option value="latestSeason">Latest Season</option>
                    <option value="none">None</option>
                  </select>
                </div>
                
                <div className="input-group">
                  <label>Series Type</label>
                  <select 
                    value={sonarrSeriesType} 
                    onChange={(e) => setSonarrSeriesType(e.target.value)}
                    style={{ padding: '10px', borderRadius: '8px', border: '1px solid #333', background: '#222', color: '#fff', width: '100%' }}
                  >
                    <option value="standard">Standard</option>
                    <option value="daily">Daily</option>
                    <option value="anime">Anime</option>
                  </select>
                </div>
                
                <div className="input-group" style={{ display: 'flex', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                  <label style={{ margin: 0 }}>Create Season Folders</label>
                  <input 
                    type="checkbox" 
                    checked={sonarrSeasonFolder} 
                    onChange={(e) => setSonarrSeasonFolder(e.target.checked)}
                    style={{ width: '18px', height: '18px', cursor: 'pointer' }}
                  />
                </div>
                
                <div className="input-group" style={{ display: 'flex', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                  <label style={{ margin: 0 }}>Start search for missing episodes</label>
                  <input 
                    type="checkbox" 
                    checked={sonarrSearchForMissing} 
                    onChange={(e) => setSonarrSearchForMissing(e.target.checked)}
                    style={{ width: '18px', height: '18px', cursor: 'pointer' }}
                  />
                </div>
                
                <div className="input-group" style={{ display: 'flex', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                  <label style={{ margin: 0 }}>Start search for cutoff unmet episodes</label>
                  <input 
                    type="checkbox" 
                    checked={sonarrSearchForCutoffUnmet} 
                    onChange={(e) => setSonarrSearchForCutoffUnmet(e.target.checked)}
                    style={{ width: '18px', height: '18px', cursor: 'pointer' }}
                  />
                </div>
              </>
            )}
            
            <div className="input-group">
              <label>Quality Profile</label>
              <select 
                value={selectedProfile} 
                onChange={(e) => setSelectedProfile(e.target.value)}
                style={{ padding: '10px', borderRadius: '8px', border: '1px solid #333', background: '#222', color: '#fff', width: '100%' }}
              >
                {profiles.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            </div>
            
            <div className="input-group">
              <label>Root Folder</label>
              <select 
                value={selectedFolder} 
                onChange={(e) => setSelectedFolder(e.target.value)}
                style={{ padding: '10px', borderRadius: '8px', border: '1px solid #333', background: '#222', color: '#fff', width: '100%' }}
              >
                {rootFolders.map(f => <option key={f.id} value={f.path}>{f.path}</option>)}
              </select>
            </div>
          </div>
        </div>

        {addStatus === 'error' && (
          <div style={{ color: 'var(--danger)', fontSize: '14px', marginBottom: '12px', padding: '10px', background: 'rgba(255, 69, 58, 0.1)', borderRadius: '8px' }}>
            {addError}
          </div>
        )}
        <div className="modal-actions" style={{ marginTop: 'auto' }}>
          <button className="btn btn-secondary" onClick={onClose}>Cancel</button>
          <button 
            className="btn btn-primary" 
            onClick={handleAdd} 
            disabled={!selectedProfile || !selectedFolder || isAdding || addStatus === 'success'}
            style={{ 
              backgroundColor: addStatus === 'success' ? '#34C759' : addStatus === 'error' ? 'var(--danger)' : undefined,
              borderColor: addStatus === 'success' ? '#34C759' : addStatus === 'error' ? 'var(--danger)' : undefined,
              display: 'flex', alignItems: 'center', gap: '8px'
            }}
          >
            {isAdding && <Loader2 size={16} className="spinner" />}
            {isAdding ? 'Adding...' : addStatus === 'success' ? 'Added!' : addStatus === 'error' ? 'Retry' : 'Add Media'}
          </button>
        </div>
      </>
    );
  };

  return (
    <div className="modal-overlay" onClick={(e) => e.target.classList.contains('modal-overlay') && onClose()}>
      <div className="modal-content" onClick={e => e.stopPropagation()} style={{ maxWidth: '600px', width: '90%', maxHeight: '85vh', display: 'flex', flexDirection: 'column' }}>
        {selectedItem ? renderDetailFlow() : renderSearchFlow()}
      </div>
    </div>
  );
};

export default AddMediaModal;
