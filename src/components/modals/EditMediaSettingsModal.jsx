import React, { useState, useEffect } from 'react';
import { X, Loader2 } from 'lucide-react';
import Modal from './Modal';
import { getSeriesQualityProfiles, updateSeries } from '../../sonarrApi';
import { getMovieQualityProfiles, updateMovie } from '../../radarrApi';

const EditMediaSettingsModal = ({ isOpen, onClose, item, isRadarr, onSaveSuccess }) => {
  const [qualityProfiles, setQualityProfiles] = useState([]);
  const [selectedQualityProfile, setSelectedQualityProfile] = useState('');
  const [selectedSeriesType, setSelectedSeriesType] = useState('standard');
  const [selectedMonitored, setSelectedMonitored] = useState(true);
  const [selectedSeasonFolder, setSelectedSeasonFolder] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (isOpen && item) {
      setSelectedQualityProfile(item.qualityProfileId || '');
      if (!isRadarr) {
        setSelectedSeriesType(item.seriesType || 'standard');
        setSelectedMonitored(item.monitored !== undefined ? item.monitored : true);
        setSelectedSeasonFolder(item.seasonFolder !== undefined ? item.seasonFolder : true);
      }
      
      const fetchProfiles = async () => {
        try {
          const profiles = isRadarr ? await getMovieQualityProfiles() : await getSeriesQualityProfiles();
          setQualityProfiles(profiles);
        } catch (e) {
          console.error("Failed to load profiles", e);
        }
      };
      fetchProfiles();
    }
  }, [isOpen, item, isRadarr]);

  if (!isOpen) return null;

  const handleSave = async () => {
    setIsSaving(true);
    try {
      const updatedData = { ...item, qualityProfileId: Number(selectedQualityProfile) };
      if (!isRadarr) {
        updatedData.seriesType = selectedSeriesType;
        updatedData.monitored = selectedMonitored;
        updatedData.seasonFolder = selectedSeasonFolder;
      }
      const result = isRadarr ? await updateMovie(updatedData) : await updateSeries(updatedData);
      onSaveSuccess(result);
    } catch (e) {
      console.error("Failed to update media settings", e);
      alert("Failed to update settings. " + e.message);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Modal>
      <div className="modal-overlay" onClick={onClose}>
        <div className="modal-content" onClick={e => e.stopPropagation()} style={{ maxWidth: '400px', width: '90%' }}>
          <div className="modal-header">
            <h2>Edit Media</h2>
            <button className="icon-btn" onClick={onClose}>
              <X size={20} />
            </button>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div>
              <label style={{ display: 'block', marginBottom: '8px', fontWeight: '500', color: 'var(--text-secondary)' }}>
                Quality Profile
              </label>
              {qualityProfiles.length === 0 ? (
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--text-secondary)' }}>
                  <Loader2 size={16} className="spinner" /> Loading profiles...
                </div>
              ) : (
                <select 
                  className="form-input" 
                  value={selectedQualityProfile}
                  onChange={(e) => setSelectedQualityProfile(e.target.value)}
                  style={{ width: '100%', padding: '12px', background: '#222', color: '#fff', border: '1px solid #333', borderRadius: '8px', fontSize: '15px', cursor: 'pointer' }}
                >
                  {qualityProfiles.map(p => (
                    <option key={p.id} value={p.id}>{p.name}</option>
                  ))}
                </select>
              )}
            </div>

            {!isRadarr && (
              <>
                <div>
                  <label style={{ display: 'block', marginBottom: '8px', fontWeight: '500', color: 'var(--text-secondary)' }}>
                    Series Type
                  </label>
                  <select 
                    className="form-input" 
                    value={selectedSeriesType} 
                    onChange={(e) => setSelectedSeriesType(e.target.value)}
                    style={{ width: '100%', padding: '12px', background: '#222', color: '#fff', border: '1px solid #333', borderRadius: '8px', fontSize: '15px', cursor: 'pointer' }}
                  >
                    <option value="standard">Standard</option>
                    <option value="daily">Daily</option>
                    <option value="anime">Anime</option>
                  </select>
                </div>
                
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginTop: '4px' }}>
                  <input 
                    type="checkbox" 
                    id="edit-monitored"
                    checked={selectedMonitored} 
                    onChange={(e) => setSelectedMonitored(e.target.checked)}
                    style={{ width: '18px', height: '18px', cursor: 'pointer', accentColor: 'var(--accent-blue)' }}
                  />
                  <label htmlFor="edit-monitored" style={{ cursor: 'pointer', fontWeight: '500' }}>
                    Monitored
                  </label>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginTop: '4px' }}>
                  <input 
                    type="checkbox" 
                    id="edit-season-folder"
                    checked={selectedSeasonFolder} 
                    onChange={(e) => setSelectedSeasonFolder(e.target.checked)}
                    style={{ width: '18px', height: '18px', cursor: 'pointer', accentColor: 'var(--accent-blue)' }}
                  />
                  <label htmlFor="edit-season-folder" style={{ cursor: 'pointer', fontWeight: '500' }}>
                    Use Season Folders
                  </label>
                </div>
              </>
            )}
            
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '8px' }}>
              <button className="btn btn-secondary" onClick={onClose}>Cancel</button>
              <button 
                className="btn btn-primary" 
                onClick={handleSave}
                disabled={isSaving || qualityProfiles.length === 0}
                style={{ display: 'flex', alignItems: 'center', gap: '8px' }}
              >
                {isSaving && <Loader2 size={16} className="spinner" />}
                Save Changes
              </button>
            </div>
          </div>
        </div>
      </div>
    </Modal>
  );
};

export default EditMediaSettingsModal;
