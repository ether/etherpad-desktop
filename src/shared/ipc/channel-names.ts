/**
 * Channel name constants split off from `channels.ts` so the preload bundle
 * doesn't transitively pull in `zod` (which can't be resolved in Electron's
 * sandboxed preload context — see AGENTS.md gotcha on preload bundling).
 *
 * Main process keeps importing from `./channels.js` to get both the names
 * and the Zod payload schemas in one place.
 */
export const CH = {
  GET_INITIAL_STATE: 'state.getInitial',
  WORKSPACE_LIST: 'workspace.list',
  WORKSPACE_ADD: 'workspace.add',
  WORKSPACE_UPDATE: 'workspace.update',
  WORKSPACE_REMOVE: 'workspace.remove',
  WORKSPACE_REORDER: 'workspace.reorder',
  TAB_OPEN: 'tab.open',
  TAB_CLOSE: 'tab.close',
  TAB_FOCUS: 'tab.focus',
  TAB_RELOAD: 'tab.reload',
  WINDOW_SET_ACTIVE_WORKSPACE: 'window.setActiveWorkspace',
  WINDOW_RELOAD_SHELL: 'window.reloadShell',
  WINDOW_GET_INITIAL: 'window.getInitial',
  WINDOW_SET_PAD_VIEWS_HIDDEN: 'window.setPadViewsHidden',
  PAD_HISTORY_LIST: 'padHistory.list',
  PAD_HISTORY_PIN: 'padHistory.pin',
  PAD_HISTORY_UNPIN: 'padHistory.unpin',
  PAD_HISTORY_CLEAR_RECENT: 'padHistory.clearRecent',
  PAD_HISTORY_CLEAR_ALL: 'padHistory.clearAll',
  SETTINGS_GET: 'settings.get',
  SETTINGS_UPDATE: 'settings.update',
  EV_WORKSPACES_CHANGED: 'event.workspacesChanged',
  EV_PAD_HISTORY_CHANGED: 'event.padHistoryChanged',
  EV_TABS_CHANGED: 'event.tabsChanged',
  EV_TAB_STATE: 'event.tabState',
  EV_SETTINGS_CHANGED: 'event.settingsChanged',
  EV_HTTP_LOGIN_REQUEST: 'event.httpLoginRequest',
  UPDATER_CHECK_NOW: 'updater.checkNow',
  UPDATER_INSTALL_AND_RESTART: 'updater.installAndRestart',
  UPDATER_GET_STATE: 'updater.getState',
  EV_UPDATER_STATE: 'event.updaterState',
  QUICK_SWITCHER_SEARCH: 'quickSwitcher.search',
} as const;
