import type { TrainingDifficulty } from "../../domain/training/types";

export type MultipleObjectTrackingPhase = "preview" | "tracking" | "selecting" | "finished";

export interface BoardSize {
  width: number;
  height: number;
}

export interface MovingCircle {
  id: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  isTarget: boolean;
}

export const STORAGE_KEY_PREFIX = "mot_best";
export const INITIAL_TARGET_COUNT: Record<TrainingDifficulty, number> = {
  normal: 2,
  hard: 3,
};
export const MAX_TARGET_COUNT = 4;
export const PREVIEW_DURATION: Record<TrainingDifficulty, number> = {
  normal: 1200,
  hard: 900,
};
export const TRACKING_DURATION: Record<TrainingDifficulty, number> = {
  normal: 5000,
  hard: 5500,
};
export const BASE_SPEED = 2.15;
export const HARD_SPEED_BONUS = 0.35;
export const SPEED_STEP = 0.28;
export const CIRCLE_SIZE = 52;
export const CIRCLE_RADIUS = CIRCLE_SIZE / 2;
export const CIRCLE_GAP = 8;

export const clamp = (value: number, min: number, max: number) =>
  Math.min(Math.max(value, min), max);

export const getBoardSize = (windowWidth: number): BoardSize => {
  const width = clamp(windowWidth - 48, 300, 420);
  return { width, height: Math.round(width * 0.74) };
};

const shuffle = <T>(list: T[]): T[] => {
  const next = [...list];
  for (let index = next.length - 1; index > 0; index -= 1) {
    const randomIndex = Math.floor(Math.random() * (index + 1));
    [next[index], next[randomIndex]] = [next[randomIndex], next[index]];
  }
  return next;
};

const randomBetween = (min: number, max: number) => Math.random() * (max - min) + min;

const createVelocity = (speed: number) => {
  const angle = Math.random() * Math.PI * 2;
  const magnitude = speed * randomBetween(0.92, 1.12);
  return { vx: Math.cos(angle) * magnitude, vy: Math.sin(angle) * magnitude };
};

export const buildCircles = (
  targetCount: number,
  speed: number,
  boardSize: BoardSize,
): MovingCircle[] => {
  const totalCount = clamp(targetCount + 4, 6, 8);
  const targetIndexSet = new Set(
    shuffle(Array.from({ length: totalCount }, (_, index) => index)).slice(0, targetCount),
  );
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

export const stepCircles = (
  currentCircles: MovingCircle[],
  dt: number,
  boardSize: BoardSize,
): MovingCircle[] => {
  const nextCircles = currentCircles.map((circle) => {
    const nextCircle = { ...circle, x: circle.x + circle.vx * dt, y: circle.y + circle.vy * dt };

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
      if (distance >= minDistance) continue;

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
