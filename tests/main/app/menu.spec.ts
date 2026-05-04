import { describe, it, expect, vi } from 'vitest';
import { buildMenuTemplate } from '../../../src/main/app/menu';

describe('buildMenuTemplate', () => {
  it('contains File / Edit / View / Window / Help submenus', () => {
    const cb = { newTab: vi.fn(), openPad: vi.fn(), reload: vi.fn(), settings: vi.fn(), quit: vi.fn(), about: vi.fn(), openLogs: vi.fn() };
    const t = buildMenuTemplate(cb);
    const labels = t.map((m) => m.label);
    expect(labels).toEqual(['File', 'Edit', 'View', 'Window', 'Help']);
  });

  it('File menu has New Tab, Open Pad, Settings, Quit accelerators', () => {
    const cb = { newTab: vi.fn(), openPad: vi.fn(), reload: vi.fn(), settings: vi.fn(), quit: vi.fn(), about: vi.fn(), openLogs: vi.fn() };
    const t = buildMenuTemplate(cb);
    const file = t[0]!;
    const labelsAndAccels = (file.submenu as { label?: string; accelerator?: string }[]).map((m) => [m.label, m.accelerator]);
    expect(labelsAndAccels).toContainEqual(['New Tab', 'CmdOrCtrl+T']);
    expect(labelsAndAccels).toContainEqual(['Open Pad…', 'CmdOrCtrl+O']);
    expect(labelsAndAccels).toContainEqual(['Settings', 'CmdOrCtrl+,']);
    expect(labelsAndAccels).toContainEqual(['Quit', 'CmdOrCtrl+Q']);
  });

  it('invokes the right callback when "New Tab" is clicked', () => {
    const cb = { newTab: vi.fn(), openPad: vi.fn(), reload: vi.fn(), settings: vi.fn(), quit: vi.fn(), about: vi.fn(), openLogs: vi.fn() };
    const t = buildMenuTemplate(cb);
    const newTab = (t[0]!.submenu as { label?: string; click?: () => void }[]).find((x) => x.label === 'New Tab')!;
    newTab.click!();
    expect(cb.newTab).toHaveBeenCalledTimes(1);
  });
});
