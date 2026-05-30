import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { View, Text } from "@tarojs/components";
import Taro, { useDidShow, useLoad } from "@tarojs/taro";
import { addPointsToPet } from "../../utils/petStorage";
import {
  getAwardedPoints,
  getTrainingDifficultyLabel,
  MAX_POINTS_PER_SESSION,
  recordTrainingSession,
  type TrainingDifficulty,
} from "../../utils/trainingStorage";
import { usePageShare } from "../../utils/share";
import "./index.scss";

type GameStatus = "start" | "playing" | "finished";
type Mode = "alternating" | "simultaneous" | "stroop";
type Difficulty = "easy" | "normal" | "hard" | "expert";
type TaskSide = "A" | "B";

type TaskType =
  | "odd_even"
  | "greater_than"
  | "simple_math"
  | "color_match"
  | "shape_match"
  | "find_same"
  | "stroop_read"
  | "stroop_color";

interface GameConfig {
  mode: Mode;
  difficulty: Difficulty;
}

interface Task {
  id: string;
  type: TaskType;
  label: string;
  question: string;
  options: string[];
  correctAnswer: number;
  timeLimit: number;
  inkColor?: string;
}

interface TaskPair {
  taskA: Task;
  taskB: Task;
}

interface DifficultyConfig {
  label: string;
  gapTime: number;
  taskTimeLimit: number;
  timeoutPenalty: number;
  chipColor: string;
}

const DIFFICULTY_CONFIG: Record<Difficulty, DifficultyConfig> = {
  easy: { label: "简单", gapTime: 1800, taskTimeLimit: 5000, timeoutPenalty: 2, chipColor: "#34C759" },
  normal: { label: "普通", gapTime: 1400, taskTimeLimit: 4000, timeoutPenalty: 3, chipColor: "#4A90D9" },
  hard: { label: "困难", gapTime: 1000, taskTimeLimit: 3000, timeoutPenalty: 4, chipColor: "#FF9500" },
  expert: { label: "专家", gapTime: 700, taskTimeLimit: 2000, timeoutPenalty: 5, chipColor: "#FF3B30" },
};

const DIFFICULTY_POINTS: Record<Difficulty, number> = {
  easy: 2,
  normal: 3,
  hard: 4,
  expert: 5,
};

const MODE_CONFIG: Record<Mode, { title: string; subtitle: string; icon: string }> = {
  alternating: { title: "交替模式", subtitle: "上下任务轮流作答", icon: "🔁" },
  simultaneous: { title: "同时模式", subtitle: "必须双任务全对才得分", icon: "⚡" },
  stroop: { title: "Stroop 挑战", subtitle: "读词与辨色认知冲突", icon: "🧠" },
};

const MODE_HINTS: Record<Mode, string> = {
  alternating: "一次只聚焦当前高亮任务，节奏更稳定。",
  simultaneous: "双任务同时判断，适合双手快速点击。",
  stroop: "看清字义与颜色冲突，优先保持准确率。",
};

const COLOR_WORDS = ["红", "蓝", "黄", "绿"];
const COLOR_HEX: Record<string, string> = {
  红: "#FF3B30",
  蓝: "#4A90D9",
  黄: "#F4B400",
  绿: "#34C759",
};
const COLOR_BLOCKS = ["🟥", "🟦", "🟨", "🟩"];
const SHAPES = ["●", "■", "▲", "★"];
const SHAPE_LABELS = ["圆形", "方形", "三角", "五角星"];
const WRONG_PENALTY = 2;
const SESSION_DURATION_MS = 60 * 1000;

const randomInt = (min: number, max: number) => Math.floor(Math.random() * (max - min + 1)) + min;
const pickOne = <T,>(list: T[]) => list[randomInt(0, list.length - 1)];

function getStorageKey(mode: Mode) {
  return `dual_task_best_${mode}`;
}

function getRewardDifficulty(difficulty: Difficulty): TrainingDifficulty {
  return difficulty === "hard" || difficulty === "expert" ? "hard" : "normal";
}

