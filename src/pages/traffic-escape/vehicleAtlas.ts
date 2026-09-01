import type { TrafficVehicleAppearance, TrafficVehicleOrientation } from "./gameLogic";

export type TrafficVehicleAtlasRow = "two-cell" | "three-cell";

export type TrafficVehicleAtlasSlot = {
  column: 0 | 1 | 2;
  row: TrafficVehicleAtlasRow;
};

export type TrafficVehicleAtlasCropStyle = {
  backgroundImage: string;
  backgroundPosition: string;
  backgroundRepeat: "no-repeat";
  backgroundSize: "300% auto";
};

type TrafficVehicleAtlasSlotDefinition = TrafficVehicleAtlasSlot & {
  length: 2 | 3;
};

const TRAFFIC_VEHICLE_ATLAS_SLOTS: Record<TrafficVehicleAppearance, TrafficVehicleAtlasSlotDefinition> = {
  sport: { column: 0, row: "two-cell", length: 2 },
  "compact-van": { column: 1, row: "two-cell", length: 2 },
  "city-taxi": { column: 2, row: "two-cell", length: 2 },
  "city-bus": { column: 0, row: "three-cell", length: 3 },
  "box-truck": { column: 1, row: "three-cell", length: 3 },
  "stretch-sedan": { column: 2, row: "three-cell", length: 3 },
};

export function getTrafficVehicleAtlasSlot(
  appearance: TrafficVehicleAppearance,
  length: 2 | 3,
): TrafficVehicleAtlasSlot {
  const slot = TRAFFIC_VEHICLE_ATLAS_SLOTS[appearance];
  if (slot.length !== length) {
    throw new Error(`${appearance} does not belong to a ${length}-cell vehicle`);
  }
  return { column: slot.column, row: slot.row };
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
