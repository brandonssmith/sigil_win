import React, { useState, useEffect } from 'react';
import PropTypes from 'prop-types';
import { API_BASE_URL } from '../constants'; // Assuming you have this constants file
import './SavedChatsPanel.css'; // <-- Import the CSS file

function SavedChatsPanel({ onSelectSession }) {
  const [sessions, setSessions] = useState([]);
  const [isLoading, setIsLoading] = useState(false); // Loading for initial list
  const [error, setError] = useState(null); // Error for initial list fetch
  const [loadingSessionId, setLoadingSessionId] = useState(null); // Track which session is loading
  const [sessionLoadError, setSessionLoadError] = useState(null); // Error specific to loading a session

  // useEffect hook for fetching sessions will go here
  useEffect(() => {
    const fetchSessions = async () => {
      setIsLoading(true);
      setError(null);
      try {
        const response = await fetch(`${API_BASE_URL}/api/v1/chat/sessions`);
        if (!response.ok) {
          let errorMsg = `Failed to fetch sessions (status: ${response.status})`;
          try {
            const errorData = await response.json();
            errorMsg = errorData.detail || errorMsg;
          } catch (parseError) { /* Ignore if response body isn't JSON */ }
          throw new Error(errorMsg);
        }
        const data = await response.json();
        // Assuming data is the array: [{ thread_id: "...", title: "..." }, ...]
        setSessions(data);
      } catch (err) {
        console.error("Error fetching sessions:", err);
        setError(err.message);
        setSessions([]); // Clear sessions on error
      } finally {
        setIsLoading(false);
      }
    };

    fetchSessions();
  }, []); // Empty dependency array means run once on mount

  // --- Handle click on a session item --- 
  const handleSessionClick = async (threadId) => {
    if (loadingSessionId) return; // Prevent multiple loads at once

    console.log(`Attempting to load session: ${threadId}`);
    setLoadingSessionId(threadId);
    setSessionLoadError(null); // Clear previous load errors

    try {
      const response = await fetch(`${API_BASE_URL}/api/v1/chat/session/${threadId}`);
      if (!response.ok) {
        let errorMsg = `Failed to load session ${threadId} (status: ${response.status})`;
        try {
          const errorData = await response.json();
          errorMsg = errorData.detail || errorMsg;
        } catch (parseError) { /* Ignore */ }
        throw new Error(errorMsg);
      }
      const loadedSessionData = await response.json();
      
      // Pass the full loaded data up to the parent component
      onSelectSession(loadedSessionData);

      // Optionally clear error on success if displayed within the panel
      // setSessionLoadError(null); 

    } catch (err) {
      console.error("Error loading session:", err);
      setSessionLoadError(`Failed to load session ${threadId}: ${err.message}`);
      // Optionally, display this error near the item or in a general status area
    } finally {
      setLoadingSessionId(null); // Clear loading state regardless of success/failure
    }
  };

  // --- Format title or ID for display --- 
  const formatSessionDisplay = (session) => {
    if (session.title && session.title.trim() !== '') {
        return { title: session.title, id: session.thread_id };
    }
    // If no title, format the timestamp ID for slightly better readability
    // Example ID: 20231027_103055_123456
    const parts = session.thread_id.split('_');
    if (parts.length >= 2) {
        const date = parts[0]; // YYYYMMDD
        const time = parts[1]; // HHMMSS
        const formattedDate = `${date.slice(0, 4)}-${date.slice(4, 6)}-${date.slice(6, 8)}`;
        const formattedTime = `${time.slice(0, 2)}:${time.slice(2, 4)}:${time.slice(4, 6)}`;
        return { title: `${formattedDate} ${formattedTime}`, id: session.thread_id };
    } 
    return { title: session.thread_id, id: session.thread_id }; // Fallback to raw ID
  };

  return (
    <div className="saved-chats-panel">
      <h4>Saved Chats</h4>
      {isLoading && <p>Loading sessions...</p>}
      {error && <p className="error-message">Error: {error}</p>}
      {sessionLoadError && <p className="error-message">{sessionLoadError}</p>}
      {!isLoading && !error && sessions.length === 0 && (
        <p>No saved sessions found.</p>
      )}
      {!isLoading && !error && sessions.length > 0 && (
        <ul className="saved-chats-list">
          {sessions.map((session) => {
            const display = formatSessionDisplay(session);
            return (
              <li 
                key={session.thread_id} 
                className="session-item" 
                onClick={() => handleSessionClick(session.thread_id)}
                title={`ID: ${session.thread_id}`}
              >
                {/* Indicate if this specific session is loading */} 
                {loadingSessionId === session.thread_id ? (
                  <strong>Loading...</strong> 
                ) : (
                  <strong>{display.title}</strong>
                )}
                
                {/* Optionally show ID if title is different */}
                {display.title !== display.id && <span>{display.id}</span>}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

SavedChatsPanel.propTypes = {
  onSelectSession: PropTypes.func.isRequired, // Callback when a session is clicked
};

export default SavedChatsPanel; 