import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync, unlinkSync } from 'node:fs';
import { dirname } from 'node:path';
import type { z } from 'zod';
import { StorageError } from '@shared/types/errors';

type WithVersion = { schemaVersion: number };

export type VersionedStoreOptions<T extends WithVersion> = {
  file: string;
  schema: z.ZodType<T>;
  defaults: () => T;
  currentVersion?: number;
};

export class VersionedStore<T extends WithVersion> {
  private readonly file: string;
  private readonly schema: z.ZodType<T>;
  private readonly defaults: () => T;
  private readonly currentVersion: number;

  constructor(opts: VersionedStoreOptions<T>) {
    this.file = opts.file;
    this.schema = opts.schema;
    this.defaults = opts.defaults;
    this.currentVersion = opts.currentVersion ?? 1;
    mkdirSync(dirname(this.file), { recursive: true });
  }

  read(): T {
    if (!existsSync(this.file)) return this.defaults();

    let raw: string;
    try {
      raw = readFileSync(this.file, 'utf8');
    } catch (e) {
      throw new StorageError(`failed to read ${this.file}: ${(e as Error).message}`);
    }

    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch {
      this.quarantine();
      return this.defaults();
    }

    if (
      typeof parsed === 'object' &&
      parsed !== null &&
      'schemaVersion' in parsed &&
      typeof (parsed as WithVersion).schemaVersion === 'number' &&
      (parsed as WithVersion).schemaVersion > this.currentVersion
    ) {
      throw new StorageError(
        `${this.file} has schemaVersion ${(parsed as WithVersion).schemaVersion}, ` +
          `which is newer than this app supports (max ${this.currentVersion}). Please update.`,
      );
    }

    const result = this.schema.safeParse(parsed);
    if (!result.success) {
      this.quarantine();
      return this.defaults();
    }
    return result.data;
  }

  write(data: T): void {
    const validated = this.schema.parse(data);
    const tmp = `${this.file}.${process.pid}.tmp`;
    try {
      writeFileSync(tmp, JSON.stringify(validated, null, 2), 'utf8');
      renameSync(tmp, this.file);
    } catch (e) {
      try {
        if (existsSync(tmp)) unlinkSync(tmp);
      } catch {
        /* ignore */
      }
      throw new StorageError(`failed to write ${this.file}: ${(e as Error).message}`);
    }
  }

  private quarantine(): void {
    const ts = new Date().toISOString().replace(/[:.]/g, '-');
    const broken = `${this.file.replace(/\.json$/, '')}.broken-${ts}.json`;
    try {
      renameSync(this.file, broken);
    } catch {
      /* nothing we can do */
    }
  }
}
