import React from 'react';
import { Loader2, X } from 'lucide-react';
import Modal from './Modal';
import { useCommand } from '../../CommandContext';

const ActiveSearchesModal = ({ isOpen, onClose }) => {
  const { searchStatuses } = useCommand();
  const isSearchActive = Object.values(searchStatuses).some(s => s?.isSearching);

  if (!isOpen) return null;

  return (
    <Modal>
      <div className="modal-overlay" onClick={onClose} style={{ zIndex: 1000 }}>
        <div className="modal-content" onClick={e => e.stopPropagation()} style={{ maxWidth: '400px' }}>
          <div className="modal-header">
            <h3>Active Searches</h3>
            <button className="icon-btn" onClick={onClose}>
              <X size={24} />
            </button>
          </div>
          
          <div className="modal-body" style={{ maxHeight: '60vh', overflowY: 'auto' }}>
            {!isSearchActive ? (
              <div style={{ color: 'var(--text-secondary)', textAlign: 'center', padding: '20px 0' }}>
                No searches currently in progress.
              </div>
            ) : (
              Object.entries(searchStatuses)
                .filter(([_, status]) => status.isSearching)
                .map(([key, status]) => (
                  <div key={key} style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '12px', background: 'rgba(255,255,255,0.05)', borderRadius: '8px', marginBottom: '8px' }}>
                    <Loader2 size={16} className="spinner" style={{ color: 'var(--accent-blue)', flexShrink: 0 }} />
                    <div style={{ fontSize: '14px', fontWeight: '500', color: '#fff', wordBreak: 'break-word' }}>
                      {status.title || 'Search in progress...'}
                    </div>
                  </div>
                ))
            )}
          </div>
        </div>
      </div>
    </Modal>
  );
};

export default ActiveSearchesModal;
