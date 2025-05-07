import React, { useState, useEffect } from 'react';
import SettingsPanel from './SettingsPanel';
import ModelLoadPanel from './ModelLoadPanel';
import PrecisionSettingsPanel from './PrecisionSettingsPanel';
import SavedChatsPanel from './SavedChatsPanel';
import PropTypes from 'prop-types';
import ModeToggleSwitch from '../../ui/ModeToggleSwitch';

// This component receives all props needed by both SettingsPanel and ModelLoadPanel
const CombinedPanel = (props) => {
  const { 
      modelLoaded, 
      setLoadStatus, 
      setLoading, 
      isLoading, 
      currentModelPath,
      isModelLoaded,
      themeName,
      setThemeName,
      themeList,
      onHfUsernameUpdate,
      onDeviceUpdate,
      currentDevice,
      onClearChat,
      onLoadSession,
      loadedSessionSettings,
      onTabRename,
      activeTabId,
      newChatSettings,
      onNewChatSettingsChange,
      onSessionSettingsChange,
  } = props;
  
  const [activeTab, setActiveTab] = useState('settings'); // 'settings', 'modelLoad', 'interface', 'precision', or 'help'

  // --- NEW: State for Light/Dark Mode ---
  const [colorMode, setColorMode] = useState('dark'); // Default to 'dark'

  // --- NEW: Effect to apply mode class to body ---
  useEffect(() => {
    document.body.classList.remove('light-mode', 'dark-mode'); // Clear existing classes
    document.body.classList.add(`${colorMode}-mode`); // Add current mode class
  }, [colorMode]); // Re-run only when colorMode changes

  // Effect to switch tab if device changes away from CUDA
  useEffect(() => {
    if (currentDevice !== 'cuda' && activeTab === 'precision') {
      setActiveTab('settings'); // Switch back to default tab
    }
    // Dependency array includes currentDevice and activeTab to re-run when they change
  }, [currentDevice, activeTab]);

  // Basic styling for tabs (can be improved later)
  const tabButtonStyle = (tabName) => ({
    padding: '6px 10px',
    border: '1px solid var(--border, #383838)',
    borderBottom: activeTab === tabName ? 'none' : '1px solid var(--border, #383838)',
    background: activeTab === tabName ? 'var(--panel-tab-active-bg)' : 'var(--panel-tab-bg)',
    color: activeTab === tabName ? 'var(--panel-tab-active-text)' : 'var(--panel-tab-text)',
    cursor: 'pointer',
    marginRight: '4px',
    borderTopLeftRadius: '5px',
    borderTopRightRadius: '5px',
  });

  const panelContainerStyle = {
    border: '1px solid var(--border, #383838)',
    borderTop: 'none',
    padding: '15px',
    background: 'var(--panel-container-bg)',
    borderRadius: '0 0 5px 5px',
  };

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      {/* Tab Buttons */}
      <div style={{ flexShrink: 0, display: 'flex', flexWrap: 'wrap' }}>
        <button
          style={tabButtonStyle('settings')}
          onClick={() => setActiveTab('settings')}
        >
          Settings
        </button>
        <button
          style={tabButtonStyle('modelLoad')}
          onClick={() => setActiveTab('modelLoad')}
        >
          Load Model
        </button>
        <button
          style={tabButtonStyle('savedChats')}
          onClick={() => setActiveTab('savedChats')}
        >
          Saved Chats
        </button>
        <button
          style={tabButtonStyle('interface')}
          onClick={() => setActiveTab('interface')}
        >
          Interface
        </button>
        {/* Conditionally render Precision tab button */}
        {currentDevice === 'cuda' && (
           <button
            style={tabButtonStyle('precision')}
            onClick={() => setActiveTab('precision')}
          >
            Precision
          </button>
        )}
        <button
          style={tabButtonStyle('help')}
          onClick={() => setActiveTab('help')}
        >
          Help
        </button>
      </div>

      {/* Tab Content Area */}
      <div style={{ ...panelContainerStyle, flexGrow: 1, overflowY: 'auto' }}>
        {activeTab === 'settings' && (
          // Render SettingsPanel, passing only the props it needs
          <SettingsPanel 
            modelLoaded={modelLoaded} 
            onClearChat={onClearChat}
            loadedSessionSettings={loadedSessionSettings}
            activeTabId={activeTabId}
            newChatSettings={newChatSettings}
            onNewChatSettingsChange={onNewChatSettingsChange}
            onSessionSettingsChange={onSessionSettingsChange}
          />
        )}
        {activeTab === 'modelLoad' && (
          // Render ModelLoadPanel, passing only the props it needs
          <ModelLoadPanel 
            setLoadStatus={setLoadStatus}
            setLoading={setLoading}
            isLoading={isLoading}
            isModelLoaded={isModelLoaded} // Use the destructured prop
            currentModelPath={currentModelPath}
            onHfUsernameUpdate={onHfUsernameUpdate}
            onDeviceUpdate={onDeviceUpdate}
            currentDevice={currentDevice}
          />
        )}
        {activeTab === 'savedChats' && (
          <SavedChatsPanel 
            onSelectSession={onLoadSession}
            onRenameSession={onTabRename}
          />
        )}
        {activeTab === 'interface' && (
          <div>
            {/* Theme Selection */}
            <div className="settings-group" style={{ marginTop: '0px', marginBottom: '20px' }}> {/* Adjusted margin */}
              <label htmlFor="theme-select">Theme:</label>
              <select 
                id="theme-select" 
                value={themeName} 
                onChange={e => setThemeName(e.target.value)}
                style={{
                  backgroundColor: 'var(--surface-input)',
                  color: 'var(--input-text-color)',
                  border: '1px solid var(--border-input)',
                  padding: '0.6rem 0.8rem',
                  borderRadius: 'var(--border-radius-small)',
                  width: '100%',
                  fontSize: '0.95rem', // Match other inputs
                  fontFamily: 'inherit',
                  cursor: 'pointer'
                }}
              >
                {themeList.map(theme => (
                  <option key={theme} value={theme}>{theme}</option>
                ))}
              </select>
            </div>

            {/* --- NEW: Light/Dark Mode Toggle --- */}
            <div className="settings-group" style={{ display: 'flex', alignItems: 'center', marginBottom: '20px' }}>
              <label htmlFor="mode-toggle" style={{ marginRight: '10px' }}>Mode:</label>
              <ModeToggleSwitch
                id="mode-toggle"
                isDarkMode={colorMode === 'dark'}
                onToggle={() => setColorMode(prevMode => prevMode === 'dark' ? 'light' : 'dark')}
              />
              <span style={{ marginLeft: '10px', textTransform: 'capitalize' }}>
                 {colorMode}
              </span>
            </div>
            {/* --- END NEW --- */}

            {/* ChatModeSelector removed, now controlled from header */}
            {/* Removed empty div */}
          </div>
        )}
        {activeTab === 'help' && (
          <div>
            <h4>Keyboard Shortcuts</h4>
            <ul>
              <li>
                <strong>Toggle Settings Panel:</strong> 
                <code>Cmd + ,</code> or <code>Ctrl + ,</code>
              </li>
              <li>
                <strong>Clear Chat:</strong> 
                <code>Ctrl + Shift + C</code>
              </li>
            </ul>
          </div>
        )}
        {/* Conditionally render PrecisionSettingsPanel */}
        {activeTab === 'precision' && currentDevice === 'cuda' && (
          <PrecisionSettingsPanel /> 
          // Assuming PrecisionSettingsPanel doesn't need specific props from CombinedPanel
          // If it does, pass them here.
        )}
      </div>
    </div>
  );
};

