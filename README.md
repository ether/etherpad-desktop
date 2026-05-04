# Etherpad Desktop

Native desktop client for [Etherpad](https://etherpad.org/). Multi-workspace
thin client with per-workspace session isolation and native chrome.

Linux is the launch platform; Windows and macOS land in subsequent releases.

## Install (Linux)

Download the latest release from [Releases](https://github.com/ether/etherpad-desktop/releases):

- `Etherpad-Desktop-<version>.AppImage` — single file, double-click to run (after `chmod +x`).
- `etherpad-desktop_<version>_amd64.deb` — proper system install:
  ```bash
  sudo apt install ./etherpad-desktop_<version>_amd64.deb
  etherpad-desktop
  ```

## Develop

Requires Node 20+ and `pnpm`.

```bash
pnpm install
pnpm dev          # run in dev mode
pnpm test         # unit + component tests
pnpm test:e2e     # Playwright E2E (requires Etherpad on :9003 — fixture handles this)
pnpm typecheck
pnpm lint
pnpm package      # build AppImage + deb under release/
```

## Architecture

See [`docs/superpowers/specs/2026-05-03-etherpad-desktop-linux-mvp-design.md`](docs/superpowers/specs/2026-05-03-etherpad-desktop-linux-mvp-design.md).

## License

Apache-2.0. See [`LICENSE`](LICENSE) and [`NOTICE`](NOTICE).