function getDifficultyNumberRange(difficulty: Difficulty) {
  switch (difficulty) {
    case "easy":
      return { min: 1, max: 10 };
    case "normal":
      return { min: 1, max: 50 };
    case "hard":
      return { min: 1, max: 100 };
    default:
      return { min: 1, max: 200 };
  }
}

function makeOddEvenTask(difficulty: Difficulty, baseTimeLimit: number): Task {
  const range = getDifficultyNumberRange(difficulty);
  const n = randomInt(range.min, range.max);
  return {
    id: `odd-even-${Date.now()}-${Math.random()}`,
    type: "odd_even",
    label: "数字判断",
    question: `${n}`,
    options: ["奇数", "偶数"],
    correctAnswer: n % 2 === 0 ? 1 : 0,
    timeLimit: baseTimeLimit,
  };
}

function makeGreaterThanTask(difficulty: Difficulty, baseTimeLimit: number): Task {
  const range = getDifficultyNumberRange(difficulty);
  const n = randomInt(range.min, range.max);
  const threshold = difficulty === "easy" ? 10 : difficulty === "normal" ? 50 : 100;
  return {
    id: `greater-than-${Date.now()}-${Math.random()}`,
    type: "greater_than",
    label: "大小判断",
    question: `${n} > ${threshold} ?`,
    options: ["是", "否"],
    correctAnswer: n > threshold ? 0 : 1,
    timeLimit: baseTimeLimit,
  };
}

function makeSimpleMathTask(difficulty: Difficulty, baseTimeLimit: number): Task {
  const operators = difficulty === "easy" ? ["+", "-"] : ["+", "-", "×"];
  const op = pickOne(operators);
  const upper = difficulty === "easy" ? 9 : difficulty === "normal" ? 12 : difficulty === "hard" ? 20 : 30;
  const a = randomInt(1, upper);
  const b = randomInt(1, upper);
  const result = op === "+" ? a + b : op === "-" ? a - b : a * b;
  const options = [result, result + randomInt(1, 3), result - randomInt(1, 3), result + randomInt(4, 8)]
    .map((item) => `${item}`)
    .filter((item, idx, arr) => arr.indexOf(item) === idx)
    .slice(0, 4);
  while (options.length < 4) {
    options.push(`${result + randomInt(9, 15)}`);
  }
  const shuffled = options.sort(() => Math.random() - 0.5);
  return {
    id: `math-${Date.now()}-${Math.random()}`,
    type: "simple_math",
    label: "快速心算",
    question: `${a} ${op} ${b}`,
    options: shuffled,
    correctAnswer: shuffled.findIndex((item) => item === `${result}`),
    timeLimit: baseTimeLimit,
  };
}

function makeColorTask(baseTimeLimit: number): Task {
  const idx = randomInt(0, COLOR_WORDS.length - 1);
  return {
    id: `color-${Date.now()}-${Math.random()}`,
    type: "color_match",
    label: "颜色识别",
    question: COLOR_BLOCKS[idx],
    options: COLOR_WORDS,
    correctAnswer: idx,
    timeLimit: baseTimeLimit,
  };
}

function makeShapeTask(baseTimeLimit: number): Task {
  const idx = randomInt(0, SHAPES.length - 1);
  return {
    id: `shape-${Date.now()}-${Math.random()}`,
    type: "shape_match",
    label: "图形识别",
    question: SHAPES[idx],
    options: SHAPE_LABELS,
    correctAnswer: idx,
    timeLimit: baseTimeLimit,
  };
}

