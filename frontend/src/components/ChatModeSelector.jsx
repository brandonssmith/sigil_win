import React, { useState } from 'react';

// --- Chat Mode Selection Component --- (New)
function ChatModeSelector({ modelLoaded, onChatModeChange }) {
  // State moved from App.jsx
  const [chatMode, setChatMode] = useState('instruction'); // Default to instruction

  const handleModeChange = (newMode) => {
    setChatMode(newMode);
    onChatModeChange(newMode); // Notify parent of the change
  };

  return (
    <div className="settings-group chat-mode-selector">
      <label>Chat Mode:</label>
      <div className="radio-group">
        <label>
          <input
            type="radio"
            name="chatMode"
            value="instruction"
            checked={chatMode === 'instruction'}
            onChange={() => handleModeChange('instruction')}
            disabled={!modelLoaded}
          />
          Instruction
        </label>
        <label>
          <input
            type="radio"
            name="chatMode"
            value="chat"
            checked={chatMode === 'chat'}
            onChange={() => handleModeChange('chat')}
            disabled={!modelLoaded}
          />
          Chat
        </label>
      </div>
    </div>
  );
}

export default ChatModeSelector; 