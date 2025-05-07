import { useState, useCallback } from 'react';

export const useTabs = ({
  onClearChatRequest, // Callback to App.jsx to handle chat clearing logic
  onLoadSessionRequest, // Callback to App.jsx to handle loading session data
  NEW_CHAT_TAB_ID,      // Constant for the new chat tab ID
}) => {
  const [openTabs, setOpenTabs] = useState([{ id: NEW_CHAT_TAB_ID, label: 'New Chat', canClose: false }]);
  const [activeTabId, setActiveTabId] = useState(NEW_CHAT_TAB_ID);

  // Function for App.jsx to call after fetching saved sessions
  const loadInitialSessionTabs = useCallback((sessionTabsData) => {
    setOpenTabs([
      { id: NEW_CHAT_TAB_ID, label: 'New Chat', canClose: false },
      // Filter out NEW_CHAT_TAB_ID from sessionTabsData in case it's inadvertently included
      ...sessionTabsData.filter(st => st.id !== NEW_CHAT_TAB_ID) 
    ]);
    // Keep activeTabId as NEW_CHAT_TAB_ID by default on initial load
    // setActiveTabId(NEW_CHAT_TAB_ID); // Or logic to set to last opened tab if desired
  }, [setOpenTabs, NEW_CHAT_TAB_ID]);

  // Handler for selecting a tab
  const handleTabSelect = useCallback(async (tabId) => {
    if (tabId === activeTabId) return;
    
    setActiveTabId(tabId);

    if (tabId === NEW_CHAT_TAB_ID) {
      if (onClearChatRequest) {
        onClearChatRequest();
      }
    } else {
      if (onLoadSessionRequest) {
        await onLoadSessionRequest(tabId);
      }
    }
  }, [activeTabId, NEW_CHAT_TAB_ID, onClearChatRequest, onLoadSessionRequest, setActiveTabId]);

  // Handler for closing a tab
  const handleTabClose = useCallback(async (tabIdToClose) => {
    if (tabIdToClose === NEW_CHAT_TAB_ID) return; // Cannot close the "New Chat" tab

    const closingTabIndex = openTabs.findIndex(tab => tab.id === tabIdToClose);
    if (closingTabIndex === -1) {
      return; // Tab not found
    }

    let nextActiveTabIdToSet = activeTabId;
    let performClearChat = false;
    let sessionToLoad = null;

    // Determine the next active tab *before* filtering openTabs
    if (activeTabId === tabIdToClose) {
      // If the closed tab was active, decide which tab to activate next.
      // Prefer the tab to the left, otherwise fall back to "New Chat".
      // Assumes NEW_CHAT_TAB_ID is typically at index 0.
      if (closingTabIndex > 0 && openTabs[closingTabIndex - 1].id !== NEW_CHAT_TAB_ID) {
        nextActiveTabIdToSet = openTabs[closingTabIndex - 1].id;
        sessionToLoad = nextActiveTabIdToSet;
      } else {
        nextActiveTabIdToSet = NEW_CHAT_TAB_ID;
        performClearChat = true;
      }
    }

    const updatedTabs = openTabs.filter(tab => tab.id !== tabIdToClose);
    setOpenTabs(updatedTabs);

    // If the active tab needs to change as a result of the close
    if (nextActiveTabIdToSet !== activeTabId) {
      setActiveTabId(nextActiveTabIdToSet);
      if (performClearChat) {
        if (onClearChatRequest) onClearChatRequest();
      } else if (sessionToLoad) {
        if (onLoadSessionRequest) await onLoadSessionRequest(sessionToLoad);
      }
    } else if (activeTabId === tabIdToClose) {
      // This case handles if the active tab was closed, and it was the *only* session tab,
      // forcing a switch to "New Chat" if it wasn't already selected by the logic above.
      // This ensures that if all session tabs are closed, "New Chat" becomes active.
      if (updatedTabs.length === 1 && updatedTabs[0].id === NEW_CHAT_TAB_ID && activeTabId !== NEW_CHAT_TAB_ID) {
         setActiveTabId(NEW_CHAT_TAB_ID);
         if (onClearChatRequest) onClearChatRequest();
      }
    }
  }, [openTabs, activeTabId, NEW_CHAT_TAB_ID, onClearChatRequest, onLoadSessionRequest, setActiveTabId, setOpenTabs]);

  // Handler for renaming a tab
  const handleTabRename = useCallback((threadId, newName) => {
    setOpenTabs(prevTabs =>
      prevTabs.map(tab =>
        tab.id === threadId ? { ...tab, label: newName } : tab
      )
    );
  }, [setOpenTabs]);

  // Function to add a new session tab and make it active (called by App.jsx's sendMessage)
  const addSessionTabAndMakeActive = useCallback((newThreadId, newLabel, currentActiveTabForSendLogic) => {
    setOpenTabs(prevTabs => {
      let updatedTabs;
      // If the new session originated from the "New Chat" tab
      if (currentActiveTabForSendLogic === NEW_CHAT_TAB_ID) {
        const newChatTab = { id: NEW_CHAT_TAB_ID, label: 'New Chat', canClose: false };
        const existingSessionTabs = prevTabs.filter(tab => tab.id !== NEW_CHAT_TAB_ID);
        updatedTabs = [
          newChatTab, // Ensure "New Chat" tab is first
          ...existingSessionTabs,
          { id: newThreadId, label: newLabel, canClose: true }
        ];
      } else {
        // If the session didn't start from "New Chat" or if adding a tab for an existing session id
        if (prevTabs.some(tab => tab.id === newThreadId)) {
          // If tab exists, update its label (though renaming is usually explicit via handleTabRename)
          updatedTabs = prevTabs.map(tab => tab.id === newThreadId ? { ...tab, label: newLabel } : tab);
        } else {
          // Add as a new tab
          updatedTabs = [...prevTabs, { id: newThreadId, label: newLabel, canClose: true }];
        }
      }
      return updatedTabs;
    });
    setActiveTabId(newThreadId);
  }, [setOpenTabs, setActiveTabId, NEW_CHAT_TAB_ID]);

  // Function to reset tabs to initial "New Chat" state (called by App.jsx's handleClearChat)
  const resetTabsToDefault = useCallback(() => {
    setOpenTabs([{ id: NEW_CHAT_TAB_ID, label: 'New Chat', canClose: false }]);
    setActiveTabId(NEW_CHAT_TAB_ID);
  }, [setOpenTabs, setActiveTabId, NEW_CHAT_TAB_ID]);

  return {
    openTabs,
    activeTabId,
    handleTabSelect,
    handleTabClose,
    handleTabRename,
    loadInitialSessionTabs,
    addSessionTabAndMakeActive,
    resetTabsToDefault,
  };
}; 