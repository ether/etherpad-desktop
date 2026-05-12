// tests/main/embedded/embedded-server.spec.ts
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { EventEmitter } from 'node:events';
import type { ChildProcess } from 'node:child_process';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createEmbeddedServer, findBundledEtherpadDir } from '../../../src/main/embedded/embedded-server';

// Stub global fetch so waitForReachable resolves quickly
vi.stubGlobal(
  'fetch',
  vi.fn().mockResolvedValue({
    ok: true,
    text: async () => '{"currentVersion":"1.3.1"}',
  }),
);

function makeLog() {
  return {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  };
}

/** Build a fake ChildProcess-like object with a writable .stderr EventEmitter. */
function makeFakeProc(): ChildProcess & { _exit: (code: number | null) => void } {
  const emitter = new EventEmitter();
  const stderrEmitter = new EventEmitter();
  const proc = Object.assign(emitter, {
    stderr: stderrEmitter,
    stdout: null,
    stdin: null,
    killed: false,
    pid: 9999,
    kill: vi.fn((signal?: string) => {
      (proc as unknown as { killed: boolean }).killed = true;
      // Simulate exit after SIGTERM
      if (signal === 'SIGTERM' || signal === 'SIGKILL') {
        setTimeout(() => emitter.emit('exit', null), 10);
      }
      return true;
    }),
    _exit: (code: number | null) => emitter.emit('exit', code),
  }) as unknown as ChildProcess & { _exit: (code: number | null) => void };
  return proc;
}

