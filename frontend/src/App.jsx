import { useState, useEffect, useRef } from 'react';
import './App.css';
import ThemeLoader from './components/ThemeLoader';
import ModelLoadPanel from './components/ModelLoadPanel';
import SettingsPanel from './components/SettingsPanel';
import ChatModeSelector from './components/ChatModeSelector';
import { formatChatHistoryForBackend } from './utils/chatUtils'; // Import the utility function
import { API_BASE_URL } from './constants'; // Import shared constants

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

  // NEW Callback handlers for children
  const handleModelLoadStatusChange = (status) => {
    setAppModelLoadStatus(status);
    if (status === 'error') {
        // Optionally clear chat or show a persistent error if load fails
        setError('Model loading failed. Please check the path and try again.');
    } else {
        setError(null); // Clear previous errors on successful load or loading start
    }
  };

  const handleChatModeChange = (mode) => {
    setAppChatMode(mode);
    // Optionally clear chat history when mode changes?
    // setChatHistory([]); 
  };

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
      const response = await fetch(`${API_BASE_URL}/api/v1/chat-v2`, { // <-- Use chat-v2
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

  // Function to clear chat history (New)
  const handleClearChat = () => {
    setChatHistory([]);
    setError(null); // Also clear any existing errors
  };

  // Derived state for convenience
  const modelLoaded = appModelLoadStatus === 'loaded';

  return (
    <div className="app-layout"> 
      {/* Dynamically load the selected theme */}
      <ThemeLoader themeName={themeName} />
      {/* Left Panel: Settings and Model Load */}
      <div className="left-panel">
        <ModelLoadPanel 
          onModelLoadStatusChange={handleModelLoadStatusChange} // Pass callback
          // Removed props: modelPath, setModelPath, onLoadModel, modelLoadStatus, modelLoadError
        />
        <SettingsPanel
          modelLoaded={modelLoaded} // Pass derived loaded state
          // Removed props: settings state/setters, onReload, reloadStatus
        />
        {/* Chat Mode Selector (New) */}
        <ChatModeSelector
          modelLoaded={modelLoaded} // Pass derived loaded state
          onChatModeChange={handleChatModeChange} // Pass callback
          // Removed props: chatMode, setChatMode
        />
        {/* Theme switcher UI */}
        <div className="settings-group">
          <label htmlFor="theme-select">Theme:</label>
          <select id="theme-select" value={themeName} onChange={e => setThemeName(e.target.value)}>
            {themeList.map(theme => (
              <option key={theme} value={theme}>{theme}</option>
            ))}
          </select>
        </div>
      </div>
      {/* Right Panel: Chat Area */}
      <div className="chat-container">
        <header className="chat-header">
          <h1>Sigil</h1>
          {/* Optionally display model status here based on appModelLoadStatus */}
          {modelLoaded && <span className="model-status-indicator">Model Ready</span>}
          {appModelLoadStatus === 'idle' && <span className="model-status-indicator">Waiting for Model</span>}
          {appModelLoadStatus === 'error' && <span className="model-status-indicator error">Model Load Failed</span>}
          {appModelLoadStatus === 'loading' && <span className="model-status-indicator loading">Loading Model...</span>}
        </header>

        <div className="messages-area">
          {/* Display message asking user to load model if not loaded */}
          {appModelLoadStatus === 'idle' && (
            <div className="message system-message">
              <p>Please enter the model path and click 'Load Model' in the left panel to begin.</p>
            </div>
          )}
          {appModelLoadStatus === 'error' && (
             <div className="message system-message error-message"> 
               {/* Display general error state if set by load failure */} 
               <p>{error || 'Failed to load model. Check panel above for details.'}</p>
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
  );
}

export default App;
