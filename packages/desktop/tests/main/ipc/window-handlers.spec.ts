// tests/main/ipc/window-handlers.spec.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { windowHandlers } from '../../../src/main/ipc/window-handlers';

let setActiveWorkspace: ReturnType<typeof vi.fn>;
let reloadShell: ReturnType<typeof vi.fn>;
let setPadViewsHidden: ReturnType<typeof vi.fn>;
let emitTabsChanged: ReturnType<typeof vi.fn>;
let h: ReturnType<typeof windowHandlers>;

beforeEach(() => {
  setActiveWorkspace = vi.fn();
  reloadShell = vi.fn();
  setPadViewsHidden = vi.fn();
  emitTabsChanged = vi.fn();
  h = windowHandlers({
    setActiveWorkspaceForActiveWindow: setActiveWorkspace,
    reloadShellOfActiveWindow: reloadShell,
    setPadViewsHiddenForActiveWindow: setPadViewsHidden,
    emitTabsChanged,
  });
});

describe('window.setActiveWorkspace', () => {
  it('calls setActiveWorkspaceForActiveWindow with workspaceId and emits tabsChanged', async () => {
    const r = await h.setActiveWorkspace(undefined, { workspaceId: '00000000-0000-4000-8000-000000000001' });
    expect(r.ok).toBe(true);
    expect(setActiveWorkspace).toHaveBeenCalledWith('00000000-0000-4000-8000-000000000001');
    expect(emitTabsChanged).toHaveBeenCalledTimes(1);
  });

  it('accepts null workspaceId', async () => {
    const r = await h.setActiveWorkspace(undefined, { workspaceId: null });
    expect(r.ok).toBe(true);
    expect(setActiveWorkspace).toHaveBeenCalledWith(null);
  });

  it('returns InvalidPayloadError for missing workspaceId field', async () => {
    const r = await h.setActiveWorkspace(undefined, {} as never);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.kind).toBe('InvalidPayloadError');
  });
});

describe('window.reloadShell', () => {
  it('calls reloadShellOfActiveWindow', async () => {
    const r = await h.reloadShell(undefined, {});
    expect(r.ok).toBe(true);
    expect(reloadShell).toHaveBeenCalledTimes(1);
  });
});

describe('window.setPadViewsHidden', () => {
  it('calls setPadViewsHiddenForActiveWindow with hidden=true', async () => {
    const r = await h.setPadViewsHidden(undefined, { hidden: true });
    expect(r.ok).toBe(true);
    expect(setPadViewsHidden).toHaveBeenCalledWith(true);
  });

  it('calls setPadViewsHiddenForActiveWindow with hidden=false', async () => {
    const r = await h.setPadViewsHidden(undefined, { hidden: false });
    expect(r.ok).toBe(true);
    expect(setPadViewsHidden).toHaveBeenCalledWith(false);
  });

  it('returns InvalidPayloadError when hidden field is missing', async () => {
    const r = await h.setPadViewsHidden(undefined, {} as never);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.kind).toBe('InvalidPayloadError');
  });
});
