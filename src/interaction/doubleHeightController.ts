import type { Picker } from "./picker";
import type { Floor } from "../core/floor";
import type { Cell } from "../core/grid";

/**
 * The DOUBLE-HEIGHT tool (run 0021): arm it from the palette, click a room,
 * and that room takes the volume of the storey above its own footprint.
 * Clicking a room that already carries the mark clears it.
 *
 * It is a TOOL rather than a button on the selection readout because that is
 * how this app already asks you to mark something about a place rather than
 * place a thing: Entrance and Doorway both arm a mode and then take a click in
 * the scene, and double height is the same kind of act. The tool stays armed
 * after each click so a resident can mark several rooms in a row, and Escape
 * disarms it, both matching the other two.
 *
 * It owns no geometry and no ghost. The room it would affect is highlighted on
 * hover through the callback, and everything the mark actually does happens in
 * `ModuleStore.setDoubleHeight`, which is also what refuses when the floor
 * above is occupied.
 */
export class DoubleHeightController {
  private active = false;
  /** Instance id currently under the cursor while armed, for the hover hint. */
  private hovered: string | null = null;

  constructor(
    private canvas: HTMLCanvasElement,
    private picker: Picker,
    private getFloor: () => Floor,
    /** Toggle the mark. Returns the blocked cells when it refused, so the
     *  caller can say which ones; an empty array means it committed. */
    private onToggle: (instanceId: string) => { ok: boolean; blockedBy?: Cell[] },
    /** Highlight (or clear) the room the click would affect. */
    private onHover: (instanceId: string | null) => void
  ) {
    this.canvas.addEventListener("pointermove", (e) => this.onMove(e));
    this.canvas.addEventListener("pointerdown", (e) => this.onDown(e), true);
  }

  get isActive(): boolean {
    return this.active;
  }

  /** Arm the tool. */
  start(): void {
    this.active = true;
    this.canvas.style.cursor = "crosshair";
  }

  /** Disarm, clearing any hover. Public and no-argument so main.ts's central
   *  Escape arbitrator can call it directly, like the other tools. */
  cancel(): void {
    if (!this.active) return;
    this.active = false;
    this.hovered = null;
    this.onHover(null);
    this.canvas.style.cursor = "";
  }

  /** The room under the cursor, or null. Only rooms can be marked, so a
   *  connector, a stair or a piece of furniture reads as nothing here. */
  private roomAt(e: PointerEvent): string | null {
    const floor = this.getFloor();
    const hit = this.picker.groupAt(e.clientX, e.clientY, floor.store.groups);
    // `instanceFromObject` is the store's own hit → instance resolver, the same
    // one selection uses, so a click on a wall or a prop resolves to its room.
    const inst = floor.store.instanceFromObject(hit);
    if (!inst || inst.def.category !== "room" || inst.def.cluster) return null;
    return inst.id;
  }

  private onMove(e: PointerEvent): void {
    if (!this.active) return;
    const id = this.roomAt(e);
    if (id === this.hovered) return;
    this.hovered = id;
    this.onHover(id);
  }

  private onDown(e: PointerEvent): void {
    if (!this.active || e.button !== 0) return;
    const id = this.roomAt(e);
    if (!id) return;
    // Capture phase: the click is the tool's, so selection never also runs.
    e.stopPropagation();
    e.preventDefault();
    this.onToggle(id);
  }
}
