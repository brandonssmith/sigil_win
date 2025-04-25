import SettingsPanel from '../panels/SettingsPanel.jsx';
import LogsPanel from '../panels/LogsPanel.jsx';
import ModelLoadPanel from '../ModelLoadPanel.jsx';

// A registry of available panels
export const panelRegistry = {
  settings: {
    id: 'settings',
    title: 'Settings',
    component: SettingsPanel,
  },
  logs: {
    id: 'logs',
    title: 'Logs',
    component: LogsPanel,
  },
  modelLoad: {
    id: 'modelLoad',
    title: 'Load Model',
    component: ModelLoadPanel,
  },
};

// Example of open panel state (can be managed with useState or Context later)
export const defaultOpenPanels = [
  {
    id: 'settings',
    x: 200,
    y: 100,
    width: 400,
    height: 300,
    isOpen: true,
  },
  {
    id: 'modelLoad',
    x: 650,
    y: 100,
    width: 400,
    height: 250,
    isOpen: true,
  },
];
