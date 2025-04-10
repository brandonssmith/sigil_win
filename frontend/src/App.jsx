import { useState, useEffect, useRef } from 'react';
import './App.css';

// Default settings (could also fetch from backend on initial load)
const DEFAULT_SYSTEM_PROMPT = "You are a helpful assistant.";
const DEFAULT_TEMPERATURE = 0.7;
const DEFAULT_TOP_P = 0.95;
const DEFAULT_MAX_TOKENS = 1000;

// Message structure (implied):
// { sender: 'user' | 'backend' | 'system', text: string, id: string }

// Settings Panel Component
function SettingsPanel({ 
    systemPrompt, setSystemPrompt,
    temperature, setTemperature,
    topP, setTopP,
    maxTokens, setMaxTokens,
    onReload, reloadStatus
 }) {
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
        />
      </div>
      <button onClick={onReload} disabled={reloadStatus === 'loading'}>
        {reloadStatus === 'loading' ? 'Reloading...' : 'Reload Model'}
      </button>
      {reloadStatus === 'success' && <p className="reload-success">Settings updated!</p>}
      {reloadStatus === 'error' && <p className="reload-error">Failed to update.</p>}
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

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [chatHistory]);

  // Handler for reloading model settings
  const handleReloadModel = async () => {
    setReloadStatus('loading');
    try {
      const response = await fetch('http://localhost:8000/reload_model', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ 
            system_prompt: systemPrompt,
            temperature: temperature,
            top_p: topP,
            max_new_tokens: maxTokens
        }),
      });

      if (!response.ok) {
        // Attempt to get error details from response body
        let errorMsg = `HTTP error! status: ${response.status}`;
         try {
            const errorData = await response.json();
            errorMsg = errorData.detail || errorMsg; // Use detail if available
        } catch (jsonError) { /* Ignore if parsing fails */ }
        throw new Error(errorMsg);
      }

      const data = await response.json();
      console.log("Reload response:", data);
      setReloadStatus('success');
       // Hide success message after a delay
      setTimeout(() => setReloadStatus(null), 2000);

    } catch (err) {
       console.error('Failed to reload model settings:', err);
       setError(`Reload failed: ${err.message}`); // Show reload error in main error display for now
       setReloadStatus('error');
       // Hide error message after a delay
       setTimeout(() => setReloadStatus(null), 3000);
    }
  };

  const handleSubmit = async (event) => { // Removed event type
    event.preventDefault();
    const trimmedInput = userInput.trim();
    if (!trimmedInput) return;

    const userMessage = {
      sender: 'user',
      text: trimmedInput,
      id: `user-${Date.now()}` // Simple unique ID
    };
    // Add user message first
    setChatHistory(prev => [...prev, userMessage]);

    // Generate ID and add loading message
    const loadingMsgId = `loading-${Date.now()}`;
    loadingMessageIdRef.current = loadingMsgId; // Store the ID
    const loadingMessage = {
        sender: 'system',
        text: '...',
        id: loadingMsgId
    };
    // Add loading message immediately after user message
    setChatHistory(prev => [...prev, loadingMessage]);

    setUserInput('');
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch('http://localhost:8000/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ message: trimmedInput }),
      });

      // --- Remove loading message --- 
      // Store current ID and clear ref *before* potential async state update
      const idToRemove = loadingMessageIdRef.current;
      loadingMessageIdRef.current = null;
      if (idToRemove) {
        setChatHistory(prev => prev.filter(msg => msg.id !== idToRemove));
      }
      // -----------------------------

      if (!response.ok) {
        let errorMsg = response.statusText;
        try {
            const errorData = await response.json();
            errorMsg = errorData.detail || errorMsg;
        } catch (jsonError) { /* Ignore */ }
        throw new Error(`HTTP error! status: ${response.status}, message: ${errorMsg}`);
      }

      const data = await response.json();
      console.log("Backend response data:", data);
      const backendMessage = {
        sender: 'backend',
        text: data.response || 'Backend did not provide a response.',
        id: `backend-${Date.now()}`
      };
      // Add backend message (loading message is already removed)
      setChatHistory(prev => [...prev, backendMessage]);

    } catch (e) { // Removed type catch error
      console.error('Fetch error:', e);
      const errorMessage = `Failed to fetch: ${e.message}`;
      setError(errorMessage);
      
      // --- Ensure loading message is removed on error --- 
      const idToRemoveOnError = loadingMessageIdRef.current;
      loadingMessageIdRef.current = null;
      if (idToRemoveOnError) {
         // Remove loading message AND add error message
         setChatHistory(prev => [
           ...prev.filter(msg => msg.id !== idToRemoveOnError),
           { sender: 'system', text: `Error: ${e.message}`, id: `error-${Date.now()}` }
         ]);
      } else {
        // Loading message was already removed, just add error
        setChatHistory(prev => [
           ...prev,
           { sender: 'system', text: `Error: ${e.message}`, id: `error-${Date.now()}` }
         ]);
      }
      // --------------------------------------------------
      
    } finally {
      setIsLoading(false);
      // Final check to remove loading message if something went wrong
      const finalIdToRemove = loadingMessageIdRef.current;
      if (finalIdToRemove) {
         loadingMessageIdRef.current = null;
         setChatHistory(prev => prev.filter(msg => msg.id !== finalIdToRemove));
      }
      // Use timeout to ensure scroll happens after potential re-render from history update
      setTimeout(scrollToBottom, 0);
    }
  };

  return (
    <div className="app-layout"> {/* New top-level layout container */}
      <SettingsPanel
        systemPrompt={systemPrompt}
        setSystemPrompt={setSystemPrompt}
        temperature={temperature}
        setTemperature={setTemperature}
        topP={topP}
        setTopP={setTopP}
        maxTokens={maxTokens}
        setMaxTokens={setMaxTokens}
        onReload={handleReloadModel}
        reloadStatus={reloadStatus}
      />
      <div className="chat-container"> {/* Existing chat container */}
        <header className="chat-header">
          <h1>Prometheus</h1>
        </header>

        <div className="messages-area">
          {chatHistory.map((msg) => (
            <div key={msg.id} className={`message ${msg.sender}-message ${msg.id.startsWith('loading-') ? 'loading-message' : ''}`}>
              {/* Conditionally render dots as spans if it's a loading message */}
              {msg.id.startsWith('loading-') ? (
                <div className="dots-container">
                  <span>.</span>
                  <span>.</span>
                  <span>.</span>
                </div>
              ) : (
                <p>{msg.text}</p>
              )}
            </div>
          ))}
          <div ref={messagesEndRef} />
        </div>

         {/* Display fetch error message if it exists */}
         {error && <p className="error-message">{error}</p>}

        <form onSubmit={handleSubmit} className="input-bar">
          <input
            type="text"
            value={userInput}
            // Removed event type
            onChange={(e) => setUserInput(e.target.value)}
            placeholder="Type your message..."
            disabled={isLoading}
            aria-label="Chat message input"
          />
          <button type="submit" disabled={isLoading}>
            {/* Keep button text simple even when loading */}
            Send
          </button>
        </form>
      </div>
    </div>
  );
}

export default App;