CombinedPanel.propTypes = {
  modelLoaded: PropTypes.bool.isRequired,
  setLoadStatus: PropTypes.func.isRequired,
  setLoading: PropTypes.func.isRequired,
  isLoading: PropTypes.bool.isRequired,
  currentModelPath: PropTypes.string,
  isModelLoaded: PropTypes.bool.isRequired,
  themeName: PropTypes.string.isRequired,
  setThemeName: PropTypes.func.isRequired,
  themeList: PropTypes.array.isRequired,
  onHfUsernameUpdate: PropTypes.func.isRequired,
  onDeviceUpdate: PropTypes.func.isRequired,
  currentDevice: PropTypes.oneOf(['cuda', 'cpu', null]),
  onClearChat: PropTypes.func.isRequired,
  onLoadSession: PropTypes.func.isRequired,
  loadedSessionSettings: PropTypes.shape({
    systemPrompt: PropTypes.string,
    temperature: PropTypes.number,
    topP: PropTypes.number,
    maxTokens: PropTypes.number,
  }),
  onTabRename: PropTypes.func.isRequired,
  activeTabId: PropTypes.string.isRequired,
  newChatSettings: PropTypes.shape({
    systemPrompt: PropTypes.string.isRequired,
    temperature: PropTypes.number.isRequired,
    topP: PropTypes.number.isRequired,
    maxTokens: PropTypes.number.isRequired,
  }).isRequired,
  onNewChatSettingsChange: PropTypes.func.isRequired,
  onSessionSettingsChange: PropTypes.func.isRequired,
};

export default CombinedPanel; 