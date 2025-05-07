import { useEffect, useCallback } from 'react';

export const useKeyboardShortcuts = ({
  onToggleSidebar,      // Callback to toggle sidebar visibility
  onClearChat,          // Callback to clear the chat
  onSubmitMessage,      // Callback to submit the current message
  isLoading,            // To prevent submitting message while loading
}) => {
  const handleKeyDown = useCallback((event) => {
    // Toggle Sidebar: Cmd + , or Ctrl + ,
    if ((event.metaKey || event.ctrlKey) && event.key === ',') {
      event.preventDefault();
      if (onToggleSidebar) onToggleSidebar();
      console.log("Toggled sidebar visibility via shortcut");
    }
    // Clear Chat: Ctrl + Shift + C
    else if (event.ctrlKey && event.shiftKey && event.key === 'C') {
      event.preventDefault();
      if (onClearChat) onClearChat();
      console.log("Clear Chat shortcut triggered");
    }
    // Submit on Enter (but not Shift+Enter)
    else if (event.key === 'Enter' && !event.shiftKey && !isLoading) {
      event.preventDefault();
      if (onSubmitMessage) onSubmitMessage();
      // console.log("Submit message shortcut triggered"); // Optional: for debugging
    }
  }, [onToggleSidebar, onClearChat, onSubmitMessage, isLoading]);

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);

    // Cleanup function to remove the event listener
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [handleKeyDown]); // Re-run effect if handleKeyDown changes (due to its dependencies)

  // This hook doesn't need to return anything as it only sets up an event listener
}; 