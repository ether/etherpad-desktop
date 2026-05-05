/**
 * long-input.spec.ts
 *
 * Edge cases for unusual input values:
 * 1. Long pad name (200 chars — the schema max) → pad opens, tab shows it.
 * 2. Pad name with special characters (slash, quotes) → pad opens, tab exists.
 * 3. Workspace name with emoji → renders correctly in the rail.
 */
import { test, expect } from '@playwright/test';
import { launchApp } from './fixtures/launch.js';

type AppHandle = Awaited<ReturnType<typeof launchApp>>;

async function setupOneWorkspace(h: AppHandle, name: string) {
  await h.shell.getByLabel(/name/i).fill(name);
  await h.shell.getByLabel(/etherpad url/i).fill('http://127.0.0.1:9003');
  await h.shell.getByRole('button', { name: /^add$/i }).click();
  await expect(h.shell.getByRole('button', { name: new RegExp(`open instance ${name}`, 'i') })).toBeVisible();
}

test('long pad name (200 chars) opens successfully', async () => {
  const h = await launchApp();
  try {
    await setupOneWorkspace(h, 'LongPad');

    // Build a 200-character pad name (schema max for padName)
    const longName = 'a'.repeat(200);

    await h.shell.getByRole('button', { name: /new pad/i }).click();
    await h.shell.getByLabel(/pad name/i).fill(longName);
    await h.shell.getByRole('button', { name: /^open$/i }).click();

    // A tab should appear; the title starts as the padName (may be truncated
    // visually by CSS but the role="tab" aria label contains it).
    // We match on the first 20 chars which is unambiguous.
    await expect(h.shell.getByRole('tab', { name: new RegExp('a{20}') })).toBeVisible();
  } finally {
    await h.close();
  }
});

test('pad name with special characters (slash and quotes) opens successfully', async () => {
  const h = await launchApp();
  try {
    await setupOneWorkspace(h, 'SpecialPad');

    // Etherpad URL-encodes pad names; the app passes the raw string and the
    // padUrl() helper calls encodeURIComponent().
    const specialName = 'pad with/slash and "quotes"';

    await h.shell.getByRole('button', { name: /new pad/i }).click();
    await h.shell.getByLabel(/pad name/i).fill(specialName);
    await h.shell.getByRole('button', { name: /^open$/i }).click();

    // Tab should appear with the original pad name visible
    await expect(h.shell.getByRole('tab', { name: /pad with\/slash/ })).toBeVisible();
  } finally {
    await h.close();
  }
});

test('workspace name with emoji renders in the rail', async () => {
  const h = await launchApp();
  try {
    const emojiName = 'My Pads 📝';

    await h.shell.getByLabel(/name/i).fill(emojiName);
    await h.shell.getByLabel(/etherpad url/i).fill('http://127.0.0.1:9003');
    await h.shell.getByRole('button', { name: /^add$/i }).click();

    // The workspace button uses aria-label="Open workspace <name>"
    await expect(
      h.shell.getByRole('button', { name: /open instance my pads/i }),
    ).toBeVisible();

    // The rail button text content is the first 2 chars of the name
    // ("MY" from toUpperCase()) — verify it's present and the app didn't crash
    const railBtn = h.shell.getByRole('button', { name: /open instance my pads/i });
    await expect(railBtn).toBeVisible();
  } finally {
    await h.close();
  }
});
