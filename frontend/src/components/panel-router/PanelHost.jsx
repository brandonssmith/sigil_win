import React, { useState } from 'react';
import { panelRegistry, defaultOpenPanels } from './PanelManager';

const PanelHost = ({
  showSettings,
  modelLoaded,
  showModelLoad,
  setLoadStatus,
  setLoading,
  isLoading,
  currentModelPath
}) => {
  const [openPanels, setOpenPanels] = useState(defaultOpenPanels);

  return (
    <>
      {openPanels.map(({ id, x, y, width, height, isOpen }) => {
        if (id === 'settings' && !showSettings) {
          return null;
        }

        if (id === 'modelLoad' && !showModelLoad) {
          return null;
        }

        if (!isOpen && id !== 'settings' && id !== 'modelLoad') {
          return null;
        }

        const PanelComponent = panelRegistry[id]?.component;
        if (!PanelComponent) return null;

        let panelProps = {};
        if (id === 'settings') {
          panelProps = { modelLoaded };
        } else if (id === 'modelLoad') {
          panelProps = {
            setLoadStatus,
            setLoading,
            isLoading,
            isModelLoaded: modelLoaded,
            currentModelPath
          };
        } else if (id === 'logs') {
          panelProps = {};
        }

        return (
          <div
            key={id}
            style={{
              position: 'fixed',
              top: y,
              left: x,
              width,
              height,
              background: '#1e1e1e',
              border: '1px solid #555',
              borderRadius: '8px',
              padding: '8px',
              zIndex: 1000,
              overflow: 'auto',
              boxShadow: '0 0 10px rgba(0,0,0,0.5)',
            }}
          >
            <PanelComponent {...panelProps} />
          </div>
        );
      })}
    </>
  );
};

export default PanelHost;
