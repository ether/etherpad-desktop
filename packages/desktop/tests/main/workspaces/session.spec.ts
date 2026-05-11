import { describe, it, expect, vi } from 'vitest';
import { partitionFor, clearWorkspaceStorage } from '../../../src/main/workspaces/session';

describe('partitionFor', () => {
  it('returns persist:ws-<id>', () => {
    expect(partitionFor('00000000-0000-4000-8000-000000000000')).toBe(
      'persist:ws-00000000-0000-4000-8000-000000000000',
    );
  });
});

describe('clearWorkspaceStorage', () => {
  it('calls clearStorageData on the named partition', async () => {
    const clearStorageData = vi.fn().mockResolvedValue(undefined);
    const fromPartition = vi.fn().mockReturnValue({ clearStorageData });
    const sessionApi = { fromPartition } as unknown as { fromPartition: typeof fromPartition };
    await clearWorkspaceStorage(sessionApi, 'abc');
    expect(fromPartition).toHaveBeenCalledWith('persist:ws-abc');
    expect(clearStorageData).toHaveBeenCalledTimes(1);
  });
});
