import { useCallback, useEffect, useMemo, useState } from "react";
import { Image, Input, Text, View } from "@tarojs/components";
import Taro from "@tarojs/taro";
import {
  adoptCustomPet,
  cancelCustomPet,
  chooseAndSubmitCustomPet,
  getCustomPetStatus,
  rerollCustomPet,
  resolveCustomPetSpriteUrls,
} from "../../../../services/custom-pet/customPetService";
import type {
  CustomPetMoodUrls,
  CustomPetTask,
} from "../../../../services/custom-pet/types";
import type { PetSpriteMood } from "../PetSprite/types";
import "./index.scss";

const POLL_MS = 4000;
const MOODS: Array<{ id: PetSpriteMood; label: string }> = [
  { id: "idle", label: "日常" },
  { id: "feed", label: "进食" },
  { id: "cuddle", label: "互动" },
  { id: "hungry", label: "饥饿" },
];

const STATUS_TEXT: Record<string, string> = {
  uploaded: "准备开始",
  analyzing: "正在识别宠物",
  generating_idle: "正在绘制默认形象",
  generating_variants: "正在生成互动状态",
  validating: "正在检查结果",
  rerolling: "正在重新绘制",
  failed: "本次生成未完成，积分已退回",
};

interface CustomPetFlowProps {
  onClose: () => void;
  onAdopted: () => void;
}

