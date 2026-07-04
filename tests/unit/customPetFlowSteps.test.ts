import {
  getActiveFlowStage,
  getActiveStatusText,
  getFlowProgress,
  getStepState,
  getTerminalStatusCopy,
} from "../../src/pages/pet/components/CustomPetFlow/customPetFlowSteps";

describe("customPetFlowSteps", () => {
  test("maps local upload stages into visible flow steps", () => {
    const activeStage = getActiveFlowStage({ localStage: "processing" });

    expect(activeStage).toBe("uploading");
    expect(getActiveStatusText({ localStage: "processing" })).toBe("正在裁剪并压缩图片");
    expect(getStepState("choosing", activeStage)).toBe("done");
    expect(getStepState("uploading", activeStage)).toBe("active");
    expect(getStepState("analyzing", activeStage)).toBe("pending");
  });

  test("maps cloud task stages into progress and quota copy", () => {
    const activeStage = getActiveFlowStage({ taskStatus: "generating_variants" });

    expect(activeStage).toBe("generating_variants");
    expect(getFlowProgress(activeStage)).toBeGreaterThan(getFlowProgress("analyzing"));
    expect(getActiveStatusText({
      taskStatus: "generating_variants",
      isQuotaWaiting: true,
    })).toBe("图片生成额度繁忙，已排队自动重试");
  });

  test("keeps refund wording one-time while retaining terminal context", () => {
    expect(getTerminalStatusCopy({
      status: "failed",
      showRefundNotice: true,
    })).toBe("本次生成未完成，积分已退回");
    expect(getTerminalStatusCopy({
      status: "failed",
      showRefundNotice: false,
    })).toBe("本次生成已结束，可重新选择图片。");
    expect(getTerminalStatusCopy({
      status: "cancelled",
      showRefundNotice: false,
    })).toBe("本次生成已取消，可重新选择图片。");
  });
});
