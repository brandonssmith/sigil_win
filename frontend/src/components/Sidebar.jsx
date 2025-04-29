import React from 'react';
import PropTypes from 'prop-types';
import CombinedPanel from './panels/CombinedPanel.jsx'; // Adjust path as necessary
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
  onChatModeChange,
  themeName,
  setThemeName,
  themeList,
  onHfUsernameUpdate,
  onDeviceUpdate,
  currentDevice,
  onClearChat
}) => {
  // Determine the class name based on the isOpen prop for styling
  const sidebarClassName = `sidebar ${isOpen ? 'open' : 'closed'}`;

  return (
    <div className={sidebarClassName}>
      <div className="sidebar-content">
        {/* Only render the content if the sidebar is open */}
        {isOpen && (
          <CombinedPanel
            // Pass all the necessary props down to CombinedPanel
            modelLoaded={modelLoaded}
            setLoadStatus={setLoadStatus}
            setLoading={setLoading}
            isLoading={isLoading}
            currentModelPath={currentModelPath}
            isModelLoaded={isModelLoaded !== undefined ? isModelLoaded : modelLoaded} // Handle potential alias
            onChatModeChange={onChatModeChange}
            themeName={themeName}
            setThemeName={setThemeName}
            themeList={themeList}
            onHfUsernameUpdate={onHfUsernameUpdate}
            onDeviceUpdate={onDeviceUpdate}
            currentDevice={currentDevice}
            onClearChat={onClearChat}
          />
        )}
      </div>
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
  onChatModeChange: PropTypes.func.isRequired,
  themeName: PropTypes.string.isRequired,
  setThemeName: PropTypes.func.isRequired,
  themeList: PropTypes.array.isRequired,
  onHfUsernameUpdate: PropTypes.func.isRequired,
  onDeviceUpdate: PropTypes.func.isRequired,
  currentDevice: PropTypes.oneOf(['cuda', 'cpu', null]),
  onClearChat: PropTypes.func.isRequired
};

export default Sidebar; 