import React, { useState, useEffect } from 'react';
import {
  API_BASE_URL,
  DEFAULT_SYSTEM_PROMPT,
  DEFAULT_TEMPERATURE,
  DEFAULT_TOP_P,
  DEFAULT_MAX_TOKENS
} from '../constants'; // Import shared constants

// Settings Panel Component
function SettingsPanel({
    modelLoaded // Only need to know if the model is loaded to enable/disable
 }) {
  // State moved from App.jsx
  const [systemPrompt, setSystemPrompt] = useState(DEFAULT_SYSTEM_PROMPT);
  const [temperature, setTemperature] = useState(DEFAULT_TEMPERATURE);
  const [topP, setTopP] = useState(DEFAULT_TOP_P);
  const [maxTokens, setMaxTokens] = useState(DEFAULT_MAX_TOKENS);
  const [reloadStatus, setReloadStatus] = useState(null); // null | 'loading' | 'success' | 'error'
  const [applyError, setApplyError] = useState(null); // Specific error for settings apply

  const isLoading = reloadStatus === 'loading';

  // Handler for applying model settings (Moved from App.jsx)
  const handleApplySettings = async () => {
    setReloadStatus('loading');
    setApplyError(null);
    try {
      // Use the new endpoint path
      const response = await fetch(`${API_BASE_URL}/api/v1/settings/update`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ 
            system_prompt: systemPrompt,
            temperature: temperature,
            top_p: topP,
            max_new_tokens: maxTokens
        }),
      });

      const data = await response.json(); // Always try to parse JSON

      if (!response.ok) {
        throw new Error(data.detail || `HTTP error! status: ${response.status}`);
      }

      console.log("Apply settings response:", data);
      setReloadStatus('success');
       // Hide success message after a delay
      const timer = setTimeout(() => setReloadStatus(null), 2000);
      return () => clearTimeout(timer);

    } catch (err) {
       console.error('Failed to apply model settings:', err);
       setApplyError(`Apply settings failed: ${err.message}`); // Set specific error
       setReloadStatus('error');
       // Hide error message after a delay
      const timer = setTimeout(() => setReloadStatus(null), 3000);
      return () => clearTimeout(timer);
    }
  };

  // Effect to clear success/error messages
  useEffect(() => {
    let timer;
    if (reloadStatus === 'success') {
      timer = setTimeout(() => setReloadStatus(null), 2000);
    } else if (reloadStatus === 'error') {
      timer = setTimeout(() => setReloadStatus(null), 3000);
    }
    return () => clearTimeout(timer);
  }, [reloadStatus]);

  return (
    <div className="settings-panel">
      <h2>Settings</h2>
      <div className="settings-group">
        <label htmlFor="system-prompt">System Prompt:</label>
        <textarea
          id="system-prompt"
          value={systemPrompt}
          onChange={(e) => setSystemPrompt(e.target.value)}
          rows={5}
          disabled={!modelLoaded} // Disable if model not loaded
        />
      </div>
      <div className="settings-group">
        <label htmlFor="temperature">Temperature:</label>
        <input
          type="number"
          id="temperature"
          value={temperature}
          onChange={(e) => setTemperature(parseFloat(e.target.value) || 0)}
          min="0"
          max="2.0" // Match backend validation
          step="0.1"
          disabled={!modelLoaded} // Disable if model not loaded
        />
      </div>
       <div className="settings-group">
        <label htmlFor="top-p">Top P:</label>
        <input
          type="number"
          id="top-p"
          value={topP}
          onChange={(e) => setTopP(parseFloat(e.target.value) || 0)}
          min="0"
          max="1.0"
          step="0.05"
          disabled={!modelLoaded} // Disable if model not loaded
        />
      </div>
       <div className="settings-group">
        <label htmlFor="max-tokens">Max New Tokens:</label>
        <input
          type="number"
          id="max-tokens"
          value={maxTokens}
          onChange={(e) => setMaxTokens(parseInt(e.target.value, 10) || 1)}
          min="1"
          step="50"
          disabled={!modelLoaded} // Disable if model not loaded
        />
      </div>
      <button onClick={handleApplySettings} disabled={isLoading || !modelLoaded}>
        {isLoading ? 'Applying...' : 'Apply Settings'}
      </button>
      {reloadStatus === 'success' && <p className="success-message">Settings applied!</p>}
      {/* Display the specific applyError here */}
      {reloadStatus === 'error' && <p className="error-message">{applyError || 'Failed to apply settings.'}</p>}
    </div>
  );
}

export default SettingsPanel; 