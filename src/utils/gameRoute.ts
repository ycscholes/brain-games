import Taro, { getCurrentInstance } from "@tarojs/taro";
import type { TrainingGameId } from "../domain/training/types";

export type GameRouteParams = Record<string, string>;

export type GameRunRouteStatus = "active" | "settled" | "abandoned";

export function shouldRedirectInvalidGameRun(
  runId: string,
  status: GameRunRouteStatus | undefined,
  allowSettled = false,
) {
  return !runId || !status || (status !== "active" && !allowSettled);
}

export function readGameRouteParams(): GameRouteParams {
  const params = getCurrentInstance().router?.params ?? {};
  return Object.fromEntries(
    Object.entries(params).filter(([, value]) => typeof value === "string") as Array<
      [string, string]
    >,
  );
}

export function buildGameRouteQuery(
  runId: string,
  params: GameRouteParams = readGameRouteParams(),
) {
  return Object.entries({ ...params, runId })
    .filter(([, value]) => typeof value === "string")
    .map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(value)}`)
    .join("&");
}

export function getGamePageUrl(
  gameId: TrainingGameId,
  page: "index" | "play" | "result",
  query = "",
) {
  return `/pages/${gameId}/${page}${query ? `?${query}` : ""}`;
}

export function goToGameStart(gameId: TrainingGameId) {
  return Taro.redirectTo({ url: getGamePageUrl(gameId, "index") });
}

export function goToGamePlay(gameId: TrainingGameId, runId: string, params?: GameRouteParams) {
  return Taro.navigateTo({
    url: getGamePageUrl(gameId, "play", buildGameRouteQuery(runId, params)),
  });
}

export function replaceWithGamePlay(
  gameId: TrainingGameId,
  runId: string,
  params?: GameRouteParams,
) {
  return Taro.redirectTo({
    url: getGamePageUrl(gameId, "play", buildGameRouteQuery(runId, params)),
  });
}

export function goToGameResult(gameId: TrainingGameId, runId: string) {
  return Taro.redirectTo({
    url: getGamePageUrl(gameId, "result", `runId=${encodeURIComponent(runId)}`),
  });
}

export function goBackToGameStart(gameId: TrainingGameId) {
  return Taro.navigateBack().catch(() => goToGameStart(gameId));
}
