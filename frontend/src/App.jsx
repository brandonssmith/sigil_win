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
import { useTabs } from './hooks/useTabs.js'; // <-- IMPORTED

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

  // --- Tab State - Now managed by useTabs hook ---
  // const [openTabs, setOpenTabs] = useState([
  //   { id: NEW_CHAT_TAB_ID, label: 'New Chat', canClose: false }
  // ]);
  // const [activeTabId, setActiveTabId] = useState(NEW_CHAT_TAB_ID);
  // --- END: Tab State ---

  // --- ADDED: State for currently loaded session settings ---
  const [currentSessionSettings, setCurrentSessionSettings] = useState(null);
  // --- END: State for loaded settings ---
  
  // --- ADDED: State for Pending New Chat Settings ---
  const [newChatSettings, setNewChatSettings] = useState({
      systemPrompt: DEFAULTS.SYSTEM_PROMPT,
      temperature: DEFAULTS.TEMPERATURE,
      topP: DEFAULTS.TOP_P,
      maxTokens: DEFAULTS.MAX_TOKENS,
  });
  // --- END ADDED ---

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

  // --- Callbacks for useTabs hook ---
  const appLevelClearChatActions = useCallback(() => {
    setChatHistory([]);
    setError(null);
    setCurrentThreadId(null);
    setCurrentSessionSettings(null);
    setNewChatSettings({
        systemPrompt: DEFAULTS.SYSTEM_PROMPT,
        temperature: DEFAULTS.TEMPERATURE,
        topP: DEFAULTS.TOP_P,
        maxTokens: DEFAULTS.MAX_TOKENS,
    });
    console.log("App: Cleared chat state for New Chat tab or reset.");
  }, [setChatHistory, setError, setCurrentThreadId, setCurrentSessionSettings, setNewChatSettings]);

  // Forward declaration for appLevelLoadSession
  const handleLoadSession = useCallback((sessionData) => {
    // Definition will remain below, but appLevelLoadSession needs it
    if (!sessionData || !sessionData.thread_id || !sessionData.messages) {
        console.error("App: Attempted to load invalid session data:", sessionData);
        setError("Invalid session data received.");
        return;
    }
    console.log(`App: Loading session ${sessionData.thread_id} into state (from handleLoadSession)`);

    const formattedHistory = sessionData.messages.map((msg, index) => ({
        role: msg.role || 'unknown',
        content: msg.content || '',
        text: msg.content || '',
        id: `${msg.role || 'msg'}-${sessionData.thread_id}-${index}-${Date.now()}`,
        sender: msg.role === 'assistant' ? 'backend' : (msg.role || 'unknown')
    }));
    setChatHistory(formattedHistory);
    setCurrentThreadId(sessionData.thread_id);
    
    const loadedSettings = {
        systemPrompt: sessionData.system_prompt ?? DEFAULTS.SYSTEM_PROMPT,
        temperature: sessionData.sampling_settings?.temperature ?? DEFAULTS.TEMPERATURE,
        topP: sessionData.sampling_settings?.top_p ?? DEFAULTS.TOP_P,
        maxTokens: sessionData.sampling_settings?.max_new_tokens ?? DEFAULTS.MAX_TOKENS,
    };
    setCurrentSessionSettings(loadedSettings);
    console.log("App: Applied session settings:", loadedSettings);
    setError(null);
    // setIsLoading(false); // setIsLoading is handled by appLevelLoadSession caller
}, [setCurrentSessionSettings, setChatHistory, setCurrentThreadId, setError /*, setIsLoading (removed) */]);


  const appLevelLoadSession = useCallback(async (tabIdToLoad) => {
    console.log(`App: Request to load session for tab ${tabIdToLoad} (from appLevelLoadSession)`);
    setIsLoading(true);
    setError(null);
    try {
      const response = await fetch(`${API_BASE_URL}/api/v1/chat/session/${tabIdToLoad}`);
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ detail: `HTTP error! status: ${response.status}` }));
        throw new Error(errorData.detail || `Failed to fetch session ${tabIdToLoad}`);
      }
      const sessionData = await response.json();
      handleLoadSession(sessionData); // Call the refactored handleLoadSession
    } catch (e) {
      console.error(`Error fetching session ${tabIdToLoad}:`, e);
      setError(`Failed to load session ${tabIdToLoad}: ${e.message}`);
      setChatHistory([]);
      setCurrentThreadId(null);
      setCurrentSessionSettings(null);
    } finally {
      setIsLoading(false);
    }
  }, [setIsLoading, setError, handleLoadSession, setChatHistory, setCurrentThreadId, setCurrentSessionSettings]);

  // --- Initialize useTabs Hook ---
  const {
    openTabs, // USE ORIGINAL NAME
    activeTabId, // USE ORIGINAL NAME
    handleTabSelect, // USE ORIGINAL NAME
    handleTabClose,  // USE ORIGINAL NAME
    handleTabRename, // USE ORIGINAL NAME
    loadInitialSessionTabs,
    addSessionTabAndMakeActive,
    resetTabsToDefault,
  } = useTabs({
    onClearChatRequest: appLevelClearChatActions,
    onLoadSessionRequest: appLevelLoadSession,
    NEW_CHAT_TAB_ID,
  });
  // --- END: useTabs Hook ---

  const handleClearChat = useCallback(() => {
    appLevelClearChatActions(); 
    resetTabsToDefault();
    console.log("Chat cleared, state reset, and tabs reverted to default via useTabs.");
  }, [appLevelClearChatActions, resetTabsToDefault]);

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

  // --- MODIFIED: handleLoadSession (now primarily updates app state based on sessionData) ---
  // const handleLoadSession = useCallback((sessionData) => { ... MOVED UP ... });

  // --- REMOVED: Old Tab Handlers ---
  // const handleTabSelect = useCallback(async (tabId) => { ... });
  // const handleTabClose = useCallback(async (tabIdToClose) => { ... });
  // const handleTabRename = useCallback((threadId, newName) => { ... });


  const handleCurrentSessionSettingsChange = useCallback((updatedSettings) => {
    setCurrentSessionSettings(updatedSettings);
  }, []);

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
          const sessionTabsData = sessions.map(session => ({
            id: session.thread_id,
            label: session.title || `Session ${session.thread_id.substring(0, 6)}...`,
            canClose: true
          }));
          loadInitialSessionTabs(sessionTabsData); // USE HOOK FUNCTION
        } else {
          console.warn('No saved sessions found or invalid format.');
        }
      })
      .catch(err => {
        console.error("Error fetching saved sessions:", err);
        setError("Could not load saved sessions.");
      });
    // --- END: Fetch saved sessions ---

  }, [loadInitialSessionTabs]); // ADDED loadInitialSessionTabs dependency

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
        handleClearChat(); // Uses new handleClearChat
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
  const sendMessage = useCallback(async (currentChatHistoryFromArg) => { // Renamed currentChatHistory to currentChatHistoryFromArg for clarity
    if (!userInput.trim()) return;
    if (appModelLoadStatus !== 'loaded') {
        setError("Model is not loaded. Cannot send message.");
        return;
    }

    setIsLoading(true);
    setError(null);
    const newUserMessageId = `user-${Date.now()}`;
    const newUserMessage = { sender: 'user', text: userInput, id: newUserMessageId };

    const updatedChatHistory = [...currentChatHistoryFromArg, newUserMessage];
    setChatHistory(updatedChatHistory);
    const currentUserInput = userInput;
    setUserInput('');

    const loadingId = `loading-${Date.now()}`;
    loadingMessageIdRef.current = loadingId;
    setChatHistory(prev => [...prev, { sender: 'backend', text: '', id: loadingId }]);

    try {
        const payload = {
            mode: appChatMode,
            // currentThreadId is from App's state, activeTabId from hook
            thread_id: currentThreadId, 
        };

        let settingsToSend;
        let systemPromptToSend;
        // Use activeTabId from hook here
        if (activeTabId === NEW_CHAT_TAB_ID || currentThreadId === null) {
            settingsToSend = {
                temperature: newChatSettings.temperature,
                top_p: newChatSettings.topP,
                max_new_tokens: newChatSettings.maxTokens,
            };
            systemPromptToSend = newChatSettings.systemPrompt;
        } else {
            const cur = currentSessionSettings || newChatSettings;
            settingsToSend = {
                temperature: cur.temperature,
                top_p: cur.topP,
                max_new_tokens: cur.maxTokens,
            };
            systemPromptToSend = cur.systemPrompt;
        }
        payload.sampling_settings = settingsToSend;
        payload.system_prompt = systemPromptToSend;

        if (appChatMode === 'instruction') {
            payload.message = currentUserInput;
        } else { 
            payload.messages = formatChatHistoryForBackend(updatedChatHistory);
        }

        const response = await fetch(`${API_BASE_URL}/api/v1/chat/chat-v2`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
        });

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
        const newThreadId = data.thread_id;

        const backendMessageId = `backend-${Date.now()}`;
        const backendMessage = { sender: 'backend', text: backendResponse, id: backendMessageId };

        const loadingIdToRemove = loadingMessageIdRef.current;
        setChatHistory(prev => {
            const withoutLoading = prev.filter(msg => msg.id !== loadingIdToRemove);
            return [...withoutLoading, backendMessage];
        });
        loadingMessageIdRef.current = null;

        if (newThreadId && newThreadId !== currentThreadId) {
            setCurrentThreadId(newThreadId);
            console.log(`App: Switched to/created new thread ID: ${newThreadId}`);

            const newLabel = currentUserInput.substring(0, 30) + (currentUserInput.length > 30 ? '...' : '');
            // Use hook's function and pass activeTabId from hook
            addSessionTabAndMakeActive(newThreadId, newLabel, activeTabId);
            
        } else if (newThreadId && newThreadId === currentThreadId && activeTabId === NEW_CHAT_TAB_ID) {
            // This case can happen if currentThreadId was already set by a previous interaction
            // but the user is still technically on the "New Chat" tab interface.
            // We should still "upgrade" the tab.
            const newLabel = currentUserInput.substring(0, 30) + (currentUserInput.length > 30 ? '...' : '');
            addSessionTabAndMakeActive(newThreadId, newLabel, activeTabId);
        }

    } catch (e) {
        console.error("Error sending message:", e);
        setError(e.message || "Failed to get response from backend.");
        // Remove loading indicator on error as well
        const errLoadingId = loadingMessageIdRef.current;
        if (errLoadingId) {
            setChatHistory(prev => prev.filter(msg => msg.id !== errLoadingId));
        }
        loadingMessageIdRef.current = null;
    } finally {
        setIsLoading(false);
        // Ensure loading indicator is removed even if error handling failed somehow
        const finalLoadingId = loadingMessageIdRef.current;
        if (finalLoadingId) {
            setChatHistory(prev => prev.filter(msg => msg.id !== finalLoadingId));
            loadingMessageIdRef.current = null;
        }
    }
  }, [userInput, appChatMode, currentThreadId, activeTabId, appModelLoadStatus, newChatSettings, currentSessionSettings, 
      addSessionTabAndMakeActive // ADDED DEPENDENCY
    ]);

  // --- Render --- 
  return (
    <div className={`App ${themeName}`}> {/* Apply theme class */}
      <ThemeLoader themeName={themeName} /> {/* Theme CSS loader */}

      {/* --- ADDED: Sidebar --- */}
      <Sidebar 
          isOpen={isSidebarOpen} 
          onToggle={() => setIsSidebarOpen(!isSidebarOpen)}
          // Pass model load related props
          modelLoaded={appModelLoadStatus === 'loaded'} // <-- Added explicit boolean
          setLoadStatus={handleModelLoadStatusChange}
          setLoading={setIsLoading} // Allow sidebar components to set global loading
          isLoading={isLoading}
          isModelLoaded={appModelLoadStatus === 'loaded'} // Pass derived boolean (alias for other panels)
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
          onLoadSession={(sessionData) => { // Modified onLoadSession for Sidebar
            // When loading from sidebar, first ensure App state is updated
            handleLoadSession(sessionData);
            // Then, tell useTabs to make this tab active and ensure it's in openTabs
            // This might involve adding a new function to useTabs like `ensureTabExistsAndSetActive`
            // For now, we assume handleTabSelect can be called if the tab is known to exist or 
            // that handleLoadSession might trigger a tab rename if label needs update.
            // A more robust solution would be:
            // 1. App calls handleLoadSession(sessionData)
            // 2. App calls a hook function like hook.addOrUpdateTab(sessionData.thread_id, sessionData.title)
            // 3. App calls hook.handleTabSelect(sessionData.thread_id)
            // Let's simplify for now: Sidebar calls handleLoadSession, then if the tab isn't active,
            // the user would click it, or we could programmatically call handleTabSelect.
            // The simplest for now: Sidebar loads the session, and if the tab needs to be activated,
            // it should ideally just call handleTabSelect(sessionData.thread_id) if the tab exists.
            // If the tab might *not* exist, Sidebar should call something like addSessionTabAndMakeActive.
            // Let's assume Sidebar's onLoadSession means "load this data and make it the active view".
            // So, after App's handleLoadSession updates data:
            if (sessionData && sessionData.thread_id) {
                const tabLabel = sessionData.custom_title || sessionData.title || `Session ${sessionData.thread_id.substring(0,6)}...`;
                // Ensure tab exists or is updated, and then make it active
                addSessionTabAndMakeActive(sessionData.thread_id, tabLabel, activeTabId); // activeTabId here is the current one before switching
                // The addSessionTabAndMakeActive will set it active.
            }
          }}
          loadedSessionSettings={currentSessionSettings}
          onTabRename={handleTabRename} // Pass from useTabs
          activeTabId={activeTabId} // Pass from useTabs
          newChatSettings={newChatSettings}
          onNewChatSettingsChange={setNewChatSettings} // Pass the setter
          onSessionSettingsChange={handleCurrentSessionSettingsChange}
      />
      {/* --- END: Sidebar --- */}

      <div className={`main-content ${isSidebarOpen ? 'sidebar-open' : 'sidebar-closed'}`}>
          <header className="app-header">
            <button onClick={() => setIsSidebarOpen(!isSidebarOpen)} className="sidebar-toggle-btn header-btn">
              {/* Use a hamburger icon (Unicode) */} {'☰'}
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
