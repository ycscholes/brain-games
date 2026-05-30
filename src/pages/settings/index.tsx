import { View, Text, Switch } from "@tarojs/components";
import Taro, { useDidShow } from "@tarojs/taro";
import { useCallback, useState } from "react";
import { readCloudSyncMeta } from "../../services/user-data/local/cloudSyncMetaStore";
import { useCloudSyncStatusChange } from "../../services/user-data/hooks/useCloudSyncStatusChange";
import { useUserDataChange } from "../../services/user-data/hooks/useUserDataChange";
import { getCloudSyncStatusText } from "../../services/user-data/sync/userDataSyncService";
import type { CloudSyncMeta } from "../../services/user-data/types";
import { readPetData } from "../../utils/petStorage";
import {
  clearProductData,
  readAppSettings,
  readDashboardStats,
  saveAppSettings,
} from "../../utils/trainingStorage";
import { usePageShare } from "../../utils/share";
import "./index.scss";

interface DashboardSnapshot {
  todaySessions: number;
  totalSessions: number;
  streakDays: number;
  activeDaysLast7: number;
  totalAwardedPoints: number;
}

export default function SettingsPage() {
  usePageShare("pages/settings/index");

  const [settings, setSettings] = useState(() => readAppSettings());
  const [dashboard, setDashboard] = useState<DashboardSnapshot>(() => readDashboardStats());
  const [petCount, setPetCount] = useState(0);
  const [cloudMeta, setCloudMeta] = useState<CloudSyncMeta>(() => readCloudSyncMeta());

  const refresh = useCallback(() => {
    setSettings(readAppSettings());
    setDashboard(readDashboardStats());
    setPetCount(readPetData().pets.length);
    setCloudMeta(readCloudSyncMeta());
  }, []);

  useDidShow(() => {
    refresh();
  });

  useUserDataChange(refresh);
  useCloudSyncStatusChange(refresh);

  const handleToggle = (field: "soundEnabled" | "vibrationEnabled" | "reducedMotion") => {
    const nextSettings = saveAppSettings({
      [field]: !settings[field],
      privacyAccepted: true,
    });
    setSettings(nextSettings);
  };

  const handleAcceptPrivacy = () => {
    const nextSettings = saveAppSettings({ privacyAccepted: true });
    setSettings(nextSettings);
    Taro.showToast({ title: "已记录隐私确认", icon: "success" });
  };

  const handleResetData = async () => {
    try {
      const result = await Taro.showModal({
        title: "清除本地数据",
        content: "将删除训练记录、宠物存档、历史最高分和设置，且无法恢复。确认继续吗？",
        confirmColor: "#dc2626",
      });

      if (!result.confirm) {
        return;
      }

      clearProductData();
      Taro.showToast({ title: "本地数据已清除", icon: "success" });
      Taro.reLaunch({ url: "/pages/index/index" });
    } catch {
      Taro.showToast({ title: "清除失败，请稍后重试", icon: "none" });
    }
  };

  return (
    <View className="settings-page">
      <View className="settings-hero">
        <Text className="settings-eyebrow">Settings & Help</Text>
        <Text className="settings-title">交付就绪面板</Text>
        <Text className="settings-copy">
          集中查看本地数据边界、体验开关、帮助说明和重置入口。
        </Text>
      </View>

      <View className="settings-card">
        <Text className="card-title">当前概览</Text>
        <View className="stat-grid">
          <View className="stat-item">
            <Text className="stat-value">{dashboard.totalSessions}</Text>
            <Text className="stat-label">累计训练</Text>
          </View>
          <View className="stat-item">
            <Text className="stat-value">{dashboard.todaySessions}</Text>
            <Text className="stat-label">今日训练</Text>
          </View>
          <View className="stat-item">
            <Text className="stat-value">{dashboard.streakDays}</Text>
            <Text className="stat-label">连续天数</Text>
          </View>
          <View className="stat-item">
            <Text className="stat-value">{petCount}</Text>
            <Text className="stat-label">宠物存档</Text>
          </View>
        </View>
      </View>

      <View className="settings-card">
        <Text className="card-title">体验设置</Text>
        <View className="setting-row">
          <View>
            <Text className="setting-title">音效反馈</Text>
            <Text className="setting-desc">为后续统一接入声音和结算提示预留开关。</Text>
          </View>
          <Switch checked={settings.soundEnabled} onChange={() => handleToggle("soundEnabled")} color="#4f46e5" />
        </View>
        <View className="setting-row">
          <View>
            <Text className="setting-title">震动反馈</Text>
            <Text className="setting-desc">用于答题正确、错误和关键结算时的轻触反馈。</Text>
          </View>
          <Switch
            checked={settings.vibrationEnabled}
            onChange={() => handleToggle("vibrationEnabled")}
            color="#4f46e5"
          />
        </View>
        <View className="setting-row">
          <View>
            <Text className="setting-title">减少动效</Text>
            <Text className="setting-desc">在低性能设备或长时间训练时降低动画负担。</Text>
          </View>
          <Switch checked={settings.reducedMotion} onChange={() => handleToggle("reducedMotion")} color="#4f46e5" />
        </View>
      </View>

      <View className="settings-card">
        <Text className="card-title">数据与隐私</Text>
        <Text className="paragraph">
          当前版本采用本地优先 + 云端备份，核心数据会在后台自动同步到微信云开发，离线时仍以本地数据为准。
        </Text>
        <Text className="paragraph">
          清除本地数据不会自动删除云端备份；如云端已有快照，后续重新进入应用时可能自动恢复核心进度。
        </Text>
        <View className={`privacy-badge ${cloudMeta.cloudEnabled ? "privacy-badge-accepted" : ""}`}>
          <Text className="privacy-badge-text">{getCloudSyncStatusText(cloudMeta)}</Text>
        </View>
        {cloudMeta.openid ? (
          <Text className="paragraph">云端身份已建立：{cloudMeta.openid}</Text>
        ) : null}
        <View className={`privacy-badge ${settings.privacyAccepted ? "privacy-badge-accepted" : ""}`}>
          <Text className="privacy-badge-text">
            {settings.privacyAccepted ? "已确认本地数据说明" : "尚未确认本地数据说明"}
          </Text>
        </View>
        {!settings.privacyAccepted ? (
          <View className="primary-action" onClick={handleAcceptPrivacy}>
            <Text className="primary-action-text">确认并继续使用</Text>
          </View>
        ) : null}
      </View>

      <View className="settings-card">
        <Text className="card-title">帮助与提审提醒</Text>
        <Text className="bullet-line">1. 首次上线前，补齐隐私政策、用户协议、反馈入口和版本号展示。</Text>
        <Text className="bullet-line">2. 真机验收至少覆盖切后台恢复、倒计时稳定性和低性能设备动画。</Text>
        <Text className="bullet-line">3. 训练记录与宠物积分都依赖本地存储，清理小程序缓存会导致数据丢失。</Text>
      </View>

      <View className="settings-card danger-card">
        <Text className="card-title">危险操作</Text>
        <Text className="paragraph">
          清除后会删除训练记录、宠物数据、历史成绩和设置。这是当前版本唯一的数据删除入口。
        </Text>
        <View className="danger-action" onClick={handleResetData}>
          <Text className="danger-action-text">清除全部本地数据</Text>
        </View>
      </View>
    </View>
  );
}
