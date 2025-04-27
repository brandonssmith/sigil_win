// src/components/StatusBar.tsx
import React from 'react';

const StatusBar = ({
  userInfo,
  tokenStatus,
  generalMessage,
  messageType
}) => {
  return (
    <div className="status-bar">
      <div className="token-status">
        {tokenStatus === 'checking' && <span>Validating token...</span>}
        {tokenStatus === 'valid' && userInfo && (
          <span className="user-info success">
            {userInfo.avatarUrl && (
              <img 
                src={userInfo.avatarUrl} 
                alt={`${userInfo.username}'s avatar`} 
                className="user-avatar"
              />
            )}
            ✅ Welcome, {userInfo.username}!
          </span>
        )}
        {tokenStatus === 'invalid' && (
          <span className="error">⚠️ Invalid or missing Hugging Face token. Gated models unavailable.</span>
        )}
         {tokenStatus === 'missing' && (
          <span className="warning">ℹ️ No Hugging Face token found. Set one for private/gated models.</span>
        )}
      </div>
      {generalMessage && (
         <div className={`general-message ${messageType}`}>{generalMessage}</div>
      )}
    </div>
  );
};

export default StatusBar; 