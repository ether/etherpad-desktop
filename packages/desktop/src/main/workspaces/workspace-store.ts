import { randomUUID } from 'node:crypto';
import { VersionedStore } from '../storage/versioned-store.js';
import { workspacesFileSchema } from '@shared/validation/workspace';
import type { Workspace, WorkspacesFile, WorkspaceKind } from '@shared/types/workspace';
import { WorkspaceNotFoundError, UrlValidationError } from '@shared/types/errors';
import { normalizeServerUrl } from '@shared/url';

export type WorkspaceAddInput = { name: string; serverUrl: string; color: string; kind?: WorkspaceKind };
export type WorkspaceUpdateInput = {
  id: string;
  name?: string;
  serverUrl?: string;
  color?: string;
};

export class WorkspaceStore {
  private readonly inner: VersionedStore<WorkspacesFile>;
  private state: WorkspacesFile;

  constructor(file: string) {
    this.inner = new VersionedStore<WorkspacesFile>({
      file,
      schema: workspacesFileSchema,
      defaults: () => ({ schemaVersion: 1, workspaces: [], order: [] }),
    });
    this.state = this.inner.read();
  }

  list(): Workspace[] {
    return this.state.order
      .map((id) => this.state.workspaces.find((w) => w.id === id))
      .filter((w): w is Workspace => w !== undefined);
  }

  order(): string[] {
    return [...this.state.order];
  }

  byId(id: string): Workspace | undefined {
    return this.state.workspaces.find((w) => w.id === id);
  }

  add(input: WorkspaceAddInput): Workspace {
    let serverUrl: string;
    try {
      serverUrl = normalizeServerUrl(input.serverUrl);
    } catch (e) {
      throw new UrlValidationError((e as Error).message);
    }
    const ws: Workspace = {
      id: randomUUID(),
      name: input.name,
      serverUrl,
      color: input.color,
      createdAt: Date.now(),
      ...(input.kind !== undefined ? { kind: input.kind } : {}),
    };
    this.state = {
      ...this.state,
      workspaces: [...this.state.workspaces, ws],
      order: [...this.state.order, ws.id],
    };
    this.persist();
    return ws;
  }

  update(input: WorkspaceUpdateInput): Workspace {
    const existing = this.byId(input.id);
    if (!existing) throw new WorkspaceNotFoundError(input.id);
    let serverUrl = existing.serverUrl;
    if (input.serverUrl !== undefined) {
      try {
        serverUrl = normalizeServerUrl(input.serverUrl);
      } catch (e) {
        throw new UrlValidationError((e as Error).message);
      }
    }
    const updated: Workspace = {
      ...existing,
      ...(input.name !== undefined ? { name: input.name } : {}),
      ...(input.color !== undefined ? { color: input.color } : {}),
      serverUrl,
    };
    this.state = {
      ...this.state,
      workspaces: this.state.workspaces.map((w) => (w.id === input.id ? updated : w)),
    };
    this.persist();
    return updated;
  }

  remove(id: string): void {
    if (!this.byId(id)) throw new WorkspaceNotFoundError(id);
    this.state = {
      ...this.state,
      workspaces: this.state.workspaces.filter((w) => w.id !== id),
      order: this.state.order.filter((x) => x !== id),
    };
    this.persist();
  }

  reorder(order: string[]): void {
    const have = new Set(this.state.workspaces.map((w) => w.id));
    const want = new Set(order);
    if (have.size !== want.size || [...have].some((id) => !want.has(id))) {
      throw new Error('reorder: id set mismatch');
    }
    this.state = { ...this.state, order: [...order] };
    this.persist();
  }

  snapshot(): WorkspacesFile {
    return JSON.parse(JSON.stringify(this.state)) as WorkspacesFile;
  }

  restore(snap: WorkspacesFile): void {
    this.state = JSON.parse(JSON.stringify(snap)) as WorkspacesFile;
    this.persist();
  }

  private persist(): void {
    this.inner.write(this.state);
  }
}