describe('EmbeddedServerController', () => {
  let spawnFn: ReturnType<typeof vi.fn>;
  let findFreePortFn: ReturnType<typeof vi.fn>;
  let fakeProc: ReturnType<typeof makeFakeProc>;

  beforeEach(() => {
    fakeProc = makeFakeProc();
    spawnFn = vi.fn().mockReturnValue(fakeProc);
    findFreePortFn = vi.fn().mockResolvedValue(19999);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('start() spawns the bundled Etherpad source via node + tsx/cjs', async () => {
    const ctrl = createEmbeddedServer({
      log: makeLog(),
      userDataDir: '/tmp/test-embedded',
      etherpadDir: '/tmp/fake-etherpad',
      nodeRuntime: { execPath: 'node', env: {} },
      spawnFn: spawnFn as never,
      findFreePortFn,
    });

    const url = await ctrl.start();

    expect(spawnFn).toHaveBeenCalledOnce();
    const [cmd, args, spawnOpts] = spawnFn.mock.calls[0] as [string, string[], { cwd: string; env: Record<string, string> }];
    expect(cmd).toBe('node');
    expect(args.slice(0, 3)).toEqual(['--require', 'tsx/cjs', 'node/server.ts']);
    expect(args).toContain('--settings');
    expect(spawnOpts.cwd).toBe('/tmp/fake-etherpad/src');
    expect(spawnOpts.env.NODE_ENV).toBe('production');
    expect(url).toBe('http://127.0.0.1:19999');
  });

  it('defaults to Electron-as-Node when no nodeRuntime injected', async () => {
    const ctrl = createEmbeddedServer({
      log: makeLog(),
      userDataDir: '/tmp/test-embedded',
      etherpadDir: '/tmp/fake-etherpad',
      // No nodeRuntime — fall through to electronAsNode default.
      spawnFn: spawnFn as never,
      findFreePortFn,
    });

    await ctrl.start();

    const [cmd, , spawnOpts] = spawnFn.mock.calls[0] as [string, string[], { env: Record<string, string> }];
    expect(cmd).toBe(process.execPath);
    expect(spawnOpts.env.ELECTRON_RUN_AS_NODE).toBe('1');
  });

  it('start() returns the same URL on a second call without spawning again', async () => {
    const ctrl = createEmbeddedServer({
      log: makeLog(),
      userDataDir: '/tmp/test-embedded',
      etherpadDir: '/tmp/fake-etherpad',
      spawnFn: spawnFn as never,
      findFreePortFn,
    });

    const url1 = await ctrl.start();
    const url2 = await ctrl.start();

    expect(url1).toBe(url2);
    expect(spawnFn).toHaveBeenCalledOnce();
  });

  it('state() transitions idle → starting → running → idle (after stop)', async () => {
    const ctrl = createEmbeddedServer({
      log: makeLog(),
      userDataDir: '/tmp/test-embedded',
      etherpadDir: '/tmp/fake-etherpad',
      spawnFn: spawnFn as never,
      findFreePortFn,
    });

    expect(ctrl.state().kind).toBe('idle');

    const p = ctrl.start();
    // Note: the state goes to 'starting' synchronously in start(), then running after await
    await p;
    expect(ctrl.state().kind).toBe('running');

    await ctrl.stop();
    expect(ctrl.state().kind).toBe('idle');
  });

  it('url() returns null before start and the URL after start', async () => {
    const ctrl = createEmbeddedServer({
      log: makeLog(),
      userDataDir: '/tmp/test-embedded',
      etherpadDir: '/tmp/fake-etherpad',
      spawnFn: spawnFn as never,
      findFreePortFn,
    });

    expect(ctrl.url()).toBeNull();
    await ctrl.start();
    expect(ctrl.url()).toBe('http://127.0.0.1:19999');
  });

  it('stop() calls kill(SIGTERM) on the child process', async () => {
    const ctrl = createEmbeddedServer({
      log: makeLog(),
      userDataDir: '/tmp/test-embedded',
      etherpadDir: '/tmp/fake-etherpad',
      spawnFn: spawnFn as never,
      findFreePortFn,
    });

    await ctrl.start();
    await ctrl.stop();

    expect(fakeProc.kill).toHaveBeenCalledWith('SIGTERM');
  });

  it('stop() before start does not throw', async () => {
    const ctrl = createEmbeddedServer({
      log: makeLog(),
      userDataDir: '/tmp/test-embedded',
      etherpadDir: '/tmp/fake-etherpad',
      spawnFn: spawnFn as never,
      findFreePortFn,
    });

    await expect(ctrl.stop()).resolves.toBeUndefined();
    expect(ctrl.state().kind).toBe('idle');
  });

  it('error during start (port finder fails) → state=error, no zombie process', async () => {
    findFreePortFn.mockRejectedValueOnce(new Error('port error'));

    const ctrl = createEmbeddedServer({
      log: makeLog(),
      userDataDir: '/tmp/test-embedded',
      etherpadDir: '/tmp/fake-etherpad',
      spawnFn: spawnFn as never,
      findFreePortFn,
    });

    await expect(ctrl.start()).rejects.toThrow('port error');
    expect(ctrl.state().kind).toBe('error');
    expect(spawnFn).not.toHaveBeenCalled();
  });

  it('concurrent start() calls: second awaits the first, spawn only called once', async () => {
    const ctrl = createEmbeddedServer({
      log: makeLog(),
      userDataDir: '/tmp/test-embedded',
      etherpadDir: '/tmp/fake-etherpad',
      spawnFn: spawnFn as never,
      findFreePortFn,
    });

    const [url1, url2] = await Promise.all([ctrl.start(), ctrl.start()]);

    expect(url1).toBe(url2);
    // spawn is called once by the first start(); the second one awaits
    expect(spawnFn).toHaveBeenCalledOnce();
  });
});

describe('findBundledEtherpadDir', () => {
  let tmp: string;

  beforeEach(() => {
    tmp = mkdtempSync(join(tmpdir(), 'epd-bundled-'));
  });
  afterEach(() => {
    rmSync(tmp, { recursive: true, force: true });
  });

  it('returns null when neither resourcesPath nor appRoot has Etherpad', () => {
    const r = findBundledEtherpadDir({ resourcesPath: tmp });
    expect(r).toBeNull();
  });

  it('finds Etherpad via resourcesPath when src/node/server.ts exists', () => {
    const etherpadSrc = join(tmp, 'etherpad', 'src', 'node');
    mkdirSync(etherpadSrc, { recursive: true });
    writeFileSync(join(etherpadSrc, 'server.ts'), '');
    const r = findBundledEtherpadDir({ resourcesPath: tmp });
    expect(r).toBe(join(tmp, 'etherpad'));
  });

  it('falls back to appRoot/resources/etherpad when resourcesPath lookup misses', () => {
    const devLayout = join(tmp, 'app', 'resources', 'etherpad', 'src', 'node');
    mkdirSync(devLayout, { recursive: true });
    writeFileSync(join(devLayout, 'server.ts'), '');
    const r = findBundledEtherpadDir({
      resourcesPath: join(tmp, 'packaged'),
      appRoot: join(tmp, 'app'),
    });
    expect(r).toBe(join(tmp, 'app', 'resources', 'etherpad'));
  });
});
