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
