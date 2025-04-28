import React, { useState } from 'react';
import SettingsPanel from './SettingsPanel.jsx';
import ModelLoadPanel from '../ModelLoadPanel.jsx';
import ChatModeSelector from '../ChatModeSelector.jsx';
import PropTypes from 'prop-types';

// This component receives all props needed by both SettingsPanel and ModelLoadPanel
const CombinedPanel = (props) => {
  const { 
      modelLoaded, 
      setLoadStatus, 
      setLoading, 
      isLoading, 
      currentModelPath,
      isModelLoaded, 
      onChatModeChange,
      themeName,
      setThemeName,
      themeList,
      onHfUsernameUpdate,
      onDeviceUpdate,
      currentDevice
  } = props;
  
  const [activeTab, setActiveTab] = useState('settings'); // 'settings', 'modelLoad', 'interface', or 'help'

  // Basic styling for tabs (can be improved later)
  const tabButtonStyle = (tabName) => ({
    padding: '8px 12px',
    border: '1px solid #444',
    borderBottom: activeTab === tabName ? 'none' : '1px solid #444',
    background: activeTab === tabName ? '#2a2a2a' : '#1e1e1e',
    color: activeTab === tabName ? '#eee' : '#aaa',
    cursor: 'pointer',
    marginRight: '5px',
    borderTopLeftRadius: '4px',
    borderTopRightRadius: '4px',
  });

  const panelContainerStyle = {
    border: '1px solid #444',
    borderTop: 'none',
    padding: '15px',
    background: '#2a2a2a', // Slightly different background for content area
    borderRadius: '0 0 4px 4px', // Round bottom corners
  };

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      {/* Tab Buttons */}
      <div style={{ flexShrink: 0 }}>
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
          style={tabButtonStyle('interface')}
          onClick={() => setActiveTab('interface')}
        >
          Interface
        </button>
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
        {activeTab === 'interface' && (
          <div>
            <ChatModeSelector 
              modelLoaded={modelLoaded}
              onChatModeChange={onChatModeChange}
            />
            <div className="settings-group" style={{ marginTop: '20px' }}>
              <label htmlFor="theme-select">Theme:</label>
              <select id="theme-select" value={themeName} onChange={e => setThemeName(e.target.value)}>
                {themeList.map(theme => (
                  <option key={theme} value={theme}>{theme}</option>
                ))}
              </select>
            </div>
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
  onChatModeChange: PropTypes.func.isRequired,
  themeName: PropTypes.string.isRequired,
  setThemeName: PropTypes.func.isRequired,
  themeList: PropTypes.array.isRequired,
  onHfUsernameUpdate: PropTypes.func.isRequired,
  onDeviceUpdate: PropTypes.func.isRequired,
  currentDevice: PropTypes.oneOf(['cuda', 'cpu', null])
};

export default CombinedPanel; 