function makeFindSameTask(baseTimeLimit: number): Task {
  const correctIdx = randomInt(0, COLOR_WORDS.length - 1);
  const wrongIdx = (correctIdx + randomInt(1, 3)) % COLOR_WORDS.length;
  const seq = [COLOR_BLOCKS[correctIdx], COLOR_BLOCKS[wrongIdx], COLOR_BLOCKS[correctIdx]];
  return {
    id: `findsame-${Date.now()}-${Math.random()}`,
    type: "find_same",
    label: "找相同",
    question: `${seq.join("")} 哪个重复?`,
    options: COLOR_WORDS,
    correctAnswer: correctIdx,
    timeLimit: baseTimeLimit,
  };
}

function makeStroopTask(type: "stroop_read" | "stroop_color", baseTimeLimit: number): Task {
  const word = pickOne(COLOR_WORDS);
  let ink = pickOne(COLOR_WORDS);
  while (ink === word) {
    ink = pickOne(COLOR_WORDS);
  }
  return {
    id: `stroop-${type}-${Date.now()}-${Math.random()}`,
    type,
    label: type === "stroop_read" ? "读词任务" : "辨色任务",
    question: word,
    options: COLOR_WORDS,
    correctAnswer: COLOR_WORDS.indexOf(type === "stroop_read" ? word : ink),
    timeLimit: baseTimeLimit,
    inkColor: COLOR_HEX[ink],
  };
}

function createTaskPair(config: GameConfig): TaskPair {
  const baseTime = DIFFICULTY_CONFIG[config.difficulty].taskTimeLimit;

  if (config.mode === "stroop") {
    return {
      taskA: makeStroopTask("stroop_read", baseTime),
      taskB: makeStroopTask("stroop_color", baseTime),
    };
  }

  const numberTasks = [
    makeOddEvenTask(config.difficulty, baseTime),
    makeGreaterThanTask(config.difficulty, baseTime),
    makeSimpleMathTask(config.difficulty, baseTime),
  ];

  const visualTasks = [makeColorTask(baseTime), makeShapeTask(baseTime), makeFindSameTask(baseTime)];

  return {
    taskA: pickOne(numberTasks),
    taskB: pickOne(visualTasks),
  };
}

