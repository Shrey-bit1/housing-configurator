import * as THREE from "three";
import type { Grid, Cell } from "../core/grid";
import type { ModuleDef } from "../core/modules";
import { buildModuleMesh, setGhostValidity } from "./moduleMesh";

/** One selected member's ghost description for a group move — its own def/pose,
 *  plus its cell offset from the GRABBED member's origin (the drag anchor). */
export interface GroupGhostMember {
  def: ModuleDef;
  rotation: number;
  mirrored: boolean;
  relOffset: Cell;
}

/**
 * Translucent multi-instance preview for a GROUP move (see
 * `SelectionController` — dragging any member of a multi-selection moves the
 * whole set rigidly). One ghost mesh per member, positioned by its
 * {@link GroupGhostMember.relOffset} from the grabbed member's target origin,
 * and tinted green/red as ONE unit — the group is valid or it isn't, there are
 * no partial commits (mirrors `GhostPreview`'s single-instance API/shape).
 */
export class GroupGhostPreview {
  private groups: THREE.Group[] = [];
  private members: GroupGhostMember[] = [];

  /** Parent container (the active floor's group) and grid — swapped by the
   *  FloorManager on floor switch, same as `GhostPreview`. */
  constructor(public parent: THREE.Object3D, public grid: Grid) {}

  get isActive(): boolean {
    return this.groups.length > 0;
  }

  /** Begin previewing `members` (translucent, hidden until the first
   *  {@link updatePositions}). */
  begin(members: GroupGhostMember[]): void {
    this.clear();
    this.members = members;
    for (const m of members) {
      const g = buildModuleMesh(m.def, m.rotation, true, undefined, m.mirrored);
      g.visible = false;
      this.parent.add(g);
      this.groups.push(g);
    }
  }

  /** Position every member ghost relative to `origin` (the grabbed member's
   *  target origin cell) and show them all. */
  updatePositions(origin: Cell): void {
    this.members.forEach((m, i) => {
      const g = this.groups[i];
      g.visible = true;
      g.position.copy(
        this.grid.gridToWorld(origin.cx + m.relOffset.cx, origin.cz + m.relOffset.cz)
      );
    });
  }

  /** Tint every member ghost green (valid) or red (invalid) — one verdict for
   *  the whole group. */
  setValidity(valid: boolean): void {
    for (const g of this.groups) setGhostValidity(g, valid);
  }

  hide(): void {
    for (const g of this.groups) g.visible = false;
  }

  clear(): void {
    for (const g of this.groups) g.removeFromParent();
    this.groups = [];
    this.members = [];
  }
}
