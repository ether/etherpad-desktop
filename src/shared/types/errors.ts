export type AppErrorKind =
  | 'StorageError'
  | 'InvalidPayloadError'
  | 'WorkspaceNotFoundError'
  | 'TabNotFoundError'
  | 'WindowNotFoundError'
  | 'UrlValidationError'
  | 'ServerUnreachableError'
  | 'NotAnEtherpadServerError';

export class AppError extends Error {
  readonly kind: AppErrorKind;
  constructor(kind: AppErrorKind, message: string) {
    super(message);
    this.name = kind;
    this.kind = kind;
  }
}

export class StorageError extends AppError {
  constructor(message: string) {
    super('StorageError', message);
  }
}
export class InvalidPayloadError extends AppError {
  constructor(message: string) {
    super('InvalidPayloadError', message);
  }
}
export class WorkspaceNotFoundError extends AppError {
  constructor(id: string) {
    super('WorkspaceNotFoundError', `Workspace not found: ${id}`);
  }
}
export class TabNotFoundError extends AppError {
  constructor(id: string) {
    super('TabNotFoundError', `Tab not found: ${id}`);
  }
}
export class WindowNotFoundError extends AppError {
  constructor(id: number) {
    super('WindowNotFoundError', `Window not found: ${id}`);
  }
}
export class UrlValidationError extends AppError {
  constructor(message: string) {
    super('UrlValidationError', message);
  }
}
export class ServerUnreachableError extends AppError {
  constructor(url: string) {
    super('ServerUnreachableError', `Server unreachable: ${url}`);
  }
}
export class NotAnEtherpadServerError extends AppError {
  constructor(url: string) {
    super('NotAnEtherpadServerError', `Not an Etherpad server: ${url}`);
  }
}

export type SerializedAppError = { kind: AppErrorKind; message: string };

export function serializeError(e: unknown): SerializedAppError {
  if (e instanceof AppError) return { kind: e.kind, message: e.message };
  if (e instanceof Error) return { kind: 'StorageError', message: e.message };
  return { kind: 'StorageError', message: String(e) };
}
