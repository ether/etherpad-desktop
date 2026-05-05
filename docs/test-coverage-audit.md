# Test Coverage Audit

**Date:** 2026-05-03  
**Branch:** `feat/linux-mvp`  
**Baseline:** 143 unit tests, 38 E2E tests  
**Post-fill:** 273 unit tests, 41 E2E tests  
**After tray + sidebar filter:** 300 unit tests, 41 E2E tests

---

## Renderer Components

| Surface | Type | Pre-audit | Gap | Post-fill |
|---|---|---|---|---|
| WorkspaceRail – renders workspaces in order | render | ✅ | — | ✅ |
| WorkspaceRail – click workspace → setActiveWorkspaceId + IPC | click | ⚠️ (store only, not IPC) | IPC assert missing | ✅ |
| WorkspaceRail – settings cog → opens SettingsDialog | click | ❌ | no test | ✅ |
| WorkspaceRail – + button → opens AddWorkspaceDialog | click | ✅ | — | ✅ |
| WorkspaceRail – active workspace shows ring style | render | ❌ | no test | ✅ |
| WorkspaceRail – button shows first 2 uppercase letters | render | ❌ | no test | ✅ |
| PadSidebar – shows Pinned + Recent sections | render | ✅ | — | ✅ |
| PadSidebar – click recent pad → tab.open | click | ✅ | — | ✅ |
| PadSidebar – + New Pad → opens OpenPadDialog | click | ✅ | — | ✅ |
| PadSidebar – no active workspace → empty aside | render | ✅ | — | ✅ |
| PadSidebar – empty history (has wsId) → no Pinned section | render | ❌ | no test | ✅ |
| PadSidebar – click pinned pad → tab.open | click | ❌ | no test | ✅ |
| PadSidebar – uses title over padName when available | render | ❌ | no test | ✅ |
| PadSidebar – caps recent list at 50 | render | ❌ | no test | ✅ |
| PadSidebar – ☆ on recent pads, ★ on pinned pads | render | ❌ | no test (pin/unpin UI new in M8) | ✅ |
| PadSidebar – click ☆ on recent pad → padHistory.pin, no tab.open | click | ❌ | no test (pin/unpin UI new in M8) | ✅ |
| PadSidebar – click ★ on pinned pad → padHistory.unpin, no tab.open | click | ❌ | no test (pin/unpin UI new in M8) | ✅ |
| PadSidebar – filter input narrows pinned + recent lists | click | ❌ | new surface | ✅ |
| PadSidebar – filter shows "No pads match" when empty | click | ❌ | new surface | ✅ |
| PadSidebar – clearing filter restores all pads | click | ❌ | new surface | ✅ |
| PadSidebar – +New Pad visible even when filter active | render | ❌ | new surface | ✅ |
| PadSidebar – filter matches by title | click | ❌ | new surface | ✅ |
| PadSidebar – filter is case-insensitive | click | ❌ | new surface | ✅ |
| TabStrip – renders tabs per workspace | render | ✅ | — | ✅ |
| TabStrip – click tab → ipc.tab.focus | click | ✅ | — | ✅ |
| TabStrip – click ✕ → ipc.tab.close | click | ✅ | — | ✅ |
| TabStrip – error indicator for state=error | render | ✅ | — | ✅ |
| TabStrip – error indicator for state=crashed | render | ❌ | no test | ✅ |
| TabStrip – active tab has aria-selected=true | render | ❌ | no test | ✅ |
| TabStrip – no tabs when activeWorkspaceId=null | render | ❌ | no test | ✅ |
| TabStrip – only shows tabs for active workspace | render | ❌ | no test (duplicate test existed) | ✅ |
| TabStrip – no error indicator for state=loaded | render | ❌ | no test | ✅ |
| TabErrorOverlay – hidden when state=loaded | render | ❌ | **no test file** | ✅ |
| TabErrorOverlay – hidden when no active tab | render | ❌ | **no test file** | ✅ |
| TabErrorOverlay – shows errorMessage in error state | render | ❌ | **no test file** | ✅ |
| TabErrorOverlay – falls back to serverUrl when no errorMessage | render | ❌ | **no test file** | ✅ |
| TabErrorOverlay – shows crashed message | render | ❌ | **no test file** | ✅ |
| TabErrorOverlay – Retry → ipc.tab.reload (error state) | click | ❌ | **no test file** | ✅ |
| TabErrorOverlay – Reload → ipc.tab.reload (crashed state) | click | ❌ | **no test file** | ✅ |
| TabErrorOverlay – Close tab → ipc.tab.close (error) | click | ❌ | **no test file** | ✅ |
| TabErrorOverlay – Close tab → ipc.tab.close (crashed) | click | ❌ | **no test file** | ✅ |
| TabErrorOverlay – Retry label in error state, Reload in crashed | render | ❌ | **no test file** | ✅ |
| EmptyState – Open Pad button → opens openPad dialog | click | ✅ | — | ✅ |
| ErrorBoundary – renders children | render | ✅ | — | ✅ |
| ErrorBoundary – fallback + onReload | click | ✅ | — | ✅ |
| ErrorBoundary – show details toggles stack trace | click | ✅ | — | ✅ |

