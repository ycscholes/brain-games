import { useCallback, useEffect, useRef, useState } from "react";
import { View, Text } from "@tarojs/components";
import Taro, { getCurrentInstance, useDidShow, useLoad, useUnload } from "@tarojs/taro";
import { shouldRedirectInvalidGameRun } from "../../utils/gameRoute";
import { type TrainingDifficulty } from "../../utils/trainingStorage";
import { readGameGauntletModePreset } from "../../utils/gameGauntlet";
import GameRouteBack from "../../components/game-route/GameRouteBack";
import { usePageShare } from "../../utils/share";
import {
  playComplete,
  playCorrect,
  playTap,
  playWrong,
} from "../../services/audio/audioFeedbackService";
import {
  abandonDigitSpanRun,
  readDigitSpanRun,
  settleDigitSpanCompletion,
  updateDigitSpanRun,
  type DigitSpanRunState,
} from "./run";
import "./index.scss";

type Phase = "showing" | "input";

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
  usePageShare("pages/digit-span/index");
  const gauntletPreset = readGameGauntletModePreset();
  const runId =
    typeof getCurrentInstance().router?.params?.runId === "string"
      ? (getCurrentInstance().router?.params?.runId ?? "")
      : "";
  const routeRun = readDigitSpanRun(runId);
  const allowSettledRef = useRef(false);

  useEffect(() => {
    if (shouldRedirectInvalidGameRun(runId, routeRun?.status, allowSettledRef.current)) {
      void Taro.redirectTo({ url: "/pages/digit-span/index" });
    }
  }, [routeRun, runId]);

  const persistedState = routeRun?.payload.state;
  const [phase, setPhase] = useState<Phase>(persistedState?.phase ?? "showing");
  const rewardDifficulty: TrainingDifficulty =
    routeRun?.payload.difficulty ?? gauntletPreset?.difficulty ?? "normal";
  const [best, setBest] = useState(0);
  const [score, setScore] = useState(() => persistedState?.score ?? 0);
  const [roundLength, setRoundLength] = useState(
    () => persistedState?.roundLength ?? INITIAL_LENGTH.normal,
  );
  const [sequence, setSequence] = useState(() => persistedState?.sequence ?? "");
  const [currentDigit, setCurrentDigit] = useState(() => persistedState?.currentDigit ?? "");
  const [inputValue, setInputValue] = useState(() => persistedState?.inputValue ?? "");
  const [displayStep, setDisplayStep] = useState(() => persistedState?.displayStep ?? 0);

  const timeoutsRef = useRef<ReturnType<typeof setTimeout>[]>([]);
  const autoStartedRef = useRef(false);
  const startedAtRef = useRef(persistedState?.clockStartedAt ?? routeRun?.payload.startedAt ?? 0);
  const revealStartedAtRef = useRef(persistedState?.revealStartedAt ?? 0);
  const scoreRef = useRef(persistedState?.score ?? 0);

  useEffect(() => {
    scoreRef.current = score;
  }, [score]);

  const persistRunState = useCallback(
    (state: Omit<DigitSpanRunState, "clockStartedAt" | "revealStartedAt">) => {
      if (!runId) return;
      updateDigitSpanRun(runId, {
        state: {
          ...state,
          clockStartedAt: startedAtRef.current,
          revealStartedAt: revealStartedAtRef.current,
        },
      });
    },
    [runId],
  );

  const clearTimers = useCallback(() => {
    timeoutsRef.current.forEach((timer) => clearTimeout(timer));
    timeoutsRef.current = [];
  }, []);

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
      playComplete();
    };
  }, [clearTimers]);

  const finishGame = useCallback(
    (finalScore: number) => {
      clearTimers();
      const durationSeconds = Math.max(1, Math.round((Date.now() - startedAtRef.current) / 1_000));
      const settlementInput = {
        gameId: "digit-span",
        score: finalScore,
        durationSeconds,
        difficulty: rewardDifficulty,
        outcome: "completed",
      } as const;
      const nextIsNewBest = finalScore > best;
      allowSettledRef.current = true;
      const routeSettlement = settleDigitSpanCompletion(
        runId,
        {
          score: finalScore,
          awardedPoints: 0,
          durationSeconds,
          maxLength: finalScore,
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
        Taro.setStorageSync(`${STORAGE_KEY_PREFIX}_${rewardDifficulty}`, finalScore);
        setBest(finalScore);
      }
      void Taro.redirectTo({
        url: `/pages/digit-span/result?runId=${encodeURIComponent(runId)}`,
      });
    },
    [best, clearTimers, rewardDifficulty, runId],
  );

  const startRound = useCallback(
    (length: number, nextScore = scoreRef.current) => {
      clearTimers();

      const nextSequence = buildSequence(length);
      const revealStartedAt = Date.now();
      revealStartedAtRef.current = revealStartedAt;
      setRoundLength(length);
      setSequence(nextSequence);
      setInputValue("");
      setDisplayStep(1);
      setCurrentDigit(nextSequence.charAt(0));
      setPhase("showing");
      persistRunState({
        phase: "showing",
        sequence: nextSequence,
        roundLength: length,
        inputValue: "",
        score: nextScore,
        currentDigit: nextSequence.charAt(0),
        displayStep: 1,
      });

      for (let index = 1; index < nextSequence.length; index += 1) {
        const timer = setTimeout(() => {
          setDisplayStep(index + 1);
          setCurrentDigit(nextSequence.charAt(index));
          persistRunState({
            phase: "showing",
            sequence: nextSequence,
            roundLength: length,
            inputValue: "",
            score: scoreRef.current,
            currentDigit: nextSequence.charAt(index),
            displayStep: index + 1,
          });
        }, index * REVEAL_MS[rewardDifficulty]);

        timeoutsRef.current.push(timer);
      }

      const doneTimer = setTimeout(() => {
        setCurrentDigit("");
        setDisplayStep(0);
        setPhase("input");
        persistRunState({
          phase: "input",
          sequence: nextSequence,
          roundLength: length,
          inputValue: "",
          score: scoreRef.current,
          currentDigit: "",
          displayStep: 0,
        });
      }, nextSequence.length * REVEAL_MS[rewardDifficulty]);

      timeoutsRef.current.push(doneTimer);
    },
    [clearTimers, persistRunState, rewardDifficulty],
  );

  const startGame = useCallback(() => {
    playTap();
    startedAtRef.current = Date.now();
    scoreRef.current = 0;
    setScore(0);
    startRound(INITIAL_LENGTH[rewardDifficulty], 0);
  }, [rewardDifficulty, startRound]);

  const restoreGame = useCallback(() => {
    if (!persistedState) {
      startGame();
      return;
    }
    clearTimers();
    startedAtRef.current = persistedState.clockStartedAt;
    revealStartedAtRef.current = persistedState.revealStartedAt;
    scoreRef.current = persistedState.score;
    setPhase(persistedState.phase);
    setScore(persistedState.score);
    setRoundLength(persistedState.roundLength);
    setSequence(persistedState.sequence);
    setInputValue(persistedState.inputValue);
    setCurrentDigit(persistedState.currentDigit);
    setDisplayStep(persistedState.displayStep);

    if (persistedState.phase !== "showing" || !persistedState.sequence) return;

    const revealDuration = REVEAL_MS[rewardDifficulty];
    const elapsed = Math.max(0, Date.now() - persistedState.revealStartedAt);
    const nextIndex = Math.max(1, persistedState.displayStep);
    for (let index = nextIndex; index < persistedState.sequence.length; index += 1) {
      const delay = Math.max(0, index * revealDuration - elapsed);
      const timer = setTimeout(() => {
        setDisplayStep(index + 1);
        setCurrentDigit(persistedState.sequence.charAt(index));
        persistRunState({
          phase: "showing",
          sequence: persistedState.sequence,
          roundLength: persistedState.roundLength,
          inputValue: "",
          score: scoreRef.current,
          currentDigit: persistedState.sequence.charAt(index),
          displayStep: index + 1,
        });
      }, delay);
      timeoutsRef.current.push(timer);
    }
    const doneDelay = Math.max(0, persistedState.sequence.length * revealDuration - elapsed);
    const doneTimer = setTimeout(() => {
      setCurrentDigit("");
      setDisplayStep(0);
      setPhase("input");
      persistRunState({
        phase: "input",
        sequence: persistedState.sequence,
        roundLength: persistedState.roundLength,
        inputValue: "",
        score: scoreRef.current,
        currentDigit: "",
        displayStep: 0,
      });
    }, doneDelay);
    timeoutsRef.current.push(doneTimer);
  }, [clearTimers, persistedState, persistRunState, rewardDifficulty, startGame]);

  useEffect(() => {
    if (!routeRun || routeRun.status !== "active" || autoStartedRef.current) return;
    autoStartedRef.current = true;
    restoreGame();
  }, [restoreGame, routeRun]);

  const handleRouteBack = useCallback(() => {
    if (!runId || !routeRun || routeRun.status !== "active") return;
    abandonDigitSpanRun(runId, {
      gameId: "digit-span",
      score: 0,
      durationSeconds: Math.max(1, Math.round((Date.now() - routeRun.payload.startedAt) / 1_000)),
      difficulty: routeRun.payload.difficulty,
      outcome: "interrupted",
    });
  }, [routeRun, runId]);
  useUnload(handleRouteBack);

  const appendDigit = (digit: string) => {
    if (phase !== "input" || inputValue.length >= roundLength) {
      return;
    }

    const nextInputValue = `${inputValue}${digit}`;
    setInputValue(nextInputValue);
    persistRunState({
      phase: "input",
      sequence,
      roundLength,
      inputValue: nextInputValue,
      score: scoreRef.current,
      currentDigit: "",
      displayStep: 0,
    });
  };

  const clearInput = () => {
    if (phase !== "input") {
      return;
    }

    setInputValue("");
    persistRunState({
      phase: "input",
      sequence,
      roundLength,
      inputValue: "",
      score: scoreRef.current,
      currentDigit: "",
      displayStep: 0,
    });
  };

  const deleteLastDigit = () => {
    if (phase !== "input") {
      return;
    }

    const nextInputValue = inputValue.slice(0, -1);
    setInputValue(nextInputValue);
    persistRunState({
      phase: "input",
      sequence,
      roundLength,
      inputValue: nextInputValue,
      score: scoreRef.current,
      currentDigit: "",
      displayStep: 0,
    });
  };

  const submitAnswer = () => {
    if (phase !== "input" || inputValue.length !== roundLength) {
      return;
    }

    if (inputValue === sequence) {
      playCorrect();
      const nextScore = roundLength;
      scoreRef.current = nextScore;
      setScore(nextScore);
      startRound(roundLength + 1, nextScore);
      return;
    }

    playWrong();
    const finalScore = roundLength > INITIAL_LENGTH[rewardDifficulty] ? roundLength - 1 : 0;
    finishGame(finalScore);
  };

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

  return (
    <View className="digit-span-page">
      <GameRouteBack gameId="digit-span" runId={runId} onAbandon={handleRouteBack} />
      {renderGame()}
    </View>
  );
}
