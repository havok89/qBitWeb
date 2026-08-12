import React, { useState, useEffect } from 'react';
import { getUpcoming, getMissing } from '../sonarrApi';
import SonarrCard from './SonarrCard';
import { Loader2, Tv } from 'lucide-react';

const SonarrList = ({ mode }) => {
  const [episodes, setEpisodes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      setError('');
      try {
        const data = mode === 'upcoming' ? await getUpcoming() : await getMissing();
        setEpisodes(data);
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

  return (
    <div className="torrent-list">
      {episodes.map(ep => (
        <SonarrCard key={ep.id} episode={ep} />
      ))}
    </div>
  );
};

export default SonarrList;
