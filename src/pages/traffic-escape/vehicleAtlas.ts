import type { TrafficVehicleAppearance, TrafficVehicleOrientation } from "./gameLogic";

export type TrafficVehicleAtlasRow = "two-cell" | "three-cell";

export type TrafficVehicleAtlasSlot = {
  column: 0 | 1 | 2 | 3 | 4;
  row: TrafficVehicleAtlasRow;
  x: 0 | 768 | 1536 | 2304 | 3072;
  y: 0 | 384;
  width: 768;
  height: 256 | 384;
  visibleBounds: { left: number; top: number; right: number; bottom: number };
};

export type TrafficVehicleAtlasCropStyle = {
  backgroundImage: string;
  backgroundPosition: string;
  backgroundRepeat: "no-repeat";
  backgroundSize: "500% auto";
};

const ATLAS_COLUMN_COUNT = 5;
const ATLAS_WIDTH = 3840;
const ATLAS_HEIGHT = 640;
const ATLAS_SLOT_WIDTH = 768;
const TWO_CELL_SLOT_HEIGHT = 384;
const THREE_CELL_SLOT_HEIGHT = 256;
const ATLAS_THREE_CELL_ROW_Y = TWO_CELL_SLOT_HEIGHT;

export type TrafficVehicleAtlasMaskStyle = TrafficVehicleAtlasCropStyle & {
  filter: "brightness(0)";
};

type TrafficVehicleAtlasSlotDefinition = TrafficVehicleAtlasSlot & {
  length: 2 | 3;
};

const TRAFFIC_VEHICLE_ATLAS_SLOTS: Record<TrafficVehicleAppearance, TrafficVehicleAtlasSlotDefinition> = {
  sport: { column: 0, row: "two-cell", x: 0, y: 0, width: 768, height: TWO_CELL_SLOT_HEIGHT, visibleBounds: { left: 34, top: 13, right: 732, bottom: 371 }, length: 2 },
  "compact-van": { column: 1, row: "two-cell", x: 768, y: 0, width: 768, height: TWO_CELL_SLOT_HEIGHT, visibleBounds: { left: 46, top: 13, right: 722, bottom: 371 }, length: 2 },
  "city-taxi": { column: 2, row: "two-cell", x: 1536, y: 0, width: 768, height: TWO_CELL_SLOT_HEIGHT, visibleBounds: { left: 13, top: 37, right: 755, bottom: 348 }, length: 2 },
  "pink-sport": { column: 3, row: "two-cell", x: 2304, y: 0, width: 768, height: TWO_CELL_SLOT_HEIGHT, visibleBounds: { left: 35, top: 38, right: 733, bottom: 346 }, length: 2 },
  "offroad-suv": { column: 4, row: "two-cell", x: 3072, y: 0, width: 768, height: TWO_CELL_SLOT_HEIGHT, visibleBounds: { left: 32, top: 31, right: 736, bottom: 353 }, length: 2 },
  "city-bus": { column: 0, row: "three-cell", x: 0, y: ATLAS_THREE_CELL_ROW_Y, width: 768, height: THREE_CELL_SLOT_HEIGHT, visibleBounds: { left: 18, top: 13, right: 749, bottom: 243 }, length: 3 },
  "box-truck": { column: 1, row: "three-cell", x: 768, y: ATLAS_THREE_CELL_ROW_Y, width: 768, height: THREE_CELL_SLOT_HEIGHT, visibleBounds: { left: 13, top: 23, right: 755, bottom: 234 }, length: 3 },
  "stretch-sedan": { column: 2, row: "three-cell", x: 1536, y: ATLAS_THREE_CELL_ROW_Y, width: 768, height: THREE_CELL_SLOT_HEIGHT, visibleBounds: { left: 13, top: 16, right: 755, bottom: 240 }, length: 3 },
  "camper-rv": { column: 3, row: "three-cell", x: 2304, y: ATLAS_THREE_CELL_ROW_Y, width: 768, height: THREE_CELL_SLOT_HEIGHT, visibleBounds: { left: 22, top: 18, right: 746, bottom: 239 }, length: 3 },
  "tanker-truck": { column: 4, row: "three-cell", x: 3072, y: ATLAS_THREE_CELL_ROW_Y, width: 768, height: THREE_CELL_SLOT_HEIGHT, visibleBounds: { left: 21, top: 19, right: 747, bottom: 238 }, length: 3 },
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
  const slotCenterX = ATLAS_SLOT_WIDTH / 2;
  const slotCenterY = slot.height / 2;
  const backgroundWidthFreeSpace = ATLAS_COLUMN_COUNT - 1;
  const backgroundHeightFreeSpace = (ATLAS_COLUMN_COUNT * length * ATLAS_HEIGHT) / ATLAS_WIDTH - 1;
  const xCorrection = ((visibleCenterX - slotCenterX) / slot.width / backgroundWidthFreeSpace) * 100;
  const measuredYCorrection = ((visibleCenterY - slotCenterY) / slot.height / backgroundHeightFreeSpace) * 100;
  const opticalThreeCellYOffset = length === 3 ? -5 : 0;
  const yCorrection = measuredYCorrection + opticalThreeCellYOffset;
  const formatCorrection = (value: number) => `${value >= 0 ? "+" : "-"} ${Math.abs(value).toFixed(4)}%`;
  const baseX = (slot.column * 100) / (ATLAS_COLUMN_COUNT - 1);
  const baseY = slot.row === "three-cell" ? 100 : 0;
  return {
    backgroundImage: `url(${imageUrl})`,
    backgroundPosition: `calc(${baseX}% ${formatCorrection(xCorrection)}) calc(${baseY}% ${formatCorrection(yCorrection)})`,
    backgroundRepeat: "no-repeat",
    backgroundSize: "500% auto",
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
