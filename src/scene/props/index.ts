import * as THREE from "three";
import { buildKitchenProps } from "./kitchen";

/**
 * Registry of interior-prop builders keyed by room type. A room with an entry
 * here gets its props rendered automatically (see moduleMesh). Add a builder
 * per room type to extend this beyond the Kitchen proof-of-concept.
 */
export const PROP_BUILDERS: Record<string, () => THREE.Group> = {
  kitchen: buildKitchenProps,
};
