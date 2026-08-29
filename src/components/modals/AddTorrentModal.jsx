import React, { useState } from 'react';
import Modal from './Modal';

const AddTorrentModal = ({ isOpen, onClose, categories, onAdd }) => {
  const [addUrls, setAddUrls] = useState('');
  const [addFiles, setAddFiles] = useState(null);
  const [selectedCategory, setSelectedCategory] = useState('');
  const [isAdding, setIsAdding] = useState(false);

  if (!isOpen) return null;

  const handleAddSubmit = async (e) => {
    e.preventDefault();
    if (!addUrls.trim() && (!addFiles || addFiles.length === 0)) return;
    
    setIsAdding(true);
    const formData = new FormData();
    if (addUrls.trim()) {
      formData.append('urls', addUrls);
    }
    if (addFiles) {
      for (let i = 0; i < addFiles.length; i++) {
        formData.append('torrents', addFiles[i]);
      }
    }
    if (selectedCategory) {
      formData.append('category', selectedCategory);
    }

    try {
      await onAdd(formData);
      setAddUrls('');
      setAddFiles(null);
      setSelectedCategory('');
      onClose();
    } catch (e) {
      console.error("Failed to add torrents", e);
      alert("Failed to add torrents. See console for details.");
    } finally {
      setIsAdding(false);
    }
  };

  return (
    <Modal>
      <div className="modal-overlay" onClick={onClose}>
        <div className="modal-content" onClick={e => e.stopPropagation()}>
          <h3>Add New Torrent</h3>
          <form onSubmit={handleAddSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div className="input-group">
              <label>Magnet Links or URLs (one per line)</label>
              <textarea 
                value={addUrls}
                onChange={(e) => setAddUrls(e.target.value)}
                placeholder="magnet:?xt=urn:btih:..."
                rows="4"
                style={{
                  padding: '12px',
                  borderRadius: '8px',
                  border: '1px solid #333',
                  background: '#222',
                  color: '#fff',
                  width: '100%',
                  fontFamily: 'monospace',
                  resize: 'vertical'
                }}
              />
            </div>
            
            <div className="input-group">
              <label>Or Upload .torrent files</label>
              <input 
                type="file" 
                multiple 
                accept=".torrent"
                onChange={(e) => setAddFiles(e.target.files)}
                style={{
                  padding: '10px',
                  borderRadius: '8px',
                  border: '1px dashed #555',
                  background: '#222',
                  color: '#fff',
                  cursor: 'pointer',
                  width: '100%'
                }}
              />
            </div>

            <div className="input-group">
              <label>Category (Optional)</label>
              <select 
                value={selectedCategory} 
                onChange={(e) => setSelectedCategory(e.target.value)}
                style={{
                  padding: '12px',
                  borderRadius: '8px',
                  border: '1px solid #333',
                  background: '#222',
                  color: '#fff',
                  width: '100%',
                  fontSize: '14px'
                }}
              >
                <option value="">None</option>
                {categories.map(c => (
                  <option key={c.name} value={c.name}>{c.name}</option>
                ))}
              </select>
            </div>

            <div className="modal-actions" style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '8px' }}>
              <button type="button" className="btn btn-secondary" onClick={onClose}>Cancel</button>
              <button type="submit" className="btn btn-primary" disabled={isAdding || (!addUrls.trim() && (!addFiles || addFiles.length === 0))}>
                {isAdding ? 'Adding...' : 'Add Torrents'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </Modal>
  );
};

export default AddTorrentModal;
