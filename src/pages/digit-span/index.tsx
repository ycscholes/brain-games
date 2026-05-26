import { useCallback, useEffect, useRef, useState } from "react";
import { View, Text } from "@tarojs/components";
import Taro, { useDidShow, useLoad } from "@tarojs/taro";
import { addPointsToPet } from "../../utils/petStorage";
import {
  getAwardedPoints,
  getTrainingDifficultyLabel,
  recordTrainingSession,
  type TrainingDifficulty,
} from "../../utils/trainingStorage";
import "./index.scss";

type Phase = "start" | "showing" | "input" | "finished";

const INITIAL_LENGTH: Record<TrainingDifficulty, number> = {
  normal: 3,
  hard: 4,
};
const REVEAL_MS: Record<TrainingDifficulty, number> = {
  normal: 1000,
  hard: 800,
};
const STORAGE_KEY_PREFIX = "digit_span_best";
const DIGIT_KEYS = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "0"] as const;

const randomDigit = () => Math.floor(Math.random() * 10).toString();

function buildSequence(length: number): string {
  return Array.from({ length }, () => randomDigit()).join("");
}

export default function DigitSpan() {
  const [phase, setPhase] = useState<Phase>("start");
  const [rewardDifficulty, setRewardDifficulty] = useState<TrainingDifficulty>("normal");
  const [best, setBest] = useState(0);
  const [score, setScore] = useState(0);
  const [roundLength, setRoundLength] = useState(INITIAL_LENGTH.normal);
  const [sequence, setSequence] = useState("");
  const [currentDigit, setCurrentDigit] = useState("");
  const [inputValue, setInputValue] = useState("");
  const [displayStep, setDisplayStep] = useState(0);
  const [isNewBest, setIsNewBest] = useState(false);

  const timeoutsRef = useRef<ReturnType<typeof setTimeout>[]>([]);

  const clearTimers = () => {
    timeoutsRef.current.forEach((timer) => clearTimeout(timer));
    timeoutsRef.current = [];
  };

  const refreshBest = useCallback(() => {
    const value = Number(
      Taro.getStorageSync(`${STORAGE_KEY_PREFIX}_${rewardDifficulty}`) ||
        (rewardDifficulty === "normal" ? Taro.getStorageSync(STORAGE_KEY_PREFIX) : 0),
    );
    setBest(Number.isFinite(value) ? value : 0);
  }, [rewardDifficulty]);

  useLoad(() => {
    refreshBest();
  });

  useDidShow(() => {
    refreshBest();
  });

  useEffect(() => {
    refreshBest();
  }, [refreshBest]);

  useEffect(() => {
    return () => {
      clearTimers();
    };
  }, []);

  const finishGame = useCallback(
    (finalScore: number) => {
      clearTimers();
      const awardedPoints = getAwardedPoints("digit-span", finalScore, rewardDifficulty);
      setScore(finalScore);
      addPointsToPet("digit-span", finalScore, rewardDifficulty);
      recordTrainingSession({
        gameId: "digit-span",
        score: finalScore,
        awardedPoints,
        difficulty: rewardDifficulty,
        outcome: "completed",
      });
      setPhase("finished");

      if (finalScore > best) {
        Taro.setStorageSync(`${STORAGE_KEY_PREFIX}_${rewardDifficulty}`, finalScore);
        setBest(finalScore);
        setIsNewBest(true);
      } else {
        setIsNewBest(false);
      }
    },
    [best, rewardDifficulty]
  );

  const startRound = useCallback((length: number) => {
    clearTimers();

    const nextSequence = buildSequence(length);
    setRoundLength(length);
    setSequence(nextSequence);
    setInputValue("");
    setDisplayStep(1);
    setCurrentDigit(nextSequence.charAt(0));
    setPhase("showing");

    for (let index = 1; index < nextSequence.length; index += 1) {
      const timer = setTimeout(() => {
        setDisplayStep(index + 1);
        setCurrentDigit(nextSequence.charAt(index));
      }, index * REVEAL_MS[rewardDifficulty]);

      timeoutsRef.current.push(timer);
    }

    const doneTimer = setTimeout(() => {
      setCurrentDigit("");
      setDisplayStep(0);
      setPhase("input");
    }, nextSequence.length * REVEAL_MS[rewardDifficulty]);

    timeoutsRef.current.push(doneTimer);
  }, [rewardDifficulty]);

  const startGame = () => {
    setScore(0);
    setIsNewBest(false);
    startRound(INITIAL_LENGTH[rewardDifficulty]);
  };

  const appendDigit = (digit: string) => {
    if (phase !== "input" || inputValue.length >= roundLength) {
      return;
    }

    setInputValue((prev) => `${prev}${digit}`);
  };

  const clearInput = () => {
    if (phase !== "input") {
      return;
    }

    setInputValue("");
  };

  const deleteLastDigit = () => {
    if (phase !== "input") {
      return;
    }

    setInputValue((prev) => prev.slice(0, -1));
  };

  const submitAnswer = () => {
    if (phase !== "input" || inputValue.length !== roundLength) {
      return;
    }

    if (inputValue === sequence) {
      const nextScore = roundLength;
      setScore(nextScore);
      startRound(roundLength + 1);
      return;
    }

    const finalScore = roundLength > INITIAL_LENGTH[rewardDifficulty] ? roundLength - 1 : 0;
    finishGame(finalScore);
  };

  const renderStart = () => (
    <View className="start-screen">
      <View className="header-section">
        <View className="logo-icon">
          <Text className="logo-emoji">123</Text>
        </View>
        <Text className="game-title">数字广度记忆</Text>
        <Text className="game-subtitle">按顺序回忆完整数字串</Text>
        <View className="high-score-badge">
          <Text className="high-score-label">历史最高</Text>
          <Text className="high-score-value">{best}</Text>
        </View>
      </View>

      <View className="rules-card">
        <Text className="section-title">游戏规则</Text>
        <Text className="rule-item">1. 每轮从 3 位数字开始，数字逐个展示，每个持续 1 秒。</Text>
        <Text className="rule-item">2. 展示结束后，使用数字键盘输入完整序列。</Text>
        <Text className="rule-item">3. 回答正确则长度 +1，回答错误则本局结束。</Text>
        <Text className="rule-item">4. 最终得分等于你成功记住的最大长度。</Text>
      </View>

      <View className="summary-card">
        <Text className="section-title">训练提示</Text>
        <View className="summary-grid">
          <View className="summary-item">
            <Text className="summary-value">{INITIAL_LENGTH[rewardDifficulty]}</Text>
            <Text className="summary-label">起始位数</Text>
          </View>
          <View className="summary-item">
            <Text className="summary-value">{Math.max(best, INITIAL_LENGTH[rewardDifficulty])}</Text>
            <Text className="summary-label">当前挑战线</Text>
          </View>
        </View>
      </View>

      <View className="summary-card">
        <Text className="section-title">难度</Text>
        <View className="summary-grid">
          <View
            className="summary-item"
            onClick={() => setRewardDifficulty("normal")}
          >
            <Text className="summary-value">普通</Text>
            <Text className="summary-label">3 位起步 · 1.0x</Text>
          </View>
          <View
            className="summary-item"
            onClick={() => setRewardDifficulty("hard")}
          >
            <Text className="summary-value">困难</Text>
            <Text className="summary-label">4 位起步 · 1.5x</Text>
          </View>
        </View>
      </View>

      <View className="primary-button" onClick={startGame}>
        <Text className="button-text">开始挑战</Text>
      </View>
      <View className="footer-gap" />
    </View>
  );

  const renderGame = () => (
    <View className="game-screen">
      <View className="status-row">
        <View className="status-card">
          <Text className="status-value">{roundLength}</Text>
          <Text className="status-label">当前长度</Text>
        </View>
        <View className="status-card">
          <Text className="status-value">{score}</Text>
          <Text className="status-label">已达成绩</Text>
        </View>
        <View className="status-card">
          <Text className="status-value">{best}</Text>
          <Text className="status-label">历史最高</Text>
        </View>
      </View>

      <View className="display-card">
        {phase === "showing" ? (
          <>
            <Text className="phase-label">请专注记住第 {displayStep} 位</Text>
            <Text className="digit-display">{currentDigit}</Text>
          </>
        ) : (
          <>
            <Text className="phase-label">请输入刚才看到的完整数字串</Text>
            <View className="input-preview">
              <Text>{inputValue || ""}</Text>
              {!inputValue ? <Text className="placeholder">等待输入</Text> : null}
            </View>
          </>
        )}
      </View>

      {phase === "input" ? (
        <View className="keyboard-card">
          <View className="keyboard-grid">
            {DIGIT_KEYS.slice(0, 9).map((digit) => (
              <View key={digit} className="key" onClick={() => appendDigit(digit)}>
                <Text className="key-text">{digit}</Text>
              </View>
            ))}
            <View className="key key-secondary" onClick={deleteLastDigit}>
              <Text className="key-text">退格</Text>
            </View>
            <View className="key" onClick={() => appendDigit(DIGIT_KEYS[9])}>
              <Text className="key-text">{DIGIT_KEYS[9]}</Text>
            </View>
            <View className="key key-secondary" onClick={clearInput}>
              <Text className="key-text">清除</Text>
            </View>
            <View
              className={`submit-button ${inputValue.length === roundLength ? "" : "submit-button-disabled"}`}
              onClick={submitAnswer}
            >
              <Text className="button-text">提交答案</Text>
            </View>
          </View>
        </View>
      ) : null}
    </View>
  );

  const renderResult = () => (
    <View className="result-screen">
      <View className="result-card">
        <Text className="result-title">本局成绩</Text>
        <Text className="result-score">{score}</Text>
        <Text className="result-desc">成功回忆 {score} 位数字</Text>
        <Text className="result-desc">
          积分{getTrainingDifficultyLabel(rewardDifficulty)} · 获得 {getAwardedPoints("digit-span", score, rewardDifficulty)} 积分
        </Text>
        <Text className="result-desc">
          历史最高 {best}
          {isNewBest ? <Text className="result-highlight">，刷新纪录</Text> : null}
        </Text>
      </View>

      <View className="result-actions">
        <View className="primary-button" onClick={startGame}>
          <Text className="button-text">再来一局</Text>
        </View>
        <View className="secondary-button" onClick={() => setPhase("start")}>
          <Text className="button-text">返回开始页</Text>
        </View>
        <View className="secondary-button" onClick={() => Taro.reLaunch({ url: '/pages/index/index' })}>
          <Text className="button-text">返回游戏主页</Text>
        </View>
      </View>
    </View>
  );

  return (
    <View className="digit-span-page">
      {phase === "start" ? renderStart() : null}
      {phase === "showing" || phase === "input" ? renderGame() : null}
      {phase === "finished" ? renderResult() : null}
    </View>
  );
}
