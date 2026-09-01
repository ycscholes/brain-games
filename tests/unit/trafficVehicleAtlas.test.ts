import {
  getTrafficVehicleAtlasClassName,
  getTrafficVehicleAtlasCropStyle,
  getTrafficVehicleAtlasSlot,
} from "../../src/pages/traffic-escape/vehicleAtlas";

describe("getTrafficVehicleAtlasSlot", () => {
  test.each([
    ["sport", 2, { column: 0, row: "two-cell" }],
    ["compact-van", 2, { column: 1, row: "two-cell" }],
    ["city-taxi", 2, { column: 2, row: "two-cell" }],
    ["city-bus", 3, { column: 0, row: "three-cell" }],
    ["box-truck", 3, { column: 1, row: "three-cell" }],
    ["stretch-sedan", 3, { column: 2, row: "three-cell" }],
  ] as const)("maps %s", (appearance, length, expected) => {
    expect(getTrafficVehicleAtlasSlot(appearance, length)).toEqual(expected);
  });

  test("rejects an appearance with the wrong length", () => {
    expect(() => getTrafficVehicleAtlasSlot("city-bus", 2)).toThrow("does not belong to a 2-cell vehicle");
  });

  test("creates an unscaled horizontal viewport class for a two-cell vehicle", () => {
    expect(getTrafficVehicleAtlasClassName("compact-van", 2, "horizontal")).toBe(
      "traffic-vehicle-atlas-two-cell traffic-vehicle-atlas-column-1 traffic-vehicle-atlas-horizontal",
    );
  });

  test("creates a rotated three-cell viewport class for a vertical vehicle", () => {
    expect(getTrafficVehicleAtlasClassName("box-truck", 3, "vertical")).toBe(
      "traffic-vehicle-atlas-three-cell traffic-vehicle-atlas-column-1 traffic-vehicle-atlas-vertical",
    );
  });

  test("uses explicit atlas coordinates for the regenerated middle truck", () => {
    expect(getTrafficVehicleAtlasCropStyle("box-truck", 3, "https://cdn.example/vehicle-atlas-v2.png")).toEqual({
      backgroundImage: "url(https://cdn.example/vehicle-atlas-v2.png)",
      backgroundPosition: "50% 100%",
      backgroundRepeat: "no-repeat",
      backgroundSize: "300% auto",
    });
  });
});
