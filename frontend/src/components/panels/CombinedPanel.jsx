import React, { useState } from 'react';
import SettingsPanel from './SettingsPanel.jsx';
import ModelLoadPanel from '../ModelLoadPanel.jsx';
import ChatModeSelector from '../ChatModeSelector.jsx';

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
      themeList
  } = props;
  
  const [activeTab, setActiveTab] = useState('settings'); // 'settings', 'modelLoad', or 'interface'

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
      </div>
    </div>
  );
};

export default CombinedPanel; 