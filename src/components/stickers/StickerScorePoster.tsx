import { Canvas } from "@tarojs/components";

interface StickerScorePosterProps {
  canvasId: string;
}

export default function StickerScorePoster({ canvasId }: StickerScorePosterProps) {
  return (
    <Canvas
      canvasId={canvasId}
      className="sticker-score-poster-canvas"
      style={{ width: "750px", height: "960px" }}
    />
  );
}
