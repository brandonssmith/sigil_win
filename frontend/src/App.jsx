import { useState, useEffect, useRef, useCallback } from 'react';
import './App.css';
import ThemeLoader from './components/ThemeLoader.jsx';
import ModelLoadPanel from './components/ModelLoadPanel.jsx';
import ModeToggleSwitch from './components/ModeToggleSwitch.jsx';
import { formatChatHistoryForBackend } from './utils/chatUtils.js'; // Import the utility function
import { formatListText } from './utils/formatUtils.js'; // <-- Import the new list formatter
import { API_BASE_URL } from './constants.js'; // Import shared constants
import DeviceIndicator from './components/DeviceIndicator.jsx'; // <-- Import the new component
import Sidebar from './components/Sidebar.jsx'; // <-- Import the new Sidebar
import TabContainer from './components/Tabs/TabContainer.jsx'; // <-- ADDED: Import TabContainer

// Base API URL - Moved to constants.js
// const API_BASE_URL = 'http://localhost:8000';

// Default settings (could also fetch from backend on initial load)
const DEFAULT_SYSTEM_PROMPT = "You are a helpful assistant.";
const DEFAULT_TEMPERATURE = 0.7;
const DEFAULT_TEMPERATURE_CHAT = 0.7;
const DEFAULT_TOP_P = 0.95;
const DEFAULT_MAX_TOKENS = 1000;

// --- ADDED: Tab Constants ---
const NEW_CHAT_TAB_ID = '__NEW_CHAT__';

// Default settings - Store these to revert to when switching to "New Chat"
const DEFAULTS = {
  SYSTEM_PROMPT: "You are a helpful assistant.",
  TEMPERATURE: 0.7,
  // TEMPERATURE_CHAT: 0.7, // This seems unused now? Keep TEMPERTURE consistent.
  TOP_P: 0.95,
  MAX_TOKENS: 1000
};

// Message structure (implied):
// { sender: 'user' | 'backend' | 'system', text: string, id: string }

