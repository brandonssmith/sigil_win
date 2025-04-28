import React, { useState, useRef, useCallback, useEffect } from 'react';
import { panelRegistry, defaultOpenPanels } from './PanelManager';
import PropTypes from 'prop-types';

const MIN_WIDTH = 200; // Minimum panel width
const MIN_HEIGHT = 150; // Minimum panel height

const PanelHost = ({
  showSettings,
  modelLoaded,
  setLoadStatus,
  setLoading,
  isLoading,
  currentModelPath,
  onChatModeChange,
  themeName,
  setThemeName,
  themeList,
  onHfUsernameUpdate,
  onDeviceUpdate,
  currentDevice
}) => {
  const [openPanels, setOpenPanels] = useState(defaultOpenPanels);
  const actionInfo = useRef({
    actionType: null,
    panelId: null,
    startX: 0, startY: 0,
    initialX: 0, initialY: 0,
    initialWidth: 0, initialHeight: 0
  });

  const handleMouseMove = useCallback((event) => {
    if (!actionInfo.current.actionType || !actionInfo.current.panelId) return;

    const dx = event.clientX - actionInfo.current.startX;
    const dy = event.clientY - actionInfo.current.startY;

    setOpenPanels(currentPanels =>
      currentPanels.map(panel => {
        if (panel.id !== actionInfo.current.panelId) {
          return panel;
        }

        if (actionInfo.current.actionType === 'drag') {
          const newX = actionInfo.current.initialX + dx;
          const newY = actionInfo.current.initialY + dy;
          return { ...panel, x: newX, y: newY };
        } else if (actionInfo.current.actionType === 'resize') {
          const newWidth = Math.max(MIN_WIDTH, actionInfo.current.initialWidth + dx);
          const newHeight = Math.max(MIN_HEIGHT, actionInfo.current.initialHeight + dy);
          return { ...panel, width: newWidth, height: newHeight };
        }
        return panel;
      })
    );
  }, []);

  const handleMouseUp = useCallback(() => {
    if (actionInfo.current.actionType) {
      actionInfo.current.actionType = null;
      actionInfo.current.panelId = null;
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
      document.body.style.cursor = 'default';
    }
  }, [handleMouseMove]);

  const handleMouseDownDrag = (event, panelId) => {
    if (['INPUT', 'BUTTON', 'TEXTAREA', 'SELECT'].includes(event.target.tagName)) {
      return;
    }
    if (event.target.dataset.resizeHandle) {
      return;
    }

    event.preventDefault();
    const panel = openPanels.find(p => p.id === panelId);
    if (!panel) return;

    actionInfo.current = {
      actionType: 'drag',
      panelId: panelId,
      startX: event.clientX, startY: event.clientY,
      initialX: panel.x, initialY: panel.y,
      initialWidth: panel.width, initialHeight: panel.height
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    document.body.style.cursor = 'move';
  };

  const handleMouseDownResize = (event, panelId) => {
    event.preventDefault();
    event.stopPropagation();

    const panel = openPanels.find(p => p.id === panelId);
    if (!panel) return;

    actionInfo.current = {
      actionType: 'resize',
      panelId: panelId,
      startX: event.clientX, startY: event.clientY,
      initialX: panel.x, initialY: panel.y,
      initialWidth: panel.width, initialHeight: panel.height
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
  };

  useEffect(() => {
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [handleMouseMove, handleMouseUp]);

  return (
    <>
      {openPanels.map(({ id, x, y, width, height, isOpen }) => {
        if (id === 'mainPanel' && !showSettings) {
          return null;
        }

        if (id !== 'mainPanel' && !isOpen) {
          return null;
        }

        const PanelComponent = panelRegistry[id]?.component;
        if (!PanelComponent) return null;

        let panelProps = {};
        if (id === 'mainPanel') {
          panelProps = {
            modelLoaded,
            setLoadStatus,
            setLoading,
            isLoading,
            currentModelPath,
            isModelLoaded: modelLoaded,
            onChatModeChange,
            themeName,
            setThemeName,
            themeList,
            onHfUsernameUpdate,
            onDeviceUpdate,
            currentDevice
          };
        } else if (id === 'logs') {
          panelProps = {};
        }

        return (
          <div
            key={id}
            onMouseDown={(e) => handleMouseDownDrag(e, id)}
            style={{
              position: 'fixed',
              top: y,
              left: x,
              width,
              height,
              background: '#1e1e1e',
              border: '1px solid #555',
              borderRadius: '8px',
              overflow: 'visible',
              boxShadow: '0 0 10px rgba(0,0,0,0.5)',
              userSelect: actionInfo.current.actionType ? 'none' : 'auto',
              cursor: actionInfo.current.actionType === 'drag' ? 'move' : 'default',
              zIndex: 1200,
            }}
          >
            <div style={{ padding: '8px', height: '100%', boxSizing: 'border-box', overflow: 'auto' }}>
              <PanelComponent {...panelProps} />
            </div>

            <div
              data-resize-handle="true"
              onMouseDown={(e) => handleMouseDownResize(e, id)}
              style={{
                position: 'absolute',
                bottom: '0px',
                right: '0px',
                width: '15px',
                height: '15px',
                cursor: 'nwse-resize',
                background: 'rgba(255, 255, 255, 0.2)',
                border: '1px solid rgba(0,0,0,0.3)',
                borderRadius: '0 0 4px 0',
                zIndex: 1001
              }}
            />
          </div>
        );
      })}
    </>
  );
};

PanelHost.propTypes = {
  showSettings: PropTypes.bool.isRequired,
  modelLoaded: PropTypes.bool.isRequired,
  setLoadStatus: PropTypes.func.isRequired,
  setLoading: PropTypes.func.isRequired,
  isLoading: PropTypes.bool.isRequired,
  currentModelPath: PropTypes.string.isRequired,
  onChatModeChange: PropTypes.func.isRequired,
  themeName: PropTypes.string.isRequired,
  setThemeName: PropTypes.func.isRequired,
  themeList: PropTypes.array.isRequired,
  onHfUsernameUpdate: PropTypes.func.isRequired,
  onDeviceUpdate: PropTypes.func.isRequired,
  currentDevice: PropTypes.oneOf(['cuda', 'cpu', null])
};

export default PanelHost;
