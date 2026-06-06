import { useEffect } from "react";
import { View, Text } from "@tarojs/components";
import Taro from "@tarojs/taro";
import "./index.scss";

export default function HeadCountRedirect() {
  useEffect(() => {
    Taro.redirectTo({ url: "/pages/bird-count/index?mode=yard" }).catch(() => {
      Taro.navigateTo({ url: "/pages/bird-count/index?mode=yard" });
    });
  }, []);

  return (
    <View className="head-count-redirect-page">
      <Text className="redirect-text">正在进入农场清点...</Text>
    </View>
  );
}
