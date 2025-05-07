import React from 'react';
import PropTypes from 'prop-types';
import './ModeToggleSwitch.css';

function ModeToggleSwitch({ mode, onToggle, disabled }) {
  const isChat = mode === 'chat';

  const handleClick = () => {
    if (disabled) return;
    onToggle(isChat ? 'instruction' : 'chat');
  };

  return (
    <div
      className={`mode-toggle-switch ${disabled ? 'disabled' : ''}`}
      onClick={handleClick}
      title={isChat ? 'Switch to Instruction mode' : 'Switch to Chat mode'}
      role="button"
      aria-pressed={isChat}
    >
      <div className={`switch-track ${isChat ? 'chat' : 'instruction'}`}> 
        <span className="label instruction">I</span>
        <span className="label chat">C</span>
        <div className={`thumb ${isChat ? 'right' : 'left'}`}></div>
      </div>
    </div>
  );
}

ModeToggleSwitch.propTypes = {
  mode: PropTypes.oneOf(['instruction', 'chat']).isRequired,
  onToggle: PropTypes.func.isRequired,
  disabled: PropTypes.bool,
};

ModeToggleSwitch.defaultProps = {
  disabled: false,
};

export default ModeToggleSwitch; 