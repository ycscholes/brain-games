import { Input, View, Text } from "@tarojs/components";
import Taro, { useDidShow } from "@tarojs/taro";
import { useState } from "react";
import {
  ALL_GAME_ITEMS,
  GAME_CATEGORIES,
  type GameCatalogItem,
} from "../../config/gameCatalog";
import { readTrainingSummary } from "../../utils/trainingStorage";
import { usePageShare } from "../../utils/share";
import { playTap } from "../../services/audio/audioFeedbackService";
import "./index.scss";

interface GameListItem extends GameCatalogItem {
  summary: {
    best: number;
    recent: number;
    played: boolean;
    totalSessions: number;
  };
}

export default function AllGames() {
  usePageShare("pages/all-games/index");

  const [games, setGames] = useState<GameListItem[]>([]);
  const [searchQuery, setSearchQuery] = useState("");

  useDidShow(() => {
    setGames(ALL_GAME_ITEMS.map((game) => {
      const summary = readTrainingSummary(game.id);
      return {
        ...game,
        summary: {
          best: summary.best,
          recent: summary.recent,
          played: summary.played,
          totalSessions: summary.totalSessions,
        },
      };
    }));
  });

  const navigateTo = (url: string) => {
    playTap();
    Taro.navigateTo({ url });
  };

  const normalizedSearchQuery = searchQuery.trim().toLowerCase();
  const visibleGames = normalizedSearchQuery
    ? games.filter((game) => {
        const categoryTitle = GAME_CATEGORIES.find((category) => category.id === game.category)?.title ?? "";
        return `${game.title} ${game.badge} ${game.skill} ${game.duration} ${game.level} ${categoryTitle}`
          .toLowerCase()
          .includes(normalizedSearchQuery);
      })
    : games;
  const groupedGames = GAME_CATEGORIES.map((category) => ({
    ...category,
    games: visibleGames.filter((game) => game.category === category.id),
  })).filter((category) => category.games.length > 0);

  return (
    <View className="all-games-page">
      <View className="all-games-shell">
        <View className="all-games-header">
          <View className="back-button" onClick={() => Taro.navigateBack()}>
            <Text className="back-icon">‹</Text>
          </View>
          <View className="header-copy">
            <Text className="page-eyebrow">All Games</Text>
            <Text className="page-title">全部游戏</Text>
          </View>
        </View>

        <View className="game-search-panel">
          <Input
            className="game-search-input"
            value={searchQuery}
            placeholder="搜索游戏、能力或时长"
            confirmType="search"
            onInput={(event) => setSearchQuery(String(event.detail.value ?? ""))}
          />
          {searchQuery ? (
            <View className="game-search-clear" onClick={() => setSearchQuery("")}>
              <Text className="game-search-clear-text">清除</Text>
            </View>
          ) : null}
        </View>

        <View className="all-games-summary">
          <Text className="summary-title">{ALL_GAME_ITEMS.length} 项训练</Text>
          <Text className="summary-copy">热门、记忆、专注与综合闯关都在这里。</Text>
        </View>

        <View className="game-category-list">
          {groupedGames.map((category) => (
            <View key={category.id} className="game-category-section">
              <View className="game-category-header">
                <Text className="game-category-title">{category.title}</Text>
                <Text className="game-category-count">{category.games.length} 项</Text>
              </View>

              <View className="game-list">
                {category.games.map((game) => (
                  <View
                    key={game.id}
                    className={`game-card ${game.cardClass}`}
                    onClick={() => navigateTo(game.url)}
                  >
                    <View className="game-copy">
                      <Text className="game-title">{game.title}</Text>
                    </View>

                    <View className="game-meta">
                      <View className="game-badge-row">
                        <Text className="game-badge">{game.badge}</Text>
                        <Text className={`game-level game-level-${game.level === "进阶" ? "advanced" : game.level === "标准" ? "standard" : "easy"}`}>
                          {game.level}
                        </Text>
                      </View>
                      <Text className="game-detail-line">{game.duration} · {game.skill}</Text>
                      {game.showBestScore ? (
                        <>
                          <Text className="score-line">{`最高分：${game.summary.best}`}</Text>
                          <Text className="score-line score-line-secondary">
                            {game.summary.played
                              ? `最近 ${game.summary.recent} · 共 ${game.summary.totalSessions} 次`
                              : "还没有新的统一记录"}
                          </Text>
                        </>
                      ) : (
                        <Text className="score-line score-line-secondary">综合模式不显示最高分</Text>
                      )}
                    </View>

                  </View>
                ))}
              </View>
            </View>
          ))}
          {groupedGames.length === 0 && (
            <View className="game-search-empty">
              <Text className="game-search-empty-title">没有找到游戏</Text>
              <Text className="game-search-empty-copy">换个关键词试试</Text>
            </View>
          )}
        </View>
      </View>
    </View>
  );
}
