import React, { createContext, useContext, useState, useRef, useCallback, useEffect } from 'react';
import { getRadarrCommandStatus } from './radarrApi';
import { getSonarrCommandStatus } from './sonarrApi';
import { useToast } from './ToastContext';
import { CheckCircle2, XCircle } from 'lucide-react';

const CommandContext = createContext();

export const useCommand = () => useContext(CommandContext);

export const CommandProvider = ({ children }) => {
  const [searchStatuses, setSearchStatuses] = useState(() => {
    try {
      const saved = localStorage.getItem('qbitweb_search_statuses');
      return saved ? JSON.stringify(JSON.parse(saved)) !== '{}' ? JSON.parse(saved) : {} : {};
    } catch (e) {
      return {};
    }
  });
  const activeIntervals = useRef({});
  const activeTimeouts = useRef({});
  const { addToast } = useToast();
  
  // Custom setter to always sync with localStorage
  const updateSearchStatuses = useCallback((updater) => {
    setSearchStatuses(prev => {
      const newState = typeof updater === 'function' ? updater(prev) : updater;
      localStorage.setItem('qbitweb_search_statuses', JSON.stringify(newState));
      return newState;
    });
  }, []);

  const trackCommand = useCallback((trackingKey, commandId, isRadarr, title) => {
    if (!commandId) return;

    // Clear any existing intervals/timeouts for this key
    if (activeIntervals.current[trackingKey]) {
      clearInterval(activeIntervals.current[trackingKey]);
    }
    if (activeTimeouts.current[trackingKey]) {
      clearTimeout(activeTimeouts.current[trackingKey]);
    }

    updateSearchStatuses(prev => ({
      ...prev,
      [trackingKey]: { isSearching: true, isSuccess: false, title, commandId, isRadarr }
    }));

    const pollStatus = async () => {
      try {
        const commandData = isRadarr 
          ? await getRadarrCommandStatus(commandId)
          : await getSonarrCommandStatus(commandId);

        const status = commandData.status;

        if (status === 'completed' || status === 'failed') {
          clearInterval(activeIntervals.current[trackingKey]);
          delete activeIntervals.current[trackingKey];
          
          if (status === 'completed') {
            updateSearchStatuses(prev => ({
              ...prev,
              [trackingKey]: { isSearching: false, isSuccess: true, title, commandId, isRadarr }
            }));
            
            let isFound = true;
            let parsedMessage = commandData.message || "Search completed successfully";
            if (parsedMessage.toLowerCase().includes("reports downloaded")) {
              const match = parsedMessage.match(/(\d+)\s+reports downloaded/i);
              if (match) {
                const num = parseInt(match[1], 10);
                if (num > 0) {
                  parsedMessage = "Download started";
                } else {
                  parsedMessage = "No downloads found";
                  isFound = false;
                }
              }
            }
            
            addToast(
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                {isFound 
                  ? <CheckCircle2 size={24} color="#4caf50" style={{ flexShrink: 0 }} />
                  : <XCircle size={24} color="#ff4d4d" style={{ flexShrink: 0 }} />
                }
                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  {title && <span style={{ fontWeight: '600' }}>{title}</span>}
                  <span style={{ fontSize: '14px', color: title ? 'var(--text-secondary)' : 'inherit' }}>
                    {parsedMessage}
                  </span>
                </div>
              </div>
            );
            
            // Wait 5 seconds before clearing the success checkmark
            activeTimeouts.current[trackingKey] = setTimeout(() => {
              updateSearchStatuses(prev => {
                const newState = { ...prev };
                delete newState[trackingKey];
                return newState;
              });
              delete activeTimeouts.current[trackingKey];
            }, 5000);
          } else {
            // If it failed, clear the status immediately
            updateSearchStatuses(prev => {
              const newState = { ...prev };
              delete newState[trackingKey];
              return newState;
            });
          }
        }
      } catch (err) {
        console.error("Error polling command status:", err);
      }
    };

    // Start polling every 2 seconds
    activeIntervals.current[trackingKey] = setInterval(pollStatus, 2000);
    pollStatus();
  }, [addToast, updateSearchStatuses]);

  // Re-hydrate commands on mount
  useEffect(() => {
    Object.entries(searchStatuses).forEach(([key, status]) => {
      if (status.isSearching && status.commandId) {
        trackCommand(key, status.commandId, status.isRadarr, status.title);
      }
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <CommandContext.Provider value={{ searchStatuses, trackCommand }}>
      {children}
    </CommandContext.Provider>
  );
};
