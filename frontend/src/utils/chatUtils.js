// Utility functions for chat operations

/**
 * Formats the chat history array for the backend API.
 * Filters out system messages and maps to the expected { role, content } structure.
 * @param {Array<Object>} history - The chat history array.
 * @returns {Array<Object>} The formatted history for the backend.
 */
export const formatChatHistoryForBackend = (history) => {
  return history
    .filter(msg => msg.sender === 'user' || msg.sender === 'backend') // Only user/backend messages
    .map(msg => ({
      role: msg.sender === 'user' ? 'user' : 'assistant',
      // Use the original 'content' field if available, otherwise fall back to 'text'
      // This handles both newly created messages and messages loaded from history
      content: msg.content !== undefined ? msg.content : msg.text 
    }));
}; 