import React from 'react';
import PropTypes from 'prop-types';
import CombinedPanel from './panels/CombinedPanel.jsx'; // Path remains the same after restructure
// import SavedChatsPanel from './SavedChatsPanel'; // No longer needed here
import './Sidebar.css'; // We'll create this file for styling

const Sidebar = ({
  isOpen,
  // Pass down all the props needed by CombinedPanel (copied from PanelHost/App)
  modelLoaded,
  setLoadStatus,
  setLoading,
  isLoading,
  currentModelPath,
  isModelLoaded, // CombinedPanel might expect this alias
  themeName,
  setThemeName,
  themeList,
  onHfUsernameUpdate,
  onDeviceUpdate,
  currentDevice,
  onClearChat,
  onLoadSession, // <-- ADDED: Receive onLoadSession prop
  // --- ADDED: Receive loadedSessionSettings prop ---
  loadedSessionSettings,
  onTabRename, // <-- ADDED: Receive onTabRename prop
  // --- NEW: Props for new chat settings logic ---
  activeTabId,
  newChatSettings,
  onNewChatSettingsChange,
  onSessionSettingsChange,
}) => {
  // Determine the class name based on the isOpen prop for styling
  const sidebarClassName = `sidebar ${isOpen ? 'open' : 'closed'}`;

  return (
    <div className={sidebarClassName}>
      {/* Restore the single content container */}
      <div className="sidebar-content">
        {isOpen && (
          <CombinedPanel
            // Pass all the necessary props down to CombinedPanel
            modelLoaded={modelLoaded}
            setLoadStatus={setLoadStatus}
            setLoading={setLoading}
            isLoading={isLoading}
            currentModelPath={currentModelPath}
            isModelLoaded={isModelLoaded !== undefined ? isModelLoaded : modelLoaded} // Handle potential alias
            themeName={themeName}
            setThemeName={setThemeName}
            themeList={themeList}
            onHfUsernameUpdate={onHfUsernameUpdate}
            onDeviceUpdate={onDeviceUpdate}
            currentDevice={currentDevice}
            onClearChat={onClearChat}
            onLoadSession={onLoadSession} // Pass onLoadSession down
            // --- ADDED: Pass loadedSessionSettings down ---
            loadedSessionSettings={loadedSessionSettings}
            onTabRename={onTabRename} // <-- ADDED: Pass onTabRename down
            // --- ADDED: Pass new chat settings props ---
            activeTabId={activeTabId}
            newChatSettings={newChatSettings}
            onNewChatSettingsChange={onNewChatSettingsChange}
            // --- ADDED: Pass settings change handler ---
            onSessionSettingsChange={onSessionSettingsChange}
          />
        )}
      </div>
      {/* REMOVED the separate divs for main/saved-chats */}
    </div>
  );
};

// Define PropTypes for the Sidebar component
Sidebar.propTypes = {
  isOpen: PropTypes.bool.isRequired,
  modelLoaded: PropTypes.bool.isRequired,
  setLoadStatus: PropTypes.func.isRequired,
  setLoading: PropTypes.func.isRequired,
  isLoading: PropTypes.bool.isRequired,
  currentModelPath: PropTypes.string, // Can be null initially
  isModelLoaded: PropTypes.bool, // Optional alias prop
  themeName: PropTypes.string.isRequired,
  setThemeName: PropTypes.func.isRequired,
  themeList: PropTypes.array.isRequired,
  onHfUsernameUpdate: PropTypes.func.isRequired,
  onDeviceUpdate: PropTypes.func.isRequired,
  currentDevice: PropTypes.oneOf(['cuda', 'cpu', null]),
  onClearChat: PropTypes.func.isRequired,
  onLoadSession: PropTypes.func.isRequired, // <-- ADDED: PropType for onLoadSession
  // --- ADDED: PropType for loadedSessionSettings ---
  loadedSessionSettings: PropTypes.shape({
    systemPrompt: PropTypes.string,
    temperature: PropTypes.number,
    topP: PropTypes.number,
    maxTokens: PropTypes.number,
  }), // Can be null
  onTabRename: PropTypes.func.isRequired, // <-- ADDED: PropType for onTabRename
  // --- ADDED: PropTypes for new chat settings logic ---
  activeTabId: PropTypes.string.isRequired,
  newChatSettings: PropTypes.shape({
    systemPrompt: PropTypes.string.isRequired,
    temperature: PropTypes.number.isRequired,
    topP: PropTypes.number.isRequired,
    maxTokens: PropTypes.number.isRequired,
  }).isRequired,
  onNewChatSettingsChange: PropTypes.func.isRequired,
  // --- ADDED: PropType for session settings change handler ---
  onSessionSettingsChange: PropTypes.func.isRequired,
};

export default Sidebar; 