export default function DualTaskGame() {
  usePageShare("pages/dual-task/index");

  const [gameStatus, setGameStatus] = useState<GameStatus>("start");
  const [config, setConfig] = useState<GameConfig>({
    mode: "alternating",
    difficulty: "normal",
  });

  const [score, setScore] = useState(0);
  const [streak, setStreak] = useState(0);
  const [maxStreak, setMaxStreak] = useState(0);
  const [correctCount, setCorrectCount] = useState(0);
  const [wrongCount, setWrongCount] = useState(0);
  const [timeoutCount, setTimeoutCount] = useState(0);
  const [bestScore, setBestScore] = useState(0);

  const [pair, setPair] = useState<TaskPair | null>(null);
  const [activeTask, setActiveTask] = useState<TaskSide>("A");
  const [taskAAnswered, setTaskAAnswered] = useState(false);
  const [taskBAnswered, setTaskBAnswered] = useState(false);
  const [taskAAnswer, setTaskAAnswer] = useState<number | null>(null);
  const [taskBAnswer, setTaskBAnswer] = useState<number | null>(null);
  const [questionStartAt, setQuestionStartAt] = useState(0);
  const [taskStartAt, setTaskStartAt] = useState(0);
  const [taskTimeLeftMs, setTaskTimeLeftMs] = useState(0);
  const [sessionTimeLeftMs, setSessionTimeLeftMs] = useState(SESSION_DURATION_MS);

  const [lastFeedback, setLastFeedback] = useState<"correct" | "wrong" | "timeout" | "none">("none");

  const questionTickerRef = useRef<NodeJS.Timeout | null>(null);
  const roundTimerRef = useRef<NodeJS.Timeout | null>(null);
  const sessionTimerRef = useRef<NodeJS.Timeout | null>(null);
  const scoreRef = useRef(0);

  const difficultyMeta = DIFFICULTY_CONFIG[config.difficulty];

  const clearAllTimers = () => {
    if (questionTickerRef.current) {
      clearInterval(questionTickerRef.current);
      questionTickerRef.current = null;
    }
    if (roundTimerRef.current) {
      clearTimeout(roundTimerRef.current);
      roundTimerRef.current = null;
    }
    if (sessionTimerRef.current) {
      clearInterval(sessionTimerRef.current);
      sessionTimerRef.current = null;
    }
  };

  useEffect(() => {
    scoreRef.current = score;
  }, [score]);

  const loadBestScore = useCallback(() => {
    const cached = Taro.getStorageSync(getStorageKey(config.mode));
    setBestScore(cached ? Number(cached) : 0);
  }, [config.mode]);

  useLoad(() => {
    loadBestScore();
  });

  useDidShow(() => {
    loadBestScore();
  });

  useEffect(() => {
    if (gameStatus === "start") {
      loadBestScore();
    }
  }, [gameStatus, loadBestScore]);

  const spawnNextPair = useCallback(() => {
    const nextPair = createTaskPair(config);
    setPair(nextPair);
    setTaskAAnswered(false);
    setTaskBAnswered(false);
    setTaskAAnswer(null);
    setTaskBAnswer(null);
    setActiveTask("A");
    const now = Date.now();
    setQuestionStartAt(now);
    setTaskStartAt(now);
    const nextLimit =
      config.mode === "alternating"
        ? nextPair.taskA.timeLimit
        : Math.max(nextPair.taskA.timeLimit, nextPair.taskB.timeLimit);
    setTaskTimeLeftMs(nextLimit);
    setLastFeedback("none");
  }, [config]);

  const finishGame = useCallback((finalScore?: number) => {
    clearAllTimers();
    const settledScore = Math.min(MAX_POINTS_PER_SESSION, Math.max(0, Math.round(finalScore ?? scoreRef.current)));
    const rewardDifficulty = getRewardDifficulty(config.difficulty);
    const awardedPoints = getAwardedPoints("dual-task", settledScore, rewardDifficulty);
    Taro.setStorageSync(`dual_task_last_${config.mode}`, settledScore);
    addPointsToPet("dual-task", settledScore, rewardDifficulty);
    recordTrainingSession({
      gameId: "dual-task",
      score: settledScore,
      awardedPoints,
      mode: `${config.mode}:${config.difficulty}`,
      difficulty: rewardDifficulty,
      durationSeconds: Math.round((SESSION_DURATION_MS - sessionTimeLeftMs) / 1000),
      outcome: "completed",
    });
    setGameStatus("finished");

    const key = getStorageKey(config.mode);
    const currentBest = Number(Taro.getStorageSync(key) || 0);
    if (settledScore > currentBest) {
      Taro.setStorageSync(key, settledScore);
      setBestScore(settledScore);
    } else {
      setBestScore(currentBest);
    }
  }, [config.difficulty, config.mode, sessionTimeLeftMs]);

  const applyPenalty = useCallback(
    (isTimeout: boolean) => {
      const penalty = isTimeout ? difficultyMeta.timeoutPenalty : WRONG_PENALTY;
      const nextScore = Math.max(0, score - penalty);
      setScore(nextScore);
      setStreak(0);
      if (isTimeout) setTimeoutCount((prev) => prev + 1);
      else setWrongCount((prev) => prev + 1);
      setLastFeedback(isTimeout ? "timeout" : "wrong");
      roundTimerRef.current = setTimeout(() => {
        spawnNextPair();
      }, 420);
    },
    [difficultyMeta.timeoutPenalty, score, spawnNextPair],
  );

  const addCorrectScore = useCallback(() => {
    const pts = DIFFICULTY_POINTS[config.difficulty];
    setScore((prev) => prev + pts);
    setStreak((prev) => {
      const next = prev + 1;
      setMaxStreak((m) => Math.max(m, next));
      return next;
    });
    setCorrectCount((prev) => prev + 1);
    setLastFeedback("correct");
  }, [config.difficulty]);

  const resolveAlternatingTask = useCallback(
    (side: TaskSide, answer: number | null, timeout = false) => {
      if (!pair) return;
      const task = side === "A" ? pair.taskA : pair.taskB;
      const isCorrect = !timeout && answer === task.correctAnswer;

      if (isCorrect) {
        addCorrectScore();
      } else {
        applyPenalty(timeout);
        if (side === "A") {
          setTaskAAnswered(true);
          setTaskAAnswer(answer);
        } else {
          setTaskBAnswered(true);
          setTaskBAnswer(answer);
        }
        return;
      }

      if (side === "A") {
        setTaskAAnswered(true);
        setTaskAAnswer(answer);
        setActiveTask("B");
        setTaskStartAt(Date.now() + difficultyMeta.gapTime);
        setTaskTimeLeftMs(pair.taskB.timeLimit);
        roundTimerRef.current = setTimeout(() => {
          setTaskStartAt(Date.now());
        }, difficultyMeta.gapTime);
      } else {
        setTaskBAnswered(true);
        setTaskBAnswer(answer);
        roundTimerRef.current = setTimeout(() => {
          spawnNextPair();
        }, 420);
      }
    },
    [addCorrectScore, applyPenalty, difficultyMeta.gapTime, pair, spawnNextPair, taskStartAt],
  );

  const resolveSimultaneousPair = useCallback(
    (forceTimeout = false) => {
      if (!pair || taskAAnswered === false || taskBAnswered === false) return;
      const aCorrect = taskAAnswer === pair.taskA.correctAnswer;
      const bCorrect = taskBAnswer === pair.taskB.correctAnswer;

      if (forceTimeout) {
        applyPenalty(true);
      } else if (config.mode === "simultaneous") {
        if (aCorrect && bCorrect) {
          addCorrectScore();
        } else {
          applyPenalty(false);
          return;
        }
      } else {
        if (aCorrect) addCorrectScore();
        else {
          applyPenalty(false);
          return;
        }

        if (bCorrect) addCorrectScore();
        else {
          applyPenalty(false);
          return;
        }
      }

      roundTimerRef.current = setTimeout(() => {
        spawnNextPair();
      }, 420);
    },
    [
      addCorrectScore,
      applyPenalty,
      config.mode,
      pair,
      questionStartAt,
      spawnNextPair,
      taskAAnswer,
      taskAAnswered,
      taskBAnswer,
      taskBAnswered,
    ],
  );

  const handleAnswer = (side: TaskSide, optionIndex: number) => {
    if (gameStatus !== "playing" || !pair) return;

    if (config.mode === "alternating") {
      if ((side === "A" && taskAAnswered) || (side === "B" && taskBAnswered) || side !== activeTask) return;
      resolveAlternatingTask(side, optionIndex, false);
      return;
    }

    const task = side === "A" ? pair.taskA : pair.taskB;
    const isCorrect = optionIndex === task.correctAnswer;

    if (side === "A") {
      if (taskAAnswered) return;
      setTaskAAnswered(true);
      setTaskAAnswer(optionIndex);
      if (!isCorrect) {
        applyPenalty(false);
        return;
      }
    } else {
      if (taskBAnswered) return;
      setTaskBAnswered(true);
      setTaskBAnswer(optionIndex);
      if (!isCorrect) {
        applyPenalty(false);
      }
    }
  };

  useEffect(() => {
    if (gameStatus !== "playing") return;

    if (questionTickerRef.current) clearInterval(questionTickerRef.current);
    questionTickerRef.current = setInterval(() => {
      if (!pair) return;

      const now = Date.now();
      if (config.mode === "alternating") {
        const currentLimit = activeTask === "A" ? pair.taskA.timeLimit : pair.taskB.timeLimit;
        const left = Math.max(0, currentLimit - Math.max(0, now - taskStartAt));
        setTaskTimeLeftMs(left);

        if (activeTask === "A" && !taskAAnswered && now - taskStartAt >= pair.taskA.timeLimit) {
          resolveAlternatingTask("A", null, true);
        }
        if (activeTask === "B" && !taskBAnswered && now - taskStartAt >= pair.taskB.timeLimit) {
          resolveAlternatingTask("B", null, true);
        }
      } else {
        const limit = Math.max(pair.taskA.timeLimit, pair.taskB.timeLimit);
        const left = Math.max(0, limit - (now - questionStartAt));
        setTaskTimeLeftMs(left);

        if (now - questionStartAt >= limit) {
          if (!taskAAnswered) {
            setTaskAAnswered(true);
            setTaskAAnswer(null);
          }
          if (!taskBAnswered) {
            setTaskBAnswered(true);
            setTaskBAnswer(null);
          }
        }
      }
    }, 100);

    return () => {
      if (questionTickerRef.current) {
        clearInterval(questionTickerRef.current);
        questionTickerRef.current = null;
      }
    };
  }, [
    activeTask,
    config.mode,
    gameStatus,
    pair,
    questionStartAt,
    resolveAlternatingTask,
    taskAAnswered,
    taskBAnswered,
    taskStartAt,
  ]);

  useEffect(() => {
    if (gameStatus !== "playing") return undefined;

    if (sessionTimerRef.current) clearInterval(sessionTimerRef.current);
    sessionTimerRef.current = setInterval(() => {
      setSessionTimeLeftMs((current) => {
        if (current <= 1000) {
          finishGame();
          return 0;
        }

        return current - 1000;
      });
    }, 1000);

    return () => {
      if (sessionTimerRef.current) {
        clearInterval(sessionTimerRef.current);
        sessionTimerRef.current = null;
      }
    };
  }, [finishGame, gameStatus]);

  useEffect(() => {
    if (gameStatus !== "playing" || config.mode === "alternating") return;
    if (lastFeedback !== "none") return;
    if (taskAAnswered && taskBAnswered) {
      const forcedTimeout = taskAAnswer === null || taskBAnswer === null;
      resolveSimultaneousPair(forcedTimeout);
    }
  }, [config.mode, gameStatus, lastFeedback, resolveSimultaneousPair, taskAAnswer, taskAAnswered, taskBAnswer, taskBAnswered]);

  useEffect(() => {
    return () => {
      clearAllTimers();
    };
  }, []);

  const startGame = () => {
    clearAllTimers();
    setGameStatus("playing");
    setScore(0);
    setSessionTimeLeftMs(SESSION_DURATION_MS);
    setStreak(0);
    setMaxStreak(0);
    setCorrectCount(0);
    setWrongCount(0);
    setTimeoutCount(0);
    spawnNextPair();
  };

  const restartGame = () => {
    setGameStatus("start");
    loadBestScore();
  };

  const accuracy = useMemo(() => {
    const total = correctCount + wrongCount + timeoutCount;
    if (!total) return 0;
    return Math.round((correctCount / total) * 100);
  }, [correctCount, timeoutCount, wrongCount]);

  const currentTaskLimit = useMemo(() => {
    if (!pair) return 1;
    if (config.mode === "alternating") {
      return activeTask === "A" ? pair.taskA.timeLimit : pair.taskB.timeLimit;
    }
    return Math.max(pair.taskA.timeLimit, pair.taskB.timeLimit);
  }, [activeTask, config.mode, pair]);

  const taskProgress = useMemo(() => {
    if (!currentTaskLimit) return 0;
    return Math.min(1, Math.max(0, taskTimeLeftMs / currentTaskLimit));
  }, [currentTaskLimit, taskTimeLeftMs]);

  const renderTask = (task: Task, side: TaskSide) => {
    const answered = side === "A" ? taskAAnswered : taskBAnswered;
    const answer = side === "A" ? taskAAnswer : taskBAnswer;
    const active = config.mode === "alternating" ? activeTask === side : true;
    const showDisabled = config.mode === "alternating" && !active;

    return (
      <View
        className={`task-card ${active ? "task-card-active" : "task-card-inactive"}`}
        key={`${task.id}-${side}`}
      >
        <View className="task-head">
          <View className="task-head-main">
            <Text className="task-tag">{side === "A" ? "任务A" : "任务B"}</Text>
            <Text className="task-label">{task.label}</Text>
          </View>
          <Text className="task-status">{active ? "现在作答" : "即将开始"}</Text>
        </View>

        <View className="task-card-body">
          <Text className="task-prompt">{task.type.startsWith("stroop") ? "判断目标" : "题面内容"}</Text>
          <Text
            className={`task-question ${task.type.startsWith("stroop") ? "task-question-stroop" : ""}`}
            style={task.inkColor ? { color: task.inkColor } : {}}
          >
            {task.question}
          </Text>

          <View className="options-grid">
            {task.options.map((option, idx) => {
              const isSelected = answer === idx;
              const isCorrect = answered && idx === task.correctAnswer;
              const wrongSelected = answered && isSelected && !isCorrect;

              return (
                <View
                  key={`${task.id}-opt-${option}-${idx}`}
                  className={`option-btn ${
                    isCorrect ? "option-correct" : wrongSelected ? "option-wrong" : ""
                  } ${isSelected ? "option-selected" : ""} ${showDisabled ? "option-disabled" : ""}`}
                  onClick={() => handleAnswer(side, idx)}
                >
                  <Text className="option-index">{idx + 1}</Text>
                  <Text className="option-text">{option}</Text>
                </View>
              );
            })}
          </View>
        </View>
        {showDisabled && <Text className="task-waiting-text">等待另一任务完成后切换</Text>}
      </View>
    );
  };

  return (
    <View className="dual-task-page">
      {gameStatus === "start" && (
        <View className="start-screen">
          <View className="hero-card">
            <Text className="hero-kicker">双线专注训练</Text>
            <Text className="hero-icon">🧩</Text>
            <Text className="hero-title">双重任务</Text>
            <Text className="hero-subtitle">切换注意力并保持稳定准确率。</Text>
            <View className="best-chip">
              <Text className="best-chip-text">
                {MODE_CONFIG[config.mode].title} 最高分: {bestScore}
              </Text>
            </View>
            <View className="hero-metrics">
              <View className="hero-metric">
                <Text className="hero-metric-value">{difficultyMeta.taskTimeLimit / 1000}s</Text>
                <Text className="hero-metric-label">单题时限</Text>
              </View>
              <View className="hero-metric">
                <Text className="hero-metric-value">60s</Text>
                <Text className="hero-metric-label">当前规则</Text>
              </View>
              <View className="hero-metric">
                <Text className="hero-metric-value">{difficultyMeta.label}</Text>
                <Text className="hero-metric-label">当前难度</Text>
              </View>
            </View>
          </View>

          <View className="panel-grid">
            <View className="panel panel-primary">
              <Text className="panel-title">模式</Text>
              <View className="chip-row">
                {(Object.keys(MODE_CONFIG) as Mode[]).map((mode) => (
                  <View
                    key={mode}
                    className={`chip ${config.mode === mode ? "chip-active" : ""}`}
                    onClick={() => setConfig((prev) => ({ ...prev, mode }))}
                  >
                    <Text className="chip-text">
                      {MODE_CONFIG[mode].icon} {MODE_CONFIG[mode].title}
                    </Text>
                  </View>
                ))}
              </View>
              <Text className="panel-hint">{MODE_HINTS[config.mode]}</Text>
            </View>

            <View className="panel">
              <Text className="panel-title">难度</Text>
              <View className="chip-row">
                {(Object.keys(DIFFICULTY_CONFIG) as Difficulty[]).map((difficulty) => (
                  <View
                    key={difficulty}
                    className={`chip ${config.difficulty === difficulty ? "chip-active" : ""}`}
                    onClick={() => setConfig((prev) => ({ ...prev, difficulty }))}
                  >
                    <Text className="chip-text">{DIFFICULTY_CONFIG[difficulty].label}</Text>
                    <Text className="chip-meta">
                      {DIFFICULTY_CONFIG[difficulty].taskTimeLimit / 1000}s · 积分{getTrainingDifficultyLabel(getRewardDifficulty(difficulty))}
                    </Text>
                  </View>
                ))}
              </View>
            </View>
          </View>

          <View className="floating-start-action">
            <View className="primary-button" onClick={startGame}>
              <Text className="button-text">开始挑战</Text>
            </View>
          </View>
          <View className="floating-start-spacer" />
        </View>
      )}

      {gameStatus === "playing" && pair && (
        <View className="game-screen">
          <View className="play-shell">
            <View className="battle-header">
              <View className="mode-pill">
                <Text className="mode-pill-text">
                  {MODE_CONFIG[config.mode].icon} {MODE_CONFIG[config.mode].title}
                </Text>
              </View>
              <Text className="mode-sub">
                难度 {DIFFICULTY_CONFIG[config.difficulty].label} · 本题剩余 {(taskTimeLeftMs / 1000).toFixed(1)}s
              </Text>
              <View className="task-progress-track">
                <View className="task-progress-fill" style={{ width: `${taskProgress * 100}%` }} />
              </View>
            </View>

            <View className="top-bar">
              <View className="stat-cell">
                <Text className="stat-label">⏱️ 剩余</Text>
                <Text className="stat-value">{Math.ceil(sessionTimeLeftMs / 1000)}s</Text>
              </View>
              <View className="stat-cell">
                <Text className="stat-label">🏆 得分</Text>
                <Text className="stat-value">{score} 分</Text>
              </View>
              <View className="stat-cell">
                <Text className="stat-label">🔥 连击</Text>
                <Text className="stat-value">x{streak}</Text>
              </View>
            </View>

            <View className={`feedback feedback-${lastFeedback}`}>
              <Text className="feedback-text">
                {lastFeedback === "correct"
                  ? "✅ 命中"
                  : lastFeedback === "wrong"
                    ? "❌ 错误"
                    : lastFeedback === "timeout"
                      ? "⌛ 超时"
                      : "保持稳定节奏，优先点大按钮"}
              </Text>
            </View>

            <View className="task-stack">
              {renderTask(pair.taskA, "A")}
              {renderTask(pair.taskB, "B")}
            </View>
          </View>
        </View>
      )}

      {gameStatus === "finished" && (
        <View className="result-screen">
          <View className="result-card">
            <Text className="result-title">本局成绩</Text>
            <Text className="result-score">{score}</Text>
            <Text className="result-desc">答对 {correctCount} 题 · 正确率 {accuracy}% · 最高连击 {maxStreak}</Text>
            <Text className="result-desc">
              {DIFFICULTY_CONFIG[config.difficulty].label} · {MODE_CONFIG[config.mode].title} · 积分{getTrainingDifficultyLabel(getRewardDifficulty(config.difficulty))}
            </Text>
            <Text className="result-desc">
              获得 {getAwardedPoints("dual-task", Math.min(MAX_POINTS_PER_SESSION, Math.max(0, Math.round(score))), getRewardDifficulty(config.difficulty))} 积分
            </Text>
            <Text className="result-desc">
              历史最高 {bestScore}
              {score > 0 && score >= bestScore ? <Text className="result-highlight">，刷新纪录</Text> : null}
            </Text>
          </View>

          <View className="result-actions">
            <View className="primary-button" onClick={startGame}>
              <Text className="button-text">再来一局</Text>
            </View>
            <View className="secondary-button" onClick={() => setGameStatus("start")}>
              <Text className="button-text">返回开始页</Text>
            </View>
            <View className="secondary-button" onClick={() => Taro.reLaunch({ url: '/pages/index/index' })}>
              <Text className="button-text">返回游戏主页</Text>
            </View>
          </View>
        </View>
      )}
    </View>
  );
}
