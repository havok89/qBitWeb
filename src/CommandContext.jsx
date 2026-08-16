import React, { createContext, useContext, useState, useRef, useCallback } from 'react';
import { getRadarrCommandStatus } from './radarrApi';
import { getSonarrCommandStatus } from './sonarrApi';
import { useToast } from './ToastContext';

const CommandContext = createContext();

export const useCommand = () => useContext(CommandContext);

export const CommandProvider = ({ children }) => {
  const [searchStatuses, setSearchStatuses] = useState({});
  const activeIntervals = useRef({});
  const activeTimeouts = useRef({});
  const { addToast } = useToast();

  const trackCommand = useCallback((trackingKey, commandId, isRadarr, title) => {
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
        const commandData = isRadarr 
          ? await getRadarrCommandStatus(commandId)
          : await getSonarrCommandStatus(commandId);

        const status = commandData.status;

        if (status === 'completed' || status === 'failed') {
          clearInterval(activeIntervals.current[trackingKey]);
          delete activeIntervals.current[trackingKey];
          
          if (status === 'completed') {
            setSearchStatuses(prev => ({
              ...prev,
              [trackingKey]: { isSearching: false, isSuccess: true }
            }));
            
            let parsedMessage = commandData.message || "Search completed successfully";
            if (parsedMessage.toLowerCase().includes("reports downloaded")) {
              const match = parsedMessage.match(/(\d+)\s+reports downloaded/i);
              if (match) {
                const num = parseInt(match[1], 10);
                parsedMessage = num > 0 ? "Download started" : "No downloads found";
              }
            }
            
            if (title) {
              addToast(`${title}\n${parsedMessage}`);
            } else {
              addToast(parsedMessage);
            }
            
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
  }, [addToast]);

  return (
    <CommandContext.Provider value={{ searchStatuses, trackCommand }}>
      {children}
    </CommandContext.Provider>
  );
};
