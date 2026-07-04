import type { Cell } from "./grid";
import type { Side } from "./exteriorEdges";

/**
 * A ground-floor entrance: a door marker bound to one EXTERIOR EDGE of a
 * room/cluster. Stored as the host cell + the side the door sits on. The host
 * NODE (room or circulation cluster) is resolved from the cell at graph-compute
 * time, so the entrance simply follows whatever room/cluster owns that cell. An
 * entrance roots reachability — the node it attaches to becomes an entry node.
 *
 * Only floor 0 (ground) carries entrances. Serialized in the project file.
 */
export interface Entrance {
  /** Stable id = the edge key (an edge hosts at most one entrance). */
  id: string;
  cell: Cell;
  side: Side;
}
