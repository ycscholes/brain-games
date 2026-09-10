import { Text, View } from "@tarojs/components";
import Taro from "@tarojs/taro";
import { abandonGameRun } from "../../utils/gameFlowSession";
import { goToGameStart } from "../../utils/gameRoute";
import type { TrainingGameId } from "../../domain/training/types";

export interface GameRouteBackProps {
  gameId: TrainingGameId;
  runId: string;
  onAbandon?: () => void;
}

export default function GameRouteBack({ gameId, runId, onAbandon }: GameRouteBackProps) {
  const handleBack = () => {
    onAbandon?.();
    if (!onAbandon) abandonGameRun(gameId, runId);
    void Taro.navigateBack().catch(() => goToGameStart(gameId));
  };

  return (
    <View className="game-route-back" onClick={handleBack}>
      <Text className="game-route-back-icon">‹</Text>
      <Text className="game-route-back-text">返回</Text>
    </View>
  );
}
