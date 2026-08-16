import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import MediaDetails from './MediaDetails';
import { getMovie, deleteMovie } from '../radarrApi';
import { getSeries, deleteSeries } from '../sonarrApi';
import { Loader2 } from 'lucide-react';

const MediaDetailsRoute = () => {
  const { type, id } = useParams();
  const navigate = useNavigate();
  const [item, setItem] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const isRadarr = type === 'movie';

  useEffect(() => {
    const fetchItem = async () => {
      setLoading(true);
      setError(null);
      try {
        let data;
        if (isRadarr) {
          data = await getMovie(id);
        } else {
          data = await getSeries(id);
        }
        
        if (!data || data.message === 'NotFound') {
          setError('Media not found');
        } else {
          setItem(data);
        }
      } catch (err) {
        setError(err.message || 'Failed to load media details');
      } finally {
        setLoading(false);
      }
    };

    fetchItem();

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        fetchItem();
      }
    };
    
    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [type, id, isRadarr]);

  const handleBack = () => {
    navigate(-1);
  };

  const handleDelete = async (delId, delIsRadarr) => {
    if (delIsRadarr) {
      await deleteMovie(delId, true);
    } else {
      await deleteSeries(delId, true);
    }
    navigate('/library', { replace: true });
  };

  if (loading) {
    return (
      <div className="empty-state">
        <Loader2 size={48} className="spinner" opacity={0.5} />
        <h2>Loading...</h2>
      </div>
    );
  }

  if (error || !item) {
    return (
      <div className="empty-state">
        <h2>{error || 'Not found'}</h2>
        <button className="btn btn-secondary" onClick={handleBack} style={{ marginTop: '16px' }}>Go Back</button>
      </div>
    );
  }

  return (
    <MediaDetails 
      item={item} 
      isRadarr={isRadarr} 
      onBack={handleBack}
      onDelete={handleDelete}
    />
  );
};

export default MediaDetailsRoute;
