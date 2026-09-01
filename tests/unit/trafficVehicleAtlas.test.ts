import { getTrafficVehicleAtlasSlot } from "../../src/pages/traffic-escape/vehicleAtlas";

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
});
