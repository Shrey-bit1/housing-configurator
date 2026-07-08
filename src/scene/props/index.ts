import * as THREE from "three";
import { buildKitchenProps } from "./kitchen";

/**
 * Registry of interior-prop builders keyed by room type. A room with an entry
 * here gets its props rendered automatically (see moduleMesh). Add a builder
 * per room type to extend this beyond the Kitchen proof-of-concept.
 *
 * `mirrored` is the room instance's flip; a builder reflects its layout to match
 * (see {@link buildKitchenProps}). Builders that ignore it render unmirrored,
 * which is fine for symmetric layouts.
 */
export const PROP_BUILDERS: Record<string, (mirrored: boolean) => THREE.Group> = {
  kitchen: buildKitchenProps,
};
