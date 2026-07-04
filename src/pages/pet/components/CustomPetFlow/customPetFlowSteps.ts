import type {
  CustomPetTaskStatus,
  CustomPetUploadStage,
} from "../../../../services/custom-pet/types";

type FlowStageId =
  | CustomPetUploadStage
  | "uploaded"
  | "analyzing"
  | "generating_idle"
  | "generating_variants"
  | "validating"
  | "preview_ready";

export type CustomPetFlowStep = {
  id: FlowStageId;
  label: string;
};

export type CustomPetStepState = "done" | "active" | "pending";

export const CUSTOM_PET_FLOW_STEPS: CustomPetFlowStep[] = [
  { id: "choosing", label: "选择图片" },
  { id: "uploading", label: "上传原图" },
  { id: "analyzing", label: "识别宠物" },
  { id: "generating_idle", label: "绘制形象" },
  { id: "generating_variants", label: "生成动作" },
  { id: "validating", label: "质量检查" },
  { id: "preview_ready", label: "确认领养" },
];

const LOCAL_STAGE_TO_FLOW_STAGE: Record<CustomPetUploadStage, FlowStageId> = {
  syncing: "choosing",
  preparing: "choosing",
  choosing: "choosing",
  processing: "uploading",
  uploading: "uploading",
  submitting: "uploading",
};

const TASK_STATUS_TO_FLOW_STAGE: Partial<Record<CustomPetTaskStatus, FlowStageId>> = {
  uploaded: "uploading",
  analyzing: "analyzing",
  generating_idle: "generating_idle",
  generating_variants: "generating_variants",
  validating: "validating",
  rerolling: "generating_idle",
  preview_ready: "preview_ready",
};

const LOCAL_STATUS_TEXT: Record<CustomPetUploadStage, string> = {
  syncing: "正在同步积分",
  preparing: "正在准备上传",
  choosing: "请选择一张清晰宠物图片",
  processing: "正在裁剪并压缩图片",
  uploading: "正在上传原图",
  submitting: "正在提交云端生成",
};

const TASK_STATUS_TEXT: Partial<Record<CustomPetTaskStatus, string>> = {
  uploaded: "图片已上传，等待云端处理",
  analyzing: "正在识别宠物特征",
  generating_idle: "正在绘制默认形象",
  generating_variants: "正在生成互动状态",
  validating: "正在检查生成结果",
  rerolling: "正在重新绘制",
};

export function getActiveFlowStage(value: {
  localStage?: CustomPetUploadStage | null;
  taskStatus?: CustomPetTaskStatus | null;
}): FlowStageId {
  if (value.localStage) {
    return LOCAL_STAGE_TO_FLOW_STAGE[value.localStage];
  }
  if (value.taskStatus) {
    return TASK_STATUS_TO_FLOW_STAGE[value.taskStatus] || "choosing";
  }
  return "choosing";
}

export function getStepState(stepId: FlowStageId, activeStage: FlowStageId): CustomPetStepState {
  const stepIndex = CUSTOM_PET_FLOW_STEPS.findIndex((step) => step.id === stepId);
  const activeIndex = CUSTOM_PET_FLOW_STEPS.findIndex((step) => step.id === activeStage);
  if (stepIndex < activeIndex) return "done";
  if (stepIndex === activeIndex) return "active";
  return "pending";
}

export function getFlowProgress(activeStage: FlowStageId): number {
  const activeIndex = CUSTOM_PET_FLOW_STEPS.findIndex((step) => step.id === activeStage);
  const boundedIndex = Math.max(0, activeIndex);
  return Math.min(100, 12 + boundedIndex * 14);
}

export function getActiveStatusText(value: {
  localStage?: CustomPetUploadStage | null;
  taskStatus?: CustomPetTaskStatus | null;
  isQuotaWaiting?: boolean;
}): string {
  if (value.isQuotaWaiting) {
    return "图片生成额度繁忙，已排队自动重试";
  }
  if (value.localStage) {
    return LOCAL_STATUS_TEXT[value.localStage];
  }
  if (value.taskStatus) {
    return TASK_STATUS_TEXT[value.taskStatus] || "正在处理";
  }
  return "正在准备";
}

export function getTerminalStatusCopy(value: {
  status: "failed" | "cancelled";
  showRefundNotice: boolean;
}): string {
  if (value.showRefundNotice) {
    return "本次生成未完成，积分已退回";
  }
  return value.status === "cancelled"
    ? "本次生成已取消，可重新选择图片。"
    : "本次生成已结束，可重新选择图片。";
}
