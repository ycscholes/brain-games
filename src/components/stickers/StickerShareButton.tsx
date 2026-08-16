import { Text, View } from "@tarojs/components";
import { useState } from "react";
import {
  canShareCompletedGameResult,
  publishGameResultSticker,
  type StickerPublishResult,
} from "../../utils/stickerPublishing";
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
    return "未完成发表，请稍后再试";
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

  if (process.env.TARO_ENV !== "weapp" || !canShareCompletedGameResult({ completed: true, isGauntlet })) {
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
      <View className="sticker-share-button" onClick={handlePublish}>
        <Text className="sticker-share-button-text">{isPublishing ? "正在打开发表页…" : "晒出本局成绩"}</Text>
        <Text className="sticker-share-button-reward">发表成功可得 30 积分（每日 3 次）</Text>
      </View>
      {feedback ? <Text className="sticker-share-feedback">{feedback}</Text> : null}
    </View>
  );
}
