import { useState, useEffect, useRef } from 'react';
import './App.css';
import ThemeLoader from './components/ThemeLoader';

// Base API URL (makes it easier to change)
const API_BASE_URL = 'http://localhost:8000';

// Default settings (could also fetch from backend on initial load)
const DEFAULT_SYSTEM_PROMPT = "You are a helpful assistant.";
const DEFAULT_TEMPERATURE = 0.7;
const DEFAULT_TEMPERATURE_CHAT = 0.7;
const DEFAULT_TOP_P = 0.95;
const DEFAULT_MAX_TOKENS = 1000;

// Message structure (implied):
// { sender: 'user' | 'backend' | 'system', text: string, id: string }

// --- Model Load Panel Component ---
function ModelLoadPanel({ 
  modelPath, setModelPath, 
  onLoadModel, modelLoadStatus, 
  modelLoadError 
}) {
  const isLoading = modelLoadStatus === 'loading';
  const isLoaded = modelLoadStatus === 'loaded';

  return (
    <div className="model-load-panel settings-group"> {/* Reusing settings-group style */}
      <label htmlFor="model-path">Model Path:</label>
      <input
        type="text"
        id="model-path"
        value={modelPath}
        onChange={(e) => setModelPath(e.target.value)}
        placeholder="e.g., ./models/tinyllama or /path/to/model"
        disabled={isLoading || isLoaded} // Disable input after load
      />
      <button onClick={onLoadModel} disabled={isLoading || isLoaded || !modelPath.trim()}>
        {isLoading ? 'Loading Model...' : isLoaded ? 'Model Loaded' : 'Load Model'}
      </button>
      {modelLoadStatus === 'error' && <p className="error-message">Load failed: {modelLoadError}</p>}
      {isLoaded && <p className="success-message">Model loaded successfully!</p>}
    </div>
  );
}

// Settings Panel Component
function SettingsPanel({ 
    systemPrompt, setSystemPrompt,
    temperature, setTemperature,
    topP, setTopP,
    maxTokens, setMaxTokens,
    onReload, reloadStatus,
    modelLoaded // New prop to disable reload if model not loaded
 }) {
  const isLoading = reloadStatus === 'loading';

  return (
    <div className="settings-panel">
      <h2>Settings</h2>
      <div className="settings-group">
        <label htmlFor="system-prompt">System Prompt:</label>
        <textarea
          id="system-prompt"
          value={systemPrompt}
          onChange={(e) => setSystemPrompt(e.target.value)}
          rows={5}
          disabled={!modelLoaded} // Disable if model not loaded
        />
      </div>
      <div className="settings-group">
        <label htmlFor="temperature">Temperature:</label>
        <input
          type="number"
          id="temperature"
          value={temperature}
          onChange={(e) => setTemperature(parseFloat(e.target.value) || 0)}
          min="0"
          max="2.0" // Match backend validation
          step="0.1"
          disabled={!modelLoaded} // Disable if model not loaded
        />
      </div>
       <div className="settings-group">
        <label htmlFor="top-p">Top P:</label>
        <input
          type="number"
          id="top-p"
          value={topP}
          onChange={(e) => setTopP(parseFloat(e.target.value) || 0)}
          min="0"
          max="1.0"
          step="0.05"
          disabled={!modelLoaded} // Disable if model not loaded
        />
      </div>
       <div className="settings-group">
        <label htmlFor="max-tokens">Max New Tokens:</label>
        <input
          type="number"
          id="max-tokens"
          value={maxTokens}
          onChange={(e) => setMaxTokens(parseInt(e.target.value, 10) || 1)}
          min="1"
          step="50"
          disabled={!modelLoaded} // Disable if model not loaded
        />
      </div>
      <button onClick={onReload} disabled={isLoading || !modelLoaded}> 
        {isLoading ? 'Applying...' : 'Apply Settings'}
      </button>
      {reloadStatus === 'success' && <p className="success-message">Settings applied!</p>}
      {reloadStatus === 'error' && <p className="error-message">Failed to apply settings.</p>}
    </div>
  );
}

// --- Chat Mode Selection Component --- (New)
function ChatModeSelector({ chatMode, setChatMode, modelLoaded }) {
  return (
    <div className="settings-group chat-mode-selector">
      <label>Chat Mode:</label>
      <div className="radio-group">
        <label>
          <input
            type="radio"
            name="chatMode"
            value="instruction"
            checked={chatMode === 'instruction'}
            onChange={() => setChatMode('instruction')}
            disabled={!modelLoaded}
          />
          Instruction
        </label>
        <label>
          <input
            type="radio"
            name="chatMode"
            value="chat"
            checked={chatMode === 'chat'}
            onChange={() => setChatMode('chat')}
            disabled={!modelLoaded}
          />
          Chat
        </label>
      </div>
    </div>
  );
}

