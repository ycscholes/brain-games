import { View, Text, Button } from "@tarojs/components";
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
      url: '/pages/bubble/index'
    });
  };

  return (
    <View className="index">
      <Text>Hello world!</Text>
      <View className="radio">
        <Text>选择一个选项：</Text>
        <View>
          <Text>选项1</Text>
          <Text>选项2</Text>
          <Text>选项3</Text>
        </View>
        <Text>当前选择：{selectedValue}</Text>
      </View>
      
      <Button 
        className="game-button" 
        onClick={navigateToBubbleGame}
        type="primary"
      >
        开始气球计算游戏
      </Button>
    </View>
  );
}
