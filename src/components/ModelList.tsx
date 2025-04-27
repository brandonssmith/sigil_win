// src/components/ModelList.tsx
import React from 'react';
import ModelListItem from './ModelListItem';
import LoadingSpinner from './LoadingSpinner';

const ModelList = ({
  models,
  selectedModel,
  onSelectModel,
  isLoadingSearch,
  isLoadingGatedCheck,
  gatedCheckResult,
  onDownload,
  onRetryDownload,
  downloadStatus,
}) => {

  const handleOpenLicense = (modelId) => {
      window.open(`https://huggingface.co/${modelId}`, '_blank');
  };

  const isCurrentModelDownloading = downloadStatus.status === 'downloading' && downloadStatus.modelId === selectedModel?.id;
  const showRetryButton = gatedCheckResult?.isGated && gatedCheckResult?.modelId === selectedModel?.id;
  const showDownloadButton = selectedModel && (!gatedCheckResult || (gatedCheckResult.modelId === selectedModel.id && !gatedCheckResult.isGated));

  return (
    <div className="model-list-container">
      <h2>Search Results</h2>
      {isLoadingSearch && <LoadingSpinner />}
      {!isLoadingSearch && models.length === 0 && <p>No models found. Try another search.</p>}
      {!isLoadingSearch && models.length > 0 && (
        <ul className="model-list">
          {models.map((model) => (
            <ModelListItem
              key={model.id}
              model={model}
              onSelect={onSelectModel}
              isSelected={selectedModel?.id === model.id}
            />
          ))}
        </ul>
      )}

       {/* Selected Model Details / Actions Panel */}
       {selectedModel && (
           <div className="selected-model-details">
               <h3>Selected: {selectedModel.id}</h3>
               {isLoadingGatedCheck && selectedModel.id === gatedCheckResult?.modelId && <LoadingSpinner />}

                {/* Download Status for this model */}
               {downloadStatus.modelId === selectedModel.id && downloadStatus.status !== 'idle' && (
                   <p className={`download-feedback ${downloadStatus.status}`}>
                       {downloadStatus.message}
                   </p>
               )}

               {/* Gated Model Info & Actions */}
               {gatedCheckResult && gatedCheckResult.modelId === selectedModel.id && gatedCheckResult.isGated && (
                   <div className="gated-warning">
                       <p>⚠️ This model requires accepting a license agreement on Huggingface.</p>
                       <button onClick={() => handleOpenLicense(selectedModel.id)}>Open License Page</button>
                       <button onClick={() => onRetryDownload(selectedModel.id)} disabled={isCurrentModelDownloading}>
                           {isCurrentModelDownloading ? 'Downloading...' : 'Retry Download After Accepting'}
                       </button>
                   </div>
               )}

               {/* Direct Download Button (Non-gated or already checked) */}
                {showDownloadButton && (
                   <button onClick={() => onDownload(selectedModel.id)} disabled={isCurrentModelDownloading}>
                       {isCurrentModelDownloading ? 'Downloading...' : 'Download Model'}
                   </button>
               )}
           </div>
       )}
    </div>
  );
};

export default ModelList; 