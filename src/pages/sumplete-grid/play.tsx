import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { View, Text } from "@tarojs/components";
import Taro, { getCurrentInstance, useUnload } from "@tarojs/taro";
import { shouldRedirectInvalidGameRun } from "../../utils/gameRoute";
import { usePageShare } from "../../utils/share";
import {
  playComplete,
  playCorrect,
  playTap,
  playWrong,
} from "../../services/audio/audioFeedbackService";
import {
  cellKey,
  cycleSumpleteCellState,
  evaluateSumpleteGrid,
  scoreSumpleteGrid,
  type SumpleteGridCell,
} from "./gameLogic";
import {
  abandonSumpleteGridRun,
  readSumpleteGridRun,
  settleSumpleteGridCompletion,
  updateSumpleteGridRun,
  type SumpleteGridRun,
} from "./run";
import "./index.scss";

const STORAGE_KEY_PREFIX = "sumplete_grid_best";

function formatTime(totalSeconds: number) {
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = `${totalSeconds % 60}`.padStart(2, "0");
  return `${minutes}:${seconds}`;
}

export default function SumpleteGridPlay() {
  usePageShare("pages/sumplete-grid/index");
  const runId =
    typeof getCurrentInstance().router?.params?.runId === "string"
      ? (getCurrentInstance().router?.params?.runId ?? "")
      : "";
  const [run, setRun] = useState<SumpleteGridRun | null>(() => readSumpleteGridRun(runId));
  const routeRun = run;
  const runRef = useRef(run);
  const finishedRef = useRef(false);
  const allowSettledRef = useRef(false);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);

  useEffect(() => {
    runRef.current = run;
  }, [run]);
  useEffect(() => {
    if (
      shouldRedirectInvalidGameRun(runId, routeRun?.status, allowSettledRef.current) ||
      (routeRun && routeRun.status !== "active" && !allowSettledRef.current)
    )
      void Taro.redirectTo({ url: "/pages/sumplete-grid/index" });
  }, [routeRun, runId]);

  const startedAt = run?.payload.startedAt;
  const runStatus = run?.status;
  useEffect(() => {
    if (!startedAt || runStatus !== "active") return undefined;
    const timer = setInterval(() => {
      setElapsedSeconds(Math.max(1, Math.floor((Date.now() - startedAt) / 1000)));
    }, 1000);
    return () => clearInterval(timer);
  }, [runStatus, startedAt]);

  const finishGame = useCallback(
    (activeRun: SumpleteGridRun, finalElapsedSeconds: number) => {
      if (finishedRef.current) return;
      finishedRef.current = true;
      const { payload } = activeRun;
      const score = scoreSumpleteGrid({
        difficulty: payload.difficulty,
        elapsedSeconds: finalElapsedSeconds,
        mistakes: payload.mistakes,
      });
      const best =
        Number(Taro.getStorageSync(`${STORAGE_KEY_PREFIX}_${payload.difficulty}`) || 0) || 0;
      allowSettledRef.current = true;
      const settled = settleSumpleteGridCompletion(
        runId,
        {
          score,
          awardedPoints: 0,
          durationSeconds: finalElapsedSeconds,
          mistakes: payload.mistakes,
          isNewBest: score > best,
        },
        {
          gameId: "sumplete-grid",
          score,
          durationSeconds: finalElapsedSeconds,
          difficulty: payload.difficulty,
          outcome: "completed",
        },
      );
      if (!settled) return;
      playComplete();
      if (settled.settlement.gauntletHandled) return;
      if (score > best) Taro.setStorageSync(`${STORAGE_KEY_PREFIX}_${payload.difficulty}`, score);
      void Taro.redirectTo({
        url: `/pages/sumplete-grid/result?runId=${encodeURIComponent(runId)}`,
      });
    },
    [runId],
  );

  const currentEvaluation = useMemo(() => {
    if (!run) return null;
    return run.payload.evaluation ?? evaluateSumpleteGrid(run.payload.puzzle, run.payload.cells);
  }, [run]);
  const decidedCount = useMemo(
    () => run?.payload.cells.filter((cell) => cell.state !== "unknown").length ?? 0,
    [run],
  );

  const toggleCell = useCallback(
    (target: SumpleteGridCell) => {
      const activeRun = runRef.current;
      if (!activeRun || activeRun.status !== "active") return;
      playTap();
      const cells = activeRun.payload.cells.map((cell) =>
        cell.row === target.row && cell.col === target.col
          ? { ...cell, state: cycleSumpleteCellState(cell.state) }
          : cell,
      );
      const updated = updateSumpleteGridRun(runId, { cells, evaluation: null });
      if (updated) {
        runRef.current = updated;
        setRun(updated);
      }
    },
    [runId],
  );

  const submitPuzzle = useCallback(() => {
    const activeRun = runRef.current;
    if (!activeRun || activeRun.status !== "active") return;
    const evaluation = evaluateSumpleteGrid(activeRun.payload.puzzle, activeRun.payload.cells);
    const updated = updateSumpleteGridRun(runId, { evaluation });
    if (updated) {
      runRef.current = updated;
      setRun(updated);
    }
    playTap();
    if (!evaluation.complete || !evaluation.correct) {
      playWrong();
      const withMistake = updateSumpleteGridRun(runId, {
        evaluation,
        mistakes: activeRun.payload.mistakes + 1,
      });
      if (withMistake) {
        runRef.current = withMistake;
        setRun(withMistake);
      }
      return;
    }
    playCorrect();
    const finalElapsedSeconds = Math.max(
      1,
      Math.floor((Date.now() - activeRun.payload.startedAt) / 1000),
    );
    finishGame(
      { ...activeRun, payload: { ...activeRun.payload, evaluation } },
      finalElapsedSeconds,
    );
  }, [finishGame, runId]);

  const backToStart = useCallback(() => {
    const activeRun = runRef.current;
    if (!activeRun || activeRun.status !== "active") return;
    const settlement = abandonSumpleteGridRun(runId, {
      gameId: "sumplete-grid",
      score: 0,
      durationSeconds: Math.max(1, Math.round((Date.now() - activeRun.payload.startedAt) / 1000)),
      difficulty: activeRun.payload.difficulty,
      outcome: "interrupted",
    });
    if (!settlement) return;
    void Taro.navigateBack().catch(() => Taro.redirectTo({ url: "/pages/sumplete-grid/index" }));
  }, [runId]);

  useUnload(backToStart);

  if (!run || run.status !== "active") return null;
  const { payload } = run;
  const wrongCells = new Set(currentEvaluation?.wrongCellKeys ?? []);
  const totalCells = payload.puzzle.size * payload.puzzle.size;

  return (
    <View className="sumplete-grid-page">
      <View className="sumplete-play">
        <View className="status-row">
          <View className="status-card">
            <Text className="status-value">{formatTime(elapsedSeconds)}</Text>
            <Text className="status-label">用时</Text>
          </View>
          <View className="status-card">
            <Text className="status-value">
              {decidedCount}/{totalCells}
            </Text>
            <Text className="status-label">已判断</Text>
          </View>
          <View className="status-card">
            <Text className="status-value">{payload.mistakes}</Text>
            <Text className="status-label">失误</Text>
          </View>
        </View>
        <View className="sumplete-board-card">
          <View
            className={`sumplete-board sumplete-board-${payload.puzzle.size}`}
            style={{
              gridTemplateColumns: `repeat(${payload.puzzle.size}, 1fr) 74rpx`,
              gridTemplateRows: `repeat(${payload.puzzle.size}, 1fr) 74rpx`,
            }}
          >
            {payload.cells.map((cell) => (
              <View
                key={cellKey(cell.row, cell.col)}
                className={`sumplete-cell sumplete-cell-${cell.state} ${wrongCells.has(cellKey(cell.row, cell.col)) ? "sumplete-cell-wrong" : ""}`}
                style={{ gridColumn: cell.col + 1, gridRow: cell.row + 1 }}
                onClick={() => toggleCell(cell)}
              >
                <Text className="sumplete-cell-value">{cell.value}</Text>
              </View>
            ))}
            {payload.puzzle.rowTargets.map((target, index) => (
              <View
                key={`row-${index}`}
                className="sumplete-target sumplete-row-target"
                style={{ gridColumn: payload.puzzle.size + 1, gridRow: index + 1 }}
              >
                <Text className="sumplete-target-value">{target}</Text>
              </View>
            ))}
            {payload.puzzle.colTargets.map((target, index) => (
              <View
                key={`col-${index}`}
                className="sumplete-target sumplete-col-target"
                style={{ gridColumn: index + 1, gridRow: payload.puzzle.size + 1 }}
              >
                <Text className="sumplete-target-value">{target}</Text>
              </View>
            ))}
            <View
              className="sumplete-corner"
              style={{ gridColumn: payload.puzzle.size + 1, gridRow: payload.puzzle.size + 1 }}
            >
              <Text className="sumplete-corner-text">目标</Text>
            </View>
          </View>
        </View>
        {currentEvaluation ? (
          <View
            className={`feedback-card ${currentEvaluation.correct ? "feedback-correct" : "feedback-wrong"}`}
          >
            <Text className="feedback-title">
              {currentEvaluation.correct
                ? "求和完成"
                : currentEvaluation.complete
                  ? "有数字判断不对"
                  : "还有格子未判断"}
            </Text>
            <Text className="feedback-copy">
              {currentEvaluation.correct
                ? "每行每列目标都已匹配"
                : "看右侧和底部目标，再调整保留与划掉"}
            </Text>
          </View>
        ) : null}
        <View className="submit-panel">
          <View className="secondary-button" onClick={backToStart}>
            <Text className="secondary-button-text">返回设置</Text>
          </View>
          <View className="primary-button" onClick={submitPuzzle}>
            <Text className="primary-button-text">提交答案</Text>
          </View>
        </View>
      </View>
    </View>
  );
}