---

## Dialogs

| Surface | Type | Pre-audit | Gap | Post-fill |
|---|---|---|---|---|
| AddWorkspaceDialog – submit happy path | click | ✅ | — | ✅ |
| AddWorkspaceDialog – ServerUnreachableError message | click | ✅ | — | ✅ |
| AddWorkspaceDialog – NotAnEtherpadServerError message | click | ❌ | no test | ✅ |
| AddWorkspaceDialog – UrlValidationError message | click | ❌ | no test | ✅ |
| AddWorkspaceDialog – Cancel when dismissable | click | ✅ | — | ✅ |
| AddWorkspaceDialog – Cancel hidden when not dismissable | render | ✅ | — | ✅ |
| AddWorkspaceDialog – Add disabled when fields empty | render | ❌ | no test | ✅ |
| AddWorkspaceDialog – Add disabled when only name filled | render | ❌ | no test | ✅ |
| AddWorkspaceDialog – Add enabled when both filled | render | ❌ | no test | ✅ |
| AddWorkspaceDialog – color swatch click changes pressed state | click | ❌ | no test | ✅ |
| AddWorkspaceDialog – submit uses selected color | click | ❌ | no test | ✅ |
| AddWorkspaceDialog – successful submit closes dialog | click | ❌ | no test | ✅ |
| OpenPadDialog – submit calls tab.open with name | click | ✅ | — | ✅ |
| OpenPadDialog – autocomplete shows on type | render | ✅ | — | ✅ |
| OpenPadDialog – create mode calls tab.open with mode=create | click | ✅ | — | ✅ |
| OpenPadDialog – Open disabled when name empty | render | ❌ | no test | ✅ |
| OpenPadDialog – Open enabled when name filled | render | ❌ | no test | ✅ |
| OpenPadDialog – Cancel closes dialog | click | ❌ | no test | ✅ |
| OpenPadDialog – click autocomplete suggestion → tab.open | click | ❌ | no test | ✅ |
| OpenPadDialog – autocomplete suggestion click closes dialog | click | ❌ | no test | ✅ |
| OpenPadDialog – successful submit closes dialog | click | ❌ | no test | ✅ |
| OpenPadDialog – empty name submit does nothing (button disabled) | render | ❌ | no test | ✅ |
| SettingsDialog – zoom change + save | click | ✅ | — | ✅ |
| SettingsDialog – language dropdown options | render | ✅ | — | ✅ |
| SettingsDialog – language change + save | click | ✅ | — | ✅ |
| SettingsDialog – rememberTabs checkbox toggle + save | click | ❌ | no test | ✅ |
| SettingsDialog – Save closes dialog | click | ❌ | no test | ✅ |
| SettingsDialog – Cancel closes without calling update | click | ❌ | no test | ✅ |
| SettingsDialog – Clear All History → padHistory.clearAll | click | ❌ | no test | ✅ |
| SettingsDialog – Remove workspace → opens RemoveWorkspaceDialog | click | ❌ | no test | ✅ |
| SettingsDialog – Remove button per workspace | render | ❌ | no test | ✅ |
| SettingsDialog – minimizeToTray checkbox toggle + save | click | ❌ | new surface | ✅ |
| RemoveWorkspaceDialog – confirm calls workspace.remove | click | ✅ | — | ✅ |
| RemoveWorkspaceDialog – shows workspace name | render | ❌ | no test | ✅ |
| RemoveWorkspaceDialog – Cancel closes without remove | click | ❌ | no test | ✅ |
| RemoveWorkspaceDialog – confirm closes dialog on success | click | ❌ | no test | ✅ |
| RemoveWorkspaceDialog – confirm calls setActiveWorkspace | click | ❌ | no test | ✅ |
| RemoveWorkspaceDialog – renders nothing for unknown workspaceId | render | ❌ | no test | ✅ |
| RemoveWorkspaceDialog – shows error on failed remove | click | ❌ | no test | ✅ |
| HttpAuthDialog – submit with credentials | click | ✅ | — | ✅ |
| HttpAuthDialog – Cancel → respond(cancel=true) | click | ❌ | no test | ✅ |
| HttpAuthDialog – Cancel closes dialog | click | ❌ | no test | ✅ |
| HttpAuthDialog – Sign In disabled when username empty | render | ❌ | no test | ✅ |
| HttpAuthDialog – Sign In enabled after typing username | render | ❌ | no test | ✅ |
| HttpAuthDialog – shows URL from context | render | ❌ | no test | ✅ |
| HttpAuthDialog – Sign In closes dialog on success | click | ❌ | no test | ✅ |
| AboutDialog – heading visible + Close closes | click | ✅ | — | ✅ |

