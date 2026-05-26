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

type Phase = "start" | "playing" | "finished";
type Token =
  | { type: "number"; value: number; cardIndex: number; label: string }
  | { type: "operator"; value: Operator }
  | { type: "paren"; value: "(" | ")" };
type Operator = "+" | "-" | "*" | "/";

interface CardValue {
  value: number;
  label: string;
}

interface GeneratedRound {
  cards: CardValue[];
  solution: string;
}

const STORAGE_KEY_PREFIX = "twenty_four_best";
const ROUND_SECONDS: Record<TrainingDifficulty, number> = {
  normal: 90,
  hard: 60,
};
const MAX_CARD_VALUE: Record<TrainingDifficulty, number> = {
  normal: 10,
  hard: 13,
};
const EPSILON = 1e-6;
const OPERATORS: Operator[] = ["+", "-", "*", "/"];

function randomInt(min: number, max: number) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

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

function getPrecedence(operator: Operator) {
  return operator === "+" || operator === "-" ? 1 : 2;
}

function solveTwentyFour(values: number[]): string | null {
  const search = (items: Array<{ value: number; expression: string }>): string | null => {
    if (items.length === 1) {
      return Math.abs(items[0].value - 24) < EPSILON ? items[0].expression : null;
    }

    for (let leftIndex = 0; leftIndex < items.length; leftIndex += 1) {
      for (let rightIndex = 0; rightIndex < items.length; rightIndex += 1) {
        if (leftIndex === rightIndex) continue;

        const left = items[leftIndex];
        const right = items[rightIndex];
        const rest = items.filter((_, index) => index !== leftIndex && index !== rightIndex);
        const candidates = [
          { value: left.value + right.value, expression: `(${left.expression}+${right.expression})` },
          { value: left.value - right.value, expression: `(${left.expression}-${right.expression})` },
          { value: left.value * right.value, expression: `(${left.expression}×${right.expression})` },
        ];

        if (Math.abs(right.value) > EPSILON) {
          candidates.push({
            value: left.value / right.value,
            expression: `(${left.expression}÷${right.expression})`,
          });
        }

        for (const candidate of candidates) {
          const result = search([...rest, candidate]);
          if (result) return result;
        }
      }
    }

    return null;
  };

  return search(values.map((value) => ({ value, expression: String(value) })));
}

function generateRound(maxCardValue: number): GeneratedRound {
  for (let attempt = 0; attempt < 200; attempt += 1) {
    const values = Array.from({ length: 4 }, () => randomInt(1, maxCardValue));
    const solution = solveTwentyFour(values);
    if (solution) {
      return {
        cards: values.map((value) => ({ value, label: String(value) })),
        solution,
      };
    }
  }

  return {
    cards: [3, 3, 8, 8].map((value) => ({ value, label: String(value) })),
    solution: "(8÷(3-8÷3))",
  };
}

function evaluateExpression(tokens: Token[]): number | null {
  const values: number[] = [];
  const operators: Array<Operator | "("> = [];

  const applyOperator = () => {
    const operator = operators.pop();
    const right = values.pop();
    const left = values.pop();
    if (!operator || operator === "(" || right === undefined || left === undefined) {
      return false;
    }

    if (operator === "+") values.push(left + right);
    if (operator === "-") values.push(left - right);
    if (operator === "*") values.push(left * right);
    if (operator === "/") {
      if (Math.abs(right) < EPSILON) return false;
      values.push(left / right);
    }

    return true;
  };

  for (const token of tokens) {
    if (token.type === "number") {
      values.push(token.value);
      continue;
    }

    if (token.type === "paren") {
      if (token.value === "(") {
        operators.push("(");
      } else {
        while (operators.length > 0 && operators[operators.length - 1] !== "(") {
          if (!applyOperator()) return null;
        }
        if (operators.pop() !== "(") return null;
      }
      continue;
    }

    while (
      operators.length > 0 &&
      operators[operators.length - 1] !== "(" &&
      getPrecedence(operators[operators.length - 1] as Operator) >= getPrecedence(token.value)
    ) {
      if (!applyOperator()) return null;
    }
    operators.push(token.value);
  }

  while (operators.length > 0) {
    if (operators[operators.length - 1] === "(") return null;
    if (!applyOperator()) return null;
  }

  return values.length === 1 ? values[0] : null;
}

