import {
  getTrafficVehicleAtlasClassName,
  getTrafficVehicleAtlasCropStyle,
  getTrafficVehicleAtlasMaskStyle,
  getTrafficVehicleAtlasSlot,
} from "../../src/pages/traffic-escape/vehicleAtlas";
import { readFileSync } from "fs";
import { inflateSync } from "zlib";
import { join } from "path";

type TrafficVehicleAtlasPng = {
  width: number;
  height: number;
  bitDepth: number;
  colorType: number;
  pixels: Uint8Array;
  alphaAt: (x: number, y: number) => number;
  alphaBounds: (x: number, y: number, width: number, height: number) => {
    left: number;
    top: number;
    right: number;
    bottom: number;
  };
};

function readTrafficVehicleAtlasPng(): TrafficVehicleAtlasPng {
  const png = readFileSync(join(__dirname, "../../asset-backups/cloudbase-images/games/traffic-escape/vehicle-atlas.png"));
  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  expect(png.subarray(0, 8)).toEqual(signature);
  let width = 0;
  let height = 0;
  let bitDepth = 0;
  let colorType = 0;
  let interlace = 0;
  const idat: Buffer[] = [];
  let offset = 8;
  while (offset < png.length) {
    const length = png.readUInt32BE(offset);
    const type = png.toString("ascii", offset + 4, offset + 8);
    const chunk = png.subarray(offset + 8, offset + 8 + length);
    if (type === "IHDR") {
      width = chunk.readUInt32BE(0);
      height = chunk.readUInt32BE(4);
      bitDepth = chunk[8];
      colorType = chunk[9];
      interlace = chunk[12];
    } else if (type === "IDAT") {
      idat.push(chunk);
    }
    offset += 12 + length;
  }
  if (bitDepth !== 8 || colorType !== 6 || interlace !== 0) {
    throw new Error("traffic vehicle atlas must be a non-interlaced 8-bit RGBA PNG");
  }
  const stride = width * 4;
  const scanlines = inflateSync(Buffer.concat(idat));
  const pixels = new Uint8Array(width * height * 4);
  for (let y = 0; y < height; y += 1) {
    const scanlineOffset = y * (stride + 1);
    const filter = scanlines[scanlineOffset];
    const sourceOffset = scanlineOffset + 1;
    const destinationOffset = y * stride;
    for (let i = 0; i < stride; i += 1) {
      const raw = scanlines[sourceOffset + i];
      const left = i >= 4 ? pixels[destinationOffset + i - 4] : 0;
      const up = y > 0 ? pixels[destinationOffset + i - stride] : 0;
      const upperLeft = y > 0 && i >= 4 ? pixels[destinationOffset + i - stride - 4] : 0;
      if (filter === 0) pixels[destinationOffset + i] = raw;
      else if (filter === 1) pixels[destinationOffset + i] = (raw + left) & 255;
      else if (filter === 2) pixels[destinationOffset + i] = (raw + up) & 255;
      else if (filter === 3) pixels[destinationOffset + i] = (raw + Math.floor((left + up) / 2)) & 255;
      else if (filter === 4) {
        const predictor = left + up - upperLeft;
        const pa = Math.abs(predictor - left);
        const pb = Math.abs(predictor - up);
        const pc = Math.abs(predictor - upperLeft);
        const nearest = pa <= pb && pa <= pc ? left : pb <= pc ? up : upperLeft;
        pixels[destinationOffset + i] = (raw + nearest) & 255;
      } else throw new Error(`unsupported PNG filter ${filter}`);
    }
  }
  const alphaAt = (x: number, y: number) => pixels[(y * width + x) * 4 + 3];
  const alphaBounds = (x: number, y: number, slotWidth: number, slotHeight: number) => {
    let left = slotWidth;
    let top = slotHeight;
    let right = 0;
    let bottom = 0;
    for (let row = 0; row < slotHeight; row += 1) {
      for (let column = 0; column < slotWidth; column += 1) {
        if (alphaAt(x + column, y + row) === 0) continue;
        left = Math.min(left, column);
        top = Math.min(top, row);
        right = Math.max(right, column + 1);
        bottom = Math.max(bottom, row + 1);
      }
    }
    return { left, top, right, bottom };
  };
  return { width, height, bitDepth, colorType, pixels, alphaAt, alphaBounds };
}

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

  test("keeps the v6 PNG geometry synchronized with slot metadata", () => {
    const atlas = readTrafficVehicleAtlasPng();
    expect(atlas).toMatchObject({ width: 3840, height: 640, colorType: 6, bitDepth: 8 });
    for (let x = 0; x < atlas.width; x += 1) {
      expect(atlas.alphaAt(x, 0)).toBe(0);
      expect(atlas.alphaAt(x, atlas.height - 1)).toBe(0);
    }
    for (let y = 0; y < atlas.height; y += 1) {
      expect(atlas.alphaAt(0, y)).toBe(0);
      expect(atlas.alphaAt(atlas.width - 1, y)).toBe(0);
    }
    ([
      ["sport", 2], ["compact-van", 2], ["city-taxi", 2], ["pink-sport", 2], ["offroad-suv", 2],
      ["city-bus", 3], ["box-truck", 3], ["stretch-sedan", 3], ["camper-rv", 3], ["tanker-truck", 3],
    ] as const).forEach(([appearance, length]) => {
      const slot = getTrafficVehicleAtlasSlot(appearance, length);
      expect(atlas.alphaBounds(slot.x, slot.y, slot.width, slot.height)).toEqual(slot.visibleBounds);
    });
  });
});