---

## IPC Handlers (main process)

| Surface | Type | Pre-audit | Gap | Post-fill |
|---|---|---|---|---|
| workspace.add – happy path | handler | ✅ | — | ✅ |
| workspace.add – NotAnEtherpadServerError | handler | ✅ | — | ✅ |
| workspace.add – ServerUnreachableError | handler | ✅ | — | ✅ |
| workspace.remove – happy path with ordering | handler | ✅ | — | ✅ |
| workspace.remove – WorkspaceNotFoundError | handler | ✅ | — | ✅ |
| workspace.update – happy path | handler | ❌ | no test | ✅ |
| workspace.update – WorkspaceNotFoundError | handler | ❌ | no test | ✅ |
| workspace.update – InvalidPayloadError (bad uuid) | handler | ❌ | no test | ✅ |
| workspace.list – returns all workspaces | handler | ❌ | no test | ✅ |
| workspace.reorder – happy path | handler | ❌ | no test | ✅ |
| workspace.reorder – id set mismatch error | handler | ❌ | no test | ✅ |
| tab.open – happy path + history stamp | handler | ✅ | — | ✅ |
| tab.open – WorkspaceNotFoundError | handler | ✅ | — | ✅ |
| tab.open – InvalidPayloadError (empty padName) | handler | ❌ | no test | ✅ |
| tab.open – mode=create passes through | handler | ❌ | no test | ✅ |
| tab.open – emits tabsChanged + padHistoryChanged | handler | ❌ | no test | ✅ |
| tab.close – calls closeInAnyWindow + emits | handler | ❌ | no test | ✅ |
| tab.close – InvalidPayloadError (empty tabId) | handler | ❌ | no test | ✅ |
| tab.focus – calls focusInAnyWindow + emits | handler | ❌ | no test | ✅ |
| tab.focus – InvalidPayloadError (empty tabId) | handler | ❌ | no test | ✅ |
| tab.reload – calls reloadInAnyWindow | handler | ❌ | no test | ✅ |
| tab.reload – InvalidPayloadError (empty tabId) | handler | ❌ | no test | ✅ |
| window.setActiveWorkspace – happy path + emits | handler | ❌ | no test | ✅ |
| window.setActiveWorkspace – accepts null workspaceId | handler | ❌ | no test | ✅ |
| window.setActiveWorkspace – InvalidPayloadError | handler | ❌ | no test | ✅ |
| window.reloadShell – calls reloadShellOfActiveWindow | handler | ❌ | no test | ✅ |
| window.setPadViewsHidden – true/false paths | handler | ❌ | no test | ✅ |
| window.setPadViewsHidden – InvalidPayloadError | handler | ❌ | no test | ✅ |
| padHistory.list – empty workspace | handler | ❌ | **no test file** | ✅ |
| padHistory.list – known workspace | handler | ❌ | **no test file** | ✅ |
| padHistory.list – InvalidPayloadError | handler | ❌ | **no test file** | ✅ |
| padHistory.pin – pins entry + emits | handler | ❌ | **no test file** | ✅ |
| padHistory.pin – silent no-op for unknown padName | handler | ❌ | **no test file** | ✅ |
| padHistory.pin – InvalidPayloadError (empty padName) | handler | ❌ | **no test file** | ✅ |
| padHistory.unpin – unpins entry + emits | handler | ❌ | **no test file** | ✅ |
| padHistory.unpin – silent no-op for unknown | handler | ❌ | **no test file** | ✅ |
| padHistory.clearRecent – clears workspace entries | handler | ❌ | **no test file** | ✅ |
| padHistory.clearRecent – no-op on unknown workspace | handler | ❌ | **no test file** | ✅ |
| padHistory.clearAll – clears all entries | handler | ❌ | **no test file** | ✅ |
| settings.get – returns defaults | handler | ❌ | no test | ✅ |
| settings.update – single field | handler | ❌ | no test | ✅ |
| settings.update – multiple fields | handler | ❌ | no test | ✅ |
| settings.update – triggers reloadAllPadsWithLanguage | handler | ❌ | no test | ✅ |
| settings.update – no reload when language unchanged | handler | ❌ | no test | ✅ |
| settings.update – InvalidPayloadError (unknown field) | handler | ❌ | no test | ✅ |
| settings.update – persists across reads | handler | ❌ | no test | ✅ |
| state.getInitial – returns workspaces + order + settings | handler | ✅ | — | ✅ |

