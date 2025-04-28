import { useState, useEffect, useRef, useCallback } from 'react';
import './App.css';
import ThemeLoader from './components/ThemeLoader.jsx';
import ModelLoadPanel from './components/ModelLoadPanel.jsx';
import ChatModeSelector from './components/ChatModeSelector.jsx';
import { formatChatHistoryForBackend } from './utils/chatUtils.js'; // Import the utility function
import { API_BASE_URL } from './constants.js'; // Import shared constants
import DeviceIndicator from './components/DeviceIndicator.jsx'; // <-- Import the new component
import Sidebar from './components/Sidebar.jsx'; // <-- Import the new Sidebar

// Base API URL - Moved to constants.js
// const API_BASE_URL = 'http://localhost:8000';

// Default settings (could also fetch from backend on initial load)
const DEFAULT_SYSTEM_PROMPT = "You are a helpful assistant.";
const DEFAULT_TEMPERATURE = 0.7;
const DEFAULT_TEMPERATURE_CHAT = 0.7;
const DEFAULT_TOP_P = 0.95;
const DEFAULT_MAX_TOKENS = 1000;

// Message structure (implied):
// { sender: 'user' | 'backend' | 'system', text: string, id: string }

function App() {
  const [userInput, setUserInput] = useState('');
  const [chatHistory, setChatHistory] = useState([]); // Array of message objects
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null); // Error message string or null
  const messagesEndRef = useRef(null); // Ref for scrolling div
  const loadingMessageIdRef = useRef(null); // Ref to store loading message ID

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

  // Chat Mode State (New) - Removed, managed within ChatModeSelector
  // const [chatMode, setChatMode] = useState('instruction'); // 'instruction' or 'chat'

  // NEW State managed by App, updated via callbacks from children
  const [appModelLoadStatus, setAppModelLoadStatus] = useState('idle'); // 'idle', 'loading', 'loaded', 'error'
  const [appChatMode, setAppChatMode] = useState('instruction'); // 'instruction', 'chat'

  // --- THEME STATE ---
  const [themeName, setThemeName] = useState('AlienBlood'); // Default theme
  const [themeList, setThemeList] = useState([]);

  const [currentLoadedModelName, setCurrentLoadedModelName] = useState(null);
  const [showSettings, setShowSettings] = useState(true);
  const [hfUsername, setHfUsername] = useState(null); // <-- NEW: State for username
  const [currentDevice, setCurrentDevice] = useState(null); // <-- NEW: State for device (cuda/cpu)
  const [isSidebarOpen, setIsSidebarOpen] = useState(true); // <-- ADDED: Sidebar state

  // --- Define Callbacks First ---
  // Moved handleClearChat definition UP
  const handleClearChat = useCallback(() => {
    setChatHistory([]);
    setError(null); // Also clear any existing errors
  }, []); // Dependencies: setChatHistory, setError (stable)

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
    // Optionally clear chat history when mode changes?
    // setChatHistory([]); 
  };

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
  }, []);

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
    // Use appModelLoadStatus to check if model is loaded
    if (!trimmedInput || appModelLoadStatus !== 'loaded') return; 

    const userMessage = {
      sender: 'user',
      text: trimmedInput,
      id: `user-${Date.now()}`
    };
    // Add user message immediately
    setChatHistory(prev => [...prev, userMessage]);

    // Prepare history *before* adding loading message
    const historyForBackend = formatChatHistoryForBackend([...chatHistory, userMessage]); // Use imported function

    const loadingMsgId = `loading-${Date.now()}`;
    loadingMessageIdRef.current = loadingMsgId;
    const loadingMessage = {
        sender: 'system', // Use 'system' for visual distinction
        text: '...',
        id: loadingMsgId
    };
    // Add loading message
    setChatHistory(prev => [...prev, loadingMessage]);

    setUserInput('');
    setIsLoading(true);
    setError(null);

    let requestBody = {};
    // Use appChatMode to determine request body structure
    if (appChatMode === 'instruction') { 
      requestBody = {
        mode: 'instruction',
        message: trimmedInput
      };
    } else { // appChatMode === 'chat'
      requestBody = {
        mode: 'chat',
        messages: historyForBackend // Send the formatted history
      };
    }

    try {
      // Use the new v2 endpoint
      const response = await fetch(`${API_BASE_URL}/api/v1/chat/chat-v2`, { // <-- Add /chat prefix
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody), // Send the appropriate body
      });

      const idToRemove = loadingMessageIdRef.current;
      loadingMessageIdRef.current = null;
      // Remove loading message immediately after fetch starts
      if (idToRemove) {
        setChatHistory(prev => prev.filter(msg => msg.id !== idToRemove));
      }

      const data = await response.json(); // Always parse JSON

      if (!response.ok) {
        throw new Error(data.detail || `HTTP error! status: ${response.status}`);
      }

      console.log("Backend response data:", data);
      const backendMessage = {
        sender: 'backend',
        text: data.response || 'Backend did not provide a response.',
        id: `backend-${Date.now()}`
      };
      // Add backend response
      setChatHistory(prev => [...prev, backendMessage]);

    } catch (e) { 
      console.error('Fetch error:', e);
      const errorMessage = `Failed to fetch: ${e.message}`;
      setError(errorMessage); // Set the main error display

      // Ensure loading message is removed on error and add system error message
      const idToRemoveOnError = loadingMessageIdRef.current;
      loadingMessageIdRef.current = null;
      setChatHistory(prev => [
          ...prev.filter(msg => msg.id !== idToRemoveOnError), // Remove loading message if it was still there
          { sender: 'system', text: `Error: ${e.message}`, id: `error-${Date.now()}` }
      ]);

    } finally {
      setIsLoading(false);
      // Final check for safety, though likely redundant now
      const finalIdToRemove = loadingMessageIdRef.current;
      if (finalIdToRemove) {
         loadingMessageIdRef.current = null;
         setChatHistory(prev => prev.filter(msg => msg.id !== finalIdToRemove));
      }
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
            onChatModeChange={handleChatModeChange}
            themeName={themeName}
            setThemeName={setThemeName}
            themeList={themeList}
            onHfUsernameUpdate={handleHfUsernameUpdate}
            onDeviceUpdate={handleDeviceUpdate}
            currentDevice={currentDevice}
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
            
            {/* Model Status Group */}
            <div className="model-status-group">
              {modelLoaded && <span className="model-status-indicator">Model Ready</span>}
              {appModelLoadStatus === 'idle' && <span className="model-status-indicator">Waiting for Model</span>}
              {appModelLoadStatus === 'error' && <span className="model-status-indicator error">Model Load Failed</span>}
              {appModelLoadStatus === 'loading' && <span className="model-status-indicator loading">Loading Model...</span>}
            </div>
          </header>

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
                  <div className="dots-container"><span>.</span><span>.</span><span>.</span></div>
                ) : (
                  <p>{msg.text}</p>
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

          <form onSubmit={handleSubmit} className="input-bar">
            <input
              type="text"
              value={userInput}
              onChange={(e) => setUserInput(e.target.value)}
              placeholder={modelLoaded ? "Type your message..." : "Load model first..."}
              disabled={isLoading || !modelLoaded} // Disable if chat is loading OR model not loaded
              aria-label="Chat message input"
            />
            <button type="submit" disabled={isLoading || !modelLoaded}> 
              Send
            </button>
          </form>
        </div>
      </div> 
      {/* End of app-layout div */}
    </> // End Fragment
  );
}

export default App;
