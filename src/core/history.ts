/**
 * Snapshot-based undo/redo.
 *
 * The whole codebase already makes this the natural design: all DESIGN state is
 * tiny source-of-truth data (instances, entrances, floors, grid sizes) that
 * `projectIO` serializes, and every piece of DERIVED state (cluster shells,
 * stair holes, walls, windows, adjacency graph) rebuilds from it through the
 * same code paths as manual building. So a snapshot is just a serialized
 * project string, and a restore is the project-import rebuild path.
 *
 * Model: `lastState` always holds the serialized state as of the last committed
 * action (i.e. the state BEFORE the next mutation). {@link commit} — called
 * AFTER a mutating user action — pushes that previous state onto the undo stack
 * and adopts the new one; it self-ignores no-ops (serialized state unchanged),
 * so a failed placement / invalid move / same-cell drop records nothing.
 * {@link undo}/{@link redo} swap states between the stacks and re-apply via
 * `restore`. VIEW state (camera, active floor, floor visibility, plan mode,
 * selection, diagram/Check-Layout) is never serialized, so it is inherently
 * outside history.
 *
 * Snapshots are plain JSON strings (immutable, no shared refs with live
 * objects); a handful of them is trivial memory, so the stack is simply capped.
 */
export class History {
  private undoStack: string[] = [];
  private redoStack: string[] = [];
  /** Serialized state as of the last commit — the pre-state for the next one. */
  private lastState: string;
  /** Guard so a `restore` (which mutates the scene) never re-enters commit. */
  private restoring = false;

  /**
   * @param serialize  current project → a stable JSON string
   * @param restore    rebuild the whole project from a snapshot (the import path)
   * @param onChange   fired after any stack change (to refresh button state)
   * @param cap        max undo depth (requirement ≥15; default 20)
   */
  constructor(
    private serialize: () => string,
    private restore: (snapshot: string) => void,
    private onChange?: () => void,
    private cap = 20
  ) {
    this.lastState = this.serialize();
  }

  get canUndo(): boolean {
    return this.undoStack.length > 0;
  }
  get canRedo(): boolean {
    return this.redoStack.length > 0;
  }

  /**
   * Record that a mutating user action just completed. No-op if the serialized
   * state is unchanged (so failed/degenerate actions cost nothing). Any real
   * change clears the redo stack (standard semantics).
   */
  commit(): void {
    if (this.restoring) return;
    const now = this.serialize();
    if (now === this.lastState) return; // nothing actually changed
    this.undoStack.push(this.lastState);
    if (this.undoStack.length > this.cap) this.undoStack.shift();
    this.redoStack = [];
    this.lastState = now;
    this.onChange?.();
  }

  undo(): void {
    if (!this.undoStack.length) return;
    this.redoStack.push(this.lastState);
    const prev = this.undoStack.pop()!;
    this.lastState = prev;
    this.apply(prev);
  }

  redo(): void {
    if (!this.redoStack.length) return;
    this.undoStack.push(this.lastState);
    const next = this.redoStack.pop()!;
    this.lastState = next;
    this.apply(next);
  }

  private apply(snapshot: string): void {
    this.restoring = true;
    try {
      this.restore(snapshot);
    } finally {
      this.restoring = false;
    }
    this.onChange?.();
  }
}
