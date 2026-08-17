import { Text, View } from "@tarojs/components";
import { createElement, useState } from "react";
import { claimStickerReward } from "../../utils/stickerRewards";
import { getOfficialAccountPublishFeedProps } from "../../utils/stickerPublishing";

interface NativeStickerEvent {
  detail?: {
    postUrl?: string;
  };
}

export default function OfficialAccountPublishFeed() {
  const [feedback, setFeedback] = useState("");

  if (process.env.TARO_ENV !== "weapp") {
    return null;
  }

  const props = getOfficialAccountPublishFeedProps();
  const nativeFeed = createElement("official-account-publish", {
    topic: props.topic,
    limit: props.limit,
    placeholder: props.placeholder,
    "recommend-path": props.recommendPath,
    "recommend-title": props.recommendTitle,
    bindpublishsuccess: (event: NativeStickerEvent) => {
      const postUrl = event.detail?.postUrl ?? "";
      const reward = claimStickerReward({ postUrl });
      if (!("reason" in reward)) {
        setFeedback(`发表成功，获得 ${reward.awardedPoints} 宠物积分`);
        return;
      }
      setFeedback(reward.reason === "daily-limit" ? "发表成功，今日奖励已达上限" : "这篇贴图已领取过奖励");
    },
    bindpublishfail: () => {
      setFeedback("未完成发表，可稍后再试");
    },
    binderror: () => {
      setFeedback("贴图内容暂时加载失败");
    },
  });

  return (
    <View className="sticker-feed-section">
      {nativeFeed}
      {feedback ? <Text className="sticker-feed-feedback">{feedback}</Text> : null}
    </View>
  );
}
