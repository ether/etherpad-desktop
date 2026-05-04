import { describe, it, expect } from 'vitest';
import { workspaceSchema, workspacesFileSchema } from '@shared/validation/workspace';

describe('workspaceSchema', () => {
  it('accepts a valid workspace', () => {
    const ws = {
      id: '00000000-0000-4000-8000-000000000000',
      name: 'My Pad',
      serverUrl: 'https://pads.example.com',
      color: '#3366cc',
      createdAt: 1700000000000,
    };
    expect(workspaceSchema.parse(ws)).toEqual(ws);
  });

  it('rejects empty name', () => {
    expect(() =>
      workspaceSchema.parse({
        id: '00000000-0000-4000-8000-000000000000',
        name: '',
        serverUrl: 'https://x',
        color: '#000000',
        createdAt: 1,
      }),
    ).toThrow();
  });

  it('rejects non-uuid id', () => {
    expect(() =>
      workspaceSchema.parse({
        id: 'not-a-uuid',
        name: 'X',
        serverUrl: 'https://x',
        color: '#000000',
        createdAt: 1,
      }),
    ).toThrow();
  });

  it('rejects bad colour hex', () => {
    expect(() =>
      workspaceSchema.parse({
        id: '00000000-0000-4000-8000-000000000000',
        name: 'X',
        serverUrl: 'https://x',
        color: 'red',
        createdAt: 1,
      }),
    ).toThrow();
  });
});

describe('workspacesFileSchema', () => {
  it('accepts an empty file', () => {
    expect(workspacesFileSchema.parse({ schemaVersion: 1, workspaces: [], order: [] })).toEqual({
      schemaVersion: 1,
      workspaces: [],
      order: [],
    });
  });

  it('rejects unknown schemaVersion', () => {
    expect(() =>
      workspacesFileSchema.parse({ schemaVersion: 2, workspaces: [], order: [] }),
    ).toThrow();
  });
});

import { padHistoryEntrySchema, padHistoryFileSchema } from '@shared/validation/pad-history';

describe('padHistoryEntrySchema', () => {
  it('accepts a valid entry', () => {
    const e = {
      workspaceId: '00000000-0000-4000-8000-000000000000',
      padName: 'standup',
      lastOpenedAt: 1700000000000,
      pinned: false,
    };
    expect(padHistoryEntrySchema.parse(e)).toEqual(e);
  });

  it('accepts optional title', () => {
    const e = {
      workspaceId: '00000000-0000-4000-8000-000000000000',
      padName: 'standup',
      lastOpenedAt: 1,
      pinned: true,
      title: 'Daily standup',
    };
    expect(padHistoryEntrySchema.parse(e).title).toBe('Daily standup');
  });

  it('rejects empty padName', () => {
    expect(() =>
      padHistoryEntrySchema.parse({
        workspaceId: '00000000-0000-4000-8000-000000000000',
        padName: '',
        lastOpenedAt: 1,
        pinned: false,
      }),
    ).toThrow();
  });
});

describe('padHistoryFileSchema', () => {
  it('accepts an empty file', () => {
    expect(padHistoryFileSchema.parse({ schemaVersion: 1, entries: [] })).toEqual({
      schemaVersion: 1,
      entries: [],
    });
  });
});

import { settingsSchema, defaultSettings } from '@shared/validation/settings';

describe('settingsSchema', () => {
  it('accepts the default settings', () => {
    expect(settingsSchema.parse(defaultSettings)).toEqual(defaultSettings);
  });

  it('rejects zoom < 0.5 or > 3', () => {
    expect(() => settingsSchema.parse({ ...defaultSettings, defaultZoom: 0.1 })).toThrow();
    expect(() => settingsSchema.parse({ ...defaultSettings, defaultZoom: 5 })).toThrow();
  });

  it('rejects bad colour hex', () => {
    expect(() => settingsSchema.parse({ ...defaultSettings, accentColor: 'red' })).toThrow();
  });
});
