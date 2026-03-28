import { useEffect, useRef, useState } from "react";
import { View, Text } from "@tarojs/components";
import Taro, { useDidShow, useLoad } from "@tarojs/taro";
import { addPointsToPet } from "../../utils/petStorage";
import "./index.scss";

type Phase = "start" | "preview" | "tracking" | "selecting" | "roundResult" | "finished";

interface BoardSize {
  width: number;
  height: number;
}

interface MovingCircle {
  id: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  isTarget: boolean;
}

const STORAGE_KEY = "mot_best";
const INITIAL_TARGET_COUNT = 2;
const MAX_TARGET_COUNT = 4;
const PREVIEW_DURATION = 1200;
const TRACKING_DURATION = 5000;
const BASE_SPEED = 2.15;
const SPEED_STEP = 0.28;
const CIRCLE_SIZE = 52;
const CIRCLE_RADIUS = CIRCLE_SIZE / 2;
const CIRCLE_GAP = 8;

const clamp = (value: number, min: number, max: number) => {
  return Math.min(Math.max(value, min), max);
};

const shuffle = <T,>(list: T[]): T[] => {
  const next = [...list];
  for (let index = next.length - 1; index > 0; index -= 1) {
    const randomIndex = Math.floor(Math.random() * (index + 1));
    [next[index], next[randomIndex]] = [next[randomIndex], next[index]];
  }
  return next;
};

const requestFrame = (callback: (time: number) => void): number => {
  if (typeof requestAnimationFrame === "function") {
    return requestAnimationFrame(callback);
  }
  return setTimeout(() => callback(Date.now()), 16) as unknown as number;
};

const cancelFrame = (frameId: number) => {
  if (typeof cancelAnimationFrame === "function") {
    cancelAnimationFrame(frameId);
    return;
  }
  clearTimeout(frameId as unknown as ReturnType<typeof setTimeout>);
};

const getBoardSize = (windowWidth: number): BoardSize => {
  const width = clamp(windowWidth - 48, 300, 420);
  return {
    width,
    height: Math.round(width * 0.74),
  };
};

const randomBetween = (min: number, max: number) => {
  return Math.random() * (max - min) + min;
};

const createVelocity = (speed: number) => {
  const angle = Math.random() * Math.PI * 2;
  const magnitude = speed * randomBetween(0.92, 1.12);
  return {
    vx: Math.cos(angle) * magnitude,
    vy: Math.sin(angle) * magnitude,
  };
};

const buildCircles = (targetCount: number, speed: number, boardSize: BoardSize): MovingCircle[] => {
  const totalCount = clamp(targetCount + 4, 6, 8);
  const targetIndexSet = new Set(shuffle(Array.from({ length: totalCount }, (_, index) => index)).slice(0, targetCount));
  const circles: MovingCircle[] = [];
  const maxX = boardSize.width - CIRCLE_RADIUS;
  const maxY = boardSize.height - CIRCLE_RADIUS;
  const minDistance = CIRCLE_SIZE + CIRCLE_GAP;

  for (let index = 0; index < totalCount; index += 1) {
    let x = randomBetween(CIRCLE_RADIUS, maxX);
    let y = randomBetween(CIRCLE_RADIUS, maxY);
    let placed = false;

    for (let attempt = 0; attempt < 240; attempt += 1) {
      x = randomBetween(CIRCLE_RADIUS, maxX);
      y = randomBetween(CIRCLE_RADIUS, maxY);

      const overlaps = circles.some((circle) => {
        const dx = circle.x - x;
        const dy = circle.y - y;
        return Math.sqrt(dx * dx + dy * dy) < minDistance;
      });

      if (!overlaps) {
        placed = true;
        break;
      }
    }

    if (!placed && circles[index - 1]) {
      x = clamp(circles[index - 1].x + minDistance, CIRCLE_RADIUS, maxX);
      y = clamp(circles[index - 1].y + minDistance * 0.5, CIRCLE_RADIUS, maxY);
    }

    circles.push({
      id: index + 1,
      x,
      y,
      isTarget: targetIndexSet.has(index),
      ...createVelocity(speed),
    });
  }

  return circles;
};

