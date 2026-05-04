import { VersionedStore } from '../storage/versioned-store.js';
import { padHistoryFileSchema } from '@shared/validation/pad-history';
import type { PadHistoryEntry, PadHistoryFile } from '@shared/types/pad-history';
import { PAD_HISTORY_UNPINNED_CAP } from '@shared/types/pad-history';

export class PadHistoryStore {
  private readonly inner: VersionedStore<PadHistoryFile>;
  private state: PadHistoryFile;

  constructor(file: string) {
    this.inner = new VersionedStore<PadHistoryFile>({
      file,
      schema: padHistoryFileSchema,
      defaults: () => ({ schemaVersion: 1, entries: [] }),
    });
    this.state = this.inner.read();
  }

  listForWorkspace(workspaceId: string): PadHistoryEntry[] {
    return this.state.entries
      .filter((e) => e.workspaceId === workspaceId)
      .sort((a, b) => b.lastOpenedAt - a.lastOpenedAt);
  }

  touch(workspaceId: string, padName: string): void {
    const now = Date.now();
    const idx = this.state.entries.findIndex(
      (e) => e.workspaceId === workspaceId && e.padName === padName,
    );
    if (idx >= 0) {
      const updated: PadHistoryEntry = { ...this.state.entries[idx]!, lastOpenedAt: now };
      const next = [...this.state.entries];
      next[idx] = updated;
      this.state = { ...this.state, entries: next };
    } else {
      const entry: PadHistoryEntry = {
        workspaceId,
        padName,
        lastOpenedAt: now,
        pinned: false,
      };
      this.state = { ...this.state, entries: [...this.state.entries, entry] };
    }
    this.evict(workspaceId);
    this.persist();
  }

  pin(workspaceId: string, padName: string): void {
    this.setPinned(workspaceId, padName, true);
  }

  unpin(workspaceId: string, padName: string): void {
    this.setPinned(workspaceId, padName, false);
  }

  clearWorkspace(workspaceId: string): void {
    this.state = {
      ...this.state,
      entries: this.state.entries.filter((e) => e.workspaceId !== workspaceId),
    };
    this.persist();
  }

  clearAll(): void {
    this.state = { ...this.state, entries: [] };
    this.persist();
  }

  snapshot(): PadHistoryFile {
    return JSON.parse(JSON.stringify(this.state)) as PadHistoryFile;
  }

  restore(snap: PadHistoryFile): void {
    this.state = JSON.parse(JSON.stringify(snap)) as PadHistoryFile;
    this.persist();
  }

  private setPinned(workspaceId: string, padName: string, pinned: boolean): void {
    const idx = this.state.entries.findIndex(
      (e) => e.workspaceId === workspaceId && e.padName === padName,
    );
    if (idx < 0) return;
    const next = [...this.state.entries];
    next[idx] = { ...next[idx]!, pinned };
    this.state = { ...this.state, entries: next };
    this.persist();
  }

  private evict(workspaceId: string): void {
    const inWs = this.state.entries.filter((e) => e.workspaceId === workspaceId);
    const unpinned = inWs.filter((e) => !e.pinned).sort((a, b) => a.lastOpenedAt - b.lastOpenedAt);
    const overflow = unpinned.length - PAD_HISTORY_UNPINNED_CAP;
    if (overflow <= 0) return;
    const toRemove = new Set(
      unpinned.slice(0, overflow).map((e) => `${e.workspaceId}::${e.padName}`),
    );
    this.state = {
      ...this.state,
      entries: this.state.entries.filter(
        (e) => !toRemove.has(`${e.workspaceId}::${e.padName}`),
      ),
    };
  }

  private persist(): void {
    this.inner.write(this.state);
  }
}