---

## App Event Subscriptions (renderer)

| Surface | Type | Pre-audit | Gap | Post-fill |
|---|---|---|---|---|
| onWorkspacesChanged – updates workspaces + order | event | ❌ | **no test file** | ✅ |
| onWorkspacesChanged – replaces with empty list | event | ❌ | **no test file** | ✅ |
| onTabsChanged – replaces tabs + activeTabId | event | ❌ | **no test file** | ✅ |
| onTabsChanged – activeTabId=null sets to null | event | ❌ | **no test file** | ✅ |
| onTabsChanged – missing activeTabId leaves existing unchanged | event | ❌ | **no test file** | ✅ |
| onTabState – updates state field | event | ❌ | **no test file** | ✅ |
| onTabState – updates errorMessage | event | ❌ | **no test file** | ✅ |
| onTabState – updates title | event | ❌ | **no test file** | ✅ |
| onTabState – does not touch other tabs | event | ❌ | **no test file** | ✅ |
| onTabState – no-op for unknown tabId | event | ❌ | **no test file** | ✅ |
| onSettingsChanged – updates settings store | event | ❌ | **no test file** | ✅ |
| onHttpLoginRequest – opens httpAuth dialog with payload | event | ❌ | **no test file** | ✅ |
| onMenuShellMessage – menu.newTab → openPad dialog | event | ❌ | **no test file** | ✅ |
| onMenuShellMessage – menu.openPad → openPad dialog | event | ❌ | **no test file** | ✅ |
| onMenuShellMessage – menu.settings → settings dialog | event | ❌ | **no test file** | ✅ |
| onMenuShellMessage – menu.about → about dialog | event | ❌ | **no test file** | ✅ |
| onMenuShellMessage – menu.reload → ipc.tab.reload | event | ❌ | **no test file** | ✅ |
| onMenuShellMessage – menu.reload no-ops when no active tab | event | ❌ | **no test file** | ✅ |
| onMenuShellMessage – unknown kind → no dialog | event | ❌ | **no test file** | ✅ |
| onPadHistoryChanged – calls list + stores result | event | ❌ | **no test file** | ✅ |
| onPadHistoryChanged – no-op when activeWorkspaceId=null | event | ❌ | **no test file** | ✅ |

---

## Tray Module (main process unit)

