// tests/main/app/tray.spec.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';

// vi.hoisted ensures these run before vi.mock factories
const { MockTray, mockTrayInstance, MockMenuBuildFromTemplate } = vi.hoisted(() => {
  const inst = {
    setToolTip: vi.fn(),
    setContextMenu: vi.fn(),
    on: vi.fn(),
    destroy: vi.fn(),
  };
  // Must be a regular function (not arrow) so it can be used as a constructor via `new`.
  const Ctor = vi.fn(function TrayMock() { return inst; });
  const buildFromTemplate = vi.fn(() => ({}));
  return { MockTray: Ctor, mockTrayInstance: inst, MockMenuBuildFromTemplate: buildFromTemplate };
});

vi.mock('electron', () => ({
  Tray: MockTray,
  Menu: { buildFromTemplate: MockMenuBuildFromTemplate },
  nativeImage: { createFromPath: vi.fn().mockReturnValue({}) },
}));

import { setupTray } from '../../../src/main/app/tray';

function makeOpts() {
  return {
    iconPath: '/tmp/icon.png',
    onShow: vi.fn(),
    onQuit: vi.fn(),
  };
}

beforeEach(() => {
  mockTrayInstance.setToolTip.mockReset();
  mockTrayInstance.setContextMenu.mockReset();
  mockTrayInstance.on.mockReset();
  mockTrayInstance.destroy.mockReset();
  MockTray.mockClear();
  MockMenuBuildFromTemplate.mockClear();
  MockMenuBuildFromTemplate.mockReturnValue({});
});

describe('setupTray', () => {
  it('creates Tray on setEnabled(true)', () => {
    const ctl = setupTray(makeOpts());
    ctl.setEnabled(true);
    expect(MockTray).toHaveBeenCalledTimes(1);
    expect(mockTrayInstance.setToolTip).toHaveBeenCalledWith('Etherpad Desktop');
  });

  it('destroys Tray on setEnabled(false) after enable', () => {
    const ctl = setupTray(makeOpts());
    ctl.setEnabled(true);
    ctl.setEnabled(false);
    expect(mockTrayInstance.destroy).toHaveBeenCalledTimes(1);
  });

  it('setEnabled(true) is idempotent — does not duplicate tray', () => {
    const ctl = setupTray(makeOpts());
    ctl.setEnabled(true);
    ctl.setEnabled(true);
    expect(MockTray).toHaveBeenCalledTimes(1);
  });

  it('setEnabled(false) is a no-op when already disabled', () => {
    const ctl = setupTray(makeOpts());
    ctl.setEnabled(false); // never enabled
    expect(mockTrayInstance.destroy).not.toHaveBeenCalled();
  });

  it('destroy() cleans up when tray is active', () => {
    const ctl = setupTray(makeOpts());
    ctl.setEnabled(true);
    ctl.destroy();
    expect(mockTrayInstance.destroy).toHaveBeenCalledTimes(1);
  });

  it('destroy() is a no-op when tray was never created', () => {
    const ctl = setupTray(makeOpts());
    expect(() => ctl.destroy()).not.toThrow();
    expect(mockTrayInstance.destroy).not.toHaveBeenCalled();
  });

  it('catches Tray construction errors silently', () => {
    MockTray.mockImplementationOnce(() => {
      throw new Error('No system tray on this DE');
    });
    const ctl = setupTray(makeOpts());
    expect(() => ctl.setEnabled(true)).not.toThrow();
  });

  it('tray click triggers onShow', () => {
    const opts = makeOpts();
    const ctl = setupTray(opts);
    ctl.setEnabled(true);
    const clickCall = mockTrayInstance.on.mock.calls.find(([ev]: [string]) => ev === 'click');
    expect(clickCall).toBeDefined();
    (clickCall![1] as () => void)();
    expect(opts.onShow).toHaveBeenCalledTimes(1);
  });

  it('context menu "Show Etherpad Desktop" click triggers onShow', () => {
    const opts = makeOpts();
    const ctl = setupTray(opts);
    ctl.setEnabled(true);
    const template = MockMenuBuildFromTemplate.mock.calls[0]![0] as Array<{
      label?: string;
      click?: () => void;
      type?: string;
    }>;
    const showItem = template.find((m) => m.label === 'Show Etherpad Desktop');
    expect(showItem).toBeDefined();
    showItem!.click!();
    expect(opts.onShow).toHaveBeenCalledTimes(1);
  });

  it('context menu "Quit Etherpad Desktop" click triggers onQuit', () => {
    const opts = makeOpts();
    const ctl = setupTray(opts);
    ctl.setEnabled(true);
    const template = MockMenuBuildFromTemplate.mock.calls[0]![0] as Array<{
      label?: string;
      click?: () => void;
      type?: string;
    }>;
    const quitItem = template.find((m) => m.label === 'Quit Etherpad Desktop');
    expect(quitItem).toBeDefined();
    quitItem!.click!();
    expect(opts.onQuit).toHaveBeenCalledTimes(1);
  });
});