function App() {
  const [userInput, setUserInput] = useState('');
  const [chatHistory, setChatHistory] = useState([]); // Array of message objects
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null); // Error message string or null
  const messagesEndRef = useRef(null); // Ref for scrolling div
  const loadingMessageIdRef = useRef(null); // Ref to store loading message ID
  const [currentThreadId, setCurrentThreadId] = useState(null); // State for current chat session ID

  // --- ADDED: Tab State ---
  const [openTabs, setOpenTabs] = useState([
    { id: NEW_CHAT_TAB_ID, label: 'New Chat', canClose: false }
  ]);
  const [activeTabId, setActiveTabId] = useState(NEW_CHAT_TAB_ID);
  // --- END: Tab State ---

  // --- ADDED: State for currently loaded session settings ---
  // Holds null or { systemPrompt, temperature, topP, maxTokens }
  const [currentSessionSettings, setCurrentSessionSettings] = useState(null);
  // --- END: State for loaded settings ---

  // Settings State - Removed, managed within SettingsPanel
  // const [systemPrompt, setSystemPrompt] = useState(DEFAULT_SYSTEM_PROMPT);
  // const [temperature, setTemperature] = useState(DEFAULT_TEMPERATURE);
  // const [topP, setTopP] = useState(DEFAULT_TOP_P);
  // const [maxTokens, setMaxTokens] = useState(DEFAULT_MAX_TOKENS);
  // const [reloadStatus, setReloadStatus] = useState(null); // null | 'loading' | 'success' | 'error'

  // New Model Loading State - Removed, managed within ModelLoadPanel
  // const [modelPathInput, setModelPathInput] = useState(''); // Input field value
  // const [modelLoadStatus, setModelLoadStatus] = useState('idle'); // 'idle' | 'loading' | 'loaded' | 'error'
  // const [modelLoadError, setModelLoadError] = useState(null); // Error message for model load

  // --- Chat Mode State ---
  const initialChatMode = localStorage.getItem('chatMode') || 'instruction';
  const [appChatMode, setAppChatMode] = useState(initialChatMode); // 'instruction', 'chat'
  const [appModelLoadStatus, setAppModelLoadStatus] = useState('idle'); // 'idle', 'loading', 'loaded', 'error'

  // --- THEME STATE ---
  const [themeName, setThemeName] = useState('AlienBlood'); // Default theme
  const [themeList, setThemeList] = useState([]);

  const [currentLoadedModelName, setCurrentLoadedModelName] = useState(null);
  // const [showSettings, setShowSettings] = useState(true); // Consider removing if settings are only in sidebar
  const [hfUsername, setHfUsername] = useState(null); // <-- NEW: State for username
  const [currentDevice, setCurrentDevice] = useState(null); // <-- NEW: State for device (cuda/cpu)
  const [isSidebarOpen, setIsSidebarOpen] = useState(true); // <-- ADDED: Sidebar state

  // --- Define Callbacks First ---
  // Moved handleClearChat definition UP
  const handleClearChat = useCallback(() => {
    setChatHistory([]);
    setError(null); // Also clear any existing errors
    setCurrentThreadId(null); // Reset thread ID on clear
    setActiveTabId(NEW_CHAT_TAB_ID); // Switch back to New Chat tab
    // --- ADDED: Clear loaded session settings ---
    setCurrentSessionSettings(null); // Revert to defaults when clearing
    // --- END ---
    // Ensure only one "New Chat" tab remains if others were closed
    setOpenTabs(prevTabs => [
      { id: NEW_CHAT_TAB_ID, label: 'New Chat', canClose: false },
      ...prevTabs.filter(tab => tab.id !== NEW_CHAT_TAB_ID && tab.canClose) // Keep existing closable tabs
    ]);
    console.log("Chat cleared, thread ID reset, settings reverted to default, and switched to New Chat tab.");
  }, []); // Dependencies: setChatHistory, setError, setCurrentThreadId, setActiveTabId, setCurrentSessionSettings, setOpenTabs (stable)

  const handleModelLoadStatusChange = (status, modelName = null) => {
    // Clear previous errors when starting to load or if load is successful
    if (status === 'loading' || status === 'loaded') {
      setError(null);
    }
    // Update the main status
    setAppModelLoadStatus(status);

    // If loaded successfully, store the model name
    if (status === 'loaded' && modelName) {
      setCurrentLoadedModelName(modelName);
      console.log(`App: Model '${modelName}' loaded successfully.`);
    } else if (status !== 'loaded') {
      // Clear the name if not loaded (e.g., error, idle, loading)
      setCurrentLoadedModelName(null);
    }
  };

  const handleHfUsernameUpdate = useCallback((username) => {
      setHfUsername(username);
  }, []);

  const handleDeviceUpdate = useCallback((device) => {
    setCurrentDevice(device);
  }, []);

  const handleChatModeChange = (mode) => {
    setAppChatMode(mode);
    localStorage.setItem('chatMode', mode);
    // Clearing chat on mode change might be disruptive with tabs, removing for now.
    // handleClearChat(); // Maybe revisit this decision later
  };

  // --- ADDED: Handler for loading a selected session ---
  // This callback is passed down and called by SavedChatsPanel (or other components)
  // when a specific session needs to be loaded into the main view.
  const handleLoadSession = useCallback((sessionData) => {
      // Validate sessionData structure (basic check)
      if (!sessionData || !sessionData.thread_id || !sessionData.messages) {
          console.error("App: Attempted to load invalid session data:", sessionData);
          setError("Invalid session data received.");
          return; // Prevent further processing
      }

      console.log(`App: Loading session ${sessionData.thread_id}`);

      // --- Update App State ---
      // --- FIXED: Re-add message formatting ---
      // Backend messages need IDs for the React list key and 'text' field
      const formattedHistory = sessionData.messages.map((msg, index) => ({
          // Ensure role and content exist, provide defaults if not (though backend should guarantee)
          role: msg.role || 'unknown', 
          content: msg.content || '', 
          // Map backend structure to frontend structure
          text: msg.content || '', // Use content for display text
          id: `${msg.role || 'msg'}-${sessionData.thread_id}-${index}-${Date.now()}`, // Create a unique ID
          sender: msg.role === 'assistant' ? 'backend' : (msg.role || 'unknown') // Map role to sender ('user', 'backend', 'system', etc.)
      }));
      setChatHistory(formattedHistory); // Use the formatted history
      // --- END FIXED ---
      setCurrentThreadId(sessionData.thread_id);
      
      // Settings: Apply settings from the loaded session
      const loadedSettings = {
          systemPrompt: sessionData.system_prompt ?? DEFAULTS.SYSTEM_PROMPT,
          temperature: sessionData.sampling_settings?.temperature ?? DEFAULTS.TEMPERATURE,
          topP: sessionData.sampling_settings?.top_p ?? DEFAULTS.TOP_P,
          // --- FIXED: Typo session_data -> sessionData ---
          maxTokens: sessionData.sampling_settings?.max_new_tokens ?? DEFAULTS.MAX_TOKENS, 
          // --- END FIXED ---
      };
      setCurrentSessionSettings(loadedSettings);
      console.log("App: Applied session settings:", loadedSettings);
      
      // --- Sync tab state --- 
      setActiveTabId(sessionData.thread_id);
      // Add tab if not already open (e.g., loaded via sidebar without tab existing)
      setOpenTabs(prevTabs => {
          if (prevTabs.some(tab => tab.id === sessionData.thread_id)) {
              // Tab exists, potentially update label if it changed (though handleLoadSession might not be the best place for this)
              // It's better handled by the rename function or initial load
              return prevTabs.map(tab => 
                  tab.id === sessionData.thread_id 
                  ? { ...tab, label: sessionData.custom_title || sessionData.title || tab.label } // Prioritize custom_title, then title, keep existing if none
                  : tab
              );
          }
          // Determine label - prioritize custom_title, then title from list, else fallback
          const label = sessionData.custom_title || sessionData.title || `Session ${sessionData.thread_id.substring(0, 6)}...`;
          return [...prevTabs, { id: sessionData.thread_id, label: label, canClose: true }];
      });
      // --- END Sync tab state ---
      setError(null); // Clear any previous errors
      setIsLoading(false); // Ensure loading indicator is off

  }, [setCurrentSessionSettings, setChatHistory, setCurrentThreadId, setActiveTabId, setOpenTabs, setError, setIsLoading]); // Dependencies

  // --- ADDED: Tab Selection Handler --- 
  const handleTabSelect = useCallback(async (tabId) => {
    if (tabId === activeTabId) return; // Do nothing if already active

    console.log(`Switching to tab: ${tabId}`);
    setActiveTabId(tabId);

    if (tabId === NEW_CHAT_TAB_ID) {
      // Switch to a new chat - clear history, thread ID, and revert settings
      handleClearChat();
    } else {
      // Switch to an existing session tab - load its data (incl. settings via handleLoadSession)
      setIsLoading(true);
      setError(null);
      try {
        const response = await fetch(`${API_BASE_URL}/api/v1/chat/session/${tabId}`);
        if (!response.ok) {
          const errorData = await response.json().catch(() => ({ detail: `HTTP error! status: ${response.status}` }));
          throw new Error(errorData.detail || `Failed to fetch session ${tabId}`);
        }
        const sessionData = await response.json();
        handleLoadSession(sessionData); // This now also handles setting the tab label based on custom_title/title
      } catch (e) {
        console.error(`Error fetching session ${tabId}:`, e);
        setError(`Failed to load session ${tabId}: ${e.message}`);
        setChatHistory([]); // Clear chat area on error
        setCurrentThreadId(null); // Clear thread ID
        setActiveTabId(tabId); // Still set the tab as active even if load failed
        setCurrentSessionSettings(null); // Revert settings on error
      } finally {
        setIsLoading(false);
      }
    }
  }, [activeTabId, handleClearChat, handleLoadSession, setActiveTabId, setIsLoading, setError, setChatHistory, setCurrentThreadId, setCurrentSessionSettings, setOpenTabs]); // Added setOpenTabs and other dependencies from handleLoadSession
  // --- END: Tab Selection Handler ---

  // --- MODIFIED: Tab Close Handler --- 
  const handleTabClose = useCallback(async (tabIdToClose) => {
      if (tabIdToClose === NEW_CHAT_TAB_ID) return; // Cannot close the "New Chat" tab

      console.log(`Attempting to close tab: ${tabIdToClose}`);

      // Find the index of the tab to close
      const closingTabIndex = openTabs.findIndex(tab => tab.id === tabIdToClose);
      if (closingTabIndex === -1) {
          console.warn(`Tab with ID ${tabIdToClose} not found in openTabs.`);
          return; // Tab not found
      }

      // Determine the next active tab ID *before* removing the tab
      let nextActiveTabId = activeTabId;
      let switchToNewChat = false;
      if (activeTabId === tabIdToClose) {
          if (closingTabIndex > 0) {
              nextActiveTabId = openTabs[closingTabIndex - 1].id;
          } else {
              // If the first tab (after New Chat potentially) is closed, select New Chat
              const newChatTab = openTabs.find(t => t.id === NEW_CHAT_TAB_ID);
              nextActiveTabId = newChatTab.id; // Should always exist
              switchToNewChat = true;
              // Removed more complex fallback logic, always switch to New Chat if the active one is closed and it's the first actual session tab.
          }
      }

      // Optimistically remove the tab from the UI
      const updatedTabs = openTabs.filter(tab => tab.id !== tabIdToClose);
      setOpenTabs(updatedTabs);

      // Switch to the new active tab if needed
      if (nextActiveTabId !== activeTabId) {
          console.log(`Switching active tab to ${nextActiveTabId} after closing ${tabIdToClose}`);
          if (switchToNewChat) {
              handleClearChat(); // Handles setting active tab and clearing settings
          } else {
              // Manually set active tab first, then load session (which sets settings)
              // No need to call handleTabSelect as we don't want infinite loops and already set state
              setActiveTabId(nextActiveTabId);
              // Fetch and load the session data for the newly activated tab
              setIsLoading(true);
              setError(null);
              try {
                  const response = await fetch(`${API_BASE_URL}/api/v1/chat/session/${nextActiveTabId}`);
                  if (!response.ok) {
                      const errorData = await response.json().catch(() => ({ detail: `HTTP error! status: ${response.status}` }));
                      throw new Error(errorData.detail || `Failed to fetch session ${nextActiveTabId}`);
                  }
                  const sessionData = await response.json();
                  handleLoadSession(sessionData); // Load data and settings for the newly active tab
              } catch (e) {
                  console.error(`Error fetching session ${nextActiveTabId} after closing tab:`, e);
                  setError(`Failed to load session ${nextActiveTabId}: ${e.message}`);
                  // Fallback to New Chat on error loading next tab
                  handleClearChat();
              } finally {
                  setIsLoading(false);
              }
          }
      }
  // Only delete from backend if the close was successful? Or should it be separate?
  // For now, let's assume close only affects UI state, deletion is explicit via SavedChatsPanel

  }, [openTabs, activeTabId, handleClearChat, handleLoadSession, setActiveTabId, setIsLoading, setError, setOpenTabs]); // Dependencies updated
  // --- END: Tab Close Handler ---

  // --- ADDED: Tab Rename Handler ---
  const handleTabRename = useCallback((threadId, newName) => {
    setOpenTabs(prevTabs =>
      prevTabs.map(tab =>
        tab.id === threadId ? { ...tab, label: newName } : tab
      )
    );
    console.log(`App: Renamed tab ${threadId} to "${newName}" in UI state.`);
  }, [setOpenTabs]); // Dependency on setOpenTabs (stable)
  // --- END: Tab Rename Handler ---


  // --- useEffect Hooks ---
  useEffect(() => {
    fetch(`${API_BASE_URL}/themes`)
      .then(res => res.json())
      .then(setThemeList)
      .catch(() => setThemeList([
        'AlienBlood', 'Brogrammer', 'HaX0R_BLUE', 'HaX0R_GR33N', 'HaX0R_R3D',
        'Kanagawa Dragon', 'Kanagawa Wave', 'Shaman',
        'catppuccin-frappe', 'catppuccin-macchiato', 'catppuccin-mocha',
      ]));

    // --- ADDED: Fetch saved sessions --- 
    fetch(`${API_BASE_URL}/api/v1/chat/sessions`)
      .then(res => {
        if (!res.ok) {
          throw new Error(`HTTP error! status: ${res.status}`);
        }
        return res.json();
      })
      .then(sessions => {
        if (sessions && Array.isArray(sessions)) {
          const sessionTabs = sessions.map(session => ({
            id: session.thread_id,
            // Use the title from the backend (which prioritizes custom_title)
            label: session.title || `Session ${session.thread_id.substring(0, 6)}...`, // Use title directly
            canClose: true
          }));
          // Add fetched sessions to the initial 'New Chat' tab
          // Avoid adding duplicates if already open (though unlikely on initial load)
          setOpenTabs(prevTabs => [
             ...prevTabs.filter(t => t.id === NEW_CHAT_TAB_ID), // Keep New Chat tab
             ...sessionTabs.filter(st => !prevTabs.some(pt => pt.id === st.id)) // Add new session tabs
          ]);
        } else {
          console.warn('No saved sessions found or invalid format.');
        }
      })
      .catch(err => {
        console.error("Error fetching saved sessions:", err);
        // Handle error appropriately, maybe show a message to the user
        setError("Could not load saved sessions."); // Set error state
      });
    // --- END: Fetch saved sessions ---

  }, []); // Empty dependency array: Run only on initial mount

  // --- Keyboard Shortcuts --- useEffect
  useEffect(() => {
    const handleKeyDown = (event) => {
      // Toggle Settings: Cmd + , or Ctrl + ,
      if ((event.metaKey || event.ctrlKey) && event.key === ',') {
        event.preventDefault();
        setIsSidebarOpen(prev => !prev); // Toggle sidebar instead of old panel
        console.log("Toggled sidebar visibility");
      }
      // Clear Chat: Ctrl + Shift + C (Be careful not to override browser dev tools)
      else if (event.ctrlKey && event.shiftKey && event.key === 'C') {
        event.preventDefault();
        console.log("Clear Chat shortcut triggered");
        handleClearChat();
      }
      // Submit on Enter (but not Shift+Enter)
      else if (event.key === 'Enter' && !event.shiftKey && !isLoading) {
          event.preventDefault();
          const sendButton = document.getElementById('send-button'); // Assuming button has id="send-button"
          if (sendButton && !sendButton.disabled) {
              sendButton.click();
          }
      }
    };

    window.addEventListener('keydown', handleKeyDown);

    // Cleanup function to remove the event listener
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [handleClearChat, isLoading]); // Add isLoading dependency for Enter submit logic

  // Scroll to bottom when chatHistory changes or isLoading becomes true
  useEffect(() => {
    // Only scroll if loading a new message OR if messages were added
    if (isLoading || chatHistory.length > 0) {
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [chatHistory, isLoading]);

  // --- Send Message Handler (Modified for v2) ---
  const sendMessage = useCallback(async (currentChatHistory) => {
    if (!userInput.trim()) return; // Don't send empty messages
    if (appModelLoadStatus !== 'loaded') {
        setError("Model is not loaded. Cannot send message.");
        return;
    }

    setIsLoading(true);
    setError(null);
    const newUserMessageId = `user-${Date.now()}`;
    const newUserMessage = { sender: 'user', text: userInput, id: newUserMessageId };

    // Optimistically add user message
    const updatedChatHistory = [...currentChatHistory, newUserMessage];
    setChatHistory(updatedChatHistory);
    const currentUserInput = userInput; // Capture current user input before clearing
    setUserInput(''); // Clear input field immediately

    // Add loading indicator message
    const loadingId = `loading-${Date.now()}`;
    loadingMessageIdRef.current = loadingId;
    setChatHistory(prev => [...prev, { sender: 'backend', text: '', id: loadingId }]);

    try {
        const payload = {
            mode: appChatMode,
            thread_id: currentThreadId, // Send current thread ID
        };

        if (appChatMode === 'instruction') {
            payload.message = currentUserInput;
        } else { // 'chat' mode
            // Format history, including the new user message
            payload.messages = formatChatHistoryForBackend(updatedChatHistory);
        }

        const response = await fetch(`${API_BASE_URL}/api/v1/chat/chat-v2`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
        });

        // Remove loading indicator before processing response
        setChatHistory(prev => prev.filter(msg => msg.id !== loadingMessageIdRef.current));
        loadingMessageIdRef.current = null;

        if (!response.ok) {
            let errorDetail = `HTTP error! status: ${response.status}`;
            try {
                const errorData = await response.json();
                errorDetail = errorData.detail || errorDetail;
            } catch (e) { /* Ignore JSON parsing error */ }
            throw new Error(errorDetail);
        }

        const data = await response.json();
        const backendResponse = data.response;
        const newThreadId = data.thread_id; // Get thread_id from response

        const backendMessageId = `backend-${Date.now()}`;
        const backendMessage = { sender: 'backend', text: backendResponse, id: backendMessageId };

        // Add backend message
        setChatHistory(prev => [...prev, backendMessage]);

        // --- Tab & Session ID Handling ---
        if (newThreadId && newThreadId !== currentThreadId) {
            setCurrentThreadId(newThreadId); // Update the current thread ID
            console.log(`App: Switched to/created new thread ID: ${newThreadId}`);

            // If this was the first message in the "New Chat" tab, update the tab
            if (activeTabId === NEW_CHAT_TAB_ID) {
                const newLabel = currentUserInput.substring(0, 30) + (currentUserInput.length > 30 ? '...' : '');
                setOpenTabs(prevTabs => {
                    // Remove the placeholder "New Chat" tab
                    const filteredTabs = prevTabs.filter(tab => tab.id !== NEW_CHAT_TAB_ID);
                    // Add the new session tab and a fresh "New Chat" tab
                    return [
                        { id: NEW_CHAT_TAB_ID, label: 'New Chat', canClose: false }, // Add back new chat
                        ...filteredTabs,
                        { id: newThreadId, label: newLabel, canClose: true }
                    ];
                });
                setActiveTabId(newThreadId); // Make the new session tab active
                 // Fetch updated session list for the sidebar (or update locally?)
                 // For now, let's assume the sidebar will fetch on its own or be triggered later
            } else if (currentThreadId === null) { // Edge case: loaded a deleted session? Switch to new tab
                 const newLabel = currentUserInput.substring(0, 30) + (currentUserInput.length > 30 ? '...' : '');
                 setOpenTabs(prevTabs => [
                    ...prevTabs,
                     { id: newThreadId, label: newLabel, canClose: true }
                 ]);
                 setActiveTabId(newThreadId);
            }
            // If it's an existing tab, the ID should match, no tab update needed here
            // (Renaming is handled separately)
        }
        // --- End Tab & Session ID Handling ---

    } catch (e) {
        console.error("Error sending message:", e);
        setError(e.message || "Failed to get response from backend.");
        // Remove loading indicator on error as well
        setChatHistory(prev => prev.filter(msg => msg.id !== loadingMessageIdRef.current));
        loadingMessageIdRef.current = null;
        // Optionally add a system error message to the chat
        // setChatHistory(prev => [...prev, { sender: 'system', text: `Error: ${e.message}`, id: `error-${Date.now()}` }]);
    } finally {
        setIsLoading(false);
        // Ensure loading indicator is removed even if error handling failed somehow
        if (loadingMessageIdRef.current) {
            setChatHistory(prev => prev.filter(msg => msg.id !== loadingMessageIdRef.current));
            loadingMessageIdRef.current = null;
        }
    }
  }, [userInput, appChatMode, currentThreadId, activeTabId, appModelLoadStatus]); // Dependencies

  // --- Render --- 
  return (
    <div className={`App ${themeName}`}> {/* Apply theme class */}
      <ThemeLoader themeName={themeName} /> {/* Theme CSS loader */}

      {/* --- ADDED: Sidebar --- */}
      <Sidebar 
          isOpen={isSidebarOpen} 
          onToggle={() => setIsSidebarOpen(!isSidebarOpen)}
          // Pass model load related props
          setLoadStatus={handleModelLoadStatusChange}
          setLoading={setIsLoading} // Allow sidebar components to set global loading
          isLoading={isLoading}
          isModelLoaded={appModelLoadStatus === 'loaded'} // Pass derived boolean
          currentModelPath={currentLoadedModelName || 'None'} // Pass loaded model name
          onHfUsernameUpdate={handleHfUsernameUpdate} // Pass username update handler
          onDeviceUpdate={handleDeviceUpdate} // Pass device update handler
          currentDevice={currentDevice} // Pass current device
          // Pass theme props
          themeName={themeName}
          setThemeName={setThemeName}
          themeList={themeList}
          // Pass chat management props
          onClearChat={handleClearChat}
          onLoadSession={handleLoadSession} // Pass session loading handler
          loadedSessionSettings={currentSessionSettings} // Pass currently applied settings
          onTabRename={handleTabRename} // <-- Pass the rename handler
      />
      {/* --- END: Sidebar --- */}

      <div className={`main-content ${isSidebarOpen ? 'sidebar-open' : 'sidebar-closed'}`}>
          <header className="app-header">
            <button onClick={() => setIsSidebarOpen(!isSidebarOpen)} className="sidebar-toggle-btn header-btn">
              {/* Use a simple icon or text for toggle */} {isSidebarOpen ? '<' : '>'}
            </button>
            <h1 className="app-title">
                Sigil 
                {currentLoadedModelName && 
                    <span className="loaded-model-name">({currentLoadedModelName})</span>
                }
            </h1>

            <div className="header-controls">
                {/* Chat Mode Selector */}
                <div className="mode-selector">
                    <button 
                        onClick={() => handleChatModeChange('instruction')}
                        className={appChatMode === 'instruction' ? 'active' : ''}
                    >
                        Instruct
                    </button>
                    <button 
                        onClick={() => handleChatModeChange('chat')}
                        className={appChatMode === 'chat' ? 'active' : ''}
                    >
                        Chat
                    </button>
                </div>
                 <DeviceIndicator device={currentDevice} username={hfUsername} />
            </div>

            {/* Status Indicators - Simplified Location */}
            <div className="model-status-group">
              {appModelLoadStatus === 'loaded' && <span className="model-status-indicator">Model Ready</span>}
              {appModelLoadStatus === 'idle' && <span className="model-status-indicator">Waiting for Model</span>}
              {appModelLoadStatus === 'error' && <span className="model-status-indicator error">Model Load Failed</span>}
              {appModelLoadStatus === 'loading' && <span className="model-status-indicator loading">Loading Model...</span>}
            </div>

            {/* Display Current Thread ID if available - Now part of the tab potentially */}
            {/* {currentThreadId && <span className="thread-id-display">Session: {currentThreadId}</span>} */}
          </header>

          {/* --- ADDED: Tab Container --- */}
          <TabContainer
            tabs={openTabs}
            activeTabId={activeTabId}
            onTabSelect={handleTabSelect}
            onTabClose={handleTabClose} // Pass the close handler
          />
          {/* --- END: Tab Container --- */}

          <div className="chat-area">
            {/* Display chat history */}
            {/* Pass model status to ChatHistory */}
            <div className="messages-area">
              {/* Display message asking user to load model if not loaded */} 
              {appModelLoadStatus === 'idle' && !chatHistory.length && (
                <div className="message system-message">
                  <p>Please load a model using the 'Load Model' panel in the sidebar to begin.</p>
                </div>
              )}
              {/* Display error if model failed to load */} 
              {appModelLoadStatus === 'error' && (
                 <div className="message system-message error-message">
                   <p>Failed to load model. Check console for details.</p>
                 </div>
              )}
              {/* Display general errors */}
              {error && !isLoading && (
                 <div className="message system-message error-message">
                   <p>Error: {error}</p>
                 </div>
              )}

              {chatHistory.map((msg) => (
                <div key={msg.id} className={`message ${msg.sender}-message ${msg.id.startsWith('loading-') ? 'loading-message' : ''}`}>
                  {msg.id.startsWith('loading-') ? (
                    <div className="dots-container"><span>.</span><span>.</span><span>.</span></div>
                  ) : (
                    <p>{msg.text}</p>
                  )}
                </div>
              ))}
              <div ref={messagesEndRef} /> {/* Element to scroll to */}
            </div>

            {/* Input area */} 
            <div className="input-area">
              <textarea
                value={userInput}
                onChange={(e) => setUserInput(e.target.value)}
                placeholder={appModelLoadStatus === 'loaded' ? (isLoading ? "Generating response..." : "Type your message here...") : "Load a model first"}
                rows="3"
                disabled={isLoading || appModelLoadStatus !== 'loaded'}
              />
              <button 
                id="send-button" 
                onClick={() => sendMessage(chatHistory)} 
                disabled={isLoading || !userInput.trim() || appModelLoadStatus !== 'loaded'}
              >
                Send
              </button>
            </div>
          </div>
      </div>
    </div>
  );
}

export default App;
