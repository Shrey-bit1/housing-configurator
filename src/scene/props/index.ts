import * as THREE from "three";
import { buildKitchenProps } from "./kitchen";
import {
  buildBathroomSmallProps,
  buildBathroomLargeProps,
  buildBedroomSmallProps,
  buildBedroomLargeProps,
  buildLivingProps,
  buildRecreationProps,
} from "./rooms";

/**
 * Registry of interior-prop builders keyed by room type. A room with an entry
 * here gets its props rendered automatically (see moduleMesh). Add a builder
 * per room type to extend this.
 *
 * `mirrored` is the room instance's flip; a builder reflects its layout to match
 * (handled inside {@link buildPropsMesh}). Circulation/Outdoor connectors have
 * no builder (empty shells).
 */
export const PROP_BUILDERS: Record<string, (mirrored: boolean) => THREE.Group> = {
  kitchen: buildKitchenProps,
  bathroom_small: buildBathroomSmallProps,
  bathroom_large: buildBathroomLargeProps,
  bedroom_small: buildBedroomSmallProps,
  bedroom_large: buildBedroomLargeProps,
  living: buildLivingProps,
  recreation: buildRecreationProps,
};
