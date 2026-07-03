import { useCallback, useEffect, useRef, useState } from "react";
import { View, Text } from "@tarojs/components";
import Taro, { useDidShow, useLoad } from "@tarojs/taro";
import { addPointsToPet } from "../../utils/petStorage";
import {
  getAwardedPoints,
  recordTrainingSession,
} from "../../utils/trainingStorage";
import { completeGauntletLegIfNeeded } from "../../utils/gameGauntlet";
import { usePageShare } from "../../utils/share";
import {
  evaluateExpression,
  GAME_SECONDS,
  generateRound,
  getPointsForAttempt,
  type CardValue,
  type Operator,
  type Token,
} from "./gameLogic";
import "./index.scss";

type Phase = "start" | "playing" | "finished";

const STORAGE_KEY_PREFIX = "twenty_four_best";
const REWARD_DIFFICULTY = "normal";
const EPSILON = 1e-6;
const OPERATORS: Operator[] = ["+", "-", "*", "/"];

function formatOperator(operator: Operator) {
  if (operator === "*") return "×";
  if (operator === "/") return "÷";
  return operator;
}

function tokenToText(token: Token) {
  if (token.type === "number") return token.label;
  if (token.type === "operator") return formatOperator(token.value);
  return token.value;
}

export default function TwentyFour() {
  usePageShare("pages/twenty-four/index");

  const [round, setRound] = useState(() => generateRound());
  const [phase, setPhase] = useState<Phase>("start");
  const [tokens, setTokens] = useState<Token[]>([]);
  const [score, setScore] = useState(0);
  const [solvedCount, setSolvedCount] = useState(0);
  const [best, setBest] = useState(0);
  const [timeLeft, setTimeLeft] = useState(GAME_SECONDS);
  const [feedback, setFeedback] = useState("用四张牌和运算符凑出 24");
  const [isNewBest, setIsNewBest] = useState(false);
  const [hintUsed, setHintUsed] = useState(false);

  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const scoreRef = useRef(0);

  useEffect(() => {
    scoreRef.current = score;
  }, [score]);

  const clearTimer = () => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  };

  const refreshBest = useCallback(() => {
    const value = Number(
      Taro.getStorageSync(`${STORAGE_KEY_PREFIX}_${REWARD_DIFFICULTY}`) ||
        Taro.getStorageSync(STORAGE_KEY_PREFIX),
    );
    setBest(Number.isFinite(value) ? value : 0);
  }, []);

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
    return () => clearTimer();
  }, []);

  const finishGame = useCallback(() => {
    clearTimer();
    const finalScore = scoreRef.current;
    const awardedPoints = getAwardedPoints("twenty-four", finalScore, REWARD_DIFFICULTY);
    if (completeGauntletLegIfNeeded({
      gameId: "twenty-four",
      score: finalScore,
      awardedPoints,
      durationSeconds: GAME_SECONDS,
      mode: `${GAME_SECONDS}s`,
      difficulty: REWARD_DIFFICULTY,
      outcome: "completed",
    })) {
      return;
    }

    addPointsToPet("twenty-four", finalScore, REWARD_DIFFICULTY);
    recordTrainingSession({
      gameId: "twenty-four",
      score: finalScore,
      awardedPoints,
      durationSeconds: GAME_SECONDS,
      mode: `${GAME_SECONDS}s`,
      difficulty: REWARD_DIFFICULTY,
      outcome: "completed",
    });

    if (finalScore > best) {
      Taro.setStorageSync(`${STORAGE_KEY_PREFIX}_${REWARD_DIFFICULTY}`, finalScore);
      setBest(finalScore);
      setIsNewBest(true);
    } else {
      setIsNewBest(false);
    }

    setPhase("finished");
  }, [best]);

  useEffect(() => {
    if (phase !== "playing") return undefined;

    timerRef.current = setInterval(() => {
      setTimeLeft((current) => {
        if (current <= 1) {
          finishGame();
          return 0;
        }
        return current - 1;
      });
    }, 1000);

    return () => clearTimer();
  }, [finishGame, phase]);

  const startGame = () => {
    clearTimer();
    setRound(generateRound());
    setTokens([]);
    setScore(0);
    setSolvedCount(0);
    setTimeLeft(GAME_SECONDS);
    setFeedback("用四张牌和运算符凑出 24");
    setIsNewBest(false);
    setHintUsed(false);
    setPhase("playing");
  };

  const nextRound = () => {
    setRound(generateRound());
    setTokens([]);
    setHintUsed(false);
    setFeedback("继续凑出 24");
  };

  const showHint = () => {
    if (phase !== "playing") return;
    setHintUsed(true);
    setFeedback(`参考解法：${round.solution}。本题继续练习但不计分`);
  };

  const usedCardIndexes = new Set(
    tokens.filter((token): token is Extract<Token, { type: "number" }> => token.type === "number")
      .map((token) => token.cardIndex),
  );

  const expressionText = tokens.map(tokenToText).join(" ");

  const appendCard = (card: CardValue, cardIndex: number) => {
    if (phase !== "playing" || usedCardIndexes.has(cardIndex)) return;
    setTokens((current) => [...current, { type: "number", value: card.value, cardIndex, label: card.label }]);
  };

  const appendOperator = (operator: Operator) => {
    if (phase !== "playing") return;
    setTokens((current) => [...current, { type: "operator", value: operator }]);
  };

  const appendParen = (value: "(" | ")") => {
    if (phase !== "playing") return;
    setTokens((current) => [...current, { type: "paren", value }]);
  };

  const undo = () => {
    if (phase !== "playing") return;
    setTokens((current) => current.slice(0, -1));
  };

  const clearExpression = () => {
    if (phase !== "playing") return;
    setTokens([]);
    setFeedback("已清空，重新组合");
  };

  const submitExpression = () => {
    if (usedCardIndexes.size !== round.cards.length) {
      setFeedback("需要用完四张牌");
      return;
    }

    const result = evaluateExpression(tokens);
    if (result === null || !Number.isFinite(result)) {
      setFeedback("表达式还不完整");
      return;
    }

    const isCorrect = Math.abs(result - 24) < EPSILON;
    if (isCorrect) {
      const roundPoints = getPointsForAttempt(solvedCount, isCorrect, hintUsed);
      if (roundPoints > 0) {
        setScore((current) => current + roundPoints);
        setSolvedCount((current) => current + 1);
        setFeedback(`正确，获得 ${roundPoints} 分，进入下一题`);
      } else {
        setFeedback("已完成提示题，进入下一题");
      }
      setTimeout(nextRound, 450);
      return;
    }

    setFeedback(`当前结果 ${Number(result.toFixed(2))}，还不是 24`);
  };

  return (
    <View className="twenty-four-page">
      {phase === "start" && (
        <View className="tf-start">
          <View className="tf-hero">
            <Text className="tf-kicker">Calculation</Text>
            <Text className="tf-title">24 点</Text>
            <Text className="tf-subtitle">用四个数字和四则运算，在 60 秒里尽可能多地凑出 24。</Text>
          </View>

          <View className="tf-best-card">
            <Text className="tf-best-label">历史最高</Text>
            <Text className="tf-best-value">{best}</Text>
          </View>

          <View className="tf-rules">
            <Text className="tf-section-title">规则</Text>
            <Text className="tf-rule">1. 每轮四张数字牌都必须使用一次。</Text>
            <Text className="tf-rule">2. 可以使用 +、-、×、÷ 和括号。</Text>
            <Text className="tf-rule">3. 数字范围为 1 至 10，初始每题 2 分，每答对 3 题后续每题加 1 分。</Text>
          </View>

          <View className="floating-start-action">
            <View className="tf-primary-button" onClick={startGame}>
              <Text className="tf-primary-button-text">开始挑战</Text>
            </View>
          </View>
          <View className="floating-start-spacer" />
        </View>
      )}

      {phase === "playing" && (
        <View className="tf-play">
          <View className="tf-status-row">
            <View className="tf-status-card">
              <Text className="tf-status-value">{timeLeft}</Text>
              <Text className="tf-status-label">剩余秒数</Text>
            </View>
            <View className="tf-status-card">
              <Text className="tf-status-value">{score}</Text>
              <Text className="tf-status-label">当前得分</Text>
            </View>
            <View className="tf-status-card">
              <Text className="tf-status-value">{best}</Text>
              <Text className="tf-status-label">最高纪录</Text>
            </View>
          </View>

          <View className="tf-card-row">
            {round.cards.map((card, index) => (
              <View
                key={`${card.label}-${index}`}
                className={`tf-number-card ${usedCardIndexes.has(index) ? "tf-number-card-used" : ""}`}
                onClick={() => appendCard(card, index)}
              >
                <Text className="tf-number-text">{card.label}</Text>
              </View>
            ))}
          </View>

          <View className="tf-expression-card">
            <Text className="tf-expression-label">表达式</Text>
            <Text className={`tf-expression-text ${expressionText ? "" : "tf-expression-placeholder"}`}>
              {expressionText || "点击数字和符号开始组合"}
            </Text>
            <Text className="tf-feedback">{feedback}</Text>
          </View>

          <View className="tf-keypad">
            {OPERATORS.map((operator) => (
              <View key={operator} className="tf-key tf-key-operator" onClick={() => appendOperator(operator)}>
                <Text className="tf-key-text">{formatOperator(operator)}</Text>
              </View>
            ))}
            <View className="tf-key" onClick={() => appendParen("(")}>
              <Text className="tf-key-text">(</Text>
            </View>
            <View className="tf-key" onClick={() => appendParen(")")}>
              <Text className="tf-key-text">)</Text>
            </View>
            <View className="tf-key tf-key-muted" onClick={undo}>
              <Text className="tf-key-text">退格</Text>
            </View>
            <View className="tf-key tf-key-muted" onClick={clearExpression}>
              <Text className="tf-key-text">清空</Text>
            </View>
          </View>

          <View className="tf-actions">
            <View className="tf-submit-button" onClick={submitExpression}>
              <Text className="tf-submit-button-text">提交答案</Text>
            </View>
            <View className="tf-skip-button" onClick={nextRound}>
              <Text className="tf-skip-button-text">换一题</Text>
            </View>
            <View className="tf-hint-button" onClick={showHint}>
              <Text className="tf-hint-button-text">看提示</Text>
            </View>
          </View>
        </View>
      )}

      {phase === "finished" && (
        <View className="tf-result">
          <Text className="tf-result-title">本局结束</Text>
          <Text className="tf-result-score">{score}</Text>
          <Text className="tf-result-copy">
            解出 {solvedCount} 题，游戏得分 {score}，获得 {getAwardedPoints("twenty-four", score, REWARD_DIFFICULTY)} 积分
          </Text>
          {isNewBest ? <Text className="tf-result-highlight">刷新历史最高</Text> : null}

          <View className="tf-result-actions">
            <View className="tf-primary-button" onClick={startGame}>
              <Text className="tf-primary-button-text">再来一局</Text>
            </View>
            <View className="tf-secondary-button" onClick={() => Taro.reLaunch({ url: "/pages/index/index" })}>
              <Text className="tf-secondary-button-text">返回首页</Text>
            </View>
          </View>
        </View>
      )}
    </View>
  );
}
