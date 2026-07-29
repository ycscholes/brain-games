export interface RockPaperScissorsHighScore {
  score: number;
  achievedAt: string;
}

export function readRockPaperScissorsHighScore(raw: string): RockPaperScissorsHighScore | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as Partial<RockPaperScissorsHighScore>;
    return typeof parsed.score === "number" && Number.isFinite(parsed.score) && typeof parsed.achievedAt === "string"
      ? { score: parsed.score, achievedAt: parsed.achievedAt }
      : null;
  } catch {
    return null;
  }
}
