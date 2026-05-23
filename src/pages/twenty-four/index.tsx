import { useCallback, useEffect, useRef, useState } from "react";
import { View, Text } from "@tarojs/components";
import Taro, { useDidShow, useLoad } from "@tarojs/taro";
import { addPointsToPet } from "../../utils/petStorage";
import { getAwardedPoints, recordTrainingSession } from "../../utils/trainingStorage";
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

const STORAGE_KEY = "twenty_four_best";
const ROUND_SECONDS = 90;
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

function hasTwentyFourSolution(values: number[]) {
  const search = (numbers: number[]): boolean => {
    if (numbers.length === 1) {
      return Math.abs(numbers[0] - 24) < EPSILON;
    }

    for (let leftIndex = 0; leftIndex < numbers.length; leftIndex += 1) {
      for (let rightIndex = 0; rightIndex < numbers.length; rightIndex += 1) {
        if (leftIndex === rightIndex) continue;

        const rest = numbers.filter((_, index) => index !== leftIndex && index !== rightIndex);
        const left = numbers[leftIndex];
        const right = numbers[rightIndex];
        const candidates = [left + right, left - right, left * right];
        if (Math.abs(right) > EPSILON) {
          candidates.push(left / right);
        }

        if (candidates.some((candidate) => search([...rest, candidate]))) {
          return true;
        }
      }
    }

    return false;
  };

  return search(values);
}

function generateCards(): CardValue[] {
  for (let attempt = 0; attempt < 200; attempt += 1) {
    const values = Array.from({ length: 4 }, () => randomInt(1, 10));
    if (hasTwentyFourSolution(values)) {
      return values.map((value) => ({ value, label: String(value) }));
    }
  }

  return [3, 3, 8, 8].map((value) => ({ value, label: String(value) }));
}

function tokenToText(token: Token) {
  if (token.type === "number") return token.label;
  if (token.type === "operator") return formatOperator(token.value);
  return token.value;
}

function getPrecedence(operator: Operator) {
  return operator === "+" || operator === "-" ? 1 : 2;
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
  const [phase, setPhase] = useState<Phase>("start");
  const [cards, setCards] = useState<CardValue[]>(() => generateCards());
  const [tokens, setTokens] = useState<Token[]>([]);
  const [score, setScore] = useState(0);
  const [best, setBest] = useState(0);
  const [timeLeft, setTimeLeft] = useState(ROUND_SECONDS);
  const [feedback, setFeedback] = useState("用四张牌和运算符凑出 24");
  const [isNewBest, setIsNewBest] = useState(false);

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
    const value = Number(Taro.getStorageSync(STORAGE_KEY) || 0);
    setBest(Number.isFinite(value) ? value : 0);
  }, []);

  useLoad(() => {
    refreshBest();
  });

  useDidShow(() => {
    refreshBest();
  });

  useEffect(() => {
    return () => clearTimer();
  }, []);

  const finishGame = useCallback(() => {
    clearTimer();
    const finalScore = scoreRef.current;
    const awardedPoints = getAwardedPoints("twenty-four", finalScore);
    addPointsToPet("twenty-four", finalScore);
    recordTrainingSession({
      gameId: "twenty-four",
      score: finalScore,
      awardedPoints,
      durationSeconds: ROUND_SECONDS,
      mode: "90s",
      outcome: "completed",
    });

    if (finalScore > best) {
      Taro.setStorageSync(STORAGE_KEY, finalScore);
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
    setCards(generateCards());
    setTokens([]);
    setScore(0);
    setTimeLeft(ROUND_SECONDS);
    setFeedback("用四张牌和运算符凑出 24");
    setIsNewBest(false);
    setPhase("playing");
  };

  const nextRound = () => {
    setCards(generateCards());
    setTokens([]);
    setFeedback("继续凑出 24");
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
    if (usedCardIndexes.size !== cards.length) {
      setFeedback("需要用完四张牌");
      return;
    }

    const result = evaluateExpression(tokens);
    if (result === null || !Number.isFinite(result)) {
      setFeedback("表达式还不完整");
      return;
    }

    if (Math.abs(result - 24) < EPSILON) {
      setScore((current) => current + 1);
      setFeedback("正确，进入下一题");
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
            {cards.map((card, index) => (
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
          </View>
        </View>
      )}

      {phase === "finished" && (
        <View className="tf-result">
          <Text className="tf-result-title">本局结束</Text>
          <Text className="tf-result-score">{score}</Text>
          <Text className="tf-result-copy">
            解出 {score} 题，获得 {getAwardedPoints("twenty-four", score)} 积分
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
