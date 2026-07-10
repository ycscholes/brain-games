import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Text, View } from "@tarojs/components";
import Taro, { useDidShow, useLoad } from "@tarojs/taro";
import { addPointsToPet } from "../../utils/petStorage";
import {
  getAwardedPoints,
  getTrainingDifficultyLabel,
  recordTrainingSession,
  type TrainingDifficulty,
} from "../../utils/trainingStorage";
import { completeGauntletLegIfNeeded, readGameGauntletModePreset } from "../../utils/gameGauntlet";
import { usePageShare } from "../../utils/share";
import { useAmbientMusic } from "../../hooks/useAmbientMusic";
import { playComplete, playCorrect, playTap, playWrong } from "../../services/audio/audioFeedbackService";
import {
  HIDATO_CONFIG,
  applyHidatoCellClick,
  applyHidatoHint,
  createHidatoLineSegments,
  createHidatoPuzzle,
  createInitialClickState,
  scoreHidatoGame,
  type HidatoCell,
  type HidatoClickState,
  type HidatoPuzzle,
} from "./gameLogic";
import "./index.scss";

type Phase = "start" | "playing" | "finished";

const STORAGE_KEY_PREFIX = "hidato_best";
const HINT_FLASH_MS = 900;

function readBestScore(difficulty: TrainingDifficulty) {
  const value = Number(Taro.getStorageSync(`${STORAGE_KEY_PREFIX}_${difficulty}`) || 0);
  return Number.isFinite(value) ? value : 0;
}

function getDifficultyCopy(difficulty: TrainingDifficulty) {
  const config = HIDATO_CONFIG[difficulty];
  return difficulty === "hard"
    ? `${config.cols}列 x ${config.rows}行 · 空白 40%-50%`
    : `${config.cols}列 x ${config.rows}行 · 空白 40%`;
}

