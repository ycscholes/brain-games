import { View, Button } from "@tarojs/components";
import Taro from "@tarojs/taro";
import { useState } from "react";
import "./index.scss";

export default function Index() {
  const [selectedValue, setSelectedValue] = useState("1");

  const handleChange = (value: string) => {
    setSelectedValue(value);
  };

  const navigateToBubbleGame = () => {
    Taro.navigateTo({
      url: "/pages/bubble/index",
    });
  };

  const navigateToMemoryGame = () => {
    Taro.navigateTo({
      url: "/pages/memory-challenge/index",
    });
  };

  return (
    <View className="index p-4 bg-gray-50 min-h-screen">
      <Button
        className="game-button"
        onClick={navigateToBubbleGame}
        type="primary"
      >
        开始气球计算游戏
      </Button>
      <Button
        className="game-button"
        onClick={navigateToMemoryGame}
        type="primary"
        style={{
          background: "linear-gradient(135deg, #f6d365 0%, #fda085 100%)",
        }}
      >
        奇趣图形记忆
      </Button>
    </View>
  );
}
