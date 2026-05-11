import { describe, it, expect, beforeEach } from 'vitest';
import { useShellStore, dialogActions } from '../../src/state/store';

beforeEach(() => useShellStore.setState(useShellStore.getInitialState()));

describe('shell store', () => {
  it('starts with no workspaces, no active workspace, dialogs closed', () => {
    const s = useShellStore.getState();
    expect(s.workspaces).toEqual([]);
    expect(s.workspaceOrder).toEqual([]);
    expect(s.activeWorkspaceId).toBeNull();
    expect(s.openDialog).toBeNull();
  });

  it('hydrate replaces workspaces + order', () => {
    useShellStore.getState().hydrate({
      workspaces: [{ id: 'a', name: 'A', serverUrl: 'https://a', color: '#000', createdAt: 1 }],
      workspaceOrder: ['a'],
      settings: {
        schemaVersion: 1,
        defaultZoom: 1,
        accentColor: '#000000',
        language: 'en',
        rememberOpenTabsOnQuit: true,
      } as Parameters<ReturnType<typeof useShellStore.getState>['hydrate']>[0]['settings'],
    });
    expect(useShellStore.getState().workspaces).toHaveLength(1);
  });

  it('setActiveWorkspace updates state', () => {
    useShellStore.getState().setActiveWorkspaceId('a');
    expect(useShellStore.getState().activeWorkspaceId).toBe('a');
  });

  it('dialogActions.openDialog sets dialog kind', () => {
    dialogActions.openDialog('addWorkspace');
    expect(useShellStore.getState().openDialog).toBe('addWorkspace');
  });

  it('replaceTabs replaces the tab list', () => {
    useShellStore.getState().replaceTabs([
      { tabId: 't', workspaceId: 'a', padName: 'p', title: 'p', state: 'loading' },
    ]);
    expect(useShellStore.getState().tabs).toHaveLength(1);
  });
});
