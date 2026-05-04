/**
 * url-validation.spec.ts
 *
 * Validates URL input behaviour in AddWorkspaceDialog.
 *
 * 1. Empty URL → Add button is disabled (no submission possible).
 * 2. Malformed URL → UrlValidationError shown.
 * 3. Reachable but non-Etherpad URL → NotAnEtherpadServerError shown.
 *    We use the fixture's /api/admin path which returns HTML, not the
 *    Etherpad API JSON.  Actually a simpler target: use port 9003 but a
 *    path-prefixed URL that still hits the fixture; the probe hits /api/
 *    relative to the given URL.  Cleanest approach: spin a tiny HTTP server
 *    in the test that returns 200 + non-Etherpad JSON for /api/.
 * 4. Server unreachable → ServerUnreachableError shown (already covered in
 *    add-workspace.spec.ts — we include a lightweight duplicate for
 *    completeness).
 */
import { test, expect } from '@playwright/test';
import { createServer, type Server } from 'node:http';
import { launchApp } from './fixtures/launch.js';

// Spin up a minimal HTTP server that responds to /api/ with non-Etherpad JSON
function startFakeServer(): Promise<{ url: string; stop: () => Promise<void> }> {
  return new Promise((resolve, reject) => {
    const server: Server = createServer((_req, res) => {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ not: 'etherpad' }));
    });
    server.listen(0, '127.0.0.1', () => {
      const addr = server.address();
      if (!addr || typeof addr === 'string') {
        reject(new Error('unexpected address'));
        return;
      }
      resolve({
        url: `http://127.0.0.1:${addr.port}`,
        stop: () => new Promise<void>((res, rej) => server.close((e) => (e ? rej(e) : res()))),
      });
    });
    server.on('error', reject);
  });
}

test('empty URL disables the Add button', async () => {
  const h = await launchApp();
  try {
    // First launch shows AddWorkspaceDialog
    await expect(h.shell.getByRole('heading', { name: /add a workspace/i })).toBeVisible();

    // Fill in the name but leave URL empty
    await h.shell.getByLabel(/name/i).fill('NoUrl');

    // The Add button should be disabled
    const addBtn = h.shell.getByRole('button', { name: /^add$/i });
    await expect(addBtn).toBeDisabled();
  } finally {
    await h.close();
  }
});

test('empty name also disables the Add button', async () => {
  const h = await launchApp();
  try {
    await expect(h.shell.getByRole('heading', { name: /add a workspace/i })).toBeVisible();

    // Fill URL but leave name empty
    await h.shell.getByLabel(/etherpad url/i).fill('http://127.0.0.1:9003');

    const addBtn = h.shell.getByRole('button', { name: /^add$/i });
    await expect(addBtn).toBeDisabled();
  } finally {
    await h.close();
  }
});

test('malformed URL shows URL validation error', async () => {
  const h = await launchApp();
  try {
    await expect(h.shell.getByRole('heading', { name: /add a workspace/i })).toBeVisible();

    await h.shell.getByLabel(/name/i).fill('Bad');
    await h.shell.getByLabel(/etherpad url/i).fill('not a url');
    await h.shell.getByRole('button', { name: /^add$/i }).click();

    // Should show a URL validation error
    await expect(h.shell.getByRole('alert')).toBeVisible();
    await expect(h.shell.getByText(/enter a valid url/i)).toBeVisible();
  } finally {
    await h.close();
  }
});

test('reachable server that is not Etherpad shows not-etherpad error', async () => {
  const fake = await startFakeServer();
  const h = await launchApp();
  try {
    await expect(h.shell.getByRole('heading', { name: /add a workspace/i })).toBeVisible();

    await h.shell.getByLabel(/name/i).fill('FakeServer');
    await h.shell.getByLabel(/etherpad url/i).fill(fake.url);
    await h.shell.getByRole('button', { name: /^add$/i }).click();

    // Should show "not an etherpad" error
    await expect(h.shell.getByRole('alert')).toBeVisible();
    await expect(h.shell.getByText(/does not look like etherpad/i)).toBeVisible();
  } finally {
    await h.close();
    await fake.stop();
  }
});

test('unreachable server shows unreachable error', async () => {
  const h = await launchApp();
  try {
    await expect(h.shell.getByRole('heading', { name: /add a workspace/i })).toBeVisible();

    await h.shell.getByLabel(/name/i).fill('Dead');
    // Port 1 is reserved and always refused
    await h.shell.getByLabel(/etherpad url/i).fill('http://127.0.0.1:1');
    await h.shell.getByRole('button', { name: /^add$/i }).click();

    await expect(h.shell.getByRole('alert')).toBeVisible();
    await expect(h.shell.getByText(/could not reach that server/i)).toBeVisible();
  } finally {
    await h.close();
  }
});