export default function MultipleObjectTracking() {
  const systemInfoRef = useRef(Taro.getSystemInfoSync());
  const boardSizeRef = useRef(getBoardSize(systemInfoRef.current.windowWidth));
  const phaseRef = useRef<Phase>("start");
  const circlesRef = useRef<MovingCircle[]>([]);
  const frameRef = useRef<number | null>(null);
  const previewTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastFrameTimeRef = useRef(0);
  const trackStartTimeRef = useRef(0);

  const [phase, setPhase] = useState<Phase>("start");
  const [best, setBest] = useState(0);
  const [score, setScore] = useState(0);
  const [targetCount, setTargetCount] = useState(INITIAL_TARGET_COUNT);
  const [speed, setSpeed] = useState(BASE_SPEED);
  const [circles, setCircles] = useState<MovingCircle[]>([]);
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [roundMessage, setRoundMessage] = useState("记住高亮的目标圆圈");
  const [isNewBest, setIsNewBest] = useState(false);
  const [lastHitCount, setLastHitCount] = useState(0);
  const [lastTargetIds, setLastTargetIds] = useState<number[]>([]);

  const boardSize = boardSizeRef.current;

  useEffect(() => {
    phaseRef.current = phase;
  }, [phase]);

  const refreshBest = () => {
    const value = Number(Taro.getStorageSync(STORAGE_KEY) || 0);
    setBest(Number.isFinite(value) ? value : 0);
  };

  useLoad(() => {
    refreshBest();
  });

  useDidShow(() => {
    refreshBest();
  });

  const clearRoundRuntime = () => {
    if (previewTimerRef.current) {
      clearTimeout(previewTimerRef.current);
      previewTimerRef.current = null;
    }

    if (frameRef.current !== null) {
      cancelFrame(frameRef.current);
      frameRef.current = null;
    }
  };

  useEffect(() => {
    return () => {
      clearRoundRuntime();
    };
  }, []);

  const syncCircles = (nextCircles: MovingCircle[]) => {
    circlesRef.current = nextCircles;
    setCircles(nextCircles.map((circle) => ({ ...circle })));
  };

  const stopTracking = (nextCircles?: MovingCircle[]) => {
    if (frameRef.current !== null) {
      cancelFrame(frameRef.current);
      frameRef.current = null;
    }

    if (nextCircles) {
      syncCircles(nextCircles);
    }

    lastFrameTimeRef.current = 0;
    trackStartTimeRef.current = 0;
    setSelectedIds([]);
    setRoundMessage(`请选择 ${targetCount} 个你一直在追踪的目标圆圈`);
    setPhase("selecting");
  };

  const stepCircles = (currentCircles: MovingCircle[], dt: number) => {
    const nextCircles = currentCircles.map((circle) => {
      const nextCircle = {
        ...circle,
        x: circle.x + circle.vx * dt,
        y: circle.y + circle.vy * dt,
      };

      if (nextCircle.x <= CIRCLE_RADIUS) {
        nextCircle.x = CIRCLE_RADIUS;
        nextCircle.vx = Math.abs(nextCircle.vx);
      } else if (nextCircle.x >= boardSize.width - CIRCLE_RADIUS) {
        nextCircle.x = boardSize.width - CIRCLE_RADIUS;
        nextCircle.vx = -Math.abs(nextCircle.vx);
      }

      if (nextCircle.y <= CIRCLE_RADIUS) {
        nextCircle.y = CIRCLE_RADIUS;
        nextCircle.vy = Math.abs(nextCircle.vy);
      } else if (nextCircle.y >= boardSize.height - CIRCLE_RADIUS) {
        nextCircle.y = boardSize.height - CIRCLE_RADIUS;
        nextCircle.vy = -Math.abs(nextCircle.vy);
      }

      return nextCircle;
    });

    for (let first = 0; first < nextCircles.length; first += 1) {
      for (let second = first + 1; second < nextCircles.length; second += 1) {
        const circleA = nextCircles[first];
        const circleB = nextCircles[second];
        const dx = circleB.x - circleA.x;
        const dy = circleB.y - circleA.y;
        const distance = Math.sqrt(dx * dx + dy * dy) || 0.001;
        const minDistance = CIRCLE_SIZE;

        if (distance >= minDistance) {
          continue;
        }

        const normalX = dx / distance;
        const normalY = dy / distance;
        const overlap = (minDistance - distance) / 2;
        const relativeVelocityX = circleA.vx - circleB.vx;
        const relativeVelocityY = circleA.vy - circleB.vy;
        const impactSpeed = relativeVelocityX * normalX + relativeVelocityY * normalY;

        circleA.x -= normalX * overlap;
        circleA.y -= normalY * overlap;
        circleB.x += normalX * overlap;
        circleB.y += normalY * overlap;

        if (impactSpeed > 0) {
          circleA.vx -= impactSpeed * normalX;
          circleA.vy -= impactSpeed * normalY;
          circleB.vx += impactSpeed * normalX;
          circleB.vy += impactSpeed * normalY;
        }

        circleA.x = clamp(circleA.x, CIRCLE_RADIUS, boardSize.width - CIRCLE_RADIUS);
        circleA.y = clamp(circleA.y, CIRCLE_RADIUS, boardSize.height - CIRCLE_RADIUS);
        circleB.x = clamp(circleB.x, CIRCLE_RADIUS, boardSize.width - CIRCLE_RADIUS);
        circleB.y = clamp(circleB.y, CIRCLE_RADIUS, boardSize.height - CIRCLE_RADIUS);
      }
    }

    return nextCircles;
  };

  const startTracking = () => {
    setPhase("tracking");
    setRoundMessage("所有圆圈将持续移动 5 秒，请保持专注");
    lastFrameTimeRef.current = 0;
    trackStartTimeRef.current = 0;

    const animate = (timestamp: number) => {
      if (phaseRef.current !== "tracking") {
        return;
      }

      if (!trackStartTimeRef.current) {
        trackStartTimeRef.current = timestamp;
      }

      if (!lastFrameTimeRef.current) {
        lastFrameTimeRef.current = timestamp;
      }

      const elapsed = timestamp - trackStartTimeRef.current;
      const dt = Math.min((timestamp - lastFrameTimeRef.current) / 16.67, 1.8);
      lastFrameTimeRef.current = timestamp;

      const nextCircles = stepCircles(circlesRef.current, dt);
      syncCircles(nextCircles);

      if (elapsed >= TRACKING_DURATION) {
        stopTracking(nextCircles);
        return;
      }

      frameRef.current = requestFrame(animate);
    };

    frameRef.current = requestFrame(animate);
  };

  const startRound = (nextTargetCount: number, nextSpeed: number) => {
    clearRoundRuntime();
    setTargetCount(nextTargetCount);
    setSpeed(nextSpeed);
    setSelectedIds([]);
    setLastHitCount(0);
    setLastTargetIds([]);
    setRoundMessage("记住高亮的目标圆圈");

    const nextCircles = buildCircles(nextTargetCount, nextSpeed, boardSize);
    syncCircles(nextCircles);
    setPhase("preview");

    previewTimerRef.current = setTimeout(() => {
      startTracking();
    }, PREVIEW_DURATION);
  };

  const startGame = () => {
    setScore(0);
    setIsNewBest(false);
    startRound(INITIAL_TARGET_COUNT, BASE_SPEED);
  };

  const backToStart = () => {
    clearRoundRuntime();
    if (phase !== "start" && phase !== "finished") {
      addPointsToPet("multiple-object-tracking", score);
    }
    setPhase("start");
    setScore(0);
    setTargetCount(INITIAL_TARGET_COUNT);
    setSpeed(BASE_SPEED);
    setSelectedIds([]);
    setCircles([]);
    setLastHitCount(0);
    setLastTargetIds([]);
    setRoundMessage("记住高亮的目标圆圈");
    refreshBest();
  };

  const toggleSelect = (circleId: number) => {
    if (phase !== "selecting") {
      return;
    }

    setSelectedIds((prev) => {
      if (prev.includes(circleId)) {
        return prev.filter((id) => id !== circleId);
      }

      if (prev.length >= targetCount) {
        return prev;
      }

      return [...prev, circleId];
    });
  };

  const submitSelection = () => {
    if (phase !== "selecting" || selectedIds.length !== targetCount) {
      return;
    }

    const targetIds = circlesRef.current.filter((circle) => circle.isTarget).map((circle) => circle.id);
    const targetSet = new Set(targetIds);
    const hitCount = selectedIds.filter((id) => targetSet.has(id)).length;
    const allCorrect = hitCount === targetCount;

    setLastTargetIds(targetIds);
    setLastHitCount(hitCount);

    if (allCorrect) {
      const nextScore = score + 1;
      const nextTargetCount = Math.min(MAX_TARGET_COUNT, targetCount + 1);
      const nextSpeed = Number((speed + SPEED_STEP).toFixed(2));

      setScore(nextScore);
      setTargetCount(nextTargetCount);
      setSpeed(nextSpeed);
      setRoundMessage("本轮全部追踪正确");

      if (nextScore > best) {
        Taro.setStorageSync(STORAGE_KEY, nextScore);
        setBest(nextScore);
        setIsNewBest(true);
      }

      setPhase("roundResult");
      return;
    }

    setRoundMessage("本轮未能完整锁定全部目标");
    addPointsToPet("multiple-object-tracking", score);
    setPhase("finished");
  };

  const renderArena = () => {
    const revealTargets = phase === "preview" || phase === "roundResult" || phase === "finished";

    return (
      <View className="arena-card">
        <View className="arena" style={{ width: `${boardSize.width}px`, height: `${boardSize.height}px` }}>
          {circles.map((circle) => {
            const isSelected = selectedIds.includes(circle.id);
            const isWrongPick = revealTargets && isSelected && !circle.isTarget;
            const classNames = [
              "circle",
              circle.isTarget && revealTargets ? "circle-target" : "",
              isSelected ? "circle-selected" : "",
              isWrongPick ? "circle-wrong" : "",
            ]
              .filter(Boolean)
              .join(" ");

            return (
              <View
                key={circle.id}
                className={classNames}
                style={{
                  width: `${CIRCLE_SIZE}px`,
                  height: `${CIRCLE_SIZE}px`,
                  transform: `translate3d(${circle.x - CIRCLE_RADIUS}px, ${circle.y - CIRCLE_RADIUS}px, 0)`,
                }}
                onClick={() => toggleSelect(circle.id)}
              >
                <Text className="circle-text">{phase === "preview" && circle.isTarget ? "目" : ""}</Text>
              </View>
            );
          })}
        </View>
      </View>
    );
  };

  return (
    <View className="mot-page">
      {phase === "start" ? (
        <View className="start-screen">
          <View className="header-section">
            <View className="logo-icon">
              <Text className="logo-emoji">◎</Text>
            </View>
            <Text className="game-title">追踪任务</Text>
            <Text className="game-subtitle">在移动干扰中持续锁定目标圆圈</Text>
            <View className="high-score-badge">
              <Text className="high-score-label">最佳分数</Text>
              <Text className="high-score-value">{best}</Text>
            </View>
          </View>

          <View className="rules-card">
            <Text className="section-title">游戏规则</Text>
            <Text className="rule-item">1. 每局从 2 个目标圆圈开始，先短暂高亮提示。</Text>
            <Text className="rule-item">2. 所有圆圈统一外观后移动 5 秒，并带有碰撞反弹。</Text>
            <Text className="rule-item">3. 停止后点击选出目标并提交，必须全部正确才算过关。</Text>
            <Text className="rule-item">4. 每轮成功后目标数 +1，最多 4 个，同时速度略微提升。</Text>
          </View>

          <View className="summary-card">
            <Text className="section-title">当前设定</Text>
            <View className="summary-grid">
              <View className="summary-item">
                <Text className="summary-value">{INITIAL_TARGET_COUNT}</Text>
                <Text className="summary-label">起始目标</Text>
              </View>
              <View className="summary-item">
                <Text className="summary-value">5s</Text>
                <Text className="summary-label">移动时长</Text>
              </View>
              <View className="summary-item">
                <Text className="summary-value">{MAX_TARGET_COUNT}</Text>
                <Text className="summary-label">目标上限</Text>
              </View>
            </View>
          </View>

          <View className="primary-button" onClick={startGame}>
            <Text className="button-text">开始挑战</Text>
          </View>
          <View className="footer-gap" />
        </View>
      ) : null}

      {phase === "preview" || phase === "tracking" || phase === "selecting" ? (
        <View className="game-screen">
          <View className="status-row">
            <View className="status-card">
              <Text className="status-value">{targetCount}</Text>
              <Text className="status-label">目标数量</Text>
            </View>
            <View className="status-card">
              <Text className="status-value">{score}</Text>
              <Text className="status-label">连续得分</Text>
            </View>
            <View className="status-card">
              <Text className="status-value">{best}</Text>
              <Text className="status-label">最佳分数</Text>
            </View>
          </View>

          <View className="phase-card">
            <Text className="phase-title">
              {phase === "preview" ? "准备记忆" : phase === "tracking" ? "追踪中" : "作答阶段"}
            </Text>
            <Text className="phase-desc">{roundMessage}</Text>
            {phase === "selecting" ? (
              <Text className="selection-tip">
                已选择 {selectedIds.length} / {targetCount}
              </Text>
            ) : null}
          </View>

          {renderArena()}

          {phase === "selecting" ? (
            <View className="action-row">
              <View
                className={`primary-button ${selectedIds.length === targetCount ? "" : "button-disabled"}`}
                onClick={submitSelection}
              >
                <Text className="button-text">提交选择</Text>
              </View>
              <View className="secondary-button" onClick={backToStart}>
                <Text className="button-text">结束本局</Text>
              </View>
            </View>
          ) : null}
        </View>
      ) : null}

      {phase === "roundResult" ? (
        <View className="result-screen">
          <View className="result-card">
            <Text className="result-title">本轮正确</Text>
            <Text className="result-score">{score}</Text>
            <Text className="result-desc">连续正确轮数 +1，本轮命中 {lastHitCount} / {lastTargetIds.length}。</Text>
            <Text className="result-desc">
              下一轮将追踪 {targetCount} 个目标，速度提升至 {speed.toFixed(2)}。
            </Text>
            {isNewBest ? <Text className="result-highlight">已刷新最佳分数</Text> : null}
          </View>

          {renderArena()}

          <View className="result-actions">
            <View className="primary-button" onClick={() => startRound(targetCount, speed)}>
              <Text className="button-text">进入下一轮</Text>
            </View>
            <View className="secondary-button" onClick={backToStart}>
              <Text className="button-text">返回开始页</Text>
            </View>
          </View>
        </View>
      ) : null}

      {phase === "finished" ? (
        <View className="result-screen">
          <View className="result-card">
            <Text className="result-title">挑战结束</Text>
            <Text className="result-score">{score}</Text>
            <Text className="result-desc">本轮命中 {lastHitCount} / {lastTargetIds.length}，最终得分为连续正确轮数。</Text>
            <Text className="result-desc">最佳分数 {best}</Text>
            {isNewBest ? <Text className="result-highlight">已刷新最佳分数</Text> : null}
          </View>

          {renderArena()}

          <View className="result-actions">
            <View className="primary-button" onClick={startGame}>
              <Text className="button-text">再来一局</Text>
            </View>
            <View className="secondary-button" onClick={backToStart}>
              <Text className="button-text">返回开始页</Text>
            </View>
          </View>
        </View>
      ) : null}
    </View>
  );
}
