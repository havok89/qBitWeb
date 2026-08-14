import React, { useState, useEffect, useRef } from 'react';
import { Loader2 } from 'lucide-react';

const LazyImage = ({ src, alt, className, style, isBackground = false, backgroundOpacity = 1 }) => {
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState(false);
  const imgRef = useRef(null);
  const bgImgRef = useRef(null);

  useEffect(() => {
    if (imgRef.current && imgRef.current.complete) {
      setLoaded(true);
    }
    if (bgImgRef.current && bgImgRef.current.complete) {
      setLoaded(true);
    }
  }, [src]);

  if (!src) return null;

  const handleLoad = () => setLoaded(true);
  const handleError = () => setError(true);

  if (isBackground) {
    return (
      <div style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, zIndex: 0, overflow: 'hidden', pointerEvents: 'none', ...style }} className={className}>
        {/* Spinner */}
        {!loaded && !error && (
          <div style={{
            position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)',
            display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 1
          }}>
            <Loader2 size={32} className="spinner" style={{ color: 'var(--accent-blue)', opacity: 0.5 }} />
          </div>
        )}
        
        {/* Background Image Container */}
        <div 
          style={{
            position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
            backgroundImage: `url(${src})`,
            backgroundSize: 'cover',
            backgroundPosition: 'center',
            opacity: (loaded || error) ? backgroundOpacity : 0,
            transition: 'opacity 0.5s ease-in-out'
          }} 
        />
        {/* Hidden image to trigger load event */}
        <img 
          ref={bgImgRef}
          src={src} 
          style={{ display: 'none' }} 
          onLoad={handleLoad} 
          onError={handleError} 
          alt="" 
        />
      </div>
    );
  }

  return (
    <div style={{ position: 'relative', display: 'flex', justifyContent: 'center', alignItems: 'center', overflow: 'hidden', ...style }} className={className}>
      {!loaded && !error && (
        <div style={{ position: 'absolute', display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
          <Loader2 size={24} className="spinner" style={{ color: 'var(--accent-blue)', opacity: 0.5 }} />
        </div>
      )}
      <img 
        ref={imgRef}
        src={src} 
        alt={alt} 
        onLoad={handleLoad} 
        onError={handleError}
        style={{ 
          width: '100%', 
          height: '100%', 
          objectFit: 'cover', 
          display: 'block',
          opacity: (loaded || error) ? 1 : 0,
          transition: 'opacity 0.3s ease-in-out',
        }} 
      />
    </div>
  );
};

export default LazyImage;
