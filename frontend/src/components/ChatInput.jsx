import React from 'react';

function ChatInput({
  userInput,
  setUserInput,
  handleSubmit,
  handleClearChat,
  isLoading,
  modelLoaded,
  chatHistoryLength // Renamed from chatHistory.length for clarity
}) {
  return (
    <div className="input-area"> {/* Added a wrapper div for styling/layout if needed */}
      {/* Clear Chat Button - Conditional rendering based on history length */}
      {chatHistoryLength > 0 && (
        <button
          onClick={handleClearChat}
          className="clear-chat-button"
          disabled={isLoading}
        >
          Clear Chat
        </button>
      )}

      {/* Input Form */}
      <form onSubmit={handleSubmit} className="input-bar">
        <input
          type="text"
          value={userInput}
          onChange={(e) => setUserInput(e.target.value)}
          placeholder={modelLoaded ? "Type your message..." : "Load model first..."}
          disabled={isLoading || !modelLoaded}
          aria-label="Chat message input"
        />
        <button type="submit" disabled={isLoading || !modelLoaded}>
          Send
        </button>
      </form>
    </div>
  );
}

export default ChatInput; 