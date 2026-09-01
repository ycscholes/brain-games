from pathlib import Path

from PIL import Image


ROOT = Path(__file__).resolve().parents[1]
ASSET_DIR = ROOT / "asset-backups/cloudbase-images/games/traffic-escape"
OUTPUT = ASSET_DIR / "vehicle-atlas.png"
TILE_WIDTH = 1024
TWO_CELL_HEIGHT = 512
THREE_CELL_HEIGHT = 341
PADDING = 20
ROWS = (
    (("vehicle-target.png", "vehicle-compact-van.png", "vehicle-city-taxi.png"), TWO_CELL_HEIGHT),
    (("vehicle-city-bus.png", "vehicle-box-truck.png", "vehicle-stretch-sedan.png"), THREE_CELL_HEIGHT),
)


def trim_transparent_bounds(path: Path) -> Image.Image:
    image = Image.open(path).convert("RGBA")
    bounds = image.getchannel("A").getbbox()
    if bounds is None:
        raise ValueError(f"{path} has no visible pixels")
    return image.crop(bounds)


def place_vehicle(atlas: Image.Image, filename: str, x: int, y: int, width: int, height: int) -> None:
    vehicle = trim_transparent_bounds(ASSET_DIR / filename)
    vehicle.thumbnail((width - PADDING * 2, height - PADDING * 2), Image.Resampling.LANCZOS)
    left = x + (width - vehicle.width) // 2
    top = y + (height - vehicle.height) // 2
    atlas.alpha_composite(vehicle, (left, top))


def main() -> None:
    atlas = Image.new(
        "RGBA",
        (TILE_WIDTH * 3, TWO_CELL_HEIGHT + THREE_CELL_HEIGHT),
        (0, 0, 0, 0),
    )
    top = 0
    for filenames, height in ROWS:
        for column, filename in enumerate(filenames):
            place_vehicle(atlas, filename, column * TILE_WIDTH, top, TILE_WIDTH, height)
        top += height
    atlas.save(OUTPUT, optimize=True)


if __name__ == "__main__":
    main()