export default function TwentyFour() {
  const [rewardDifficulty, setRewardDifficulty] = useState<TrainingDifficulty>("normal");
  const [round, setRound] = useState<GeneratedRound>(() => generateRound(MAX_CARD_VALUE.normal));
  const [phase, setPhase] = useState<Phase>("start");
  const [tokens, setTokens] = useState<Token[]>([]);
  const [score, setScore] = useState(0);
  const [best, setBest] = useState(0);
  const [timeLeft, setTimeLeft] = useState(ROUND_SECONDS.normal);
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
    return () => clearTimer();
  }, []);

  const finishGame = useCallback(() => {
    clearTimer();
    const finalScore = scoreRef.current;
    const awardedPoints = getAwardedPoints("twenty-four", finalScore, rewardDifficulty);
    addPointsToPet("twenty-four", finalScore, rewardDifficulty);
    recordTrainingSession({
      gameId: "twenty-four",
      score: finalScore,
      awardedPoints,
      durationSeconds: ROUND_SECONDS[rewardDifficulty],
      mode: `${ROUND_SECONDS[rewardDifficulty]}s`,
      difficulty: rewardDifficulty,
      outcome: "completed",
    });

    if (finalScore > best) {
      Taro.setStorageSync(`${STORAGE_KEY_PREFIX}_${rewardDifficulty}`, finalScore);
      setBest(finalScore);
      setIsNewBest(true);
    } else {
      setIsNewBest(false);
    }

    setPhase("finished");
  }, [best, rewardDifficulty]);

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
    setRound(generateRound(MAX_CARD_VALUE[rewardDifficulty]));
    setTokens([]);
    setScore(0);
    setTimeLeft(ROUND_SECONDS[rewardDifficulty]);
    setFeedback("用四张牌和运算符凑出 24");
    setIsNewBest(false);
    setHintUsed(false);
    setPhase("playing");
  };

  const nextRound = () => {
    setRound(generateRound(MAX_CARD_VALUE[rewardDifficulty]));
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

    if (Math.abs(result - 24) < EPSILON) {
      if (!hintUsed) {
        setScore((current) => current + 1);
        setFeedback("正确，进入下一题");
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
            <Text className="tf-subtitle">用四个数字和四则运算，在 90 秒里尽可能多地凑出 24。</Text>
          </View>

          <View className="tf-best-card">
            <Text className="tf-best-label">历史最高</Text>
            <Text className="tf-best-value">{best}</Text>
          </View>

          <View className="tf-rules">
            <Text className="tf-section-title">规则</Text>
            <Text className="tf-rule">1. 每轮四张数字牌都必须使用一次。</Text>
            <Text className="tf-rule">2. 可以使用 +、-、×、÷ 和括号。</Text>
            <Text className="tf-rule">3. 每解出一题得 1 分，限时结束后记录成绩。</Text>
          </View>

          <View className="tf-rules">
            <Text className="tf-section-title">难度</Text>
            <View className="tf-actions">
              <View
                className={rewardDifficulty === "normal" ? "tf-submit-button" : "tf-skip-button"}
                onClick={() => setRewardDifficulty("normal")}
              >
                <Text className="tf-submit-button-text">普通 · 90 秒 · 1.0x</Text>
              </View>
              <View
                className={rewardDifficulty === "hard" ? "tf-submit-button" : "tf-skip-button"}
                onClick={() => setRewardDifficulty("hard")}
              >
                <Text className="tf-submit-button-text">困难 · 60 秒 · 1.5x</Text>
              </View>
            </View>
          </View>

          <View className="tf-primary-button" onClick={startGame}>
            <Text className="tf-primary-button-text">开始挑战</Text>
          </View>
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
              <Text className="tf-status-label">已解题数</Text>
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
            解出 {score} 题，积分{getTrainingDifficultyLabel(rewardDifficulty)}，获得 {getAwardedPoints("twenty-four", score, rewardDifficulty)} 积分
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
