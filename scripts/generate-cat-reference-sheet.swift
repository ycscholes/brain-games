import AppKit
import Foundation

let root = URL(fileURLWithPath: FileManager.default.currentDirectoryPath)
let sourceDir = root.appendingPathComponent("asset-backups/cloudbase-images/pets")
let outputPaths = [
  root.appendingPathComponent("asset-backups/cloudbase-images/pets/cat-reference-sheet.png"),
  root.appendingPathComponent("cloudfunctions/shared/assets/cat-reference-sheet.png"),
]
let moods = ["idle", "feed", "cuddle", "hungry"]
let cellSize = CGFloat(384)
let pixelSize = 768

guard let bitmap = NSBitmapImageRep(
  bitmapDataPlanes: nil,
  pixelsWide: pixelSize,
  pixelsHigh: pixelSize,
  bitsPerSample: 8,
  samplesPerPixel: 4,
  hasAlpha: true,
  isPlanar: false,
  colorSpaceName: .deviceRGB,
  bytesPerRow: 0,
  bitsPerPixel: 0
) else {
  fatalError("Unable to create bitmap")
}

bitmap.size = NSSize(width: pixelSize, height: pixelSize)
NSGraphicsContext.saveGraphicsState()
NSGraphicsContext.current = NSGraphicsContext(bitmapImageRep: bitmap)
NSColor(calibratedRed: 0, green: 1, blue: 0, alpha: 1).setFill()
NSBezierPath(rect: NSRect(x: 0, y: 0, width: pixelSize, height: pixelSize)).fill()

for (index, mood) in moods.enumerated() {
  let url = sourceDir.appendingPathComponent("cat-\(mood).png")
  guard let source = NSImage(contentsOf: url) else {
    fatalError("Missing source image: \(url.path)")
  }
  let row = index / 2
  let column = index % 2
  let targetX = CGFloat(column) * cellSize
  let targetY = CGFloat(1 - row) * cellSize
  let scale = min(cellSize / source.size.width, cellSize / source.size.height)
  let drawSize = NSSize(width: source.size.width * scale, height: source.size.height * scale)
  let drawRect = NSRect(
    x: targetX + (cellSize - drawSize.width) / 2,
    y: targetY + (cellSize - drawSize.height) / 2,
    width: drawSize.width,
    height: drawSize.height
  )
  source.draw(in: drawRect, from: NSRect(origin: .zero, size: source.size), operation: .sourceOver, fraction: 1)
}

NSGraphicsContext.restoreGraphicsState()

guard let png = bitmap.representation(using: .png, properties: [:]) else {
  fatalError("Unable to render cat reference sheet")
}

for output in outputPaths {
  try FileManager.default.createDirectory(at: output.deletingLastPathComponent(), withIntermediateDirectories: true)
  try png.write(to: output)
  print(output.path)
}
