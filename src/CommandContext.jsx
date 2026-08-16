import React, { createContext, useContext, useState, useRef, useCallback } from 'react';
import { getRadarrCommandStatus } from './radarrApi';
import { getSonarrCommandStatus } from './sonarrApi';

const CommandContext = createContext();

export const useCommand = () => useContext(CommandContext);

export const CommandProvider = ({ children }) => {
  const [searchStatuses, setSearchStatuses] = useState({});
  const activeIntervals = useRef({});
  const activeTimeouts = useRef({});

  const trackCommand = useCallback((trackingKey, commandId, isRadarr) => {
    if (!commandId) return;

    // Clear any existing intervals/timeouts for this key
    if (activeIntervals.current[trackingKey]) {
      clearInterval(activeIntervals.current[trackingKey]);
    }
    if (activeTimeouts.current[trackingKey]) {
      clearTimeout(activeTimeouts.current[trackingKey]);
    }

    setSearchStatuses(prev => ({
      ...prev,
      [trackingKey]: { isSearching: true, isSuccess: false }
    }));

    const pollStatus = async () => {
      try {
        const status = isRadarr 
          ? await getRadarrCommandStatus(commandId)
          : await getSonarrCommandStatus(commandId);

        if (status === 'completed' || status === 'failed') {
          clearInterval(activeIntervals.current[trackingKey]);
          delete activeIntervals.current[trackingKey];
          
          if (status === 'completed') {
            setSearchStatuses(prev => ({
              ...prev,
              [trackingKey]: { isSearching: false, isSuccess: true }
            }));
            
            // Wait 5 seconds before clearing the success checkmark
            activeTimeouts.current[trackingKey] = setTimeout(() => {
              setSearchStatuses(prev => {
                const newState = { ...prev };
                delete newState[trackingKey];
                return newState;
              });
              delete activeTimeouts.current[trackingKey];
            }, 5000);
          } else {
            // If it failed, clear the status immediately
            setSearchStatuses(prev => {
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
  }, []);

  return (
    <CommandContext.Provider value={{ searchStatuses, trackCommand }}>
      {children}
    </CommandContext.Provider>
  );
};
