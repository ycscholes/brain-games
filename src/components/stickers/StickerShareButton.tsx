import { Text, View } from "@tarojs/components";
import { useEffect, useRef, useState } from "react";
import StickerScorePoster from "./StickerScorePoster";
import {
  canShareCompletedGameResult,
  isOfficialAccountStickerRuntimeSupported,
  publishGameResultSticker,
  type StickerPublishResult,
} from "../../utils/stickerPublishing";
import { exportStickerScorePoster } from "../../utils/stickerScorePoster";
import "./index.scss";

interface StickerShareButtonProps {
  gameTitle: string;
  score: number;
  pagePath: string;
  isGauntlet?: boolean;
}

function getFeedback(result: StickerPublishResult) {
  if (result.status === "published") {
    if (!("reason" in result.reward)) {
      return `发表成功，获得 ${result.reward.awardedPoints} 宠物积分`;
    }
    if (result.reward.reason === "daily-limit") {
      return "发表成功，今日贴图奖励已达上限";
    }
    return "发表成功，这篇贴图已领取过奖励";
  }
  if (result.status === "failed") {
    if (/permission|auth/i.test(result.message ?? "")) {
      return "贴图发表权限暂不可用，请确认小程序已开通该能力";
    }
    return result.message ? `贴图发表失败：${result.message}` : "未完成发表，请稍后再试";
  }
  if (result.status === "cancelled") {
    return "已取消发表，未发放积分";
  }
  return "当前微信版本暂不支持贴图发表";
}

export default function StickerShareButton({
  gameTitle,
  score,
  pagePath,
  isGauntlet = false,
}: StickerShareButtonProps) {
  const [isPublishing, setIsPublishing] = useState(false);
  const [feedback, setFeedback] = useState("");
  const [isPreparingPoster, setIsPreparingPoster] = useState(true);
  const canvasIdRef = useRef("sticker-score-poster");
  const imagePathRef = useRef<string>();
  const canShare = isOfficialAccountStickerRuntimeSupported() && canShareCompletedGameResult({ completed: true, isGauntlet });

  useEffect(() => {
    if (!canShare) {
      return undefined;
    }

    let isCurrent = true;
    imagePathRef.current = undefined;
    setIsPreparingPoster(true);

    void exportStickerScorePoster({
      canvasId: canvasIdRef.current,
      gameTitle,
      score,
    }).then((imagePath) => {
      if (isCurrent) {
        imagePathRef.current = imagePath;
      }
    }).catch(() => {
      // The native editor can still accept the score text without an image.
    }).finally(() => {
      if (isCurrent) {
        setIsPreparingPoster(false);
      }
    });

    return () => {
      isCurrent = false;
    };
  }, [canShare, gameTitle, score]);

  if (!canShare) {
    return null;
  }

  const handlePublish = () => {
    if (isPublishing) {
      return;
    }

    setIsPublishing(true);
    setFeedback("");

    const result = publishGameResultSticker({
      gameTitle,
      score,
      pagePath,
      imagePath: imagePathRef.current,
      onResult: (publishResult) => {
        setIsPublishing(false);
        setFeedback(getFeedback(publishResult));
      },
    });

    if (result.status !== "opened") {
      setIsPublishing(false);
      setFeedback(getFeedback(result));
    }
  };

  return (
    <View className="sticker-share-wrap">
      {isPreparingPoster ? <StickerScorePoster canvasId={canvasIdRef.current} /> : null}
      <View className="sticker-share-button" onClick={handlePublish}>
        <Text className="sticker-share-button-text">{isPublishing ? "正在打开发表页…" : "晒出本局成绩"}</Text>
        <Text className="sticker-share-button-reward">发表成功可得 30 积分（每日 3 次）</Text>
      </View>
      {feedback ? <Text className="sticker-share-feedback">{feedback}</Text> : null}
    </View>
  );
}
