export type ManagedWindow = {
  destroy(): void;
  bounds(): { x: number; y: number; width: number; height: number };
};

export type WindowFactory<W extends ManagedWindow> = (opts: { bounds?: { x: number; y: number; width: number; height: number } }) => W;

export class WindowManager<W extends ManagedWindow> {
  private readonly windows: W[] = [];
  constructor(private readonly opts: { factory: WindowFactory<W> }) {}

  create(input: { bounds?: { x: number; y: number; width: number; height: number } }): W {
    const w = this.opts.factory(input);
    this.windows.push(w);
    return w;
  }

  destroy(w: W): void {
    const idx = this.windows.indexOf(w);
    if (idx >= 0) {
      this.windows.splice(idx, 1);
      w.destroy();
    }
  }

  forget(w: W): void {
    const idx = this.windows.indexOf(w);
    if (idx >= 0) this.windows.splice(idx, 1);
  }

  list(): W[] {
    return [...this.windows];
  }
}
