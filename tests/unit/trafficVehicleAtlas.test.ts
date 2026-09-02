import {
  getTrafficVehicleAtlasClassName,
  getTrafficVehicleAtlasCropStyle,
  getTrafficVehicleAtlasMaskStyle,
  getTrafficVehicleAtlasSlot,
} from "../../src/pages/traffic-escape/vehicleAtlas";

describe("getTrafficVehicleAtlasSlot", () => {
  test.each([
    ["sport", 2, { column: 0, row: "two-cell", x: 0, y: 0, width: 1024, height: 512, visibleBounds: { left: 49, top: 20, right: 974, bottom: 492 } }],
    ["compact-van", 2, { column: 1, row: "two-cell", x: 1024, y: 0, width: 1024, height: 512, visibleBounds: { left: 63, top: 20, right: 961, bottom: 492 } }],
    ["city-taxi", 2, { column: 2, row: "two-cell", x: 2048, y: 0, width: 1024, height: 512, visibleBounds: { left: 20, top: 51, right: 1004, bottom: 461 } }],
    ["city-bus", 3, { column: 0, row: "three-cell", x: 0, y: 512, width: 1024, height: 341, visibleBounds: { left: 27, top: 20, right: 996, bottom: 321 } }],
    ["box-truck", 3, { column: 1, row: "three-cell", x: 1024, y: 512, width: 1024, height: 341, visibleBounds: { left: 20, top: 33, right: 1004, bottom: 308 } }],
    ["stretch-sedan", 3, { column: 2, row: "three-cell", x: 2048, y: 512, width: 1024, height: 341, visibleBounds: { left: 20, top: 24, right: 1004, bottom: 316 } }],
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

  test("marks only the atlas viewport as selected", () => {
    expect(getTrafficVehicleAtlasClassName("compact-van", 2, "horizontal", true)).toBe(
      "traffic-vehicle-atlas-two-cell traffic-vehicle-atlas-column-1 traffic-vehicle-atlas-horizontal traffic-vehicle-atlas-selected",
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
      backgroundPosition: "calc(50% + 0.0000%) calc(100% - 5.0000%)",
      backgroundRepeat: "no-repeat",
      backgroundSize: "300% auto",
    });
  });

  test("centers regenerated content using its measured visible bounds", () => {
    expect(getTrafficVehicleAtlasCropStyle("sport", 2, "https://cdn.example/vehicle-atlas-v5.png").backgroundPosition)
      .toBe("calc(0% - 0.0244%) calc(0% + 0.0000%)");
  });

  test("applies the optical downward correction to three-cell vehicles", () => {
    expect(getTrafficVehicleAtlasCropStyle("stretch-sedan", 3, "https://cdn.example/vehicle-atlas-v5.png").backgroundPosition)
      .toBe("calc(100% + 0.0000%) calc(100% - 5.0978%)");
  });

  test("uses the same crop coordinates for the grid-hiding vehicle mask", () => {
    expect(getTrafficVehicleAtlasMaskStyle("box-truck", 3, "https://cdn.example/vehicle-atlas-v4.png")).toEqual({
      backgroundImage: "url(https://cdn.example/vehicle-atlas-v4.png)",
      backgroundPosition: "calc(50% + 0.0000%) calc(100% - 5.0000%)",
      backgroundRepeat: "no-repeat",
      backgroundSize: "300% auto",
      filter: "brightness(0)",
    });
  });
});
