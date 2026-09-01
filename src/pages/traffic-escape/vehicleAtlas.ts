import type { TrafficVehicleAppearance, TrafficVehicleOrientation } from "./gameLogic";

export type TrafficVehicleAtlasRow = "two-cell" | "three-cell";

export type TrafficVehicleAtlasSlot = {
  column: 0 | 1 | 2;
  row: TrafficVehicleAtlasRow;
  x: 0 | 1024 | 2048;
  y: 0 | 512;
  width: 1024;
  height: 341 | 512;
  visibleBounds: { left: number; top: number; right: number; bottom: number };
};

export type TrafficVehicleAtlasCropStyle = {
  backgroundImage: string;
  backgroundPosition: string;
  backgroundRepeat: "no-repeat";
  backgroundSize: "300% auto";
};

export type TrafficVehicleAtlasMaskStyle = TrafficVehicleAtlasCropStyle & {
  filter: "brightness(0)";
};

type TrafficVehicleAtlasSlotDefinition = TrafficVehicleAtlasSlot & {
  length: 2 | 3;
};

const TRAFFIC_VEHICLE_ATLAS_SLOTS: Record<TrafficVehicleAppearance, TrafficVehicleAtlasSlotDefinition> = {
  sport: { column: 0, row: "two-cell", x: 0, y: 0, width: 1024, height: 512, visibleBounds: { left: 50, top: 20, right: 973, bottom: 492 }, length: 2 },
  "compact-van": { column: 1, row: "two-cell", x: 1024, y: 0, width: 1024, height: 512, visibleBounds: { left: 67, top: 20, right: 957, bottom: 492 }, length: 2 },
  "city-taxi": { column: 2, row: "two-cell", x: 2048, y: 0, width: 1024, height: 512, visibleBounds: { left: 20, top: 52, right: 1004, bottom: 460 }, length: 2 },
  "city-bus": { column: 0, row: "three-cell", x: 0, y: 512, width: 1024, height: 341, visibleBounds: { left: 30, top: 20, right: 994, bottom: 321 }, length: 3 },
  "box-truck": { column: 1, row: "three-cell", x: 1024, y: 512, width: 1024, height: 341, visibleBounds: { left: 20, top: 28, right: 1004, bottom: 312 }, length: 3 },
  "stretch-sedan": { column: 2, row: "three-cell", x: 2048, y: 512, width: 1024, height: 341, visibleBounds: { left: 20, top: 24, right: 1004, bottom: 317 }, length: 3 },
};

export function getTrafficVehicleAtlasSlot(
  appearance: TrafficVehicleAppearance,
  length: 2 | 3,
): TrafficVehicleAtlasSlot {
  const slot = TRAFFIC_VEHICLE_ATLAS_SLOTS[appearance];
  if (slot.length !== length) {
    throw new Error(`${appearance} does not belong to a ${length}-cell vehicle`);
  }
  return {
    column: slot.column,
    row: slot.row,
    x: slot.x,
    y: slot.y,
    width: slot.width,
    height: slot.height,
    visibleBounds: slot.visibleBounds,
  };
}

export function getTrafficVehicleAtlasClassName(
  appearance: TrafficVehicleAppearance,
  length: 2 | 3,
  orientation: TrafficVehicleOrientation,
  selected = false,
): string {
  const slot = getTrafficVehicleAtlasSlot(appearance, length);
  return [
    `traffic-vehicle-atlas-${slot.row}`,
    `traffic-vehicle-atlas-column-${slot.column}`,
    `traffic-vehicle-atlas-${orientation}`,
    ...(selected ? ["traffic-vehicle-atlas-selected"] : []),
  ].join(" ");
}

export function getTrafficVehicleAtlasCropStyle(
  appearance: TrafficVehicleAppearance,
  length: 2 | 3,
  imageUrl: string,
): TrafficVehicleAtlasCropStyle {
  const slot = getTrafficVehicleAtlasSlot(appearance, length);
  return {
    backgroundImage: `url(${imageUrl})`,
    backgroundPosition: `${slot.column * 50}% ${slot.row === "three-cell" ? "100%" : "0%"}`,
    backgroundRepeat: "no-repeat",
    backgroundSize: "300% auto",
  };
}

export function getTrafficVehicleAtlasMaskStyle(
  appearance: TrafficVehicleAppearance,
  length: 2 | 3,
  imageUrl: string,
): TrafficVehicleAtlasMaskStyle {
  return {
    ...getTrafficVehicleAtlasCropStyle(appearance, length, imageUrl),
    filter: "brightness(0)",
  };
}
