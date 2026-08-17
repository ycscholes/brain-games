import Taro from "@tarojs/taro";

const POSTER_WIDTH = 750;
const POSTER_HEIGHT = 960;

export interface StickerScorePosterInput {
  canvasId: string;
  gameTitle: string;
  score: number;
}

export function exportStickerScorePoster({ canvasId, gameTitle, score }: StickerScorePosterInput) {
  return new Promise<string>((resolve, reject) => {
    const context = Taro.createCanvasContext(canvasId);

    context.setFillStyle("#eef2ff");
    context.fillRect(0, 0, POSTER_WIDTH, POSTER_HEIGHT);
    context.setFillStyle("#ffffff");
    context.fillRect(42, 42, POSTER_WIDTH - 84, POSTER_HEIGHT - 84);
    context.setStrokeStyle("#c7d2fe");
    context.setLineWidth(4);
    context.strokeRect(42, 42, POSTER_WIDTH - 84, POSTER_HEIGHT - 84);

    context.setFillStyle("#4f46e5");
    context.setFontSize(36);
    context.setTextAlign("center");
    context.fillText("Cici 脑力训练", POSTER_WIDTH / 2, 146);
    context.setFillStyle("#1f2937");
    context.setFontSize(54);
    context.fillText(gameTitle, POSTER_WIDTH / 2, 302);
    context.setFillStyle("#6366f1");
    context.setFontSize(136);
    context.fillText(String(score), POSTER_WIDTH / 2, 466);
    context.setFillStyle("#64748b");
    context.setFontSize(30);
    context.fillText("本局游戏得分", POSTER_WIDTH / 2, 528);
    context.setFillStyle("#312e81");
    context.setFontSize(38);
    context.fillText("每天练一点，脑力更在线", POSTER_WIDTH / 2, 686);
    context.setFillStyle("#818cf8");
    context.setFontSize(28);
    context.fillText("晒出成绩 · 和朋友一起打卡", POSTER_WIDTH / 2, 752);

    context.draw(false, () => {
      Taro.canvasToTempFilePath({
        canvasId,
        x: 0,
        y: 0,
        width: POSTER_WIDTH,
        height: POSTER_HEIGHT,
        destWidth: POSTER_WIDTH,
        destHeight: POSTER_HEIGHT,
        fileType: "png",
      }).then((result) => {
        if (!result.tempFilePath) {
          reject(new Error("成绩海报导出失败"));
          return;
        }
        resolve(result.tempFilePath);
      }).catch(reject);
    });
  });
}
