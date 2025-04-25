// import SettingsPanel from '../panels/SettingsPanel.jsx'; // No longer needed here
import LogsPanel from '../panels/LogsPanel.jsx';
// import ModelLoadPanel from '../ModelLoadPanel.jsx'; // No longer needed here
import CombinedPanel from '../panels/CombinedPanel.jsx'; // Import the new panel

// A registry of available panels
export const panelRegistry = {
  // Remove settings entry
  // settings: { ... },
  logs: {
    id: 'logs',
    title: 'Logs',
    component: LogsPanel,
  },
  // Remove modelLoad entry
  // modelLoad: { ... },
  // Add the new combined panel entry
  mainPanel: {
      id: 'mainPanel',
      title: 'Panel', // Generic title, maybe update later
      component: CombinedPanel,
  }
};

// Example of open panel state (can be managed with useState or Context later)
export const defaultOpenPanels = [
  // Remove settings entry
  // { id: 'settings', ... },
  // Remove modelLoad entry
  // { id: 'modelLoad', ... },
  // Add default state for the combined panel
  {
    id: 'mainPanel',
    x: 20,  // Adjust position as needed
    y: 70,
    width: 450, // Adjust size as needed
    height: 400,
    isOpen: false, // Start closed by default
  },
];
