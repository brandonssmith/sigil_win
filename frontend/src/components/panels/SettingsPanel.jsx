import React, { useState, useEffect } from 'react';
import {
  API_BASE_URL,
  DEFAULT_SYSTEM_PROMPT,
  DEFAULT_TEMPERATURE,
  DEFAULT_TOP_P,
  DEFAULT_MAX_TOKENS
} from '../../constants'; // Import shared constants
import PropTypes from 'prop-types';
import './SettingsPanel.css'; // Import component styles

// Default settings object for convenience
const DEFAULTS = {
  SYSTEM_PROMPT: DEFAULT_SYSTEM_PROMPT,
  TEMPERATURE: DEFAULT_TEMPERATURE,
  TOP_P: DEFAULT_TOP_P,
  MAX_TOKENS: DEFAULT_MAX_TOKENS
};

// Settings Panel Component
function SettingsPanel({
    modelLoaded, // Only need to know if the model is loaded to enable/disable
    // config, // Removed - managing state internally or via loadedSessionSettings
    // onConfigChange, // Removed
    // onReloadModel, // Removed - No model reload button here
    // reloadStatus, // Removed
    onClearChat, // Keep for the clear chat button
    // --- ADDED: Accept loaded settings prop ---
    loadedSessionSettings
 }) {
  // State for settings inputs
  const [systemPrompt, setSystemPrompt] = useState(DEFAULTS.SYSTEM_PROMPT);
  const [temperature, setTemperature] = useState(DEFAULTS.TEMPERATURE);
  const [topP, setTopP] = useState(DEFAULTS.TOP_P);
  const [maxTokens, setMaxTokens] = useState(DEFAULTS.MAX_TOKENS);
  
  const [applyStatus, setApplyStatus] = useState(null); // null | 'loading' | 'success' | 'error'
  const [applyError, setApplyError] = useState(null);
  
  // REMOVED: Initial fetch status state
  // const [initialFetchStatus, setInitialFetchStatus] = useState('idle'); 

  const isLoading = applyStatus === 'loading';

  // REMOVED: useEffect for fetching current settings on mount
  // useEffect(() => { ... fetch logic ... }, [modelLoaded, initialFetchStatus]);

  // --- ADDED: useEffect to update inputs based on loaded session settings ---
  useEffect(() => {
    if (loadedSessionSettings) {
      // A session tab is active, apply its settings
      console.log("SettingsPanel: Applying loaded settings", loadedSessionSettings);
      setSystemPrompt(loadedSessionSettings.systemPrompt ?? DEFAULTS.SYSTEM_PROMPT);
      setTemperature(loadedSessionSettings.temperature ?? DEFAULTS.TEMPERATURE);
      setTopP(loadedSessionSettings.topP ?? DEFAULTS.TOP_P);
      setMaxTokens(loadedSessionSettings.maxTokens ?? DEFAULTS.MAX_TOKENS);
    } else {
      // "New Chat" tab is active, revert to defaults
      console.log("SettingsPanel: Reverting to default settings");
      setSystemPrompt(DEFAULTS.SYSTEM_PROMPT);
      setTemperature(DEFAULTS.TEMPERATURE);
      setTopP(DEFAULTS.TOP_P);
      setMaxTokens(DEFAULTS.MAX_TOKENS);
    }
  }, [loadedSessionSettings]); // Re-run whenever the loaded settings prop changes
  // --- END: useEffect for loaded settings ---

  // Handler for applying model settings (Updates backend with current UI values)
  const handleApplySettings = async () => {
    setApplyStatus('loading');
    setApplyError(null);
    try {
      const response = await fetch(`${API_BASE_URL}/api/v1/settings/update`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ 
            // Send values currently displayed in the UI
            system_prompt: systemPrompt,
            temperature: temperature,
            top_p: topP,
            max_new_tokens: maxTokens
        }),
      });
      // ... (rest of fetch logic: check response, set status, handle errors) ...
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.detail || `HTTP error! status: ${response.status}`);
      }
      console.log("Apply settings response:", data);
      setApplyStatus('success');
    } catch (err) {
       console.error('Failed to apply model settings:', err);
       setApplyError(`Apply settings failed: ${err.message}`);
       setApplyStatus('error');
    }
  };

  // Effect to clear success/error messages
  useEffect(() => {
    let timer;
    if (applyStatus === 'success') {
      timer = setTimeout(() => setApplyStatus(null), 2000);
    } else if (applyStatus === 'error') {
      timer = setTimeout(() => setApplyStatus(null), 3000);
    }
    return () => clearTimeout(timer);
  }, [applyStatus]);

  // Disable form elements if applying changes
  const isDisabled = !modelLoaded || isLoading;

  return (
    <div className="settings-panel">
      <h2>Settings</h2>
      {/* Input fields remain the same, but their values are now controlled by state updated via props */}
      <div className="settings-group">
        <label htmlFor="system-prompt">System Prompt:</label>
        <textarea
          id="system-prompt"
          value={systemPrompt}
          onChange={(e) => setSystemPrompt(e.target.value)}
          rows={5}
          disabled={isDisabled}
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
          disabled={isDisabled}
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
          disabled={isDisabled}
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
          disabled={isDisabled}
        />
      </div>
      <button onClick={handleApplySettings} disabled={isDisabled}>
        {isLoading ? 'Applying...' : 'Apply Settings'}
      </button>
      {applyStatus === 'success' && <p className="success-message">Settings applied!</p>}
      {applyStatus === 'error' && <p className="error-message">{applyError || 'Failed to apply settings.'}</p>}

      {/* Clear Chat Button */}
      <button 
        onClick={onClearChat} 
        className="clear-chat-button-settings" 
        disabled={isLoading}
      >
        Clear Chat History
      </button>

    </div>
  );
}

SettingsPanel.propTypes = {
  modelLoaded: PropTypes.bool.isRequired,
  // Removed unused props
  // config: PropTypes.object.isRequired,
  // onConfigChange: PropTypes.func.isRequired,
  // onReloadModel: PropTypes.func.isRequired,
  // reloadStatus: PropTypes.string,
  onClearChat: PropTypes.func.isRequired,
  // --- ADDED: PropType for loadedSessionSettings ---
  loadedSessionSettings: PropTypes.shape({
    systemPrompt: PropTypes.string,
    temperature: PropTypes.number,
    topP: PropTypes.number,
    maxTokens: PropTypes.number,
  }), // Can be null
};

export default SettingsPanel; 