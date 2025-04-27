import React from 'react';

const ModelListItem = ({ model, onSelect, isSelected }) => {
  return (
    <li
      className={`model-list-item ${isSelected ? 'selected' : ''}`}
      onClick={() => onSelect(model)}
    >
      <div className="model-id">{model.id} {model.private && '(Private)'}</div>
      <div className="model-info">
        <span>Likes: {model.likes}</span>
        {model.pipeline_tag && <span>Task: {model.pipeline_tag}</span>}
      </div>
      {model.tags && model.tags.length > 0 && (
         <div className="model-tags">
            {model.tags.slice(0, 5).map(tag => <span key={tag} className="tag">{tag}</span>)}
         </div>
      )}
    </li>
  );
};

export default ModelListItem; 