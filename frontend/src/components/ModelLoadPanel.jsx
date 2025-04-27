import React, { useState, useEffect, useCallback } from 'react';
import PropTypes from 'prop-types';
import { API_BASE_URL } from '../constants'; // Import shared constant

// Base API URL - Moved to constants.js
// const API_BASE_URL = 'http://localhost:8000';

// --- Model Load Panel Component ---
function ModelLoadPanel({
  setLoadStatus,
  setLoading,
  isLoading,
  isModelLoaded,
  currentModelPath
}) {
  // State to hold the list of models fetched from the backend
  const [availableModels, setAvailableModels] = useState([]);
  const [fetchError, setFetchError] = useState(null); // State for fetch errors

  // NEW State for Hugging Face Token Status
  const [hfTokenStatus, setHfTokenStatus] = useState({ status: 'checking', username: null, message: null });

  // --- NEW: Search state for Hugging Face Hub ---
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchError, setSearchError] = useState(null);

  // --- NEW: State for specific download status ---
  const [downloadingModelId, setDownloadingModelId] = useState(null);
  const [downloadMessage, setDownloadMessage] = useState({ type: '', text: '' }); // { type: 'success'|'error', text: '...' }

  // --- Fetch Hugging Face Token Status --- (NEW)
  useEffect(() => {
    const fetchHfStatus = async () => {
      try {
        const response = await fetch(`${API_BASE_URL}/api/v1/models/token/status`);
        const data = await response.json();
        if (!response.ok) {
          throw new Error(data.message || data.detail || `HTTP error ${response.status}`);
        }
        setHfTokenStatus({ status: data.status, username: data.username, message: data.message });
      } catch (err) {
        console.error("Error fetching HF token status:", err);
        setHfTokenStatus({ status: 'error', username: null, message: err.message || 'Failed to fetch token status.' });
      }
    };
    fetchHfStatus();
  }, []); // Fetch only on component mount

  // --- Fetch Available Models (extract to reusable function) ---
  const fetchModels = useCallback(async () => {
    setFetchError(null);
    setLoading(true);
    try {
      const response = await fetch(`${API_BASE_URL}/models`);
      if (!response.ok) {
        throw new Error(`Failed to fetch model list (status: ${response.status})`);
      }
      const data = await response.json();
      if (Array.isArray(data)) {
        setAvailableModels(data);
      } else {
        throw new Error('Received unexpected data format for model list.');
      }
    } catch (err) {
      console.error('Error fetching model list:', err);
      setFetchError(err.message);
      setAvailableModels([]);
    } finally {
      setLoading(false);
    }
  }, [setLoading]);

  // Fetch models on mount and whenever fetchModels reference changes
  useEffect(() => {
    fetchModels();
  }, [fetchModels]);

  // Function to fetch model status on component mount
  const checkModelStatus = async () => {
    try {
      setLoading(true);
      const response = await fetch(`${API_BASE_URL}/api/v1/model/status`);
      if (!response.ok) throw new Error('Failed to fetch model status');
      const data = await response.json();
      if (data.loaded) {
        // Pass 'loaded' status and the model path (name)
        setLoadStatus('loaded', data.path);
      } else {
        // Pass 'idle' status when no model is loaded
        setLoadStatus('idle');
      }
    } catch (err) {
      console.error("Error checking model status:", err);
      // Pass 'error' status and an error message
      setLoadStatus('error', 'Error checking model status.');
    } finally {
      setLoading(false);
    }
  };

  // Check status on mount
  useEffect(() => {
    checkModelStatus();
  }, []);

  // --- Updated handleLoadModel --- 
  const handleLoadModel = async (modelName) => {
    if (!modelName) {
      setLoadStatus('error', 'Invalid model selected.'); // Use updated callback format
      return;
    }

    try {
      setLoading(true);
      // Use updated callback format for loading status
      setLoadStatus('loading', `Loading ${modelName}...`); 

      const response = await fetch(`${API_BASE_URL}/api/v1/model/load/${modelName}`, {
        method: "POST",
      });

      if (!response.ok) {
        let errorDetail = "Model load failed.";
        try {
          const errorData = await response.json();
          errorDetail = errorData.detail || `Model load failed (status: ${response.status})`;
        } catch (parseError) {
          console.error("Could not parse error response:", parseError);
        }
        throw new Error(errorDetail);
      }

      const result = await response.json();
      // Pass the status string and the model name separately to the handler in App.jsx
      setLoadStatus('loaded', modelName);
    } catch (err) {       
      console.error("Error loading model:", err);
      // Pass the 'error' status string and potentially the error message
      setLoadStatus('error', `Failed to load model: ${err.message}`); 
    } finally {
      // setLoading(false); // App.jsx handles main loading state, maybe remove here? Or keep for button disable?
      // Let's keep it for now to ensure button state is managed locally during the load attempt
       setLoading(false); 
    }
  };

  // Handler: perform model search
  const handleSearchModels = async (e) => {
    e.preventDefault();
    const trimmed = searchQuery.trim();
    if (!trimmed) return;
    setSearchLoading(true);
    setSearchError(null);
    setSearchResults([]);
    try {
      const resp = await fetch(`${API_BASE_URL}/api/v1/models/search?query=${encodeURIComponent(trimmed)}`);
      const data = await resp.json();
      if (!resp.ok) {
        throw new Error(data.detail || `Search failed (status ${resp.status})`);
      }
      setSearchResults(data);
    } catch (err) {
      console.error('Model search error:', err);
      setSearchError(err.message);
    } finally {
      setSearchLoading(false);
    }
  };

  // Handler: download model from search result
  const handleDownloadModel = async (modelId) => {
    if (!modelId || downloadingModelId) return; // Prevent multiple simultaneous downloads

    setDownloadingModelId(modelId); // Set which model is downloading
    setDownloadMessage({ type: '', text: '' }); // Clear previous message

    try {
      const resp = await fetch(`${API_BASE_URL}/api/v1/models/download`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ model_name: modelId })
      });
      const data = await resp.json();
      if (!resp.ok) {
        throw new Error(data.detail || `Download failed (status ${resp.status})`);
      }
      // Refresh local model list after successful download
      await fetchModels();
      // Set success message instead of alert
      setDownloadMessage({ type: 'success', text: data.message || `Successfully downloaded ${modelId}` });
    } catch (err) {
      console.error('Download error:', err);
      // Set error message instead of alert
      setDownloadMessage({ type: 'error', text: `Download error: ${err.message}` });
    } finally {
      setDownloadingModelId(null); // Clear downloading state
      // Optional: clear the message after a delay
      setTimeout(() => setDownloadMessage({ type: '', text: '' }), 5000); // Clear after 5s
    }
  };

  return (
    <div className="model-load-panel">
      <h3>Load Model</h3>

      {/* --- Display HF Token Status --- (NEW) */}
      <div className="hf-token-status" style={{ fontSize: '0.9em', marginBottom: '10px', opacity: 0.8 }}>
        {hfTokenStatus.status === 'checking' && (
          <span><small>Checking Hugging Face token...</small></span>
        )}
        {hfTokenStatus.status === 'valid' && hfTokenStatus.username && (
          <span style={{ color: 'var(--accent-color-success)' }}>✓ Logged in as: {hfTokenStatus.username}</span>
        )}
        {hfTokenStatus.status === 'invalid' && (
          <span style={{ color: 'var(--accent-color-warning)' }} title={hfTokenStatus.message || 'Token validation failed.'}>
             ⚠️ Invalid/Expired Token
          </span>
        )}
        {hfTokenStatus.status === 'not_found' && (
          <span title="Token not found in ~/.env">❔ Token Not Found</span>
        )}
         {hfTokenStatus.status === 'error' && (
          <span style={{ color: 'var(--accent-color-error)' }} title={hfTokenStatus.message || 'Error checking token.'}>
             ❌ Error Checking Token
          </span>
        )}
      </div>

      {/* --- Hugging Face Hub Search Section --- */}
      <form onSubmit={handleSearchModels} style={{ marginBottom: '10px' }}>
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Search Hugging Face Hub..."
          disabled={searchLoading}
          style={{ width: '70%', marginRight: '4px' }}
        />
        <button type="submit" disabled={searchLoading || !searchQuery.trim()}>Search</button>
      </form>
      {/* --- Display Download Status Message --- (NEW) */}
      {downloadMessage.text && (
        <p style={{ color: downloadMessage.type === 'error' ? 'var(--accent-color-error)' : 'var(--accent-color-success)', fontSize: '0.9em', marginTop: '-5px', marginBottom: '10px' }}>
          {downloadMessage.text}
        </p>
      )}

      {searchLoading && <p>Searching...</p>}
      {searchError && <p className="error-message">Search error: {searchError}</p>}
      {searchResults.length > 0 && (
        <div className="search-results" style={{ maxHeight: '200px', overflowY: 'auto', marginBottom: '12px' }}>
          {searchResults.map((res) => (
            <div key={res.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
              <span style={{ fontSize: '0.85em' }}>{res.id}</span>
              <button
                onClick={() => handleDownloadModel(res.id)}
                // Disable if this specific model is downloading, OR if any other download is in progress, OR if search is happening
                disabled={downloadingModelId === res.id || (downloadingModelId !== null && downloadingModelId !== res.id) || searchLoading}
              >
                {downloadingModelId === res.id ? 'Downloading...' : 'Download'}
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Existing local model list UI */}
      {fetchError && (
        <p className="error-message">Error fetching models: {fetchError}</p>
      )}
      <div className="model-list">
        {availableModels.length > 0 ? (
          availableModels.map((model) => (
            <button
              key={model}
              onClick={() => handleLoadModel(model)}
              disabled={(isModelLoaded && currentModelPath === model) || isLoading}
              className="model-load-button"
            >
              Load {model}
            </button>
          ))
        ) : (
          !fetchError && <p>{isLoading ? 'Loading model list...' : 'No models found.'}</p>
        )}
      </div>
    </div>
  );
}

ModelLoadPanel.propTypes = {
  setLoadStatus: PropTypes.func.isRequired,
  setLoading: PropTypes.func.isRequired,
  isLoading: PropTypes.bool.isRequired,
  isModelLoaded: PropTypes.bool.isRequired,
  currentModelPath: PropTypes.string, 
};

export default ModelLoadPanel; 