import React, { createContext, useContext, useState, useCallback } from 'react';
import Toast from './components/Toast';

const ToastContext = createContext();

export const useToast = () => useContext(ToastContext);

export const ToastProvider = ({ children }) => {
  const [toasts, setToasts] = useState([]);

  const addToast = useCallback((message) => {
    const id = Date.now().toString() + Math.random().toString(36).substr(2, 9);
    setToasts(prev => [...prev, { id, message }]);
  }, []);

  const removeToast = useCallback((id) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  }, []);

  return (
    <ToastContext.Provider value={{ addToast }}>
      {children}
      
      {/* Toast Container */}
      <div style={{
        position: 'fixed',
        top: '24px',
        right: '24px',
        display: 'flex',
        flexDirection: 'column',
        gap: '12px',
        zIndex: 9999,
        pointerEvents: 'none' // Allow clicks to pass through empty space
      }}>
        {toasts.map(toast => (
          <Toast key={toast.id} message={toast.message} onClose={() => removeToast(toast.id)} />
        ))}
      </div>
    </ToastContext.Provider>
  );
};
