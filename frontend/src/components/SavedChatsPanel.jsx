import React, { useState, useEffect, useCallback } from 'react';
import PropTypes from 'prop-types';
import { API_BASE_URL } from '../constants'; // Assuming you have this constants file
import './SavedChatsPanel.css'; // <-- Import the CSS file

function SavedChatsPanel({ onSelectSession }) {
  const [sessions, setSessions] = useState([]);
  const [isLoading, setIsLoading] = useState(false); // Loading for initial list
  const [error, setError] = useState(null); // Error for initial list fetch
  const [loadingSessionId, setLoadingSessionId] = useState(null); // Track which session is loading
  const [sessionLoadError, setSessionLoadError] = useState(null); // Error specific to loading a session
  const [deletingSessionId, setDeletingSessionId] = useState(null); // <-- NEW: Track deleting session
  const [deleteError, setDeleteError] = useState(null); // <-- NEW: Error specific to deleting

  // --- Fetch Sessions --- 
  const fetchSessions = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    setDeleteError(null); // Clear delete error on refresh
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
      setSessions(data);
    } catch (err) {
      console.error("Error fetching sessions:", err);
      setError(err.message);
      setSessions([]); // Clear sessions on error
    } finally {
      setIsLoading(false);
    }
  }, []); // Removed unnecessary dependencies

  useEffect(() => {
    fetchSessions();
  }, [fetchSessions]);

  // --- Handle click on a session item --- 
  const handleSessionClick = async (threadId) => {
    // Prevent loading if deleting or already loading
    if (loadingSessionId || deletingSessionId === threadId) return; 

    console.log(`Attempting to load session: ${threadId}`);
    setLoadingSessionId(threadId);
    setSessionLoadError(null); // Clear previous load errors
    setDeleteError(null); // Clear delete errors

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
      onSelectSession(loadedSessionData);
    } catch (err) {
      console.error("Error loading session:", err);
      setSessionLoadError(`Failed to load session ${threadId}: ${err.message}`);
    } finally {
      setLoadingSessionId(null); // Clear loading state 
    }
  };
  
  // --- NEW: Handle Deleting a Session --- 
  const handleDeleteSession = async (threadId, event) => {
    event.stopPropagation(); // Prevent the click from triggering handleSessionClick
    
    // Prevent deleting if already deleting another or loading this one
    if (deletingSessionId || loadingSessionId === threadId) return;

    // Optional: Confirm deletion
    if (!window.confirm(`Are you sure you want to delete session ${threadId}? This cannot be undone.`)) {
        return;
    }

    console.log(`Attempting to delete session: ${threadId}`);
    setDeletingSessionId(threadId); // Mark this session as being deleted
    setDeleteError(null); // Clear previous delete errors
    setSessionLoadError(null); // Clear load errors

    try {
        const response = await fetch(`${API_BASE_URL}/api/v1/chat/session/${threadId}`, {
            method: 'DELETE',
        });

        if (!response.ok) {
            let errorMsg = `Failed to delete session ${threadId} (status: ${response.status})`;
            try {
                const errorData = await response.json();
                errorMsg = errorData.detail || errorMsg;
            } catch (parseError) { /* Ignore if response body isn't JSON */ }
            throw new Error(errorMsg);
        }

        // On successful deletion, remove the session from the list state
        setSessions(prevSessions => prevSessions.filter(session => session.thread_id !== threadId));
        console.log(`Session ${threadId} deleted successfully.`);
        // Optionally show a success message briefly?

    } catch (err) {
        console.error("Error deleting session:", err);
        setDeleteError(`Failed to delete session ${threadId}: ${err.message}`);
        // Keep the item in the list on error, but show the error message
    } finally {
        setDeletingSessionId(null); // Clear deleting state
    }
  };

  // --- Format title or ID for display --- 
  const formatSessionDisplay = (session) => {
    if (session.title && session.title.trim() !== '') {
        return { title: session.title, id: session.thread_id };
    }
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
      {error && <p className="error-message">List Error: {error}</p>}
      {/* Display specific errors near the top for clarity */}
      {sessionLoadError && <p className="error-message">Load Error: {sessionLoadError}</p>}
      {deleteError && <p className="error-message">Delete Error: {deleteError}</p>}
      
      {!isLoading && !error && sessions.length === 0 && (
        <p>No saved sessions found.</p>
      )}
      {!isLoading && !error && sessions.length > 0 && (
        <ul className="saved-chats-list">
          {sessions.map((session) => {
            const display = formatSessionDisplay(session);
            const isThisLoading = loadingSessionId === session.thread_id;
            const isThisDeleting = deletingSessionId === session.thread_id;
            
            return (
              // Add is-loading/is-deleting classes for potential styling
              <li 
                key={session.thread_id} 
                className={`session-item ${isThisLoading ? 'is-loading' : ''} ${isThisDeleting ? 'is-deleting' : ''}`}
                onClick={!isThisDeleting ? () => handleSessionClick(session.thread_id) : undefined} // Prevent click if deleting
                title={`ID: ${session.thread_id}`}
              >
                <div className="session-info"> {/* Wrap text content */}
                  {isThisLoading && <strong>Loading...</strong>}
                  {isThisDeleting && <strong>Deleting...</strong>} 
                  {!isThisLoading && !isThisDeleting && <strong>{display.title}</strong>}
                  
                  {/* Optionally show ID if title is different and not loading/deleting */}
                  {!isThisLoading && !isThisDeleting && display.title !== display.id && <span>{display.id}</span>}
                </div>
                {/* --- NEW: Delete Button --- */}
                <button
                    className="delete-session-button"
                    onClick={(e) => handleDeleteSession(session.thread_id, e)}
                    disabled={isThisDeleting || !!deletingSessionId || isThisLoading} // Disable if this or any other is deleting, or if this is loading
                    title={`Delete session ${session.thread_id}`}
                >
                    &#x2715; {/* Unicode multiplication sign 'X' */}
                </button>
                {/* ------------------------ */}
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