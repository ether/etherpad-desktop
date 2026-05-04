# Etherpad Desktop — Manual Smoke Checklist (Linux)

Run after each release candidate, on a fresh Ubuntu 24.04 (or container) and on a developer machine.

## Install

- [ ] Download the AppImage from GitHub Releases.
- [ ] `chmod +x Etherpad-Desktop-<version>.AppImage`.
- [ ] Run it. Window opens to "Add your first workspace".
- [ ] Cancel button is **not visible** (first-run modal is non-dismissable).

## First workspace

- [ ] Enter a real Etherpad URL (e.g. `https://primarypad.com` or any test server).
- [ ] Click Add. Within ~3s the dialog dismisses and the workspace appears in the rail.
- [ ] Rail icon shows the first two letters of the workspace name in upper-case.

## Open a pad

- [ ] Press `Ctrl+T`. The "Open pad" dialog appears with the input focused.
- [ ] Type a pad name. Click Open.
- [ ] A new tab appears in the tab strip. The pad loads in the main area.
- [ ] Type into the pad. The Etherpad UI behaves identically to the browser version.

## Multiple tabs

- [ ] Open two more pads. Tabs stack horizontally; clicking each one switches the visible pad.
- [ ] `Ctrl+W` closes the active tab.

## Multiple workspaces

- [ ] Click `+` in the rail. Add a second workspace pointing at a different server.
- [ ] Click between rail icons. The tab strip and sidebar update accordingly.
- [ ] Open a pad in workspace B. Verify the tab from workspace A is hidden when B is active.

## Restart persistence

- [ ] Quit the app. Relaunch.
- [ ] Both workspaces still in the rail. Active workspace's tabs reload.
- [ ] Pad sidebar in each workspace shows recent pads.

## Remove workspace

- [ ] Open Settings (rail cog or `Ctrl+,`).
- [ ] Click "Remove" next to a workspace. Confirmation dialog appears.
- [ ] Confirm. Workspace disappears, its tabs close, history is cleared.
- [ ] Verify on disk: `~/.config/etherpad-desktop/Partitions/persist:ws-<id>/` is gone.

## Error states

- [ ] Add a workspace pointing at a non-Etherpad URL. Probe should fail with "URL does not look like Etherpad."
- [ ] Add a workspace pointing at an unreachable host. Probe should fail with "Could not reach that server."
- [ ] Open a pad while disconnected from the network. The tab shows the error overlay with Retry.

## Logs

- [ ] Help → Open Log Folder shows `~/.config/etherpad-desktop/logs/main.log`.
- [ ] Verify: no pad names, no pad content, no server URLs in the log.

## Native integration

- [ ] File / Edit / View / Window / Help menu items work.
- [ ] `Ctrl+,` opens Settings.
- [ ] `Ctrl+R` reloads the active pad.
- [ ] Close the window — app quits (Linux behaviour).

## .deb install

- [ ] Install the `.deb` on a clean Ubuntu via `sudo apt install ./etherpad-desktop_<version>_amd64.deb`.
- [ ] Launch from GNOME activities. App appears with Etherpad icon.
- [ ] Repeat all the above happy-path steps.
