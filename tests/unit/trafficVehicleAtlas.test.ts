import {
  getTrafficVehicleAtlasClassName,
  getTrafficVehicleAtlasCropStyle,
  getTrafficVehicleAtlasMaskStyle,
  getTrafficVehicleAtlasSlot,
} from "../../src/pages/traffic-escape/vehicleAtlas";

describe("getTrafficVehicleAtlasSlot", () => {
  test.each([
    ["sport", 2, { column: 0, row: "two-cell", x: 0, y: 0, width: 768, height: 384, visibleBounds: { left: 34, top: 13, right: 732, bottom: 371 } }],
    ["compact-van", 2, { column: 1, row: "two-cell", x: 768, y: 0, width: 768, height: 384, visibleBounds: { left: 46, top: 13, right: 722, bottom: 371 } }],
    ["city-taxi", 2, { column: 2, row: "two-cell", x: 1536, y: 0, width: 768, height: 384, visibleBounds: { left: 13, top: 37, right: 755, bottom: 348 } }],
    ["city-bus", 3, { column: 0, row: "three-cell", x: 0, y: 384, width: 768, height: 256, visibleBounds: { left: 18, top: 13, right: 749, bottom: 243 } }],
    ["box-truck", 3, { column: 1, row: "three-cell", x: 768, y: 384, width: 768, height: 256, visibleBounds: { left: 13, top: 23, right: 755, bottom: 234 } }],
    ["stretch-sedan", 3, { column: 2, row: "three-cell", x: 1536, y: 384, width: 768, height: 256, visibleBounds: { left: 13, top: 16, right: 755, bottom: 240 } }],
    ["pink-sport", 2, { column: 3, row: "two-cell", x: 2304, y: 0, width: 768, height: 384, visibleBounds: { left: 35, top: 38, right: 733, bottom: 346 } }],
    ["offroad-suv", 2, { column: 4, row: "two-cell", x: 3072, y: 0, width: 768, height: 384, visibleBounds: { left: 32, top: 31, right: 736, bottom: 353 } }],
    ["camper-rv", 3, { column: 3, row: "three-cell", x: 2304, y: 384, width: 768, height: 256, visibleBounds: { left: 22, top: 18, right: 746, bottom: 239 } }],
    ["tanker-truck", 3, { column: 4, row: "three-cell", x: 3072, y: 384, width: 768, height: 256, visibleBounds: { left: 21, top: 19, right: 747, bottom: 238 } }],
  ] as const)("maps %s", (appearance, length, expected) => {
    expect(getTrafficVehicleAtlasSlot(appearance, length)).toEqual(expected);
  });

  test("rejects an appearance with the wrong length", () => {
    expect(() => getTrafficVehicleAtlasSlot("city-bus", 2)).toThrow("does not belong to a 2-cell vehicle");
  });

  test("maps the fourth and fifth atlas columns", () => {
    expect(getTrafficVehicleAtlasSlot("pink-sport", 2)).toMatchObject({ column: 3, row: "two-cell", x: 2304, y: 0, width: 768, height: 384 });
    expect(getTrafficVehicleAtlasSlot("tanker-truck", 3)).toMatchObject({ column: 4, row: "three-cell", x: 3072, y: 384, width: 768, height: 256 });
  });

  test("rejects an appearance with the wrong length in the expanded atlas", () => {
    expect(() => getTrafficVehicleAtlasSlot("pink-sport", 3)).toThrow("does not belong to a 3-cell vehicle");
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
      backgroundPosition: "calc(25% + 0.0000%) calc(100% - 4.8698%)",
      backgroundRepeat: "no-repeat",
      backgroundSize: "500% auto",
    });
  });

  test("uses five-column crop positioning and shared mask styles", () => {
    expect(getTrafficVehicleAtlasCropStyle("offroad-suv", 2, "https://cdn.example/v6.png").backgroundSize).toBe("500% auto");
    expect(getTrafficVehicleAtlasMaskStyle("camper-rv", 3, "https://cdn.example/v6.png")).toEqual({
      ...getTrafficVehicleAtlasCropStyle("camper-rv", 3, "https://cdn.example/v6.png"), filter: "brightness(0)",
    });
  });

  test("centers regenerated content using its measured visible bounds", () => {
    expect(getTrafficVehicleAtlasCropStyle("sport", 2, "https://cdn.example/vehicle-atlas-v5.png").backgroundPosition)
      .toBe("calc(0% - 0.0326%) calc(0% + 0.0000%)");
  });

  test("applies the optical downward correction to three-cell vehicles", () => {
    expect(getTrafficVehicleAtlasCropStyle("stretch-sedan", 3, "https://cdn.example/vehicle-atlas-v5.png").backgroundPosition)
      .toBe("calc(50% + 0.0000%) calc(100% - 5.0000%)");
  });

  test("uses the same crop coordinates for the grid-hiding vehicle mask", () => {
    expect(getTrafficVehicleAtlasMaskStyle("box-truck", 3, "https://cdn.example/vehicle-atlas-v4.png")).toEqual({
      backgroundImage: "url(https://cdn.example/vehicle-atlas-v4.png)",
      backgroundPosition: "calc(25% + 0.0000%) calc(100% - 4.8698%)",
      backgroundRepeat: "no-repeat",
      backgroundSize: "500% auto",
      filter: "brightness(0)",
    });
  });
});
