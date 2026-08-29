import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';

const Modal = ({ children }) => {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    return () => setMounted(false);
  }, []);

  if (!mounted) return null;

  return createPortal(
    children,
    document.body
  );
};

export default Modal;
