export type TabState = 'loading' | 'loaded' | 'error' | 'crashed';

export type OpenTab = {
  tabId: string;
  workspaceId: string;
  padName: string;
  title: string;
  state: TabState;
  errorMessage?: string;
};
