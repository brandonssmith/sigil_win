import React from 'react';
import PropTypes from 'prop-types';
import './Tab.css'; // We'll create this for styling

function Tab({ label, onClick, isActive, onAuxClick, onClose }) {

  // Prevent default middle-click scroll behavior
  const handleAuxClick = (event) => {
    if (event.button === 1 && onAuxClick) { // Middle mouse button
      event.preventDefault();
      onAuxClick();
    }
  };

  // Handle regular click
  const handleClick = (event) => {
    // Only trigger onClick if it's not a middle-click or if onAuxClick isn't provided
    if (event.button !== 1 || !onAuxClick) {
      onClick();
    }
  };

  return (
    <div
      className={`tab ${isActive ? 'active' : ''}`}
      onClick={handleClick}
      onMouseDown={handleAuxClick} // Use onMouseDown for middle-click to prevent scroll icon
      title={label} // Show full label on hover
    >
      <span className="tab-label">{label}</span>
      {onClose && (
        <button
          className="tab-close-button"
          onClick={(e) => {
            e.stopPropagation(); // Prevent tab click when closing
            onClose();
          }}
          aria-label={`Close ${label} tab`}
        >
          &times; {/* Unicode multiplication sign for "x" */}
        </button>
      )}
    </div>
  );
}

Tab.propTypes = {
  label: PropTypes.string.isRequired,
  onClick: PropTypes.func.isRequired,
  isActive: PropTypes.bool.isRequired,
  onAuxClick: PropTypes.func, // Optional handler for middle-click (e.g., close tab)
  onClose: PropTypes.func, // Optional handler for close button
};

export default Tab; 