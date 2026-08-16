import React, { useEffect, useState } from 'react';
import { X } from 'lucide-react';

const Toast = ({ message, onClose }) => {
  const [isClosing, setIsClosing] = useState(false);

  useEffect(() => {
    const duration = 5000;
    const timer = setTimeout(() => {
      handleClose();
    }, duration);

    return () => clearTimeout(timer);
  }, []);

  const handleClose = () => {
    setIsClosing(true);
    setTimeout(() => {
      onClose();
    }, 300); // Matches CSS transition duration
  };

  // Simple swipe to dismiss
  const [touchStart, setTouchStart] = useState(null);
  const handleTouchStart = (e) => setTouchStart(e.targetTouches[0].clientX);
  const handleTouchEnd = (e) => {
    if (!touchStart) return;
    const touchEnd = e.changedTouches[0].clientX;
    if (touchEnd - touchStart > 50 || touchStart - touchEnd > 50) {
      handleClose();
    }
  };

  return (
    <div 
      className={`toast-notification ${isClosing ? 'toast-closing' : ''}`}
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
      style={{
        position: 'relative',
        background: 'rgba(30, 30, 30, 0.95)',
        border: '1px solid rgba(255, 255, 255, 0.1)',
        backdropFilter: 'blur(10px)',
        padding: '16px',
        borderRadius: '8px',
        color: '#fff',
        boxShadow: '0 8px 32px rgba(0,0,0,0.4)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: '16px',
        overflow: 'hidden',
        minWidth: '280px',
        maxWidth: '90vw',
        pointerEvents: 'auto',
        animation: 'toast-slide-in 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275) forwards',
        transform: isClosing ? 'translateX(120%)' : 'translateX(0)',
        transition: 'transform 0.3s ease-in-out, opacity 0.3s ease-in-out',
        opacity: isClosing ? 0 : 1
      }}
    >
      <div style={{ fontSize: '14px', fontWeight: '500', lineHeight: '1.4', whiteSpace: 'pre-line' }}>
        {message}
      </div>
      <button 
        onClick={handleClose} 
        style={{ 
          background: 'transparent', 
          border: 'none', 
          color: 'var(--text-secondary)', 
          cursor: 'pointer',
          display: 'flex',
          padding: '4px'
        }}
      >
        <X size={16} />
      </button>
      
      {/* Progress Bar */}
      <div style={{
        position: 'absolute',
        bottom: 0,
        left: 0,
        height: '3px',
        background: 'var(--accent-blue)',
        width: '100%',
        animation: 'toast-progress 5s linear forwards'
      }} />
      
      <style dangerouslySetInnerHTML={{__html: `
        @keyframes toast-slide-in {
          from { transform: translateX(120%); opacity: 0; }
          to { transform: translateX(0); opacity: 1; }
        }
        @keyframes toast-progress {
          from { width: 100%; }
          to { width: 0%; }
        }
      `}} />
    </div>
  );
};

export default Toast;
