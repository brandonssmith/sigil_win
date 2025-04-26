import React, { useState, useEffect } from 'react';
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

  // --- Fetch Available Models --- 
  useEffect(() => {
    const fetchModels = async () => {
      setFetchError(null); // Clear previous errors
      // We can use the setLoading prop from App.jsx to indicate loading here too
      setLoading(true); 
      try {
        const response = await fetch(`${API_BASE_URL}/models`); 
        if (!response.ok) {
          throw new Error(`Failed to fetch model list (status: ${response.status})`);
        }
        const data = await response.json();
        if (Array.isArray(data)) {
          setAvailableModels(data);
          console.log("Fetched models:", data);
        } else {
          console.error("Unexpected format for model list:", data);
          throw new Error("Received unexpected data format for model list.");
        }
      } catch (err) {
        console.error("Error fetching model list:", err);
        setFetchError(err.message); // Store fetch error message
        setAvailableModels([]); // Set to empty array on error
      } finally {
        setLoading(false); // Ensure loading is set to false
      }
    };
    fetchModels();
  }, [setLoading]); // Dependency array includes setLoading from props

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

  return (
    <div className="model-load-panel">
      <h3>Load Model</h3>
      {fetchError && (
        <p className="error-message">Error fetching models: {fetchError}</p>
      )}
      <div className="model-list">
        {/* Render buttons dynamically based on fetched models */}
        {availableModels.length > 0 ? (
          availableModels.map(model => (
            <button 
              key={model} 
              onClick={() => handleLoadModel(model)} 
              // Disable button if this model is already loaded OR if ANY model is currently loading
              disabled={(isModelLoaded && currentModelPath === model) || isLoading} 
              className="model-load-button"
            >
              Load {model}
            </button>
          ))
        ) : (
          !fetchError && <p>Loading model list...</p> // Show loading text if no error yet
        )}
        {/* Show message if list is empty after fetch (and no error) */}
        {availableModels.length === 0 && !fetchError && !isLoading && (
            <p>No models found in backend/models directory.</p>
        )}
      </div>
      {/* Input field removed */}
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