import React from 'react';
import PropTypes from 'prop-types';
import Tab from './Tab';
import './TabContainer.css'; // Styling for the container

function TabContainer({ tabs, activeTabId, onTabSelect, onTabClose }) {

  // Handler for closing a tab via middle-click or close button
  const handleClose = (tabId, event) => {
    if (event) event.stopPropagation(); // Prevent selection if clicking close button
    if (onTabClose) {
      onTabClose(tabId);
    }
  };

  return (
    <div className="tab-container">
      {tabs.map((tab) => (
        <Tab
          key={tab.id}
          label={tab.label}
          isActive={tab.id === activeTabId}
          onClick={() => onTabSelect(tab.id)}
          // Pass close handler for middle-click
          onAuxClick={tab.canClose ? () => handleClose(tab.id) : undefined} 
          // Pass close handler for the button if the tab is closable
          onClose={tab.canClose ? (e) => handleClose(tab.id, e) : undefined}
        />
      ))}
    </div>
  );
}

TabContainer.propTypes = {
  tabs: PropTypes.arrayOf(
    PropTypes.shape({
      id: PropTypes.string.isRequired, // Unique identifier for the tab
      label: PropTypes.string.isRequired, // Text displayed on the tab
      canClose: PropTypes.bool, // Whether the tab shows a close button / can be middle-clicked closed
    })
  ).isRequired,
  activeTabId: PropTypes.string.isRequired, // ID of the currently active tab
  onTabSelect: PropTypes.func.isRequired, // Function called when a tab is clicked
  onTabClose: PropTypes.func, // Function called when a tab close action is triggered (button or middle-click)
};

export default TabContainer; 