import { View, Text, Button } from "@tarojs/components";
import { useLoad } from "@tarojs/taro";
import { useState } from "react";
import { Radio } from "@nutui/nutui-react";
import "./index.scss";

let count = 0;
let time;

export default function Index() {
  useLoad(() => {
    console.log("Page loaded.");
  });

  const [formula, setFormula] = useState("");
  const [mode, setMode] = useState(10);
  const generateFormula = () => {
    if (count > 80) {
      setFormula(`${(Date.now() - time) / 1000}s`);
    } else {
      const a = Math.round(Math.random() * 10);
      const o = Math.random() > 0.5 ? "+" : "-";
      const b =
        o === "+"
          ? Math.round(Math.random() * (10 - a))
          : Math.round(Math.random() * a);

      setFormula(`${a} ${o} ${b} =`);
      count += 1;
    }
  };

  const handleStart = () => {
    generateFormula();
    time = Date.now();
  };

  return (
    <View className="mx-4">
      <View>
        <Radio.Group
          direction="horizontal"
          value={mode}
          onChange={(v) => {
            setMode(Number(v));
          }}
        >
          <Radio value="10">10以内</Radio>
          <Radio value="20">20以内</Radio>
          <Radio value="100">100以内</Radio>
        </Radio.Group>
      </View>
      <View
        className="index h-screen flex items-center justify-center"
        onClick={generateFormula}
      >
        {!formula ? (
          <Button type="primary">开始</Button>
        ) : (
          <Text className="text-6xl">{formula}</Text>
        )}
      </View>
    </View>
  );
}
