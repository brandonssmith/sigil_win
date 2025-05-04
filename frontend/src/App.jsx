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
  const handleLoadSession = useCallback((sessionData) => {
      if (sessionData && sessionData.messages && sessionData.thread_id) {
          console.log(`App: Loading session ${sessionData.thread_id}`);
          // Backend messages need IDs for the React list key and 'text' field
          const formattedHistory = sessionData.messages.map((msg, index) => ({
              role: msg.role, // Keep role
              content: msg.content, // Keep content
              text: msg.content, // <-- ADDED: Map content to text for display
              id: `${msg.role}-${sessionData.thread_id}-${index}-${Date.now()}`, // Create a unique ID
              sender: msg.role === 'assistant' ? 'backend' : msg.role // Map role to sender
          }));
          setChatHistory(formattedHistory);
          setCurrentThreadId(sessionData.thread_id);

          // --- ADDED: Extract and store loaded settings ---
          const loadedSettings = sessionData.sampling_settings;
          const loadedPrompt = sessionData.system_prompt;

          if (loadedSettings || loadedPrompt !== undefined) {
              console.log("App: Applying loaded session settings:", { loadedSettings, loadedPrompt });
              setCurrentSessionSettings({
                  // Use loaded value or fall back to default if null/undefined in saved data
                  systemPrompt: loadedPrompt ?? DEFAULTS.SYSTEM_PROMPT,
                  temperature: loadedSettings?.temperature ?? DEFAULTS.TEMPERATURE,
                  topP: loadedSettings?.top_p ?? DEFAULTS.TOP_P,
                  maxTokens: loadedSettings?.max_new_tokens ?? DEFAULTS.MAX_TOKENS,
              });
          } else {
              // If no settings found in session, revert to defaults
              console.log("App: No settings found in session, reverting to defaults.");
              setCurrentSessionSettings(null); // Use null to signify defaults
          }
          // --- END: Extract and store loaded settings ---

          // --- Sync tab state --- 
          setActiveTabId(sessionData.thread_id);
          // Add tab if not already open (e.g., loaded via sidebar without tab existing)
          setOpenTabs(prevTabs => {
              if (prevTabs.some(tab => tab.id === sessionData.thread_id)) {
                  return prevTabs; // Tab already exists
              }
              // Determine label - use metadata if available, else fallback
              const label = sessionData.first_user_message || `Session ${sessionData.thread_id.substring(0, 6)}...`;
              return [...prevTabs, { id: sessionData.thread_id, label: label, canClose: true }];
          });
          // --- END Sync tab state ---
          setError(null); // Clear any previous errors
          setIsLoading(false); // Ensure loading indicator is off
      } else {
          console.error("App: Invalid session data received for loading:", sessionData);
          setError("Failed to load session data.");
          setCurrentSessionSettings(null); // Revert settings on load error
      }
  }, []); // Dependencies: setChatHistory, setCurrentThreadId, setActiveTabId, setOpenTabs, setError, setIsLoading, setCurrentSessionSettings (stable)

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
        handleLoadSession(sessionData);
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
  }, [activeTabId, handleClearChat, handleLoadSession]); // Dependencies
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
              const newChatTab = openTabs.find(t => t.id === NEW_CHAT_TAB_ID);
              nextActiveTabId = newChatTab ? newChatTab.id : (openTabs.length > 1 ? openTabs[1].id : null);
              if (!nextActiveTabId) { /* error handling */ return; }
              if (nextActiveTabId === NEW_CHAT_TAB_ID) {
                  switchToNewChat = true;
              }
          }
      }

      // Optimistically remove the tab from the UI
      setOpenTabs(prevTabs => prevTabs.filter(tab => tab.id !== tabIdToClose));

      // Switch to the new active tab if needed
      if (nextActiveTabId !== activeTabId) {
          console.log(`Switching active tab to ${nextActiveTabId} after closing ${tabIdToClose}`);
          if (switchToNewChat) {
              handleClearChat(); // Handles setting active tab and clearing settings
          } else {
              // Manually set active tab first, then load session (which sets settings)
              setActiveTabId(nextActiveTabId);
              setIsLoading(true);
              setError(null);
              try {
                  const response = await fetch(`${API_BASE_URL}/api/v1/chat/session/${nextActiveTabId}`);
                  if (!response.ok) { /* error handling */ throw new Error(/* ... */); }
                  const sessionData = await response.json();
                  handleLoadSession(sessionData); // Load data and settings
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

      // Attempt to delete the session from the backend
      try {
          const response = await fetch(`${API_BASE_URL}/api/v1/chat/session/${tabIdToClose}`, {
              method: 'DELETE',
          });

          if (!response.ok) {
              // 404 is acceptable if the file was already gone
              if (response.status !== 404) {
                  const errorData = await response.json().catch(() => ({ detail: `DELETE request failed with status: ${response.status}` }));
                  throw new Error(errorData.detail || `Failed to delete session ${tabIdToClose}`);
              }
          }
          console.log(`Session ${tabIdToClose} deleted successfully or was already gone.`);

      } catch (e) {
          console.error(`Error deleting session ${tabIdToClose}:`, e);
          // Notify user or log error. The tab is already closed in the UI.
          // We could potentially add the tab back if deletion fails critically, but that might be complex.
          setError(`Failed to delete session ${tabIdToClose} on the server: ${e.message}`); // Show non-critical error
      }

  }, [openTabs, activeTabId, handleClearChat, handleLoadSession, setActiveTabId, setIsLoading, setError, setChatHistory, setCurrentThreadId, setOpenTabs, setCurrentSessionSettings]); // Dependencies
  // --- END: Tab Close Handler ---

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
            // Create a label - use first user message or thread_id as fallback
            label: session.first_user_message || `Session ${session.thread_id.substring(0, 6)}...`,
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
        // setError("Could not load saved sessions."); 
      });
    // --- END: Fetch saved sessions ---

  }, []); // Empty dependency array: Run only on initial mount

  // --- Keyboard Shortcuts --- useEffect
  useEffect(() => {
    const handleKeyDown = (event) => {
      // Toggle Sidebar: Cmd/Ctrl + ,
      if ((event.metaKey || event.ctrlKey) && event.key === ',') {
        event.preventDefault();
        setIsSidebarOpen(prevIsOpen => !prevIsOpen);
      }

      // Clear Chat: Ctrl + Shift + C
      if (event.ctrlKey && event.shiftKey && event.key === 'C') {
        event.preventDefault();
        handleClearChat(); // Now defined above
      }
    };

    window.addEventListener('keydown', handleKeyDown);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [handleClearChat]); // Dependency is now valid

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [chatHistory]);

  // Handler for loading the model - Removed, handled by ModelLoadPanel
  // const handleLoadModel = async () => { ... };

  // Handler for applying model settings - Removed, handled by SettingsPanel
  // const handleApplySettings = async () => { ... };

  const handleSubmit = async (event) => {
    event.preventDefault();
    const trimmedInput = userInput.trim();
    if (!trimmedInput || appModelLoadStatus !== 'loaded') return; 

    const userMessage = {
      sender: 'user',
      text: trimmedInput,
      id: `user-${Date.now()}`,
      role: 'user', // Add role for consistency
      content: trimmedInput // Add content for consistency
    };
    // Add user message immediately
    const currentHistoryWithUser = [...chatHistory, userMessage]; // History including the new user message
    setChatHistory(currentHistoryWithUser);

    // Prepare history *before* adding loading message
    // Use the history that includes the latest user message
    const historyForBackend = formatChatHistoryForBackend(currentHistoryWithUser); 

    const loadingMsgId = `loading-${Date.now()}`;
    loadingMessageIdRef.current = loadingMsgId;
    const loadingMessage = {
        sender: 'system',
        text: '...',
        id: loadingMsgId
    };
    setChatHistory(prev => [...prev, loadingMessage]);

    setUserInput('');
    setIsLoading(true);
    setError(null);

    let requestBody = {};
    // --- MODIFIED: Determine request body based on thread ID first ---
    if (currentThreadId) {
        // If continuing a thread, ALWAYS use chat mode and send history
        requestBody = {
            mode: 'chat', // Force chat mode
            messages: historyForBackend, // Send the full history
            thread_id: currentThreadId
        };
        // message field is not needed in chat mode
    } else {
        // If starting a new thread, use the appChatMode toggle
        if (appChatMode === 'instruction') { 
          requestBody = {
            mode: 'instruction',
            message: trimmedInput,
            thread_id: null // Explicitly null for new thread
          };
        } else { // appChatMode === 'chat'
          requestBody = {
            mode: 'chat',
            messages: historyForBackend, // Send the history (which is just user msg here)
            thread_id: null // Explicitly null for new thread
          };
        }
    }
    // --- End MODIFIED section ---

    console.log("Sending request to /chat-v2:", requestBody); // Log the request

    try {
      const response = await fetch(`${API_BASE_URL}/api/v1/chat/chat-v2`, { 
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody),
      });

      const idToRemove = loadingMessageIdRef.current;
      loadingMessageIdRef.current = null;
      if (idToRemove) {
        setChatHistory(prev => prev.filter(msg => msg.id !== idToRemove));
      }

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.detail || `HTTP error! status: ${response.status}`);
      }

      console.log("Backend response data:", data); // Log the response

      // --- ADDED: Update thread ID from response ---
      if (data.thread_id && data.thread_id !== currentThreadId) {
          console.log(`App: Updating thread ID from ${currentThreadId} to ${data.thread_id}`);
          setCurrentThreadId(data.thread_id);
      }
      // --- End Update thread ID ---

      const backendMessage = {
        sender: 'backend',
        text: formatListText(data.response || 'Backend did not provide a response.'), 
        id: `backend-${Date.now()}`,
        role: 'assistant', // Add role
        content: data.response // Add raw content
      };
      // Add backend response (use functional update based on previous state before loading msg removal)
      setChatHistory(prev => prev.filter(msg => msg.id !== idToRemove).concat(backendMessage));

    } catch (e) { 
      console.error('Fetch error:', e);
      const errorMessage = `Failed to fetch: ${e.message}`;
      setError(errorMessage); 

      const idToRemoveOnError = loadingMessageIdRef.current;
      loadingMessageIdRef.current = null;
      // Use functional update based on previous state before loading msg removal
      setChatHistory(prev => [
          ...prev.filter(msg => msg.id !== idToRemoveOnError),
          { sender: 'system', text: `Error: ${e.message}`, id: `error-${Date.now()}` }
      ]);
    } finally { // Ensure isLoading is set to false in both success and error cases
        setIsLoading(false);
        // Scroll after state updates have likely rendered
        setTimeout(scrollToBottom, 0); 
    }
  };

  // Derived state for convenience
  const modelLoaded = appModelLoadStatus === 'loaded';

  return (
    // Use a Fragment <> ... </> to return multiple top-level elements
    <>
      <div className={`app-layout ${isSidebarOpen ? 'sidebar-open' : 'sidebar-closed'}`}>
        {/* Dynamically load the selected theme */}
        <ThemeLoader themeName={themeName} />
        
        {/* Render the Sidebar */}
        <Sidebar
            isOpen={isSidebarOpen}
            modelLoaded={modelLoaded}
            setLoadStatus={handleModelLoadStatusChange}
            setLoading={setIsLoading}
            isLoading={isLoading}
            currentModelPath={currentLoadedModelName}
            themeName={themeName}
            setThemeName={setThemeName}
            themeList={themeList}
            onHfUsernameUpdate={handleHfUsernameUpdate}
            onDeviceUpdate={handleDeviceUpdate}
            currentDevice={currentDevice}
            onClearChat={handleClearChat}
            onLoadSession={handleLoadSession}
            loadedSessionSettings={currentSessionSettings}
         />
        
        {/* Right Panel: Chat Area */}
        <div className="chat-container">
          <header className="chat-header">
            {/* Sidebar Toggle Button */}
            <button
              onClick={() => setIsSidebarOpen(!isSidebarOpen)}
              className="sidebar-toggle-button" // Add a class for styling
              title="Toggle Sidebar (Cmd/Ctrl + ,)" // Accessibility
            >
              ☰ {/* Hamburger Icon */}
            </button>

            {/* Original Header Content */}
            <h1 style={{ marginLeft: '10px' }}>Sigil</h1> {/* Added margin for spacing */}
            {/* Move the settings toggle button here */}
            {/* 
            <button
              onClick={() => setShowSettings(!showSettings)}
              style={{
                background: 'none',
                border: 'none',
                marginLeft: '4px', // Reduce space from the title
                cursor: 'pointer',
                color: 'inherit', // Use the header's text color
                fontSize: '20px', // Make the gear slightly larger
                padding: 0, // Remove default padding
                verticalAlign: 'middle' // Align with title text
              }}
              title="Toggle Settings" // Accessibility
            >
              ⚙️
            </button>
             */}
            {/* --- NEW: Welcome Message --- */}
            {hfUsername && (
              <span style={{ marginLeft: 'auto', fontSize: '0.9em', opacity: 0.9 /* color: 'var(--color-username)' */ }}>
                Welcome, {hfUsername}!
              </span>
            )}
            {/* --- NEW: Device Indicator --- */}
            <DeviceIndicator device={currentDevice} />
            
            {/* --- Chat Mode Toggle --- */}
            <ModeToggleSwitch
              mode={appChatMode}
              onToggle={handleChatModeChange}
              disabled={!modelLoaded}
            />

            {/* Model Status Group */}
            <div className="model-status-group">
              {modelLoaded && <span className="model-status-indicator">Model Ready</span>}
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

          <div className="messages-area">
            {/* Display message asking user to load model if not loaded */}
            {appModelLoadStatus === 'idle' && !isSidebarOpen && ( // Show only if sidebar is closed
              <div className="message system-message">
                <p>Click the ☰ icon or press Cmd/Ctrl+, to open the sidebar and load a model.</p>
              </div>
            )}
             {appModelLoadStatus === 'idle' && isSidebarOpen && ( // Show when sidebar is open
              <div className="message system-message">
                <p>Use the 'Load Model' panel in the sidebar to choose a model.</p>
              </div>
            )}
            {appModelLoadStatus === 'error' && (
               <div className="message system-message error-message"> 
                 {/* Display general error state if set by load failure */}
                 <p>{error || 'Failed to load model. Check the sidebar for details.'}</p>
               </div>
            )}

            {chatHistory.map((msg) => (
              <div key={msg.id} className={`message ${msg.sender}-message ${msg.id.startsWith('loading-') ? 'loading-message' : ''}`}>
                {msg.id.startsWith('loading-') ? (
                  <div className="typing-indicator">
                    <span></span><span></span><span></span>
                  </div>
                ) : (
                  <p dangerouslySetInnerHTML={{ __html: msg.text }} /> // Use dangerouslySetInnerHTML if text contains HTML
                )}
              </div>
            ))}
            <div ref={messagesEndRef} />
          </div>

           {/* Display general fetch error message if it exists (e.g., from chat fetch) */}
           {error && appModelLoadStatus !== 'error' && <p className="error-message chat-error">Chat Error: {error}</p>}

          {/* Clear Chat Button (New) - Placed near input bar for relevance */}
          {chatHistory.length > 0 && (
            <button
              onClick={handleClearChat}
              className="clear-chat-button"
              disabled={isLoading}
            >
              Clear Chat
            </button>
          )}

          <form onSubmit={handleSubmit} className="input-form">
            <textarea
              value={userInput}
              onChange={(e) => setUserInput(e.target.value)}
              placeholder={modelLoaded ? "Type your message..." : "Load a model using the sidebar first..."}
              rows="3" // Start with 3 rows
              disabled={isLoading || !modelLoaded}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault(); // Prevent newline on Enter
                  handleSubmit(e); // Trigger form submission
                }
              }}
            />
            <button type="submit" disabled={isLoading || !modelLoaded || !userInput.trim()}>
              {isLoading ? 'Sending...' : 'Send'}
            </button>
          </form>
        </div>
      </div> 
      {/* End of app-layout div */}
    </> // End Fragment
  );
}

export default App;
