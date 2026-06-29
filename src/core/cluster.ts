import type { Cell } from "./grid";

/**
 * Group cells into connected components by ORTHOGONAL (4-neighbour) adjacency —
 * cells touching only at a corner are NOT connected. Duplicate cells are merged.
 *
 * Shared by the connector cluster shells (clusterShells.ts) and the adjacency
 * graph (adjacencyGraph.ts), so "what counts as one cluster" is defined once.
 */
export function connectedComponents(cells: Cell[]): Cell[][] {
  const map = new Map<string, Cell>();
  for (const c of cells) map.set(`${c.cx},${c.cz}`, c);

  const visited = new Set<string>();
  const components: Cell[][] = [];
  const neighbours = [
    [1, 0],
    [-1, 0],
    [0, 1],
    [0, -1],
  ];

  for (const [startKey, startCell] of map) {
    if (visited.has(startKey)) continue;
    const component: Cell[] = [];
    const stack: Cell[] = [startCell];
    visited.add(startKey);
    while (stack.length) {
      const c = stack.pop()!;
      component.push(c);
      for (const [dx, dz] of neighbours) {
        const nk = `${c.cx + dx},${c.cz + dz}`;
        if (map.has(nk) && !visited.has(nk)) {
          visited.add(nk);
          stack.push(map.get(nk)!);
        }
      }
    }
    components.push(component);
  }
  return components;
}

/**
 * Stable id for a connector cluster node (Circulation / Outdoor), derived from
 * its cluster key + the lexicographically-first cell of the component. Defined
 * once so the adjacency graph and the 3D cluster shells label the same cluster
 * identically — the rules-validation 3D highlight relies on that agreement.
 */
export function clusterNodeId(key: string, component: Cell[]): string {
  const minCell = component.map((c) => `${c.cx},${c.cz}`).sort()[0];
  return `cluster:${key}:${minCell}`;
}