export default function CustomPetFlow({ onClose, onAdopted }: CustomPetFlowProps) {
  const [task, setTask] = useState<CustomPetTask | null>(null);
  const [urls, setUrls] = useState<CustomPetMoodUrls>({});
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const isPreview = task?.status === "preview_ready";
  const isQuotaWaiting = task?.errorCategory === "quota" && task.status !== "failed";

  const refresh = useCallback(async () => {
    try {
      const status = await getCustomPetStatus();
      setTask(status.task);
      if (status.task?.status === "preview_ready") {
        setUrls(await resolveCustomPetSpriteUrls(status.task.jobId));
      }
    } catch {
      // A temporary status refresh error is retried by the poller.
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  useEffect(() => {
    if (!task || ["preview_ready", "adopted", "cancelled", "failed", "deleted"].includes(task.status)) {
      return undefined;
    }
    const timer = setInterval(() => {
      void refresh();
    }, POLL_MS);
    return () => clearInterval(timer);
  }, [refresh, task]);

  const progress = useMemo(() => {
    const steps = ["uploaded", "analyzing", "generating_idle", "generating_variants", "validating"];
    const index = Math.max(0, steps.indexOf(task?.status || "uploaded"));
    return Math.min(95, 10 + index * 20);
  }, [task?.status]);

  const activeStatusText = isQuotaWaiting
    ? "图片生成额度繁忙，已排队自动重试"
    : STATUS_TEXT[task?.status || ""] || "正在处理";
  const activeStatusCopy = isQuotaWaiting
    ? "可以离开本页，额度恢复后云端会继续生成。"
    : "可以离开本页，生成会在云端继续。";

  const handleSubmit = useCallback(async () => {
    setBusy(true);
    try {
      setTask(await chooseAndSubmitCustomPet());
      Taro.showToast({ title: "已提交，可稍后回来查看", icon: "none" });
    } catch (error) {
      Taro.showToast({
        title: error instanceof Error ? error.message : "提交失败",
        icon: "none",
      });
    } finally {
      setBusy(false);
    }
  }, []);

  const handleReroll = useCallback(async () => {
    if (!task) return;
    setBusy(true);
    try {
      setUrls({});
      setTask(await rerollCustomPet(task.jobId));
    } catch (error) {
      Taro.showToast({
        title: error instanceof Error ? error.message : "重做失败",
        icon: "none",
      });
    } finally {
      setBusy(false);
    }
  }, [task]);

  const handleAdopt = useCallback(async () => {
    if (!task || !name.trim()) {
      Taro.showToast({ title: "请给宠物起个名字", icon: "none" });
      return;
    }
    setBusy(true);
    try {
      await adoptCustomPet(task.jobId, name.trim());
      Taro.showToast({ title: "自定义宠物已加入小院", icon: "success" });
      onAdopted();
    } catch (error) {
      Taro.showToast({
        title: error instanceof Error ? error.message : "领养失败",
        icon: "none",
      });
    } finally {
      setBusy(false);
    }
  }, [name, onAdopted, task]);

  const handleCancel = useCallback(async () => {
    if (!task) {
      onClose();
      return;
    }
    const confirmed = await Taro.showModal({
      title: "放弃本次生成？",
      content: "300 积分会退回；之后仍可重新上传图片生成。",
      confirmText: "确认放弃",
    });
    if (!confirmed.confirm) return;
    setBusy(true);
    try {
      await cancelCustomPet(task.jobId);
      onClose();
    } catch (error) {
      Taro.showToast({
        title: error instanceof Error ? error.message : "操作失败",
        icon: "none",
      });
    } finally {
      setBusy(false);
    }
  }, [onClose, task]);

  return (
    <View className="dialog-layer custom-pet-layer">
      <View className="dialog-backdrop" onClick={onClose} />
      <View className="game-dialog custom-pet-dialog">
        <View className="dialog-header">
          <View>
            <Text className="dialog-title">AI 自定义宠物</Text>
            <Text className="dialog-subtitle">上传一张单只宠物图片 · 300 积分</Text>
          </View>
          <View className="dialog-close" onClick={onClose}>
            <Text className="dialog-close-text">×</Text>
          </View>
        </View>

        {!task ? (
          <View className="custom-pet-intro">
            <Text className="custom-pet-copy">
              每次生成包含四种状态和一次免费整套重做。原图与结果仅本人可在应用内访问。
            </Text>
            <View className={`stage-button confirm-button ${busy ? "button-disabled" : ""}`} onClick={handleSubmit}>
              <Text className="stage-button-text">{busy ? "正在上传" : "选择图片并生成"}</Text>
            </View>
          </View>
        ) : isPreview ? (
          <View className="custom-pet-preview">
            <View className="custom-pet-grid">
              {MOODS.map((mood) => (
                <View className="custom-pet-tile" key={mood.id}>
                  {(() => {
                    const imageUrl = urls[mood.id];
                    return imageUrl ? (
                    <Image className="custom-pet-image" src={imageUrl} mode="aspectFit" />
                  ) : (
                    <View className="custom-pet-image-placeholder" />
                    );
                  })()}
                  <Text className="custom-pet-tile-label">{mood.label}</Text>
                  <Text className="custom-pet-ai-label">AI 生成</Text>
                </View>
              ))}
            </View>
            <Input
              className="name-input"
              placeholder="给新伙伴起个名字"
              value={name}
              maxlength={10}
              onInput={(event) => setName(event.detail.value)}
            />
            <View className="custom-pet-actions">
              <View
                className={`stage-button custom-pet-secondary ${task.rerollUsed || busy ? "button-disabled" : ""}`}
                onClick={task.rerollUsed || busy ? undefined : handleReroll}
              >
                <Text className="stage-button-text">{task.rerollUsed ? "已使用重做" : "免费重做"}</Text>
              </View>
              <View className={`stage-button confirm-button ${busy ? "button-disabled" : ""}`} onClick={handleAdopt}>
                <Text className="stage-button-text">确认领养</Text>
              </View>
            </View>
            <View className="custom-pet-cancel" onClick={handleCancel}>
              <Text>放弃结果并退回积分</Text>
            </View>
          </View>
        ) : task.status === "adopted" ? (
          <View className="custom-pet-progress">
            <Text className="custom-pet-status">你的 AI 宠物已经加入小院</Text>
            <View className="stage-button custom-pet-secondary" onClick={onClose}>
              <Text className="stage-button-text">关闭</Text>
            </View>
          </View>
        ) : task.status === "failed" || task.status === "cancelled" ? (
          <View className="custom-pet-progress">
            <Text className="custom-pet-status">{STATUS_TEXT.failed}</Text>
            <View
              className="stage-button custom-pet-secondary"
              onClick={handleSubmit}
            >
              <Text className="stage-button-text">重新选择图片</Text>
            </View>
          </View>
        ) : (
          <View className="custom-pet-progress">
            <Text className="custom-pet-status">{activeStatusText}</Text>
            <View className="custom-pet-progress-track">
              <View className="custom-pet-progress-fill" style={{ width: `${progress}%` }} />
            </View>
            <Text className="custom-pet-copy">{activeStatusCopy}</Text>
            <View className="custom-pet-cancel" onClick={handleCancel}>
              <Text>取消并退回积分</Text>
            </View>
          </View>
        )}
      </View>
    </View>
  );
}
