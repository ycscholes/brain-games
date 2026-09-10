import { useCallback, useEffect, useRef, useState } from "react";
import { View, Text } from "@tarojs/components";
import Taro, { getCurrentInstance, useDidShow, useLoad, useUnload } from "@tarojs/taro";
import GameRouteBack from "../../components/game-route/GameRouteBack";
import { usePageShare } from "../../utils/share";
import {
  playComplete,
  playCorrect,
  playTap,
  playWrong,
} from "../../services/audio/audioFeedbackService";
import {
  evaluateExpression,
  GAME_SECONDS,
  generateRound,
  getPointsForAttempt,
  type CardValue,
  type Operator,
  type Token,
} from "./gameLogic";
import { abandonTwentyFourRun, readTwentyFourRun, settleTwentyFourCompletion } from "./run";
import "./index.scss";

type Phase = "playing";

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
  const runId =
    typeof getCurrentInstance().router?.params?.runId === "string"
      ? (getCurrentInstance().router?.params?.runId ?? "")
      : "";
  const routeRun = readTwentyFourRun(runId);

  useEffect(() => {
    if (!runId || !routeRun || routeRun.status !== "active") {
      void Taro.redirectTo({ url: "/pages/twenty-four/index" });
    }
  }, [routeRun, runId]);

  const [round, setRound] = useState(() => generateRound());
  const [phase] = useState<Phase>("playing");
  const [tokens, setTokens] = useState<Token[]>([]);
  const [score, setScore] = useState(0);
  const [solvedCount, setSolvedCount] = useState(0);
  const [best, setBest] = useState(0);
  const [timeLeft, setTimeLeft] = useState(GAME_SECONDS);
  const [feedback, setFeedback] = useState("用四张牌和运算符凑出 24");
  const [hintUsed, setHintUsed] = useState(false);

  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const scoreRef = useRef(0);
  const autoStartedRef = useRef(false);

  useEffect(() => {
    scoreRef.current = score;
  }, [score]);

  const clearTimer = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }, []);

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
  }, [clearTimer]);

  const finishGame = useCallback(() => {
    clearTimer();
    playComplete();
    const finalScore = scoreRef.current;
    const settlementInput = {
      gameId: "twenty-four",
      score: finalScore,
      durationSeconds: GAME_SECONDS,
      mode: `${GAME_SECONDS}s`,
      difficulty: REWARD_DIFFICULTY,
      outcome: "completed",
    } as const;
    const nextIsNewBest = finalScore > best;
    const routeSettlement = settleTwentyFourCompletion(
      runId,
      {
        score: finalScore,
        awardedPoints: 0,
        durationSeconds: GAME_SECONDS,
        solvedCount,
        isNewBest: nextIsNewBest,
      },
      settlementInput,
    );
    const settlement = routeSettlement?.settlement ?? null;
    if (!settlement) return;
    if (settlement.gauntletHandled) {
      return;
    }

    if (nextIsNewBest) {
      Taro.setStorageSync(`${STORAGE_KEY_PREFIX}_${REWARD_DIFFICULTY}`, finalScore);
      setBest(finalScore);
    }
    void Taro.redirectTo({ url: `/pages/twenty-four/result?runId=${encodeURIComponent(runId)}` });
  }, [best, clearTimer, runId, solvedCount]);

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
  }, [clearTimer, finishGame, phase]);

  const startGame = useCallback(() => {
    playTap();
    clearTimer();
    setRound(generateRound());
    setTokens([]);
    setScore(0);
    setSolvedCount(0);
    setTimeLeft(GAME_SECONDS);
    setFeedback("用四张牌和运算符凑出 24");
    setHintUsed(false);
  }, [clearTimer]);

  useEffect(() => {
    if (!routeRun || routeRun.status !== "active" || autoStartedRef.current) return;
    autoStartedRef.current = true;
    startGame();
  }, [routeRun, startGame]);

  const handleRouteBack = useCallback(() => {
    if (!runId || !routeRun || routeRun.status !== "active") return;
    abandonTwentyFourRun(runId, {
      gameId: "twenty-four",
      score: 0,
      durationSeconds: Math.max(1, Math.round((Date.now() - routeRun.payload.startedAt) / 1_000)),
      mode: `${GAME_SECONDS}s`,
      difficulty: routeRun.payload.difficulty,
      outcome: "interrupted",
    });
  }, [routeRun, runId]);
  useUnload(handleRouteBack);

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
    tokens
      .filter((token): token is Extract<Token, { type: "number" }> => token.type === "number")
      .map((token) => token.cardIndex),
  );

  const expressionText = tokens.map(tokenToText).join(" ");

  const appendCard = (card: CardValue, cardIndex: number) => {
    if (phase !== "playing" || usedCardIndexes.has(cardIndex)) return;
    setTokens((current) => [
      ...current,
      { type: "number", value: card.value, cardIndex, label: card.label },
    ]);
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
    playTap();
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
      playCorrect();
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

    playWrong();
    setFeedback(`当前结果 ${Number(result.toFixed(2))}，还不是 24`);
  };

  return (
    <View className="twenty-four-page">
      <GameRouteBack gameId="twenty-four" runId={runId} onAbandon={handleRouteBack} />
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
            <Text
              className={`tf-expression-text ${expressionText ? "" : "tf-expression-placeholder"}`}
            >
              {expressionText || "点击数字和符号开始组合"}
            </Text>
            <Text className="tf-feedback">{feedback}</Text>
          </View>

          <View className="tf-keypad">
            {OPERATORS.map((operator) => (
              <View
                key={operator}
                className="tf-key tf-key-operator"
                onClick={() => appendOperator(operator)}
              >
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
    </View>
  );
}