export default function HidatoPage() {
  usePageShare("pages/hidato/index");
  const gauntletPreset = readGameGauntletModePreset();
  const isGauntletPreset = gauntletPreset !== null;

  const [phase, setPhase] = useState<Phase>("start");
  useAmbientMusic(phase === "start");
  const [difficulty, setDifficulty] = useState<TrainingDifficulty>(gauntletPreset?.difficulty ?? "normal");
  const [best, setBest] = useState(0);
  const [puzzle, setPuzzle] = useState<HidatoPuzzle | null>(null);
  const [clickState, setClickState] = useState<HidatoClickState>(() => createInitialClickState());
  const [awardedPoints, setAwardedPoints] = useState(0);
  const [finalScore, setFinalScore] = useState(0);
  const [isNewBest, setIsNewBest] = useState(false);
  const [feedback, setFeedback] = useState("从 1 开始，沿相邻格连接到终点。");
  const [hintValue, setHintValue] = useState<number | null>(null);
  const [lastWrongCellId, setLastWrongCellId] = useState<string | null>(null);

  const startedAtRef = useRef(0);
  const finishedRef = useRef(false);
  const autoStartedRef = useRef(false);
  const hintTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const wrongTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clickedValueSet = useMemo(() => new Set(clickState.clickedValues), [clickState.clickedValues]);
  const lineSegments = useMemo(() => puzzle
    ? createHidatoLineSegments(puzzle, clickState.clickedValues)
    : [], [clickState.clickedValues, puzzle]);
  const progressPercent = puzzle
    ? Math.round((clickState.clickedValues.length / puzzle.total) * 100)
    : 0;

  const clearTransientTimers = useCallback(() => {
    if (hintTimerRef.current) {
      clearTimeout(hintTimerRef.current);
      hintTimerRef.current = null;
    }
    if (wrongTimerRef.current) {
      clearTimeout(wrongTimerRef.current);
      wrongTimerRef.current = null;
    }
  }, []);

  const refreshBest = useCallback(() => {
    setBest(readBestScore(difficulty));
  }, [difficulty]);

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
      clearTransientTimers();
    };
  }, [clearTransientTimers]);

  useEffect(() => {
    if (phase !== "playing" || clickState.nextValue <= 1) return;

    void Taro.pageScrollTo({
      selector: `.hidato-cell-value-${clickState.nextValue}`,
      duration: 220,
    }).catch(() => undefined);
  }, [clickState.nextValue, phase]);

  const finishGame = useCallback((nextState: HidatoClickState) => {
    if (!puzzle || finishedRef.current) return;

    finishedRef.current = true;
    clearTransientTimers();
    playComplete();

    const durationSeconds = Math.max(1, Math.round((Date.now() - startedAtRef.current) / 1000));
    const nextScore = scoreHidatoGame({
      difficulty,
      completed: true,
      elapsedSeconds: durationSeconds,
      mistakeCount: nextState.mistakeCount,
      hintCount: nextState.hintCount,
    });
    const nextAwardedPoints = getAwardedPoints("hidato", nextScore, difficulty);

    if (completeGauntletLegIfNeeded({
      gameId: "hidato",
      score: nextScore,
      awardedPoints: nextAwardedPoints,
      durationSeconds,
      difficulty,
      outcome: "completed",
    })) {
      return;
    }

    addPointsToPet("hidato", nextScore, difficulty);
    recordTrainingSession({
      gameId: "hidato",
      score: nextScore,
      awardedPoints: nextAwardedPoints,
      durationSeconds,
      difficulty,
      outcome: "completed",
    });

    setFinalScore(nextScore);
    setAwardedPoints(nextAwardedPoints);
    setPhase("finished");
    setFeedback("路径完整连接，训练完成。");

    if (nextScore > best) {
      Taro.setStorageSync(`${STORAGE_KEY_PREFIX}_${difficulty}`, nextScore);
      setBest(nextScore);
      setIsNewBest(true);
    } else {
      setIsNewBest(false);
    }
  }, [best, clearTransientTimers, difficulty, puzzle]);

  const startGame = useCallback(() => {
    playTap();
    clearTransientTimers();
    const nextPuzzle = createHidatoPuzzle(difficulty);
    const nextState = createInitialClickState();

    startedAtRef.current = Date.now();
    finishedRef.current = false;
    setPuzzle(nextPuzzle);
    setClickState(nextState);
    setAwardedPoints(0);
    setFinalScore(0);
    setIsNewBest(false);
    setHintValue(null);
    setLastWrongCellId(null);
    setFeedback("先点击 1，再沿相邻格寻找下一个数字。");
    setPhase("playing");
  }, [clearTransientTimers, difficulty]);

  useEffect(() => {
    if (!isGauntletPreset || autoStartedRef.current || phase !== "start") return;
    autoStartedRef.current = true;
    startGame();
  }, [isGauntletPreset, phase, startGame]);

  const backToStart = () => {
    clearTransientTimers();
    setPhase("start");
    setPuzzle(null);
    setClickState(createInitialClickState());
    setAwardedPoints(0);
    setFinalScore(0);
    setIsNewBest(false);
    setHintValue(null);
    setLastWrongCellId(null);
    setFeedback("从 1 开始，沿相邻格连接到终点。");
    finishedRef.current = false;
    refreshBest();
  };

  const flashWrongCell = (cellId: string) => {
    if (wrongTimerRef.current) {
      clearTimeout(wrongTimerRef.current);
    }
    setLastWrongCellId(cellId);
    wrongTimerRef.current = setTimeout(() => {
      setLastWrongCellId(null);
    }, 420);
  };

  const handleCellTap = (cell: HidatoCell) => {
    if (!puzzle || phase !== "playing" || finishedRef.current) return;

    const result = applyHidatoCellClick(clickState, cell, puzzle.total);
    playTap();
    result.correct ? playCorrect() : playWrong();
    setClickState(result.state);

    if (!result.correct) {
      flashWrongCell(cell.id);
      setFeedback(`当前要找 ${clickState.nextValue}，这格不是下一步。`);
      return;
    }

    setHintValue(null);
    setLastWrongCellId(null);
    setFeedback(result.completed ? "最后一步已连接。" : `继续寻找 ${result.state.nextValue}。`);

    if (result.completed) {
      finishGame(result.state);
    }
  };

  const useHint = () => {
    if (!puzzle || phase !== "playing" || finishedRef.current) return;

    const targetValue = clickState.nextValue;
    setClickState((current) => applyHidatoHint(current));
    setHintValue(targetValue);
    setFeedback(`提示已高亮 ${targetValue}，本局分数会降低。`);

    if (hintTimerRef.current) {
      clearTimeout(hintTimerRef.current);
    }
    hintTimerRef.current = setTimeout(() => {
      setHintValue(null);
    }, HINT_FLASH_MS);
  };

  const renderDifficultyCard = (nextDifficulty: TrainingDifficulty) => (
    <View
      className={`summary-item ${difficulty === nextDifficulty ? "summary-item-active" : ""}`}
      onClick={() => setDifficulty(nextDifficulty)}
    >
      <Text className="summary-value">{getTrainingDifficultyLabel(nextDifficulty)}</Text>
      <Text className="summary-label">{getDifficultyCopy(nextDifficulty)}</Text>
    </View>
  );

  const renderCell = (cell: HidatoCell) => {
    const clicked = clickedValueSet.has(cell.value);
    const visible = cell.given || clicked;
    const isTarget = phase === "playing" && cell.value === clickState.nextValue;
    const isHint = hintValue === cell.value;
    const isWrong = lastWrongCellId === cell.id;
    const isStart = cell.value === 1;
    const isEnd = puzzle ? cell.value === puzzle.total : false;

    return (
      <View
        key={cell.id}
        className={`hidato-cell hidato-cell-value-${cell.value} ${cell.given ? "hidato-cell-given" : ""} ${clicked ? "hidato-cell-clicked" : ""} ${isTarget ? "hidato-cell-target" : ""} ${isHint ? "hidato-cell-hint" : ""} ${isWrong ? "hidato-cell-wrong" : ""}`}
        onClick={() => handleCellTap(cell)}
      >
        <Text className="hidato-cell-text">{visible ? cell.value : ""}</Text>
        {isStart || isEnd ? (
          <Text className="hidato-cell-mark">{isStart ? "起" : "终"}</Text>
        ) : null}
      </View>
    );
  };

  return (
    <View className="hidato-page">
      {phase === "start" ? (
        <View className="hidato-start start-screen">
          <View className="header-section">
            <View className="logo-icon">
              <Text className="logo-emoji">1N</Text>
            </View>
            <Text className="game-title">连数迷阵</Text>
            <Text className="game-subtitle">从 1 出发，按顺序点击相邻格</Text>
            <View className="high-score-badge">
              <Text className="high-score-label">当前难度最高</Text>
              <Text className="high-score-value">{best}</Text>
            </View>
          </View>

          <View className="rules-card">
            <Text className="section-title">游戏规则</Text>
            <Text className="rule-item">1. 从 1 出发，按顺序点击相邻格。</Text>
            <Text className="rule-item">2. 正确路径会自动连线，错误和提示会扣分。</Text>
            <Text className="rule-item">3. 连接到最大数字 N 即通关。</Text>
          </View>

          {!isGauntletPreset && (
            <View className="summary-card">
              <Text className="section-title">难度</Text>
              <View className="summary-grid">
                {renderDifficultyCard("normal")}
                {renderDifficultyCard("hard")}
              </View>
            </View>
          )}

          <View className="floating-start-action">
            <View className="primary-button" onClick={startGame}>
              <Text className="primary-button-text">开始训练</Text>
            </View>
          </View>
          <View className="floating-start-spacer" />
        </View>
      ) : null}

      {phase === "playing" && puzzle ? (
        <View className="hidato-play">
          <View className="play-hud">
            <View className="play-hud-main">
              <View className="target-pill">
                <Text className="target-label">寻找</Text>
                <Text className="target-value">{clickState.nextValue > puzzle.total ? puzzle.total : clickState.nextValue}</Text>
              </View>
              <View className="progress-block">
                <Text className="progress-label">进度 {progressPercent}%</Text>
                <View className="progress-track">
                  <View className="progress-fill" style={{ width: `${progressPercent}%` }} />
                </View>
              </View>
            </View>
            <View className="hud-meta-row">
              <Text className="hud-feedback">{feedback}</Text>
              <View className="hud-counters">
                <Text className="hud-counter">错 {clickState.mistakeCount}</Text>
                <Text className="hud-counter">提示 {clickState.hintCount}</Text>
              </View>
            </View>
          </View>

          <View className="board-shell">
            <View
              className={`hidato-board hidato-board-${difficulty}`}
              style={{
                gridTemplateColumns: `repeat(${puzzle.cols}, 1fr)`,
                gridTemplateRows: `repeat(${puzzle.rows}, ${difficulty === "hard" ? 88 : 92}rpx)`,
              }}
            >
              <View className="hidato-line-layer">
                {lineSegments.map((segment) => (
                  <View
                    key={`${segment.fromValue}-${segment.toValue}`}
                    className="hidato-line-segment"
                    style={{
                      left: `${segment.left}%`,
                      top: `${segment.top}%`,
                      width: `${segment.width}%`,
                      transform: `translateY(-50%) rotate(${segment.angle}deg)`,
                    }}
                  />
                ))}
              </View>
              {puzzle.cells.map(renderCell)}
            </View>
          </View>

          <View className="action-row">
            <View className="secondary-button" onClick={useHint}>
              <Text className="secondary-button-text">提示下一步</Text>
            </View>
            <View className="secondary-button secondary-button-quiet" onClick={backToStart}>
              <Text className="secondary-button-text">重新选择</Text>
            </View>
          </View>
        </View>
      ) : null}

      {phase === "finished" ? (
        <View className="finish-screen">
          <View className="finish-panel">
            <Text className="finish-kicker">连数迷阵 · {getTrainingDifficultyLabel(difficulty)}</Text>
            <Text className="finish-title">{isNewBest ? "刷新最高分" : "训练完成"}</Text>
            <Text className="finish-score">{finalScore}</Text>
            <Text className="finish-copy">
              获得 {awardedPoints} 宠物积分 · 错误 {clickState.mistakeCount} · 提示 {clickState.hintCount}
            </Text>
            <View className="finish-actions">
              <View className="primary-button" onClick={startGame}>
                <Text className="primary-button-text">再来一局</Text>
              </View>
              <View className="secondary-button secondary-button-quiet" onClick={backToStart}>
                <Text className="secondary-button-text">返回难度</Text>
              </View>
            </View>
          </View>
        </View>
      ) : null}
    </View>
  );
}
