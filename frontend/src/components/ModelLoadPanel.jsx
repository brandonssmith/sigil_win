import React, { useState } from 'react';
import { API_BASE_URL } from '../constants'; // Import shared constant

// Base API URL - Moved to constants.js
// const API_BASE_URL = 'http://localhost:8000';

// --- Model Load Panel Component ---
function ModelLoadPanel({
  onModelLoadStatusChange // New callback prop
}) {
  const [modelPathInput, setModelPathInput] = useState(''); // Input field value
  const [modelLoadStatus, setModelLoadStatus] = useState('idle'); // 'idle' | 'loading' | 'loaded' | 'error'
  const [modelLoadError, setModelLoadError] = useState(null); // Error message for model load

  const isLoading = modelLoadStatus === 'loading';
  const isLoaded = modelLoadStatus === 'loaded';

  // Handler for loading the model (Moved from App.jsx)
  const handleLoadModel = async () => {
    setModelLoadStatus('loading');
    setModelLoadError(null);
    onModelLoadStatusChange('loading'); // Notify parent
    const path = modelPathInput.trim();
    if (!path) {
      setModelLoadError('Model path cannot be empty.');
      setModelLoadStatus('error');
      onModelLoadStatusChange('error'); // Notify parent
      return;
    }

    try {
      const response = await fetch(`${API_BASE_URL}/api/v1/model/load`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ path: path }), // Send the path
      });

      const data = await response.json(); // Always try to parse JSON

      if (!response.ok) {
        // Use detail from JSON if available, otherwise statusText
        throw new Error(data.detail || `HTTP error! status: ${response.status}`);
      }

      console.log("Load model response:", data);
      setModelLoadStatus('loaded');
      onModelLoadStatusChange('loaded'); // Notify parent

    } catch (err) {
       console.error('Failed to load model:', err);
       setModelLoadError(err.message || 'An unknown error occurred');
       setModelLoadStatus('error');
       onModelLoadStatusChange('error'); // Notify parent
    }
  };

  return (
    <div className="model-load-panel settings-group"> {/* Reusing settings-group style */}
      <label htmlFor="model-path">Model Path:</label>
      <input
        type="text"
        id="model-path"
        value={modelPathInput}
        onChange={(e) => setModelPathInput(e.target.value)}
        placeholder="e.g., ./models/tinyllama or /path/to/model"
        disabled={isLoading || isLoaded} // Disable input after load
      />
      <button onClick={handleLoadModel} disabled={isLoading || isLoaded || !modelPathInput.trim()}>
        {isLoading ? 'Loading Model...' : isLoaded ? 'Model Loaded' : 'Load Model'}
      </button>
      {modelLoadStatus === 'error' && <p className="error-message">Load failed: {modelLoadError}</p>}
      {isLoaded && <p className="success-message">Model loaded successfully!</p>}
    </div>
  );
}

export default ModelLoadPanel; 