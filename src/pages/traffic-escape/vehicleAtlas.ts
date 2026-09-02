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
  sport: { column: 0, row: "two-cell", x: 0, y: 0, width: 1024, height: 512, visibleBounds: { left: 49, top: 20, right: 974, bottom: 492 }, length: 2 },
  "compact-van": { column: 1, row: "two-cell", x: 1024, y: 0, width: 1024, height: 512, visibleBounds: { left: 63, top: 20, right: 961, bottom: 492 }, length: 2 },
  "city-taxi": { column: 2, row: "two-cell", x: 2048, y: 0, width: 1024, height: 512, visibleBounds: { left: 20, top: 51, right: 1004, bottom: 461 }, length: 2 },
  "city-bus": { column: 0, row: "three-cell", x: 0, y: 512, width: 1024, height: 341, visibleBounds: { left: 27, top: 20, right: 996, bottom: 321 }, length: 3 },
  "box-truck": { column: 1, row: "three-cell", x: 1024, y: 512, width: 1024, height: 341, visibleBounds: { left: 20, top: 33, right: 1004, bottom: 308 }, length: 3 },
  "stretch-sedan": { column: 2, row: "three-cell", x: 2048, y: 512, width: 1024, height: 341, visibleBounds: { left: 20, top: 24, right: 1004, bottom: 316 }, length: 3 },
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
  const visibleCenterX = (slot.visibleBounds.left + slot.visibleBounds.right) / 2;
  const visibleCenterY = (slot.visibleBounds.top + slot.visibleBounds.bottom) / 2;
  const slotCenterX = slot.width / 2;
  const slotCenterY = slot.height / 2;
  const backgroundWidthFreeSpace = 2;
  const backgroundHeightFreeSpace = 3 * length * (853 / 3072) - 1;
  const xCorrection = ((visibleCenterX - slotCenterX) / slot.width / backgroundWidthFreeSpace) * 100;
  const measuredYCorrection = ((visibleCenterY - slotCenterY) / slot.height / backgroundHeightFreeSpace) * 100;
  const opticalThreeCellYOffset = length === 3 ? -5 : 0;
  const yCorrection = measuredYCorrection + opticalThreeCellYOffset;
  const formatCorrection = (value: number) => `${value >= 0 ? "+" : "-"} ${Math.abs(value).toFixed(4)}%`;
  const baseX = slot.column * 50;
  const baseY = slot.row === "three-cell" ? 100 : 0;
  return {
    backgroundImage: `url(${imageUrl})`,
    backgroundPosition: `calc(${baseX}% ${formatCorrection(xCorrection)}) calc(${baseY}% ${formatCorrection(yCorrection)})`,
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