function App() {
  const [userInput, setUserInput] = useState('');
  const [chatHistory, setChatHistory] = useState([]); // Array of message objects
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null); // Error message string or null
  const messagesEndRef = useRef(null); // Ref for scrolling div
  const loadingMessageIdRef = useRef(null); // Ref to store loading message ID

  // Settings State
  const [systemPrompt, setSystemPrompt] = useState(DEFAULT_SYSTEM_PROMPT);
  const [temperature, setTemperature] = useState(DEFAULT_TEMPERATURE);
  const [topP, setTopP] = useState(DEFAULT_TOP_P);
  const [maxTokens, setMaxTokens] = useState(DEFAULT_MAX_TOKENS);
  const [reloadStatus, setReloadStatus] = useState(null); // null | 'loading' | 'success' | 'error'

  // New Model Loading State
  const [modelPathInput, setModelPathInput] = useState(''); // Input field value
  const [modelLoadStatus, setModelLoadStatus] = useState('idle'); // 'idle' | 'loading' | 'loaded' | 'error'
  const [modelLoadError, setModelLoadError] = useState(null); // Error message for model load

  // Chat Mode State (New)
  const [chatMode, setChatMode] = useState('instruction'); // 'instruction' or 'chat'

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

  // Handler for loading the model
  const handleLoadModel = async () => {
    setModelLoadStatus('loading');
    setModelLoadError(null);
    const path = modelPathInput.trim();
    if (!path) {
      setModelLoadError('Model path cannot be empty.');
      setModelLoadStatus('error');
      return;
    }

    try {
      const response = await fetch(`${API_BASE_URL}/api/v1/model/load`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ path: path }), // Send the path
      });

      const data = await response.json(); // Always try to parse JSON

      if (!response.ok) {
        // Use detail from JSON if available, otherwise statusText
        throw new Error(data.detail || `HTTP error! status: ${response.status}`);
      }

      console.log("Load model response:", data);
      setModelLoadStatus('loaded');
       // Optional: Clear success message after delay or keep it
      // setTimeout(() => setModelLoadStatus(null), 3000); // Example

    } catch (err) {
       console.error('Failed to load model:', err);
       setModelLoadError(err.message || 'An unknown error occurred');
       setModelLoadStatus('error');
       // Optional: Clear error message after delay
       // setTimeout(() => setModelLoadStatus('idle'), 5000);
    }
  };

  // Handler for applying model settings (previously reload)
  const handleApplySettings = async () => {
    setReloadStatus('loading');
    setError(null); // Clear main error display
    try {
      // Use the new endpoint path
      const response = await fetch(`${API_BASE_URL}/api/v1/settings/update`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ 
            // Ensure names match Pydantic model in backend
            system_prompt: systemPrompt,
            temperature: temperature,
            top_p: topP,
            max_new_tokens: maxTokens
        }),
      });

      const data = await response.json(); // Always try to parse JSON

      if (!response.ok) {
        throw new Error(data.detail || `HTTP error! status: ${response.status}`);
      }

      console.log("Apply settings response:", data);
      setReloadStatus('success');
       // Hide success message after a delay
      setTimeout(() => setReloadStatus(null), 2000);

    } catch (err) {
       console.error('Failed to apply model settings:', err);
       setError(`Apply settings failed: ${err.message}`); // Show error
       setReloadStatus('error');
       // Hide error message after a delay
       setTimeout(() => setReloadStatus(null), 3000);
    }
  };

  // Helper to format chat history for the backend
  const formatChatHistoryForBackend = (history) => {
    return history
      .filter(msg => msg.sender === 'user' || msg.sender === 'backend') // Only user/backend messages
      .map(msg => ({ // Convert to {role: ..., content: ...}
        role: msg.sender === 'user' ? 'user' : 'assistant',
        content: msg.text
      }));
  };

  const handleSubmit = async (event) => { // Removed event type
    event.preventDefault();
    const trimmedInput = userInput.trim();
    if (!trimmedInput || modelLoadStatus !== 'loaded') return; // Don't submit if model not loaded

    const userMessage = {
      sender: 'user',
      text: trimmedInput,
      id: `user-${Date.now()}`
    };
    // Add user message immediately
    setChatHistory(prev => [...prev, userMessage]);

    // Prepare history *before* adding loading message
    const historyForBackend = formatChatHistoryForBackend([...chatHistory, userMessage]);

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
    if (chatMode === 'instruction') {
      requestBody = {
        mode: 'instruction',
        message: trimmedInput
      };
    } else { // chatMode === 'chat'
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

    } catch (e) { // Removed type catch error
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

  const modelLoaded = modelLoadStatus === 'loaded';

  return (
    <div className="app-layout"> 
      {/* Dynamically load the selected theme */}
      <ThemeLoader themeName={themeName} />
      {/* Left Panel: Settings and Model Load */}
      <div className="left-panel">
        <ModelLoadPanel 
          modelPath={modelPathInput}
          setModelPath={setModelPathInput}
          onLoadModel={handleLoadModel}
          modelLoadStatus={modelLoadStatus}
          modelLoadError={modelLoadError}
        />
        <SettingsPanel
          systemPrompt={systemPrompt}
          setSystemPrompt={setSystemPrompt}
          temperature={temperature}
          setTemperature={setTemperature}
          topP={topP}
          setTopP={setTopP}
          maxTokens={maxTokens}
          setMaxTokens={setMaxTokens}
          onReload={handleApplySettings}
          reloadStatus={reloadStatus}
          modelLoaded={modelLoaded}
        />
        {/* Chat Mode Selector (New) */}
        <ChatModeSelector
          chatMode={chatMode}
          setChatMode={setChatMode}
          modelLoaded={modelLoaded}
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
          {/* Optionally display model status here */} 
          {modelLoaded && <span className="model-status-indicator">Model Ready</span>}
          {!modelLoaded && modelLoadStatus !== 'loading' && <span className="model-status-indicator error">Model Not Loaded</span>}
          {modelLoadStatus === 'loading' && <span className="model-status-indicator loading">Loading Model...</span>}
        </header>

        <div className="messages-area">
          {/* Display message asking user to load model if not loaded */}
          {modelLoadStatus === 'idle' && (
            <div className="message system-message">
              <p>Please enter the model path and click 'Load Model' in the left panel to begin.</p>
            </div>
          )}
          {modelLoadStatus === 'error' && (
             <div className="message system-message error-message"> 
               <p>Failed to load model. Check the path and console for details. Error: {modelLoadError}</p>
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

         {/* Display general fetch error message if it exists */}
         {error && <p className="error-message chat-error">Chat Error: {error}</p>}

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
