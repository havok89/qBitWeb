import React from 'react';
import { Loader2 } from 'lucide-react';
import Modal from './Modal';

const ConfirmModal = ({ isOpen, onClose, onConfirm, title = "Confirm", message, isProcessing = false, confirmText = "Confirm", cancelText = "Cancel", isDanger = true, children }) => {
  if (!isOpen) return null;

  return (
    <Modal>
      <div className="modal-overlay" onClick={onClose}>
        <div className="modal-content" onClick={e => e.stopPropagation()} style={{ maxWidth: '400px' }}>
          <div className="modal-header">
            <h2>{title}</h2>
          </div>
          <div className="modal-body" style={{ color: 'var(--text-secondary)', lineHeight: '1.5', marginBottom: '24px' }}>
            {message}
            {children}
          </div>
          <div className="modal-actions" style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
            <button className="btn btn-secondary" onClick={onClose} disabled={isProcessing}>
              {cancelText}
            </button>
            <button 
              className={`btn ${isDanger ? 'btn-danger' : 'btn-primary'}`} 
              onClick={onConfirm} 
              disabled={isProcessing} 
              style={{ display: 'flex', alignItems: 'center', gap: '8px' }}
            >
              {isProcessing && <Loader2 size={16} className="spinner" />}
              {confirmText}
            </button>
          </div>
        </div>
      </div>
    </Modal>
  );
};

export default ConfirmModal;