| Surface | Type | Status |
|---|---|---|
| setupTray – creates Tray on setEnabled(true) | unit | ✅ |
| setupTray – destroys Tray on setEnabled(false) | unit | ✅ |
| setupTray – setEnabled(true) idempotent | unit | ✅ |
| setupTray – setEnabled(false) no-op when disabled | unit | ✅ |
| setupTray – destroy() cleans up active tray | unit | ✅ |
| setupTray – destroy() no-op when never created | unit | ✅ |
| setupTray – catches Tray construction errors silently | unit | ✅ |
| setupTray – click event triggers onShow | unit | ✅ |
| setupTray – context menu "Show" triggers onShow | unit | ✅ |
| setupTray – context menu "Quit" triggers onQuit | unit | ✅ |
| settings.update – calls onMinimizeToTrayChanged when value changes | handler | ✅ |
| settings.update – does NOT call onMinimizeToTrayChanged when unchanged | handler | ✅ |

---

## Menu Template (main process unit)

| Surface | Type | Pre-audit | Gap | Post-fill |
|---|---|---|---|---|
| Contains File/Edit/View/Window/Help | unit | ✅ | — | ✅ |
| File menu accelerators | unit | ✅ | — | ✅ |
| File > New Tab click → cb.newTab() | unit | ✅ | — | ✅ |
| File > Open Pad… click → cb.openPad() | unit | ❌ | no test | ✅ |
| File > Settings click → cb.settings() | unit | ❌ | no test | ✅ |
| File > Quit click → cb.quit() | unit | ❌ | no test | ✅ |
| View > Reload Pad click → cb.reload() | unit | ❌ | no test | ✅ |
| View > Reload Pad has CmdOrCtrl+R | unit | ❌ | no test | ✅ |
| Help > About click → cb.about() | unit | ❌ | no test | ✅ |
| Help > Open Log Folder click → cb.openLogs() | unit | ❌ | no test | ✅ |
| Edit roles (undo/redo/cut/copy/paste/selectAll) | unit | ❌ | no test | ✅ |
| View roles (resetZoom/zoomIn/zoomOut/togglefullscreen) | unit | ❌ | no test | ✅ |
| Window roles (minimize/close) | unit | ❌ | no test | ✅ |
| File > Close Tab has role=close | unit | ❌ | no test | ✅ |

---

## E2E Menu Tests

| Surface | Type | Pre-audit | Gap | Post-fill |
|---|---|---|---|---|
| File > New Tab → OpenPadDialog visible | e2e | ✅ | — | ✅ |
| File > Open Pad… → OpenPadDialog visible | e2e | ✅ | — | ✅ |
| File > Settings → SettingsDialog visible | e2e | ✅ | — | ✅ |
| Help > About → AboutDialog visible | e2e | ✅ | — | ✅ |
| Help > Open Log Folder → item exists + no crash | e2e | ❌ | no test | ✅ |
| View > Reload Pad → item exists + fires | e2e | ❌ | no test | ✅ |
| File > Quit → item exists (click omitted to not kill process) | e2e | ❌ | no test | ✅ |

---

## Summary

**Pre-pass:**
- Unit tests: 143
- E2E tests: 38
- ✅ Covered: ~32 surfaces
- ⚠️ Fluffy: ~4 surfaces (IPC call side not asserted)  
- ❌ Gaps: ~100+ surfaces

**Post-pass:**
- Unit tests: 273 (+130)
- E2E tests: 41 (+3)
- ✅ All surfaces covered
- ⚠️ Fluffy: 0
- ❌ Gaps: 0

**After tray + sidebar filter (2026-05-03):**
- Unit tests: 300 (+27)
- E2E tests: 41 (unchanged)
- New surfaces: tray controller (10 tests), minimizeToTray handler (2 tests), sidebar filter (6 tests), minimizeToTray settings dialog (1 test), existing rememberTabs test fixed to use accessible name selector

**Bugs found during pass:**
- `AddWorkspaceDialog` test setup was missing `window.etherpadDesktop.window.setActiveWorkspace` mock, causing the "successful submit closes dialog" test to fail (the dialog's `submit()` calls `ipc.window.setActiveWorkspace` synchronously before `dialogActions.closeDialog()`). Fixed by adding the mock to `beforeEach`.
