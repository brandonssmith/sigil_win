import React, { useState, useEffect, useCallback } from 'react';
import './App.css'; // Add styles
import SearchInput from './components/SearchInput';
import ModelList from './components/ModelList';
import StatusBar from './components/StatusBar';
import LoadingSpinner from './components/LoadingSpinner';
import * as api from './services/api';

function App() {
  const [searchTerm, setSearchTerm] = useState('');
  const [models, setModels] = useState([]);
  const [selectedModel, setSelectedModel] = useState(null);
  const [isLoadingSearch, setIsLoadingSearch] = useState(false);
  const [isLoadingGatedCheck, setIsLoadingGatedCheck] = useState(false);
  const [searchError, setSearchError] = useState(null);

  const [userInfo, setUserInfo] = useState(null);
  const [tokenStatus, setTokenStatus] = useState('checking');

  const [gatedCheckResult, setGatedCheckResult] = useState(null);
  const [downloadStatus, setDownloadStatus] = useState({ status: 'idle', message: null, modelId: null });

  const [generalMessage, setGeneralMessage] = useState(null);
  const [messageType, setMessageType] = useState('info');

  // --- Effects ---
  useEffect(() => {
    const checkToken = async () => {
      setTokenStatus('checking');
      try {
        const user = await api.validateToken();
        if (user) {
          setUserInfo(user);
          setTokenStatus('valid');
        } else {
           setTokenStatus('invalid');
        }
      } catch (error) {
         setTokenStatus('invalid');
      }
    };
    checkToken();
  }, []);

  // --- Handlers ---
  const handleSearch = useCallback(async (query) => {
    setSearchTerm(query);
    setIsLoadingSearch(true);
    setSearchError(null);
    setModels([]);
    setSelectedModel(null);
    setGatedCheckResult(null);
    setGeneralMessage(null);
    try {
      const results = await api.searchModels(query);
      setModels(results);
    } catch (error) {
      setSearchError(error.message || 'Failed to fetch models.');
      setGeneralMessage(error.message || 'Failed to fetch models.');
      setMessageType('error');
    } finally {
      setIsLoadingSearch(false);
    }
  }, []);

  const handleSelectModel = useCallback(async (model) => {
      setSelectedModel(model);
      setGatedCheckResult(null);
      setDownloadStatus({ status: 'idle', message: null, modelId: null });
      setGeneralMessage(null);
      setMessageType('info');
      setIsLoadingGatedCheck(true);
      try {
          const result = await api.checkGated(model.id);
          setGatedCheckResult(result);
          if (!result.isGated) {
              const maxLength = 30;
              const truncatedId = model.id.length > maxLength 
                  ? `${model.id.substring(0, maxLength)}...` 
                  : model.id;
              setGeneralMessage(`✅ Ready: ${truncatedId}`);
              setMessageType('success');
          } else if (result.isGated) {
              setGeneralMessage(`🔒 Model ${model.id} requires permissions.`);
              setMessageType('warning');
          }
      } catch (error) {
          setGeneralMessage(`Failed to check gated status for ${model.id}: ${error.message}`);
          setMessageType('error');
          setGatedCheckResult({ modelId: model.id, isGated: true });
      } finally {
           setIsLoadingGatedCheck(false);
      }

  }, []);

 const handleDownload = useCallback(async (modelId) => {
     setDownloadStatus({ status: 'downloading', message: `Requesting download for ${modelId}...`, modelId });
     setGeneralMessage(null);
     try {
         const result = await api.requestDownload(modelId);
         setDownloadStatus({ status: 'success', message: result.message || `Download initiated for ${modelId}. Check backend logs.`, modelId });
          setGeneralMessage(result.message || `Download initiated for ${modelId}.`);
          setMessageType('success');
     } catch (error) {
         setDownloadStatus({ status: 'error', message: `Download failed: ${error.message}`, modelId });
         setGeneralMessage(`Download failed: ${error.message}`);
         setMessageType('error');
     }
 }, []);


  return (
    <div className="app-container">
      <h1>Sigil Model Downloader</h1>
      <StatusBar
          userInfo={userInfo}
          tokenStatus={tokenStatus}
          generalMessage={generalMessage}
          messageType={messageType}
       />

      <SearchInput onSearch={handleSearch} isLoading={isLoadingSearch} />

      {searchError && <p className="error search-error">Search Error: {searchError}</p>}

      <ModelList
        models={models}
        selectedModel={selectedModel}
        onSelectModel={handleSelectModel}
        isLoadingSearch={isLoadingSearch}
        isLoadingGatedCheck={isLoadingGatedCheck && gatedCheckResult?.modelId === selectedModel?.id}
        gatedCheckResult={gatedCheckResult}
        onDownload={handleDownload}
        onRetryDownload={handleDownload} // Retry is just another download attempt
        downloadStatus={downloadStatus}
      />
    </div>
  );
}

export default App; 